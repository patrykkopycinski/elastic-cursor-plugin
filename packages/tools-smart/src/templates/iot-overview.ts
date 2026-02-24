/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { DiscoveryResult, IoTProfile } from '../discovery-types.js';
import type { DashboardTemplate, DashboardConfig, DashboardOverrides } from './index.js';


function buildHeaderPanel(profile: IoTProfile, yOffset: number): unknown {
  const sitesLabel = profile.sites.length > 0 ? profile.sites.join(', ') : 'all';
  const devicesLabel = profile.device_types.length > 0 ? profile.device_types.join(', ') : 'all';
  return {
    type: 'DASHBOARD_MARKDOWN',
    title: 'IoT Command Center',
    content: [
      `# IoT Command Center`,
      `**Sites:** ${sitesLabel} · **Device types:** ${devicesLabel} · **Metrics:** ${profile.metric_fields.length} · **Data stream:** ${profile.data_stream}`,
    ].join('\n'),
    grid: { x: 0, y: yOffset, w: 48, h: 5 },
  };
}

function buildKpiPanels(profile: IoTProfile, dataStream: string, yOffset: number): unknown[] {
  const panels: unknown[] = [];
  const kpiFields = profile.metric_fields.slice(0, 4);
  const panelWidth = kpiFields.length > 0 ? Math.floor(48 / kpiFields.length) : 12;

  for (let i = 0; i < kpiFields.length; i++) {
    const field = kpiFields[i]!;
    const label = field.replace(/^metrics\./, '').replace(/[._]/g, ' ');
    panels.push({
      type: 'metric',
      title: `Avg ${label}`,
      dataset: {
        type: 'esql',
        query: `FROM ${dataStream} | STATS avg_val = AVG(\`${field}\`)`,
      },
      metric: { operation: 'value', column: 'avg_val' },
      grid: { x: i * panelWidth, y: yOffset, w: panelWidth, h: 8 },
    });
  }

  return panels;
}

function buildTotalReadingsPanel(dataStream: string, yOffset: number): unknown {
  return {
    type: 'metric',
    title: 'Total Readings',
    dataset: {
      type: 'esql',
      query: `FROM ${dataStream} | STATS total = COUNT(*)`,
    },
    metric: { operation: 'value', column: 'total' },
    grid: { x: 36, y: yOffset, w: 12, h: 8 },
  };
}

function buildTimeSeriesPanels(
  profile: IoTProfile,
  dataStream: string,
  yOffset: number
): unknown[] {
  const panels: unknown[] = [];
  const chartFields = profile.metric_fields.slice(0, 4);
  const hasSites = profile.sites.length > 0;
  const breakdownField = hasSites ? 'attributes.site.name' : null;

  for (let i = 0; i < chartFields.length; i++) {
    const field = chartFields[i]!;
    const label = field.replace(/^metrics\./, '').replace(/[._]/g, ' ');
    const col = i % 2;
    const row = Math.floor(i / 2);

    const whereClause = `\`${field}\` IS NOT NULL`;
    const breakdownBy = breakdownField ? `, \`${breakdownField}\`` : '';
    const query = [
      `FROM ${dataStream}`,
      `| WHERE ${whereClause}`,
      `| STATS avg_val = AVG(\`${field}\`) BY @timestamp = BUCKET(@timestamp, 5 minute)${breakdownBy}`,
    ].join(' ');

    const layer: Record<string, unknown> = {
      type: 'line',
      x: { operation: 'value', column: '@timestamp' },
      y: [{ operation: 'value', column: 'avg_val', label }],
    };
    if (breakdownField) {
      layer.breakdown = { operation: 'value', column: breakdownField };
    }

    panels.push({
      type: 'xy',
      title: `${label} Over Time`,
      dataset: { type: 'esql', query },
      layers: [layer],
      grid: { x: col * 24, y: yOffset + row * 12, w: 24, h: 12 },
    });
  }

  return panels;
}

function buildGaugePanel(
  profile: IoTProfile,
  dataStream: string,
  yOffset: number
): unknown | null {
  const gaugeField = profile.metric_fields.find(
    (f) =>
      f.includes('ph') ||
      f.includes('temperature') ||
      f.includes('humidity') ||
      f.includes('pressure') ||
      f.includes('level')
  );
  if (!gaugeField) return null;

  const label = gaugeField.replace(/^metrics\./, '').replace(/[._]/g, ' ');
  return {
    type: 'gauge',
    title: label,
    dataset: {
      type: 'esql',
      query: `FROM ${dataStream} | STATS avg_val = AVG(\`${gaugeField}\`)`,
    },
    metric: { operation: 'value', column: 'avg_val' },
    grid: { x: 0, y: yOffset, w: 16, h: 10 },
  };
}

function buildSiteSummaryTable(
  profile: IoTProfile,
  dataStream: string,
  yOffset: number
): unknown | null {
  if (profile.sites.length === 0 && profile.device_types.length === 0) return null;

  const groupByParts: string[] = [];
  const rowColumns: unknown[] = [];

  if (profile.sites.length > 0) {
    groupByParts.push('`attributes.site.name`');
    rowColumns.push({ operation: 'value', column: 'attributes.site.name', label: 'Site' });
  }
  if (profile.device_types.length > 0) {
    groupByParts.push('`attributes.device.type`');
    rowColumns.push({ operation: 'value', column: 'attributes.device.type', label: 'Device Type' });
  }

  const metricAggs = profile.metric_fields.slice(0, 4).map((f) => {
    const alias = f.replace(/^metrics\./, '').replace(/\./g, '_');
    return `avg_${alias} = AVG(\`${f}\`)`;
  });

  const metricColumns = profile.metric_fields.slice(0, 4).map((f) => {
    const alias = f.replace(/^metrics\./, '').replace(/\./g, '_');
    const label = f.replace(/^metrics\./, '').replace(/[._]/g, ' ');
    return { operation: 'value', column: `avg_${alias}`, label: `Avg ${label}` };
  });

  const query = [
    `FROM ${dataStream}`,
    `| STATS ${[...metricAggs, 'readings = COUNT(*)'].join(', ')}`,
    `  BY ${groupByParts.join(', ')}`,
    `| SORT ${groupByParts[0]}`,
  ].join(' ');

  return {
    type: 'datatable',
    title: 'Metrics Summary by Site and Device',
    dataset: { type: 'esql', query },
    rows: rowColumns,
    metrics: [
      ...metricColumns,
      { operation: 'value', column: 'readings', label: 'Readings' },
    ],
    grid: { x: 0, y: yOffset, w: 48, h: 10 },
  };
}

export const iotOverviewTemplate: DashboardTemplate = {
  info: {
    name: 'iot-overview',
    description:
      'IoT device monitoring dashboard with KPI metrics, time-series charts, gauges, and device summary tables. Auto-populates from OTel metric data.',
    required_data: ['metrics'],
  },

  generate(data: DiscoveryResult, overrides?: DashboardOverrides): DashboardConfig {
    const profile = data.iot_profiles?.[0];
    if (!profile || profile.metric_fields.length === 0) {
      return {
        title: overrides?.title ?? 'IoT Overview',
        description: 'No IoT data found in discovery results.',
        panels: [],
        time_from: overrides?.time_from ?? 'now-1h',
        time_to: overrides?.time_to ?? 'now',
        tags: ['iot', 'generated'],
      };
    }

    const dataStream = profile.data_stream;
    const panels: unknown[] = [];
    let y = 0;

    panels.push(buildHeaderPanel(profile, y));
    y += 5;

    const kpiFields = profile.metric_fields.slice(0, 4);
    if (kpiFields.length < 4) {
      panels.push(...buildKpiPanels(profile, dataStream, y));
    } else {
      const kpiPanels = buildKpiPanels(profile, dataStream, y);
      kpiPanels.splice(3, kpiPanels.length - 3);
      panels.push(...kpiPanels);
      panels.push(buildTotalReadingsPanel(dataStream, y));
    }
    y += 8;

    const tsPanels = buildTimeSeriesPanels(profile, dataStream, y);
    panels.push(...tsPanels);
    y += Math.ceil(Math.min(profile.metric_fields.length, 4) / 2) * 12;

    const gauge = buildGaugePanel(profile, dataStream, y);
    if (gauge) {
      panels.push(gauge);

      const extraField = profile.metric_fields.find(
        (f) =>
          !f.includes('ph') &&
          !f.includes('temperature') &&
          !f.includes('humidity') &&
          !f.includes('pressure') &&
          !f.includes('level')
      );
      if (extraField) {
        const label = extraField.replace(/^metrics\./, '').replace(/[._]/g, ' ');
        const breakdownField = profile.sites.length > 0 ? 'attributes.site.name' : null;
        const breakdownBy = breakdownField ? `, \`${breakdownField}\`` : '';
        panels.push({
          type: 'xy',
          title: `${label} Over Time`,
          dataset: {
            type: 'esql',
            query: [
              `FROM ${dataStream}`,
              `| WHERE \`${extraField}\` IS NOT NULL`,
              `| STATS avg_val = AVG(\`${extraField}\`) BY @timestamp = BUCKET(@timestamp, 5 minute)${breakdownBy}`,
            ].join(' '),
          },
          layers: [
            {
              type: 'area',
              x: { operation: 'value', column: '@timestamp' },
              y: [{ operation: 'value', column: 'avg_val', label }],
              ...(breakdownField
                ? { breakdown: { operation: 'value', column: breakdownField } }
                : {}),
            },
          ],
          grid: { x: 16, y, w: 32, h: 10 },
        });
      }
      y += 10;
    }

    const table = buildSiteSummaryTable(profile, dataStream, y);
    if (table) {
      panels.push(table);
      y += 10;
    }

    if (overrides?.additional_panels) {
      panels.push(...overrides.additional_panels);
    }

    const titleParts = [
      'IoT Overview',
      profile.sites.length > 0 ? `${profile.sites.length} site(s)` : null,
      profile.device_types.length > 0 ? `${profile.device_types.length} device type(s)` : null,
    ]
      .filter(Boolean)
      .join(' — ');

    return {
      title: overrides?.title ?? titleParts,
      description: `Auto-generated IoT dashboard with ${profile.metric_fields.length} metrics across ${profile.sites.length} sites and ${profile.device_types.length} device types.`,
      panels,
      time_from: overrides?.time_from ?? 'now-1h',
      time_to: overrides?.time_to ?? 'now',
      tags: ['iot', 'otel', 'generated'],
    };
  },
};
