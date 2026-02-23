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

export function registerListDataViews(server: ToolRegistrationContext): void {
  server.registerTool(
    'kibana_list_data_views',
    {
      title: 'Kibana: List Data Views',
      description:
        'List Kibana data views (index patterns). Requires KIBANA_URL and KIBANA_API_KEY (or ES_API_KEY).',
      inputSchema: z.object({}),
    },
    async () => {
      const base = getKibanaUrl();
      if (!base) {
        return {
          content: [{ type: 'text', text: 'Set KIBANA_URL and KIBANA_API_KEY (or ES_API_KEY) to list data views.' }],
          isError: true,
        };
      }
      const result = await kibanaFetch('/api/data_views');
      if (!result.ok) {
        return {
          content: [{ type: 'text', text: result.error ?? 'Failed to list data views.' }],
          isError: true,
        };
      }
      const data = result.data as { data_view?: Array<{ id?: string; title?: string; name?: string }> };
      const views = data?.data_view ?? (Array.isArray(result.data) ? result.data : []);
      if (!Array.isArray(views) || views.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No data views found. Create one in Kibana → Stack Management → Data Views, or use Discover.',
            },
          ],
        };
      }
      const lines = views.map(
        (v: { id?: string; title?: string; name?: string }) =>
          `${v.title ?? v.name ?? v.id ?? 'n/a'}\t id: ${v.id ?? 'n/a'}`
      );
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );
}
