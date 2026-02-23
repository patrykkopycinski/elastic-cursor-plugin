/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { randomUUID } from 'node:crypto';
import type {
  WorkflowDefinition,
  WorkflowExecutionResult,
  StepResult,
  CreatedResource,
  ToolExecutor,
} from './types.js';

/**
 * Resolve a dotted path like "steps.discover.output.services.length" against a context object.
 */
function resolvePath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Substitute `${…}` placeholders within a value, walking objects and arrays recursively.
 */
function substituteVariables(
  value: unknown,
  context: Record<string, unknown>
): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([^}]+)}/g, (_match, expr: string) => {
      const resolved = resolvePath(context, expr.trim());
      return resolved === undefined ? '' : String(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => substituteVariables(item, context));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = substituteVariables(v, context);
    }
    return result;
  }

  return value;
}

/**
 * Evaluate a simple condition expression against the execution context.
 * Supports: dotted paths, comparisons (>, <, >=, <=, ==, !=), `.length`, boolean truthiness.
 */
function evaluateCondition(expression: string, context: Record<string, unknown>): boolean {
  const operators = ['>=', '<=', '!=', '==', '>', '<'] as const;

  for (const op of operators) {
    const idx = expression.indexOf(op);
    if (idx === -1) continue;

    const leftExpr = expression.slice(0, idx).trim();
    const rightExpr = expression.slice(idx + op.length).trim();

    const left = resolvePath(context, leftExpr) ?? Number(leftExpr);
    const right = resolvePath(context, rightExpr) ?? (isNaN(Number(rightExpr)) ? rightExpr : Number(rightExpr));

    const l = typeof left === 'number' ? left : Number(left);
    const r = typeof right === 'number' ? right : Number(right);

    switch (op) {
      case '>':  return l > r;
      case '<':  return l < r;
      case '>=': return l >= r;
      case '<=': return l <= r;
      case '==': return String(left) === String(right);
      case '!=': return String(left) !== String(right);
    }
  }

  const resolved = resolvePath(context, expression.trim());
  return Boolean(resolved);
}

const URL_PATTERN = /https?:\/\/[^\s)>"]+/g;

function extractResources(text: string): CreatedResource[] {
  const resources: CreatedResource[] = [];
  const urls = text.match(URL_PATTERN) ?? [];

  for (const url of urls) {
    let type: CreatedResource['type'] = 'other';
    if (url.includes('/dashboard')) type = 'dashboard';
    else if (url.includes('/slo')) type = 'slo';
    else if (url.includes('/alert') || url.includes('/rule')) type = 'alert_rule';

    resources.push({
      type,
      id: url.split('/').pop() ?? randomUUID(),
      name: `${type} resource`,
      url,
    });
  }

  return resources;
}

export async function executeWorkflow(
  definition: WorkflowDefinition,
  variables: Record<string, unknown>,
  toolExecutor: ToolExecutor
): Promise<WorkflowExecutionResult> {
  const executionId = randomUUID();
  const startedAt = new Date();
  const stepResults: StepResult[] = [];
  const allResources: CreatedResource[] = [];
  let overallStatus: WorkflowExecutionResult['status'] = 'success';

  const context: Record<string, unknown> = {
    variables: { ...variables },
    steps: {},
  };

  // Apply variable defaults where user didn't supply a value
  if (definition.variables) {
    for (const [key, def] of Object.entries(definition.variables)) {
      if ((context.variables as Record<string, unknown>)[key] === undefined && def.default !== undefined) {
        (context.variables as Record<string, unknown>)[key] = def.default;
      }
    }
  }

  for (const step of definition.steps) {
    const stepStart = new Date();

    // Condition check
    if (step.condition && !evaluateCondition(step.condition, context)) {
      stepResults.push({
        id: step.id,
        name: step.name,
        tool: step.tool,
        status: 'skipped',
        started_at: stepStart.toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - stepStart.getTime(),
        output_summary: `Skipped: condition "${step.condition}" was false`,
      });
      continue;
    }

    const resolvedParams = substituteVariables(step.parameters, context) as Record<string, unknown>;

    try {
      const result = await toolExecutor(step.tool, resolvedParams);
      const stepEnd = new Date();
      const outputText = result.content.map((c) => c.text).join('\n');

      if (result.isError) {
        throw new Error(outputText);
      }

      // Store step output in context for downstream steps
      (context.steps as Record<string, unknown>)[step.id] = {
        output: tryParseJson(outputText),
        raw: outputText,
      };

      // Apply output mapping
      if (step.output_mapping) {
        const stepEntry = (context.steps as Record<string, Record<string, unknown>>)[step.id];
        const stepOutput = stepEntry?.output;
        for (const [varName, outputPath] of Object.entries(step.output_mapping)) {
          (context.variables as Record<string, unknown>)[varName] = resolvePath(
            stepOutput,
            outputPath
          );
        }
      }

      const resources = extractResources(outputText);
      allResources.push(...resources);

      stepResults.push({
        id: step.id,
        name: step.name,
        tool: step.tool,
        status: 'success',
        started_at: stepStart.toISOString(),
        completed_at: stepEnd.toISOString(),
        duration_ms: stepEnd.getTime() - stepStart.getTime(),
        output_summary: outputText.slice(0, 500),
      });
    } catch (err) {
      const stepEnd = new Date();
      const message = err instanceof Error ? err.message : String(err);
      const onError = step.on_error ?? 'stop';

      stepResults.push({
        id: step.id,
        name: step.name,
        tool: step.tool,
        status: 'failed',
        started_at: stepStart.toISOString(),
        completed_at: stepEnd.toISOString(),
        duration_ms: stepEnd.getTime() - stepStart.getTime(),
        error: message,
      });

      if (onError === 'stop') {
        overallStatus = 'failed';
        break;
      }

      overallStatus = 'partial';
    }
  }

  const completedAt = new Date();
  return {
    workflow_name: definition.name,
    execution_id: executionId,
    status: overallStatus,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    duration_ms: completedAt.getTime() - startedAt.getTime(),
    steps: stepResults,
    created_resources: allResources,
  };
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
