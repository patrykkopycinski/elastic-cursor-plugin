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
import type { ToolRegistrationContext } from '@elastic-cursor-plugin/shared-types';
import { jsonResponse, errorResponse } from '@elastic-cursor-plugin/shared-types';

export function registerElasticsearchApi(server: ToolRegistrationContext, client: Client): void {
  server.registerTool(
    'elasticsearch_api',
    {
      title: 'Elasticsearch API',
      description:
        'Execute any Elasticsearch REST API call. Accepts HTTP method, path (including query params), and optional JSON body. Returns the raw API response. Read the elastic://docs/api/elasticsearch resource for available endpoints.',
      inputSchema: z.object({
        method: z.string().describe('HTTP method (GET, POST, PUT, DELETE, HEAD)'),
        path: z
          .string()
          .describe('REST API path including query parameters (e.g. /_cat/indices?v=true&format=json)'),
        body: z.record(z.unknown()).optional().describe('Optional JSON request body'),
      }),
    },
    async (args) => {
      const { method, path, body } = args as { method: string; path: string; body?: Record<string, unknown> };
      try {
        const resp = await client.transport.request({
          method: method.toUpperCase(),
          path,
          body: body && Object.keys(body).length > 0 ? body : undefined,
        });
        return jsonResponse(resp);
      } catch (err) {
        return errorResponse(err);
      }
    }
  );
}
