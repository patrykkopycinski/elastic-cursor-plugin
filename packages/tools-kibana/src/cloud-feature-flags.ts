/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

const CLOUD_API_BASE = 'https://api.elastic-cloud.com';

const REQUIRED_FLAGS: Record<string, string> = {
  'server.restrictInternalApis': 'false',
  'feature_flags.overrides.dashboardAgent.enabled': 'true',
  'feature_flags.overrides.lens.apiFormat': 'true',
  'feature_flags.overrides.lens.enable_esql': 'true',
};

interface CloudFetchResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

async function cloudFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<CloudFetchResult> {
  const apiKey = process.env.ELASTIC_CLOUD_API_KEY;
  if (!apiKey) return { ok: false, error: 'ELASTIC_CLOUD_API_KEY not set' };

  const base = process.env.ELASTIC_CLOUD_API_BASE ?? CLOUD_API_BASE;
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  try {
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const errMsg =
        typeof data === 'object' && data && 'message' in data
          ? String((data as { message: unknown }).message)
          : text || res.statusText;
      return { ok: false, error: `HTTP ${res.status}: ${errMsg}` };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Parse ES_CLOUD_ID to extract the base domain.
 * Format: `name:base64(domain:es_uuid:kibana_uuid)`
 */
export function parseCloudId(cloudId: string): { domain: string; esUuid: string; kibanaUuid: string } | null {
  const colonIdx = cloudId.indexOf(':');
  if (colonIdx < 0) return null;
  const encoded = cloudId.slice(colonIdx + 1);
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return null;
    return { domain: parts[0], esUuid: parts[1], kibanaUuid: parts[2] };
  } catch {
    return null;
  }
}

function getCloudDeploymentId(): string | null {
  return process.env.ELASTIC_CLOUD_DEPLOYMENT_ID ?? null;
}

interface DeploymentResource {
  id: string;
  info?: { metadata?: { endpoint?: string; cloud_id?: string } };
}

interface DeploymentListItem {
  id: string;
  name?: string;
  resources?: {
    elasticsearch?: DeploymentResource[];
    kibana?: DeploymentResource[];
  };
}

async function autoDiscoverDeploymentId(): Promise<string | null> {
  const cloudId = process.env.ES_CLOUD_ID;
  const kibanaUrl = process.env.KIBANA_URL;
  if (!cloudId && !kibanaUrl) return null;

  const parsed = cloudId ? parseCloudId(cloudId) : null;

  const result = await cloudFetch('/api/v1/deployments?show_metadata=true&show_plan_defaults=false');
  if (!result.ok || !result.data) return null;

  const deployments = (result.data as { deployments?: DeploymentListItem[] }).deployments ?? [];

  for (const dep of deployments) {
    if (parsed?.domain) {
      const esResources = dep.resources?.elasticsearch ?? [];
      for (const es of esResources) {
        const endpoint = es.info?.metadata?.endpoint ?? '';
        if (endpoint && endpoint.includes(parsed.domain)) return dep.id;
      }
      const kbResources = dep.resources?.kibana ?? [];
      for (const kb of kbResources) {
        const endpoint = kb.info?.metadata?.endpoint ?? '';
        if (endpoint && endpoint.includes(parsed.domain)) return dep.id;
      }
    }

    if (kibanaUrl) {
      const kbResources = dep.resources?.kibana ?? [];
      for (const kb of kbResources) {
        const endpoint = kb.info?.metadata?.endpoint ?? '';
        if (endpoint && kibanaUrl.includes(endpoint)) return dep.id;
      }
    }
  }

  return null;
}

export async function resolveDeploymentId(): Promise<string | null> {
  const explicit = getCloudDeploymentId();
  if (explicit) return explicit;
  return autoDiscoverDeploymentId();
}

interface KibanaPlan {
  kibana?: { user_settings_yaml?: string; version?: string;[k: string]: unknown };
  cluster_topology?: unknown[];
  transient?: unknown;
  [k: string]: unknown;
}

interface KibanaResource {
  ref_id: string;
  region: string;
  elasticsearch_cluster_ref_id?: string;
  plan: KibanaPlan;
  [k: string]: unknown;
}

interface DeploymentSpec {
  name?: string;
  alias?: string;
  prune_orphans?: boolean;
  metadata?: unknown;
  settings?: unknown;
  resources?: {
    elasticsearch?: unknown[];
    kibana?: KibanaResource[];
    apm?: unknown[];
    integrations_server?: unknown[];
    appsearch?: unknown[];
    enterprise_search?: unknown[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

function flagsMissing(yaml: string): string[] {
  const missing: string[] = [];
  for (const key of Object.keys(REQUIRED_FLAGS)) {
    if (!yaml.includes(key)) {
      missing.push(key);
    }
  }
  return missing;
}

function mergeFlags(existingYaml: string): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(REQUIRED_FLAGS)) {
    if (!existingYaml.includes(key)) {
      lines.push(`${key}: ${value}`);
    }
  }
  if (!lines.length) return existingYaml;
  const separator = existingYaml.length > 0 && !existingYaml.endsWith('\n') ? '\n' : '';
  return existingYaml + separator + lines.join('\n');
}

async function waitForPlanCompletion(
  deploymentId: string,
  maxWaitMs = 90_000,
  intervalMs = 10_000
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const result = await cloudFetch(`/api/v1/deployments/${deploymentId}?show_plan_defaults=false`);
    if (!result.ok) continue;

    const data = result.data as { resources?: { kibana?: Array<{ info?: { plan_info?: { pending?: unknown } } }> } };
    const kibanaInfo = data?.resources?.kibana?.[0]?.info?.plan_info;
    if (kibanaInfo && !kibanaInfo.pending) return true;
  }

  return false;
}

export interface EnableFlagsViaCloudOptions {
  maxWaitMs?: number;
  pollIntervalMs?: number;
}

export async function enableFeatureFlagsViaCloud(
  options: EnableFlagsViaCloudOptions = {}
): Promise<string[]> {
  const { maxWaitMs = 90_000, pollIntervalMs = 10_000 } = options;
  const notes: string[] = [];

  const deploymentId = await resolveDeploymentId();
  if (!deploymentId) {
    notes.push(
      'Could not resolve Cloud deployment ID. Set ELASTIC_CLOUD_DEPLOYMENT_ID or ES_CLOUD_ID for auto-discovery.'
    );
    return notes;
  }

  const getResult = await cloudFetch(
    `/api/v1/deployments/${deploymentId}?show_plan_defaults=false&show_metadata=false`
  );
  if (!getResult.ok) {
    notes.push(`Failed to get Cloud deployment: ${getResult.error}`);
    return notes;
  }

  const deployment = getResult.data as DeploymentSpec;
  const kibanaResources = deployment.resources?.kibana;
  if (!kibanaResources?.length) {
    notes.push('No Kibana resource found in Cloud deployment.');
    return notes;
  }

  const kibana = kibanaResources[0];
  if (!kibana?.plan?.kibana) {
    notes.push('No Kibana plan found in Cloud deployment.');
    return notes;
  }

  const currentYaml = kibana.plan.kibana.user_settings_yaml ?? '';
  const missing = flagsMissing(currentYaml);

  if (!missing.length) {
    notes.push('All required feature flags already present in Cloud Kibana user settings.');
    return notes;
  }

  const mergedYaml = mergeFlags(currentYaml);
  kibana.plan.kibana.user_settings_yaml = mergedYaml;

  const putBody: Record<string, unknown> = {
    ...deployment,
    prune_orphans: false,
  };

  const putResult = await cloudFetch(
    `/api/v1/deployments/${deploymentId}?skip_snapshot=true&validate_only=false`,
    { method: 'PUT', body: putBody }
  );

  if (!putResult.ok) {
    notes.push(`Failed to update Cloud deployment with feature flags: ${putResult.error}`);
    return notes;
  }

  notes.push(
    `Updated Cloud Kibana user settings with: ${missing.join(', ')}. Waiting for plan to apply...`
  );

  const completed = await waitForPlanCompletion(deploymentId, maxWaitMs, pollIntervalMs);
  if (completed) {
    notes.push('Kibana plan applied successfully. Feature flags are now active.');
  } else {
    notes.push(
      'Kibana plan change submitted but still pending. Dashboard creation will proceed — if it fails, retry in a minute.'
    );
  }

  return notes;
}
