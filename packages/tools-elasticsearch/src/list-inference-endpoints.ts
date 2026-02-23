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

export function registerListInferenceEndpoints(server: ToolRegistrationContext, client: Client): void {
  server.registerTool(
    'list_inference_endpoints',
    {
      title: 'List Inference Endpoints',
      description: 'List inference endpoints with model, task type, and status.',
      inputSchema: z.object({
        endpoint_id: z.string().optional().describe('Optional endpoint ID or wildcard'),
      }),
    },
    async (args) => {
      const { endpoint_id } = args as { endpoint_id?: string };
      try {
        const path = endpoint_id
          ? `/_inference/${encodeURIComponent(endpoint_id)}`
          : '/_inference';
        const resp = await client.transport.request({
          method: 'GET',
          path,
        }) as { endpoints?: Array<{ endpoint_id?: string; model_id?: string; task_type?: string; status?: string }> };
        const list = resp.endpoints ?? (endpoint_id ? [resp] : []);
        if (list.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No inference endpoints found.' }] };
        }
        const lines = list.map(
          (e) =>
            `${e.endpoint_id ?? 'n/a'}\t model: ${e.model_id ?? 'n/a'}\t task: ${e.task_type ?? 'n/a'}\t status: ${e.status ?? 'n/a'}`
        );
        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
