/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Unit tests for Elasticsearch tool handlers: assert client API params (cat.indices, search, indices.create, transport.request).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerAll } from '../src/index.js';
import { createCaptureServer, invokeTool } from './capture-server.js';
import type { Client } from '@elastic/elasticsearch';

function createMockClient(overrides: Partial<Record<string, unknown>> = {}): Client {
  return {
    cat: {
      indices: vi.fn().mockResolvedValue([
        { index: 'logs-1', docs: '100', store: '1kb', health: 'green' },
        { index: '.kibana', docs: '50', store: '500b', health: 'green' },
      ]),
    },
    search: vi.fn().mockResolvedValue({
      hits: {
        total: { value: 2 },
        hits: [
          { _source: { msg: 'hello' }, _score: 1.0 },
          { _source: { msg: 'world' }, _score: 0.9 },
        ],
      },
      aggregations: undefined,
    }),
    indices: {
      create: vi.fn().mockResolvedValue({ acknowledged: true }),
    },
    transport: {
      request: vi.fn().mockResolvedValue({
        columns: [{ name: 'col1' }, { name: 'col2' }],
        values: [['a', 'b'], ['c', 'd']],
      }),
    },
    ...overrides,
  } as unknown as Client;
}

describe('tools-elasticsearch API params', () => {
  describe('list_indices', () => {
    it('calls cat.indices with format json, index pattern, and expand_wildcards', async () => {
      const client = createMockClient();
      const server = createCaptureServer();
      registerAll(server, client);
      await invokeTool(server, 'list_indices', { index_pattern: 'logs-*', include_hidden: false });
      expect(client.cat.indices).toHaveBeenCalledWith({
        format: 'json',
        index: 'logs-*',
        expand_wildcards: 'open',
      });
    });

    it('uses expand_wildcards all when include_hidden is true', async () => {
      const client = createMockClient();
      const server = createCaptureServer();
      registerAll(server, client);
      await invokeTool(server, 'list_indices', { include_hidden: true });
      expect(client.cat.indices).toHaveBeenCalledWith(
        expect.objectContaining({ expand_wildcards: 'all' })
      );
    });

    it('filters out system indices (starting with .)', async () => {
      const client = createMockClient();
      const server = createCaptureServer();
      registerAll(server, client);
      const out = await invokeTool(server, 'list_indices', {});
      expect(out.content[0].text).toContain('logs-1');
      expect(out.content[0].text).not.toContain('.kibana');
    });
  });

  describe('search', () => {
    it('calls client.search with index and body (query, size, from, sort, aggs)', async () => {
      const client = createMockClient();
      const server = createCaptureServer();
      registerAll(server, client);
      await invokeTool(server, 'search', {
        index: 'my-index',
        query: { match_all: {} },
        size: 25,
        from: 10,
        sort: [{ '@timestamp': 'desc' }],
        aggs: { by_type: { terms: { field: 'type' } } },
      });
      expect(client.search).toHaveBeenCalledWith({
        index: 'my-index',
        body: {
          query: { match_all: {} },
          size: 25,
          from: 10,
          sort: [{ '@timestamp': 'desc' }],
          aggs: { by_type: { terms: { field: 'type' } } },
        },
      });
    });

    it('omits empty query and aggs from body', async () => {
      const client = createMockClient();
      const server = createCaptureServer();
      registerAll(server, client);
      await invokeTool(server, 'search', { index: 'idx', size: 5 });
      const call = (client.search as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.body).not.toHaveProperty('query');
      expect(call.body).not.toHaveProperty('aggs');
      expect(call.body.size).toBe(5);
    });
  });

  describe('create_index', () => {
    it('calls indices.create with index and optional mappings/settings', async () => {
      const client = createMockClient();
      const server = createCaptureServer();
      registerAll(server, client);
      await invokeTool(server, 'create_index', {
        index: 'test-index',
        mappings: {
          properties: {
            title: { type: 'text' },
            count: { type: 'integer' },
          },
        },
        settings: { number_of_shards: 1 },
      });
      expect(client.indices.create).toHaveBeenCalledWith({
        index: 'test-index',
        body: {
          mappings: {
            properties: {
              title: { type: 'text' },
              count: { type: 'integer' },
            },
          },
          settings: { number_of_shards: 1 },
        },
      });
    });

    it('calls indices.create with undefined body when no mappings or settings', async () => {
      const client = createMockClient();
      const server = createCaptureServer();
      registerAll(server, client);
      await invokeTool(server, 'create_index', { index: 'bare-index' });
      expect(client.indices.create).toHaveBeenCalledWith({
        index: 'bare-index',
        body: undefined,
      });
    });
  });

  describe('esql_query', () => {
    it('calls transport.request POST /_query with body.query', async () => {
      const client = createMockClient();
      const server = createCaptureServer();
      registerAll(server, client);
      await invokeTool(server, 'esql_query', {
        query: 'FROM my-index | WHERE status == "ok" | LIMIT 10',
      });
      expect(client.transport.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/_query',
        body: { query: 'FROM my-index | WHERE status == "ok" | LIMIT 10' },
      });
    });

    it('trims query string', async () => {
      const client = createMockClient();
      const server = createCaptureServer();
      registerAll(server, client);
      await invokeTool(server, 'esql_query', { query: '  FROM x | LIMIT 1  ' });
      expect(client.transport.request).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { query: 'FROM x | LIMIT 1' },
        })
      );
    });
  });
});
