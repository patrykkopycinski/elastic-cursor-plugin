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

export function registerObservabilityInfo(server: ToolRegistrationContext): void {
  server.registerTool(
    'observability_info',
    {
      title: 'Observability Info',
      description: 'Return links and quick reference for Elastic Observability (APM, Logs, Metrics).',
      inputSchema: z.object({}),
    },
    async () => {
      const text = [
        'Elastic Observability:',
        '- APM: Kibana → APM. Instrument apps with elastic-apm-node (Node), elasticapm (Python), Elastic APM agent (Java/Go/.NET).',
        '- Logs: Use Filebeat or Elastic Agent with log input; create data views in Kibana → Logs.',
        '- Metrics: Metricbeat or Elastic Agent; Kibana → Metrics.',
        '- Alerts: Stack Management → Rules and Connectors.',
        '- Dashboards: Kibana → Dashboard; use Lens or legacy visualizations.',
      ].join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );
}
