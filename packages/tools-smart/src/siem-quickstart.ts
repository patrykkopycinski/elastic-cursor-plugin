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

export function registerSiemQuickstart(server: ToolRegistrationContext): void {
  server.registerTool(
    'siem_quickstart',
    {
      title: 'SIEM Quickstart',
      description:
        'One-shot SIEM setup: recommended detection rules and dashboard. Returns steps and links.',
      inputSchema: z.object({}),
    },
    async () => {
      const text = [
        'SIEM Quickstart:',
        '1. Open Kibana → Security → Get Started. Enable the default detection rules if prompted.',
        '2. Install Elastic Agent or Beats (Filebeat, Winlogbeat) to ship logs. Use Fleet in Kibana → Management → Fleet.',
        '3. Add integrations (e.g. System, Nginx, Windows) from Fleet → Integrations.',
        '4. Security → Rules: review and enable prebuilt rules (e.g. MITRE ATT&CK).',
        '5. Security → Alerts: monitor open alerts; use update_alert_status to acknowledge or close.',
        '6. Dashboards: use built-in Security app dashboards or create custom in Dashboard.',
      ].join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );
}
