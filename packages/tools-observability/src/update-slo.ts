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
  id: z.string().describe('SLO ID to update'),
  name: z.string().optional().describe('New SLO name'),
  description: z.string().optional().describe('New SLO description'),
  objective: z
    .object({
      target: z.number().min(0).max(100).describe('New target percentage (0-100)'),
    })
    .optional()
    .describe('Updated objective'),
  time_window: z
    .object({
      duration: z.string().describe('Window duration (e.g. "30d")'),
      type: z.enum(['rolling', 'calendarAligned']).describe('Window type'),
    })
    .optional()
    .describe('Updated time window'),
  tags: z.array(z.string()).optional().describe('Updated tags'),
});

export function registerUpdateSlo(server: ToolRegistrationContext): void {
  server.registerTool(
    'update_slo',
    {
      title: 'Update SLO',
      description:
        'Update an existing SLO in Elastic Observability. ' +
        'Provide the SLO ID and any fields to update (name, description, objective, time_window, tags). ' +
        'Requires KIBANA_URL and auth.',
      inputSchema,
    },
    async (args) => {
      if (!getKibanaUrl()) {
        return fail('Set KIBANA_URL and auth (KIBANA_API_KEY or KIBANA_USERNAME/KIBANA_PASSWORD) to update SLOs.');
      }

      const input = args as z.infer<typeof inputSchema>;
      const updates: Record<string, unknown> = {};

      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.tags !== undefined) updates.tags = input.tags;
      if (input.time_window !== undefined) {
        updates.timeWindow = {
          duration: input.time_window.duration,
          type: input.time_window.type,
        };
      }
      if (input.objective !== undefined) {
        updates.objective = { target: input.objective.target / 100 };
      }

      if (Object.keys(updates).length === 0) {
        return fail('No fields to update. Provide at least one of: name, description, objective, time_window, tags.');
      }

      const client = createSloApiClient();
      const result = await client.update(input.id, updates);

      if (!result.ok) {
        return fail(`Failed to update SLO "${input.id}": ${result.error}`);
      }

      const changed = Object.keys(updates).join(', ');
      return ok(`SLO "${input.id}" updated successfully. Changed fields: ${changed}`);
    }
  );
}
