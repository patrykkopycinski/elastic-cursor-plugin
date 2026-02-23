/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Deep tests for Kibana tools: API URLs, query params, headers, and response parsing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerAll } from '../src/index.js';
import { createCaptureServer, invokeTool } from './capture-server.js';

describe('tools-kibana API usage', () => {
  const baseUrl = 'https://kibana.example.com';
  const apiKey = 'test-api-key';
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    process.env.KIBANA_URL = baseUrl;
    process.env.KIBANA_API_KEY = apiKey;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.KIBANA_URL;
    delete process.env.KIBANA_API_KEY;
    delete process.env.ES_API_KEY;
  });

  describe('kibana_list_data_views', () => {
    it('calls GET /api/data_views with correct base URL and auth headers', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data_view: [{ id: 'dv1', title: 'logs-*' }] }),
      });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'kibana_list_data_views', {});
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://kibana.example.com/api/data_views');
      expect(options.method).toBe('GET');
      expect(options.headers).toMatchObject({
        'Content-Type': 'application/json',
        'kbn-xsrf': 'true',
        Authorization: 'ApiKey test-api-key',
      });
    });

    it('uses ES_API_KEY when KIBANA_API_KEY is not set', async () => {
      delete process.env.KIBANA_API_KEY;
      process.env.ES_API_KEY = 'es-key';
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data_view: [] }) });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'kibana_list_data_views', {});
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('ApiKey es-key');
    });

    it('returns friendly error when KIBANA_URL is not set', async () => {
      delete process.env.KIBANA_URL;
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'kibana_list_data_views', {});
      expect(out.isError).toBe(true);
      expect(out.content[0].text).toContain('KIBANA_URL');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('parses response with data_view array', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data_view: [
            { id: 'id1', title: 'Logs', name: 'Logs' },
            { id: 'id2', title: 'Metrics' },
          ],
        }),
      });
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'kibana_list_data_views', {});
      expect(out.isError).toBeFalsy();
      expect(out.content[0].text).toContain('Logs');
      expect(out.content[0].text).toContain('id: id1');
      expect(out.content[0].text).toContain('Metrics');
      expect(out.content[0].text).toContain('id: id2');
    });

    it('parses response when root is array (alternative API shape)', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'a', title: 'View A' },
        ],
      });
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'kibana_list_data_views', {});
      expect(out.content[0].text).toContain('View A');
      expect(out.content[0].text).toContain('id: a');
    });

    it('returns message when no data views', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data_view: [] }) });
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'kibana_list_data_views', {});
      expect(out.content[0].text).toContain('No data views');
    });

    it('strips trailing slash from KIBANA_URL', async () => {
      process.env.KIBANA_URL = 'https://kibana.example.com/';
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data_view: [] }) });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'kibana_list_data_views', {});
      expect(fetchMock.mock.calls[0][0]).toBe('https://kibana.example.com/api/data_views');
    });
  });

  describe('kibana_list_dashboards', () => {
    it('calls GET /api/saved_objects/_find with type=dashboard and per_page', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          saved_objects: [
            { id: 'd1', attributes: { title: 'My Dashboard' } },
          ],
        }),
      });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'kibana_list_dashboards', { per_page: 50 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/saved_objects/_find');
      expect(url).toContain('type=dashboard');
      expect(url).toContain('per_page=50');
      expect(url).toContain('fields=title');
    });

    it('defaults per_page to 20', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ saved_objects: [] }) });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'kibana_list_dashboards', {});
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('per_page=20');
    });

    it('parses saved_objects and uses attributes.title', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          saved_objects: [
            { id: 'abc', attributes: { title: 'APM Overview' } },
          ],
        }),
      });
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'kibana_list_dashboards', {});
      expect(out.content[0].text).toContain('APM Overview');
      expect(out.content[0].text).toContain('id: abc');
    });
  });

  describe('kibana_list_saved_objects', () => {
    it('calls _find with type and per_page, encoding type in URL', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ saved_objects: [] }),
      });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'kibana_list_saved_objects', { type: 'lens', per_page: 10 });
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/saved_objects/_find');
      expect(url).toContain('type=lens');
      expect(url).toContain('per_page=10');
      expect(url).toContain('fields=title');
    });

    it('defaults per_page to 20', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ saved_objects: [] }) });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'kibana_list_saved_objects', { type: 'visualization' });
      expect(fetchMock.mock.calls[0][0]).toContain('per_page=20');
    });

    it('parses saved_objects and includes type in output', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          saved_objects: [
            { id: 'v1', type: 'visualization', attributes: { title: 'My Chart' } },
          ],
        }),
      });
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'kibana_list_saved_objects', { type: 'visualization' });
      expect(out.content[0].text).toContain('My Chart');
      expect(out.content[0].text).toContain('id: v1');
      expect(out.content[0].text).toContain('type: visualization');
    });
  });

  describe('kibana_info', () => {
    it('does not call fetch and returns quick reference with base URL', async () => {
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'kibana_info', {});
      expect(fetchMock).not.toHaveBeenCalled();
      expect(out.content[0].text).toContain('https://kibana.example.com');
      expect(out.content[0].text).toContain('/app/discover');
      expect(out.content[0].text).toContain('/app/dashboards');
      expect(out.content[0].text).toContain('/app/dev_tools');
      expect(out.content[0].text).toContain('/app/maps');
      expect(out.content[0].text).toContain('/app/canvas');
    });

    it('when KIBANA_URL unset still returns reference text', async () => {
      delete process.env.KIBANA_URL;
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'kibana_info', {});
      expect(out.content[0].text).toContain('Set KIBANA_URL');
      expect(out.content[0].text).toContain('Discover');
    });
  });

  describe('error handling', () => {
    it('returns isError and message when Kibana returns HTTP 401', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'kibana_list_data_views', {});
      expect(out.isError).toBe(true);
      expect(out.content[0].text).toContain('401');
    });

    it('returns isError when fetch throws', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'kibana_list_dashboards', {});
      expect(out.isError).toBe(true);
      expect(out.content[0].text).toContain('Network error');
    });
  });

  describe('registerAll', () => {
    it('registers exactly 4 tools', () => {
      const server = createCaptureServer();
      registerAll(server);
      expect(server.tools.size).toBe(4);
      expect(server.tools.has('kibana_list_data_views')).toBe(true);
      expect(server.tools.has('kibana_list_dashboards')).toBe(true);
      expect(server.tools.has('kibana_list_saved_objects')).toBe(true);
      expect(server.tools.has('kibana_info')).toBe(true);
    });
  });
});
