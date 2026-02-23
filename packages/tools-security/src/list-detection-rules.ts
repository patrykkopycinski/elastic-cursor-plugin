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

export function registerListDetectionRules(server: ToolRegistrationContext): void {
  server.registerTool(
    'list_detection_rules',
    {
      title: 'List Detection Rules',
      description: 'List prebuilt and custom detection rules with optional filter.',
      inputSchema: z.object({
        filter: z.string().optional().describe('Filter by tag or type'),
      }),
    },
    async () => {
      const result = await kibanaFetch('/api/detection_engine/rules/_find');
      if (!result.ok) {
        return {
          content: [
            {
              type: 'text',
              text: result.error ?? 'Set KIBANA_URL and KIBANA_API_KEY (or ES_API_KEY) to list rules.',
            },
          ],
          isError: true,
        };
      }
      const data = result.data as { data?: Array<{ name?: string; rule_type?: string; enabled?: boolean }> };
      const rules = data?.data ?? [];
      const lines = rules.map((r) => `${r.name}\t ${r.rule_type}\t enabled: ${r.enabled}`);
      return { content: [{ type: 'text', text: lines.length ? lines.join('\n') : 'No rules found.' }] };
    }
  );
}
