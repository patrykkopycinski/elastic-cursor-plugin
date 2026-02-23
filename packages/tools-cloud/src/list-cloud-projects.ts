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
import { cloudFetch, requireApiKey } from './types.js';

export function registerListCloudProjects(server: ToolRegistrationContext): void {
  server.registerTool(
    'list_cloud_projects',
    {
      title: 'List Elastic Cloud Projects',
      description: 'List all Elasticsearch Serverless projects with status and endpoints.',
      inputSchema: z.object({}),
    },
    async () => {
      const auth = requireApiKey();
      if (!auth.ok) {
        return { content: [{ type: 'text', text: auth.message }], isError: true };
      }
      const result = await cloudFetch('/api/v1/serverless/projects/elasticsearch');
      if (!result.ok) {
        return { content: [{ type: 'text', text: result.error ?? 'Unknown error' }], isError: true };
      }
      const data = result.data as { projects?: Array<{ id?: string; name?: string; region_id?: string }> };
      const projects = data?.projects ?? [];
      if (projects.length === 0) {
        return { content: [{ type: 'text', text: 'No projects found.' }] };
      }
      const lines = projects.map(
        (p) => `${p.name ?? 'n/a'}\t id: ${p.id ?? 'n/a'}\t region: ${p.region_id ?? 'n/a'}`
      );
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );
}
