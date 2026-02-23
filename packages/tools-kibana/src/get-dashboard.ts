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
  id: z.string().describe('Dashboard ID to retrieve'),
});

export function registerGetDashboard(server: ToolRegistrationContext): void {
  server.registerTool(
    'kibana_get_dashboard',
    {
      title: 'Kibana: Get Dashboard',
      description:
        'Retrieve a Kibana dashboard definition by ID in as-code format. ' +
        'Returns the full dashboard definition including panels, time range, and metadata. ' +
        'Useful for inspecting existing dashboards, copying between spaces, or round-tripping edits. ' +
        'Requires KIBANA_URL and auth.',
      inputSchema,
    },
    async (args) => {
      if (!requireKibanaUrl()) {
        return fail('Set KIBANA_URL and auth to get dashboards.');
      }

      const { id } = args as z.infer<typeof inputSchema>;
      const result = await kibanaAsCodeFetch(`/api/dashboards/${encodeURIComponent(id)}`);

      if (!result.ok) {
        return fail(`Failed to get dashboard "${id}": ${result.error}`);
      }

      const data = result.data as {
        id?: string;
        data?: Record<string, unknown>;
        meta?: Record<string, unknown>;
        spaces?: string[];
      };

      const url = dashboardUrl(data?.id ?? id);
      const output: Record<string, unknown> = {};
      if (data?.id) output.id = data.id;
      if (data?.data) output.data = data.data;
      if (data?.spaces) output.spaces = data.spaces;
      if (data?.meta) output.meta = data.meta;

      return ok(
        [
          `Dashboard: ${(data?.data as Record<string, unknown>)?.title ?? id}`,
          url ? `URL: ${url}` : '',
          '',
          JSON.stringify(output, null, 2),
        ]
          .filter((line) => line !== undefined)
          .join('\n')
      );
    }
  );
}
