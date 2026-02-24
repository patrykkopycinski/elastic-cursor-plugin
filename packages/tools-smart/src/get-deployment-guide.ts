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

export function registerGetDeploymentGuide(server: ToolRegistrationContext): void {
  server.registerTool(
    'get_deployment_guide',
    {
      title: 'Get Deployment Guide',
      description:
        'Get a step-by-step deployment guide. Ask the user first: "Do you prefer Cloud (managed) or on-prem (Docker)?" Then call with preference "cloud" or "on_prem". On-prem uses Docker (Elasticsearch, Kibana, Fleet server, APM server, Elastic Agent).',
      inputSchema: z.object({
        preference: z
          .enum(['cloud', 'on_prem'])
          .describe('User preference: cloud = Elastic Cloud managed; on_prem = self-hosted with Docker'),
      }),
    },
    async (args) => {
      const { preference } = args as { preference: 'cloud' | 'on_prem' };

      if (preference === 'cloud') {
        const text = [
          '## Elastic Cloud deployment',
          '',
          '1. **Create a project**: Use the `create_cloud_project` tool with name and region_id (e.g. us-east-1). Requires ELASTIC_CLOUD_API_KEY.',
          '2. **Get connection details**: Use `get_connection_config` with the project URL and API key, and your language (node, python, java, go, dotnet).',
          '3. **Set env**: Set ES_URL and ES_API_KEY from the project response.',
          '4. **Verify**: Use `cluster_health` and `list_indices`; create an index with `create_index`, then `search` or `index_document`.',
          '5. **Kibana**: Open the Kibana URL from the project in your browser.',
          '',
          'No Docker or server management required.',
        ].join('\n');
        return { content: [{ type: 'text', text }] };
      }

      const text = [
        '## On-prem deployment (Docker)',
        '',
        '1. **Run the Docker stack**: Use the docker-compose in this repo at `examples/on-prem-docker/`. From that directory run:',
        '   ```bash',
        '   docker compose up -d',
        '   ```',
        '   This starts Elasticsearch, Kibana, Fleet server, and APM server.',
        '2. **Wait for green**: Wait 1–2 minutes, then check Elasticsearch: http://localhost:9200 (user `elastic`, password from `docker compose logs elasticsearch` or the generated password in the logs).',
        '3. **Kibana**: Open http://localhost:5601, log in with the same elastic user and password. In Kibana, go to Management → Fleet to add Elastic Agents.',
        '4. **Set env for the plugin**: Set ES_URL=http://localhost:9200 and ES_USERNAME=elastic, ES_PASSWORD=<password>, or create an API key in Kibana and set ES_API_KEY.',
        '5. **APM**: APM Server is at http://localhost:8200. Use `setup_apm` with server_url http://host.docker.internal:8200 (from host) or http://apm-server:8200 (from another container).',
        '6. **Elastic Agents**: Add agents via Fleet in Kibana (Management → Fleet → Add agent), or run the Elastic Agent Docker container—see examples/on-prem-docker/README.md.',
        '',
        'All services (Elasticsearch, Kibana, Fleet server, APM server) run in Docker; you can add Elastic Agents on the host or in Docker.',
      ].join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );
}
