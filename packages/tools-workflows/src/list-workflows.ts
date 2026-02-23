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
import { listWorkflows } from './registry.js';

export function registerListWorkflows(server: ToolRegistrationContext): void {
  server.registerTool(
    'list_workflows',
    {
      title: 'List Workflows',
      description:
        'List all available observability workflows (built-in and custom). Use this to discover what automated setup sequences are available.',
      inputSchema: z.object({
        custom_dir: z
          .string()
          .optional()
          .describe('Optional directory path to scan for custom workflow YAML files'),
      }),
    },
    async (args) => {
      const { custom_dir } = args as { custom_dir?: string };

      try {
        const workflows = await listWorkflows(custom_dir);

        if (workflows.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No workflows found. Custom workflows can be created with the save_workflow tool.',
              },
            ],
          };
        }

        const lines = workflows.map((w) => {
          const badge = w.source === 'built-in' ? '[built-in]' : '[custom]';
          const version = w.version ? ` v${w.version}` : '';
          return `• **${w.name}**${version} ${badge}\n  ${w.description}\n  Steps: ${w.step_count}`;
        });

        const text = `## Available Workflows\n\n${lines.join('\n\n')}`;

        return { content: [{ type: 'text', text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: `Failed to list workflows: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
