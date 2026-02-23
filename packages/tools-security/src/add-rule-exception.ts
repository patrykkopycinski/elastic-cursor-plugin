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

export function registerAddRuleException(server: ToolRegistrationContext): void {
  server.registerTool(
    'add_rule_exception',
    {
      title: 'Add Rule Exception',
      description: 'Add an exception to a detection rule to reduce false positives.',
      inputSchema: z.object({
        rule_id: z.string().describe('Detection rule ID'),
        entries: z.array(z.record(z.unknown())).describe('Exception entries (field, operator, value)'),
      }),
    },
    async (args) => {
      const { rule_id, entries } = args as { rule_id: string; entries: Record<string, unknown>[] };
      const result = await kibanaFetch('/api/detection_engine/exceptions', {
        method: 'POST',
        body: {
          name: `Exception for ${rule_id}`,
          namespace_type: 'single',
          type: 'detection',
          entries,
        },
      });
      if (!result.ok) {
        return { content: [{ type: 'text', text: result.error ?? 'Failed' }], isError: true };
      }
      const id = (result.data as { id?: string })?.id;
      const link = await kibanaFetch(`/api/detection_engine/rules?id=${rule_id}`);
      return {
        content: [
          {
            type: 'text',
            text: `Exception list created (ID: ${id}). Associate it with rule ${rule_id} in Kibana Security → Rules → Edit rule → Exceptions.`,
          },
        ],
      };
    }
  );
}
