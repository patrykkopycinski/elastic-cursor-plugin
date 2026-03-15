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
        framework: z.enum(['react', 'vue']).optional().default('react').describe('Frontend framework to generate search UI code for'),
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
          : `<!-- Vue 3 Composition API search component for Elasticsearch -->
<template>
  <div class="search-container">
    <div class="search-box">
      <input
        v-model="query"
        type="text"
        placeholder="Search..."
        @input="onSearch"
      />
    </div>

    <div v-if="loading" class="search-loading">Searching...</div>
    <div v-if="error" class="search-error">{{ error }}</div>

    <div v-if="results.length > 0" class="search-results">
      <p class="search-meta">Found {{ totalResults }} results</p>
      <ul>
        <li v-for="hit in results" :key="hit._id" class="search-result-item">
          <h3>{{ hit._source?.title ?? hit._id }}</h3>
          <p v-if="hit.highlight">
            <span v-html="Object.values(hit.highlight).flat().join(' ... ')" />
          </p>
          <pre v-else class="search-result-source">{{ JSON.stringify(hit._source, null, 2) }}</pre>
        </li>
      </ul>
    </div>

    <div v-if="!loading && !error && query && results.length === 0" class="search-no-results">
      No results found for "{{ query }}"
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const ES_ENDPOINT = '${endpoint}';
const API_KEY = import.meta.env.VITE_ES_API_KEY ?? '';

const query = ref('');
const results = ref<Array<Record<string, unknown>>>([]);
const totalResults = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function search(term: string) {
  if (!term.trim()) {
    results.value = [];
    totalResults.value = 0;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const response = await fetch(ES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { Authorization: \`ApiKey \${API_KEY}\` } : {}),
      },
      body: JSON.stringify({
        query: {
          multi_match: {
            query: term,
            fields: ['*'],
            fuzziness: 'AUTO',
          },
        },
        highlight: { fields: { '*': {} } },
        size: 20,
      }),
    });

    if (!response.ok) {
      throw new Error(\`Search failed: \${response.status} \${response.statusText}\`);
    }

    const data = await response.json();
    results.value = data.hits?.hits ?? [];
    totalResults.value = typeof data.hits?.total === 'object'
      ? data.hits.total.value
      : (data.hits?.total ?? 0);
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Search failed';
    results.value = [];
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => search(query.value), 300);
}
</script>

<style scoped>
.search-container { max-width: 720px; margin: 2rem auto; font-family: system-ui, sans-serif; }
.search-box input { width: 100%; padding: 0.75rem 1rem; font-size: 1rem; border: 1px solid #ccc; border-radius: 6px; }
.search-loading { padding: 1rem 0; color: #666; }
.search-error { padding: 1rem; color: #d32f2f; background: #ffeef0; border-radius: 6px; margin-top: 1rem; }
.search-meta { color: #666; font-size: 0.9rem; margin-top: 1rem; }
.search-results ul { list-style: none; padding: 0; }
.search-result-item { padding: 1rem 0; border-bottom: 1px solid #eee; }
.search-result-item h3 { margin: 0 0 0.5rem; }
.search-result-source { font-size: 0.8rem; max-height: 120px; overflow: auto; background: #f5f5f5; padding: 0.5rem; border-radius: 4px; }
.search-no-results { padding: 1rem 0; color: #666; }
</style>`;
      return { content: [{ type: 'text', text: snippet }] };
    }
  );
}
