/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export type { ToolRegistrationContext } from '@elastic-cursor-plugin/shared-types';

export interface WorkflowDefinition {
  name: string;
  description: string;
  version?: string;
  variables?: Record<string, WorkflowVariable>;
  steps: WorkflowStep[];
}

export interface WorkflowVariable {
  description: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  default?: unknown;
  required?: boolean;
}

export interface WorkflowStep {
  id: string;
  name: string;
  tool: string;
  parameters: Record<string, unknown>;
  condition?: string;
  output_mapping?: Record<string, string>;
  on_error?: 'stop' | 'skip' | 'continue';
}

export interface WorkflowExecutionResult {
  workflow_name: string;
  execution_id: string;
  status: 'success' | 'partial' | 'failed';
  started_at: string;
  completed_at: string;
  duration_ms: number;
  steps: StepResult[];
  created_resources: CreatedResource[];
}

export interface StepResult {
  id: string;
  name: string;
  tool: string;
  status: 'success' | 'failed' | 'skipped';
  started_at: string;
  completed_at: string;
  duration_ms: number;
  output_summary?: string;
  error?: string;
}

export interface CreatedResource {
  type: 'dashboard' | 'slo' | 'alert_rule' | 'other';
  id: string;
  name: string;
  url?: string;
}

export type ToolExecutor = (
  toolName: string,
  params: Record<string, unknown>
) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>;

export interface WorkflowSummary {
  name: string;
  description: string;
  version?: string;
  source: 'built-in' | 'custom';
  step_count: number;
}
