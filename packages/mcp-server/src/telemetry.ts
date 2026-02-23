/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Opt-in adoption telemetry. Events are ECS-compatible and batched to Elasticsearch.
 * Enable with ELASTIC_TELEMETRY_OPT_IN=true and set ES_URL + ES_API_KEY (or telemetry endpoint).
 */

const OPT_IN = process.env.ELASTIC_TELEMETRY_OPT_IN === 'true';
const TELEMETRY_INDEX = process.env.ELASTIC_TELEMETRY_INDEX ?? 'elastic-cursor-plugin-telemetry';

interface TelemetryEvent {
  '@timestamp': string;
  'ecs.version': string;
  event: { kind: string; category: string[] };
  'elastic.cursor_plugin': {
    tool_name?: string;
    skill_name?: string;
    version: string;
  };
}

const queue: TelemetryEvent[] = [];
const BATCH_SIZE = 10;
const FLUSH_MS = 5000;
let flushTimer: ReturnType<typeof setInterval> | null = null;

function getTimestamp(): string {
  return new Date().toISOString();
}

export function recordToolInvocation(toolName: string): void {
  if (!OPT_IN) return;
  queue.push({
    '@timestamp': getTimestamp(),
    'ecs.version': '1.0',
    event: { kind: 'event', category: ['usage'] },
    'elastic.cursor_plugin': {
      tool_name: toolName,
      version: '0.1.0',
    },
  });
  scheduleFlush();
}

export function recordSkillUsage(skillName: string): void {
  if (!OPT_IN) return;
  queue.push({
    '@timestamp': getTimestamp(),
    'ecs.version': '1.0',
    event: { kind: 'event', category: ['usage'] },
    'elastic.cursor_plugin': {
      skill_name: skillName,
      version: '0.1.0',
    },
  });
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setInterval(flush, FLUSH_MS);
}

async function flush(): Promise<void> {
  if (queue.length === 0) {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    return;
  }
  const batch = queue.splice(0, BATCH_SIZE);
  const url = process.env.ES_URL;
  const apiKey = process.env.ES_API_KEY;
  if (!url || !apiKey) return;
  try {
    const body = batch.flatMap((doc) => [{ index: { _index: TELEMETRY_INDEX } }, doc]);
    await fetch(`${url.replace(/\/$/, '')}/_bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-ndjson',
        Authorization: `ApiKey ${apiKey}`,
      },
      body: body.map((x) => JSON.stringify(x)).join('\n') + '\n',
    });
  } catch {
    // Re-queue on failure (best effort)
    queue.push(...batch);
  }
  if (queue.length === 0 && flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

export function flushSync(): Promise<void> {
  return flush();
}
