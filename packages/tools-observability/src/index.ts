/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ToolRegistrationContext } from './types.js';
import { registerSetupApm } from './setup-apm.js';
import { registerSetupLogShipping } from './setup-log-shipping.js';
import { registerCreateAlertRule } from './create-alert-rule.js';
import { registerListAlertRules } from './list-alert-rules.js';
import { registerCreateDashboard } from './create-dashboard.js';
import { registerObservabilityInfo } from './observability-info.js';
import { registerDiscoverO11yData } from './discover-o11y-data.js';
import { registerCreateSlo } from './create-slo.js';
import { registerListSlos } from './list-slos.js';
import { registerGetSlo } from './get-slo.js';
import { registerUpdateSlo } from './update-slo.js';
import { registerDeleteSlo } from './delete-slo.js';
import { registerGetDataSummary } from './get-data-summary.js';
import { registerCreateIotDashboard } from './create-iot-dashboard.js';

export type { ToolRegistrationContext } from './types.js';
export { listTemplates, getTemplate, generateDashboard } from './templates/index.js';
export type { DashboardTemplate, DashboardConfig, DashboardOverrides, TemplateInfo } from './templates/index.js';

export function registerAll(server: ToolRegistrationContext): void {
  registerSetupApm(server);
  registerSetupLogShipping(server);
  registerCreateAlertRule(server);
  registerListAlertRules(server);
  registerCreateDashboard(server);
  registerObservabilityInfo(server);
  registerDiscoverO11yData(server);
  registerCreateSlo(server);
  registerListSlos(server);
  registerGetSlo(server);
  registerUpdateSlo(server);
  registerDeleteSlo(server);
  registerGetDataSummary(server);
  registerCreateIotDashboard(server);
}
