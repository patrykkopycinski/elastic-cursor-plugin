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

interface CaseResponse {
  id: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  created_by: { username?: string };
  assignees?: Array<{ uid: string }>;
  totalComment: number;
  totalAlerts: number;
  connector: { id: string; name: string; type: string };
}

const inputSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('list'),
    status: z.enum(['open', 'in-progress', 'closed']).optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    tags: z.array(z.string()).optional().describe('Filter by tags'),
    page: z.number().optional(),
    per_page: z.number().optional(),
  }),
  z.object({
    operation: z.literal('get'),
    case_id: z.string().describe('Case ID to retrieve'),
  }),
  z.object({
    operation: z.literal('create'),
    title: z.string().describe('Case title'),
    description: z.string().describe('Case description'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Case severity (default low)'),
    tags: z.array(z.string()).optional().describe('Case tags'),
  }),
  z.object({
    operation: z.literal('update_status'),
    case_id: z.string().describe('Case ID'),
    status: z.enum(['open', 'in-progress', 'closed']).describe('New status'),
    version: z.string().describe('Case version (from get response, for optimistic concurrency)'),
  }),
  z.object({
    operation: z.literal('add_comment'),
    case_id: z.string().describe('Case ID'),
    comment: z.string().describe('Comment text (markdown supported)'),
  }),
  z.object({
    operation: z.literal('attach_alert'),
    case_id: z.string().describe('Case ID'),
    alert_id: z.string().describe('Alert ID to attach'),
    alert_index: z.string().optional().describe('Alert index (default .alerts-security.alerts-default)'),
    rule_id: z.string().optional().describe('Detection rule ID'),
    rule_name: z.string().optional().describe('Detection rule name'),
  }),
  z.object({
    operation: z.literal('delete'),
    case_ids: z.array(z.string()).describe('Case IDs to delete'),
    confirm: z.literal(true).describe('Must be true to confirm deletion'),
  }),
]);

type Input = z.infer<typeof inputSchema>;

async function listCases(input: Extract<Input, { operation: 'list' }>): Promise<string> {
  const parts = [
    `page=${input.page ?? 1}`,
    `perPage=${input.per_page ?? 20}`,
    'sortField=updated_at',
    'sortOrder=desc',
  ];
  if (input.status) parts.push(`status=${input.status}`);
  if (input.severity) parts.push(`severity=${input.severity}`);
  if (input.tags?.length) parts.push(`tags=${encodeURIComponent(input.tags.join(','))}`);

  const res = await kibanaFetch(`/api/cases/_find?${parts.join('&')}`);
  if (!res.ok) return `Failed to list cases: ${res.error ?? 'unknown error'}`;

  const body = res.data as { cases?: CaseResponse[]; total?: number };
  const cases = body.cases ?? [];
  const total = body.total ?? 0;

  if (cases.length === 0) return 'No cases found matching the criteria.';

  const lines = [`# Security Cases (${total} total)`, ''];

  for (const c of cases) {
    lines.push(`- **${c.title}** [${c.status}, ${c.severity}]`);
    lines.push(`  ID: ${c.id} | Alerts: ${c.totalAlerts} | Comments: ${c.totalComment} | Updated: ${c.updated_at}`);
    if (c.tags.length > 0) lines.push(`  Tags: ${c.tags.join(', ')}`);
  }

  return lines.join('\n');
}

async function getCase(caseId: string): Promise<string> {
  const res = await kibanaFetch(`/api/cases/${caseId}`);
  if (!res.ok) return `Failed to get case: ${res.error ?? 'not found'}`;

  const c = res.data as CaseResponse & { version: string; comments?: Array<{ comment?: string; created_at?: string; type?: string }> };

  const lines = [
    '# Case Details',
    '',
    `- **Title:** ${c.title}`,
    `- **ID:** ${c.id}`,
    `- **Version:** ${c.version}`,
    `- **Status:** ${c.status}`,
    `- **Severity:** ${c.severity}`,
    `- **Created:** ${c.created_at}`,
    `- **Updated:** ${c.updated_at}`,
    `- **Tags:** ${c.tags.join(', ') || 'none'}`,
    `- **Alerts:** ${c.totalAlerts}`,
    '',
    '## Description',
    c.description,
  ];

  if (c.comments?.length) {
    lines.push('', '## Comments');
    for (const comment of c.comments.slice(-10)) {
      if (comment.type === 'user' && comment.comment) {
        lines.push(`- [${comment.created_at}] ${comment.comment.slice(0, 200)}`);
      } else if (comment.type === 'alert') {
        lines.push(`- [${comment.created_at}] Alert attached`);
      }
    }
  }

  return lines.join('\n');
}

async function createCase(input: Extract<Input, { operation: 'create' }>): Promise<string> {
  const res = await kibanaFetch('/api/cases', {
    method: 'POST',
    body: {
      title: input.title,
      description: input.description,
      severity: input.severity ?? 'low',
      tags: input.tags ?? [],
      connector: { id: 'none', name: 'none', type: '.none', fields: null },
      settings: { syncAlerts: true },
      owner: 'securitySolution',
    },
  });

  if (!res.ok) return `Failed to create case: ${res.error ?? JSON.stringify(res.data)}`;

  const c = res.data as CaseResponse;
  return [
    '# Case Created',
    '',
    `- **Title:** ${c.title}`,
    `- **ID:** ${c.id}`,
    `- **Status:** ${c.status}`,
    `- **Severity:** ${c.severity}`,
  ].join('\n');
}

async function updateCaseStatus(input: Extract<Input, { operation: 'update_status' }>): Promise<string> {
  const res = await kibanaFetch('/api/cases', {
    method: 'PATCH',
    body: {
      cases: [{ id: input.case_id, version: input.version, status: input.status }],
    },
  });

  if (!res.ok) return `Failed to update case status: ${res.error ?? 'unknown error'}`;
  return `Case ${input.case_id} status updated to: ${input.status}.`;
}

async function addComment(caseId: string, comment: string): Promise<string> {
  const res = await kibanaFetch(`/api/cases/${caseId}/comments`, {
    method: 'POST',
    body: {
      type: 'user',
      comment,
      owner: 'securitySolution',
    },
  });

  if (!res.ok) return `Failed to add comment: ${res.error ?? 'unknown error'}`;
  return `Comment added to case ${caseId}.`;
}

async function attachAlert(input: Extract<Input, { operation: 'attach_alert' }>): Promise<string> {
  const body: Record<string, unknown> = {
    type: 'alert',
    alertId: input.alert_id,
    index: input.alert_index ?? '.alerts-security.alerts-default',
    owner: 'securitySolution',
  };

  if (input.rule_id || input.rule_name) {
    body.rule = { id: input.rule_id ?? '', name: input.rule_name ?? '' };
  }

  const res = await kibanaFetch(`/api/cases/${input.case_id}/comments`, {
    method: 'POST',
    body,
  });

  if (!res.ok) return `Failed to attach alert: ${res.error ?? 'unknown error'}`;
  return `Alert ${input.alert_id} attached to case ${input.case_id}.`;
}

async function deleteCases(caseIds: string[]): Promise<string> {
  const params = caseIds.map((id) => `ids=${id}`).join('&');
  const res = await kibanaFetch(`/api/cases?${params}`, { method: 'DELETE' });

  if (!res.ok) return `Failed to delete cases: ${res.error ?? 'unknown error'}`;
  return `Deleted ${caseIds.length} case(s).`;
}

export function registerManageCases(server: ToolRegistrationContext): void {
  server.registerTool(
    'manage_cases',
    {
      title: 'Manage Security Cases',
      description:
        'List, create, update, comment on, and manage Elastic Security cases for incident investigation tracking. Supports alert attachment and case lifecycle management.',
      inputSchema,
    },
    async (args: unknown) => {
      const input = args as Input;

      switch (input.operation) {
        case 'list':
          return textResponse(await listCases(input));
        case 'get':
          return textResponse(await getCase(input.case_id));
        case 'create':
          return textResponse(await createCase(input));
        case 'update_status':
          return textResponse(await updateCaseStatus(input));
        case 'add_comment':
          return textResponse(await addComment(input.case_id, input.comment));
        case 'attach_alert':
          return textResponse(await attachAlert(input));
        case 'delete':
          return textResponse(await deleteCases(input.case_ids));
        default:
          return errorResponse(`Unknown operation: ${(input as { operation: string }).operation}`);
      }
    }
  );
}
