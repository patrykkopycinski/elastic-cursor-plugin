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

export function registerTestSearch(server: ToolRegistrationContext): void {
  server.registerTool(
    'test_search',
    {
      title: 'Test Search',
      description: 'Execute a test query and validate results. Use with the search tool and expected results.',
      inputSchema: z.object({
        index: z.string().describe('Index to query'),
        query_text: z.string().describe('Query string to test'),
        expected_min_hits: z.number().optional().describe('Minimum expected hits'),
      }),
    },
    async (args) => {
      const { index, query_text, expected_min_hits } = args as {
        index: string;
        query_text: string;
        expected_min_hits?: number;
      };
      const text = [
        `Test search: index="${index}", query="${query_text}"`,
        expected_min_hits != null ? `Expected at least ${expected_min_hits} hits.` : '',
        'Run the "search" tool with this index and a match/query_string query, then compare hit count and top results to expectations.',
      ].join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );
}
