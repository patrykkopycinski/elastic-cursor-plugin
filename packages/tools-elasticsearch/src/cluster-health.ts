/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Client } from '@elastic/elasticsearch';
import { z } from 'zod';
import type { ToolRegistrationContext } from './types.js';

export function registerClusterHealth(server: ToolRegistrationContext, client: Client): void {
  server.registerTool(
    'cluster_health',
    {
      title: 'Cluster Health',
      description: 'Get cluster health: status, number of nodes, and shard stats.',
      inputSchema: z.object({
        level: z.enum(['cluster', 'indices', 'shards']).optional().default('cluster'),
      }),
    },
    async (args) => {
      const { level } = args as { level?: 'cluster' | 'indices' | 'shards' };
      try {
        const resp = await client.cluster.health({ level });
        const out = [
          `Status: ${resp.status}`,
          `Cluster: ${resp.cluster_name}`,
          `Nodes: ${resp.number_of_nodes ?? 'n/a'}`,
          `Data nodes: ${resp.number_of_data_nodes ?? 'n/a'}`,
          `Active shards: ${resp.active_primary_shards ?? 0} primary, ${resp.active_shards ?? 0} total`,
          `Relocating: ${resp.relocating_shards ?? 0}, Initializing: ${resp.initializing_shards ?? 0}, Unassigned: ${resp.unassigned_shards ?? 0}`,
        ];
        if (resp.indices && Object.keys(resp.indices).length) {
          out.push('--- Indices ---');
          out.push(JSON.stringify(resp.indices, null, 2));
        }
        return { content: [{ type: 'text' as const, text: out.join('\n') }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
