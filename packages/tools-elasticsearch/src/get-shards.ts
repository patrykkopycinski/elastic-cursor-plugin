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

export function registerGetShards(server: ToolRegistrationContext, client: Client): void {
  server.registerTool(
    'get_shards',
    {
      title: 'Get Shards',
      description: 'Get shard allocation and status per index. Optionally filter by index.',
      inputSchema: z.object({
        index: z.string().optional().describe('Index pattern (optional)'),
      }),
    },
    async (args) => {
      const { index } = args as { index?: string };
      try {
        const resp = await client.cat.shards({
          format: 'json',
          index: index ?? undefined,
        });
        const shards = Array.isArray(resp) ? resp : [];
        if (shards.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No shards found.' }] };
        }
        const lines = shards.map(
          (s: { index?: string; shard?: string; prirep?: string; state?: string; node?: string }) =>
            `${s.index}\t shard ${s.shard}\t ${s.prirep}\t ${s.state}\t ${s.node ?? 'unassigned'}`
        );
        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
