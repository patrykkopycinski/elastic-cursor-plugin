/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ToolRegistrationContext } from '@elastic-cursor-plugin/shared-types';
import { registerDiscoverO11yData } from './discover-o11y-data.js';
import { registerGetDataSummary } from './get-data-summary.js';
import { registerCreateIotDashboard } from './create-iot-dashboard.js';
import { registerSetupApm } from './setup-apm.js';
import { registerSetupLogShipping } from './setup-log-shipping.js';
import { registerCreateAlertRule } from './create-alert-rule.js';
import { registerCreateDashboard } from './create-dashboard.js';
import { registerObservabilityInfo } from './observability-info.js';
import { registerSiemQuickstart } from './siem-quickstart.js';
import { registerGenerateSearchUi } from './generate-search-ui.js';
import { registerGetDeploymentGuide } from './get-deployment-guide.js';
import { registerGetConnectionConfig } from './get-connection-config.js';
import { registerKibanaInfo } from './kibana-info.js';

export type { ToolRegistrationContext } from '@elastic-cursor-plugin/shared-types';

export interface SmartToolsOptions {
  hasEs?: boolean;
  hasKibana?: boolean;
  hasCloud?: boolean;
}

export function registerAll(server: ToolRegistrationContext, _options: SmartToolsOptions = {}): void {
  registerDiscoverO11yData(server);
  registerGetDataSummary(server);
  registerCreateIotDashboard(server);
  registerSetupApm(server);
  registerSetupLogShipping(server);
  registerCreateAlertRule(server);
  registerCreateDashboard(server);
  registerObservabilityInfo(server);
  registerSiemQuickstart(server);
  registerGenerateSearchUi(server);
  registerGetDeploymentGuide(server);
  registerGetConnectionConfig(server);
  registerKibanaInfo(server);
}

export {
  registerDiscoverO11yData,
  registerGetDataSummary,
  registerCreateIotDashboard,
  registerSetupApm,
  registerSetupLogShipping,
  registerCreateAlertRule,
  registerCreateDashboard,
  registerObservabilityInfo,
  registerSiemQuickstart,
  registerGenerateSearchUi,
  registerGetDeploymentGuide,
  registerGetConnectionConfig,
  registerKibanaInfo,
};
