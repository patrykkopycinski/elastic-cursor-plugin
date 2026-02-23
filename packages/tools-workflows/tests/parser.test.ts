/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { describe, it, expect } from 'vitest';
import { parseWorkflow } from '../src/parser.js';
import { workflowSchema } from '../src/schema.js';

describe('parseWorkflow', () => {
  const validYaml = `
name: test-workflow
description: A test workflow
steps:
  - id: step_one
    name: First step
    tool: some_tool
    parameters:
      foo: bar
`;

  const validJson = JSON.stringify({
    name: 'test-workflow',
    description: 'A test workflow',
    steps: [
      {
        id: 'step_one',
        name: 'First step',
        tool: 'some_tool',
        parameters: { foo: 'bar' },
      },
    ],
  });

  it('parses valid YAML workflow', () => {
    const result = parseWorkflow(validYaml, 'yaml');
    expect(result.name).toBe('test-workflow');
    expect(result.description).toBe('A test workflow');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].id).toBe('step_one');
    expect(result.steps[0].tool).toBe('some_tool');
    expect(result.steps[0].parameters).toEqual({ foo: 'bar' });
  });

  it('parses valid JSON workflow', () => {
    const result = parseWorkflow(validJson, 'json');
    expect(result.name).toBe('test-workflow');
    expect(result.description).toBe('A test workflow');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].id).toBe('step_one');
  });

  it('rejects invalid schema (missing name)', () => {
    const yaml = `
description: No name here
steps:
  - id: step_one
    name: First step
    tool: some_tool
    parameters: {}
`;
    expect(() => parseWorkflow(yaml, 'yaml')).toThrow('Workflow validation failed');
  });

  it('rejects workflow with no steps', () => {
    const yaml = `
name: empty-workflow
description: Has no steps
steps: []
`;
    expect(() => parseWorkflow(yaml, 'yaml')).toThrow('Workflow validation failed');
  });

  it('parses variables with description and type', () => {
    const yaml = `
name: var-workflow
description: Workflow with variables
variables:
  service_name:
    description: The service name
    type: string
    required: true
  target:
    description: SLO target
    type: number
    default: 99.9
steps:
  - id: step_one
    name: First step
    tool: some_tool
    parameters: {}
`;
    const result = parseWorkflow(yaml, 'yaml');
    expect(result.variables).toBeDefined();
    expect(result.variables!.service_name.description).toBe('The service name');
    expect(result.variables!.service_name.type).toBe('string');
    expect(result.variables!.target.description).toBe('SLO target');
    expect(result.variables!.target.type).toBe('number');
    expect(result.variables!.target.default).toBe(99.9);
  });

  it('parses conditions on steps', () => {
    const yaml = `
name: cond-workflow
description: Workflow with conditions
steps:
  - id: step_one
    name: Conditional step
    tool: some_tool
    parameters: {}
    condition: steps.prev.output.ready == true
`;
    const result = parseWorkflow(yaml, 'yaml');
    expect(result.steps[0].condition).toBe('steps.prev.output.ready == true');
  });

  it('parses output_mapping on steps', () => {
    const yaml = `
name: mapping-workflow
description: Workflow with output mapping
steps:
  - id: step_one
    name: Mapped step
    tool: some_tool
    parameters: {}
    output_mapping:
      service: primary_service
      count: total_count
`;
    const result = parseWorkflow(yaml, 'yaml');
    expect(result.steps[0].output_mapping).toEqual({
      service: 'primary_service',
      count: 'total_count',
    });
  });
});
