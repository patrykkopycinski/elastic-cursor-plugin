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

export function registerCreateIngestPipeline(server: ToolRegistrationContext, client: Client): void {
  server.registerTool(
    'create_ingest_pipeline',
    {
      title: 'Create Ingest Pipeline',
      description:
        'Create or update an ingest pipeline. Can include inference processors for embeddings.',
      inputSchema: z.object({
        id: z.string().describe('Pipeline ID'),
        description: z.string().optional(),
        processors: z.array(z.record(z.unknown())).describe('Array of processor configs'),
      }),
    },
    async (args) => {
      const { id, description, processors } = args as {
        id: string;
        description?: string;
        processors: Record<string, unknown>[];
      };
      try {
        const body: { description?: string; processors: Record<string, unknown>[] } = {
          processors,
        };
        if (description) body.description = description;
        await client.ingest.putPipeline({ id, body });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Ingest pipeline "${id}" created/updated successfully with ${processors.length} processor(s).`,
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
