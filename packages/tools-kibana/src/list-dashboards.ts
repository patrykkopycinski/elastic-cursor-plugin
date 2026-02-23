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
import { kibanaFetch, getKibanaUrl } from './types.js';

export function registerListDashboards(server: ToolRegistrationContext): void {
  server.registerTool(
    'kibana_list_dashboards',
    {
      title: 'Kibana: List Dashboards',
      description:
        'List Kibana dashboards (saved dashboards). Requires KIBANA_URL and auth.',
      inputSchema: z.object({
        per_page: z.number().optional().default(20).describe('Max number to return'),
      }),
    },
    async (args) => {
      const base = getKibanaUrl();
      if (!base) {
        return {
          content: [{ type: 'text', text: 'Set KIBANA_URL and KIBANA_API_KEY (or ES_API_KEY) to list dashboards.' }],
          isError: true,
        };
      }
      const perPage = (args as { per_page?: number })?.per_page ?? 20;
      const result = await kibanaFetch(
        `/api/saved_objects/_find?type=dashboard&per_page=${perPage}&fields=title`
      );
      if (!result.ok) {
        return {
          content: [{ type: 'text', text: result.error ?? 'Failed to list dashboards.' }],
          isError: true,
        };
      }
      const data = result.data as { saved_objects?: Array<{ id?: string; attributes?: { title?: string } }> };
      const dashboards = data?.saved_objects ?? [];
      if (dashboards.length === 0) {
        return {
          content: [{ type: 'text', text: 'No dashboards found. Create one in Kibana → Dashboard → Create dashboard.' }],
        };
      }
      const lines = dashboards.map(
        (d) => `${d.attributes?.title ?? d.id ?? 'n/a'}\t id: ${d.id}`
      );
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );
}
