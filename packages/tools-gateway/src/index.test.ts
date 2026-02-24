/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { describe, it, expect } from 'vitest';
import type { ToolRegistrationContext } from '@elastic-cursor-plugin/shared-types';
import { registerAll } from './index.js';
import type { Client } from '@elastic/elasticsearch';

function createCaptureServer(): ToolRegistrationContext & { tools: Map<string, { name: string }> } {
  const tools = new Map<string, { name: string }>();
  return {
    tools,
    registerTool(name: string) {
      tools.set(name, { name });
    },
  };
}

describe('tools-gateway registerAll', () => {
  it('registers ES tools when esClient is provided', () => {
    const server = createCaptureServer();
    registerAll(server, { esClient: {} as Client, hasKibana: false, hasCloud: false });
    expect(server.tools.has('elasticsearch_api')).toBe(true);
    expect(server.tools.has('esql_query')).toBe(true);
    expect(server.tools.has('kibana_api')).toBe(false);
    expect(server.tools.has('cloud_api')).toBe(false);
  });

  it('registers all tools when all options enabled', () => {
    const server = createCaptureServer();
    registerAll(server, { esClient: {} as Client, hasKibana: true, hasCloud: true });
    expect(server.tools.size).toBe(4);
  });

  it('registers nothing when all options disabled', () => {
    const server = createCaptureServer();
    registerAll(server, { esClient: null, hasKibana: false, hasCloud: false });
    expect(server.tools.size).toBe(0);
  });
});
