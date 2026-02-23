/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { z } from 'zod';
import type { ToolRegistrationContext } from './types.js';
import { kibanaFetch } from './types.js';

export function registerCreateDetectionRule(server: ToolRegistrationContext): void {
  server.registerTool(
    'create_detection_rule',
    {
      title: 'Create Detection Rule',
      description: 'Create a custom detection rule via Kibana Security API.',
      inputSchema: z.object({
        name: z.string(),
        description: z.string().optional(),
        query: z.string().describe('KQL or Lucene query'),
        severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        risk_score: z.number().optional(),
      }),
    },
    async (args) => {
      const { name, description, query, severity, risk_score } = args as {
        name: string;
        description?: string;
        query: string;
        severity?: string;
        risk_score?: number;
      };
      const result = await kibanaFetch('/api/detection_engine/rules', {
        method: 'POST',
        body: {
          name,
          description: description ?? '',
          query,
          severity: severity ?? 'medium',
          risk_score: risk_score ?? 21,
          type: 'query',
          language: 'kuery',
        },
      });
      if (!result.ok) {
        return { content: [{ type: 'text', text: result.error ?? 'Failed' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Rule created: ${name}. ID: ${(result.data as { id?: string })?.id ?? 'n/a'}` }],
      };
    }
  );
}
