#!/usr/bin/env node

/**
 * Setup script for the IoT Dashboard-as-Code example.
 *
 * Clones the iot-demo project, configures it for the local or Cloud Elastic stack,
 * installs dependencies, starts the dev server, and generates metric data.
 *
 * Usage:
 *   node setup.js                       # Full setup: clone → configure → install → start → generate data
 *   node setup.js --generate-data-only  # Skip clone/install, just generate data (app must be running)
 *
 * Environment:
 *   ES_URL              Elasticsearch endpoint (default: http://localhost:9200)
 *   ELASTIC_PASSWORD    Password for the elastic user (default: changeme)
 *
 * For Cloud: set ES_URL to your Cloud ES endpoint (https://...) and ELASTIC_PASSWORD.
 * The script auto-detects remote ES and routes OTLP to ES native intake, installing
 * the protobuf exporter (ES OTLP rejects JSON with HTTP 406).
 */

import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IOT_DEMO_DIR = resolve(__dirname, 'iot-demo');
const IOT_DEMO_REPO = 'https://github.com/poulsbopete/iot-demo.git';

const ELASTIC_PASSWORD = process.env.ELASTIC_PASSWORD || 'changeme';
const ES_URL = process.env.ES_URL || 'http://localhost:9200';
const IOT_DEMO_PORT = 3000;
const STEP_COUNT = 80;
const STEP_DELAY_MS = 500;

const generateDataOnly = process.argv.includes('--generate-data-only');

function log(msg) {
  console.log(`\x1b[36m[setup]\x1b[0m ${msg}`);
}

function logError(msg) {
  console.error(`\x1b[31m[setup]\x1b[0m ${msg}`);
}

async function waitForService(url, name, maxRetries = 60, delayMs = 3000) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 401) {
        log(`${name} is ready (attempt ${i})`);
        return;
      }
    } catch {
      // not ready yet
    }
    if (i % 10 === 0) log(`Waiting for ${name}... (attempt ${i}/${maxRetries})`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`${name} at ${url} did not become available after ${maxRetries} attempts`);
}

async function checkStack() {
  log('Checking Elastic stack health...');
  try {
    const res = await fetch(`${ES_URL}/_cluster/health`, {
      headers: { Authorization: `Basic ${Buffer.from(`elastic:${ELASTIC_PASSWORD}`).toString('base64')}` },
    });
    if (!res.ok) throw new Error(`ES returned ${res.status}`);
    const data = await res.json();
    log(`Elasticsearch cluster "${data.cluster_name}" status: ${data.status}`);
  } catch (e) {
    logError(`Cannot reach Elasticsearch at ${ES_URL}. Is the Docker stack running?`);
    logError(`Run: docker compose up -d`);
    process.exit(1);
  }
}

function cloneRepo() {
  if (existsSync(IOT_DEMO_DIR)) {
    log('iot-demo directory already exists, skipping clone');
    return;
  }
  log(`Cloning ${IOT_DEMO_REPO}...`);
  execSync(`git clone ${IOT_DEMO_REPO} "${IOT_DEMO_DIR}"`, { stdio: 'inherit' });
}

function isRemoteEs() {
  return ES_URL.startsWith('https://') && !ES_URL.includes('localhost');
}

async function detectOtlpEndpoint() {
  // When targeting a remote (Cloud) ES, skip local service detection and use
  // ES native OTLP directly. Local collectors (port 4318/8200) are unrelated.
  if (isRemoteEs()) {
    log(`Remote ES detected (${ES_URL}), using ES native OTLP intake`);
    return ES_URL;
  }

  // APM Server on 8200 (Docker Compose stack)
  try {
    const res = await fetch('http://localhost:8200', { signal: AbortSignal.timeout(2000) });
    if (res.ok || res.status === 200) {
      log('Detected APM Server on port 8200, using it as OTLP endpoint');
      return 'http://localhost:8200/v1/metrics';
    }
  } catch { /* not available */ }

  // EDOT/OTel collector on 4318
  try {
    const res = await fetch('http://localhost:4318', { signal: AbortSignal.timeout(2000) });
    if (res.ok || res.status !== undefined) {
      log('Detected OTel collector on port 4318, using it as OTLP endpoint');
      return 'http://localhost:4318/v1/metrics';
    }
  } catch { /* not available */ }

  // Fall back to ES native OTLP (9.x+)
  log('No APM Server or OTel collector found, using ES native OTLP intake');
  return ES_URL;
}

async function configureEnv() {
  const basicAuth = Buffer.from(`elastic:${ELASTIC_PASSWORD}`).toString('base64');
  const otlpUrl = await detectOtlpEndpoint();
  const envContent = [
    `ELASTIC_ENDPOINT=${ES_URL}`,
    `ELASTIC_API_KEY=`,
    `OTLP_ENDPOINT=${otlpUrl}`,
    `OTLP_HEADERS=Authorization=Basic ${basicAuth}`,
    `DEMO_SEED=42`,
  ].join('\n') + '\n';

  const envPath = resolve(IOT_DEMO_DIR, '.env.local');
  writeFileSync(envPath, envContent);
  log(`Wrote ${envPath}`);
}

function patchOtlpExporter() {
  const otlpFile = resolve(IOT_DEMO_DIR, 'lib', 'otlpExport.ts');
  if (!existsSync(otlpFile)) return;
  let content = readFileSync(otlpFile, 'utf-8');
  const from = '@opentelemetry/exporter-metrics-otlp-http';
  const to = '@opentelemetry/exporter-metrics-otlp-proto';
  if (content.includes(from)) {
    content = content.replace(from, to);
    writeFileSync(otlpFile, content);
    log(`Patched ${otlpFile}: switched to proto exporter for ES native OTLP`);
  }
}

function installDeps() {
  log('Installing iot-demo dependencies...');
  execSync('npm install', { cwd: IOT_DEMO_DIR, stdio: 'inherit' });

  // ES native OTLP only accepts application/x-protobuf. The iot-demo ships
  // with @opentelemetry/exporter-metrics-otlp-http (JSON-only), which gets
  // HTTP 406 from ES. Install the proto exporter at a compatible version.
  if (isRemoteEs()) {
    log('Installing @opentelemetry/exporter-metrics-otlp-proto for ES native OTLP...');
    const httpVer = execSync(
      'node -e "console.log(require(\'@opentelemetry/exporter-metrics-otlp-http/package.json\').version)"',
      { cwd: IOT_DEMO_DIR, encoding: 'utf-8' },
    ).trim();
    execSync(`npm install @opentelemetry/exporter-metrics-otlp-proto@${httpVer}`, {
      cwd: IOT_DEMO_DIR,
      stdio: 'inherit',
    });
    patchOtlpExporter();
  }
}

function startDevServer() {
  log('Starting iot-demo dev server...');
  const child = spawn('npm', ['run', 'dev'], {
    cwd: IOT_DEMO_DIR,
    stdio: 'pipe',
    detached: true,
    env: { ...process.env, PORT: String(IOT_DEMO_PORT) },
  });

  child.stdout.on('data', (data) => {
    const line = data.toString().trim();
    if (line) console.log(`  [iot-demo] ${line}`);
  });
  child.stderr.on('data', (data) => {
    const line = data.toString().trim();
    if (line) console.log(`  [iot-demo] ${line}`);
  });

  child.unref();
  log(`Dev server starting on port ${IOT_DEMO_PORT} (PID: ${child.pid})`);
  return child;
}

async function generateData() {
  const url = `http://localhost:${IOT_DEMO_PORT}/api/simulate/step`;
  log(`Generating ${STEP_COUNT} simulation steps...`);

  let successCount = 0;
  let totalMetrics = 0;

  for (let i = 0; i < STEP_COUNT; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        successCount++;
        totalMetrics += data.metricCount || 0;
        if ((i + 1) % 20 === 0) {
          log(`  Step ${i + 1}/${STEP_COUNT}: ${totalMetrics} total metrics sent`);
        }
      } else {
        logError(`  Step ${i + 1} failed: HTTP ${res.status}`);
      }
    } catch (e) {
      logError(`  Step ${i + 1} error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, STEP_DELAY_MS));
  }

  log(`Data generation complete: ${successCount}/${STEP_COUNT} steps, ${totalMetrics} metrics`);
}

async function main() {
  try {
    await checkStack();

    if (!generateDataOnly) {
      cloneRepo();
      await configureEnv();
      installDeps();
      startDevServer();
      log(`Waiting for iot-demo at http://localhost:${IOT_DEMO_PORT}...`);
      await waitForService(`http://localhost:${IOT_DEMO_PORT}`, 'iot-demo', 40, 3000);
    }

    await generateData();

    log('');
    log('Setup complete! Next steps:');
    log('  1. Open Cursor in this directory');
    log('  2. Ask the AI: "What indices have IoT data?"');
    log('  3. Ask the AI: "Create a dashboard for the IoT metrics"');
    log(`  4. Open Kibana: http://localhost:5601 (elastic / ${ELASTIC_PASSWORD})`);
  } catch (e) {
    logError(e.message);
    process.exit(1);
  }
}

main();
