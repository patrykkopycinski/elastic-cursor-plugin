/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { describe, it, expect } from 'vitest';
import { listWorkflows, getWorkflow } from '../src/registry.js';

describe('registry', () => {
  it('lists 4 built-in workflows', async () => {
    const workflows = await listWorkflows();
    expect(workflows).toHaveLength(4);
    expect(workflows.every((w) => w.source === 'built-in')).toBe(true);
  });

  it('gets a built-in workflow by name', async () => {
    const workflow = await getWorkflow('full-o11y-setup');
    expect(workflow).not.toBeNull();
    expect(workflow!.name).toBe('full-o11y-setup');
    expect(workflow!.steps.length).toBeGreaterThan(0);
    expect(workflow!.description).toBeDefined();
  });

  it('returns null for unknown workflow', async () => {
    const workflow = await getWorkflow('nonexistent');
    expect(workflow).toBeNull();
  });
});
