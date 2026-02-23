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

export function registerGetCloudProject(server: ToolRegistrationContext): void {
  server.registerTool(
    'get_cloud_project',
    {
      title: 'Get Elastic Cloud Project',
      description: 'Retrieve full project details by ID including endpoints and status.',
      inputSchema: z.object({
        project_id: z.string().describe('Project ID'),
      }),
    },
    async (args) => {
      const auth = requireApiKey();
      if (!auth.ok) {
        return { content: [{ type: 'text', text: auth.message }], isError: true };
      }
      const { project_id } = args as { project_id: string };
      const result = await cloudFetch(
        `/api/v1/serverless/projects/elasticsearch/${encodeURIComponent(project_id)}`
      );
      if (!result.ok) {
        return { content: [{ type: 'text', text: result.error ?? 'Unknown error' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
      };
    }
  );
}
