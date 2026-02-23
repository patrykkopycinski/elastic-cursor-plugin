/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerAll } from '../src/index.js';
import { createCaptureServer, invokeTool } from './capture-server.js';

const clusterInfo = (buildFlavor = 'default') => ({
  cluster_name: 'test',
  version: { number: '8.15.0', build_flavor: buildFlavor },
});

const emptyAggs = { aggregations: {} };

const emptyResolve = { data_streams: [] };

function jsonResponse(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

function buildFetchRouter(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    'POST:traces-apm': { aggregations: { services: { buckets: [] } } },
    'POST:metrics-system': { aggregations: { hosts: { buckets: [] } } },
    'POST:metrics-kubernetes': { aggregations: { containers: { buckets: [] } } },
    'POST:logs-': { aggregations: { datasets: { buckets: [] } } },
    'GET:_resolve': emptyResolve,
    'GET:metrics-generic.otel-*/_count': { count: 0 },
    'GET:metrics-generic.otel-*/_field_caps': { fields: {} },
    'GET:/': clusterInfo(),
  };

  const routes = { ...defaults, ...overrides };

  return vi.fn().mockImplementation((url: string, opts?: { method?: string }) => {
    const method = opts?.method ?? 'GET';
    const urlStr = String(url);

    for (const [pattern, data] of Object.entries(routes)) {
      const colonIdx = pattern.indexOf(':');
      const m = pattern.slice(0, colonIdx);
      const pathFragment = pattern.slice(colonIdx + 1);
      if (method === m && urlStr.includes(pathFragment)) {
        return Promise.resolve(jsonResponse(data));
      }
    }

    return Promise.resolve(jsonResponse(emptyAggs));
  });
}

describe('discover_o11y_data', () => {
  const esUrl = 'https://es.example.com';
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = buildFetchRouter();
    globalThis.fetch = fetchMock;
    process.env.ES_URL = esUrl;
    process.env.ES_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ES_URL;
    delete process.env.ELASTICSEARCH_URL;
    delete process.env.ES_API_KEY;
  });

  it('registers the tool', () => {
    const server = createCaptureServer();
    registerAll(server);
    expect(server.tools.has('discover_o11y_data')).toBe(true);
  });

  it('returns error when ES_URL is not set', async () => {
    delete process.env.ES_URL;
    delete process.env.ELASTICSEARCH_URL;

    const server = createCaptureServer();
    registerAll(server);
    const out = await invokeTool(server, 'discover_o11y_data', {});

    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain('ES_URL');
  });

  it('discovers APM services', async () => {
    const now = new Date();
    const maxTs = now.toISOString();
    const minTs = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    fetchMock = buildFetchRouter({
      'POST:traces-apm': {
        aggregations: {
          services: {
            buckets: [
              {
                key: 'payment-service',
                doc_count: 9000,
                env: { buckets: [{ key: 'production', doc_count: 9000 }] },
                lang: { buckets: [{ key: 'java', doc_count: 9000 }] },
                min_ts: { value: new Date(minTs).getTime(), value_as_string: minTs },
                max_ts: { value: new Date(maxTs).getTime(), value_as_string: maxTs },
                ds: { buckets: [{ key: 'traces-apm-default', doc_count: 9000 }] },
              },
            ],
          },
        },
      },
    });
    globalThis.fetch = fetchMock;

    const server = createCaptureServer();
    registerAll(server);
    const out = await invokeTool(server, 'discover_o11y_data', {});

    const text = out.content[0].text;
    expect(text).toContain('payment-service');
    expect(text).toContain('production');
    expect(text).toContain('req/min');
  });

  it('discovers hosts', async () => {
    const now = new Date();
    const maxTs = now.toISOString();
    const minTs = new Date(now.getTime() - 3600_000).toISOString();

    fetchMock = buildFetchRouter({
      'POST:metrics-system': {
        aggregations: {
          hosts: {
            buckets: [
              {
                key: 'web-server-01',
                doc_count: 5000,
                metricsets: { buckets: [{ key: 'cpu', doc_count: 2500 }, { key: 'memory', doc_count: 2500 }] },
                min_ts: { value_as_string: minTs },
                max_ts: { value_as_string: maxTs },
              },
            ],
          },
        },
      },
    });
    globalThis.fetch = fetchMock;

    const server = createCaptureServer();
    registerAll(server);
    const out = await invokeTool(server, 'discover_o11y_data', {});

    const text = out.content[0].text;
    expect(text).toContain('web-server-01');
    expect(text).toContain('cpu');
  });

  it('discovers log sources', async () => {
    const now = new Date();
    const maxTs = now.toISOString();
    const minTs = new Date(now.getTime() - 86400_000).toISOString();

    fetchMock = buildFetchRouter({
      'POST:logs-': {
        aggregations: {
          datasets: {
            buckets: [
              {
                key: 'nginx.access',
                doc_count: 50000,
                svc: { buckets: [] },
                host: { buckets: [{ key: 'web-server-01', doc_count: 50000 }] },
                levels: {
                  buckets: [
                    { key: 'info', doc_count: 45000 },
                    { key: 'error', doc_count: 5000 },
                  ],
                },
                min_ts: { value_as_string: minTs },
                max_ts: { value_as_string: maxTs },
              },
            ],
          },
        },
      },
    });
    globalThis.fetch = fetchMock;

    const server = createCaptureServer();
    registerAll(server);
    const out = await invokeTool(server, 'discover_o11y_data', {});

    const text = out.content[0].text;
    expect(text).toContain('nginx.access');
    expect(text).toContain('docs/day');
  });

  it('handles empty cluster', async () => {
    const server = createCaptureServer();
    registerAll(server);
    const out = await invokeTool(server, 'discover_o11y_data', {});

    expect(out.isError).toBeUndefined();
    const text = out.content[0].text;
    expect(text).not.toContain('APM Services (');
    expect(text).toContain('Cluster: test');
  });

  it('scoped discovery filters by service_names', async () => {
    const server = createCaptureServer();
    registerAll(server);
    await invokeTool(server, 'discover_o11y_data', { service_names: ['my-svc'] });

    const apmCall = fetchMock.mock.calls.find(
      ([url, opts]: [string, { method?: string }]) =>
        String(url).includes('traces-apm') && opts?.method === 'POST'
    );
    expect(apmCall).toBeDefined();

    const body = JSON.parse(apmCall![1].body as string);
    const must = body.query.bool.must;
    const termsFilter = must.find((clause: Record<string, unknown>) => 'terms' in clause);
    expect(termsFilter).toBeDefined();
    expect(termsFilter.terms['service.name']).toEqual(['my-svc']);
  });

  it('detects serverless cluster', async () => {
    fetchMock = buildFetchRouter({
      'GET:/': clusterInfo('serverless'),
    });
    globalThis.fetch = fetchMock;

    const server = createCaptureServer();
    registerAll(server);
    const out = await invokeTool(server, 'discover_o11y_data', {});

    expect(out.content[0].text).toContain('Serverless: Yes');
  });

  it('discovers IoT data profiles', async () => {
    const now = new Date();
    const maxTs = now.toISOString();
    const minTs = new Date(now.getTime() - 3600_000).toISOString();

    fetchMock = buildFetchRouter({
      'GET:metrics-generic.otel-*/_count': { count: 500 },
      'GET:metrics-generic.otel-*/_field_caps': {
        fields: {
          'metrics.water.ph': { double: { type: 'double' } },
          'metrics.chemical.dosing_rate_lpm': { double: { type: 'double' } },
          'attributes.site.name': { keyword: { type: 'keyword' } },
          'attributes.device.type': { keyword: { type: 'keyword' } },
          '@timestamp': { date: { type: 'date' } },
        },
      },
      'POST:metrics-generic.otel': {
        hits: { total: { value: 500 } },
        aggregations: {
          min_ts: { value_as_string: minTs },
          max_ts: { value_as_string: maxTs },
          sites: {
            buckets: [
              {
                key: 'Hospital',
                doc_count: 300,
                devices: {
                  buckets: [
                    { key: 'water_quality', doc_count: 200 },
                    { key: 'chemical', doc_count: 100 },
                  ],
                },
              },
            ],
          },
        },
      },
    });
    globalThis.fetch = fetchMock;

    const server = createCaptureServer();
    registerAll(server);
    const out = await invokeTool(server, 'discover_o11y_data', {});

    const text = out.content[0].text;
    expect(text).toContain('IoT Data Profiles');
    expect(text).toContain('Hospital');
    expect(text).toContain('metrics.water.ph');
  });
});
