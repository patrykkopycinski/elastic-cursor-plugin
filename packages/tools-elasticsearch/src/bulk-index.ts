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

export function registerBulkIndex(server: ToolRegistrationContext, client: Client): void {
  server.registerTool(
    'bulk_index',
    {
      title: 'Bulk Index',
      description:
        'Bulk index documents. Provide an array of objects with index (required), id (optional), and document (required).',
      inputSchema: z.object({
        operations: z
          .array(
            z.object({
              index: z.string(),
              id: z.string().optional(),
              document: z.record(z.unknown()),
            })
          )
          .describe('List of { index, id?, document }'),
      }),
    },
    async (args) => {
      const { operations } = args as {
        operations: Array<{ index: string; id?: string; document: Record<string, unknown> }>;
      };
      if (!operations?.length) {
        return { content: [{ type: 'text' as const, text: 'No operations provided.' }], isError: true };
      }
      try {
        const body = operations.flatMap((op) => {
          const action: { _index: string; _id?: string } = { _index: op.index };
          if (op.id) action._id = op.id;
          return [{ index: action }, op.document];
        });
        const resp = await client.bulk({ refresh: false, operations: body });
        const failed = resp.items?.filter((i: { index?: { error?: unknown } }) => i.index?.error) ?? [];
        const total = resp.items?.length ?? 0;
        const success = total - failed.length;
        const summary = `Bulk index complete. Success: ${success}, Failed: ${failed.length}${failed.length ? '. Errors: ' + JSON.stringify(failed.map((i: { index?: { error?: unknown } }) => i.index?.error)) : ''}.`;
        return { content: [{ type: 'text' as const, text: summary }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
