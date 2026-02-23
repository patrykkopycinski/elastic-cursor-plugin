/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Tests for Security tools: Kibana Detection Engine API URLs and request body.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerAll } from '../src/index.js';
import { createCaptureServer, invokeTool } from './capture-server.js';

describe('tools-security API usage', () => {
  const baseUrl = 'https://kibana.example.com';
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    process.env.KIBANA_URL = baseUrl;
    process.env.KIBANA_API_KEY = 'sec-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.KIBANA_URL;
    delete process.env.KIBANA_API_KEY;
  });

  describe('create_detection_rule', () => {
    it('POSTs to /api/detection_engine/rules with correct body shape', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'rule-123', name: 'Test Rule' }),
      });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'create_detection_rule', {
        name: 'Test Rule',
        description: 'A test',
        query: 'host.name: *',
        severity: 'high',
        risk_score: 75,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://kibana.example.com/api/detection_engine/rules');
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body as string);
      expect(body).toMatchObject({
        name: 'Test Rule',
        description: 'A test',
        query: 'host.name: *',
        severity: 'high',
        risk_score: 75,
        type: 'query',
        language: 'kuery',
      });
    });

    it('defaults severity to medium and risk_score to 21', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'r1' }) });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'create_detection_rule', {
        name: 'Minimal',
        query: 'event.code: *',
      });
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.severity).toBe('medium');
      expect(body.risk_score).toBe(21);
    });
  });

  describe('list_detection_rules', () => {
    it('GETs /api/detection_engine/rules/_find and parses data.data', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { name: 'Rule A', rule_type: 'query', enabled: true },
            { name: 'Rule B', rule_type: 'threshold', enabled: false },
          ],
        }),
      });
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'list_detection_rules', {});
      expect(fetchMock.mock.calls[0][0]).toBe('https://kibana.example.com/api/detection_engine/rules/_find');
      expect(out.content[0].text).toContain('Rule A');
      expect(out.content[0].text).toContain('Rule B');
      expect(out.content[0].text).toContain('enabled: true');
    });
  });
});
