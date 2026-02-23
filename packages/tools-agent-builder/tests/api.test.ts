/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Tests for Agent Builder tools: MCP endpoint URL and request body.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerAll } from '../src/index.js';
import { createCaptureServer, invokeTool } from './capture-server.js';

describe('tools-agent-builder API usage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AGENT_BUILDER_ENDPOINT;
  });

  describe('list_agent_builder_tools', () => {
    it('returns message when no endpoint and no env', async () => {
      const server = createCaptureServer();
      registerAll(server);
      const out = await invokeTool(server, 'list_agent_builder_tools', {});
      expect(out.content[0].text).toContain('AGENT_BUILDER_ENDPOINT');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('POSTs to endpoint/mcp/tools/list with JSON-RPC body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { tools: [{ name: 'tool_a' }, { name: 'tool_b' }] },
        }),
      });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'list_agent_builder_tools', {
        endpoint: 'https://agent-builder.example.com',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://agent-builder.example.com/mcp/tools/list');
      expect(options.method).toBe('POST');
      expect(options.headers).toMatchObject({ 'Content-Type': 'application/json' });
      const body = JSON.parse(options.body as string);
      expect(body).toMatchObject({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    });

    it('strips trailing slash from endpoint', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { tools: [] } }),
      });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'list_agent_builder_tools', {
        endpoint: 'https://ab.example.com/',
      });
      expect(fetchMock.mock.calls[0][0]).toBe('https://ab.example.com/mcp/tools/list');
    });

    it('uses AGENT_BUILDER_ENDPOINT when endpoint arg not passed', async () => {
      process.env.AGENT_BUILDER_ENDPOINT = 'https://env-endpoint.example.com';
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { tools: [] } }),
      });
      const server = createCaptureServer();
      registerAll(server);
      await invokeTool(server, 'list_agent_builder_tools', {});
      expect(fetchMock.mock.calls[0][0]).toBe('https://env-endpoint.example.com/mcp/tools/list');
    });
  });
});
