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

export function registerIndexDocument(server: ToolRegistrationContext, client: Client): void {
  server.registerTool(
    'index_document',
    {
      title: 'Index Document',
      description: 'Index a single document. ID can be auto-generated or provided.',
      inputSchema: z.object({
        index: z.string().describe('Index name'),
        id: z.string().optional().describe('Document ID (omit for auto-generated)'),
        document: z.record(z.unknown()).describe('Document body (JSON object)'),
      }),
    },
    async (args) => {
      const { index, id, document } = args as {
        index: string;
        id?: string;
        document: Record<string, unknown>;
      };
      try {
        const opts: { index: string; id?: string; document: Record<string, unknown> } = {
          index,
          document,
        };
        if (id) opts.id = id;
        const resp = await client.index(opts);
        const resultId = resp._id ?? id ?? 'auto';
        return {
          content: [
            {
              type: 'text' as const,
              text: `Document indexed. Index: ${index}, ID: ${resultId}, result: ${resp.result ?? 'created'}.`,
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
