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
import { esFetch } from '@elastic-cursor-plugin/shared-http';
import { writeCategory } from '@elastic-cursor-plugin/knowledge-base';
import type {
  DiscoveryResult,
  ClusterInfo,
  ApmService,
  HostInfo,
  ContainerInfo,
  LogSource,
  DataStreamInfo,
  DataFreshness,
  TimeRange,
  FieldProfile,
  IoTProfile,
  IoTDevice,
} from './discovery-types.js';

const DEFAULT_TIME_RANGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_INDICES = 50;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

interface EsAggBucket {
  key: string;
  doc_count: number;
  [k: string]: unknown;
}

function computeFreshness(lastDocIso: string | null): DataFreshness {
  if (!lastDocIso) {
    return { last_document: '', status: 'no_data' };
  }
  const age = Date.now() - new Date(lastDocIso).getTime();
  return {
    last_document: lastDocIso,
    status: age < STALE_THRESHOLD_MS ? 'active' : 'stale',
  };
}


function buckets(aggs: Record<string, unknown>, name: string): EsAggBucket[] {
  const agg = aggs[name] as { buckets?: EsAggBucket[] } | undefined;
  return agg?.buckets ?? [];
}

function aggValue(agg: unknown): unknown {
  if (agg && typeof agg === 'object' && 'value' in agg) {
    return (agg as { value: unknown }).value;
  }
  return null;
}

function aggValueAsString(agg: unknown): string | null {
  if (agg && typeof agg === 'object' && 'value_as_string' in agg) {
    return (agg as { value_as_string: string }).value_as_string;
  }
  const v = aggValue(agg);
  return typeof v === 'number' ? new Date(v).toISOString() : null;
}

async function fetchClusterInfo(): Promise<{ ok: true; info: ClusterInfo } | { ok: false; error: string }> {
  const res = await esFetch('/');
  if (!res.ok) return { ok: false, error: res.error ?? 'Failed to reach Elasticsearch' };

  const d = res.data as Record<string, unknown>;
  const version = d.version as Record<string, unknown> | undefined;
  const buildFlavor = (version?.build_flavor as string) ?? '';

  return {
    ok: true,
    info: {
      name: (d.cluster_name as string) ?? 'unknown',
      version: (version?.number as string) ?? 'unknown',
      is_serverless: buildFlavor === 'serverless',
    },
  };
}

async function getClusterUuid(): Promise<string | null> {
  const res = await esFetch('/');
  if (!res.ok) return null;
  return (res.data as Record<string, unknown>).cluster_uuid as string ?? null;
}

async function discoverApmServices(
  from: string,
  to: string,
  serviceFilter: string[] | undefined
): Promise<ApmService[]> {
  const must: unknown[] = [{ range: { '@timestamp': { gte: from, lte: to } } }];
  if (serviceFilter?.length) {
    must.push({ terms: { 'service.name': serviceFilter } });
  }

  const res = await esFetch('/traces-apm*,metrics-apm*/_search?ignore_unavailable=true', {
    method: 'POST',
    body: {
      size: 0,
      query: { bool: { must } },
      aggs: {
        services: {
          terms: { field: 'service.name', size: 200 },
          aggs: {
            env: { terms: { field: 'service.environment', size: 5 } },
            lang: { terms: { field: 'service.language.name', size: 5 } },
            min_ts: { min: { field: '@timestamp' } },
            max_ts: { max: { field: '@timestamp' } },
            ds: { terms: { field: '_index', size: 20 } },
          },
        },
      },
    },
  });

  if (!res.ok) return [];

  const data = res.data as { aggregations?: Record<string, unknown> };
  return buckets(data.aggregations ?? {}, 'services').map((b): ApmService => {
    const svcAggs = b as unknown as Record<string, unknown>;
    const envBuckets = buckets(svcAggs, 'env');
    const langBuckets = buckets(svcAggs, 'lang');
    const dsBuckets = buckets(svcAggs, 'ds');
    const minTs = aggValueAsString(svcAggs.min_ts);
    const maxTs = aggValueAsString(svcAggs.max_ts);

    const rangeMs = minTs && maxTs ? new Date(maxTs).getTime() - new Date(minTs).getTime() : 0;
    const rangeMinutes = rangeMs / 60_000 || 1;

    return {
      name: b.key,
      environment: envBuckets[0]?.key ?? 'unknown',
      language: langBuckets[0]?.key ?? 'unknown',
      throughput_per_min: Math.round(b.doc_count / rangeMinutes),
      time_range: { from: minTs ?? from, to: maxTs ?? to },
      freshness: computeFreshness(maxTs),
      data_streams: dsBuckets.map((d) => d.key),
    };
  });
}

async function discoverHosts(from: string, to: string): Promise<HostInfo[]> {
  const res = await esFetch('/metrics-system*,metrics-kubernetes*,metrics-docker*/_search?ignore_unavailable=true', {
    method: 'POST',
    body: {
      size: 0,
      query: { range: { '@timestamp': { gte: from, lte: to } } },
      aggs: {
        hosts: {
          terms: { field: 'host.name', size: 200 },
          aggs: {
            metricsets: { terms: { field: 'metricset.name', size: 50 } },
            min_ts: { min: { field: '@timestamp' } },
            max_ts: { max: { field: '@timestamp' } },
          },
        },
      },
    },
  });

  if (!res.ok) return [];

  const data = res.data as { aggregations?: Record<string, unknown> };
  return buckets(data.aggregations ?? {}, 'hosts').map((b): HostInfo => {
    const hostAggs = b as unknown as Record<string, unknown>;
    const metricBuckets = buckets(hostAggs, 'metricsets');
    const minTs = aggValueAsString(hostAggs.min_ts);
    const maxTs = aggValueAsString(hostAggs.max_ts);

    return {
      name: b.key,
      metric_types: metricBuckets.map((m) => m.key),
      collection_interval_seconds: null,
      time_range: { from: minTs ?? from, to: maxTs ?? to },
      freshness: computeFreshness(maxTs),
    };
  });
}

async function discoverContainers(from: string, to: string): Promise<ContainerInfo[]> {
  const res = await esFetch('/metrics-kubernetes*,metrics-docker*/_search?ignore_unavailable=true', {
    method: 'POST',
    body: {
      size: 0,
      query: { range: { '@timestamp': { gte: from, lte: to } } },
      aggs: {
        containers: {
          terms: { field: 'container.id', size: 200 },
          aggs: {
            cname: { terms: { field: 'container.name', size: 1 } },
            pod: { terms: { field: 'kubernetes.pod.name', size: 1 } },
            ns: { terms: { field: 'kubernetes.namespace', size: 1 } },
            node: { terms: { field: 'kubernetes.node.name', size: 1 } },
            metrics: { terms: { field: 'metricset.name', size: 50 } },
            min_ts: { min: { field: '@timestamp' } },
            max_ts: { max: { field: '@timestamp' } },
          },
        },
      },
    },
  });

  if (!res.ok) return [];

  const data = res.data as { aggregations?: Record<string, unknown> };
  return buckets(data.aggregations ?? {}, 'containers').map((b): ContainerInfo => {
    const cAggs = b as unknown as Record<string, unknown>;
    const nameBuckets = buckets(cAggs, 'cname');
    const podBuckets = buckets(cAggs, 'pod');
    const nsBuckets = buckets(cAggs, 'ns');
    const nodeBuckets = buckets(cAggs, 'node');
    const metricBuckets = buckets(cAggs, 'metrics');
    const minTs = aggValueAsString(cAggs.min_ts);
    const maxTs = aggValueAsString(cAggs.max_ts);

    return {
      id: b.key,
      name: nameBuckets[0]?.key ?? null,
      pod_name: podBuckets[0]?.key ?? null,
      namespace: nsBuckets[0]?.key ?? null,
      node_name: nodeBuckets[0]?.key ?? null,
      metric_families: metricBuckets.map((m) => m.key),
      time_range: { from: minTs ?? from, to: maxTs ?? to },
      freshness: computeFreshness(maxTs),
    };
  });
}

async function discoverLogSources(from: string, to: string): Promise<LogSource[]> {
  const res = await esFetch('/logs-*/_search?ignore_unavailable=true', {
    method: 'POST',
    body: {
      size: 0,
      query: { range: { '@timestamp': { gte: from, lte: to } } },
      aggs: {
        datasets: {
          terms: { field: 'data_stream.dataset', size: 200 },
          aggs: {
            svc: { terms: { field: 'service.name', size: 1 } },
            host: { terms: { field: 'host.name', size: 1 } },
            levels: { terms: { field: 'log.level', size: 10 } },
            min_ts: { min: { field: '@timestamp' } },
            max_ts: { max: { field: '@timestamp' } },
          },
        },
      },
    },
  });

  if (!res.ok) return [];

  const data = res.data as { aggregations?: Record<string, unknown> };
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const rangeDays = (toMs - fromMs) / (24 * 60 * 60 * 1000) || 1;

  return buckets(data.aggregations ?? {}, 'datasets').map((b): LogSource => {
    const dsAggs = b as unknown as Record<string, unknown>;
    const svcBuckets = buckets(dsAggs, 'svc');
    const hostBuckets = buckets(dsAggs, 'host');
    const levelBuckets = buckets(dsAggs, 'levels');
    const maxTs = aggValueAsString(dsAggs.max_ts);
    const minTs = aggValueAsString(dsAggs.min_ts);

    const levelDist: Record<string, number> = {};
    for (const lb of levelBuckets) {
      levelDist[lb.key] = lb.doc_count;
    }

    return {
      dataset: b.key,
      service_name: svcBuckets[0]?.key ?? null,
      host_name: hostBuckets[0]?.key ?? null,
      estimated_docs_per_day: Math.round(b.doc_count / rangeDays),
      is_structured: levelBuckets.length > 0,
      field_count: 0,
      time_range: { from: minTs ?? from, to: maxTs ?? to },
      freshness: computeFreshness(maxTs),
      log_level_distribution: Object.keys(levelDist).length > 0 ? levelDist : null,
    };
  });
}

async function discoverIoTProfiles(from: string, to: string): Promise<IoTProfile[]> {
  const indexPattern = 'metrics-generic.otel-*';
  const countRes = await esFetch(`/${indexPattern}/_count?ignore_unavailable=true`);
  if (!countRes.ok || ((countRes.data as { count?: number })?.count ?? 0) === 0) {
    return [];
  }

  const fieldCapsRes = await esFetch(`/${indexPattern}/_field_caps?fields=*&ignore_unavailable=true`);
  if (!fieldCapsRes.ok) return [];

  const fieldCapsData = fieldCapsRes.data as { fields?: Record<string, Record<string, { type: string }>> };
  const allFields = Object.keys(fieldCapsData.fields ?? {});

  const metricFields = allFields.filter(
    (f) => f.startsWith('metrics.') && !f.startsWith('metrics._')
  );
  const attributeFields = allFields.filter(
    (f) => f.startsWith('attributes.') && !f.startsWith('attributes._')
  );

  const hasSite = attributeFields.includes('attributes.site.name');
  const hasDeviceType = attributeFields.includes('attributes.device.type');

  const siteField = hasSite ? 'attributes.site.name' : null;
  const deviceField = hasDeviceType ? 'attributes.device.type' : null;

  const aggs: Record<string, unknown> = {
    min_ts: { min: { field: '@timestamp' } },
    max_ts: { max: { field: '@timestamp' } },
  };

  if (siteField) {
    aggs.sites = {
      terms: { field: siteField, size: 100 },
      aggs: deviceField
        ? { devices: { terms: { field: deviceField, size: 100 } } }
        : {},
    };
  } else if (deviceField) {
    aggs.devices = { terms: { field: deviceField, size: 100 } };
  }

  const res = await esFetch(`/${indexPattern}/_search?ignore_unavailable=true`, {
    method: 'POST',
    body: {
      size: 0,
      query: { range: { '@timestamp': { gte: from, lte: to } } },
      aggs,
    },
  });

  if (!res.ok) return [];

  const data = res.data as { hits?: { total?: { value?: number } }; aggregations?: Record<string, unknown> };
  const totalDocs = data.hits?.total?.value ?? (countRes.data as { count?: number })?.count ?? 0;
  const aggsResult = data.aggregations ?? {};
  const minTs = aggValueAsString(aggsResult.min_ts);
  const maxTs = aggValueAsString(aggsResult.max_ts);

  const sites: string[] = [];
  const deviceTypes: string[] = [];
  const devices: IoTDevice[] = [];

  if (siteField && aggsResult.sites) {
    for (const siteBucket of buckets(aggsResult, 'sites')) {
      sites.push(siteBucket.key);
      if (deviceField) {
        const siteAggs = siteBucket as unknown as Record<string, unknown>;
        for (const devBucket of buckets(siteAggs, 'devices')) {
          if (!deviceTypes.includes(devBucket.key)) deviceTypes.push(devBucket.key);
          devices.push({
            site: siteBucket.key,
            device_type: devBucket.key,
            metric_families: [],
            doc_count: devBucket.doc_count,
          });
        }
      } else {
        devices.push({
          site: siteBucket.key,
          device_type: 'unknown',
          metric_families: [],
          doc_count: siteBucket.doc_count,
        });
      }
    }
  } else if (deviceField && aggsResult.devices) {
    for (const devBucket of buckets(aggsResult, 'devices')) {
      deviceTypes.push(devBucket.key);
      devices.push({
        site: 'unknown',
        device_type: devBucket.key,
        metric_families: [],
        doc_count: devBucket.doc_count,
      });
    }
  }

  const metricFamilies = new Map<string, string[]>();
  for (const field of metricFields) {
    const parts = field.split('.');
    const family = parts.length >= 2 ? `${parts[0]!}.${parts[1]!}` : parts[0]!;
    if (!metricFamilies.has(family)) metricFamilies.set(family, []);
    metricFamilies.get(family)!.push(field);
  }

  for (const device of devices) {
    device.metric_families = Array.from(metricFamilies.entries()).map(([name, fields]) => ({
      name,
      fields,
      doc_count: device.doc_count,
    }));
  }

  return [
    {
      data_stream: indexPattern.replace('*', 'default'),
      sites,
      device_types: deviceTypes,
      devices,
      metric_fields: metricFields,
      attribute_fields: attributeFields,
      total_docs: totalDocs,
      time_range: { from: minTs ?? from, to: maxTs ?? to },
      freshness: computeFreshness(maxTs),
    },
  ];
}

async function discoverDataStreams(maxIndices: number): Promise<DataStreamInfo[]> {
  const res = await esFetch('/_resolve/index/*?expand_wildcards=open');
  if (!res.ok) return [];

  const data = res.data as { data_streams?: Array<{ name: string }> };
  const streams = (data.data_streams ?? []).slice(0, maxIndices);

  const results: DataStreamInfo[] = [];

  for (const stream of streams) {
    const { name } = stream;
    let dsType: DataStreamInfo['type'] = 'other';
    if (name.startsWith('traces-')) dsType = 'traces';
    else if (name.startsWith('metrics-')) dsType = 'metrics';
    else if (name.startsWith('logs-')) dsType = 'logs';

    const countRes = await esFetch(`/${name}/_count?ignore_unavailable=true`);
    const docCount = countRes.ok ? ((countRes.data as { count?: number })?.count ?? 0) : 0;

    const tsRes = await esFetch(`/${name}/_search?ignore_unavailable=true`, {
      method: 'POST',
      body: {
        size: 0,
        aggs: {
          min_ts: { min: { field: '@timestamp' } },
          max_ts: { max: { field: '@timestamp' } },
        },
      },
    });

    let timeRange: TimeRange = { from: '', to: '' };
    let freshness: DataFreshness = { last_document: '', status: 'no_data' };
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

    const keyFields = await fetchFieldProfiles(name);

    results.push({ name, type: dsType, doc_count: docCount, time_range: timeRange, freshness, key_fields: keyFields });
  }

  return results;
}

async function fetchFieldProfiles(index: string): Promise<FieldProfile[]> {
  const res = await esFetch(`/${index}/_field_caps?fields=*&ignore_unavailable=true`);
  if (!res.ok) return [];

  const data = res.data as { fields?: Record<string, Record<string, { type: string }>> };
  const fields = data.fields ?? {};

  const fieldEntries = Object.entries(fields)
    .filter(([name]) => !name.startsWith('_'))
    .slice(0, 30);

  return fieldEntries.map(([name, mapping]): FieldProfile => {
    const types = Object.values(mapping);
    const fieldType = types[0]?.type ?? 'unknown';
    return { name, type: fieldType, cardinality: 0, sample_values: [] };
  });
}

function formatResultAsMarkdown(result: DiscoveryResult): string {
  const lines: string[] = [];

  lines.push('# Observability Data Discovery');
  lines.push('');
  lines.push(`## Cluster: ${result.cluster_info.name}`);
  lines.push(`- Version: ${result.cluster_info.version}`);
  lines.push(`- Serverless: ${result.cluster_info.is_serverless ? 'Yes' : 'No'}`);
  lines.push(`- Discovery took: ${result.discovery_time_ms}ms`);

  if (result.services.length > 0) {
    lines.push('');
    lines.push(`## APM Services (${result.services.length})`);
    for (const svc of result.services) {
      const freshIcon = svc.freshness.status === 'active' ? '🟢' : svc.freshness.status === 'stale' ? '🟡' : '⚪';
      lines.push(`- **${svc.name}** ${freshIcon} [${svc.environment}] (${svc.language}) — ${svc.throughput_per_min} req/min`);
    }
  }

  if (result.hosts.length > 0) {
    lines.push('');
    lines.push(`## Hosts (${result.hosts.length})`);
    for (const host of result.hosts) {
      const freshIcon = host.freshness.status === 'active' ? '🟢' : host.freshness.status === 'stale' ? '🟡' : '⚪';
      lines.push(`- **${host.name}** ${freshIcon} — metrics: ${host.metric_types.join(', ') || 'none'}`);
    }
  }

  if (result.containers.length > 0) {
    lines.push('');
    lines.push(`## Containers (${result.containers.length})`);
    for (const c of result.containers) {
      const freshIcon = c.freshness.status === 'active' ? '🟢' : c.freshness.status === 'stale' ? '🟡' : '⚪';
      const label = c.name ?? c.pod_name ?? c.id.slice(0, 12);
      const ns = c.namespace ? ` [${c.namespace}]` : '';
      lines.push(`- **${label}**${ns} ${freshIcon} — metrics: ${c.metric_families.join(', ') || 'none'}`);
    }
  }

  if (result.log_sources.length > 0) {
    lines.push('');
    lines.push(`## Log Sources (${result.log_sources.length})`);
    for (const ls of result.log_sources) {
      const freshIcon = ls.freshness.status === 'active' ? '🟢' : ls.freshness.status === 'stale' ? '🟡' : '⚪';
      const svc = ls.service_name ? ` (service: ${ls.service_name})` : '';
      lines.push(`- **${ls.dataset}**${svc} ${freshIcon} — ~${ls.estimated_docs_per_day} docs/day`);
      if (ls.log_level_distribution) {
        const levels = Object.entries(ls.log_level_distribution)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        lines.push(`  levels: ${levels}`);
      }
    }
  }

  if (result.data_streams.length > 0) {
    lines.push('');
    lines.push(`## Data Streams (${result.data_streams.length})`);
    for (const ds of result.data_streams) {
      const freshIcon = ds.freshness.status === 'active' ? '🟢' : ds.freshness.status === 'stale' ? '🟡' : '⚪';
      lines.push(`- **${ds.name}** ${freshIcon} [${ds.type}] — ${ds.doc_count.toLocaleString()} docs`);
    }
  }

  if (result.iot_profiles.length > 0) {
    lines.push('');
    lines.push(`## IoT Data Profiles (${result.iot_profiles.length})`);
    for (const profile of result.iot_profiles) {
      const freshIcon = profile.freshness.status === 'active' ? '🟢' : profile.freshness.status === 'stale' ? '🟡' : '⚪';
      lines.push(`- **${profile.data_stream}** ${freshIcon} — ${profile.total_docs.toLocaleString()} docs`);
      lines.push(`  Sites: ${profile.sites.join(', ') || 'none detected'}`);
      lines.push(`  Device types: ${profile.device_types.join(', ') || 'none detected'}`);
      lines.push(`  Metric fields: ${profile.metric_fields.length} (${profile.metric_fields.slice(0, 5).join(', ')}${profile.metric_fields.length > 5 ? '...' : ''})`);
      lines.push(`  Attribute fields: ${profile.attribute_fields.length}`);
    }
  }

  return lines.join('\n');
}

export function registerDiscoverO11yData(server: ToolRegistrationContext): void {
  server.registerTool(
    'discover_o11y_data',
    {
      title: 'Discover O11Y Data',
      description:
        'Auto-detect APM services, host/container metrics, log streams, and data freshness across an Elastic deployment. Returns a rich profile of available observability data.',
      inputSchema: z.object({
        data_streams: z
          .array(z.string())
          .optional()
          .describe('Limit discovery to specific data stream patterns'),
        service_names: z
          .array(z.string())
          .optional()
          .describe('Limit APM discovery to specific service names'),
        time_range_from: z
          .string()
          .optional()
          .describe('Start of time range (ISO date or ES expression like "now-24h"). Defaults to now-24h'),
        time_range_to: z
          .string()
          .optional()
          .describe('End of time range (ISO date or ES expression like "now"). Defaults to now'),
        max_indices: z
          .number()
          .optional()
          .describe('Maximum number of data streams to profile in detail. Defaults to 50'),
      }),
    },
    async (args: unknown) => {
      const input = args as {
        data_streams?: string[];
        service_names?: string[];
        time_range_from?: string;
        time_range_to?: string;
        max_indices?: number;
      };

      const startTime = Date.now();

      const clusterResult = await fetchClusterInfo();
      if (!clusterResult.ok) {
        return {
          content: [{ type: 'text' as const, text: `Failed to connect to Elasticsearch: ${clusterResult.error}` }],
          isError: true,
        };
      }

      const now = new Date();
      const from = input.time_range_from ?? new Date(now.getTime() - DEFAULT_TIME_RANGE_MS).toISOString();
      const to = input.time_range_to ?? now.toISOString();
      const maxIndices = input.max_indices ?? DEFAULT_MAX_INDICES;

      const [services, hosts, containers, logSources, dataStreams, iotProfiles] = await Promise.all([
        discoverApmServices(from, to, input.service_names),
        discoverHosts(from, to),
        discoverContainers(from, to),
        discoverLogSources(from, to),
        discoverDataStreams(maxIndices),
        discoverIoTProfiles(from, to),
      ]);

      const result: DiscoveryResult = {
        cluster_info: clusterResult.info,
        services,
        hosts,
        containers,
        log_sources: logSources,
        data_streams: dataStreams,
        iot_profiles: iotProfiles,
        discovery_time_ms: Date.now() - startTime,
      };

      const clusterUuid = await getClusterUuid();
      if (clusterUuid) {
        writeCategory(clusterUuid, 'o11y', {
          services, hosts, containers, log_sources: logSources, iot_profiles: iotProfiles,
        }).catch(() => {});
      }

      const markdown = formatResultAsMarkdown(result);

      return {
        content: [{ type: 'text' as const, text: markdown }],
      };
    }
  );
}
