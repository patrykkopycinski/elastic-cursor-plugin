/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Unit tests for tool registration. Integration tests against a real cluster can be added
 * when ES_URL and credentials are set (e.g. in CI with Elasticsearch Docker).
 */

import { describe, it, expect } from 'vitest';
import { registerAll } from '../src/index.js';
import type { ToolRegistrationContext } from '../src/types.js';

describe('registerAll', () => {
  it('registers no tools when client is null', () => {
    const registered: string[] = [];
    const server: ToolRegistrationContext = {
      registerTool(name) {
        registered.push(name);
      },
    };
    registerAll(server, null);
    expect(registered).toHaveLength(0);
  });

  it('registers 14 tools when client is provided', () => {
    const registered: string[] = [];
    const server: ToolRegistrationContext = {
      registerTool(name) {
        registered.push(name);
      },
    };
    const fakeClient = {} as import('@elastic/elasticsearch').Client;
    registerAll(server, fakeClient);
    expect(registered).toHaveLength(14);
    expect(registered).toContain('list_indices');
    expect(registered).toContain('create_index');
    expect(registered).toContain('search');
    expect(registered).toContain('esql_query');
    expect(registered).toContain('cluster_health');
    expect(registered).toContain('get_shards');
  });
});
