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
import { createSloApiClient, ok, fail, getKibanaUrl } from './slo-api-client.js';
import type { SloIndicator, SloConfig } from './slo-api-client.js';

const apmTransactionDurationSchema = z.object({
  type: z.literal('sli.apm.transactionDuration'),
  service: z.string().describe('APM service name'),
  environment: z.string().describe('APM environment (e.g. "production")'),
  transaction_type: z.string().describe('Transaction type (e.g. "request")'),
  transaction_name: z.string().optional().describe('Specific transaction name'),
  threshold: z.number().describe('Latency threshold in milliseconds'),
  comparator: z.enum(['GT', 'GTE', 'LT', 'LTE']).describe('Comparator for the threshold'),
});

const apmTransactionErrorRateSchema = z.object({
  type: z.literal('sli.apm.transactionErrorRate'),
  service: z.string().describe('APM service name'),
  environment: z.string().describe('APM environment (e.g. "production")'),
  transaction_type: z.string().describe('Transaction type (e.g. "request")'),
  transaction_name: z.string().optional().describe('Specific transaction name'),
});

const kqlCustomSchema = z.object({
  type: z.literal('sli.kql.custom'),
  index: z.string().describe('Index pattern (e.g. "my-index-*")'),
  filter: z.string().optional().describe('KQL filter applied to all events'),
  good: z.string().describe('KQL filter for good events'),
  total: z.string().describe('KQL filter for total events'),
  timestamp_field: z.string().describe('Timestamp field name (e.g. "@timestamp")'),
});

const metricAggSchema = z.object({
  field: z.string().describe('Field to aggregate'),
  aggregation: z.enum(['value_count', 'sum', 'doc_count']).describe('Aggregation type'),
  filter: z.string().optional().describe('KQL filter for this metric'),
});

const metricCustomSchema = z.object({
  type: z.literal('sli.metric.custom'),
  index: z.string().describe('Index pattern'),
  filter: z.string().optional().describe('KQL filter applied to all events'),
  good: metricAggSchema.describe('Good events metric definition'),
  total: metricAggSchema.describe('Total events metric definition'),
  timestamp_field: z.string().optional().describe('Timestamp field name'),
});

const indicatorSchema = z.discriminatedUnion('type', [
  apmTransactionDurationSchema,
  apmTransactionErrorRateSchema,
  kqlCustomSchema,
  metricCustomSchema,
]);

const inputSchema = z.object({
  name: z.string().describe('SLO name'),
  description: z.string().optional().describe('SLO description'),
  indicator: indicatorSchema.describe('SLI indicator definition'),
  time_window: z.object({
    duration: z.string().describe('Window duration (e.g. "30d", "7d", "1M")'),
    type: z.enum(['rolling', 'calendarAligned']).describe('Window type'),
  }),
  objective: z.object({
    target: z.number().min(0).max(100).describe('Target percentage (0-100, e.g. 99.9)'),
  }),
  tags: z.array(z.string()).optional().describe('Tags for the SLO'),
});

function toApiIndicator(input: z.infer<typeof indicatorSchema>): SloIndicator {
  switch (input.type) {
    case 'sli.apm.transactionDuration':
      return {
        type: input.type,
        params: {
          service: input.service,
          environment: input.environment,
          transactionType: input.transaction_type,
          transactionName: input.transaction_name,
          threshold: input.threshold,
          'threshold.comparator': input.comparator,
        },
      };
    case 'sli.apm.transactionErrorRate':
      return {
        type: input.type,
        params: {
          service: input.service,
          environment: input.environment,
          transactionType: input.transaction_type,
          transactionName: input.transaction_name,
        },
      };
    case 'sli.kql.custom':
      return {
        type: input.type,
        params: {
          index: input.index,
          filter: input.filter,
          good: input.good,
          total: input.total,
          timestampField: input.timestamp_field,
        },
      };
    case 'sli.metric.custom':
      return {
        type: input.type,
        params: {
          index: input.index,
          filter: input.filter,
          good: input.good,
          total: input.total,
          timestampField: input.timestamp_field,
        },
      };
  }
}

export function registerCreateSlo(server: ToolRegistrationContext): void {
  server.registerTool(
    'create_slo',
    {
      title: 'Create SLO',
      description:
        'Create a Service Level Objective (SLO) in Elastic Observability. ' +
        'Supports 4 SLI types: APM transaction duration, APM transaction error rate, KQL custom, and metric custom. ' +
        'Requires KIBANA_URL and auth (KIBANA_API_KEY or KIBANA_USERNAME/KIBANA_PASSWORD).',
      inputSchema,
    },
    async (args) => {
      if (!getKibanaUrl()) {
        return fail('Set KIBANA_URL and auth (KIBANA_API_KEY or KIBANA_USERNAME/KIBANA_PASSWORD) to create SLOs.');
      }

      const input = args as z.infer<typeof inputSchema>;
      const config: SloConfig = {
        name: input.name,
        description: input.description,
        indicator: toApiIndicator(input.indicator),
        timeWindow: {
          duration: input.time_window.duration,
          type: input.time_window.type,
        },
        objective: {
          target: input.objective.target / 100,
        },
        budgetingMethod: 'occurrences',
        tags: input.tags,
      };

      const client = createSloApiClient();
      const result = await client.create(config);

      if (!result.ok) {
        return fail(`Failed to create SLO "${input.name}": ${result.error}`);
      }

      const data = result.data as { id?: string };
      return ok(
        [
          `SLO created successfully.`,
          `  Name: ${input.name}`,
          data?.id ? `  ID: ${data.id}` : '',
          `  Indicator: ${input.indicator.type}`,
          `  Target: ${input.objective.target}%`,
          `  Window: ${input.time_window.duration} (${input.time_window.type})`,
        ]
          .filter(Boolean)
          .join('\n')
      );
    }
  );
}
