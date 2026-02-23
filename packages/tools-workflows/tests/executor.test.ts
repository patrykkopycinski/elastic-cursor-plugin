/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { describe, it, expect, vi } from 'vitest';
import { executeWorkflow } from '../src/executor.js';
import type { WorkflowDefinition, ToolExecutor } from '../src/types.js';

const mockToolExecutor: ToolExecutor = vi.fn(
  async (toolName: string, params: Record<string, unknown>) => ({
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ tool: toolName, result: 'ok', ...params }),
      },
    ],
  })
);

const simpleWorkflow: WorkflowDefinition = {
  name: 'test-workflow',
  description: 'A simple test workflow',
  steps: [
    {
      id: 'step_one',
      name: 'First step',
      tool: 'tool_a',
      parameters: { key: 'value' },
    },
    {
      id: 'step_two',
      name: 'Second step',
      tool: 'tool_b',
      parameters: { key: 'other' },
    },
  ],
};

describe('executeWorkflow', () => {
  it('executes simple workflow with all steps', async () => {
    const executor = vi.fn(mockToolExecutor);
    const result = await executeWorkflow(simpleWorkflow, {}, executor);

    expect(executor).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('success');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe('success');
    expect(result.steps[1].status).toBe('success');
  });

  it('passes variables to step parameters', async () => {
    const workflow: WorkflowDefinition = {
      name: 'var-workflow',
      description: 'Workflow with variables',
      variables: {
        service_name: { description: 'Service', type: 'string' },
      },
      steps: [
        {
          id: 'step_one',
          name: 'Use variable',
          tool: 'tool_a',
          parameters: { service: '${variables.service_name}' },
        },
      ],
    };
    const executor = vi.fn(mockToolExecutor);
    await executeWorkflow(workflow, { service_name: 'my-api' }, executor);

    expect(executor).toHaveBeenCalledWith('tool_a', { service: 'my-api' });
  });

  it('makes step output available to next step via substitution', async () => {
    const workflow: WorkflowDefinition = {
      name: 'chain-workflow',
      description: 'Chain outputs',
      steps: [
        {
          id: 'step_one',
          name: 'Produce output',
          tool: 'tool_a',
          parameters: {},
        },
        {
          id: 'step_two',
          name: 'Consume output',
          tool: 'tool_b',
          parameters: { prev_tool: '${steps.step_one.output.tool}' },
        },
      ],
    };
    const executor = vi.fn(mockToolExecutor);
    await executeWorkflow(workflow, {}, executor);

    expect(executor).toHaveBeenCalledTimes(2);
    const secondCallParams = executor.mock.calls[1][1];
    expect(secondCallParams.prev_tool).toBe('tool_a');
  });

  it('skips step when condition evaluates to false', async () => {
    const workflow: WorkflowDefinition = {
      name: 'cond-workflow',
      description: 'Conditional',
      steps: [
        {
          id: 'step_one',
          name: 'Always runs',
          tool: 'tool_a',
          parameters: {},
        },
        {
          id: 'step_two',
          name: 'Skipped step',
          tool: 'tool_b',
          parameters: {},
          condition: 'variables.should_run',
        },
      ],
    };
    const executor = vi.fn(mockToolExecutor);
    const result = await executeWorkflow(workflow, {}, executor);

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.steps[1].status).toBe('skipped');
  });

  it('stops execution on failure by default', async () => {
    const failingExecutor: ToolExecutor = vi.fn(async (toolName: string) => {
      if (toolName === 'tool_a') {
        return {
          content: [{ type: 'text' as const, text: 'error happened' }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: 'ok' }],
      };
    });

    const workflow: WorkflowDefinition = {
      name: 'fail-workflow',
      description: 'Fails on first step',
      steps: [
        {
          id: 'step_one',
          name: 'Failing step',
          tool: 'tool_a',
          parameters: {},
        },
        {
          id: 'step_two',
          name: 'Should not run',
          tool: 'tool_b',
          parameters: {},
        },
      ],
    };
    const result = await executeWorkflow(workflow, {}, failingExecutor);

    expect(result.status).toBe('failed');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].status).toBe('failed');
    expect(failingExecutor).toHaveBeenCalledTimes(1);
  });

  it('continues past failed step with on_error skip', async () => {
    const failingExecutor: ToolExecutor = vi.fn(async (toolName: string) => {
      if (toolName === 'tool_a') {
        return {
          content: [{ type: 'text' as const, text: 'error happened' }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ result: 'ok' }) }],
      };
    });

    const workflow: WorkflowDefinition = {
      name: 'skip-error-workflow',
      description: 'Skip on error',
      steps: [
        {
          id: 'step_one',
          name: 'Failing step',
          tool: 'tool_a',
          parameters: {},
          on_error: 'skip',
        },
        {
          id: 'step_two',
          name: 'Should still run',
          tool: 'tool_b',
          parameters: {},
        },
      ],
    };
    const result = await executeWorkflow(workflow, {}, failingExecutor);

    expect(failingExecutor).toHaveBeenCalledTimes(2);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe('failed');
    expect(result.steps[1].status).toBe('success');
    expect(result.status).toBe('partial');
  });

  it('produces audit trail with timestamps and durations', async () => {
    const executor = vi.fn(mockToolExecutor);
    const result = await executeWorkflow(simpleWorkflow, {}, executor);

    for (const step of result.steps) {
      expect(step.started_at).toBeDefined();
      expect(step.completed_at).toBeDefined();
      expect(typeof step.duration_ms).toBe('number');
      expect(step.duration_ms).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns result with correct structure', async () => {
    const executor = vi.fn(mockToolExecutor);
    const result = await executeWorkflow(simpleWorkflow, {}, executor);

    expect(result.workflow_name).toBe('test-workflow');
    expect(result.execution_id).toBeDefined();
    expect(typeof result.execution_id).toBe('string');
    expect(['success', 'partial', 'failed']).toContain(result.status);
    expect(result.started_at).toBeDefined();
    expect(result.completed_at).toBeDefined();
    expect(typeof result.duration_ms).toBe('number');
    expect(Array.isArray(result.steps)).toBe(true);
    expect(Array.isArray(result.created_resources)).toBe(true);
  });
});
