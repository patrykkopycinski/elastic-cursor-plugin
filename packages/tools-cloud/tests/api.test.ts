/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Tests for Cloud tools: API base URL, Authorization, request body.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerAll } from '../src/index.js';
import { createCaptureServer, invokeTool } from './capture-server.js';

describe('tools-cloud API usage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ELASTIC_CLOUD_API_KEY;
    delete process.env.ELASTIC_CLOUD_API_BASE;
  });

  describe('create_cloud_project', () => {
    it('returns error when ELASTIC_CLOUD_API_KEY is not set', async () => {
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'create_cloud_project', {
        name: 'Test',
        region_id: 'us-east-1',
      });
      expect(out.isError).toBe(true);
      expect(out.content[0].text).toContain('ELASTIC_CLOUD_API_KEY');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('calls POST with default Cloud API base and ApiKey header', async () => {
      process.env.ELASTIC_CLOUD_API_KEY = 'cloud-key';
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ id: 'proj-1', name: 'My Project', region_id: 'us-east-1' })),
      });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'create_cloud_project', {
        name: 'My Project',
        region_id: 'us-east-1',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.elastic-cloud.com/api/v1/serverless/projects/elasticsearch');
      expect(options.method).toBe('POST');
      expect(options.headers).toMatchObject({
        Authorization: 'ApiKey cloud-key',
        'Content-Type': 'application/json',
      });
      const body = JSON.parse(options.body as string);
      expect(body).toEqual({ name: 'My Project', region_id: 'us-east-1' });
    });

    it('includes optimized_for in body when provided', async () => {
      process.env.ELASTIC_CLOUD_API_KEY = 'key';
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ id: 'p1', name: 'Vector', region_id: 'eu-west-1', optimized_for: 'vector' })),
      });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'create_cloud_project', {
        name: 'Vector',
        region_id: 'eu-west-1',
        optimized_for: 'vector',
      });
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.optimized_for).toBe('vector');
    });

    it('uses ELASTIC_CLOUD_API_BASE when set', async () => {
      process.env.ELASTIC_CLOUD_API_KEY = 'key';
      process.env.ELASTIC_CLOUD_API_BASE = 'https://custom.cloud.api';
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ id: 'p1', name: 'X', region_id: 'us-east-1' })),
      });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'create_cloud_project', { name: 'X', region_id: 'us-east-1' });
      expect(fetchMock.mock.calls[0][0]).toBe('https://custom.cloud.api/api/v1/serverless/projects/elasticsearch');
    });
  });

  describe('get_deployment_guide', () => {
    it('returns cloud steps for preference cloud', async () => {
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'get_deployment_guide', { preference: 'cloud' });
      expect(out.content[0].text).toContain('Elastic Cloud');
      expect(out.content[0].text).toContain('create_cloud_project');
      expect(out.content[0].text).not.toContain('docker compose');
    });

    it('returns on-prem Docker steps for preference on_prem', async () => {
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'get_deployment_guide', { preference: 'on_prem' });
      expect(out.content[0].text).toContain('On-prem');
      expect(out.content[0].text).toContain('docker compose');
      expect(out.content[0].text).toContain('examples/on-prem-docker');
    });
  });

  describe('get_connection_config', () => {
    it('returns node snippet with url and api_key', async () => {
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'get_connection_config', {
        url: 'https://my.es.io:9243',
        api_key: 'secret',
        language: 'node',
      });
      expect(out.content[0].text).toContain('https://my.es.io:9243');
      expect(out.content[0].text).toContain("apiKey: 'secret'");
    });
  });
});
