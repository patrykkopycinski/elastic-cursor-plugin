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

export function registerListSearchApplications(server: ToolRegistrationContext): void {
  server.registerTool(
    'list_search_applications',
    {
      title: 'List Search Applications',
      description: 'List search applications. Requires Kibana/Enterprise Search when using API.',
      inputSchema: z.object({}),
    },
    async () => {
      const kibana = process.env.KIBANA_URL;
      const text = kibana
        ? `Use Kibana → Enterprise Search → Search Applications to list applications. Or call GET ${kibana}/api/app/search_applications if the endpoint is available.`
        : 'Set KIBANA_URL and use Kibana → Enterprise Search → Search Applications to list applications.';
      return { content: [{ type: 'text', text }] };
    }
  );
}
