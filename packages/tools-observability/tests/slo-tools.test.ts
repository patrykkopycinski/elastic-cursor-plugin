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

describe('SLO tools', () => {
  const baseUrl = 'https://kibana.example.com';
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    process.env.KIBANA_URL = baseUrl;
    process.env.KIBANA_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.KIBANA_URL;
    delete process.env.KIBANA_API_KEY;
  });

  describe('create_slo', () => {
    const sloInput = {
      name: 'Test SLO',
      indicator: {
        type: 'sli.apm.transactionDuration',
        service: 'my-service',
        environment: 'production',
        transaction_type: 'request',
        threshold: 500,
        comparator: 'LT',
      },
      time_window: { duration: '30d', type: 'rolling' },
      objective: { target: 99.9 },
    };

    it('registers the tool', () => {
      const server = createCaptureServer();
      registerAll(server);
      expect(server.tools.has('create_slo')).toBe(true);
    });

    it('returns error when KIBANA_URL not set', async () => {
      delete process.env.KIBANA_URL;
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'create_slo', sloInput);
      expect(out.isError).toBe(true);
      expect(out.content[0].text).toContain('KIBANA_URL');
    });

    it('creates SLO via Kibana API', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'slo-1', name: 'Test SLO' }),
      });

      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'create_slo', sloInput);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe(`${baseUrl}/api/observability/slos`);
      expect(options.method).toBe('POST');
      expect(out.content[0].text).toContain('slo-1');
    });

    it('handles Kibana API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'bad request' }),
      });

      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'create_slo', sloInput);
      expect(out.isError).toBe(true);
    });
  });

  describe('list_slos', () => {
    it('lists SLOs', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'slo-1',
              name: 'My SLO',
              summary: { status: 'HEALTHY', sliValue: 0.995 },
              indicator: { type: 'sli.apm.transactionDuration' },
            },
          ],
          total: 1,
          page: 1,
        }),
      });

      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'list_slos', {});
      expect(out.content[0].text).toContain('My SLO');
    });

    it('passes name filter as kqlQuery', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [], total: 0 }),
      });

      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'list_slos', { name_filter: 'payment' });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('kqlQuery');
    });
  });

  describe('get_slo', () => {
    it('gets single SLO by ID', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'slo-1',
          name: 'My SLO',
          summary: { status: 'HEALTHY', sliValue: 0.999 },
          indicator: { type: 'sli.apm.transactionDuration' },
          objective: { target: 0.999 },
          timeWindow: { duration: '30d', type: 'rolling' },
        }),
      });

      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'get_slo', { id: 'slo-1' });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(`${baseUrl}/api/observability/slos/slo-1`);
    });

    it('handles not found', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not found' }),
      });

      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'get_slo', { id: 'missing' });
      expect(out.isError).toBe(true);
    });
  });

  describe('update_slo', () => {
    it('updates SLO via PUT', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'slo-1', name: 'Updated SLO' }),
      });

      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'update_slo', {
        id: 'slo-1',
        objective: { target: 99.5 },
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('PUT');
    });
  });

  describe('delete_slo', () => {
    it('deletes SLO via DELETE', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'delete_slo', { id: 'slo-1' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('DELETE');
      expect(out.content[0].text).toContain('deleted');
    });

    it('handles not found on delete', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not found' }),
      });

      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'delete_slo', { id: 'missing' });
      expect(out.isError).toBe(true);
    });
  });
});
