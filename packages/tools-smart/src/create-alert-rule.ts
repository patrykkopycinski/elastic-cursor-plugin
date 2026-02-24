/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { z } from 'zod';
import type { ToolRegistrationContext } from '@elastic-cursor-plugin/shared-types';

export function registerCreateAlertRule(server: ToolRegistrationContext): void {
  server.registerTool(
    'create_alert_rule',
    {
      title: 'Create Alert Rule',
      description:
        'Generate or create a threshold or anomaly alert rule. Requires Kibana URL and auth when creating via API.',
      inputSchema: z.object({
        name: z.string().describe('Rule name'),
        rule_type: z.enum(['threshold', 'anomaly']).describe('Threshold or anomaly'),
        index: z.string().optional().describe('Index pattern for the rule'),
        condition: z.string().optional().describe('Condition description or query'),
        actions: z.array(z.string()).optional().describe('Action IDs or webhook URLs'),
      }),
    },
    async (args) => {
      const { name, rule_type, index, condition } = args as {
        name: string;
        rule_type: 'threshold' | 'anomaly';
        index?: string;
        condition?: string;
      };
      const kibana = process.env.KIBANA_URL ?? null;
      const body = {
        name,
        rule_type_id: rule_type === 'threshold' ? 'example.threshold' : 'apm.anomaly',
        params: {
          index: index ?? 'metrics-*',
          threshold: condition ?? 'above 1000',
        },
      };
      const text =
        kibana
          ? `To create this rule via Kibana API, POST to ${kibana}/api/alerting/rule with body:\n${JSON.stringify(body, null, 2)}\nSet Authorization header (API key or basic auth).`
          : `Alert rule definition (create in Kibana UI → Stack Management → Rules):\nName: ${name}\nType: ${rule_type}\nIndex: ${index ?? 'metrics-*'}\nCondition: ${condition ?? 'configure in UI'}\n\nSet KIBANA_URL to create via API.`;
      return { content: [{ type: 'text', text }] };
    }
  );
}
