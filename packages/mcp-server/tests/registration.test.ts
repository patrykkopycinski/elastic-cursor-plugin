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
import type { ToolRegistrationContext } from '@elastic-cursor-plugin/shared-types';
import { registerAll as registerGatewayTools } from '@elastic-cursor-plugin/tools-gateway';
import { registerAll as registerSmartTools } from '@elastic-cursor-plugin/tools-smart';
import { registerAll as registerWorkflowTools } from '@elastic-cursor-plugin/tools-workflows';
import { registerDocsResources } from '@elastic-cursor-plugin/docs-provider';
import type { Client } from '@elastic/elasticsearch';

function createCaptureServer(): ToolRegistrationContext & {
  tools: Map<string, { name: string }>;
  registerResource: () => void;
} {
  const tools = new Map<string, { name: string }>();
  return {
    tools,
    registerResource: () => { },
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
      registerGatewayTools(server as unknown as ToolRegistrationContext, {
        esClient: mockClient,
        hasKibana: true,
        hasCloud: true,
      });
      registerSmartTools(server as unknown as ToolRegistrationContext);
      registerWorkflowTools(server as unknown as import('@elastic-cursor-plugin/tools-workflows').ToolRegistrationContext);
      registerDocsResources(server as unknown as import('@elastic-cursor-plugin/docs-provider').ServerLike);
    }).not.toThrow();
  });

  it('registers expected gateway + smart + workflow tools', () => {
    const server = createCaptureServer();
    const mockClient = {} as Client;

    registerGatewayTools(server as unknown as ToolRegistrationContext, {
      esClient: mockClient,
      hasKibana: true,
      hasCloud: true,
    });
    registerSmartTools(server as unknown as ToolRegistrationContext);
    registerWorkflowTools(server as unknown as import('@elastic-cursor-plugin/tools-workflows').ToolRegistrationContext);

    // Gateway: elasticsearch_api, esql_query, kibana_api, cloud_api = 4
    expect(server.tools.has('elasticsearch_api')).toBe(true);
    expect(server.tools.has('esql_query')).toBe(true);
    expect(server.tools.has('kibana_api')).toBe(true);
    expect(server.tools.has('cloud_api')).toBe(true);

    // Smart tools (13 total)
    expect(server.tools.has('discover_o11y_data')).toBe(true);
    expect(server.tools.has('get_data_summary')).toBe(true);
    expect(server.tools.has('create_iot_dashboard')).toBe(true);
    expect(server.tools.has('setup_apm')).toBe(true);
    expect(server.tools.has('setup_log_shipping')).toBe(true);
    expect(server.tools.has('create_alert_rule')).toBe(true);
    expect(server.tools.has('create_dashboard')).toBe(true);
    expect(server.tools.has('observability_info')).toBe(true);
    expect(server.tools.has('siem_quickstart')).toBe(true);
    expect(server.tools.has('generate_search_ui')).toBe(true);
    expect(server.tools.has('get_deployment_guide')).toBe(true);
    expect(server.tools.has('get_connection_config')).toBe(true);
    expect(server.tools.has('kibana_info')).toBe(true);

    // Workflow tools (3)
    expect(server.tools.has('list_workflows')).toBe(true);
    expect(server.tools.has('run_workflow')).toBe(true);
    expect(server.tools.has('save_workflow')).toBe(true);

    // 4 gateway + 13 smart + 3 workflow = 20
    expect(server.tools.size).toBe(20);
  });

  it('conditionally registers gateway tools based on options', () => {
    const server = createCaptureServer();

    registerGatewayTools(server as unknown as ToolRegistrationContext, {
      esClient: null,
      hasKibana: false,
      hasCloud: false,
    });

    expect(server.tools.size).toBe(0);
  });
});
