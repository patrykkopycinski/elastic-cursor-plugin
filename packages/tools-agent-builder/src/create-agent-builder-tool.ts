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

export function registerCreateAgentBuilderTool(server: ToolRegistrationContext): void {
  server.registerTool(
    'create_agent_builder_tool',
    {
      title: 'Create Agent Builder Tool',
      description: 'Generate definition for a tool to create in Elastic Agent Builder (name, description, input schema).',
      inputSchema: z.object({
        name: z.string().describe('Tool name'),
        description: z.string().describe('Tool description'),
        input_schema: z.record(z.unknown()).optional().describe('JSON Schema for inputs'),
      }),
    },
    async (args) => {
      const { name, description, input_schema } = args as {
        name: string;
        description: string;
        input_schema?: Record<string, unknown>;
      };
      const def = {
        name,
        description,
        inputSchema: input_schema ?? { type: 'object', properties: {} },
      };
      const text = [
        'Agent Builder tool definition (use in Agent Builder UI or API):',
        JSON.stringify(def, null, 2),
      ].join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );
}
