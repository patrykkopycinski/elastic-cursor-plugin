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

function buildLogPanels(datasets: string[]): unknown[] {
  const datasetFilter = datasets.length > 0
    ? `data_stream.dataset IN (${datasets.map((d) => `"${d}"`).join(', ')})`
    : 'true';

  return [
    {
      type: 'DASHBOARD_MARKDOWN',
      title: 'Log Analysis',
      dataset: { type: 'esql', query: `ROW message = "placeholder"` },
      grid: { x: 0, y: 0, w: 48, h: 4 },
      markdown: `## Log Analysis\n**Datasets:** ${datasets.length > 0 ? datasets.join(', ') : 'all'}`,
    },
    {
      type: 'xy',
      title: 'Log Volume Over Time',
      dataset: {
        type: 'esql',
        query: [
          `FROM logs-*`,
          `| WHERE ${datasetFilter}`,
          `| STATS doc_count = COUNT(*)`,
          `  BY @timestamp = BUCKET(@timestamp, 15 minute)`,
        ].join(' '),
      },
      grid: { x: 0, y: 4, w: 48, h: 12 },
      layers: [
        {
          type: 'bar',
          xAccessor: '@timestamp',
          yAccessors: ['doc_count'],
        },
      ],
    },
    {
      type: 'xy',
      title: 'Error Count Trend',
      dataset: {
        type: 'esql',
        query: [
          `FROM logs-*`,
          `| WHERE ${datasetFilter} AND log.level == "error"`,
          `| STATS error_count = COUNT(*)`,
          `  BY @timestamp = BUCKET(@timestamp, 15 minute)`,
        ].join(' '),
      },
      grid: { x: 0, y: 16, w: 24, h: 12 },
      layers: [
        {
          type: 'line',
          xAccessor: '@timestamp',
          yAccessors: ['error_count'],
        },
      ],
    },
    {
      type: 'xy',
      title: 'Log Level Distribution',
      dataset: {
        type: 'esql',
        query: [
          `FROM logs-*`,
          `| WHERE ${datasetFilter}`,
          `| STATS count = COUNT(*)`,
          `  BY log.level, @timestamp = BUCKET(@timestamp, 15 minute)`,
        ].join(' '),
      },
      grid: { x: 24, y: 16, w: 24, h: 12 },
      layers: [
        {
          type: 'bar',
          xAccessor: '@timestamp',
          yAccessors: ['count'],
          splitAccessor: 'log.level',
        },
      ],
    },
    {
      type: 'datatable',
      title: 'Top Error Messages',
      dataset: {
        type: 'esql',
        query: [
          `FROM logs-*`,
          `| WHERE ${datasetFilter} AND log.level == "error"`,
          `| STATS count = COUNT(*) BY message`,
          `| SORT count DESC`,
          `| LIMIT 20`,
        ].join(' '),
      },
      grid: { x: 0, y: 28, w: 48, h: 10 },
    },
  ];
}

export const logAnalysisTemplate: DashboardTemplate = {
  info: {
    name: 'log-analysis',
    description: 'Log analysis dashboard with volume trends, error tracking, and level distribution',
    required_data: ['logs'],
  },

  generate(data: DiscoveryResult, overrides?: DashboardOverrides): DashboardConfig {
    const datasets = data.log_sources.map((l) => l.dataset);
    const panels: unknown[] = buildLogPanels(datasets);

    if (overrides?.additional_panels) {
      panels.push(...overrides.additional_panels);
    }

    return {
      title: overrides?.title ?? `Log Analysis — ${datasets.length} source(s)`,
      description: `Auto-generated log analysis dashboard for ${datasets.length} discovered log source(s).`,
      panels,
      time_from: overrides?.time_from ?? 'now-1h',
      time_to: overrides?.time_to ?? 'now',
      tags: ['logs', 'generated'],
    };
  },
};
