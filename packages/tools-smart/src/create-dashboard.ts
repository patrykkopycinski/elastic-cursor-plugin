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

export function registerCreateDashboard(server: ToolRegistrationContext): void {
  server.registerTool(
    'create_dashboard',
    {
      title: 'Create Dashboard',
      description:
        'Generate APM or custom dashboard configuration for a service. Returns saved object JSON or instructions.',
      inputSchema: z.object({
        title: z.string().describe('Dashboard title'),
        service_name: z.string().optional().describe('APM service name for APM dashboard'),
        index_pattern: z.string().optional().describe('Index pattern for custom dashboard'),
      }),
    },
    async (args) => {
      const { title, service_name, index_pattern } = args as {
        title: string;
        service_name?: string;
        index_pattern?: string;
      };
      const text = service_name
        ? `APM dashboard for service "${service_name}":\n1. Open Kibana → APM → Services → ${service_name}.\n2. Use the built-in service overview and dependency views.\n3. To create a custom dashboard: Dashboard → Create → Add from library (APM visualizations) or use Lens with index pattern "traces-apm*" and filter by service.name: "${service_name}".`
        : `Custom dashboard "${title}":\n1. Create a data view for index pattern: ${index_pattern ?? 'metrics-*'}.\n2. Dashboard → Create dashboard → Add panel (Lens or legacy).\n3. Save as "${title}".\nFor APM-specific panels, use service_name and the APM app.`;
      return { content: [{ type: 'text', text }] };
    }
  );
}
