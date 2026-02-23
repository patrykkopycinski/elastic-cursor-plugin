/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { z } from 'zod';
import type { ToolRegistrationContext } from './types.js';
import { createSloApiClient, ok, fail, getKibanaUrl } from './slo-api-client.js';

const inputSchema = z.object({
  name_filter: z.string().optional().describe('Filter SLOs by name (prefix match)'),
  page: z.number().optional().describe('Page number (1-based)'),
  per_page: z.number().optional().describe('Results per page (default 25)'),
});

interface SloSummary {
  status?: string;
  sliValue?: number;
  errorBudget?: { remaining?: number };
}

interface SloResult {
  id?: string;
  name?: string;
  tags?: string[];
  objective?: { target?: number };
  summary?: SloSummary;
  indicator?: { type?: string };
}

function formatSliValue(value: number | undefined): string {
  if (value === undefined || value === null) return 'N/A';
  return `${(value * 100).toFixed(3)}%`;
}

function formatTarget(target: number | undefined): string {
  if (target === undefined || target === null) return 'N/A';
  return `${(target * 100).toFixed(1)}%`;
}

function statusIcon(status: string | undefined): string {
  switch (status) {
    case 'HEALTHY':
      return '[OK]';
    case 'DEGRADING':
      return '[DEGRADING]';
    case 'VIOLATED':
      return '[VIOLATED]';
    case 'NO_DATA':
      return '[NO DATA]';
    default:
      return `[${status ?? 'UNKNOWN'}]`;
  }
}

export function registerListSlos(server: ToolRegistrationContext): void {
  server.registerTool(
    'list_slos',
    {
      title: 'List SLOs',
      description:
        'List Service Level Objectives (SLOs) in Elastic Observability. ' +
        'Returns name, ID, status, current SLI value, and target for each SLO. ' +
        'Optionally filter by name. Requires KIBANA_URL and auth.',
      inputSchema,
    },
    async (args) => {
      if (!getKibanaUrl()) {
        return fail('Set KIBANA_URL and auth (KIBANA_API_KEY or KIBANA_USERNAME/KIBANA_PASSWORD) to list SLOs.');
      }

      const input = args as z.infer<typeof inputSchema>;
      const client = createSloApiClient();
      const result = await client.list({
        name: input.name_filter,
        page: input.page,
        perPage: input.per_page,
      });

      if (!result.ok) {
        return fail(`Failed to list SLOs: ${result.error}`);
      }

      const data = result.data as { results?: SloResult[]; total?: number; page?: number; perPage?: number };
      const slos = data?.results ?? [];

      if (slos.length === 0) {
        return ok('No SLOs found. Create one with the create_slo tool or in Kibana → Observability → SLOs.');
      }

      const lines = slos.map((slo) => {
        const status = statusIcon(slo.summary?.status);
        const sliValue = formatSliValue(slo.summary?.sliValue);
        const target = formatTarget(slo.objective?.target);
        const remaining = slo.summary?.errorBudget?.remaining;
        const budget = remaining !== undefined ? `${(remaining * 100).toFixed(1)}% budget remaining` : '';
        return [
          `${status} ${slo.name ?? 'Unnamed'}`,
          `     ID: ${slo.id ?? 'N/A'}`,
          `     SLI: ${sliValue} / Target: ${target}${budget ? ` (${budget})` : ''}`,
          `     Type: ${slo.indicator?.type ?? 'N/A'}`,
          slo.tags?.length ? `     Tags: ${slo.tags.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      });

      const header = `SLOs (${data.total ?? slos.length} total, page ${data.page ?? 1})`;
      return ok([header, '', ...lines].join('\n'));
    }
  );
}
