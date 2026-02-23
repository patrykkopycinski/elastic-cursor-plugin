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

function getKibanaUrl(): string | null {
  return process.env.KIBANA_URL ?? null;
}

export function registerListAlertRules(server: ToolRegistrationContext): void {
  server.registerTool(
    'list_alert_rules',
    {
      title: 'List Alert Rules',
      description: 'List observability alert rules. Requires KIBANA_URL and auth for API.',
      inputSchema: z.object({
        rule_type: z.string().optional().describe('Filter by rule type ID'),
      }),
    },
    async () => {
      const kibana = getKibanaUrl();
      if (!kibana) {
        return {
          content: [
            {
              type: 'text',
              text: 'Set KIBANA_URL (and KIBANA_API_KEY or auth) to list rules via API. Otherwise open Kibana → Stack Management → Rules.',
            },
          ],
        };
      }
      try {
        const apiKey = process.env.KIBANA_API_KEY ?? process.env.ES_API_KEY;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) headers.Authorization = `ApiKey ${apiKey}`;
        const res = await fetch(`${kibana.replace(/\/$/, '')}/api/alerting/rules/_find`, { headers });
        const data = await res.json();
        if (!res.ok) {
          return {
            content: [{ type: 'text', text: `Kibana API error: ${res.status} ${JSON.stringify(data)}` }],
            isError: true,
          };
        }
        const rules = (data.data ?? []) as Array<{ name?: string; rule_type_id?: string; enabled?: boolean }>;
        const lines = rules.map((r) => `${r.name}\t ${r.rule_type_id}\t enabled: ${r.enabled}`);
        return { content: [{ type: 'text', text: lines.length ? lines.join('\n') : 'No rules found.' }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text', text: msg }], isError: true };
      }
    }
  );
}
