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
import { ok, fail, requireKibanaUrl, dashboardUrl, kibanaAsCodeFetch } from './dashboard-helpers.js';

const inputSchema = z.object({
  id: z.string().describe('Dashboard ID to update'),
  title: z.string().optional().describe('New dashboard title'),
  description: z.string().optional().describe('New dashboard description'),
  panels: z.array(z.record(z.unknown())).optional().describe('Replacement panels array (full replace, not merge)'),
  time_from: z.string().optional().describe('New time range start'),
  time_to: z.string().optional().describe('New time range end'),
});

export function registerUpdateDashboard(server: ToolRegistrationContext): void {
  server.registerTool(
    'kibana_update_dashboard',
    {
      title: 'Kibana: Update Dashboard',
      description:
        'Update an existing Kibana dashboard by ID using the as-code API. ' +
        'Performs a full replacement of the dashboard state. ' +
        'Tip: use kibana_get_dashboard first to fetch the current definition, modify it, then pass it here. ' +
        'Do NOT include "id" or "spaces" in the data body — they are set from the id parameter. ' +
        'Requires KIBANA_URL and auth.',
      inputSchema,
    },
    async (args) => {
      if (!requireKibanaUrl()) {
        return fail('Set KIBANA_URL and auth to update dashboards.');
      }

      const { id, title, description, panels, time_from, time_to } = args as z.infer<typeof inputSchema>;

      const current = await kibanaAsCodeFetch(`/api/dashboards/${encodeURIComponent(id)}`);
      if (!current.ok) {
        return fail(`Dashboard "${id}" not found: ${current.error}`);
      }

      const existing = (current.data as { data?: Record<string, unknown> })?.data ?? {};
      const merged: Record<string, unknown> = { ...existing };
      if (title !== undefined) merged.title = title;
      if (description !== undefined) merged.description = description;
      if (panels !== undefined) merged.panels = panels;
      if (time_from !== undefined || time_to !== undefined) {
        const existingRange = (existing.time_range as Record<string, string>) ?? {};
        merged.time_range = {
          from: time_from ?? existingRange.from ?? 'now-24h',
          to: time_to ?? existingRange.to ?? 'now',
        };
      }

      const result = await kibanaAsCodeFetch(`/api/dashboards/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: { data: merged },
      });

      if (!result.ok) {
        return fail(`Failed to update dashboard "${id}": ${result.error}`);
      }

      const data = result.data as { id?: string; data?: { title?: string } };
      const url = dashboardUrl(data?.id ?? id);

      return ok(
        [
          `Dashboard updated successfully.`,
          `ID: ${data?.id ?? id}`,
          `Title: ${data?.data?.title ?? title ?? 'unchanged'}`,
          url ? `URL: ${url}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      );
    }
  );
}
