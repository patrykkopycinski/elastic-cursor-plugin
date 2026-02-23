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

export function registerGetConnectionConfig(server: ToolRegistrationContext): void {
  server.registerTool(
    'get_connection_config',
    {
      title: 'Get Connection Config',
      description:
        'Generate language-specific client configuration snippets (Node.js, Python, Java, Go, .NET) for connecting to Elasticsearch.',
      inputSchema: z.object({
        url: z.string().describe('Elasticsearch URL (e.g. https://xxx.es.us-central1.gcp.cloud.es.io:9243)'),
        api_key: z.string().optional().describe('API key (omit in output if not provided)'),
        language: z
          .enum(['node', 'python', 'java', 'go', 'dotnet'])
          .describe('Target language'),
      }),
    },
    async (args) => {
      const { url, api_key, language } = args as {
        url: string;
        api_key?: string;
        language: 'node' | 'python' | 'java' | 'go' | 'dotnet';
      };
      const auth = api_key ? `auth: { apiKey: '${api_key}' }` : '// Set auth: { apiKey: \'...\' } or auth: { username, password }';
      const snippets: Record<string, string> = {
        node: `const { Client } = require('@elastic/elasticsearch');
const client = new Client({
  node: '${url}',
  ${auth}
});`,
        python: `from elasticsearch import Elasticsearch
client = Elasticsearch(
    "${url}",
    api_key="${api_key ?? 'YOUR_API_KEY'}"
)`,
        java: `RestClient restClient = RestClient.builder(
    HttpHost.create("${url}")
).setDefaultHeaders(
    new Header[]{new BasicHeader("Authorization", "ApiKey ${api_key ?? "YOUR_API_KEY"}")}
).build();
ElasticsearchClient client = new ElasticsearchClient(restClient);`,
        go: `cfg := elasticsearch.Config{
    Addresses: []string{"${url}"},
    APIKey: "${api_key ?? "YOUR_API_KEY"}",
}
client, err := elasticsearch.NewClient(cfg)`,
        dotnet: `var settings = new ConnectionSettings(new Uri("${url}"))
    .ApiKeyAuthentication("${api_key ?? "YOUR_API_KEY"}");
var client = new ElasticClient(settings);`,
      };
      const text = snippets[language] ?? `Unsupported language: ${language}`;
      return { content: [{ type: 'text', text }] };
    }
  );
}
