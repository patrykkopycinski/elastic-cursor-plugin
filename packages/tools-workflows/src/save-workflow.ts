/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { z } from 'zod';
import { join } from 'node:path';
import type { ToolRegistrationContext } from './types.js';
import { parseWorkflow } from './parser.js';
import { saveWorkflow } from './registry.js';

const stepSchema = z.object({
  id: z.string(),
  name: z.string(),
  tool: z.string(),
  parameters: z.record(z.unknown()),
  condition: z.string().optional(),
  output_mapping: z.record(z.string()).optional(),
  on_error: z.enum(['stop', 'skip', 'continue']).optional(),
});

const variableSchema = z.object({
  description: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'object']),
  default: z.unknown().optional(),
  required: z.boolean().optional(),
});

const workflowInputSchema = z.object({
  name: z.string().describe('Workflow name (lowercase, hyphens, e.g. "my-workflow")'),
  definition: z
    .object({
      name: z.string(),
      description: z.string(),
      version: z.string().optional(),
      variables: z.record(variableSchema).optional(),
      steps: z.array(stepSchema).min(1),
    })
    .describe('Full workflow definition object'),
  save_dir: z
    .string()
    .optional()
    .describe('Directory to save the workflow file. Defaults to ./workflows in the current working directory'),
});

export function registerSaveWorkflow(server: ToolRegistrationContext): void {
  server.registerTool(
    'save_workflow',
    {
      title: 'Save Workflow',
      description:
        'Validate and save a workflow definition as a YAML file. Use this to persist custom workflows for later execution with run_workflow.',
      inputSchema: workflowInputSchema,
    },
    async (args) => {
      const { name, definition, save_dir } = args as z.infer<typeof workflowInputSchema>;
      const targetDir = save_dir ?? join(process.cwd(), 'workflows');

      try {
        // Round-trip through the parser to ensure the definition is schema-valid
        const yamlContent = JSON.stringify(definition);
        parseWorkflow(yamlContent, 'json');

        await saveWorkflow(name, definition, targetDir);

        const filePath = join(targetDir, `${name}.yaml`);
        return {
          content: [
            {
              type: 'text',
              text: `Workflow "${name}" saved successfully to ${filePath}\n\nSteps: ${definition.steps.length}\nVariables: ${Object.keys(definition.variables ?? {}).length}\n\nRun it with: run_workflow(name: "${name}", custom_dir: "${targetDir}")`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: `Failed to save workflow "${name}": ${message}` }],
          isError: true,
        };
      }
    }
  );
}
