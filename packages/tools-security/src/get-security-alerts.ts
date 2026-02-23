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

export function registerGetSecurityAlerts(server: ToolRegistrationContext): void {
  server.registerTool(
    'get_security_alerts',
    {
      title: 'Get Security Alerts',
      description: 'Query security alerts by status, severity, and time range.',
      inputSchema: z.object({
        status: z.enum(['open', 'acknowledged', 'closed']).optional(),
        severity: z.string().optional(),
        from: z.string().optional().describe('ISO date or relative e.g. now-7d'),
        size: z.number().optional().default(20),
      }),
    },
    async (args) => {
      const { status, severity, from, size } = args as {
        status?: string;
        severity?: string;
        from?: string;
        size?: number;
      };
      const body: Record<string, unknown> = {
        size: size ?? 20,
        query: { bool: { filter: [] as unknown[] } },
      };
      if (status) (body.query as { bool: { filter: unknown[] } }).bool.filter.push({ term: { 'kibana.alert.workflow_status': status } });
      if (severity) (body.query as { bool: { filter: unknown[] } }).bool.filter.push({ term: { 'kibana.alert.severity': severity } });
      if (from) (body.query as { bool: { filter: unknown[] } }).bool.filter.push({ range: { '@timestamp': { gte: from } } });
      const result = await kibanaFetch('/api/detection_engine/signals/search', {
        method: 'POST',
        body,
      });
      if (!result.ok) {
        return { content: [{ type: 'text', text: result.error ?? 'Failed' }], isError: true };
      }
      const data = result.data as { hits?: { hits?: unknown[]; total?: number } };
      const hits = data?.hits?.hits ?? [];
      const total = typeof data?.hits?.total === 'object' ? (data.hits.total as { value?: number })?.value : data?.hits?.total;
      const text = `Total: ${total ?? 0}. First ${hits.length} alerts:\n${JSON.stringify(hits.slice(0, 5), null, 2)}`;
      return { content: [{ type: 'text', text }] };
    }
  );
}
