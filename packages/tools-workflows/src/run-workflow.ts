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
import { getWorkflow } from './registry.js';

export function registerRunWorkflow(server: ToolRegistrationContext): void {
  server.registerTool(
    'run_workflow',
    {
      title: 'Run Workflow',
      description:
        'Retrieve a workflow by name and return its execution plan. The agent should execute each step sequentially using the listed MCP tools, passing the specified parameters. Variable substitution placeholders (${…}) should be resolved by the agent from previous step outputs.',
      inputSchema: z.object({
        name: z.string().describe('Workflow name (e.g. "full-o11y-setup", "service-dashboard")'),
        variables: z
          .record(z.unknown())
          .optional()
          .describe('Input variables for the workflow (e.g. { service_name: "my-api" })'),
        custom_dir: z
          .string()
          .optional()
          .describe('Optional directory path for custom workflow lookup'),
      }),
    },
    async (args) => {
      const { name, variables, custom_dir } = args as {
        name: string;
        variables?: Record<string, unknown>;
        custom_dir?: string;
      };

      try {
        const workflow = await getWorkflow(name, custom_dir);

        if (!workflow) {
          return {
            content: [
              {
                type: 'text',
                text: `Workflow "${name}" not found. Use list_workflows to see available workflows.`,
              },
            ],
            isError: true,
          };
        }

        const variablesSection = workflow.variables
          ? Object.entries(workflow.variables)
              .map(([key, v]) => {
                const supplied = variables?.[key];
                const value = supplied !== undefined ? String(supplied) : v.default !== undefined ? `${v.default} (default)` : '(not set)';
                const req = v.required ? ' [required]' : '';
                return `  • ${key}${req}: ${value}`;
              })
              .join('\n')
          : '  (none)';

        const stepsSection = workflow.steps
          .map((step, i) => {
            const params = Object.entries(step.parameters)
              .map(([k, v]) => `      ${k}: ${JSON.stringify(v)}`)
              .join('\n');
            const cond = step.condition ? `\n    Condition: ${step.condition}` : '';
            const onErr = step.on_error ? `\n    On error: ${step.on_error}` : '';
            return `  ${i + 1}. [${step.id}] ${step.name}\n    Tool: ${step.tool}\n    Parameters:\n${params}${cond}${onErr}`;
          })
          .join('\n\n');

        const text = [
          `## Workflow Plan: ${workflow.name}`,
          '',
          workflow.description,
          '',
          `### Variables`,
          variablesSection,
          '',
          `### Steps`,
          stepsSection,
          '',
          '---',
          'Execute each step in order using the specified MCP tool. Resolve ${…} placeholders from previous step outputs and supplied variables. Skip steps whose conditions are not met.',
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: `Failed to load workflow "${name}": ${message}` }],
          isError: true,
        };
      }
    }
  );
}
