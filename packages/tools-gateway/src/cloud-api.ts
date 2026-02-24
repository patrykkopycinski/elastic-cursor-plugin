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
import { cloudFetch } from '@elastic-cursor-plugin/shared-http';

export function registerCloudApi(server: ToolRegistrationContext): void {
  server.registerTool(
    'cloud_api',
    {
      title: 'Elastic Cloud API',
      description:
        'Execute any Elastic Cloud REST API call. Accepts HTTP method, path, and optional JSON body. Returns the raw API response. Read the elastic://docs/api/cloud resource for available endpoints.',
      inputSchema: z.object({
        method: z.string().describe('HTTP method (GET, POST, PUT, DELETE)'),
        path: z.string().describe('REST API path (e.g. /api/v1/serverless/projects/elasticsearch)'),
        body: z.record(z.unknown()).optional().describe('Optional JSON request body'),
      }),
    },
    async (args) => {
      const { method, path, body } = args as { method: string; path: string; body?: Record<string, unknown> };
      try {
        const result = await cloudFetch(path, {
          method: method.toUpperCase(),
          body,
        });
        if (!result.ok) {
          return errorResponse(result.error ?? 'Cloud API request failed');
        }
        return jsonResponse(result.data);
      } catch (err) {
        return errorResponse(err);
      }
    }
  );
}
