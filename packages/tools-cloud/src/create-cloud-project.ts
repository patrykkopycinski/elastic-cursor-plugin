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

export function registerCreateCloudProject(server: ToolRegistrationContext): void {
  server.registerTool(
    'create_cloud_project',
    {
      title: 'Create Elastic Cloud Project',
      description:
        'Create a new Elasticsearch Serverless project via Elastic Cloud API. Returns endpoints and credentials. Requires ELASTIC_CLOUD_API_KEY.',
      inputSchema: z.object({
        name: z.string().min(1).max(255).describe('Project name'),
        region_id: z.string().describe('Region ID (e.g. us-east-1, eu-west-1)'),
        optimized_for: z.enum(['general_purpose', 'vector']).optional().describe('Optimization: general_purpose or vector'),
      }),
    },
    async (args) => {
      const auth = requireApiKey();
      if (!auth.ok) {
        return { content: [{ type: 'text', text: auth.message }], isError: true };
      }
      const { name, region_id, optimized_for } = args as {
        name: string;
        region_id: string;
        optimized_for?: 'general_purpose' | 'vector';
      };
      const body: Record<string, unknown> = { name, region_id };
      if (optimized_for) body.optimized_for = optimized_for;
      const result = await cloudFetch('/api/v1/serverless/projects/elasticsearch', {
        method: 'POST',
        body,
      });
      if (!result.ok) {
        return { content: [{ type: 'text', text: result.error ?? 'Unknown error' }], isError: true };
      }
      const data = result.data as Record<string, unknown>;
      const out = [
        'Project created successfully.',
        `Name: ${data.name ?? name}`,
        `ID: ${data.id ?? 'n/a'}`,
        `Region: ${data.region_id ?? region_id}`,
        '',
        'Endpoints and credentials are in the API response. Use get_cloud_project or get_connection_config for connection details.',
        '',
        JSON.stringify(data, null, 2),
      ];
      return { content: [{ type: 'text', text: out.join('\n') }] };
    }
  );
}
