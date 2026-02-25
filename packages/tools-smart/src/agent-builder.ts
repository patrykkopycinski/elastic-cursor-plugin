/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { z } from 'zod';
import type { ToolRegistrationContext } from '@elastic-cursor-plugin/shared-types';
import { textResponse, errorResponse, jsonResponse } from '@elastic-cursor-plugin/shared-types';
import { kibanaFetch } from '@elastic-cursor-plugin/shared-http';

const AGENT_BUILDER_API = '/api/agent_builder';

export function registerListAgentBuilderTools(server: ToolRegistrationContext): void {
  server.registerTool(
    'list_agent_builder_tools',
    {
      title: 'List Agent Builder Tools',
      description:
        'List all tools registered in Kibana Agent Builder, including builtin platform tools and user-created custom tools (ES|QL, index_search).',
      inputSchema: z.object({}),
    },
    async () => {
      const res = await kibanaFetch(`${AGENT_BUILDER_API}/tools`);
      if (!res.ok) {
        return errorResponse(res.error ?? 'Failed to list Agent Builder tools');
      }
      const data = res.data as { results?: unknown[] };
      const tools = data.results ?? [];
      return jsonResponse({ total: tools.length, tools });
    }
  );
}

export function registerCreateAgentBuilderTool(server: ToolRegistrationContext): void {
  server.registerTool(
    'create_agent_builder_tool',
    {
      title: 'Create Agent Builder Tool',
      description:
        'Create a custom tool in Kibana Agent Builder. Supported types: "esql" (pre-defined ES|QL query with parameters) and "index_search" (natural language search scoped to an index pattern).',
      inputSchema: z.object({
        id: z.string().describe('Unique tool ID (kebab-case, e.g. "my-search-tool")'),
        type: z
          .enum(['esql', 'index_search'])
          .describe('Tool type: "esql" for ES|QL query tools, "index_search" for search tools'),
        description: z.string().describe('Human-readable description of what the tool does'),
        tags: z.array(z.string()).optional().describe('Optional tags for categorization'),
        configuration: z
          .record(z.unknown())
          .describe(
            'Tool configuration. For esql: { query, params }. For index_search: { pattern }.'
          ),
      }),
    },
    async (args) => {
      const { id, type, description, tags, configuration } = args as {
        id: string;
        type: string;
        description: string;
        tags?: string[];
        configuration: Record<string, unknown>;
      };

      const res = await kibanaFetch(`${AGENT_BUILDER_API}/tools`, {
        method: 'POST',
        body: { id, type, description, tags: tags ?? [], configuration },
      });

      if (!res.ok) {
        return errorResponse(res.error ?? 'Failed to create Agent Builder tool');
      }
      return jsonResponse(res.data);
    }
  );
}

export function registerDeleteAgentBuilderTool(server: ToolRegistrationContext): void {
  server.registerTool(
    'delete_agent_builder_tool',
    {
      title: 'Delete Agent Builder Tool',
      description: 'Delete a custom tool from Kibana Agent Builder by its ID.',
      inputSchema: z.object({
        tool_id: z.string().describe('The ID of the tool to delete'),
      }),
    },
    async (args) => {
      const { tool_id } = args as { tool_id: string };
      const res = await kibanaFetch(`${AGENT_BUILDER_API}/tools/${encodeURIComponent(tool_id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        return errorResponse(res.error ?? `Failed to delete tool ${tool_id}`);
      }
      return textResponse(`Tool "${tool_id}" deleted successfully.`);
    }
  );
}

export function registerTestAgentBuilderTool(server: ToolRegistrationContext): void {
  server.registerTool(
    'test_agent_builder_tool',
    {
      title: 'Test Agent Builder Tool',
      description:
        'Execute/test a tool registered in Agent Builder by sending a query to the converse API with a specific agent or the default agent.',
      inputSchema: z.object({
        query: z.string().describe('The test query to send to the agent'),
        agent_id: z
          .string()
          .optional()
          .describe('Agent ID to test with (defaults to "elastic-ai-agent")'),
        connector_id: z
          .string()
          .optional()
          .describe('Connector ID for the LLM model to use'),
      }),
    },
    async (args) => {
      const { query, agent_id, connector_id } = args as {
        query: string;
        agent_id?: string;
        connector_id?: string;
      };

      const body: Record<string, unknown> = {
        input: query,
        agent_id: agent_id ?? 'elastic-ai-agent',
      };
      if (connector_id) {
        body.connector_id = connector_id;
      }

      const res = await kibanaFetch(`${AGENT_BUILDER_API}/converse`, {
        method: 'POST',
        body,
      });

      if (!res.ok) {
        return errorResponse(res.error ?? 'Failed to converse with Agent Builder');
      }
      return jsonResponse(res.data);
    }
  );
}

export function registerListAgentBuilderAgents(server: ToolRegistrationContext): void {
  server.registerTool(
    'list_agent_builder_agents',
    {
      title: 'List Agent Builder Agents',
      description:
        'List all agents in Kibana Agent Builder, including the default Elastic AI Agent and any custom agents.',
      inputSchema: z.object({}),
    },
    async () => {
      const res = await kibanaFetch(`${AGENT_BUILDER_API}/agents`);
      if (!res.ok) {
        return errorResponse(res.error ?? 'Failed to list Agent Builder agents');
      }
      const data = res.data as { results?: unknown[] };
      const agents = data.results ?? [];
      return jsonResponse({ total: agents.length, agents });
    }
  );
}

export function registerCreateAgentBuilderAgent(server: ToolRegistrationContext): void {
  server.registerTool(
    'create_agent_builder_agent',
    {
      title: 'Create Agent Builder Agent',
      description:
        'Create a custom agent in Kibana Agent Builder with specific instructions, tools, and configuration.',
      inputSchema: z.object({
        id: z.string().describe('Unique agent ID (kebab-case)'),
        name: z.string().describe('Display name for the agent'),
        description: z.string().describe('Description shown to users'),
        labels: z.array(z.string()).optional().describe('Optional labels for categorization'),
        avatar_color: z.string().optional().describe('Hex color for avatar (e.g. "#BFDBFF")'),
        avatar_symbol: z
          .string()
          .optional()
          .describe('Two-letter symbol for avatar (e.g. "SI")'),
        instructions: z.string().describe('System instructions for the agent'),
        tool_ids: z
          .array(z.string())
          .describe(
            'List of tool IDs the agent can use (e.g. ["platform.core.search", "my-custom-tool"])'
          ),
      }),
    },
    async (args) => {
      const { id, name, description, labels, avatar_color, avatar_symbol, instructions, tool_ids } =
        args as {
          id: string;
          name: string;
          description: string;
          labels?: string[];
          avatar_color?: string;
          avatar_symbol?: string;
          instructions: string;
          tool_ids: string[];
        };

      const body: Record<string, unknown> = {
        id,
        name,
        description,
        configuration: {
          instructions,
          tools: [{ tool_ids }],
        },
      };
      if (labels) body.labels = labels;
      if (avatar_color) body.avatar_color = avatar_color;
      if (avatar_symbol) body.avatar_symbol = avatar_symbol;

      const res = await kibanaFetch(`${AGENT_BUILDER_API}/agents`, {
        method: 'POST',
        body,
      });

      if (!res.ok) {
        return errorResponse(res.error ?? 'Failed to create Agent Builder agent');
      }
      return jsonResponse(res.data);
    }
  );
}

export function registerDeleteAgentBuilderAgent(server: ToolRegistrationContext): void {
  server.registerTool(
    'delete_agent_builder_agent',
    {
      title: 'Delete Agent Builder Agent',
      description: 'Delete a custom agent from Kibana Agent Builder by its ID.',
      inputSchema: z.object({
        agent_id: z.string().describe('The ID of the agent to delete'),
      }),
    },
    async (args) => {
      const { agent_id } = args as { agent_id: string };
      const res = await kibanaFetch(
        `${AGENT_BUILDER_API}/agents/${encodeURIComponent(agent_id)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        return errorResponse(res.error ?? `Failed to delete agent ${agent_id}`);
      }
      return textResponse(`Agent "${agent_id}" deleted successfully.`);
    }
  );
}

export function registerGetAgentBuilderMcpConfig(server: ToolRegistrationContext): void {
  server.registerTool(
    'get_agent_builder_mcp_config',
    {
      title: 'Get Agent Builder MCP Config',
      description:
        'Generate the MCP configuration JSON for connecting Cursor, Claude Code, or other MCP clients directly to the Kibana Agent Builder MCP endpoint.',
      inputSchema: z.object({
        kibana_url: z
          .string()
          .optional()
          .describe(
            'Kibana URL to use in the config. If not provided, uses the KIBANA_URL environment variable.'
          ),
      }),
    },
    async (args) => {
      const { kibana_url } = args as { kibana_url?: string };
      const url = kibana_url ?? process.env.KIBANA_URL;

      if (!url) {
        return errorResponse(
          'KIBANA_URL is not set. Provide kibana_url parameter or set the KIBANA_URL environment variable.'
        );
      }

      const baseUrl = url.replace(/\/+$/, '');
      const mcpEndpoint = `${baseUrl}/api/agent_builder/mcp`;

      const apiKey = process.env.ES_API_KEY ?? process.env.KIBANA_API_KEY;
      const authHeader = apiKey
        ? `ApiKey ${apiKey}`
        : process.env.ES_USERNAME && process.env.ES_PASSWORD
          ? `Basic ${Buffer.from(`${process.env.ES_USERNAME}:${process.env.ES_PASSWORD}`).toString('base64')}`
          : undefined;

      const config: Record<string, unknown> = {
        mcpServers: {
          'kibana-agent-builder': {
            url: mcpEndpoint,
            ...(authHeader ? { headers: { Authorization: authHeader } } : {}),
          },
        },
      };

      return jsonResponse({
        mcp_config: config,
        instructions: [
          `Add this to your MCP client settings (e.g. Cursor's .cursor/mcp.json):`,
          `The Agent Builder MCP endpoint serves your custom tools and agents.`,
          `Use this plugin for infrastructure setup; use Agent Builder MCP for production workloads.`,
        ],
      });
    }
  );
}

export function registerAllAgentBuilder(server: ToolRegistrationContext): void {
  registerListAgentBuilderTools(server);
  registerCreateAgentBuilderTool(server);
  registerDeleteAgentBuilderTool(server);
  registerTestAgentBuilderTool(server);
  registerListAgentBuilderAgents(server);
  registerCreateAgentBuilderAgent(server);
  registerDeleteAgentBuilderAgent(server);
  registerGetAgentBuilderMcpConfig(server);
}
