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

export function registerListAgentBuilderTools(server: ToolRegistrationContext): void {
  server.registerTool(
    'list_agent_builder_tools',
    {
      title: 'List Agent Builder Tools',
      description: 'List tools from Elastic Agent Builder API. Requires Agent Builder endpoint URL.',
      inputSchema: z.object({
        endpoint: z.string().url().optional().describe('Agent Builder MCP or API endpoint'),
      }),
    },
    async (args) => {
      const endpoint = (args as { endpoint?: string }).endpoint ?? process.env.AGENT_BUILDER_ENDPOINT;
      if (!endpoint) {
        return {
          content: [
            {
              type: 'text',
              text: 'Set AGENT_BUILDER_ENDPOINT or pass endpoint to list tools from Agent Builder. If you have an MCP server URL, use the MCP client to call tools/list.',
            },
          ],
        };
      }
      try {
        const res = await fetch(`${endpoint.replace(/\/$/, '')}/mcp/tools/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        });
        const data = await res.json();
        const tools = data?.result?.tools ?? [];
        const text = tools.length
          ? tools.map((t: { name?: string }) => t.name).join('\n')
          : 'No tools returned. Ensure the endpoint supports MCP tools/list.';
        return { content: [{ type: 'text', text }] };
      } catch (e) {
        return {
          content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }],
          isError: true,
        };
      }
    }
  );
}
