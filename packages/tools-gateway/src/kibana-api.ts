/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { z } from 'zod';
import type { ToolRegistrationContext } from '@elastic-cursor-plugin/shared-types';
import { jsonResponse, errorResponse } from '@elastic-cursor-plugin/shared-types';
import { kibanaFetch } from '@elastic-cursor-plugin/shared-http';

export function registerKibanaApi(server: ToolRegistrationContext): void {
  server.registerTool(
    'kibana_api',
    {
      title: 'Kibana API',
      description:
        'Execute any Kibana REST API call. Accepts HTTP method, path (including query params), and optional JSON body. Returns the raw API response. Read the elastic://docs/api/kibana resource for available endpoints.',
      inputSchema: z.object({
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH']).describe('HTTP method'),
        path: z.string().describe('REST API path (e.g. /api/saved_objects/_find?type=dashboard)'),
        body: z.record(z.unknown()).optional().describe('Optional JSON request body'),
      }),
    },
    async (args) => {
      const { method, path, body } = args as { method: string; path: string; body?: Record<string, unknown> };

      if (path.includes('..')) {
        return errorResponse('Path traversal patterns ("..") are not allowed in API paths.');
      }

      const isInternal = path.startsWith('/internal/');
      try {
        const result = await kibanaFetch(path, {
          method: method.toUpperCase(),
          body,
        });
        if (!result.ok) {
          const errMsg = result.error ?? 'Kibana API request failed';
          if (isInternal) {
            return errorResponse(`⚠️ Warning: /internal/ APIs are unsupported and may change or break without notice.\n\n${errMsg}`);
          }
          return errorResponse(errMsg);
        }
        if (isInternal) {
          return jsonResponse({
            _warning: '⚠️ This used an /internal/ API that is unsupported and may change or break without notice. Prefer /api/ endpoints for stable integration.',
            ...((typeof result.data === 'object' && result.data !== null) ? result.data as Record<string, unknown> : { data: result.data }),
          });
        }
        return jsonResponse(result.data);
      } catch (err) {
        return errorResponse(err);
      }
    }
  );
}
