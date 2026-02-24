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
  readCategory,
  checkCategory,
  formatAge,
  writeCategory,
  type CategoryName,
} from '@elastic-cursor-plugin/knowledge-base';

const ALL_SECTIONS: CategoryName[] = [
  '_meta', 'indices', 'data-streams', 'templates', 'pipelines', 'lifecycle', 'o11y', 'security',
];

async function getClusterUuid(): Promise<string | null> {
  const res = await esFetch('/');
  if (!res.ok) return null;
  const d = res.data as Record<string, unknown>;
  const uuid = (d.cluster_uuid as string) ?? null;
  if (uuid) {
    await writeCategory(uuid, '_meta', {
      name: (d.cluster_name as string) ?? 'unknown',
      version: ((d.version as Record<string, unknown>)?.number as string) ?? 'unknown',
      lastAccessed: new Date().toISOString(),
    });
  }
  return uuid;
}

function formatCategoryData(category: CategoryName, data: unknown): string {
  if (!data) return '_No data cached._';

  if (category === '_meta') {
    const meta = data as { name?: string; version?: string };
    return `Cluster: **${meta.name ?? 'unknown'}** (v${meta.version ?? 'unknown'})`;
  }

  if (category === 'indices' || category === 'data-streams') {
    const items = data as Array<{ name: string; doc_count?: number; type?: string }>;
    if (!Array.isArray(items)) return JSON.stringify(data, null, 2);
    const summary = items.slice(0, 20);
    const lines = summary.map((i) => `- ${i.name} — ${(i.doc_count ?? 0).toLocaleString()} docs [${i.type ?? 'other'}]`);
    if (items.length > 20) lines.push(`- _...and ${items.length - 20} more_`);
    return lines.join('\n');
  }

  if (category === 'templates') {
    const items = data as Array<{ name: string; is_managed?: boolean }>;
    if (!Array.isArray(items)) return JSON.stringify(data, null, 2);
    const user = items.filter((t) => !t.is_managed);
    const managed = items.filter((t) => t.is_managed);
    return `${items.length} templates (${user.length} user-created, ${managed.length} managed)`;
  }

  if (category === 'pipelines') {
    const items = data as Array<{ name: string; processor_count?: number }>;
    if (!Array.isArray(items)) return JSON.stringify(data, null, 2);
    return `${items.length} pipelines`;
  }

  if (category === 'lifecycle') {
    const items = data as Array<{ name: string; phases?: string[] }>;
    if (!Array.isArray(items)) return JSON.stringify(data, null, 2);
    return `${items.length} lifecycle policies`;
  }

  if (category === 'o11y') {
    const d = data as { services?: unknown[]; hosts?: unknown[]; log_sources?: unknown[] };
    const parts: string[] = [];
    if (d.services) parts.push(`${(d.services as unknown[]).length} APM services`);
    if (d.hosts) parts.push(`${(d.hosts as unknown[]).length} hosts`);
    if (d.log_sources) parts.push(`${(d.log_sources as unknown[]).length} log sources`);
    return parts.length > 0 ? parts.join(', ') : 'O11y data cached';
  }

  if (category === 'security') {
    const d = data as { data_sources?: unknown[]; rule_coverage?: { total?: number; enabled?: number } };
    const parts: string[] = [];
    if (d.data_sources) parts.push(`${(d.data_sources as unknown[]).length} data sources`);
    if (d.rule_coverage) parts.push(`${d.rule_coverage.enabled ?? 0}/${d.rule_coverage.total ?? 0} rules enabled`);
    return parts.length > 0 ? parts.join(', ') : 'Security data cached';
  }

  return typeof data === 'string' ? data : JSON.stringify(data, null, 2).slice(0, 500);
}

const SECTION_LABELS: Record<CategoryName, string> = {
  '_meta': 'Cluster Info',
  'indices': 'Indices & Data Streams',
  'data-streams': 'Data Stream Profiles',
  'templates': 'Templates',
  'pipelines': 'Ingest Pipelines',
  'lifecycle': 'Lifecycle Policies',
  'o11y': 'Observability',
  'security': 'Security',
};

export function registerGetClusterContext(server: ToolRegistrationContext): void {
  server.registerTool(
    'get_cluster_context',
    {
      title: 'Get Cluster Context',
      description:
        'Return cached cluster knowledge base for instant awareness. Call at conversation start to understand what data exists without running live queries. Returns cached discovery results with freshness indicators.',
      inputSchema: z.object({
        sections: z
          .array(z.string())
          .optional()
          .describe('Filter sections: _meta, indices, data-streams, templates, pipelines, lifecycle, o11y, security. Defaults to all.'),
        force_refresh: z
          .boolean()
          .optional()
          .describe('Bypass cache and run live discovery (default false)'),
      }),
    },
    async (args: unknown) => {
      const input = args as { sections?: string[]; force_refresh?: boolean };

      const clusterUuid = await getClusterUuid();
      if (!clusterUuid) {
        return errorResponse('Failed to connect to Elasticsearch. Cannot retrieve cluster context.');
      }

      const requestedSections = input.sections?.length
        ? ALL_SECTIONS.filter((s) => input.sections!.includes(s))
        : ALL_SECTIONS;

      const lines: string[] = ['# Cluster Knowledge Base', ''];

      for (const section of requestedSections) {
        const { status, updatedAt } = await checkCategory(clusterUuid, section);
        const label = SECTION_LABELS[section];

        if (status === 'missing') {
          lines.push(`## ${label}`);
          lines.push('_Not yet discovered. Run the corresponding discovery tool to populate._');
          lines.push('');
          continue;
        }

        const envelope = await readCategory(clusterUuid, section);
        const freshnessTag = updatedAt ? `[cached ${formatAge(updatedAt)}]` : '[unknown age]';
        const statusIcon = status === 'fresh' ? '🟢' : status === 'stale' ? '🟡' : '🔴';

        lines.push(`## ${label} ${statusIcon} ${freshnessTag}`);
        lines.push(formatCategoryData(section, envelope?.data));
        lines.push('');
      }

      return textResponse(lines.join('\n'));
    }
  );
}
