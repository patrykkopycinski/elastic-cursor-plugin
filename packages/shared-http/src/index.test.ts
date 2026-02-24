/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { esFetch, kibanaFetch, cloudFetch } from './index.js';

function mockFetch(data: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

describe('esFetch', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns error when ES_URL not set', async () => {
    delete process.env.ES_URL;
    delete process.env.ELASTICSEARCH_URL;
    const result = await esFetch('/');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ES_URL');
  });

  it('makes successful request', async () => {
    process.env.ES_URL = 'http://localhost:9200';
    const mock = mockFetch({ status: 'green' });
    vi.stubGlobal('fetch', mock);

    const result = await esFetch('/_cluster/health');
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ status: 'green' });
    expect(mock).toHaveBeenCalledWith(
      'http://localhost:9200/_cluster/health',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('includes API key auth header', async () => {
    process.env.ES_URL = 'http://localhost:9200';
    process.env.ES_API_KEY = 'test-key';
    const mock = mockFetch({});
    vi.stubGlobal('fetch', mock);

    await esFetch('/');
    const headers = mock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('ApiKey test-key');
  });
});

describe('kibanaFetch', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns error when KIBANA_URL not set', async () => {
    delete process.env.KIBANA_URL;
    const result = await kibanaFetch('/api/status');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('KIBANA_URL');
  });

  it('includes kbn-xsrf header', async () => {
    process.env.KIBANA_URL = 'http://localhost:5601';
    const mock = mockFetch({});
    vi.stubGlobal('fetch', mock);

    await kibanaFetch('/api/status');
    const headers = mock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['kbn-xsrf']).toBe('true');
    expect(headers['x-elastic-internal-origin']).toBe('kibana');
  });
});

describe('cloudFetch', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns error when API key not set', async () => {
    delete process.env.ELASTIC_CLOUD_API_KEY;
    const result = await cloudFetch('/api/v1/serverless/projects');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Elastic Cloud API key');
  });

  it('makes successful request', async () => {
    process.env.ELASTIC_CLOUD_API_KEY = 'cloud-key';
    const mock = mockFetch({ items: [] });
    vi.stubGlobal('fetch', mock);

    const result = await cloudFetch('/api/v1/serverless/projects/elasticsearch');
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ items: [] });
  });
});
