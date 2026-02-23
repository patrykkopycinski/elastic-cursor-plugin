/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerCreateDashboard } from '../src/create-dashboard.js';
import { createCaptureServer, invokeTool } from './capture-server.js';

function mockResponse(ok: boolean, data: unknown, status = ok ? 200 : 400) {
  return { ok, status, json: async () => data };
}

function mockFeatureFlagUnavailable() {
  return [mockResponse(false, {}, 403)];
}

describe('kibana_create_dashboard', () => {
  const baseUrl = 'https://kibana.example.com';
  const apiKey = 'test-api-key';
  let fetchMock: ReturnType<typeof vi.fn>;

  const minimalInput = {
    title: 'Test Dashboard',
    panels: [
      { type: 'metric' as const, title: 'Count', dataset: { type: 'esql' as const, query: 'FROM logs | STATS count = COUNT()' }, metric: { operation: 'value', column: 'count' } },
    ],
  };

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

  it('registers the tool', () => {
    const server = createCaptureServer();
    registerCreateDashboard(server);
    expect(server.tools.has('kibana_create_dashboard')).toBe(true);
  });

  it('returns error when KIBANA_URL is not set', async () => {
    delete process.env.KIBANA_URL;
    const server = createCaptureServer();
    registerCreateDashboard(server);
    const result = await invokeTool(server, 'kibana_create_dashboard', minimalInput);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('KIBANA_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('feature flags', () => {
    it('attempts to enable lens.apiFormat and dashboardAgent.enabled', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(true, { ok: true }))
        .mockResolvedValueOnce(mockResponse(true, { id: 'dash-1', data: { title: 'Test', panels: [] } }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/internal/core/_settings');
      expect(opts.method).toBe('PUT');
      const body = JSON.parse(opts.body);
      expect(body['feature_flags.overrides']).toEqual({
        'dashboardAgent.enabled': true,
        'lens.apiFormat': true,
        'lens.enable_esql': true,
      });
      expect(opts.headers['Elastic-Api-Version']).toBe('1');
    });

    it('includes success note when flags are enabled', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(true, { ok: true }))
        .mockResolvedValueOnce(mockResponse(true, { id: 'dash-1', data: { title: 'Test', panels: [] } }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      const result = await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Feature flags enabled');
    });
  });

  describe('as-code API (primary)', () => {
    it('creates dashboard via as-code API with Elastic-Api-Version header', async () => {
      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'dash-abc', data: { title: 'Test', panels: [{}] } }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      const result = await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('dash-abc');
      expect(result.content[0].text).toContain('as-code API');
      expect(result.content[0].text).toContain('/app/dashboards#/view/dash-abc');

      const [apiUrl, apiOpts] = fetchMock.mock.calls[1];
      expect(apiUrl).toContain('/api/dashboards');
      expect(apiOpts.method).toBe('POST');
      expect(apiOpts.headers['Elastic-Api-Version']).toBe('1');
    });

    it('wraps body in { data: { ... } } envelope', async () => {
      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'd1', data: { panels: [] } }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body.data).toBeDefined();
      expect(body.data.title).toBe('Test Dashboard');
      expect(body.data.panels).toHaveLength(1);
      expect(body.data.time_range).toEqual({ from: 'now-24h', to: 'now' });
    });

    it('uses DASHBOARD_MARKDOWN type for markdown panels', async () => {
      const input = {
        title: 'MD Dashboard',
        panels: [{ type: 'DASHBOARD_MARKDOWN' as const, content: '# Hello World' }],
      };

      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'd2', data: { panels: [] } }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', input);

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body.data.panels[0].type).toBe('DASHBOARD_MARKDOWN');
      expect(body.data.panels[0].config.content).toBe('# Hello World');
      expect(body.data.panels[0].grid.w).toBe(48);
      expect(body.data.panels[0].grid.h).toBe(4);
    });

    it('builds inline Lens attributes for chart panels', async () => {
      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'd3', data: { panels: [] } }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      const panel = body.data.panels[0];
      expect(panel.type).toBe('lens');
      expect(panel.config.attributes).toBeDefined();
      expect(panel.config.attributes.type).toBe('metric');
      expect(panel.config.attributes.dataset).toEqual({ type: 'esql', query: 'FROM logs | STATS count = COUNT()' });
      expect(panel.config.attributes.metrics).toEqual([{ type: 'primary', operation: 'value', column: 'count' }]);
    });

    it('builds XY chart with layers', async () => {
      const input = {
        title: 'XY Dashboard',
        panels: [{
          type: 'xy' as const,
          title: 'Events Over Time',
          layers: [{
            type: 'line' as const,
            dataset: { type: 'esql' as const, query: 'FROM logs | STATS count = COUNT() BY bucket = DATE_TRUNC(1 hour, @timestamp)' },
            x: { operation: 'value', column: 'bucket' },
            y: [{ operation: 'value', column: 'count' }],
            breakdown_by: { operation: 'value', column: 'host' },
          }],
        }],
      };

      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'd4', data: { panels: [] } }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', input);

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      const attrs = body.data.panels[0].config.attributes;
      expect(attrs.type).toBe('xy');
      expect(attrs.layers).toHaveLength(1);
      expect(attrs.layers[0].type).toBe('line');
      expect(attrs.layers[0].dataset).toEqual({ type: 'esql', query: 'FROM logs | STATS count = COUNT() BY bucket = DATE_TRUNC(1 hour, @timestamp)' });
      expect(attrs.layers[0].x).toEqual({ operation: 'value', column: 'bucket' });
      expect(attrs.layers[0].y).toEqual([{ operation: 'value', column: 'count' }]);
      expect(attrs.layers[0].breakdown_by).toEqual({ operation: 'value', column: 'host' });
    });

    it('sends custom dashboard ID when provided', async () => {
      const input = { ...minimalInput, id: 'custom-id-123' };

      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'custom-id-123', data: { panels: [] } }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', input);

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body.id).toBe('custom-id-123');
    });

    it('uses 48-column grid with correct defaults', async () => {
      const input = {
        title: 'Grid Test',
        panels: [
          { type: 'DASHBOARD_MARKDOWN' as const, content: 'Header' },
          { type: 'metric' as const, title: 'M1', metric: { column: 'count' } },
          { type: 'metric' as const, title: 'M2', metric: { column: 'avg' }, grid: { x: 24, w: 24, h: 8 } },
        ],
      };

      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'd5', data: { panels: [] } }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', input);

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      const panels = body.data.panels;
      expect(panels[0].grid).toEqual({ x: 0, y: 0, w: 48, h: 4 });
      expect(panels[1].grid).toEqual({ x: 0, y: 4, w: 24, h: 10 });
      expect(panels[2].grid).toEqual({ x: 24, y: 14, w: 24, h: 8 });
    });

    it('includes tags when provided', async () => {
      const input = { ...minimalInput, tags: ['production', 'ops'] };

      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'd6', data: { panels: [] } }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', input);

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body.data.tags).toEqual(['production', 'ops']);
    });

    it('sends space in spaces array', async () => {
      const input = { ...minimalInput, space: 'my-space' };

      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'd7', data: { panels: [] } }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', input);

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body.spaces).toEqual(['my-space']);
    });
  });

  describe('saved objects fallback', () => {
    it('falls back when as-code API fails', async () => {
      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(false, { message: 'Not Found' }, 404));
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'lens-1' }));
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'dash-so-1' }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      const result = await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('dash-so-1');
      expect(result.content[0].text).toContain('Saved Objects fallback');
      expect(result.content[0].text).toContain('lens-1');

      const [lensUrl] = fetchMock.mock.calls[2];
      expect(lensUrl).toContain('/api/saved_objects/lens');
      const [dashUrl] = fetchMock.mock.calls[3];
      expect(dashUrl).toContain('/api/saved_objects/dashboard');
    });

    it('skips Lens SO creation for DASHBOARD_MARKDOWN panels', async () => {
      const input = {
        title: 'MD Only',
        panels: [{ type: 'DASHBOARD_MARKDOWN' as const, content: 'Hi' }],
      };

      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(false, {}, 404));
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'dash-md' }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      const result = await invokeTool(server, 'kibana_create_dashboard', input);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('dash-md');
      expect(fetchMock.mock.calls).toHaveLength(3);
    });
  });

  describe('all strategies fail', () => {
    it('returns comprehensive error', async () => {
      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(false, {}, 500));
      fetchMock.mockResolvedValueOnce(mockResponse(false, {}, 500));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      const result = await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('All strategies failed');
      expect(result.content[0].text).toContain('Troubleshooting');
      expect(result.content[0].text).toContain('lens.apiFormat');
    });
  });

  describe('auth', () => {
    it('sends Elastic-Api-Version header on as-code API calls', async () => {
      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'dash-1', data: { panels: [] } }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      const asCodeCall = fetchMock.mock.calls[1];
      expect(asCodeCall[1].headers['Elastic-Api-Version']).toBe('1');
      expect(asCodeCall[1].headers.Authorization).toBe('ApiKey test-api-key');
      expect(asCodeCall[1].headers['kbn-xsrf']).toBe('true');
    });
  });
});
