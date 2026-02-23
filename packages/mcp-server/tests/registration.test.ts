/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Smoke test: all tool packages register without throw and expected tool count/names.
 */
import { describe, it, expect } from 'vitest';
import type { ToolRegistrationContext } from '@elastic-cursor-plugin/tools-elasticsearch';
import { registerAll as registerElasticsearchTools } from '@elastic-cursor-plugin/tools-elasticsearch';
import { registerAll as registerCloudTools } from '@elastic-cursor-plugin/tools-cloud';
import { registerAll as registerObservabilityTools } from '@elastic-cursor-plugin/tools-observability';
import { registerAll as registerSecurityTools } from '@elastic-cursor-plugin/tools-security';
import { registerAll as registerSearchAppsTools } from '@elastic-cursor-plugin/tools-search-apps';
import { registerAll as registerAgentBuilderTools } from '@elastic-cursor-plugin/tools-agent-builder';
import { registerAll as registerKibanaTools } from '@elastic-cursor-plugin/tools-kibana';
import { registerDocsResources } from '@elastic-cursor-plugin/docs-provider';
import type { Client } from '@elastic/elasticsearch';

function createCaptureServer(): ToolRegistrationContext & {
  tools: Map<string, { name: string }>;
  registerResource: () => void;
} {
  const tools = new Map<string, { name: string }>();
  return {
    tools,
    registerResource: () => {},
    registerTool(name: string) {
      tools.set(name, { name });
    },
  };
}

describe('MCP server registration', () => {
  it('registers all tools from every package without throwing', () => {
    const server = createCaptureServer();
    const mockClient = {} as Client;

    expect(() => {
      registerElasticsearchTools(server as unknown as ToolRegistrationContext, mockClient);
      registerCloudTools(server as unknown as import('@elastic-cursor-plugin/tools-cloud').ToolRegistrationContext);
      registerObservabilityTools(server as unknown as import('@elastic-cursor-plugin/tools-observability').ToolRegistrationContext);
      registerSecurityTools(server as unknown as import('@elastic-cursor-plugin/tools-security').ToolRegistrationContext);
      registerSearchAppsTools(server as unknown as import('@elastic-cursor-plugin/tools-search-apps').ToolRegistrationContext);
      registerAgentBuilderTools(server as unknown as import('@elastic-cursor-plugin/tools-agent-builder').ToolRegistrationContext);
      registerKibanaTools(server as unknown as import('@elastic-cursor-plugin/tools-kibana').ToolRegistrationContext);
      registerDocsResources(server as unknown as import('@elastic-cursor-plugin/docs-provider').ServerLike);
    }).not.toThrow();
  });

  it('registers expected number of tools (ES + Cloud + Obs + Security + SearchApps + AgentBuilder + Kibana)', () => {
    const server = createCaptureServer();
    const mockClient = {} as Client;

    registerElasticsearchTools(server as unknown as ToolRegistrationContext, mockClient);
    registerCloudTools(server as unknown as import('@elastic-cursor-plugin/tools-cloud').ToolRegistrationContext);
    registerObservabilityTools(server as unknown as import('@elastic-cursor-plugin/tools-observability').ToolRegistrationContext);
    registerSecurityTools(server as unknown as import('@elastic-cursor-plugin/tools-security').ToolRegistrationContext);
    registerSearchAppsTools(server as unknown as import('@elastic-cursor-plugin/tools-search-apps').ToolRegistrationContext);
    registerAgentBuilderTools(server as unknown as import('@elastic-cursor-plugin/tools-agent-builder').ToolRegistrationContext);
    registerKibanaTools(server as unknown as import('@elastic-cursor-plugin/tools-kibana').ToolRegistrationContext);

    // 14 + 6 + 6 + 7 + 5 + 4 + 5 = 47 (deploy_telemetry_dashboard is registered in main, not here)
    expect(server.tools.size).toBe(47);
    expect(server.tools.has('list_indices')).toBe(true);
    expect(server.tools.has('search')).toBe(true);
    expect(server.tools.has('esql_query')).toBe(true);
    expect(server.tools.has('create_cloud_project')).toBe(true);
    expect(server.tools.has('get_deployment_guide')).toBe(true);
    expect(server.tools.has('get_connection_config')).toBe(true);
    expect(server.tools.has('create_alert_rule')).toBe(true);
    expect(server.tools.has('list_alert_rules')).toBe(true);
    expect(server.tools.has('create_detection_rule')).toBe(true);
    expect(server.tools.has('list_detection_rules')).toBe(true);
    expect(server.tools.has('kibana_list_data_views')).toBe(true);
    expect(server.tools.has('kibana_list_dashboards')).toBe(true);
    expect(server.tools.has('kibana_info')).toBe(true);
    expect(server.tools.has('kibana_create_dashboard')).toBe(true);
    expect(server.tools.has('list_agent_builder_tools')).toBe(true);
    expect(server.tools.has('create_agent_builder_tool')).toBe(true);
  });
});
