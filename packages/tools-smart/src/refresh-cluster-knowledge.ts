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
import {
  checkCategory,
  writeCategory,
  type CategoryName,
} from '@elastic-cursor-plugin/knowledge-base';

const REFRESHABLE_SECTIONS: CategoryName[] = [
  '_meta', 'indices', 'data-streams', 'templates', 'pipelines', 'lifecycle', 'o11y', 'security',
];

async function getClusterUuid(): Promise<string | null> {
  const res = await esFetch('/');
  if (!res.ok) return null;
  return (res.data as Record<string, unknown>).cluster_uuid as string ?? null;
}

export function registerRefreshClusterKnowledge(server: ToolRegistrationContext): void {
  server.registerTool(
    'refresh_cluster_knowledge',
    {
      title: 'Refresh Cluster Knowledge',
      description:
        'Trigger a targeted refresh of specific knowledge base sections. Use after cluster changes or when cached data is stale.',
      inputSchema: z.object({
        sections: z
          .array(z.string())
          .optional()
          .describe('Sections to refresh: _meta, indices, templates, pipelines, lifecycle, o11y, security. Defaults to all.'),
      }),
    },
    async (args: unknown) => {
      const input = args as { sections?: string[] };

      const clusterUuid = await getClusterUuid();
      if (!clusterUuid) {
        return errorResponse('Failed to connect to Elasticsearch.');
      }

      const startTime = Date.now();
      const requestedSections = input.sections?.length
        ? REFRESHABLE_SECTIONS.filter((s) => input.sections!.includes(s))
        : REFRESHABLE_SECTIONS;

      const refreshed: string[] = [];
      const failed: string[] = [];

      for (const section of requestedSections) {
        if (section === '_meta') {
          const res = await esFetch('/');
          if (res.ok) {
            const d = res.data as Record<string, unknown>;
            const version = d.version as Record<string, unknown> | undefined;
            await writeCategory(clusterUuid, '_meta', {
              name: (d.cluster_name as string) ?? 'unknown',
              version: (version?.number as string) ?? 'unknown',
              lastAccessed: new Date().toISOString(),
            });
            refreshed.push('_meta');
          } else {
            failed.push('_meta');
          }
          continue;
        }

        if (section === 'indices' || section === 'data-streams') {
          const res = await esFetch('/_resolve/index/*?expand_wildcards=open');
          if (res.ok) {
            const data = res.data as {
              indices?: Array<{ name: string }>;
              data_streams?: Array<{ name: string }>;
            };
            await writeCategory(clusterUuid, 'indices', data.indices ?? []);
            await writeCategory(clusterUuid, 'data-streams', data.data_streams ?? []);
            refreshed.push('indices', 'data-streams');
          } else {
            failed.push(section);
          }
          continue;
        }

        if (section === 'templates') {
          const [indexRes, compRes] = await Promise.all([
            esFetch('/_index_template/*'),
            esFetch('/_component_template/*'),
          ]);
          if (indexRes.ok && compRes.ok) {
            const templates = (indexRes.data as { index_templates?: unknown[] }).index_templates ?? [];
            const components = (compRes.data as { component_templates?: unknown[] }).component_templates ?? [];
            await writeCategory(clusterUuid, 'templates', { index_templates: templates, component_templates: components });
            refreshed.push('templates');
          } else {
            failed.push('templates');
          }
          continue;
        }

        if (section === 'pipelines') {
          const res = await esFetch('/_ingest/pipeline');
          if (res.ok) {
            await writeCategory(clusterUuid, 'pipelines', res.data);
            refreshed.push('pipelines');
          } else {
            failed.push('pipelines');
          }
          continue;
        }

        if (section === 'lifecycle') {
          const res = await esFetch('/_ilm/policy');
          if (res.ok) {
            await writeCategory(clusterUuid, 'lifecycle', res.data);
          } else {
            await writeCategory(clusterUuid, 'lifecycle', []);
          }
          refreshed.push('lifecycle');
          continue;
        }

        if (section === 'o11y' || section === 'security') {
          const { status } = await checkCategory(clusterUuid, section);
          if (status === 'missing' || status === 'expired') {
            failed.push(`${section} (run discover_${section === 'o11y' ? 'o11y_data' : 'security_data'} to populate)`);
          } else {
            refreshed.push(`${section} (cached, still valid)`);
          }
          continue;
        }
      }

      const elapsed = Date.now() - startTime;
      const lines: string[] = [
        `Cluster knowledge refreshed in ${elapsed}ms.`,
        '',
        `Refreshed: ${refreshed.length > 0 ? refreshed.join(', ') : 'none'}`,
      ];
      if (failed.length > 0) {
        lines.push(`Failed/skipped: ${failed.join(', ')}`);
      }

      return textResponse(lines.join('\n'));
    }
  );
}
