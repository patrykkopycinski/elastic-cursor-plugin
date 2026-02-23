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

export function registerCreateProjectApiKey(server: ToolRegistrationContext): void {
  server.registerTool(
    'create_project_api_key',
    {
      title: 'Create Project API Key',
      description:
        'Create a scoped API key for an Elasticsearch Serverless project with role-based permissions.',
      inputSchema: z.object({
        project_id: z.string().describe('Project ID'),
        name: z.string().describe('Key name'),
        expiration: z.string().optional().describe('Expiration (e.g. 7d, 30d)'),
        role_descriptors: z.record(z.unknown()).optional().describe('Role descriptors JSON'),
      }),
    },
    async (args) => {
      const auth = requireApiKey();
      if (!auth.ok) {
        return { content: [{ type: 'text', text: auth.message }], isError: true };
      }
      const { project_id, name, expiration, role_descriptors } = args as {
        project_id: string;
        name: string;
        expiration?: string;
        role_descriptors?: Record<string, unknown>;
      };
      const body: Record<string, unknown> = { name };
      if (expiration) body.expiration = expiration;
      if (role_descriptors) body.role_descriptors = role_descriptors;
      const result = await cloudFetch(
        `/api/v1/serverless/projects/elasticsearch/${encodeURIComponent(project_id)}/api-keys`,
        { method: 'POST', body }
      );
      if (!result.ok) {
        return { content: [{ type: 'text', text: result.error ?? 'Unknown error' }], isError: true };
      }
      const data = result.data as Record<string, unknown>;
      const key = data.key ?? data.encoded;
      const out = [
        'API key created. Store it securely; it may not be shown again.',
        `Name: ${name}`,
        key ? `Key (base64): ${key}` : JSON.stringify(data, null, 2),
      ];
      return { content: [{ type: 'text', text: out.join('\n') }] };
    }
  );
}
