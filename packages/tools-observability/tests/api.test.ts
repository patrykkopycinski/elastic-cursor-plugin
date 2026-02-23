/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Tests for Observability tools: Kibana alerting API URL and response parsing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerAll } from '../src/index.js';
import { createCaptureServer, invokeTool } from './capture-server.js';

describe('tools-observability API usage', () => {
  const baseUrl = 'https://kibana.example.com';
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    process.env.KIBANA_URL = baseUrl;
    process.env.KIBANA_API_KEY = 'obs-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.KIBANA_URL;
    delete process.env.KIBANA_API_KEY;
  });

  describe('list_alert_rules', () => {
    it('GETs /api/alerting/rules/_find with Authorization header', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { name: 'Threshold 1', rule_type_id: 'example.threshold', enabled: true },
            { name: 'Anomaly 1', rule_type_id: 'apm.anomaly', enabled: false },
          ],
        }),
      });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'list_alert_rules', {});
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://kibana.example.com/api/alerting/rules/_find');
      expect(options.method).toBeUndefined(); // default GET
      expect(options.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'ApiKey obs-key',
      });
    });

    it('parses response data.data and formats rules', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { name: 'My Rule', rule_type_id: 'example.threshold', enabled: true },
          ],
        }),
      });
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'list_alert_rules', {});
      expect(out.content[0].text).toContain('My Rule');
      expect(out.content[0].text).toContain('example.threshold');
      expect(out.content[0].text).toContain('enabled: true');
    });

    it('returns message when KIBANA_URL is not set', async () => {
      delete process.env.KIBANA_URL;
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'list_alert_rules', {});
      expect(out.content[0].text).toContain('KIBANA_URL');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('create_alert_rule', () => {
    it('returns body with rule_type_id and params for Kibana API', async () => {
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'create_alert_rule', {
        name: 'High Error Rate',
        rule_type: 'threshold',
        index: 'metrics-*',
        condition: 'above 1000',
      });
      expect(out.content[0].text).toContain('api/alerting/rule');
      expect(out.content[0].text).toContain('example.threshold');
      expect(out.content[0].text).toContain('metrics-*');
      expect(out.content[0].text).toContain('above 1000');
    });

    it('uses apm.anomaly for rule_type anomaly', async () => {
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'create_alert_rule', {
        name: 'Anomaly',
        rule_type: 'anomaly',
      });
      expect(out.content[0].text).toContain('apm.anomaly');
    });
  });
});
