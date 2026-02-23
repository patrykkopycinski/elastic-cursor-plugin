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
  id: z.string().describe('SLO ID to retrieve'),
});

export function registerGetSlo(server: ToolRegistrationContext): void {
  server.registerTool(
    'get_slo',
    {
      title: 'Get SLO',
      description:
        'Retrieve a specific SLO by ID from Elastic Observability. ' +
        'Returns the full SLO definition, current status, SLI value, and error budget. ' +
        'Requires KIBANA_URL and auth.',
      inputSchema,
    },
    async (args) => {
      if (!getKibanaUrl()) {
        return fail('Set KIBANA_URL and auth (KIBANA_API_KEY or KIBANA_USERNAME/KIBANA_PASSWORD) to get SLO details.');
      }

      const { id } = args as z.infer<typeof inputSchema>;
      const client = createSloApiClient();
      const result = await client.get(id);

      if (!result.ok) {
        return fail(`Failed to get SLO "${id}": ${result.error}`);
      }

      const slo = result.data as Record<string, unknown>;
      const summary = slo?.summary as Record<string, unknown> | undefined;
      const objective = slo?.objective as Record<string, unknown> | undefined;
      const indicator = slo?.indicator as Record<string, unknown> | undefined;
      const timeWindow = slo?.timeWindow as Record<string, unknown> | undefined;
      const errorBudget = summary?.errorBudget as Record<string, unknown> | undefined;

      const sliValue = typeof summary?.sliValue === 'number' ? `${(summary.sliValue as number * 100).toFixed(3)}%` : 'N/A';
      const target = typeof objective?.target === 'number' ? `${(objective.target as number * 100).toFixed(1)}%` : 'N/A';
      const budgetRemaining = typeof errorBudget?.remaining === 'number' ? `${(errorBudget.remaining as number * 100).toFixed(1)}%` : 'N/A';

      const lines = [
        `SLO: ${slo?.name ?? id}`,
        `ID: ${slo?.id ?? id}`,
        slo?.description ? `Description: ${slo.description}` : '',
        '',
        `Status: ${summary?.status ?? 'UNKNOWN'}`,
        `SLI Value: ${sliValue}`,
        `Target: ${target}`,
        `Error Budget Remaining: ${budgetRemaining}`,
        '',
        `Indicator Type: ${indicator?.type ?? 'N/A'}`,
        `Time Window: ${timeWindow?.duration ?? 'N/A'} (${timeWindow?.type ?? 'N/A'})`,
        slo?.tags ? `Tags: ${(slo.tags as string[]).join(', ')}` : '',
        '',
        'Full definition:',
        JSON.stringify(slo, null, 2),
      ];

      return ok(lines.filter((line) => line !== undefined).join('\n'));
    }
  );
}
