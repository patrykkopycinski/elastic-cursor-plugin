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

export function registerCreateInferenceEndpoint(server: ToolRegistrationContext, client: Client): void {
  server.registerTool(
    'create_inference_endpoint',
    {
      title: 'Create Inference Endpoint',
      description:
        'Create or update an inference endpoint (e.g. Gina, ELSER, or third-party model).',
      inputSchema: z.object({
        endpoint_id: z.string().describe('Endpoint ID'),
        body: z.record(z.unknown()).describe('Endpoint config (model_id, task_type, etc.)'),
      }),
    },
    async (args) => {
      const { endpoint_id, body } = args as { endpoint_id: string; body: Record<string, unknown> };
      try {
        await client.transport.request({
          method: 'PUT',
          path: `/_inference/${encodeURIComponent(endpoint_id)}`,
          body,
        });
        return {
          content: [
            { type: 'text' as const, text: `Inference endpoint "${endpoint_id}" created/updated successfully.` },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
