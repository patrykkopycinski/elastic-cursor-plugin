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

export function registerGenerateSearchUi(server: ToolRegistrationContext): void {
  server.registerTool(
    'generate_search_ui',
    {
      title: 'Generate Search UI',
      description: 'Generate React Search UI component code for Elasticsearch App Search or programmatic search.',
      inputSchema: z.object({
        framework: z.enum(['react', 'vue']).optional().default('react'),
        search_endpoint: z.string().optional().describe('Search API endpoint or index'),
      }),
    },
    async (args) => {
      const { framework, search_endpoint } = args as { framework?: string; search_endpoint?: string };
      const endpoint = search_endpoint ?? 'https://your-deployment.es.cloud:9243/your-index/_search';
      const snippet =
        framework === 'react'
          ? `// React: use @elastic/react-search-ui and @elastic/search-ui-elasticsearch-connector
import { SearchProvider, Results, SearchBox } from '@elastic/react-search-ui';
import { ElasticsearchAPIConnector } from '@elastic/search-ui-elasticsearch-connector';

const connector = new ElasticsearchAPIConnector({
  host: "${endpoint}",
  index: "your-index",
  apiKey: process.env.ES_API_KEY
});

<SearchProvider config={{ apiConnector: connector }}>
  <SearchBox />
  <Results />
</SearchProvider>`
          : `Vue: use the Elasticsearch JS client or a Vue wrapper for Search UI. Configure host: "${endpoint}" and auth.`;
      return { content: [{ type: 'text', text: snippet }] };
    }
  );
}
