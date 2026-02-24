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
import type {
  ClusterProfile,
  GenericClusterInfo,
  IndexInfo,
  FieldInfo,
  TemplateInfo,
  ComponentTemplateInfo,
  PipelineInfo,
  LifecyclePolicy,
} from './discover-data-types.js';

const DEFAULT_MAX_INDICES = 200;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const ECS_PREFIXES = [
  'agent.', 'cloud.', 'container.', 'destination.', 'ecs.', 'event.', 'file.',
  'host.', 'log.', 'network.', 'observer.', 'process.', 'service.', 'source.',
  'url.', 'user.', 'user_agent.',
];

function isEcsField(name: string): boolean {
  return ECS_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function computeFreshness(lastDocIso: string | null): IndexInfo['freshness'] {
  if (!lastDocIso) {
    return { last_document: '', status: 'no_data' };
  }
  const age = Date.now() - new Date(lastDocIso).getTime();
  return {
    last_document: lastDocIso,
    status: age < STALE_THRESHOLD_MS ? 'active' : 'stale',
  };
}

function aggValueAsString(agg: unknown): string | null {
  if (agg && typeof agg === 'object' && 'value_as_string' in agg) {
    return (agg as { value_as_string: string }).value_as_string;
  }
  if (agg && typeof agg === 'object' && 'value' in agg) {
    const v = (agg as { value: unknown }).value;
    return typeof v === 'number' ? new Date(v).toISOString() : null;
  }
  return null;
}

function classifyIndex(name: string): IndexInfo['type'] {
  if (name.startsWith('logs-')) return 'logs';
  if (name.startsWith('metrics-')) return 'metrics';
  if (name.startsWith('traces-')) return 'traces';
  if (name.startsWith('synthetics-')) return 'synthetics';
  return 'other';
}

function freshnessIcon(status: IndexInfo['freshness']['status']): string {
  if (status === 'active') return '🟢';
  if (status === 'stale') return '🟡';
  return '⚪';
}

async function fetchClusterInfo(): Promise<{ ok: true; info: GenericClusterInfo } | { ok: false; error: string }> {
  const res = await esFetch('/');
  if (!res.ok) return { ok: false, error: res.error ?? 'Failed to reach Elasticsearch' };

  const d = res.data as Record<string, unknown>;
  const version = d.version as Record<string, unknown> | undefined;
  const buildFlavor = (version?.build_flavor as string) ?? '';

  return {
    ok: true,
    info: {
      name: (d.cluster_name as string) ?? 'unknown',
      uuid: (d.cluster_uuid as string) ?? 'unknown',
      version: (version?.number as string) ?? 'unknown',
      is_serverless: buildFlavor === 'serverless',
    },
  };
}

interface ResolvedIndex {
  name: string;
  is_data_stream: boolean;
}

async function fetchResolvedIndices(patterns: string[]): Promise<ResolvedIndex[]> {
  const pattern = patterns.length > 0 ? patterns.join(',') : '*';
  const res = await esFetch(`/_resolve/index/${pattern}?expand_wildcards=open`);
  if (!res.ok) return [];

  const data = res.data as {
    indices?: Array<{ name: string }>;
    data_streams?: Array<{ name: string }>;
  };

  const results: ResolvedIndex[] = [];
  const seen = new Set<string>();

  for (const ds of data.data_streams ?? []) {
    if (!seen.has(ds.name)) {
      seen.add(ds.name);
      results.push({ name: ds.name, is_data_stream: true });
    }
  }

  for (const idx of data.indices ?? []) {
    if (!seen.has(idx.name) && !idx.name.startsWith('.')) {
      seen.add(idx.name);
      results.push({ name: idx.name, is_data_stream: false });
    }
  }

  return results;
}

async function profileIndex(resolved: ResolvedIndex): Promise<IndexInfo> {
  const [countRes, tsRes] = await Promise.all([
    esFetch(`/${resolved.name}/_count?ignore_unavailable=true`),
    esFetch(`/${resolved.name}/_search?ignore_unavailable=true`, {
      method: 'POST',
      body: {
        size: 0,
        aggs: {
          min_ts: { min: { field: '@timestamp' } },
          max_ts: { max: { field: '@timestamp' } },
        },
      },
    }),
  ]);

  const docCount = countRes.ok ? ((countRes.data as { count?: number })?.count ?? 0) : 0;

  let timeRange: IndexInfo['time_range'] = { from: '', to: '' };
  let freshness: IndexInfo['freshness'] = { last_document: '', status: 'no_data' };

  if (tsRes.ok) {
    const tsData = tsRes.data as { aggregations?: Record<string, unknown> };
    const tsAggs = tsData.aggregations ?? {};
    const minTs = aggValueAsString(tsAggs.min_ts);
    const maxTs = aggValueAsString(tsAggs.max_ts);
    if (minTs && maxTs) {
      timeRange = { from: minTs, to: maxTs };
      freshness = computeFreshness(maxTs);
    }
  }

  return {
    name: resolved.name,
    type: classifyIndex(resolved.name),
    is_data_stream: resolved.is_data_stream,
    doc_count: docCount,
    time_range: timeRange,
    freshness,
    key_fields: [],
  };
}

async function fetchFieldCaps(indexName: string): Promise<FieldInfo[]> {
  const res = await esFetch(`/${indexName}/_field_caps?fields=*&ignore_unavailable=true`);
  if (!res.ok) return [];

  const data = res.data as { fields?: Record<string, Record<string, { type: string }>> };
  const fields = data.fields ?? {};

  return Object.entries(fields)
    .filter(([name]) => !name.startsWith('_'))
    .slice(0, 30)
    .map(([name, mapping]): FieldInfo => {
      const types = Object.values(mapping);
      const fieldType = types[0]?.type ?? 'unknown';
      return { name, type: fieldType, is_ecs: isEcsField(name) };
    });
}

async function fetchIndexTemplates(): Promise<TemplateInfo[]> {
  const res = await esFetch('/_index_template/*');
  if (!res.ok) return [];

  const data = res.data as {
    index_templates?: Array<{
      name: string;
      index_template: {
        index_patterns?: string[];
        priority?: number;
        composed_of?: string[];
        _meta?: { managed?: boolean; managed_by?: string };
      };
    }>;
  };

  return (data.index_templates ?? []).map((entry): TemplateInfo => {
    const tpl = entry.index_template;
    const meta = tpl._meta;
    return {
      name: entry.name,
      index_patterns: tpl.index_patterns ?? [],
      is_managed: !!(meta?.managed || meta?.managed_by),
      priority: tpl.priority ?? 0,
      composed_of: tpl.composed_of ?? [],
    };
  });
}

async function fetchComponentTemplates(): Promise<ComponentTemplateInfo[]> {
  const res = await esFetch('/_component_template/*');
  if (!res.ok) return [];

  const data = res.data as {
    component_templates?: Array<{
      name: string;
      component_template: {
        _meta?: { managed?: boolean; managed_by?: string };
      };
    }>;
  };

  return (data.component_templates ?? []).map((entry): ComponentTemplateInfo => {
    const meta = entry.component_template._meta;
    return {
      name: entry.name,
      is_managed: !!(meta?.managed || meta?.managed_by),
    };
  });
}

async function fetchIngestPipelines(): Promise<PipelineInfo[]> {
  const res = await esFetch('/_ingest/pipeline');
  if (!res.ok) return [];

  const data = res.data as Record<string, { description?: string; processors?: unknown[] }>;

  return Object.entries(data).map(([name, pipeline]): PipelineInfo => ({
    name,
    description: pipeline.description ?? '',
    processor_count: pipeline.processors?.length ?? 0,
  }));
}

async function fetchIlmPolicies(): Promise<LifecyclePolicy[]> {
  try {
    const res = await esFetch('/_ilm/policy');
    if (!res.ok) return [];

    const data = res.data as Record<string, { policy?: { phases?: Record<string, unknown>; _meta?: { managed?: boolean } } }>;

    return Object.entries(data).map(([name, entry]): LifecyclePolicy => {
      const phases = entry.policy?.phases ?? {};
      return {
        name,
        phases: Object.keys(phases),
        managed: !!entry.policy?._meta?.managed,
      };
    });
  } catch {
    return [];
  }
}

async function fetchDataStreamLifecycles(): Promise<Map<string, string>> {
  const lifecycleMap = new Map<string, string>();
  try {
    const res = await esFetch('/_data_stream/*');
    if (!res.ok) return lifecycleMap;

    const data = res.data as {
      data_streams?: Array<{
        name: string;
        lifecycle?: { data_retention?: string };
        ilm_policy?: string;
      }>;
    };

    for (const ds of data.data_streams ?? []) {
      const retention = ds.lifecycle?.data_retention;
      const ilm = ds.ilm_policy;
      if (retention) {
        lifecycleMap.set(ds.name, `retention: ${retention}`);
      } else if (ilm) {
        lifecycleMap.set(ds.name, `ILM: ${ilm}`);
      }
    }
  } catch {
    // Data stream API may not be available
  }
  return lifecycleMap;
}

function formatProfileAsMarkdown(profile: ClusterProfile, dsLifecycles: Map<string, string>): string {
  const lines: string[] = [];

  lines.push('# Cluster Data Discovery');
  lines.push('');
  lines.push(`## Cluster: ${profile.cluster_info.name}`);
  lines.push(`- Version: ${profile.cluster_info.version}`);
  lines.push(`- UUID: ${profile.cluster_info.uuid}`);
  lines.push(`- Serverless: ${profile.cluster_info.is_serverless ? 'Yes' : 'No'}`);
  lines.push(`- Discovery took: ${profile.discovery_time_ms}ms`);

  if (profile.indices.length > 0) {
    lines.push('');
    lines.push(`## Indices & Data Streams (${profile.indices.length})`);
    for (const idx of profile.indices) {
      const icon = freshnessIcon(idx.freshness.status);
      const dsLabel = idx.is_data_stream ? 'data_stream' : 'index';
      const lifecycle = dsLifecycles.get(idx.name);
      const lifecycleStr = lifecycle ? ` | ${lifecycle}` : '';
      lines.push(
        `- ${icon} **${idx.name}** [${idx.type}, ${dsLabel}] — ${idx.doc_count.toLocaleString()} docs${lifecycleStr}`
      );
      if (idx.key_fields.length > 0) {
        const ecsCount = idx.key_fields.filter((f) => f.is_ecs).length;
        const fieldSummary = idx.key_fields
          .slice(0, 10)
          .map((f) => `${f.name} (${f.type}${f.is_ecs ? ', ECS' : ''})`)
          .join(', ');
        lines.push(`  Fields: ${idx.key_fields.length} sampled (${ecsCount} ECS): ${fieldSummary}`);
      }
    }
  }

  if (profile.templates.length > 0) {
    lines.push('');
    const managed = profile.templates.filter((t) => t.is_managed).length;
    const user = profile.templates.length - managed;
    lines.push(`## Index Templates (${profile.templates.length}) — ${managed} managed, ${user} user-created`);
    for (const tpl of profile.templates) {
      const flag = tpl.is_managed ? ' [managed]' : '';
      lines.push(`- **${tpl.name}**${flag} — patterns: ${tpl.index_patterns.join(', ')}`);
      if (tpl.composed_of.length > 0) {
        lines.push(`  composed_of: ${tpl.composed_of.join(', ')}`);
      }
    }
  }

  if (profile.component_templates.length > 0) {
    lines.push('');
    const managed = profile.component_templates.filter((t) => t.is_managed).length;
    const user = profile.component_templates.length - managed;
    lines.push(`## Component Templates (${profile.component_templates.length}) — ${managed} managed, ${user} user-created`);
    for (const ct of profile.component_templates) {
      const flag = ct.is_managed ? ' [managed]' : '';
      lines.push(`- **${ct.name}**${flag}`);
    }
  }

  if (profile.pipelines.length > 0) {
    lines.push('');
    lines.push(`## Ingest Pipelines (${profile.pipelines.length})`);
    for (const p of profile.pipelines) {
      const desc = p.description ? ` — ${p.description}` : '';
      lines.push(`- **${p.name}** (${p.processor_count} processors)${desc}`);
    }
  }

  if (profile.lifecycle_policies.length > 0) {
    lines.push('');
    lines.push(`## Lifecycle Policies (${profile.lifecycle_policies.length})`);
    for (const lp of profile.lifecycle_policies) {
      const flag = lp.managed ? ' [managed]' : '';
      lines.push(`- **${lp.name}**${flag} — phases: ${lp.phases.join(' → ')}`);
    }
  }

  return lines.join('\n');
}

export function registerDiscoverData(server: ToolRegistrationContext): void {
  server.registerTool(
    'discover_data',
    {
      title: 'Discover Data',
      description:
        'Generic data discovery across an Elasticsearch deployment. Returns cluster info, indices/data streams with doc counts and freshness, index templates, component templates, ingest pipelines, and lifecycle policies.',
      inputSchema: z.object({
        index_patterns: z
          .array(z.string())
          .optional()
          .describe('Index patterns to scope discovery (defaults to *)'),
        include_templates: z
          .boolean()
          .optional()
          .describe('Include index/component templates (default true)'),
        include_pipelines: z
          .boolean()
          .optional()
          .describe('Include ingest pipelines (default true)'),
        include_lifecycle: z
          .boolean()
          .optional()
          .describe('Include ILM/lifecycle policies (default true)'),
        max_indices: z
          .number()
          .optional()
          .describe('Max indices to profile in detail (default 200)'),
      }),
    },
    async (args: unknown) => {
      const input = args as {
        index_patterns?: string[];
        include_templates?: boolean;
        include_pipelines?: boolean;
        include_lifecycle?: boolean;
        max_indices?: number;
      };

      const startTime = Date.now();

      const clusterResult = await fetchClusterInfo();
      if (!clusterResult.ok) {
        return errorResponse(`Failed to connect to Elasticsearch: ${clusterResult.error}`);
      }

      const maxIndices = input.max_indices ?? DEFAULT_MAX_INDICES;
      const includeTemplates = input.include_templates !== false;
      const includePipelines = input.include_pipelines !== false;
      const includeLifecycle = input.include_lifecycle !== false;

      const resolvedIndices = await fetchResolvedIndices(input.index_patterns ?? []);
      const indicesToProfile = resolvedIndices.slice(0, maxIndices);

      const parallelTasks: [
        Promise<IndexInfo[]>,
        Promise<TemplateInfo[]>,
        Promise<ComponentTemplateInfo[]>,
        Promise<PipelineInfo[]>,
        Promise<LifecyclePolicy[]>,
        Promise<Map<string, string>>,
      ] = [
        Promise.all(indicesToProfile.map(profileIndex)),
        includeTemplates ? fetchIndexTemplates() : Promise.resolve([]),
        includeTemplates ? fetchComponentTemplates() : Promise.resolve([]),
        includePipelines ? fetchIngestPipelines() : Promise.resolve([]),
        includeLifecycle ? fetchIlmPolicies() : Promise.resolve([]),
        includeLifecycle ? fetchDataStreamLifecycles() : Promise.resolve(new Map()),
      ];

      const [indices, templates, componentTemplates, pipelines, lifecyclePolicies, dsLifecycles] =
        await Promise.all(parallelTasks);

      const dataStreamNames = indices
        .filter((idx) => idx.is_data_stream)
        .slice(0, 5)
        .map((idx) => idx.name);

      const fieldCapResults = await Promise.all(dataStreamNames.map(fetchFieldCaps));
      for (let i = 0; i < dataStreamNames.length; i++) {
        const dsName = dataStreamNames[i]!;
        const fields = fieldCapResults[i]!;
        const idx = indices.find((ind) => ind.name === dsName);
        if (idx) {
          idx.key_fields = fields;
        }
      }

      const profile: ClusterProfile = {
        cluster_info: clusterResult.info,
        indices,
        templates,
        component_templates: componentTemplates,
        pipelines,
        lifecycle_policies: lifecyclePolicies,
        discovery_time_ms: Date.now() - startTime,
      };

      const markdown = formatProfileAsMarkdown(profile, dsLifecycles);
      return textResponse(markdown);
    }
  );
}
