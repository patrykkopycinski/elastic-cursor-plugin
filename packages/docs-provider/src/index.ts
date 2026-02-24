/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { getDocByPath, getCached, setCached } from './content.js';

const DOCS_URI_PREFIX = 'elastic://docs/';

export type ServerLike = {
  registerResource(
    name: string,
    uri: string,
    config: { title?: string },
    readCallback: (uri: URL) => Promise<{ contents: Array<{ uri: string; mimeType?: string; text?: string }> }>
  ): unknown;
};

export function registerDocsResources(server: ServerLike): void {
  const resources: Array<{ name: string; uri: string; title: string }> = [
    { name: 'docs-api-search', uri: `${DOCS_URI_PREFIX}api/search`, title: 'Search API' },
    { name: 'docs-migration-8-9', uri: `${DOCS_URI_PREFIX}migration/8-to-9`, title: 'Migration 8.x to 9.x' },
    { name: 'docs-esql', uri: `${DOCS_URI_PREFIX}esql`, title: 'ES|QL Guide' },
    { name: 'docs-api-elasticsearch', uri: `${DOCS_URI_PREFIX}api/elasticsearch`, title: 'Elasticsearch REST API Reference' },
    { name: 'docs-api-kibana', uri: `${DOCS_URI_PREFIX}api/kibana`, title: 'Kibana REST API Reference' },
    { name: 'docs-api-cloud', uri: `${DOCS_URI_PREFIX}api/cloud`, title: 'Elastic Cloud API Reference' },
  ];

  for (const r of resources) {
    server.registerResource(
      r.name,
      r.uri,
      { title: r.title },
      async (uri: URL) => {
        const path = uri.pathname.replace(/^\/+/, '').replace(/^docs\/?/, '');
        const cached = getCached(uri.toString());
        if (cached) {
          return { contents: [{ uri: uri.toString(), mimeType: 'text/markdown', text: cached }] };
        }
        const content = getDocByPath(path || 'api/search');
        const text = content ?? `# Doc not found\nPath: ${path}\n\nAvailable: api/search, api/elasticsearch, api/kibana, api/cloud, migration/8-to-9, esql`;
        setCached(uri.toString(), text);
        return { contents: [{ uri: uri.toString(), mimeType: 'text/markdown', text }] };
      }
    );
  }
}
