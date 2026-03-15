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
import { kibanaFetch } from '@elastic-cursor-plugin/shared-http';

interface DetectionRule {
  id: string;
  rule_id?: string;
  name: string;
  description?: string;
  type: string;
  severity: string;
  risk_score: number;
  enabled: boolean;
  tags?: string[];
  threat?: Array<{
    framework?: string;
    tactic?: { id?: string; name?: string };
    technique?: Array<{ id?: string; name?: string }>;
  }>;
}

const inputSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('list'),
    filter: z.string().optional().describe('KQL filter (e.g. alert.attributes.tags:"cloud")'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    enabled: z.boolean().optional().describe('Filter by enabled/disabled status'),
    page: z.number().optional().describe('Page number (default 1)'),
    per_page: z.number().min(1).max(100).optional().describe('Results per page (default 20)'),
  }),
  z.object({
    operation: z.literal('create'),
    name: z.string().describe('Rule name'),
    description: z.string().describe('Rule description'),
    type: z.enum(['query', 'eql', 'esql', 'threshold', 'machine_learning', 'new_terms', 'threat_match', 'saved_query']).describe('Rule type'),
    query: z.string().optional().describe('Detection query (KQL, EQL, or ES|QL depending on type)'),
    index: z.array(z.string()).optional().describe('Index patterns to query'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Alert severity'),
    risk_score: z.number().min(0).max(100).describe('Risk score (0-100)'),
    interval: z.string().optional().describe('Run frequency (default "5m")'),
    enabled: z.boolean().optional().describe('Enable immediately (default true)'),
    tags: z.array(z.string()).optional().describe('Rule tags'),
    language: z.enum(['kuery', 'lucene', 'eql', 'esql']).optional().describe('Query language (default depends on type: kuery for query, eql for eql, esql for esql)'),
    machine_learning_job_id: z.union([z.string(), z.array(z.string())]).optional().describe('ML job ID(s) — required for machine_learning type'),
    anomaly_threshold: z.number().min(0).max(100).optional().describe('Anomaly score threshold (0-100) — required for machine_learning type'),
    new_terms_fields: z.array(z.string()).optional().describe('Fields to check for new terms — required for new_terms type'),
    history_window_start: z.string().optional().describe('History window start (e.g. "now-7d") — required for new_terms type'),
    threat_query: z.string().optional().describe('Threat indicator query — required for threat_match type'),
    threat_index: z.array(z.string()).optional().describe('Threat indicator index patterns — required for threat_match type'),
    threat_mapping: z.array(z.object({
      entries: z.array(z.object({
        field: z.string(),
        type: z.literal('mapping'),
        value: z.string(),
      })),
    })).optional().describe('Threat mapping entries — required for threat_match type'),
    saved_id: z.string().optional().describe('Saved query ID — required for saved_query type'),
    threshold: z.object({
      field: z.array(z.string()),
      value: z.number(),
    }).optional().describe('Threshold configuration (required for threshold type)'),
    threat: z.array(z.object({
      tactic_id: z.string().describe('MITRE tactic ID (e.g. TA0001)'),
      tactic_name: z.string().describe('MITRE tactic name'),
      technique_id: z.string().optional().describe('MITRE technique ID'),
      technique_name: z.string().optional().describe('MITRE technique name'),
    })).optional().describe('MITRE ATT&CK mappings'),
  }),
  z.object({
    operation: z.literal('enable'),
    rule_id: z.string().describe('Rule ID to enable'),
  }),
  z.object({
    operation: z.literal('disable'),
    rule_id: z.string().describe('Rule ID to disable'),
  }),
  z.object({
    operation: z.literal('bulk_enable'),
    filter: z.string().optional().describe('KQL filter to select rules to enable'),
    tags: z.array(z.string()).optional().describe('Enable rules matching these tags'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  }),
  z.object({
    operation: z.literal('delete'),
    rule_id: z.string().describe('Rule ID to delete'),
    confirm: z.literal(true).describe('Must be true to confirm deletion'),
  }),
]);

type Input = z.infer<typeof inputSchema>;

async function listRules(input: Extract<Input, { operation: 'list' }>): Promise<string> {
  const parts = [
    `page=${input.page ?? 1}`,
    `per_page=${input.per_page ?? 20}`,
    'sort_field=name',
    'sort_order=asc',
  ];

  const filterParts: string[] = [];
  if (input.filter) filterParts.push(input.filter);
  if (input.severity) filterParts.push(`alert.attributes.params.severity:${input.severity}`);
  if (input.enabled !== undefined) filterParts.push(`alert.attributes.enabled:${input.enabled}`);

  if (filterParts.length > 0) {
    parts.push(`filter=${encodeURIComponent(filterParts.join(' AND '))}`);
  }

  const res = await kibanaFetch(`/api/detection_engine/rules/_find?${parts.join('&')}`);
  if (!res.ok) return `Failed to list rules: ${res.error ?? 'unknown error'}`;

  const body = res.data as { data?: DetectionRule[]; total?: number; page?: number; perPage?: number };
  const rules = body.data ?? [];
  const total = body.total ?? 0;

  if (rules.length === 0) return 'No detection rules found matching the criteria.';

  const lines = [
    `# Detection Rules (${total} total, showing ${rules.length})`,
    '',
  ];

  for (const rule of rules) {
    const status = rule.enabled ? 'enabled' : 'disabled';
    const mitre = rule.threat
      ?.map((t) => t.tactic?.name)
      .filter(Boolean)
      .join(', ') ?? '';
    lines.push(`- **${rule.name}** [${rule.type}, ${rule.severity}, ${status}]`);
    lines.push(`  ID: ${rule.id} | Risk: ${rule.risk_score}${mitre ? ` | MITRE: ${mitre}` : ''}`);
  }

  return lines.join('\n');
}

async function createRule(input: Extract<Input, { operation: 'create' }>): Promise<string> {
  const body: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    type: input.type,
    severity: input.severity,
    risk_score: input.risk_score,
    interval: input.interval ?? '5m',
    enabled: input.enabled ?? true,
    tags: input.tags ?? [],
    from: 'now-6m',
    to: 'now',
  };

  if (input.query) body.query = input.query;
  if (input.index) body.index = input.index;

  if (input.language) {
    body.language = input.language;
  } else if (input.type === 'query') {
    body.language = 'kuery';
  } else if (input.type === 'eql') {
    body.language = 'eql';
  } else if (input.type === 'esql') {
    body.language = 'esql';
  }

  if (input.threshold) body.threshold = input.threshold;
  if (input.machine_learning_job_id) body.machine_learning_job_id = input.machine_learning_job_id;
  if (input.anomaly_threshold !== undefined) body.anomaly_threshold = input.anomaly_threshold;
  if (input.new_terms_fields) body.new_terms_fields = input.new_terms_fields;
  if (input.history_window_start) body.history_window_start = input.history_window_start;
  if (input.threat_query) body.threat_query = input.threat_query;
  if (input.threat_index) body.threat_index = input.threat_index;
  if (input.threat_mapping) body.threat_mapping = input.threat_mapping;
  if (input.saved_id) body.saved_id = input.saved_id;

  if (input.threat) {
    body.threat = input.threat.map((t) => ({
      framework: 'MITRE ATT&CK',
      tactic: { id: t.tactic_id, name: t.tactic_name, reference: `https://attack.mitre.org/tactics/${t.tactic_id}/` },
      technique: t.technique_id
        ? [{ id: t.technique_id, name: t.technique_name ?? '', reference: `https://attack.mitre.org/techniques/${t.technique_id}/` }]
        : [],
    }));
  }

  const res = await kibanaFetch('/api/detection_engine/rules', {
    method: 'POST',
    body,
  });

  if (!res.ok) return `Failed to create rule: ${res.error ?? JSON.stringify(res.data)}`;

  const created = res.data as DetectionRule;
  return [
    '# Detection Rule Created',
    '',
    `- **Name:** ${created.name}`,
    `- **ID:** ${created.id}`,
    `- **Type:** ${created.type}`,
    `- **Severity:** ${created.severity}`,
    `- **Risk Score:** ${created.risk_score}`,
    `- **Enabled:** ${created.enabled}`,
  ].join('\n');
}

async function toggleRule(ruleId: string, enabled: boolean): Promise<string> {
  const res = await kibanaFetch('/api/detection_engine/rules', {
    method: 'PATCH',
    body: { id: ruleId, enabled },
  });

  if (!res.ok) return `Failed to ${enabled ? 'enable' : 'disable'} rule: ${res.error ?? 'unknown error'}`;
  const rule = res.data as DetectionRule;
  return `Rule "${rule.name}" (${ruleId}) has been ${enabled ? 'enabled' : 'disabled'}.`;
}

interface BulkActionResponse {
  attributes?: { results?: { updated?: unknown[] } };
  success?: boolean;
  rules_count?: number;
}

async function bulkEnable(input: Extract<Input, { operation: 'bulk_enable' }>): Promise<string> {
  const queryParts: string[] = [];
  if (input.filter) queryParts.push(input.filter);
  if (input.tags?.length) {
    queryParts.push(input.tags.map((t) => `alert.attributes.tags:"${t}"`).join(' OR '));
  }
  if (input.severity) {
    queryParts.push(`alert.attributes.params.severity:"${input.severity}"`);
  }

  const body: Record<string, unknown> = {
    action: 'enable',
  };

  if (queryParts.length > 0) {
    body.query = queryParts.join(' AND ');
  } else {
    const findRes = await kibanaFetch('/api/detection_engine/rules/_find?per_page=1&filter=alert.attributes.enabled:false');
    if (!findRes.ok) return `Failed to query rules: ${findRes.error ?? 'unknown error'}`;
    const findBody = findRes.data as { total?: number };
    if ((findBody.total ?? 0) === 0) return 'No disabled rules found.';
    body.query = 'alert.attributes.enabled:false';
  }

  const res = await kibanaFetch('/api/detection_engine/rules/_bulk_action', {
    method: 'POST',
    body,
  });

  if (!res.ok) return `Failed to bulk enable rules: ${res.error ?? 'unknown error'}`;

  const result = res.data as BulkActionResponse | undefined;
  const count = result?.attributes?.results?.updated?.length ?? result?.rules_count ?? 0;
  return `Bulk enable complete: ${count} rule(s) enabled.`;
}

async function deleteRule(ruleId: string): Promise<string> {
  const res = await kibanaFetch(`/api/detection_engine/rules?id=${ruleId}`, { method: 'DELETE' });
  if (!res.ok) return `Failed to delete rule: ${res.error ?? 'unknown error'}`;
  return `Rule ${ruleId} has been deleted.`;
}

export function registerManageDetectionRules(server: ToolRegistrationContext): void {
  server.registerTool(
    'manage_detection_rules',
    {
      title: 'Manage Detection Rules',
      description:
        'List, create, enable, disable, bulk enable, or delete Elastic Security detection rules. Supports KQL/EQL/ES|QL/threshold/ML rule types with MITRE ATT&CK mapping.',
      inputSchema,
    },
    async (args: unknown) => {
      const input = args as Input;

      switch (input.operation) {
        case 'list':
          return textResponse(await listRules(input));
        case 'create':
          return textResponse(await createRule(input));
        case 'enable':
          return textResponse(await toggleRule(input.rule_id, true));
        case 'disable':
          return textResponse(await toggleRule(input.rule_id, false));
        case 'bulk_enable':
          return textResponse(await bulkEnable(input));
        case 'delete':
          return textResponse(await deleteRule(input.rule_id));
        default:
          return errorResponse(`Unknown operation: ${(input as { operation: string }).operation}`);
      }
    }
  );
}
