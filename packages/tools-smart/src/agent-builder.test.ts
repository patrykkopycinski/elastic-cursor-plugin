/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolRegistrationContext, ToolResponse } from '@elastic-cursor-plugin/shared-types';
import {
  registerListAgentBuilderTools,
  registerCreateAgentBuilderTool,
  registerDeleteAgentBuilderTool,
  registerTestAgentBuilderTool,
  registerListAgentBuilderAgents,
  registerCreateAgentBuilderAgent,
  registerDeleteAgentBuilderAgent,
  registerGetAgentBuilderMcpConfig,
  registerAllAgentBuilder,
} from './agent-builder.js';

vi.mock('@elastic-cursor-plugin/shared-http', () => ({
  kibanaFetch: vi.fn(),
}));

import { kibanaFetch } from '@elastic-cursor-plugin/shared-http';

const mockKibanaFetch = vi.mocked(kibanaFetch);

interface CapturedTool {
  name: string;
  definition: { title: string; description: string; inputSchema: unknown };
  handler: (args: unknown) => Promise<ToolResponse>;
}

function createCaptureServer(): ToolRegistrationContext & { tools: Map<string, CapturedTool> } {
  const tools = new Map<string, CapturedTool>();
  return {
    tools,
    registerTool(
      name: string,
      definition: { title: string; description: string; inputSchema: unknown },
      handler: (args: unknown) => Promise<ToolResponse>
    ) {
      tools.set(name, { name, definition, handler });
    },
  };
}

describe('agent-builder tools', () => {
  let server: ReturnType<typeof createCaptureServer>;

  beforeEach(() => {
    server = createCaptureServer();
    vi.clearAllMocks();
  });

  describe('registerAllAgentBuilder', () => {
    it('registers all 8 agent builder tools', () => {
      registerAllAgentBuilder(server);
      expect(server.tools.size).toBe(8);
      expect(server.tools.has('list_agent_builder_tools')).toBe(true);
      expect(server.tools.has('create_agent_builder_tool')).toBe(true);
      expect(server.tools.has('delete_agent_builder_tool')).toBe(true);
      expect(server.tools.has('test_agent_builder_tool')).toBe(true);
      expect(server.tools.has('list_agent_builder_agents')).toBe(true);
      expect(server.tools.has('create_agent_builder_agent')).toBe(true);
      expect(server.tools.has('delete_agent_builder_agent')).toBe(true);
      expect(server.tools.has('get_agent_builder_mcp_config')).toBe(true);
    });
  });

  describe('list_agent_builder_tools', () => {
    it('returns tools list on success', async () => {
      registerListAgentBuilderTools(server);
      mockKibanaFetch.mockResolvedValueOnce({
        ok: true,
        data: {
          results: [
            { id: 'platform.core.search', type: 'builtin', description: 'Search tool' },
            { id: 'my-custom-tool', type: 'esql', description: 'Custom tool' },
          ],
        },
      } as never);

      const handler = server.tools.get('list_agent_builder_tools')!.handler;
      const result = await handler({});
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.total).toBe(2);
      expect(parsed.tools).toHaveLength(2);
    });

    it('returns error on failure', async () => {
      registerListAgentBuilderTools(server);
      mockKibanaFetch.mockResolvedValueOnce({
        ok: false,
        error: 'Connection refused',
      } as never);

      const handler = server.tools.get('list_agent_builder_tools')!.handler;
      const result = await handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain('Connection refused');
    });
  });

  describe('create_agent_builder_tool', () => {
    it('creates an esql tool', async () => {
      registerCreateAgentBuilderTool(server);
      const toolDef = {
        id: 'sales-summary',
        type: 'esql',
        description: 'Sales summary tool',
        tags: ['analytics'],
        configuration: {
          query: 'FROM sales-* | STATS count=COUNT(*) BY region',
          params: {},
        },
      };

      mockKibanaFetch.mockResolvedValueOnce({
        ok: true,
        data: { ...toolDef, readonly: false, schema: {} },
      } as never);

      const handler = server.tools.get('create_agent_builder_tool')!.handler;
      const result = await handler(toolDef);
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.id).toBe('sales-summary');
      expect(parsed.type).toBe('esql');
    });

    it('creates an index_search tool', async () => {
      registerCreateAgentBuilderTool(server);
      const toolDef = {
        id: 'kb-search',
        type: 'index_search',
        description: 'Knowledge base search',
        configuration: { pattern: 'knowledge-base' },
      };

      mockKibanaFetch.mockResolvedValueOnce({
        ok: true,
        data: { ...toolDef, readonly: false, schema: {} },
      } as never);

      const handler = server.tools.get('create_agent_builder_tool')!.handler;
      const result = await handler(toolDef);
      expect(result.isError).toBeUndefined();
    });

    it('returns error on API failure', async () => {
      registerCreateAgentBuilderTool(server);
      mockKibanaFetch.mockResolvedValueOnce({
        ok: false,
        error: 'Tool ID already exists',
      } as never);

      const handler = server.tools.get('create_agent_builder_tool')!.handler;
      const result = await handler({
        id: 'dup',
        type: 'esql',
        description: 'dup',
        configuration: {},
      });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain('Tool ID already exists');
    });
  });

  describe('delete_agent_builder_tool', () => {
    it('deletes a tool by id', async () => {
      registerDeleteAgentBuilderTool(server);
      mockKibanaFetch.mockResolvedValueOnce({ ok: true, data: {} } as never);

      const handler = server.tools.get('delete_agent_builder_tool')!.handler;
      const result = await handler({ tool_id: 'my-tool' });
      expect(result.content[0]!.text).toContain('deleted successfully');
      expect(mockKibanaFetch).toHaveBeenCalledWith(
        '/api/agent_builder/tools/my-tool',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('test_agent_builder_tool', () => {
    it('sends a test query to converse API', async () => {
      registerTestAgentBuilderTool(server);
      mockKibanaFetch.mockResolvedValueOnce({
        ok: true,
        data: {
          conversation_id: 'test-conv',
          steps: [{ type: 'reasoning', reasoning: 'Searching...' }],
          response: { message: 'Found 5 results' },
        },
      } as never);

      const handler = server.tools.get('test_agent_builder_tool')!.handler;
      const result = await handler({ query: 'search for trades' });
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.conversation_id).toBe('test-conv');
      expect(mockKibanaFetch).toHaveBeenCalledWith(
        '/api/agent_builder/converse',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ input: 'search for trades', agent_id: 'elastic-ai-agent' }),
        })
      );
    });

    it('uses custom agent_id when provided', async () => {
      registerTestAgentBuilderTool(server);
      mockKibanaFetch.mockResolvedValueOnce({ ok: true, data: {} } as never);

      const handler = server.tools.get('test_agent_builder_tool')!.handler;
      await handler({ query: 'test', agent_id: 'custom-agent' });
      expect(mockKibanaFetch).toHaveBeenCalledWith(
        '/api/agent_builder/converse',
        expect.objectContaining({
          body: expect.objectContaining({ agent_id: 'custom-agent' }),
        })
      );
    });
  });

  describe('list_agent_builder_agents', () => {
    it('returns agents list', async () => {
      registerListAgentBuilderAgents(server);
      mockKibanaFetch.mockResolvedValueOnce({
        ok: true,
        data: {
          results: [
            { id: 'elastic-ai-agent', name: 'Elastic AI Agent' },
            { id: 'custom-agent', name: 'My Agent' },
          ],
        },
      } as never);

      const handler = server.tools.get('list_agent_builder_agents')!.handler;
      const result = await handler({});
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.total).toBe(2);
    });
  });

  describe('create_agent_builder_agent', () => {
    it('creates agent with correct payload', async () => {
      registerCreateAgentBuilderAgent(server);
      mockKibanaFetch.mockResolvedValueOnce({
        ok: true,
        data: { id: 'my-agent', name: 'My Agent' },
      } as never);

      const handler = server.tools.get('create_agent_builder_agent')!.handler;
      const result = await handler({
        id: 'my-agent',
        name: 'My Agent',
        description: 'Test agent',
        instructions: 'You help with searches',
        tool_ids: ['platform.core.search', 'my-custom-tool'],
      });
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.id).toBe('my-agent');
      expect(mockKibanaFetch).toHaveBeenCalledWith(
        '/api/agent_builder/agents',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            id: 'my-agent',
            configuration: {
              instructions: 'You help with searches',
              tools: [{ tool_ids: ['platform.core.search', 'my-custom-tool'] }],
            },
          }),
        })
      );
    });

    it('includes optional fields when provided', async () => {
      registerCreateAgentBuilderAgent(server);
      mockKibanaFetch.mockResolvedValueOnce({ ok: true, data: {} } as never);

      const handler = server.tools.get('create_agent_builder_agent')!.handler;
      await handler({
        id: 'styled-agent',
        name: 'Styled',
        description: 'With avatar',
        instructions: 'Help',
        tool_ids: [],
        labels: ['team-a'],
        avatar_color: '#FF0000',
        avatar_symbol: 'SA',
      });
      expect(mockKibanaFetch).toHaveBeenCalledWith(
        '/api/agent_builder/agents',
        expect.objectContaining({
          body: expect.objectContaining({
            labels: ['team-a'],
            avatar_color: '#FF0000',
            avatar_symbol: 'SA',
          }),
        })
      );
    });
  });

  describe('delete_agent_builder_agent', () => {
    it('deletes an agent by id', async () => {
      registerDeleteAgentBuilderAgent(server);
      mockKibanaFetch.mockResolvedValueOnce({ ok: true, data: {} } as never);

      const handler = server.tools.get('delete_agent_builder_agent')!.handler;
      const result = await handler({ agent_id: 'my-agent' });
      expect(result.content[0]!.text).toContain('deleted successfully');
    });
  });

  describe('get_agent_builder_mcp_config', () => {
    it('generates MCP config using provided kibana_url', async () => {
      registerGetAgentBuilderMcpConfig(server);
      const handler = server.tools.get('get_agent_builder_mcp_config')!.handler;
      const result = await handler({ kibana_url: 'https://my-kibana.example.com' });
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.mcp_config.mcpServers['kibana-agent-builder'].url).toBe(
        'https://my-kibana.example.com/api/agent_builder/mcp'
      );
    });

    it('strips trailing slashes from URL', async () => {
      registerGetAgentBuilderMcpConfig(server);
      const handler = server.tools.get('get_agent_builder_mcp_config')!.handler;
      const result = await handler({ kibana_url: 'https://example.com///' });
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.mcp_config.mcpServers['kibana-agent-builder'].url).toBe(
        'https://example.com/api/agent_builder/mcp'
      );
    });

    it('returns error when no URL available', async () => {
      registerGetAgentBuilderMcpConfig(server);
      const originalKibanaUrl = process.env.KIBANA_URL;
      delete process.env.KIBANA_URL;
      try {
        const handler = server.tools.get('get_agent_builder_mcp_config')!.handler;
        const result = await handler({});
        expect(result.isError).toBe(true);
        expect(result.content[0]!.text).toContain('KIBANA_URL');
      } finally {
        if (originalKibanaUrl) process.env.KIBANA_URL = originalKibanaUrl;
      }
    });
  });
});
