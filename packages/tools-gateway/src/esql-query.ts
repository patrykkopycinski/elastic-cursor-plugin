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
import { textResponse, errorResponse } from '@elastic-cursor-plugin/shared-types';

export function registerEsqlQuery(server: ToolRegistrationContext, client: Client): void {
  server.registerTool(
    'esql_query',
    {
      title: 'ES|QL Query',
      description: 'Execute an ES|QL query and return results in tabular form.',
      inputSchema: z.object({
        query: z.string().describe('ES|QL query string (e.g. FROM index | LIMIT 10)'),
      }),
    },
    async (args) => {
      const { query } = args as { query: string };
      if (!query?.trim()) {
        return errorResponse('Query is required.');
      }
      try {
        const resp = (await client.transport.request({
          method: 'POST',
          path: '/_query',
          body: { query: query.trim() },
        })) as { columns?: Array<{ name: string }>; values?: unknown[][] };
        const columns = resp.columns ?? [];
        const values = resp.values ?? [];
        const header = columns.map((c) => c.name).join('\t');
        const rows = values.map((row) => row.map((v) => (v == null ? '' : String(v))).join('\t'));
        const text = [header, ...rows].join('\n');
        return textResponse(text || 'No rows returned.');
      } catch (err) {
        return errorResponse(err);
      }
    }
  );
}
