/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { z } from 'zod';
import type { ToolRegistrationContext } from './types.js';
import type {
  DiscoveryResult,
  ApmService,
  HostInfo,
  LogSource,
  DataStreamInfo,
} from './discovery-types.js';
import type { SloConfig } from './slo-api-client.js';
import { listTemplates, generateDashboard } from './templates/index.js';
import type { DashboardConfig } from './templates/index.js';

interface CategoryStats {
  apm: { service_count: number; total_throughput_per_min: number; environments: string[] };
  metrics: { host_count: number; container_count: number; metric_types: string[] };
  logs: { source_count: number; total_docs_per_day: number; structured_count: number };
}

interface HealthIssue {
  severity: 'warning' | 'critical';
  category: string;
  entity: string;
  issue: string;
}

interface SloRecommendation {
  name: string;
  description: string;
  config: SloConfig;
}

interface DashboardRecommendation {
  template: string;
  description: string;
  config: DashboardConfig;
}

interface JsonSummary {
  cluster: { name: string; version: string; is_serverless: boolean };
  services: CategoryStats['apm'];
  metrics: CategoryStats['metrics'];
  logs: CategoryStats['logs'];
  recommendations: {
    dashboards: DashboardRecommendation[];
    slos: SloRecommendation[];
  };
  health: {
    issues: HealthIssue[];
    stale_streams: string[];
    overall: 'healthy' | 'degraded' | 'critical';
  };
}

function computeStats(data: DiscoveryResult): CategoryStats {
  const environments = new Set<string>();
  let totalThroughput = 0;
  for (const svc of data.services) {
    totalThroughput += svc.throughput_per_min;
    if (svc.environment) environments.add(svc.environment);
  }

  const metricTypes = new Set<string>();
  for (const host of data.hosts) {
    for (const mt of host.metric_types) metricTypes.add(mt);
  }

  let totalDocsPerDay = 0;
  let structuredCount = 0;
  for (const src of data.log_sources) {
    totalDocsPerDay += src.estimated_docs_per_day;
    if (src.is_structured) structuredCount++;
  }

  return {
    apm: {
      service_count: data.services.length,
      total_throughput_per_min: totalThroughput,
      environments: Array.from(environments),
    },
    metrics: {
      host_count: data.hosts.length,
      container_count: data.containers.length,
      metric_types: Array.from(metricTypes),
    },
    logs: {
      source_count: data.log_sources.length,
      total_docs_per_day: totalDocsPerDay,
      structured_count: structuredCount,
    },
  };
}

function detectHealthIssues(data: DiscoveryResult): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const checkFreshness = (
    category: string,
    entity: string,
    freshness: { status: string; last_document: string }
  ) => {
    if (freshness.status === 'stale') {
      issues.push({
        severity: 'warning',
        category,
        entity,
        issue: `Data is stale (last document: ${freshness.last_document})`,
      });
    } else if (freshness.status === 'no_data') {
      issues.push({
        severity: 'critical',
        category,
        entity,
        issue: 'No data found in the expected time range',
      });
    }
  };

  for (const svc of data.services) {
    checkFreshness('apm', svc.name, svc.freshness);
    if (svc.throughput_per_min < 1) {
      issues.push({
        severity: 'warning',
        category: 'apm',
        entity: svc.name,
        issue: `Very low throughput (${svc.throughput_per_min} req/min)`,
      });
    }
  }

  for (const host of data.hosts) {
    checkFreshness('metrics', host.name, host.freshness);
  }

  for (const src of data.log_sources) {
    checkFreshness('logs', src.dataset, src.freshness);
    if (src.estimated_docs_per_day < 10) {
      issues.push({
        severity: 'warning',
        category: 'logs',
        entity: src.dataset,
        issue: `Very low volume (${src.estimated_docs_per_day} docs/day)`,
      });
    }
  }

  for (const ds of data.data_streams) {
    checkFreshness('data_stream', ds.name, ds.freshness);
  }

  return issues;
}

function buildSloRecommendations(data: DiscoveryResult): SloRecommendation[] {
  const recommendations: SloRecommendation[] = [];

  for (const svc of data.services) {
    if (svc.freshness.status === 'no_data') continue;

    recommendations.push({
      name: `${svc.name} Latency SLO`,
      description: `Track p95 latency for ${svc.name} (${svc.environment})`,
      config: {
        name: `${svc.name} Latency SLO`,
        description: `p95 transaction duration stays below 500ms for ${svc.name}`,
        indicator: {
          type: 'sli.apm.transactionDuration',
          params: {
            service: svc.name,
            environment: svc.environment,
            transactionType: 'request',
            threshold: 500000,
            'threshold.comparator': 'lte',
          },
        },
        timeWindow: { duration: '30d', type: 'rolling' },
        objective: { target: 0.99 },
        budgetingMethod: 'occurrences',
        tags: ['generated', 'apm', svc.name],
      },
    });

    recommendations.push({
      name: `${svc.name} Error Rate SLO`,
      description: `Track error rate for ${svc.name} (${svc.environment})`,
      config: {
        name: `${svc.name} Error Rate SLO`,
        description: `Error rate stays below 1% for ${svc.name}`,
        indicator: {
          type: 'sli.apm.transactionErrorRate',
          params: {
            service: svc.name,
            environment: svc.environment,
            transactionType: 'request',
          },
        },
        timeWindow: { duration: '30d', type: 'rolling' },
        objective: { target: 0.99 },
        budgetingMethod: 'occurrences',
        tags: ['generated', 'apm', svc.name],
      },
    });
  }

  const metricsStreams = data.data_streams.filter((ds) => ds.type === 'metrics');
  for (const ds of metricsStreams) {
    if (ds.freshness.status === 'no_data') continue;

    const hasNumericField = ds.key_fields.some(
      (f) => f.type === 'long' || f.type === 'double' || f.type === 'float'
    );
    if (!hasNumericField) continue;

    recommendations.push({
      name: `${ds.name} Custom Metric SLO`,
      description: `Custom metric SLO based on ${ds.name} data stream`,
      config: {
        name: `${ds.name} Custom Metric SLO`,
        description: `Custom metric tracking for ${ds.name}`,
        indicator: {
          type: 'sli.metric.custom',
          params: {
            index: ds.name,
            good: {
              field: ds.key_fields.find((f) => f.type === 'double' || f.type === 'long')?.name ?? '_doc',
              aggregation: 'value_count',
            },
            total: { field: '_doc', aggregation: 'doc_count' },
          },
        },
        timeWindow: { duration: '30d', type: 'rolling' },
        objective: { target: 0.995 },
        budgetingMethod: 'occurrences',
        tags: ['generated', 'metrics', ds.name],
      },
    });
  }

  return recommendations;
}

function buildDashboardRecommendations(data: DiscoveryResult): DashboardRecommendation[] {
  const recommendations: DashboardRecommendation[] = [];

  if (data.services.length > 0) {
    recommendations.push({
      template: 'service-overview',
      description: `Service overview for ${data.services.length} APM service(s)`,
      config: generateDashboard('service-overview', data),
    });
  }

  if (data.hosts.length > 0) {
    recommendations.push({
      template: 'infrastructure-health',
      description: `Infrastructure health for ${data.hosts.length} host(s)`,
      config: generateDashboard('infrastructure-health', data),
    });
  }

  if (data.log_sources.length > 0) {
    recommendations.push({
      template: 'log-analysis',
      description: `Log analysis for ${data.log_sources.length} log source(s)`,
      config: generateDashboard('log-analysis', data),
    });
  }

  const categoryCount = [data.services.length, data.hosts.length, data.log_sources.length].filter(
    (n) => n > 0
  ).length;
  if (categoryCount >= 2) {
    recommendations.push({
      template: 'composite',
      description: `Composite observability overview combining ${categoryCount} data categories`,
      config: generateDashboard('composite', data),
    });
  }

  if ((data.iot_profiles ?? []).length > 0 && data.iot_profiles![0]!.metric_fields.length > 0) {
    const profile = data.iot_profiles![0]!;
    recommendations.push({
      template: 'iot-overview',
      description: `IoT dashboard for ${profile.sites.length} site(s), ${profile.device_types.length} device type(s), ${profile.metric_fields.length} metrics`,
      config: generateDashboard('iot-overview', data),
    });
  }

  return recommendations;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function buildTextSummary(
  data: DiscoveryResult,
  stats: CategoryStats,
  issues: HealthIssue[],
  dashboards: DashboardRecommendation[],
  slos: SloRecommendation[]
): string {
  const lines: string[] = [];

  lines.push(`# Data Summary — ${data.cluster_info.name}`);
  lines.push(`**Cluster version:** ${data.cluster_info.version} ${data.cluster_info.is_serverless ? '(Serverless)' : ''}`);
  lines.push('');

  lines.push('## APM Services');
  if (stats.apm.service_count === 0) {
    lines.push('_No APM services discovered._');
  } else {
    lines.push(`- **Services:** ${stats.apm.service_count}`);
    lines.push(`- **Total throughput:** ${formatNumber(stats.apm.total_throughput_per_min)} req/min`);
    lines.push(`- **Environments:** ${stats.apm.environments.join(', ') || 'none'}`);
    lines.push('');
    lines.push('| Service | Environment | Language | Throughput | Status |');
    lines.push('|---------|-------------|----------|------------|--------|');
    for (const svc of data.services) {
      lines.push(
        `| ${svc.name} | ${svc.environment} | ${svc.language} | ${formatNumber(svc.throughput_per_min)}/min | ${svc.freshness.status} |`
      );
    }
  }
  lines.push('');

  lines.push('## Infrastructure');
  if (stats.metrics.host_count === 0 && stats.metrics.container_count === 0) {
    lines.push('_No hosts or containers discovered._');
  } else {
    lines.push(`- **Hosts:** ${stats.metrics.host_count}`);
    lines.push(`- **Containers:** ${stats.metrics.container_count}`);
    lines.push(`- **Metric types:** ${stats.metrics.metric_types.join(', ') || 'none'}`);
  }
  lines.push('');

  lines.push('## Log Sources');
  if (stats.logs.source_count === 0) {
    lines.push('_No log sources discovered._');
  } else {
    lines.push(`- **Sources:** ${stats.logs.source_count} (${stats.logs.structured_count} structured)`);
    lines.push(`- **Estimated volume:** ${formatNumber(stats.logs.total_docs_per_day)} docs/day`);
    lines.push('');
    lines.push('| Dataset | Service | Host | Volume/day | Structured | Status |');
    lines.push('|---------|---------|------|------------|------------|--------|');
    for (const src of data.log_sources) {
      lines.push(
        `| ${src.dataset} | ${src.service_name ?? '—'} | ${src.host_name ?? '—'} | ${formatNumber(src.estimated_docs_per_day)} | ${src.is_structured ? 'Yes' : 'No'} | ${src.freshness.status} |`
      );
    }
  }
  lines.push('');

  if (data.iot_profiles?.length > 0) {
    lines.push('## IoT Data');
    for (const profile of data.iot_profiles) {
      lines.push(`- **Data stream:** ${profile.data_stream} — ${formatNumber(profile.total_docs)} docs`);
      lines.push(`- **Sites:** ${profile.sites.join(', ') || 'none detected'}`);
      lines.push(`- **Device types:** ${profile.device_types.join(', ') || 'none detected'}`);
      lines.push(`- **Metrics:** ${profile.metric_fields.length} (${profile.metric_fields.slice(0, 6).join(', ')}${profile.metric_fields.length > 6 ? '...' : ''})`);
      lines.push(`- **Status:** ${profile.freshness.status}`);
    }
    lines.push('');
  }

  lines.push('## Data Health');
  if (issues.length === 0) {
    lines.push('All data streams are healthy.');
  } else {
    const criticalCount = issues.filter((i) => i.severity === 'critical').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;
    lines.push(`**${criticalCount} critical, ${warningCount} warning issue(s) detected.**`);
    lines.push('');
    for (const issue of issues) {
      const icon = issue.severity === 'critical' ? '**CRITICAL**' : 'WARNING';
      lines.push(`- [${icon}] \`${issue.entity}\` (${issue.category}): ${issue.issue}`);
    }
  }
  lines.push('');

  lines.push('## Recommended Dashboards');
  if (dashboards.length === 0) {
    lines.push('_No dashboard recommendations — insufficient data._');
  } else {
    for (const rec of dashboards) {
      lines.push(`- **${rec.template}**: ${rec.description} (${rec.config.panels.length} panels)`);
    }
    lines.push('');
    lines.push('> Use `kibana_create_dashboard` with the recommended panel configurations to create these dashboards.');
  }
  lines.push('');

  lines.push('## Recommended SLOs');
  if (slos.length === 0) {
    lines.push('_No SLO recommendations — insufficient data._');
  } else {
    for (const rec of slos) {
      lines.push(`- **${rec.name}**: ${rec.description}`);
    }
    lines.push('');
    lines.push('> Use `create_slo` with the recommended configurations to create these SLOs.');
  }
  lines.push('');

  lines.push('## Available Templates');
  for (const tmpl of listTemplates()) {
    lines.push(`- **${tmpl.name}**: ${tmpl.description} (requires: ${tmpl.required_data.join(', ')})`);
  }

  return lines.join('\n');
}

function buildJsonSummary(
  data: DiscoveryResult,
  stats: CategoryStats,
  issues: HealthIssue[],
  dashboards: DashboardRecommendation[],
  slos: SloRecommendation[]
): JsonSummary {
  const staleStreams = data.data_streams
    .filter((ds) => ds.freshness.status === 'stale')
    .map((ds) => ds.name);

  const hasCritical = issues.some((i) => i.severity === 'critical');
  const overall = hasCritical ? 'critical' : issues.length > 0 ? 'degraded' : 'healthy';

  return {
    cluster: {
      name: data.cluster_info.name,
      version: data.cluster_info.version,
      is_serverless: data.cluster_info.is_serverless,
    },
    services: stats.apm,
    metrics: stats.metrics,
    logs: stats.logs,
    recommendations: { dashboards, slos },
    health: { issues, stale_streams: staleStreams, overall },
  };
}

export function registerGetDataSummary(server: ToolRegistrationContext): void {
  server.registerTool(
    'get_data_summary',
    {
      title: 'Get Data Summary',
      description:
        'Analyze discovery results and produce a comprehensive summary including per-category statistics, data health issues, recommended dashboards (with panel configs), and recommended SLO configurations.',
      inputSchema: z.object({
        discovery_result: z
          .record(z.unknown())
          .describe('The JSON output from the discover_observability_data tool'),
        format: z
          .enum(['text', 'json'])
          .default('text')
          .describe('Output format: "text" for markdown, "json" for structured data'),
      }),
    },
    async (args) => {
      const { discovery_result, format } = args as {
        discovery_result: Record<string, unknown>;
        format: 'text' | 'json';
      };

      try {
        const data = discovery_result as unknown as DiscoveryResult;

        if (!data.cluster_info || !Array.isArray(data.services)) {
          return {
            content: [{ type: 'text', text: 'Invalid discovery result: missing cluster_info or services array.' }],
            isError: true,
          };
        }

        const stats = computeStats(data);
        const issues = detectHealthIssues(data);
        const dashboards = buildDashboardRecommendations(data);
        const slos = buildSloRecommendations(data);

        if (format === 'json') {
          const summary = buildJsonSummary(data, stats, issues, dashboards, slos);
          return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
        }

        const text = buildTextSummary(data, stats, issues, dashboards, slos);
        return { content: [{ type: 'text', text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: `Failed to generate data summary: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
