/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { kibanaFetch, getKibanaUrl } from './types.js';
import { enableFeatureFlagsViaCloud } from './cloud-feature-flags.js';

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export const ok = (text: string): ToolResult => ({ content: [{ type: 'text', text }] });
export const fail = (text: string): ToolResult => ({ content: [{ type: 'text', text }], isError: true });

export function requireKibanaUrl(): string | null {
  return getKibanaUrl();
}

export async function getKibanaVersion(): Promise<string | null> {
  const result = await kibanaFetch('/api/status');
  if (!result.ok) return null;
  const data = result.data as { version?: { number?: string } };
  return data?.version?.number ?? null;
}

export async function enableFeatureFlags(): Promise<string[]> {
  const notes: string[] = [];
  const flags: Record<string, boolean> = {
    'dashboardAgent.enabled': true,
    'lens.apiFormat': true,
    'lens.enable_esql': true,
  };

  const internalResult = await kibanaFetch('/internal/core/_settings', {
    method: 'PUT',
    body: { 'feature_flags.overrides': flags },
    headers: { 'Elastic-Api-Version': '1' },
  });

  if (internalResult.ok) {
    notes.push('Feature flags enabled via Kibana internal API.');
    return notes;
  }

  if (process.env.ELASTIC_CLOUD_API_KEY) {
    const cloudNotes = await enableFeatureFlagsViaCloud();
    notes.push(...cloudNotes);
    return notes;
  }

  notes.push(
    'Could not enable feature flags dynamically. ' +
    'Either set coreApp.allowDynamicConfigOverrides: true in kibana.yml, ' +
    'or set ELASTIC_CLOUD_API_KEY for automatic Cloud configuration.'
  );
  return notes;
}

export function dashboardUrl(id: string): string {
  const base = getKibanaUrl()?.replace(/\/$/, '') ?? '';
  return base ? `${base}/app/dashboards#/view/${id}` : '';
}

export async function kibanaAsCodeFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): ReturnType<typeof kibanaFetch> {
  return kibanaFetch(path, {
    ...options,
    headers: { 'Elastic-Api-Version': '1' },
  });
}
