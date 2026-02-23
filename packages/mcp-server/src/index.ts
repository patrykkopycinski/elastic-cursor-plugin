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
import { getDefaultClient } from './auth.js';
import { checkElasticsearchHealth } from './health.js';
import type { ToolRegistrationContext } from '@elastic-cursor-plugin/tools-elasticsearch';
import { registerAll as registerElasticsearchTools } from '@elastic-cursor-plugin/tools-elasticsearch';
import { registerAll as registerCloudTools } from '@elastic-cursor-plugin/tools-cloud';
import { registerAll as registerObservabilityTools } from '@elastic-cursor-plugin/tools-observability';
import { registerAll as registerSecurityTools } from '@elastic-cursor-plugin/tools-security';
import { registerAll as registerSearchAppsTools } from '@elastic-cursor-plugin/tools-search-apps';
import { registerAll as registerAgentBuilderTools } from '@elastic-cursor-plugin/tools-agent-builder';
import { registerAll as registerKibanaTools } from '@elastic-cursor-plugin/tools-kibana';
import { registerDocsResources } from '@elastic-cursor-plugin/docs-provider';

const SERVER_NAME = 'elastic-developer-experience';
const SERVER_VERSION = '0.1.0';

async function main() {
  const client = getDefaultClient();
  const health = await checkElasticsearchHealth(client);

  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: { listChanged: true },
      },
      instructions: `Elastic Developer Experience Tools — first-class UX: one config, Cloud or on-prem, fast time-to-first-value

Connect to Elasticsearch and use Elastic Cloud, Observability, and Security tooling.

**First-time setup:** If the user wants to set up Elastic from zero, ask once: "Do you prefer Cloud (managed, no servers) or on-prem (Docker)?" Then call get_deployment_guide with preference "cloud" or "on_prem". For Cloud, use create_cloud_project and get_connection_config so they can paste credentials and run a search in under 2 minutes. For on-prem, point them to examples/on-prem-docker (docker compose up -d) then get_connection_config with http://localhost:9200.

Configuration: ES_URL + ES_API_KEY (or ES_USERNAME/ES_PASSWORD), or ES_CLOUD_ID + ES_API_KEY.
Startup health: ${health.ok ? `Connected (${health.clusterName ?? 'cluster'} ${health.version ?? ''})` : health.message}

Use the available tools to manage indices, run searches, ESQL, ingest pipelines, inference endpoints, and more. Return copy-paste-ready snippets (connection config, code) when possible.`,
    }
  );

  registerElasticsearchTools(server as unknown as ToolRegistrationContext, client);
  registerCloudTools(server as unknown as import('@elastic-cursor-plugin/tools-cloud').ToolRegistrationContext);
  registerObservabilityTools(server as unknown as import('@elastic-cursor-plugin/tools-observability').ToolRegistrationContext);
  registerSecurityTools(server as unknown as import('@elastic-cursor-plugin/tools-security').ToolRegistrationContext);
  registerSearchAppsTools(server as unknown as import('@elastic-cursor-plugin/tools-search-apps').ToolRegistrationContext);
  registerAgentBuilderTools(server as unknown as import('@elastic-cursor-plugin/tools-agent-builder').ToolRegistrationContext);
  registerKibanaTools(server as unknown as import('@elastic-cursor-plugin/tools-kibana').ToolRegistrationContext);
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
