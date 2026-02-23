/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';
import { workflowSchema } from './schema.js';
import type { WorkflowDefinition } from './types.js';

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(workflowSchema);

export function parseWorkflow(content: string, format: 'yaml' | 'json'): WorkflowDefinition {
  let parsed: unknown;

  try {
    parsed = format === 'yaml' ? parseYaml(content) : JSON.parse(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse workflow ${format.toUpperCase()}: ${message}`);
  }

  if (!validate(parsed)) {
    const errors = (validate.errors ?? [])
      .map((e) => `  - ${e.instancePath || '/'}: ${e.message}`)
      .join('\n');
    throw new Error(`Workflow validation failed:\n${errors}`);
  }

  return parsed as WorkflowDefinition;
}

export async function loadWorkflowFile(filePath: string): Promise<WorkflowDefinition> {
  const ext = extname(filePath).toLowerCase();
  let format: 'yaml' | 'json';

  if (ext === '.yaml' || ext === '.yml') {
    format = 'yaml';
  } else if (ext === '.json') {
    format = 'json';
  } else {
    throw new Error(
      `Unsupported workflow file extension "${ext}". Use .yaml, .yml, or .json`
    );
  }

  const content = await readFile(filePath, 'utf-8');
  return parseWorkflow(content, format);
}
