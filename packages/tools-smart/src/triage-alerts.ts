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

const ALERTS_INDEX = '.alerts-security.alerts-default';

interface EsAggBucket {
  key: string;
  doc_count: number;
}

const inputSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('list'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter by severity'),
    status: z.enum(['open', 'acknowledged', 'in-progress', 'closed']).optional().describe('Filter by status (default open)'),
    rule_name: z.string().optional().describe('Filter by rule name (partial match)'),
    host_name: z.string().optional().describe('Filter by host name'),
    user_name: z.string().optional().describe('Filter by user name'),
    time_range: z.string().optional().describe('Time range (ISO or ES expression, default now-24h)'),
    size: z.number().optional().describe('Number of alerts to return (default 20)'),
  }),
  z.object({
    operation: z.literal('get'),
    alert_id: z.string().describe('Alert ID to retrieve'),
  }),
  z.object({
    operation: z.literal('update_status'),
    alert_ids: z.array(z.string()).describe('Alert IDs to update'),
    status: z.enum(['open', 'acknowledged', 'in-progress', 'closed']).describe('New status'),
    reason: z.enum(['false_positive', 'duplicate', 'true_positive', 'benign_positive', 'automated_closure', 'other']).optional().describe('Close reason (only for closed status)'),
  }),
  z.object({
    operation: z.literal('summary'),
    time_range: z.string().optional().describe('Time range (default now-24h)'),
  }),
]);

type Input = z.infer<typeof inputSchema>;

async function listAlerts(input: Extract<Input, { operation: 'list' }>): Promise<string> {
  const filters: Array<Record<string, unknown>> = [];
  const status = input.status ?? 'open';
  filters.push({ term: { 'kibana.alert.workflow_status': status } });

  const from = input.time_range ?? 'now-24h';
  filters.push({ range: { '@timestamp': { gte: from } } });

  if (input.severity) filters.push({ term: { 'kibana.alert.severity': input.severity } });
  if (input.host_name) filters.push({ term: { 'host.name': input.host_name } });
  if (input.user_name) filters.push({ term: { 'user.name': input.user_name } });
  if (input.rule_name) filters.push({ wildcard: { 'kibana.alert.rule.name': `*${input.rule_name}*` } });

  const res = await esFetch(`/${ALERTS_INDEX}/_search?ignore_unavailable=true`, {
    method: 'POST',
    body: {
      size: input.size ?? 20,
      query: { bool: { filter: filters } },
      sort: [{ '@timestamp': 'desc' }],
      _source: [
        'kibana.alert.rule.name',
        'kibana.alert.severity',
        'kibana.alert.risk_score',
        'kibana.alert.workflow_status',
        'kibana.alert.reason',
        'host.name',
        'user.name',
        'source.ip',
        'destination.ip',
        'process.name',
        '@timestamp',
      ],
    },
  });

  if (!res.ok) return `Failed to query alerts: ${res.error ?? 'unknown error'}`;

  const data = res.data as {
    hits?: {
      total?: { value?: number } | number;
      hits?: Array<{ _id: string; _source: Record<string, unknown> }>;
    };
  };

  const total = typeof data.hits?.total === 'object'
    ? (data.hits.total as { value?: number }).value ?? 0
    : (data.hits?.total as number) ?? 0;

  const hits = data.hits?.hits ?? [];
  if (hits.length === 0) return `No ${status} alerts found matching the criteria.`;

  const lines = [`# Security Alerts (${total} total ${status})`, ''];

  for (const hit of hits) {
    const s = hit._source;
    const ruleName = getNestedField(s, 'kibana.alert.rule.name') ?? 'Unknown Rule';
    const severity = getNestedField(s, 'kibana.alert.severity') ?? 'unknown';
    const risk = getNestedField(s, 'kibana.alert.risk_score') ?? '?';
    const host = getNestedField(s, 'host.name') ?? '';
    const user = getNestedField(s, 'user.name') ?? '';
    const ts = s['@timestamp'] as string ?? '';

    lines.push(`- **${ruleName}** [${severity}, risk: ${risk}]`);
    lines.push(`  ID: ${hit._id} | ${ts}`);
    if (host || user) lines.push(`  Host: ${host} | User: ${user}`);
  }

  return lines.join('\n');
}

async function getAlert(alertId: string): Promise<string> {
  const res = await esFetch(`/${ALERTS_INDEX}/_doc/${alertId}`);
  if (!res.ok) return `Failed to retrieve alert ${alertId}: ${res.error ?? 'not found'}`;

  const doc = res.data as { _id: string; _source: Record<string, unknown> };
  const s = doc._source;

  const lines = [
    '# Alert Details',
    '',
    `- **Rule:** ${getNestedField(s, 'kibana.alert.rule.name') ?? 'Unknown'}`,
    `- **Severity:** ${getNestedField(s, 'kibana.alert.severity') ?? 'unknown'}`,
    `- **Risk Score:** ${getNestedField(s, 'kibana.alert.risk_score') ?? '?'}`,
    `- **Status:** ${getNestedField(s, 'kibana.alert.workflow_status') ?? 'unknown'}`,
    `- **Timestamp:** ${s['@timestamp'] ?? ''}`,
    '',
    '## Context',
    `- **Host:** ${getNestedField(s, 'host.name') ?? 'N/A'}`,
    `- **User:** ${getNestedField(s, 'user.name') ?? 'N/A'}`,
    `- **Source IP:** ${getNestedField(s, 'source.ip') ?? 'N/A'}`,
    `- **Destination IP:** ${getNestedField(s, 'destination.ip') ?? 'N/A'}`,
    `- **Process:** ${getNestedField(s, 'process.name') ?? 'N/A'}`,
    '',
    '## Reason',
    String(getNestedField(s, 'kibana.alert.reason') ?? 'No reason provided.'),
  ];

  const threat = getNestedField(s, 'kibana.alert.rule.threat') as Array<{
    tactic?: { name?: string };
    technique?: Array<{ id?: string; name?: string }>;
  }> | undefined;

  if (threat?.length) {
    lines.push('', '## MITRE ATT&CK');
    for (const t of threat) {
      if (t.tactic?.name) lines.push(`- Tactic: ${t.tactic.name}`);
      if (t.technique) {
        for (const tech of t.technique) {
          lines.push(`  - Technique: ${tech.id} ${tech.name ?? ''}`);
        }
      }
    }
  }

  return lines.join('\n');
}

async function updateAlertStatus(alertIds: string[], status: string, reason?: string): Promise<string> {
  const body: Record<string, unknown> = {
    signal_ids: alertIds,
    status,
  };
  if (reason && status === 'closed') {
    body.reason = reason;
  }

  const res = await kibanaFetch('/api/detection_engine/signals/status', {
    method: 'POST',
    body,
  });

  if (!res.ok) return `Failed to update alert status: ${res.error ?? 'unknown error'}`;
  return `Updated ${alertIds.length} alert(s) to status: ${status}.`;
}

async function alertSummary(timeRange: string): Promise<string> {
  const res = await esFetch(`/${ALERTS_INDEX}/_search?ignore_unavailable=true`, {
    method: 'POST',
    body: {
      size: 0,
      query: {
        bool: {
          filter: [
            { term: { 'kibana.alert.workflow_status': 'open' } },
            { range: { '@timestamp': { gte: timeRange } } },
          ],
        },
      },
      aggs: {
        by_severity: { terms: { field: 'kibana.alert.severity', size: 10 } },
        top_rules: { terms: { field: 'kibana.alert.rule.name', size: 10 } },
        by_host: { terms: { field: 'host.name', size: 10 } },
        over_time: {
          date_histogram: { field: '@timestamp', fixed_interval: '1h' },
        },
      },
    },
  });

  if (!res.ok) return `Failed to generate alert summary: ${res.error ?? 'unknown error'}`;

  const data = res.data as {
    hits?: { total?: { value?: number } | number };
    aggregations?: Record<string, { buckets?: EsAggBucket[] }>;
  };

  const total = typeof data.hits?.total === 'object'
    ? (data.hits.total as { value?: number }).value ?? 0
    : (data.hits?.total as number) ?? 0;

  const aggs = data.aggregations ?? {};
  const lines = ['# Alert Summary', '', `**Total Open Alerts:** ${total}`, ''];

  const sevBuckets = aggs.by_severity?.buckets ?? [];
  if (sevBuckets.length > 0) {
    lines.push('## By Severity');
    for (const b of sevBuckets) lines.push(`- ${b.key}: ${b.doc_count}`);
    lines.push('');
  }

  const ruleBuckets = aggs.top_rules?.buckets ?? [];
  if (ruleBuckets.length > 0) {
    lines.push('## Top Alerting Rules');
    for (const b of ruleBuckets) lines.push(`- ${b.key}: ${b.doc_count}`);
    lines.push('');
  }

  const hostBuckets = aggs.by_host?.buckets ?? [];
  if (hostBuckets.length > 0) {
    lines.push('## Top Affected Hosts');
    for (const b of hostBuckets) lines.push(`- ${b.key}: ${b.doc_count}`);
  }

  return lines.join('\n');
}

function getNestedField(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function registerTriageAlerts(server: ToolRegistrationContext): void {
  server.registerTool(
    'triage_alerts',
    {
      title: 'Triage Security Alerts',
      description:
        'List, view, update status, and summarize Elastic Security alerts. Supports filtering by severity, host, user, rule, and status.',
      inputSchema,
    },
    async (args: unknown) => {
      const input = args as Input;

      switch (input.operation) {
        case 'list':
          return textResponse(await listAlerts(input));
        case 'get':
          return textResponse(await getAlert(input.alert_id));
        case 'update_status':
          return textResponse(await updateAlertStatus(input.alert_ids, input.status, input.reason));
        case 'summary':
          return textResponse(await alertSummary(input.time_range ?? 'now-24h'));
        default:
          return errorResponse(`Unknown operation: ${(input as { operation: string }).operation}`);
      }
    }
  );
}
