/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export interface FetchResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

function buildUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function getEsUrl(): string | null {
  return process.env.ES_URL ?? process.env.ELASTICSEARCH_URL ?? null;
}

function getEsAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = process.env.ES_API_KEY;
  const username = process.env.ES_USERNAME;
  const password = process.env.ES_PASSWORD;

  if (apiKey) {
    headers.Authorization = `ApiKey ${apiKey}`;
  } else if (username && password) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  return headers;
}

export async function esFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<FetchResult> {
  const base = getEsUrl();
  if (!base) {
    return { ok: false, error: 'ES_URL or ELASTICSEARCH_URL not set' };
  }

  const url = buildUrl(base, path);
  const headers = getEsAuthHeaders();

  try {
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(data)}` };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function getKibanaUrl(): string | null {
  return process.env.KIBANA_URL ?? null;
}

export async function kibanaFetch(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<FetchResult> {
  const base = getKibanaUrl();
  if (!base) return { ok: false, error: 'KIBANA_URL not set' };
  const apiKey = process.env.KIBANA_API_KEY ?? process.env.ES_API_KEY;
  const username = process.env.KIBANA_USERNAME ?? process.env.ES_USERNAME;
  const password = process.env.KIBANA_PASSWORD ?? process.env.ES_PASSWORD;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'kbn-xsrf': 'true',
    'x-elastic-internal-origin': 'kibana',
    ...options.headers,
  };
  if (apiKey) {
    headers.Authorization = `ApiKey ${apiKey}`;
  } else if (username && password) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }
  try {
    const url = buildUrl(base, path);
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(data)}` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const CLOUD_API_BASE = 'https://api.elastic-cloud.com';

export function getCloudApiBase(): string {
  return process.env.ELASTIC_CLOUD_API_BASE ?? CLOUD_API_BASE;
}

export function getCloudApiKey(): string | null {
  return process.env.ELASTIC_CLOUD_API_KEY ?? null;
}

export function requireCloudApiKey(): { ok: false; message: string } | { ok: true; key: string } {
  const key = getCloudApiKey();
  if (!key?.trim()) {
    return {
      ok: false,
      message:
        'Elastic Cloud API key not set. Set ELASTIC_CLOUD_API_KEY in your environment. Create one at https://cloud.elastic.io (Profile → API Keys).',
    };
  }
  return { ok: true, key };
}

export async function cloudFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<FetchResult> {
  const auth = requireCloudApiKey();
  if (!auth.ok) return { ok: false, error: auth.message };
  const url = `${getCloudApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Authorization: `ApiKey ${auth.key}`,
    'Content-Type': 'application/json',
  };
  try {
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
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
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
