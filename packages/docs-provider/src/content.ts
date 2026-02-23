/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export const DOCS_API_SEARCH = `# Elasticsearch Search API

## POST /<index>/_search

Execute a search with Query DSL.

### Request body
- \`query\`: Query DSL (match, term, bool, range, kNN, etc.)
- \`size\`: Number of hits (default 10)
- \`from\`: Offset
- \`sort\`: Sort specification
- \`aggs\`: Aggregations
- \`highlight\`: Highlight configuration

### Example
\`\`\`json
POST /my-index/_search
{
  "query": { "match": { "message": "hello" } },
  "size": 10
}
\`\`\`

[Reference](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-search.html)
`;

export const DOCS_MIGRATION_8_TO_9 = `# Migration: Elasticsearch 8.x to 9.x

## Key changes
- **Breaking**: Removal of deprecated mapping and API options. Review deprecation warnings in 8.x.
- **Security**: Default security settings tightened; ensure TLS and API keys in production.
- **ES|QL**: Enhanced; prefer ES|QL for analytics where applicable.
- **Indexing**: Some legacy index options removed; reindex if using deprecated settings.

## Steps
1. Run the Elasticsearch 8.x migration assistant (Kibana or API).
2. Fix deprecations in your queries and mappings.
3. Test in a 9.x staging cluster before upgrading production.
4. Plan a reindex for indices using removed features.

[Migration Guide](https://www.elastic.co/guide/en/elasticsearch/reference/current/migrating-8.0.html)
`;

export const DOCS_ESQL = `# ES|QL (Elasticsearch Query Language)

## Syntax
\`\`\`
FROM index [| WHERE condition] [| EVAL expr] [| STATS ... BY key] [| SORT ...] [| LIMIT n]
\`\`\`

## Examples
- \`FROM logs | WHERE status == "error" | LIMIT 100\`
- \`FROM metrics | STATS avg(cpu) BY host\`
- \`FROM my-index | EVAL round(price * 1.1, 2) | SORT price DESC | LIMIT 10\`

Use POST /_query with body \`{ "query": "..." }\`. Returns columns and values.
`;

const cache = new Map<string, string>();

export function getCached(uri: string): string | undefined {
  return cache.get(uri);
}

export function setCached(uri: string, content: string): void {
  cache.set(uri, content);
}

export function getDocByPath(path: string): string | null {
  const normalized = path.replace(/^\/+/, '').toLowerCase();
  if (normalized === 'api/search' || normalized === 'api/search-api') return DOCS_API_SEARCH;
  if (normalized === 'migration/8-to-9' || normalized === 'migration/8x-9x') return DOCS_MIGRATION_8_TO_9;
  if (normalized === 'esql' || normalized === 'esql-guide') return DOCS_ESQL;
  return null;
}
