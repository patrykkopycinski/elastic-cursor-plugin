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

/**
 * Call sequence when the feature flag PUT fails:
 *   [0] PUT /internal/core/_settings  -> fail
 *   [1] GET /api/status               -> fail (makes tryEnableDashboardAgent return 'unavailable')
 *   [2] ... Tier 2 or 3 calls
 */
function mockFeatureFlagUnavailable() {
  return [
    mockResponse(false, {}, 403),
    mockResponse(false, {}, 503),
  ];
}

describe('kibana_create_dashboard', () => {
  const baseUrl = 'https://kibana.example.com';
  const apiKey = 'test-api-key';
  let fetchMock: ReturnType<typeof vi.fn>;

  const minimalInput = {
    title: 'Test Dashboard',
    panels: [
      { title: 'Panel 1', visualization_type: 'lnsXY' as const, esql_query: 'FROM logs-*' },
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

  describe('Tier 1: Dashboard Agent feature flag', () => {
    it('attempts to enable the feature flag first', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(true, { ok: true }))
        .mockResolvedValueOnce(mockResponse(true, { id: 'dash-1' }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/internal/core/_settings');
      expect(opts.method).toBe('PUT');
      const body = JSON.parse(opts.body);
      expect(body).toEqual({
        'feature_flags.overrides': { 'dashboardAgent.enabled': true },
      });
    });

    it('includes success note when flag is enabled', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(true, { ok: true }))
        .mockResolvedValueOnce(mockResponse(true, { id: 'dash-1' }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      const result = await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Dashboard Agent feature flag enabled');
    });
  });

  describe('Tier 2: Dashboard CRUD API', () => {
    it('creates dashboard via Dashboard API when available', async () => {
      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'dash-abc' }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      const result = await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('dash-abc');
      expect(result.content[0].text).toContain('Dashboard CRUD API (Tier 2)');
      expect(result.content[0].text).toContain('/app/dashboards#/view/dash-abc');

      const [apiUrl, apiOpts] = fetchMock.mock.calls[2];
      expect(apiUrl).toContain('/api/dashboards?apiVersion=1');
      expect(apiOpts.method).toBe('POST');
      const body = JSON.parse(apiOpts.body);
      expect(body.title).toBe('Test Dashboard');
      expect(body.panels).toHaveLength(1);
      expect(body.panels[0].type).toBe('lens');
      expect(body.time_range).toEqual({ from: 'now-15m', to: 'now' });
    });

    it('sends correct panel layout with grid positions', async () => {
      const input = {
        title: 'Multi-Panel',
        panels: [
          { title: 'P1', visualization_type: 'lnsXY' as const, height: 10 },
          { title: 'P2', visualization_type: 'lnsPie' as const, height: 20 },
        ],
      };

      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'd1' }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', input);

      const body = JSON.parse(fetchMock.mock.calls[2][1].body);
      expect(body.panels[0].grid).toEqual({ x: 0, y: 0, w: 24, h: 10 });
      expect(body.panels[1].grid).toEqual({ x: 0, y: 10, w: 24, h: 20 });
    });

    it('handles markdown panels correctly', async () => {
      const input = {
        title: 'Markdown Dashboard',
        panels: [
          {
            title: 'Notes',
            visualization_type: 'markdown' as const,
            markdown_content: '# Hello World',
          },
        ],
      };

      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'd2' }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', input);

      const body = JSON.parse(fetchMock.mock.calls[2][1].body);
      expect(body.panels[0].type).toBe('visualization');
      expect(body.panels[0].config.savedVis.type).toBe('markdown');
      expect(body.panels[0].config.savedVis.params.markdown).toBe('# Hello World');
    });

    it('includes tags when provided', async () => {
      const input = { ...minimalInput, tags: ['production', 'metrics'] };

      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'd3' }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', input);

      const body = JSON.parse(fetchMock.mock.calls[2][1].body);
      expect(body.tags).toEqual(['production', 'metrics']);
    });

    it('uses custom time range', async () => {
      const input = { ...minimalInput, time_from: 'now-7d', time_to: 'now' };

      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'd4' }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', input);

      const body = JSON.parse(fetchMock.mock.calls[2][1].body);
      expect(body.time_range).toEqual({ from: 'now-7d', to: 'now' });
    });
  });

  describe('Tier 3: Saved Objects fallback', () => {
    it('falls back to Saved Objects when Dashboard API fails', async () => {
      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      // [2] Dashboard API fails
      fetchMock.mockResolvedValueOnce(mockResponse(false, { message: 'Not Found' }, 404));
      // [3] Lens SO created
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'lens-1' }));
      // [4] Dashboard SO created
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'dash-so-1' }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      const result = await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('dash-so-1');
      expect(result.content[0].text).toContain('Saved Objects fallback (Tier 3)');
      expect(result.content[0].text).toContain('lens-1');

      const [lensUrl, lensOpts] = fetchMock.mock.calls[3];
      expect(lensUrl).toContain('/api/saved_objects/lens');
      expect(lensOpts.method).toBe('POST');
      const lensBody = JSON.parse(lensOpts.body);
      expect(lensBody.attributes.title).toBe('Panel 1');
      expect(lensBody.attributes.visualizationType).toBe('lnsXY');

      const [dashUrl] = fetchMock.mock.calls[4];
      expect(dashUrl).toContain('/api/saved_objects/dashboard');
      const dashBody = JSON.parse(fetchMock.mock.calls[4][1].body);
      expect(dashBody.attributes.title).toBe('Test Dashboard');
      expect(dashBody.attributes.timeRestore).toBe(true);

      const panelsJSON = JSON.parse(dashBody.attributes.panelsJSON);
      expect(panelsJSON).toHaveLength(1);
      expect(panelsJSON[0].type).toBe('lens');
      expect(dashBody.references).toHaveLength(1);
      expect(dashBody.references[0].id).toBe('lens-1');
    });

    it('creates markdown panels inline without Lens SO', async () => {
      const input = {
        title: 'MD Only',
        panels: [
          { title: 'Text', visualization_type: 'markdown' as const, markdown_content: 'Hi' },
        ],
      };

      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      // [2] Dashboard API fails
      fetchMock.mockResolvedValueOnce(mockResponse(false, {}, 404));
      // [3] Dashboard SO created (no Lens SO needed for markdown)
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'dash-md' }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      const result = await invokeTool(server, 'kibana_create_dashboard', input);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('dash-md');

      const dashBody = JSON.parse(fetchMock.mock.calls[3][1].body);
      const panelsJSON = JSON.parse(dashBody.attributes.panelsJSON);
      expect(panelsJSON[0].type).toBe('visualization');
      expect(panelsJSON[0].embeddableConfig.savedVis.params.markdown).toBe('Hi');
      expect(dashBody.references).toHaveLength(0);
    });

    it('returns error when Lens SO creation fails', async () => {
      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      // [2] Dashboard API fails
      fetchMock.mockResolvedValueOnce(mockResponse(false, {}, 404));
      // [3] Lens SO creation fails
      fetchMock.mockResolvedValueOnce(mockResponse(false, { message: 'Forbidden' }, 403));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      const result = await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('All strategies failed');
    });
  });

  describe('all strategies fail', () => {
    it('returns comprehensive error with troubleshooting tips', async () => {
      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      // [2] Dashboard API fails
      fetchMock.mockResolvedValueOnce(mockResponse(false, { message: 'API error' }, 500));
      // [3] Lens SO fails
      fetchMock.mockResolvedValueOnce(mockResponse(false, { message: 'SO error' }, 500));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      const result = await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('All strategies failed');
      expect(result.content[0].text).toContain('Troubleshooting');
      expect(result.content[0].text).toContain('KIBANA_URL');
    });
  });

  describe('auth headers', () => {
    it('sends ApiKey authorization header on all requests', async () => {
      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'dash-1' }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      for (const call of fetchMock.mock.calls) {
        expect(call[1].headers.Authorization).toBe('ApiKey test-api-key');
        expect(call[1].headers['kbn-xsrf']).toBe('true');
      }
    });

    it('uses ES_API_KEY when KIBANA_API_KEY is not set', async () => {
      delete process.env.KIBANA_API_KEY;
      process.env.ES_API_KEY = 'es-fallback-key';

      for (const m of mockFeatureFlagUnavailable()) fetchMock.mockResolvedValueOnce(m);
      fetchMock.mockResolvedValueOnce(mockResponse(true, { id: 'dash-1' }));

      const server = createCaptureServer();
      registerCreateDashboard(server);
      await invokeTool(server, 'kibana_create_dashboard', minimalInput);

      for (const call of fetchMock.mock.calls) {
        expect(call[1].headers.Authorization).toBe('ApiKey es-fallback-key');
      }
    });
  });
});
