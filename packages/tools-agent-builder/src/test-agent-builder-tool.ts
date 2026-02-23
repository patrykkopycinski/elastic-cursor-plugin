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

export function registerTestAgentBuilderTool(server: ToolRegistrationContext): void {
  server.registerTool(
    'test_agent_builder_tool',
    {
      title: 'Test Agent Builder Tool',
      description: 'Test an Agent Builder tool with sample input. Returns instructions or calls the tool.',
      inputSchema: z.object({
        tool_name: z.string().describe('Name of the tool to test'),
        arguments: z.record(z.unknown()).optional().describe('Sample arguments (JSON)'),
      }),
    },
    async (args) => {
      const { tool_name, arguments: arg } = args as { tool_name: string; arguments?: Record<string, unknown> };
      const text = [
        `Test Agent Builder tool: ${tool_name}`,
        arg && Object.keys(arg).length ? `Sample arguments: ${JSON.stringify(arg)}` : 'No arguments provided.',
        'Use the Agent Builder MCP endpoint to call tools/call with this tool name and arguments, or run the tool from the Agent Builder UI.',
      ].join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );
}
