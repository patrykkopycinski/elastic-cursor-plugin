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

export function registerListSavedObjects(server: ToolRegistrationContext): void {
  server.registerTool(
    'kibana_list_saved_objects',
    {
      title: 'Kibana: List Saved Objects',
      description:
        'List Kibana saved objects by type (dashboard, visualization, search, index-pattern, map, lens, canvas-workpad, tag). Requires KIBANA_URL and auth.',
      inputSchema: z.object({
        type: z
          .enum([
            'dashboard',
            'visualization',
            'search',
            'index-pattern',
            'map',
            'lens',
            'canvas-workpad',
            'tag',
          ])
          .describe('Saved object type'),
        per_page: z.number().optional().default(20),
      }),
    },
    async (args) => {
      const base = getKibanaUrl();
      if (!base) {
        return {
          content: [{ type: 'text', text: 'Set KIBANA_URL and auth to list saved objects.' }],
          isError: true,
        };
      }
      const { type, per_page } = args as { type: string; per_page?: number };
      const result = await kibanaFetch(
        `/api/saved_objects/_find?type=${encodeURIComponent(type)}&per_page=${per_page ?? 20}&fields=title`
      );
      if (!result.ok) {
        return {
          content: [{ type: 'text', text: result.error ?? 'Failed to list saved objects.' }],
          isError: true,
        };
      }
      const data = result.data as { saved_objects?: Array<{ id?: string; type?: string; attributes?: { title?: string } }> };
      const objects = data?.saved_objects ?? [];
      if (objects.length === 0) {
        return {
          content: [{ type: 'text', text: `No saved objects of type "${type}" found.` }],
        };
      }
      const lines = objects.map(
        (o) => `${o.attributes?.title ?? o.id ?? 'n/a'}\t id: ${o.id}\t type: ${o.type}`
      );
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );
}
