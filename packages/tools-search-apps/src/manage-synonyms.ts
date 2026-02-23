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

export function registerManageSynonyms(server: ToolRegistrationContext): void {
  server.registerTool(
    'manage_synonyms',
    {
      title: 'Manage Synonyms',
      description: 'Create or update synonym sets for search. Returns synonym file content or API guidance.',
      inputSchema: z.object({
        action: z.enum(['create', 'update']).describe('Create or update'),
        synonym_set_id: z.string().optional(),
        synonyms: z.array(z.string()).describe('Lines of synonym rules (e.g. "foo, bar => baz")'),
      }),
    },
    async (args) => {
      const { action, synonym_set_id, synonyms } = args as {
        action: 'create' | 'update';
        synonym_set_id?: string;
        synonyms: string[];
      };
      const body = synonyms.join('\n');
      const text = [
        `${action === 'create' ? 'Create' : 'Update'} synonym set${synonym_set_id ? ` ${synonym_set_id}` : ''}:`,
        '--- Synonyms (one per line) ---',
        body,
        '---',
        'Use the Synonyms API (PUT /_synonyms/<set_id>) or Kibana → Enterprise Search → Synonyms to upload.',
      ].join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );
}
