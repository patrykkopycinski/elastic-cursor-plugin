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

export function registerSetupLogShipping(server: ToolRegistrationContext): void {
  server.registerTool(
    'setup_log_shipping',
    {
      title: 'Setup Log Shipping',
      description:
        'Generate Elastic Agent or Filebeat configuration for shipping logs to Elasticsearch.',
      inputSchema: z.object({
        log_path: z.string().describe('Path to log files (e.g. /var/log/app/*.log)'),
        index_name: z.string().optional().describe('Target index name (default logs-app)'),
        type: z.enum(['filebeat', 'elastic_agent']).optional().default('filebeat'),
      }),
    },
    async (args) => {
      const { log_path, index_name, type } = args as {
        log_path: string;
        index_name?: string;
        type?: 'filebeat' | 'elastic_agent';
      };
      const index = index_name ?? 'logs-app';
      const filebeatYaml = `# Filebeat config
filebeat.inputs:
  - type: log
    paths:
      - ${log_path}
    fields:
      index: ${index}
output.elasticsearch:
  hosts: ["\${ES_URL}"]
  api_key: "\${ES_API_KEY}"
setup.ilm.enabled: true
setup.template.name: "${index}"
setup.template.pattern: "${index}-*"
`;
      const agentYaml = `# Elastic Agent integration (logs)
inputs:
  - type: log
    paths:
      - ${log_path}
    data_stream:
      dataset: app
      type: logs
`;
      const text =
        type === 'elastic_agent'
          ? agentYaml + '\n# Add to Fleet or standalone agent policy.'
          : filebeatYaml;
      return { content: [{ type: 'text', text }] };
    }
  );
}
