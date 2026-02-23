/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { describe, it, expect } from 'vitest';
import { registerAll } from '../src/index.js';
import { createCaptureServer, invokeTool } from './capture-server.js';

describe('registerAll', () => {
  it('registers list_workflows tool', () => {
    const server = createCaptureServer();
    registerAll(server);
    expect(server.tools.has('list_workflows')).toBe(true);
  });

  it('registers run_workflow tool', () => {
    const server = createCaptureServer();
    registerAll(server);
    expect(server.tools.has('run_workflow')).toBe(true);
  });

  it('registers save_workflow tool', () => {
    const server = createCaptureServer();
    registerAll(server);
    expect(server.tools.has('save_workflow')).toBe(true);
  });

  it('list_workflows returns built-in workflows', async () => {
    const server = createCaptureServer();
    registerAll(server);

    const result = await invokeTool(server, 'list_workflows', {});
    const text = result.content[0].text;

    expect(text).toContain('full-o11y-setup');
    expect(text).toContain('service-dashboard');
    expect(text).toContain('slo-from-apm');
    expect(text).toContain('infrastructure-overview');
  });

  it('run_workflow returns plan for built-in workflow', async () => {
    const server = createCaptureServer();
    registerAll(server);

    const result = await invokeTool(server, 'run_workflow', {
      name: 'service-dashboard',
      variables: { service_name: 'my-app' },
    });
    const text = result.content[0].text;

    expect(text).toContain('service-dashboard');
    expect(text).toContain('discover_o11y_data');
    expect(text).toContain('get_data_summary');
    expect(text).toContain('create_dashboard');
    expect(text).toContain('my-app');
  });
});
