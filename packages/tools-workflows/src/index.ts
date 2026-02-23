/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ToolRegistrationContext } from './types.js';
import { registerListWorkflows } from './list-workflows.js';
import { registerRunWorkflow } from './run-workflow.js';
import { registerSaveWorkflow } from './save-workflow.js';

export type {
  ToolRegistrationContext,
  WorkflowDefinition,
  WorkflowVariable,
  WorkflowStep,
  WorkflowExecutionResult,
  StepResult,
  CreatedResource,
  ToolExecutor,
  WorkflowSummary,
} from './types.js';

export { parseWorkflow, loadWorkflowFile } from './parser.js';
export { executeWorkflow } from './executor.js';
export { listWorkflows, getWorkflow, saveWorkflow } from './registry.js';
export { builtInWorkflows } from './built-in-workflows.js';
export { workflowSchema } from './schema.js';

export function registerAll(server: ToolRegistrationContext): void {
  registerListWorkflows(server);
  registerRunWorkflow(server);
  registerSaveWorkflow(server);
}
