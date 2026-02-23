/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

// --- Kibana HTTP helper (mirrors tools-kibana/src/types.ts) ---

export function getKibanaUrl(): string | null {
  return process.env.KIBANA_URL ?? null;
}

export async function kibanaFetch(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const base = getKibanaUrl();
  if (!base) return { ok: false, error: 'KIBANA_URL not set' };

  const apiKey = process.env.KIBANA_API_KEY ?? process.env.ES_API_KEY;
  const username = process.env.KIBANA_USERNAME ?? process.env.ES_USERNAME;
  const password = process.env.KIBANA_PASSWORD ?? process.env.ES_PASSWORD;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'kbn-xsrf': 'true',
    ...options.headers,
  };

  if (apiKey) {
    headers.Authorization = `ApiKey ${apiKey}`;
  } else if (username && password) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

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

// --- Response helpers ---

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export const ok = (text: string): ToolResult => ({ content: [{ type: 'text', text }] });
export const fail = (text: string): ToolResult => ({ content: [{ type: 'text', text }], isError: true });

// --- SLI types ---

export interface ApmTransactionDurationIndicator {
  type: 'sli.apm.transactionDuration';
  params: {
    service: string;
    environment: string;
    transactionType: string;
    transactionName?: string;
    threshold: number;
    'threshold.comparator': string;
  };
}

export interface ApmTransactionErrorRateIndicator {
  type: 'sli.apm.transactionErrorRate';
  params: {
    service: string;
    environment: string;
    transactionType: string;
    transactionName?: string;
  };
}

export interface KqlCustomIndicator {
  type: 'sli.kql.custom';
  params: {
    index: string;
    filter?: string;
    good: string;
    total: string;
    timestampField: string;
  };
}

export interface MetricCustomAggregation {
  field: string;
  aggregation: 'value_count' | 'sum' | 'doc_count';
  filter?: string;
}

export interface MetricCustomIndicator {
  type: 'sli.metric.custom';
  params: {
    index: string;
    filter?: string;
    good: MetricCustomAggregation;
    total: MetricCustomAggregation;
    timestampField?: string;
  };
}

export type SloIndicator =
  | ApmTransactionDurationIndicator
  | ApmTransactionErrorRateIndicator
  | KqlCustomIndicator
  | MetricCustomIndicator;

export interface SloTimeWindow {
  duration: string;
  type: 'rolling' | 'calendarAligned';
}

export interface SloObjective {
  target: number;
  timesliceTarget?: number;
  timesliceWindow?: string;
}

export interface SloConfig {
  name: string;
  description?: string;
  indicator: SloIndicator;
  timeWindow: SloTimeWindow;
  objective: SloObjective;
  budgetingMethod?: 'occurrences' | 'timeslices';
  tags?: string[];
}

export interface SloListOptions {
  name?: string;
  page?: number;
  perPage?: number;
}

// --- SloApiClient interface ---

export interface SloApiClient {
  checkAvailability(): Promise<{ available: boolean; error?: string }>;
  create(config: SloConfig): Promise<{ ok: boolean; data?: unknown; error?: string }>;
  list(options?: SloListOptions): Promise<{ ok: boolean; data?: unknown; error?: string }>;
  get(id: string): Promise<{ ok: boolean; data?: unknown; error?: string }>;
  update(id: string, config: Partial<SloConfig>): Promise<{ ok: boolean; data?: unknown; error?: string }>;
  delete(id: string): Promise<{ ok: boolean; data?: unknown; error?: string }>;
}

// --- REST implementation ---

const SLO_BASE_PATH = '/api/observability/slos';

export class RestSloApiClient implements SloApiClient {
  async checkAvailability(): Promise<{ available: boolean; error?: string }> {
    if (!getKibanaUrl()) {
      return { available: false, error: 'KIBANA_URL not set' };
    }
    const result = await kibanaFetch(`${SLO_BASE_PATH}?perPage=1`);
    if (!result.ok) {
      return { available: false, error: result.error };
    }
    return { available: true };
  }

  async create(config: SloConfig): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    return kibanaFetch(SLO_BASE_PATH, { method: 'POST', body: config });
  }

  async list(options?: SloListOptions): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    const params = new URLSearchParams();
    if (options?.name) params.set('kqlQuery', `slo.name: ${options.name}*`);
    if (options?.page) params.set('page', String(options.page));
    if (options?.perPage) params.set('perPage', String(options.perPage));
    const qs = params.toString();
    return kibanaFetch(`${SLO_BASE_PATH}${qs ? `?${qs}` : ''}`);
  }

  async get(id: string): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    return kibanaFetch(`${SLO_BASE_PATH}/${encodeURIComponent(id)}`);
  }

  async update(id: string, config: Partial<SloConfig>): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    return kibanaFetch(`${SLO_BASE_PATH}/${encodeURIComponent(id)}`, { method: 'PUT', body: config });
  }

  async delete(id: string): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    return kibanaFetch(`${SLO_BASE_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}

// --- Factory ---

export function createSloApiClient(): SloApiClient {
  return new RestSloApiClient();
}
