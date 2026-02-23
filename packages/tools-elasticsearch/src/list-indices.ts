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

export function registerListIndices(server: ToolRegistrationContext, client: Client): void {
  server.registerTool(
    'list_indices',
    {
      title: 'List Indices',
      description:
        'List non-system Elasticsearch indices with doc count, size, and health. Optionally filter by index pattern.',
      inputSchema: z.object({
        index_pattern: z.string().optional().describe('Index pattern (e.g. logs-*)'),
        include_hidden: z.boolean().optional().default(false).describe('Include hidden indices'),
      }),
    },
    async (args) => {
      const { index_pattern, include_hidden } = args as { index_pattern?: string; include_hidden?: boolean };
      try {
        const cat = await client.cat.indices({
          format: 'json',
          index: index_pattern,
          expand_wildcards: include_hidden ? 'all' : 'open',
        });
        const indices = Array.isArray(cat) ? cat : [];
        const nonSystem = indices.filter((i: { index?: string }) => !(i.index && i.index.startsWith('.')));
        if (nonSystem.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No indices found.' }] };
        }
        const lines = nonSystem.map(
          (i: { index?: string; docs?: string; store?: string; health?: string }) =>
            `${i.index}\t docs: ${i.docs ?? '?'}\t store: ${i.store ?? '?'}\t health: ${i.health ?? '?'}`
        );
        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
