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
import { ok, fail, requireKibanaUrl, kibanaAsCodeFetch } from './dashboard-helpers.js';

const inputSchema = z.object({
  id: z.string().describe('Dashboard ID to delete'),
});

export function registerDeleteDashboard(server: ToolRegistrationContext): void {
  server.registerTool(
    'kibana_delete_dashboard',
    {
      title: 'Kibana: Delete Dashboard',
      description:
        'Delete a Kibana dashboard by ID using the as-code API. ' +
        'This permanently removes the dashboard. Lens visualizations referenced by the dashboard are NOT deleted. ' +
        'Requires KIBANA_URL and auth.',
      inputSchema,
    },
    async (args) => {
      if (!requireKibanaUrl()) {
        return fail('Set KIBANA_URL and auth to delete dashboards.');
      }

      const { id } = args as z.infer<typeof inputSchema>;
      const result = await kibanaAsCodeFetch(`/api/dashboards/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!result.ok) {
        return fail(`Failed to delete dashboard "${id}": ${result.error}`);
      }

      return ok(`Dashboard "${id}" deleted successfully.`);
    }
  );
}
