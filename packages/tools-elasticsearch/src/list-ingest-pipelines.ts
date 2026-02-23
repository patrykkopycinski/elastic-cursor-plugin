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

export function registerListIngestPipelines(server: ToolRegistrationContext, client: Client): void {
  server.registerTool(
    'list_ingest_pipelines',
    {
      title: 'List Ingest Pipelines',
      description: 'List all ingest pipelines with optional pipeline IDs filter.',
      inputSchema: z.object({
        pipeline_id: z.string().optional().describe('Pipeline ID or wildcard'),
      }),
    },
    async (args) => {
      const { pipeline_id } = args as { pipeline_id?: string };
      try {
        const resp = await client.ingest.getPipeline(
          pipeline_id ? { id: pipeline_id } : { id: '*' }
        );
        const entries = Object.entries(resp);
        if (entries.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No pipelines found.' }] };
        }
        const lines = entries.map(([id, meta]) => {
          const procs = (meta as { processors?: unknown[] })?.processors ?? [];
          return `${id}\t processors: ${procs.length}\t ${procs.map((p: { [k: string]: unknown }) => Object.keys(p)[0]).join(', ')}`;
        });
        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
