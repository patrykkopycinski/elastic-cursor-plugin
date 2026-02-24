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

function buildInfraPanels(hostNames: string[]): unknown[] {
  const hostFilter = hostNames.length > 0
    ? `host.name IN (${hostNames.map((h) => `"${h}"`).join(', ')})`
    : 'true';

  return [
    {
      type: 'DASHBOARD_MARKDOWN',
      title: 'Infrastructure Health',
      dataset: { type: 'esql', query: `ROW message = "placeholder"` },
      grid: { x: 0, y: 0, w: 48, h: 4 },
      markdown: `## Infrastructure Health\n**Hosts monitored:** ${hostNames.length || 'all'}`,
    },
    {
      type: 'xy',
      title: 'CPU Usage per Host',
      dataset: {
        type: 'esql',
        query: [
          `FROM metrics-system*`,
          `| WHERE ${hostFilter}`,
          `| STATS avg_cpu = AVG(system.cpu.total.norm.pct) * 100`,
          `  BY host.name, @timestamp = BUCKET(@timestamp, 5 minute)`,
        ].join(' '),
      },
      grid: { x: 0, y: 4, w: 24, h: 12 },
      layers: [
        {
          type: 'line',
          xAccessor: '@timestamp',
          yAccessors: ['avg_cpu'],
          splitAccessor: 'host.name',
        },
      ],
    },
    {
      type: 'gauge',
      title: 'Memory Usage',
      dataset: {
        type: 'esql',
        query: [
          `FROM metrics-system*`,
          `| WHERE ${hostFilter}`,
          `| STATS avg_mem = AVG(system.memory.actual.used.pct) * 100`,
        ].join(' '),
      },
      grid: { x: 24, y: 4, w: 24, h: 12 },
      metric: {
        accessor: 'avg_mem',
        suffix: '%',
        max: 100,
      },
    },
    {
      type: 'xy',
      title: 'Disk I/O',
      dataset: {
        type: 'esql',
        query: [
          `FROM metrics-system*`,
          `| WHERE ${hostFilter}`,
          `| STATS read_bytes = SUM(system.diskio.read.bytes),`,
          `        write_bytes = SUM(system.diskio.write.bytes)`,
          `  BY @timestamp = BUCKET(@timestamp, 5 minute)`,
        ].join(' '),
      },
      grid: { x: 0, y: 16, w: 24, h: 12 },
      layers: [
        {
          type: 'area',
          xAccessor: '@timestamp',
          yAccessors: ['read_bytes', 'write_bytes'],
        },
      ],
    },
    {
      type: 'xy',
      title: 'Network Throughput',
      dataset: {
        type: 'esql',
        query: [
          `FROM metrics-system*`,
          `| WHERE ${hostFilter}`,
          `| STATS in_bytes = SUM(system.network.in.bytes),`,
          `        out_bytes = SUM(system.network.out.bytes)`,
          `  BY @timestamp = BUCKET(@timestamp, 5 minute)`,
        ].join(' '),
      },
      grid: { x: 24, y: 16, w: 24, h: 12 },
      layers: [
        {
          type: 'area',
          xAccessor: '@timestamp',
          yAccessors: ['in_bytes', 'out_bytes'],
        },
      ],
    },
    {
      type: 'datatable',
      title: 'Top Hosts by CPU',
      dataset: {
        type: 'esql',
        query: [
          `FROM metrics-system*`,
          `| WHERE ${hostFilter}`,
          `| STATS avg_cpu = AVG(system.cpu.total.norm.pct) * 100,`,
          `        avg_mem = AVG(system.memory.actual.used.pct) * 100,`,
          `        avg_load = AVG(system.load.1)`,
          `  BY host.name`,
          `| SORT avg_cpu DESC`,
          `| LIMIT 20`,
        ].join(' '),
      },
      grid: { x: 0, y: 28, w: 48, h: 10 },
    },
  ];
}

export const infrastructureHealthTemplate: DashboardTemplate = {
  info: {
    name: 'infrastructure-health',
    description: 'Host infrastructure overview with CPU, memory, disk I/O, and network metrics',
    required_data: ['metrics'],
  },

  generate(data: DiscoveryResult, overrides?: DashboardOverrides): DashboardConfig {
    const hostNames = data.hosts.map((h) => h.name);
    const panels: unknown[] = buildInfraPanels(hostNames);

    if (overrides?.additional_panels) {
      panels.push(...overrides.additional_panels);
    }

    return {
      title: overrides?.title ?? `Infrastructure Health — ${hostNames.length} host(s)`,
      description: `Auto-generated infrastructure dashboard for ${hostNames.length} discovered host(s).`,
      panels,
      time_from: overrides?.time_from ?? 'now-1h',
      time_to: overrides?.time_to ?? 'now',
      tags: ['infrastructure', 'metrics', 'generated'],
    };
  },
};
