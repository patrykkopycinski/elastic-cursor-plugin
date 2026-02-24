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
import { generateDashboard } from './templates/index.js';
import type { DashboardConfig } from './templates/index.js';
import type {
  DiscoveryResult,
  IoTProfile,
  IoTDevice,
  DataFreshness,
} from './discovery-types.js';

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function computeFreshness(lastDocIso: string | null): DataFreshness {
  if (!lastDocIso) return { last_document: '', status: 'no_data' };
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

interface EsAggBucket { key: string; doc_count: number;[k: string]: unknown }
function buckets(aggs: Record<string, unknown>, name: string): EsAggBucket[] {
  const agg = aggs[name] as { buckets?: EsAggBucket[] } | undefined;
  return agg?.buckets ?? [];
}

async function discoverIoTData(
  indexPattern: string,
  from: string,
  to: string
): Promise<IoTProfile | null> {
  const countRes = await esFetch(`/${indexPattern}/_count?ignore_unavailable=true`);
  if (!countRes.ok || ((countRes.data as { count?: number })?.count ?? 0) === 0) {
    return null;
  }

  const fieldCapsRes = await esFetch(`/${indexPattern}/_field_caps?fields=*&ignore_unavailable=true`);
  if (!fieldCapsRes.ok) return null;

  const fieldCapsData = fieldCapsRes.data as { fields?: Record<string, Record<string, { type: string }>> };
  const allFields = Object.keys(fieldCapsData.fields ?? {});

  const metricFields = allFields.filter((f) => f.startsWith('metrics.') && !f.startsWith('metrics._'));
  const attributeFields = allFields.filter((f) => f.startsWith('attributes.') && !f.startsWith('attributes._'));

  if (metricFields.length === 0) return null;

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
      aggs: deviceField ? { devices: { terms: { field: deviceField, size: 100 } } } : {},
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
  if (!res.ok) return null;

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
          devices.push({ site: siteBucket.key, device_type: devBucket.key, metric_families: [], doc_count: devBucket.doc_count });
        }
      } else {
        devices.push({ site: siteBucket.key, device_type: 'unknown', metric_families: [], doc_count: siteBucket.doc_count });
      }
    }
  } else if (deviceField && aggsResult.devices) {
    for (const devBucket of buckets(aggsResult, 'devices')) {
      deviceTypes.push(devBucket.key);
      devices.push({ site: 'unknown', device_type: devBucket.key, metric_families: [], doc_count: devBucket.doc_count });
    }
  }

  return {
    data_stream: indexPattern.replace(/\*$/, 'default'),
    sites,
    device_types: deviceTypes,
    devices,
    metric_fields: metricFields,
    attribute_fields: attributeFields,
    total_docs: totalDocs,
    time_range: { from: minTs ?? from, to: maxTs ?? to },
    freshness: computeFreshness(maxTs),
  };
}

function buildDiscoveryResult(profile: IoTProfile): DiscoveryResult {
  return {
    cluster_info: { name: 'local', version: 'unknown', is_serverless: false },
    services: [],
    hosts: [],
    containers: [],
    log_sources: [],
    data_streams: [],
    iot_profiles: [profile],
    discovery_time_ms: 0,
  };
}

export function registerCreateIotDashboard(server: ToolRegistrationContext): void {
  server.registerTool(
    'create_iot_dashboard',
    {
      title: 'Create IoT Dashboard',
      description:
        'Automatically discover IoT/OTel metric data and generate a ready-to-use Kibana dashboard configuration. ' +
        'Chains data discovery (field profiling, site/device detection) with the iot-overview template to produce ' +
        'a complete dashboard with KPI panels, time-series charts, gauges, and summary tables. ' +
        'Returns the dashboard config that can be passed directly to `kibana_create_dashboard`.',
      inputSchema: z.object({
        index_pattern: z
          .string()
          .default('metrics-generic.otel-*')
          .describe('Index pattern for IoT data. Defaults to metrics-generic.otel-*'),
        title: z
          .string()
          .optional()
          .describe('Custom dashboard title'),
        time_from: z
          .string()
          .default('now-1h')
          .describe('Dashboard time range start. Defaults to now-1h'),
        time_to: z
          .string()
          .default('now')
          .describe('Dashboard time range end. Defaults to now'),
        discovery_time_from: z
          .string()
          .optional()
          .describe('Discovery query time range start (ISO or ES expression). Defaults to now-24h'),
        discovery_time_to: z
          .string()
          .optional()
          .describe('Discovery query time range end (ISO or ES expression). Defaults to now'),
      }),
    },
    async (args) => {
      const input = args as {
        index_pattern: string;
        title?: string;
        time_from: string;
        time_to: string;
        discovery_time_from?: string;
        discovery_time_to?: string;
      };

      const now = new Date();
      const from = input.discovery_time_from ?? new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const to = input.discovery_time_to ?? now.toISOString();

      const profile = await discoverIoTData(input.index_pattern, from, to);
      if (!profile) {
        return {
          content: [
            {
              type: 'text' as const,
              text: [
                `No IoT data found in \`${input.index_pattern}\`.`,
                '',
                'Ensure:',
                `1. Data exists in the index pattern \`${input.index_pattern}\``,
                '2. Metric fields use the `metrics.*` prefix (OTel convention)',
                '3. ES_URL and auth credentials are set correctly',
                '',
                'To ingest IoT data via OpenTelemetry, see the iot-demo example:',
                'https://github.com/poulsbopete/iot-demo',
              ].join('\n'),
            },
          ],
          isError: true,
        };
      }

      const discoveryResult = buildDiscoveryResult(profile);

      let dashboardConfig: DashboardConfig;
      try {
        dashboardConfig = generateDashboard('iot-overview', discoveryResult, {
          title: input.title,
          time_from: input.time_from,
          time_to: input.time_to,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Failed to generate dashboard: ${msg}` }],
          isError: true,
        };
      }

      const summary = [
        `# IoT Dashboard Generated`,
        '',
        `**Title:** ${dashboardConfig.title}`,
        `**Panels:** ${dashboardConfig.panels.length}`,
        `**Time range:** ${dashboardConfig.time_from} → ${dashboardConfig.time_to}`,
        '',
        '## Discovered Data',
        `- **Data stream:** ${profile.data_stream}`,
        `- **Total documents:** ${profile.total_docs.toLocaleString()}`,
        `- **Sites:** ${profile.sites.join(', ') || 'none detected'}`,
        `- **Device types:** ${profile.device_types.join(', ') || 'none detected'}`,
        `- **Metric fields (${profile.metric_fields.length}):** ${profile.metric_fields.join(', ')}`,
        `- **Attribute fields (${profile.attribute_fields.length}):** ${profile.attribute_fields.slice(0, 10).join(', ')}`,
        `- **Data freshness:** ${profile.freshness.status}`,
        '',
        '## Dashboard Configuration',
        '```json',
        JSON.stringify(dashboardConfig, null, 2),
        '```',
        '',
        '> Pass the above JSON to `kibana_create_dashboard` to create this dashboard in Kibana.',
      ].join('\n');

      return { content: [{ type: 'text' as const, text: summary }] };
    }
  );
}
