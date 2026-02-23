/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { DiscoveryResult } from '../discovery-types.js';
import { serviceOverviewTemplate } from './service-overview.js';
import { infrastructureHealthTemplate } from './infrastructure-health.js';
import { logAnalysisTemplate } from './log-analysis.js';
import { compositeTemplate } from './composite.js';
import { iotOverviewTemplate } from './iot-overview.js';

export interface TemplateInfo {
  name: string;
  description: string;
  required_data: ('apm' | 'metrics' | 'logs')[];
}

export interface DashboardTemplate {
  info: TemplateInfo;
  generate(data: DiscoveryResult, overrides?: DashboardOverrides): DashboardConfig;
}

export interface DashboardOverrides {
  title?: string;
  time_from?: string;
  time_to?: string;
  additional_panels?: unknown[];
}

export interface DashboardConfig {
  title: string;
  description: string;
  panels: unknown[];
  time_from: string;
  time_to: string;
  tags?: string[];
}

const templates: Map<string, DashboardTemplate> = new Map([
  ['service-overview', serviceOverviewTemplate],
  ['infrastructure-health', infrastructureHealthTemplate],
  ['log-analysis', logAnalysisTemplate],
  ['composite', compositeTemplate],
  ['iot-overview', iotOverviewTemplate],
]);

export function listTemplates(): TemplateInfo[] {
  return Array.from(templates.values()).map((t) => t.info);
}

export function getTemplate(name: string): DashboardTemplate | null {
  return templates.get(name) ?? null;
}

export function generateDashboard(
  templateName: string,
  discoveryResult: DiscoveryResult,
  overrides?: Partial<DashboardOverrides>
): DashboardConfig {
  const template = templates.get(templateName);
  if (!template) {
    throw new Error(
      `Unknown template "${templateName}". Available: ${Array.from(templates.keys()).join(', ')}`
    );
  }
  return template.generate(discoveryResult, overrides);
}
