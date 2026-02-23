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

export function registerDeleteIndex(server: ToolRegistrationContext, client: Client): void {
  server.registerTool(
    'delete_index',
    {
      title: 'Delete Index',
      description: 'Delete an Elasticsearch index. Use with caution.',
      inputSchema: z.object({
        index: z.string().describe('Index name to delete'),
      }),
    },
    async (args) => {
      const { index } = args as { index: string };
      try {
        const countResp = await client.count({ index }).catch(() => ({ count: 0 }));
        const docCount = countResp.count ?? 0;
        await client.indices.delete({ index });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Index "${index}" deleted successfully (had ${docCount} documents).`,
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
