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
    per_page: z.number().optional().describe('Results per page (default 20)'),
  }),
  z.object({
    operation: z.literal('create'),
    name: z.string().describe('Rule name'),
    description: z.string().describe('Rule description'),
    type: z.enum(['query', 'eql', 'esql', 'threshold', 'machine_learning']).describe('Rule type'),
    query: z.string().optional().describe('Detection query (KQL, EQL, or ES|QL depending on type)'),
    index: z.array(z.string()).optional().describe('Index patterns to query'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Alert severity'),
    risk_score: z.number().min(0).max(100).describe('Risk score (0-100)'),
    interval: z.string().optional().describe('Run frequency (default "5m")'),
    enabled: z.boolean().optional().describe('Enable immediately (default true)'),
    tags: z.array(z.string()).optional().describe('Rule tags'),
    threat: z.array(z.object({
      tactic_id: z.string().describe('MITRE tactic ID (e.g. TA0001)'),
      tactic_name: z.string().describe('MITRE tactic name'),
      technique_id: z.string().optional().describe('MITRE technique ID (e.g. T1059)'),
      technique_name: z.string().optional().describe('MITRE technique name'),
    })).optional().describe('MITRE ATT&CK mappings'),
    threshold: z.object({
      field: z.array(z.string()),
      value: z.number(),
    }).optional().describe('Threshold configuration (required for threshold type)'),
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
  if (input.filter) parts.push(`filter=${encodeURIComponent(input.filter)}`);

  const res = await kibanaFetch(`/api/detection_engine/rules/_find?${parts.join('&')}`);
  if (!res.ok) return `Failed to list rules: ${res.error ?? 'unknown error'}`;

  const body = res.data as { data?: DetectionRule[]; total?: number; page?: number; perPage?: number };
  const rules = body.data ?? [];
  const total = body.total ?? 0;

  if (rules.length === 0) return 'No detection rules found matching the criteria.';

  let filtered = rules;
  if (input.severity) filtered = filtered.filter((r) => r.severity === input.severity);
  if (input.enabled !== undefined) filtered = filtered.filter((r) => r.enabled === input.enabled);

  const lines = [
    `# Detection Rules (${total} total, showing ${filtered.length})`,
    '',
  ];

  for (const rule of filtered) {
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
  if (input.type === 'query') body.language = 'kuery';
  if (input.type === 'eql') body.language = 'eql';
  if (input.type === 'esql') body.language = 'esql';
  if (input.threshold) body.threshold = input.threshold;

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
  const getRes = await kibanaFetch(`/api/detection_engine/rules?id=${ruleId}`);
  if (!getRes.ok) return `Failed to find rule ${ruleId}: ${getRes.error ?? 'not found'}`;

  const rule = getRes.data as DetectionRule;
  const res = await kibanaFetch('/api/detection_engine/rules', {
    method: 'PUT',
    body: { id: ruleId, name: rule.name, description: rule.description ?? '', type: rule.type, severity: rule.severity, risk_score: rule.risk_score, enabled },
  });

  if (!res.ok) return `Failed to ${enabled ? 'enable' : 'disable'} rule: ${res.error ?? 'unknown error'}`;
  return `Rule "${rule.name}" (${ruleId}) has been ${enabled ? 'enabled' : 'disabled'}.`;
}

async function bulkEnable(input: Extract<Input, { operation: 'bulk_enable' }>): Promise<string> {
  const parts = ['per_page=100'];
  if (input.filter) parts.push(`filter=${encodeURIComponent(input.filter)}`);

  const res = await kibanaFetch(`/api/detection_engine/rules/_find?${parts.join('&')}`);
  if (!res.ok) return `Failed to query rules: ${res.error ?? 'unknown error'}`;

  const body = res.data as { data?: DetectionRule[] };
  let rules = body.data ?? [];

  if (input.tags?.length) {
    rules = rules.filter((r) => r.tags?.some((t) => input.tags!.includes(t)));
  }
  if (input.severity) {
    rules = rules.filter((r) => r.severity === input.severity);
  }

  const disabled = rules.filter((r) => !r.enabled);
  if (disabled.length === 0) return 'No disabled rules matching the criteria.';

  let enabled = 0;
  let failed = 0;
  for (const rule of disabled) {
    const toggleRes = await kibanaFetch('/api/detection_engine/rules', {
      method: 'PUT',
      body: { id: rule.id, name: rule.name, description: rule.description ?? '', type: rule.type, severity: rule.severity, risk_score: rule.risk_score, enabled: true },
    });
    if (toggleRes.ok) enabled++;
    else failed++;
  }

  return [
    `# Bulk Enable Results`,
    '',
    `- Matched: ${disabled.length} disabled rules`,
    `- Enabled: ${enabled}`,
    failed > 0 ? `- Failed: ${failed}` : '',
  ].filter(Boolean).join('\n');
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
