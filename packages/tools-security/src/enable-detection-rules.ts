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

export function registerEnableDetectionRules(server: ToolRegistrationContext): void {
  server.registerTool(
    'enable_detection_rules',
    {
      title: 'Enable Detection Rules',
      description: 'Enable detection rules by ID or by tag/category.',
      inputSchema: z.object({
        rule_ids: z.array(z.string()).optional().describe('Rule IDs to enable'),
        tag: z.string().optional().describe('Enable all rules with this tag'),
      }),
    },
    async (args) => {
      const { rule_ids, tag } = args as { rule_ids?: string[]; tag?: string };
      if (!rule_ids?.length && !tag) {
        return { content: [{ type: 'text', text: 'Provide rule_ids or tag.' }], isError: true };
      }
      if (rule_ids?.length) {
        const results = await Promise.all(
          rule_ids.map((id) =>
            kibanaFetch(`/api/detection_engine/rules?id=${encodeURIComponent(id)}`, {
              method: 'PATCH',
              body: { enabled: true },
            })
          )
        );
        const failed = results.filter((r) => !r.ok);
        const text =
          failed.length === 0
            ? `Enabled ${rule_ids.length} rule(s).`
            : `Enabled ${rule_ids.length - failed.length}; failed: ${failed.map((r) => r.error).join(', ')}`;
        return { content: [{ type: 'text', text }], isError: failed.length > 0 };
      }
      return {
        content: [
          {
            type: 'text',
            text: `Filter by tag "${tag}" in Kibana Security → Rules, then bulk enable. Or use rule_ids with this tool.`,
          },
        ],
      };
    }
  );
}
