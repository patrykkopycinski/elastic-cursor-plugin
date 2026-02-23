/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Registration and basic behavior tests for Search Apps tools.
 */
import { describe, it, expect } from 'vitest';
import { registerAll } from '../src/index.js';
import type { ToolRegistrationContext } from '../src/types.js';

function createCaptureServer(): ToolRegistrationContext & { tools: Map<string, unknown> } {
  const tools = new Map<string, unknown>();
  return {
    tools,
    registerTool(name: string) {
      tools.set(name, { name });
    },
  };
}

describe('tools-search-apps', () => {
  it('registers 5 tools', () => {
    const server = createCaptureServer();
    registerAll(server);
    expect(server.tools.size).toBe(5);
    expect(server.tools.has('create_search_application')).toBe(true);
    expect(server.tools.has('list_search_applications')).toBe(true);
    expect(server.tools.has('manage_synonyms')).toBe(true);
    expect(server.tools.has('test_search')).toBe(true);
    expect(server.tools.has('generate_search_ui')).toBe(true);
  });
});
