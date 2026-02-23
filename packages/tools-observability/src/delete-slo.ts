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
import { createSloApiClient, ok, fail, getKibanaUrl } from './slo-api-client.js';

const inputSchema = z.object({
  id: z.string().describe('SLO ID to delete'),
});

export function registerDeleteSlo(server: ToolRegistrationContext): void {
  server.registerTool(
    'delete_slo',
    {
      title: 'Delete SLO',
      description:
        'Delete a Service Level Objective by ID from Elastic Observability. ' +
        'This permanently removes the SLO and its associated data. ' +
        'Requires KIBANA_URL and auth.',
      inputSchema,
    },
    async (args) => {
      if (!getKibanaUrl()) {
        return fail('Set KIBANA_URL and auth (KIBANA_API_KEY or KIBANA_USERNAME/KIBANA_PASSWORD) to delete SLOs.');
      }

      const { id } = args as z.infer<typeof inputSchema>;
      const client = createSloApiClient();
      const result = await client.delete(id);

      if (!result.ok) {
        return fail(`Failed to delete SLO "${id}": ${result.error}`);
      }

      return ok(`SLO "${id}" deleted successfully.`);
    }
  );
}
