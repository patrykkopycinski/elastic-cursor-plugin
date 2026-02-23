/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Client } from '@elastic/elasticsearch';
import { z } from 'zod';
import type { ToolRegistrationContext } from './types.js';

export function registerSearch(server: ToolRegistrationContext, client: Client): void {
  server.registerTool(
    'search',
    {
      title: 'Search',
      description:
        'Run a search using Query DSL (match, term, bool, kNN, hybrid). Returns hits and aggregations.',
      inputSchema: z.object({
        index: z.string().describe('Index or comma-separated indices'),
        query: z.record(z.unknown()).optional().describe('Query DSL object'),
        size: z.number().optional().default(10),
        from: z.number().optional().default(0),
        sort: z.union([z.record(z.unknown()), z.array(z.unknown())]).optional(),
        aggs: z.record(z.unknown()).optional().describe('Aggregations'),
      }),
    },
    async (args) => {
      const { index, query, size, from, sort, aggs } = args as {
        index: string;
        query?: Record<string, unknown>;
        size?: number;
        from?: number;
        sort?: Record<string, unknown> | unknown[];
        aggs?: Record<string, unknown>;
      };
      try {
        const body: Record<string, unknown> = {};
        if (query && Object.keys(query).length) body.query = query;
        if (size != null) body.size = size;
        if (from != null) body.from = from;
        if (sort != null) body.sort = sort;
        if (aggs && Object.keys(aggs).length) body.aggs = aggs;
        const resp = await client.search({ index, body });
        const hits = (resp.hits?.hits ?? []) as Array<{ _source?: unknown; _score?: number }>;
        const total = typeof resp.hits?.total === 'object' ? (resp.hits.total as { value?: number })?.value : resp.hits?.total;
        const out: string[] = [`Total: ${total ?? 0}, showing ${hits.length} hits.`];
        hits.forEach((h, i) => {
          out.push(`--- Hit ${i + 1} (score: ${h._score ?? 'n/a'}) ---`);
          out.push(JSON.stringify(h._source ?? {}, null, 2));
        });
        if (resp.aggregations && Object.keys(resp.aggregations).length) {
          out.push('--- Aggregations ---');
          out.push(JSON.stringify(resp.aggregations, null, 2));
        }
        return { content: [{ type: 'text' as const, text: out.join('\n') }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
