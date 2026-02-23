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

export function registerCreateIndex(server: ToolRegistrationContext, client: Client): void {
  server.registerTool(
    'create_index',
    {
      title: 'Create Index',
      description:
        'Create an Elasticsearch index with optional mappings (including dense_vector, sparse_vector) and settings.',
      inputSchema: z.object({
        index: z.string().describe('Index name'),
        mappings: z.record(z.unknown()).optional().describe('Mappings object'),
        settings: z.record(z.unknown()).optional().describe('Index settings'),
      }),
    },
    async (args) => {
      const { index, mappings, settings } = args as {
        index: string;
        mappings?: Record<string, unknown>;
        settings?: Record<string, unknown>;
      };
      try {
        const body: Record<string, unknown> = {};
        if (mappings && Object.keys(mappings).length) body.mappings = mappings;
        if (settings && Object.keys(settings).length) body.settings = settings;
        await client.indices.create({ index, body: Object.keys(body).length ? body : undefined });
        return {
          content: [{ type: 'text' as const, text: `Index "${index}" created successfully.` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
