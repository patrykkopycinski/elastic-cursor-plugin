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

export function registerGetAgentBuilderMcpConfig(server: ToolRegistrationContext): void {
  server.registerTool(
    'get_agent_builder_mcp_config',
    {
      title: 'Get Agent Builder MCP Config',
      description: 'Generate MCP client configuration (e.g. for Cursor) to connect to an Agent Builder endpoint.',
      inputSchema: z.object({
        endpoint_url: z.string().url().describe('Agent Builder MCP endpoint URL'),
        transport: z.enum(['stdio', 'sse', 'streamable_http']).optional().default('streamable_http'),
      }),
    },
    async (args) => {
      const { endpoint_url, transport } = args as { endpoint_url: string; transport?: string };
      const config =
        transport === 'streamable_http'
          ? {
              mcpServers: {
                'elastic-agent-builder': {
                  url: endpoint_url,
                  transport: 'streamable_http',
                },
              },
            }
          : {
              mcpServers: {
                'elastic-agent-builder': {
                  command: 'node',
                  args: ['path/to/agent-builder-mcp-bridge.js'],
                  env: { AGENT_BUILDER_URL: endpoint_url },
                },
              },
            };
      const text = [
        'Add to your MCP config (e.g. Cursor mcp.json or Claude Code):',
        JSON.stringify(config, null, 2),
      ].join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );
}
