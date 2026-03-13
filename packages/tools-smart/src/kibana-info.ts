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
      title: 'Kibana: Quick links for your instance',
      description:
        'Return the configured Kibana URL with direct links to main apps (Discover, Dashboard, Dev Tools, Fleet, APM, Security, Maps, Canvas).',
      inputSchema: z.object({}),
    },
    async () => {
      const base = getKibanaUrl();
      const url = base ? base.replace(/\/$/, '') : null;

      if (!url) {
        return {
          content: [
            {
              type: 'text',
              text: 'Kibana URL not configured. Set KIBANA_URL to get direct links to your Kibana apps.',
            },
          ],
        };
      }

      const apps = [
        ['Discover', '/app/discover'],
        ['Dashboard', '/app/dashboards'],
        ['Dev Tools (Console)', '/app/dev_tools#/console'],
        ['Stack Management', '/app/management'],
        ['Fleet', '/app/fleet'],
        ['APM', '/app/apm'],
        ['Logs', '/app/logs'],
        ['Metrics', '/app/metrics'],
        ['Security', '/app/security'],
        ['Maps', '/app/maps'],
        ['Canvas', '/app/canvas'],
      ];

      const lines = [
        `Kibana: ${url}`,
        '',
        ...apps.map(([name, path]) => `- ${name}: ${url}${path}`),
      ];

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );
}
