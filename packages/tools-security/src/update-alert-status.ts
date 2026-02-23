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
import { kibanaFetch } from './types.js';

export function registerUpdateAlertStatus(server: ToolRegistrationContext): void {
  server.registerTool(
    'update_alert_status',
    {
      title: 'Update Alert Status',
      description: 'Update security alert status (open, acknowledged, closed).',
      inputSchema: z.object({
        alert_ids: z.array(z.string()).describe('Alert IDs'),
        status: z.enum(['open', 'acknowledged', 'closed']).describe('New status'),
      }),
    },
    async (args) => {
      const { alert_ids, status } = args as { alert_ids: string[]; status: string };
      const result = await kibanaFetch('/api/detection_engine/signals/status', {
        method: 'POST',
        body: { signal_ids: alert_ids, status },
      });
      if (!result.ok) {
        return { content: [{ type: 'text', text: result.error ?? 'Failed' }], isError: true };
      }
      return {
        content: [{ type: 'text', text: `Updated ${alert_ids.length} alert(s) to ${status}.` }],
      };
    }
  );
}
