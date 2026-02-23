/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerGetDashboard } from '../src/get-dashboard.js';
import { registerUpdateDashboard } from '../src/update-dashboard.js';
import { registerDeleteDashboard } from '../src/delete-dashboard.js';
import { createCaptureServer, invokeTool } from './capture-server.js';

function mockResponse(ok: boolean, data: unknown, status = ok ? 200 : 400) {
  return { ok, status, json: async () => data };
}

describe('dashboard CRUD tools', () => {
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
  });

  describe('kibana_get_dashboard', () => {
    it('registers the tool', () => {
      const server = createCaptureServer();
      registerGetDashboard(server);
      expect(server.tools.has('kibana_get_dashboard')).toBe(true);
    });

    it('returns error when KIBANA_URL is not set', async () => {
      delete process.env.KIBANA_URL;
      const server = createCaptureServer();
      registerGetDashboard(server);
      const result = await invokeTool(server, 'kibana_get_dashboard', { id: 'test' });
      expect(result.isError).toBe(true);
    });

    it('fetches dashboard with Elastic-Api-Version header', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse(true, {
          id: 'dash-1',
          data: { title: 'My Dashboard', panels: [], time_range: { from: 'now-24h', to: 'now' } },
          meta: { created_at: '2025-01-01' },
          spaces: ['default'],
        })
      );

      const server = createCaptureServer();
      registerGetDashboard(server);
      const result = await invokeTool(server, 'kibana_get_dashboard', { id: 'dash-1' });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('My Dashboard');
      expect(result.content[0].text).toContain('/app/dashboards#/view/dash-1');

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/dashboards/dash-1');
      expect(opts.headers['Elastic-Api-Version']).toBe('1');
    });

    it('returns JSON definition in output', async () => {
      const dashData = {
        id: 'dash-2',
        data: { title: 'Test', panels: [{ type: 'lens', uid: 'p1' }] },
        spaces: ['default'],
      };
      fetchMock.mockResolvedValueOnce(mockResponse(true, dashData));

      const server = createCaptureServer();
      registerGetDashboard(server);
      const result = await invokeTool(server, 'kibana_get_dashboard', { id: 'dash-2' });

      const text = result.content[0].text;
      expect(text).toContain('"panels"');
      expect(text).toContain('"lens"');
    });

    it('returns error for non-existent dashboard', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(false, { message: 'Not Found' }, 404));

      const server = createCaptureServer();
      registerGetDashboard(server);
      const result = await invokeTool(server, 'kibana_get_dashboard', { id: 'nope' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('nope');
    });
  });

  describe('kibana_update_dashboard', () => {
    it('registers the tool', () => {
      const server = createCaptureServer();
      registerUpdateDashboard(server);
      expect(server.tools.has('kibana_update_dashboard')).toBe(true);
    });

    it('returns error when KIBANA_URL is not set', async () => {
      delete process.env.KIBANA_URL;
      const server = createCaptureServer();
      registerUpdateDashboard(server);
      const result = await invokeTool(server, 'kibana_update_dashboard', { id: 'test' });
      expect(result.isError).toBe(true);
    });

    it('fetches existing dashboard then PUTs merged data', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(true, {
          id: 'dash-1',
          data: { title: 'Old Title', panels: [{ uid: 'p1' }], time_range: { from: 'now-24h', to: 'now' } },
        }))
        .mockResolvedValueOnce(mockResponse(true, { id: 'dash-1', data: { title: 'New Title' } }));

      const server = createCaptureServer();
      registerUpdateDashboard(server);
      const result = await invokeTool(server, 'kibana_update_dashboard', {
        id: 'dash-1',
        title: 'New Title',
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('updated successfully');
      expect(result.content[0].text).toContain('New Title');

      const [getUrl, getOpts] = fetchMock.mock.calls[0];
      expect(getUrl).toContain('/api/dashboards/dash-1');
      expect(getOpts.headers['Elastic-Api-Version']).toBe('1');

      const [putUrl, putOpts] = fetchMock.mock.calls[1];
      expect(putUrl).toContain('/api/dashboards/dash-1');
      expect(putOpts.method).toBe('PUT');
      const body = JSON.parse(putOpts.body);
      expect(body.data.title).toBe('New Title');
      expect(body.data.panels).toEqual([{ uid: 'p1' }]);
    });

    it('merges time_range when only one part changes', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(true, {
          id: 'dash-1',
          data: { title: 'Dash', time_range: { from: 'now-7d', to: 'now' } },
        }))
        .mockResolvedValueOnce(mockResponse(true, { id: 'dash-1', data: { title: 'Dash' } }));

      const server = createCaptureServer();
      registerUpdateDashboard(server);
      await invokeTool(server, 'kibana_update_dashboard', { id: 'dash-1', time_from: 'now-30d' });

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body.data.time_range).toEqual({ from: 'now-30d', to: 'now' });
    });

    it('returns error when dashboard does not exist', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(false, { message: 'Not Found' }, 404));

      const server = createCaptureServer();
      registerUpdateDashboard(server);
      const result = await invokeTool(server, 'kibana_update_dashboard', { id: 'nope' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('kibana_delete_dashboard', () => {
    it('registers the tool', () => {
      const server = createCaptureServer();
      registerDeleteDashboard(server);
      expect(server.tools.has('kibana_delete_dashboard')).toBe(true);
    });

    it('returns error when KIBANA_URL is not set', async () => {
      delete process.env.KIBANA_URL;
      const server = createCaptureServer();
      registerDeleteDashboard(server);
      const result = await invokeTool(server, 'kibana_delete_dashboard', { id: 'test' });
      expect(result.isError).toBe(true);
    });

    it('sends DELETE with Elastic-Api-Version header', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(true, {}));

      const server = createCaptureServer();
      registerDeleteDashboard(server);
      const result = await invokeTool(server, 'kibana_delete_dashboard', { id: 'dash-1' });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('deleted successfully');

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/dashboards/dash-1');
      expect(opts.method).toBe('DELETE');
      expect(opts.headers['Elastic-Api-Version']).toBe('1');
    });

    it('URL-encodes dashboard ID', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(true, {}));

      const server = createCaptureServer();
      registerDeleteDashboard(server);
      await invokeTool(server, 'kibana_delete_dashboard', { id: 'id with spaces' });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('id%20with%20spaces');
    });

    it('returns error when delete fails', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(false, { message: 'Forbidden' }, 403));

      const server = createCaptureServer();
      registerDeleteDashboard(server);
      const result = await invokeTool(server, 'kibana_delete_dashboard', { id: 'dash-1' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Failed to delete');
    });
  });
});
