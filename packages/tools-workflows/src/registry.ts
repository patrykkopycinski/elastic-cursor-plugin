/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { builtInWorkflows } from './built-in-workflows.js';
import { loadWorkflowFile } from './parser.js';
import type { WorkflowDefinition, WorkflowSummary } from './types.js';

function toSummary(
  def: WorkflowDefinition,
  source: 'built-in' | 'custom'
): WorkflowSummary {
  return {
    name: def.name,
    description: def.description,
    version: def.version,
    source,
    step_count: def.steps.length,
  };
}

async function loadCustomWorkflows(
  dir: string
): Promise<WorkflowDefinition[]> {
  try {
    const entries = await readdir(dir);
    const files = entries.filter((f) => /\.(ya?ml|json)$/.test(f));

    const results: WorkflowDefinition[] = [];
    for (const file of files) {
      try {
        results.push(await loadWorkflowFile(join(dir, file)));
      } catch {
        // Skip malformed custom workflow files
      }
    }
    return results;
  } catch {
    return [];
  }
}

export async function listWorkflows(
  customDir?: string
): Promise<WorkflowSummary[]> {
  const summaries: WorkflowSummary[] = builtInWorkflows.map((w) =>
    toSummary(w, 'built-in')
  );

  if (customDir) {
    const custom = await loadCustomWorkflows(customDir);
    for (const w of custom) {
      summaries.push(toSummary(w, 'custom'));
    }
  }

  return summaries;
}

export async function getWorkflow(
  name: string,
  customDir?: string
): Promise<WorkflowDefinition | null> {
  const builtIn = builtInWorkflows.find((w) => w.name === name);
  if (builtIn) return builtIn;

  if (customDir) {
    const custom = await loadCustomWorkflows(customDir);
    return custom.find((w) => w.name === name) ?? null;
  }

  return null;
}

export async function saveWorkflow(
  name: string,
  definition: WorkflowDefinition,
  customDir: string
): Promise<void> {
  await mkdir(customDir, { recursive: true });
  const filePath = join(customDir, `${name}.yaml`);
  const content = stringifyYaml(definition, { lineWidth: 120 });
  await writeFile(filePath, content, 'utf-8');
}
