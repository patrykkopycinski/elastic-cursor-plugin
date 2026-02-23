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
import { serviceOverviewTemplate } from './service-overview.js';
import { infrastructureHealthTemplate } from './infrastructure-health.js';
import { logAnalysisTemplate } from './log-analysis.js';

type DataCategory = 'apm' | 'metrics' | 'logs';

function detectAvailableCategories(data: DiscoveryResult): DataCategory[] {
  const categories: DataCategory[] = [];
  if (data.services.length > 0) categories.push('apm');
  if (data.hosts.length > 0) categories.push('metrics');
  if (data.log_sources.length > 0) categories.push('logs');
  return categories;
}

function shiftPanelsVertically(panels: unknown[], offset: number): unknown[] {
  return panels.map((panel) => {
    const p = panel as { grid?: { x: number; y: number; w: number; h: number } };
    if (p.grid) {
      return { ...p, grid: { ...p.grid, y: p.grid.y + offset } };
    }
    return panel;
  });
}

function maxPanelBottom(panels: unknown[]): number {
  let max = 0;
  for (const panel of panels) {
    const p = panel as { grid?: { y: number; h: number } };
    if (p.grid) {
      max = Math.max(max, p.grid.y + p.grid.h);
    }
  }
  return max;
}

export const compositeTemplate: DashboardTemplate = {
  info: {
    name: 'composite',
    description:
      'Combined dashboard that merges service overview, infrastructure health, and log analysis panels based on available data categories',
    required_data: ['apm', 'metrics', 'logs'],
  },

  generate(data: DiscoveryResult, overrides?: DashboardOverrides): DashboardConfig {
    const available = detectAvailableCategories(data);
    const allPanels: unknown[] = [];
    let yOffset = 0;

    const sectionTemplates: Array<{ category: DataCategory; template: DashboardTemplate }> = [
      { category: 'apm', template: serviceOverviewTemplate },
      { category: 'metrics', template: infrastructureHealthTemplate },
      { category: 'logs', template: logAnalysisTemplate },
    ];

    const includedSections: string[] = [];

    for (const { category, template } of sectionTemplates) {
      if (!available.includes(category)) continue;

      const sectionDashboard = template.generate(data);
      if (sectionDashboard.panels.length === 0) continue;

      const shifted = shiftPanelsVertically(sectionDashboard.panels, yOffset);
      allPanels.push(...shifted);
      yOffset += maxPanelBottom(sectionDashboard.panels);
      includedSections.push(category);
    }

    if (overrides?.additional_panels) {
      allPanels.push(...overrides.additional_panels);
    }

    const sectionLabel = includedSections.length > 0
      ? includedSections.join(' + ')
      : 'no data';

    return {
      title: overrides?.title ?? `Observability Overview (${sectionLabel})`,
      description: `Auto-generated composite dashboard combining ${includedSections.join(', ')} panels.`,
      panels: allPanels,
      time_from: overrides?.time_from ?? 'now-1h',
      time_to: overrides?.time_to ?? 'now',
      tags: ['composite', 'generated', ...includedSections],
    };
  },
};
