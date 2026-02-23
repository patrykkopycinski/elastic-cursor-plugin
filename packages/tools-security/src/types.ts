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

export function getKibanaUrl(): string | null {
  return process.env.KIBANA_URL ?? null;
}

export async function kibanaFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const base = getKibanaUrl();
  if (!base) return { ok: false, error: 'KIBANA_URL not set' };
  const apiKey = process.env.KIBANA_API_KEY ?? process.env.ES_API_KEY;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `ApiKey ${apiKey}`;
  try {
    const url = `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
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
