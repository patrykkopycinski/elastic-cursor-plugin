/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { DiscoveryResult } from '../discovery-types.js';
import type { DashboardTemplate, DashboardConfig, DashboardOverrides } from './index.js';

function buildServicePanels(serviceName: string, environment: string): unknown[] {
  const envFilter = environment && environment !== '*'
    ? ` AND service.environment == "${environment}"`
    : '';
  const baseFilter = `service.name == "${serviceName}"${envFilter}`;

  return [
    {
      type: 'DASHBOARD_MARKDOWN',
      title: 'Service Info',
      dataset: {
        type: 'esql',
        query: `ROW message = "placeholder"`,
      },
      grid: { x: 0, y: 0, w: 48, h: 4 },
      markdown: `## ${serviceName}\n**Environment:** ${environment || 'all'}`,
    },
    {
      type: 'xy',
      title: `Latency (p50 / p95 / p99) — ${serviceName}`,
      dataset: {
        type: 'esql',
        query: [
          `FROM traces-apm*`,
          `| WHERE ${baseFilter}`,
          `| STATS p50 = PERCENTILE(transaction.duration.us, 50),`,
          `        p95 = PERCENTILE(transaction.duration.us, 95),`,
          `        p99 = PERCENTILE(transaction.duration.us, 99)`,
          `  BY @timestamp = BUCKET(@timestamp, 5 minute)`,
        ].join(' '),
      },
      grid: { x: 0, y: 4, w: 24, h: 12 },
      layers: [
        {
          type: 'line',
          xAccessor: '@timestamp',
          yAccessors: ['p50', 'p95', 'p99'],
        },
      ],
    },
    {
      type: 'xy',
      title: `Throughput — ${serviceName}`,
      dataset: {
        type: 'esql',
        query: [
          `FROM traces-apm*`,
          `| WHERE ${baseFilter}`,
          `| STATS count = COUNT(*)`,
          `  BY @timestamp = BUCKET(@timestamp, 5 minute)`,
        ].join(' '),
      },
      grid: { x: 24, y: 4, w: 24, h: 12 },
      layers: [
        {
          type: 'line',
          xAccessor: '@timestamp',
          yAccessors: ['count'],
        },
      ],
    },
    {
      type: 'metric',
      title: `Error Rate — ${serviceName}`,
      dataset: {
        type: 'esql',
        query: [
          `FROM traces-apm*`,
          `| WHERE ${baseFilter}`,
          `| STATS error_rate = AVG(CASE(event.outcome == "failure", 1, 0)) * 100`,
        ].join(' '),
      },
      grid: { x: 0, y: 16, w: 16, h: 8 },
      metric: {
        accessor: 'error_rate',
        suffix: '%',
      },
    },
    {
      type: 'datatable',
      title: `Top Transactions by Latency — ${serviceName}`,
      dataset: {
        type: 'esql',
        query: [
          `FROM traces-apm*`,
          `| WHERE ${baseFilter}`,
          `| STATS avg_duration = AVG(transaction.duration.us),`,
          `        p95_duration = PERCENTILE(transaction.duration.us, 95),`,
          `        count = COUNT(*)`,
          `  BY transaction.name`,
          `| SORT avg_duration DESC`,
          `| LIMIT 20`,
        ].join(' '),
      },
      grid: { x: 16, y: 16, w: 32, h: 8 },
    },
  ];
}

export const serviceOverviewTemplate: DashboardTemplate = {
  info: {
    name: 'service-overview',
    description: 'APM service overview with latency, throughput, error rate, and top transactions',
    required_data: ['apm'],
  },

  generate(data: DiscoveryResult, overrides?: DashboardOverrides): DashboardConfig {
    const services = data.services;
    if (services.length === 0) {
      return {
        title: overrides?.title ?? 'Service Overview',
        description: 'No APM services found in discovery data.',
        panels: [],
        time_from: overrides?.time_from ?? 'now-1h',
        time_to: overrides?.time_to ?? 'now',
        tags: ['apm', 'generated'],
      };
    }

    const panels: unknown[] = [];
    let yOffset = 0;

    for (const service of services) {
      const servicePanels = buildServicePanels(service.name, service.environment);
      for (const panel of servicePanels) {
        const p = panel as { grid: { y: number } };
        p.grid.y += yOffset;
        panels.push(panel);
      }
      yOffset += 24;
    }

    if (overrides?.additional_panels) {
      panels.push(...overrides.additional_panels);
    }

    return {
      title: overrides?.title ?? `Service Overview — ${services.map((s) => s.name).join(', ')}`,
      description: `Auto-generated service overview for ${services.length} APM service(s).`,
      panels,
      time_from: overrides?.time_from ?? 'now-1h',
      time_to: overrides?.time_to ?? 'now',
      tags: ['apm', 'generated'],
    };
  },
};
