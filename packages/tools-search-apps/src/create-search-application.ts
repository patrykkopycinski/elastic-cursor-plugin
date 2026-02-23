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

export function registerCreateSearchApplication(server: ToolRegistrationContext): void {
  server.registerTool(
    'create_search_application',
    {
      title: 'Create Search Application',
      description: 'Generate configuration for an Elastic Search Application (indices and template).',
      inputSchema: z.object({
        name: z.string().describe('Application name'),
        indices: z.array(z.string()).describe('Index patterns'),
        default_search_field: z.string().optional(),
      }),
    },
    async (args) => {
      const { name, indices, default_search_field } = args as {
        name: string;
        indices: string[];
        default_search_field?: string;
      };
      const text = [
        `Search Application: ${name}`,
        `Indices: ${indices.join(', ')}`,
        default_search_field ? `Default search field: ${default_search_field}` : '',
        'Create in Kibana: Enterprise Search → Search Applications → Create. Or use the Search Applications API if available in your Elastic version.',
      ].join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );
}
