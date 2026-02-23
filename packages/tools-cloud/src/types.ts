/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export interface ToolRegistrationContext {
  registerTool(
    name: string,
    definition: { title: string; description: string; inputSchema: unknown },
    handler: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>
  ): void;
}

const CLOUD_API_BASE = 'https://api.elastic-cloud.com';

export function getCloudApiBase(): string {
  return process.env.ELASTIC_CLOUD_API_BASE ?? CLOUD_API_BASE;
}

export function getCloudApiKey(): string | null {
  return process.env.ELASTIC_CLOUD_API_KEY ?? null;
}

export function requireApiKey(): { ok: false; message: string } | { ok: true; key: string } {
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
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const auth = requireApiKey();
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
      const errMsg = typeof data === 'object' && data && 'message' in data ? String((data as { message: unknown }).message) : text || res.statusText;
      return { ok: false, error: `HTTP ${res.status}: ${errMsg}` };
    }
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
