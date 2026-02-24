#!/usr/bin/env node
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Elastic Developer Experience MCP Server
 *
 * Provides Elasticsearch, Observability, and Security tools via the Model Context Protocol.
 * Supports stdio transport (default) and optional streamable HTTP when PORT is set.
 *
 * Usage:
 *   npx elastic-cursor-plugin
 *   PORT=3000 npx elastic-cursor-plugin   # enable HTTP transport
 */

import { config } from 'dotenv';
config();

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { ToolRegistrationContext } from '@elastic-cursor-plugin/shared-types';
import { getDefaultClient } from './auth.js';
import { checkElasticsearchHealth } from './health.js';
import { registerAll as registerGatewayTools } from '@elastic-cursor-plugin/tools-gateway';
import { registerAll as registerSmartTools } from '@elastic-cursor-plugin/tools-smart';
import { registerAll as registerWorkflowTools } from '@elastic-cursor-plugin/tools-workflows';
import { registerDocsResources } from '@elastic-cursor-plugin/docs-provider';

const SERVER_NAME = 'elastic-developer-experience';
const SERVER_VERSION = '0.1.0';

async function main() {
  const client = getDefaultClient();
  const health = await checkElasticsearchHealth(client);

  const hasEs = health.ok && client != null;
  const hasKibana = !!process.env.KIBANA_URL;
  const hasCloud = !!process.env.ELASTIC_CLOUD_API_KEY;

  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
      },
      instructions: `Elastic Developer Experience Tools — first-class UX: one config, Cloud or on-prem, fast time-to-first-value

Connect to Elasticsearch and use Elastic Cloud, Observability, and Security tooling.

**First-time setup:** If the user wants to set up Elastic from zero, ask once: "Do you prefer Cloud (managed, no servers) or on-prem (Docker)?" Then call get_deployment_guide with preference "cloud" or "on_prem". For Cloud, use cloud_api and get_connection_config so they can paste credentials and run a search in under 2 minutes. For on-prem, point them to examples/on-prem-docker (docker compose up -d) then get_connection_config with http://localhost:9200.

Configuration: ES_URL + ES_API_KEY (or ES_USERNAME/ES_PASSWORD), or ES_CLOUD_ID + ES_API_KEY.
Startup health: ${health.ok ? `Connected (${health.clusterName ?? 'cluster'} ${health.version ?? ''})` : health.message}

**API Gateway Tools:** Use elasticsearch_api, kibana_api, and cloud_api for direct REST API access. Read the API reference resources (elastic://docs/api/elasticsearch, elastic://docs/api/kibana, elastic://docs/api/cloud) for endpoint documentation before making calls. Use esql_query for ES|QL queries with tabular output.

**Smart Workflow Tools:** Use discover_o11y_data to auto-detect APM services, metrics, and logs. Use get_data_summary for a rich summary with dashboard and SLO recommendations. Use list_workflows and run_workflow for multi-step O11Y configuration flows.

Return copy-paste-ready snippets (connection config, code) when possible.`,
    }
  );

  registerGatewayTools(server as unknown as ToolRegistrationContext, {
    esClient: hasEs ? client : null,
    hasKibana,
    hasCloud,
  });

  registerSmartTools(server as unknown as ToolRegistrationContext, {
    hasEs,
    hasKibana,
    hasCloud,
  });

  registerWorkflowTools(server as unknown as import('@elastic-cursor-plugin/tools-workflows').ToolRegistrationContext);

  registerDocsResources(server as unknown as import('@elastic-cursor-plugin/docs-provider').ServerLike);

  server.registerTool(
    'deploy_telemetry_dashboard',
    {
      title: 'Deploy Telemetry Dashboard',
      description:
        'Output Kibana index pattern and instructions to import the adoption telemetry dashboard. Opt-in telemetry: set ELASTIC_TELEMETRY_OPT_IN=true.',
      inputSchema: z.object({}),
    },
    async () => {
      const indexPattern = 'elastic-cursor-plugin-telemetry';
      const text = [
        'Adoption telemetry is opt-in. Set ELASTIC_TELEMETRY_OPT_IN=true and ES_URL + ES_API_KEY to send events.',
        `Index: ${indexPattern}. Create a data view in Kibana with this index pattern and @timestamp as time field.`,
        'Pre-built index pattern (saved object) NDJSON:',
        JSON.stringify({
          attributes: {
            title: indexPattern,
            timeFieldName: '@timestamp',
          },
          type: 'index-pattern',
        }),
      ].join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Elastic MCP Server error:', err);
  process.exit(1);
});
