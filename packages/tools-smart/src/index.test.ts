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

function createCaptureServer(): ToolRegistrationContext & { tools: Map<string, { name: string }> } {
  const tools = new Map<string, { name: string }>();
  return {
    tools,
    registerTool(name: string) {
      tools.set(name, { name });
    },
  };
}

describe('tools-smart registerAll', () => {
  it('registers all 27 smart tools', () => {
    const server = createCaptureServer();
    registerAll(server);
    expect(server.tools.size).toBe(27);
    expect(server.tools.has('discover_o11y_data')).toBe(true);
    expect(server.tools.has('get_data_summary')).toBe(true);
    expect(server.tools.has('setup_apm')).toBe(true);
    expect(server.tools.has('siem_quickstart')).toBe(true);
    expect(server.tools.has('generate_search_ui')).toBe(true);
    expect(server.tools.has('get_deployment_guide')).toBe(true);
    expect(server.tools.has('get_connection_config')).toBe(true);
    expect(server.tools.has('kibana_info')).toBe(true);
    expect(server.tools.has('discover_data')).toBe(true);
    expect(server.tools.has('discover_security_data')).toBe(true);
    expect(server.tools.has('get_security_summary')).toBe(true);
    expect(server.tools.has('get_cluster_context')).toBe(true);
    expect(server.tools.has('refresh_cluster_knowledge')).toBe(true);
    expect(server.tools.has('clear_cluster_knowledge')).toBe(true);
  });
});
