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
import { esFetch, kibanaFetch } from '@elastic-cursor-plugin/shared-http';
import type {
  SecurityDiscoveryResult,
  SecurityDataSource,
  RuleCoverage,
  AlertSummary,
} from './security-discovery-types.js';
import { SECURITY_INDEX_PATTERNS } from './security-discovery-types.js';

const DEFAULT_TIME_RANGE_MS = 24 * 60 * 60 * 1000;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

interface EsAggBucket {
  key: string;
  doc_count: number;
  [k: string]: unknown;
}

function computeFreshness(lastDocIso: string | null): SecurityDataSource['freshness'] {
  if (!lastDocIso) return { last_document: '', status: 'no_data' };
  const age = Date.now() - new Date(lastDocIso).getTime();
  return { last_document: lastDocIso, status: age < STALE_THRESHOLD_MS ? 'active' : 'stale' };
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

async function fetchClusterInfo(): Promise<{ name: string; version: string; uuid: string } | null> {
  const res = await esFetch('/');
  if (!res.ok) return null;
  const d = res.data as Record<string, unknown>;
  const version = d.version as Record<string, unknown> | undefined;
  return {
    name: (d.cluster_name as string) ?? 'unknown',
    version: (version?.number as string) ?? 'unknown',
    uuid: (d.cluster_uuid as string) ?? 'unknown',
  };
}

async function discoverDataSources(
  from: string,
  to: string,
  filterCategories?: string[]
): Promise<SecurityDataSource[]> {
  const patterns = filterCategories?.length
    ? SECURITY_INDEX_PATTERNS.filter((p) => filterCategories.includes(p.category))
    : SECURITY_INDEX_PATTERNS;

  const results = await Promise.all(
    patterns.map(async ({ pattern, category, label }): Promise<SecurityDataSource | null> => {
      const res = await esFetch(`/${pattern}/_search?ignore_unavailable=true`, {
        method: 'POST',
        body: {
          size: 0,
          query: { range: { '@timestamp': { gte: from, lte: to } } },
          aggs: {
            min_ts: { min: { field: '@timestamp' } },
            max_ts: { max: { field: '@timestamp' } },
          },
        },
      });

      if (!res.ok) return null;

      const data = res.data as {
        hits?: { total?: { value?: number } | number };
        aggregations?: Record<string, unknown>;
      };

      const total = typeof data.hits?.total === 'object'
        ? (data.hits.total as { value?: number }).value ?? 0
        : (data.hits?.total as number) ?? 0;

      if (total === 0) return null;

      const aggs = data.aggregations ?? {};
      const minTs = aggValueAsString(aggs.min_ts);
      const maxTs = aggValueAsString(aggs.max_ts);

      return {
        name: label,
        category,
        index_pattern: pattern,
        doc_count: total,
        time_range: { from: minTs ?? from, to: maxTs ?? to },
        freshness: computeFreshness(maxTs),
      };
    })
  );

  return results.filter((r): r is SecurityDataSource => r !== null);
}

async function discoverRuleCoverage(): Promise<RuleCoverage | null> {
  const allRules: Array<Record<string, unknown>> = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await kibanaFetch(
      `/api/detection_engine/rules/_find?page=${page}&per_page=${perPage}&sort_field=name&sort_order=asc`
    );
    if (!res.ok) return null;

    const body = res.data as { data?: Array<Record<string, unknown>>; total?: number };
    const rules = body.data ?? [];
    allRules.push(...rules);

    if (allRules.length >= (body.total ?? 0) || rules.length < perPage) break;
    page++;
  }

  if (allRules.length === 0) return null;

  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const mitreSet = new Set<string>();
  const tacticSet = new Set<string>();
  let enabled = 0;
  let withExceptions = 0;

  for (const rule of allRules) {
    if (rule.enabled) enabled++;

    const ruleType = (rule.type as string) ?? 'unknown';
    byType[ruleType] = (byType[ruleType] ?? 0) + 1;

    const severity = (rule.severity as string) ?? 'unknown';
    bySeverity[severity] = (bySeverity[severity] ?? 0) + 1;

    const threat = rule.threat as Array<{ framework?: string; technique?: Array<{ id?: string }>; tactic?: { name?: string } }> | undefined;
    if (threat) {
      for (const t of threat) {
        if (t.tactic?.name) tacticSet.add(t.tactic.name);
        if (t.technique) {
          for (const tech of t.technique) {
            if (tech.id) mitreSet.add(tech.id);
          }
        }
      }
    }

    const exList = rule.exceptions_list as unknown[] | undefined;
    if (exList && exList.length > 0) withExceptions++;
  }

  return {
    total: allRules.length,
    enabled,
    disabled: allRules.length - enabled,
    by_type: byType,
    by_severity: bySeverity,
    mitre_techniques: Array.from(mitreSet).sort(),
    mitre_tactics: Array.from(tacticSet).sort(),
    rules_with_exceptions: withExceptions,
  };
}

async function discoverAlertVolume(from: string, to: string): Promise<AlertSummary | null> {
  const res = await esFetch('/.alerts-security*/_search?ignore_unavailable=true', {
    method: 'POST',
    body: {
      size: 0,
      query: {
        bool: {
          filter: [
            { term: { 'kibana.alert.workflow_status': 'open' } },
            { range: { '@timestamp': { gte: from, lte: to } } },
          ],
        },
      },
      aggs: {
        by_severity: { terms: { field: 'kibana.alert.severity', size: 10 } },
        top_rules: { terms: { field: 'kibana.alert.rule.name', size: 5 } },
      },
    },
  });

  if (!res.ok) return null;

  const data = res.data as {
    hits?: { total?: { value?: number } | number };
    aggregations?: Record<string, unknown>;
  };

  const totalOpen = typeof data.hits?.total === 'object'
    ? (data.hits.total as { value?: number }).value ?? 0
    : (data.hits?.total as number) ?? 0;

  if (totalOpen === 0) return null;

  const aggs = data.aggregations ?? {};

  const bySeverity: Record<string, number> = {};
  const sevBuckets = (aggs.by_severity as { buckets?: EsAggBucket[] })?.buckets ?? [];
  for (const b of sevBuckets) bySeverity[b.key] = b.doc_count;

  const topRules: Array<{ name: string; count: number }> = [];
  const ruleBuckets = (aggs.top_rules as { buckets?: EsAggBucket[] })?.buckets ?? [];
  for (const b of ruleBuckets) topRules.push({ name: b.key, count: b.doc_count });

  return { total_open: totalOpen, by_severity: bySeverity, top_rules: topRules };
}

function formatResultAsMarkdown(result: SecurityDiscoveryResult): string {
  const lines: string[] = [];

  lines.push('# Security Data Discovery');
  lines.push('');
  lines.push(`## Cluster: ${result.cluster_info.name}`);
  lines.push(`- Version: ${result.cluster_info.version}`);
  lines.push(`- Discovery took: ${result.discovery_time_ms}ms`);

  if (result.data_sources.length > 0) {
    lines.push('');
    lines.push(`## Data Sources (${result.data_sources.length})`);
    const byCategory = new Map<string, SecurityDataSource[]>();
    for (const ds of result.data_sources) {
      if (!byCategory.has(ds.category)) byCategory.set(ds.category, []);
      byCategory.get(ds.category)!.push(ds);
    }
    for (const [cat, sources] of byCategory) {
      lines.push(`\n### ${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
      for (const ds of sources) {
        const icon = ds.freshness.status === 'active' ? '🟢' : ds.freshness.status === 'stale' ? '🟡' : '⚪';
        lines.push(`- **${ds.name}** ${icon} — ${ds.doc_count.toLocaleString()} docs (${ds.index_pattern})`);
      }
    }
  } else {
    lines.push('');
    lines.push('## Data Sources');
    lines.push('No security-relevant data sources found. Consider deploying Elastic Defend or enabling a Filebeat security module.');
  }

  if (result.rule_coverage) {
    const rc = result.rule_coverage;
    lines.push('');
    lines.push('## Detection Rule Coverage');
    lines.push(`- Total rules: ${rc.total} (${rc.enabled} enabled, ${rc.disabled} disabled)`);
    lines.push(`- Rules with exceptions: ${rc.rules_with_exceptions}`);

    if (Object.keys(rc.by_type).length > 0) {
      lines.push(`- By type: ${Object.entries(rc.by_type).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    }
    if (Object.keys(rc.by_severity).length > 0) {
      lines.push(`- By severity: ${Object.entries(rc.by_severity).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    }
    if (rc.mitre_tactics.length > 0) {
      lines.push(`- MITRE ATT&CK tactics covered: ${rc.mitre_tactics.length}/14 (${rc.mitre_tactics.join(', ')})`);
    }
    if (rc.mitre_techniques.length > 0) {
      lines.push(`- MITRE techniques: ${rc.mitre_techniques.length} unique (${rc.mitre_techniques.slice(0, 10).join(', ')}${rc.mitre_techniques.length > 10 ? '...' : ''})`);
    }
  } else {
    lines.push('');
    lines.push('## Detection Rule Coverage');
    lines.push('Detection rule profiling unavailable (Kibana not configured or unreachable).');
  }

  if (result.alert_summary) {
    const as = result.alert_summary;
    lines.push('');
    lines.push('## Alert Summary');
    lines.push(`- Open alerts: ${as.total_open}`);
    if (Object.keys(as.by_severity).length > 0) {
      lines.push(`- By severity: ${Object.entries(as.by_severity).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    }
    if (as.top_rules.length > 0) {
      lines.push('- Top alerting rules:');
      for (const r of as.top_rules) {
        lines.push(`  - ${r.name}: ${r.count} alerts`);
      }
    }
  } else {
    lines.push('');
    lines.push('## Alert Summary');
    lines.push('No open security alerts in the configured time range.');
  }

  return lines.join('\n');
}

export function registerDiscoverSecurityData(server: ToolRegistrationContext): void {
  server.registerTool(
    'discover_security_data',
    {
      title: 'Discover Security Data',
      description:
        'Auto-detect security data sources (Endpoint, Auditbeat, cloud security logs), detection rule coverage, and alert volumes across an Elastic deployment.',
      inputSchema: z.object({
        time_range_from: z
          .string()
          .optional()
          .describe('Start of time range (ISO date or ES expression). Defaults to now-24h'),
        time_range_to: z
          .string()
          .optional()
          .describe('End of time range (ISO date or ES expression). Defaults to now'),
        data_sources: z
          .array(z.string())
          .optional()
          .describe('Limit to specific categories: endpoint, audit, windows, network, cloud, alerts'),
        include_rules: z
          .boolean()
          .optional()
          .describe('Include detection rule coverage profiling (default true, requires Kibana)'),
      }),
    },
    async (args: unknown) => {
      const input = args as {
        time_range_from?: string;
        time_range_to?: string;
        data_sources?: string[];
        include_rules?: boolean;
      };

      const startTime = Date.now();

      const clusterInfo = await fetchClusterInfo();
      if (!clusterInfo) {
        return errorResponse('Failed to connect to Elasticsearch');
      }

      const now = new Date();
      const from = input.time_range_from ?? new Date(now.getTime() - DEFAULT_TIME_RANGE_MS).toISOString();
      const to = input.time_range_to ?? now.toISOString();
      const includeRules = input.include_rules !== false;

      const [dataSources, ruleCoverage, alertSummary] = await Promise.all([
        discoverDataSources(from, to, input.data_sources),
        includeRules ? discoverRuleCoverage() : Promise.resolve(null),
        discoverAlertVolume(from, to),
      ]);

      const result: SecurityDiscoveryResult = {
        cluster_info: clusterInfo,
        data_sources: dataSources,
        rule_coverage: ruleCoverage,
        alert_summary: alertSummary,
        discovery_time_ms: Date.now() - startTime,
      };

      return textResponse(formatResultAsMarkdown(result));
    }
  );
}
