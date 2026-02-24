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
import { textResponse, errorResponse } from '@elastic-cursor-plugin/shared-types';
import { esFetch } from '@elastic-cursor-plugin/shared-http';
import { purgeCluster, purgeCategory, type CategoryName } from '@elastic-cursor-plugin/knowledge-base';

const ALL_CATEGORIES: CategoryName[] = [
  '_meta', 'indices', 'data-streams', 'templates', 'pipelines', 'lifecycle', 'o11y', 'security',
];

export function registerClearClusterKnowledge(server: ToolRegistrationContext): void {
  server.registerTool(
    'clear_cluster_knowledge',
    {
      title: 'Clear Cluster Knowledge',
      description:
        'Securely remove cached cluster data from the local knowledge base. Use when switching clusters, after credential rotation, or to remove sensitive cached metadata.',
      inputSchema: z.object({
        sections: z
          .array(z.string())
          .optional()
          .describe('Specific sections to clear (e.g., ["security", "o11y"]). Omit to clear everything.'),
      }),
    },
    async (args: unknown) => {
      const input = args as { sections?: string[] };

      const res = await esFetch('/');
      if (!res.ok) {
        return errorResponse('Failed to connect to Elasticsearch. Cannot identify cluster to clear.');
      }
      const clusterUuid = (res.data as Record<string, unknown>).cluster_uuid as string;
      if (!clusterUuid) {
        return errorResponse('Could not determine cluster UUID.');
      }

      if (!input.sections || input.sections.length === 0) {
        const ok = await purgeCluster(clusterUuid);
        return ok
          ? textResponse('All cached cluster knowledge has been removed.')
          : textResponse('No cached knowledge found for this cluster (or already cleared).');
      }

      const cleared: string[] = [];
      for (const section of input.sections) {
        if (ALL_CATEGORIES.includes(section as CategoryName)) {
          const ok = await purgeCategory(clusterUuid, section as CategoryName);
          if (ok) cleared.push(section);
        }
      }

      return textResponse(
        cleared.length > 0
          ? `Cleared cached sections: ${cleared.join(', ')}.`
          : 'No matching cached sections found to clear.'
      );
    }
  );
}
