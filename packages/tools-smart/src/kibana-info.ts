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
import { getKibanaUrl } from '@elastic-cursor-plugin/shared-http';

export function registerKibanaInfo(server: ToolRegistrationContext): void {
  server.registerTool(
    'kibana_info',
    {
      title: 'Kibana: Info and quick links',
      description:
        'Return Kibana URL and quick reference for main apps (Discover, Dashboard, Dev Tools, Fleet, APM, Security, Maps, Canvas).',
      inputSchema: z.object({}),
    },
    async () => {
      const base = getKibanaUrl();
      const url = base ? base.replace(/\/$/, '') : 'https://your-kibana.example.com';
      const text = [
        'Kibana quick reference',
        base ? `Base URL: ${url}` : 'Set KIBANA_URL to see your base URL here.',
        '',
        'Main apps (append to base URL):',
        '- Discover: /app/discover',
        '- Dashboard: /app/dashboards',
        '- Dev Tools (Console): /app/dev_tools#/console',
        '- Stack Management: /app/management',
        '- Fleet: /app/fleet',
        '- APM: /app/apm',
        '- Logs: /app/logs',
        '- Metrics: /app/metrics',
        '- Security: /app/security',
        '- Maps: /app/maps',
        '- Canvas: /app/canvas',
        '- Lens: Create from Dashboard or Discover → Visualize.',
        '',
        'Use kibana_list_data_views and kibana_list_dashboards when KIBANA_URL and auth are set.',
      ].join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );
}
