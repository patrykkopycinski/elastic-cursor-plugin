/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Tests for registerDocsResources: resource registration and readCallback content.
 */
import { describe, it, expect } from 'vitest';
import { registerDocsResources } from '../src/index.js';
import type { ServerLike } from '../src/index.js';

function createCaptureServer(): ServerLike & {
  resources: Array<{ name: string; uri: string; title: string; readCallback: (uri: URL) => Promise<{ contents: unknown }> }>;
} {
  const resources: Array<{
    name: string;
    uri: string;
    title: string;
    readCallback: (uri: URL) => Promise<{ contents: unknown }>;
  }> = [];
  return {
    resources,
    registerResource(name, uri, config, readCallback) {
      resources.push({
        name,
        uri,
        title: (config as { title?: string }).title ?? '',
        readCallback: readCallback as (uri: URL) => Promise<{ contents: unknown }>,
      });
    },
  };
}

describe('registerDocsResources', () => {
  it('registers 3 resources with elastic://docs/ URIs', () => {
    const server = createCaptureServer();
    registerDocsResources(server);
    expect(server.resources).toHaveLength(3);
    expect(server.resources.map((r) => r.name)).toEqual([
      'docs-api-search',
      'docs-migration-8-9',
      'docs-esql',
    ]);
    expect(server.resources.every((r) => r.uri.startsWith('elastic://docs/'))).toBe(true);
  });

  it('readCallback returns markdown with mimeType for api/search', async () => {
    const server = createCaptureServer();
    registerDocsResources(server);
    const apiSearch = server.resources.find((r) => r.name === 'docs-api-search');
    expect(apiSearch).toBeDefined();
    const result = await apiSearch!.readCallback(new URL(apiSearch!.uri));
    expect(result.contents).toHaveLength(1);
    const content = (result.contents as Array<{ uri: string; mimeType?: string; text?: string }>)[0];
    expect(content.mimeType).toBe('text/markdown');
    expect(content.text).toContain('Elasticsearch Search API');
    expect(content.text).toContain('POST /<index>/_search');
  });

  it('readCallback for migration returns migration content', async () => {
    const server = createCaptureServer();
    registerDocsResources(server);
    const migration = server.resources.find((r) => r.name === 'docs-migration-8-9');
    expect(migration).toBeDefined();
    const result = await migration!.readCallback(new URL(migration!.uri));
    const text = (result.contents as Array<{ text?: string }>)[0].text;
    expect(text).toContain('Migration');
    expect(text).toContain('8.x');
  });

  it('readCallback for esql returns ES|QL content', async () => {
    const server = createCaptureServer();
    registerDocsResources(server);
    const esql = server.resources.find((r) => r.name === 'docs-esql');
    expect(esql).toBeDefined();
    const result = await esql!.readCallback(new URL(esql!.uri));
    const text = (result.contents as Array<{ text?: string }>)[0].text;
    expect(text).toContain('ES|QL');
    expect(text).toContain('FROM');
  });
});
