/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ToolRegistrationContext } from '@elastic-cursor-plugin/shared-types';
import { registerDiscoverData } from './discover-data.js';
import { registerDiscoverO11yData } from './discover-o11y-data.js';
import { registerGetDataSummary } from './get-data-summary.js';
import { registerCreateIotDashboard } from './create-iot-dashboard.js';
import { registerSetupApm } from './setup-apm.js';
import { registerSetupLogShipping } from './setup-log-shipping.js';
import { registerCreateAlertRule } from './create-alert-rule.js';
import { registerCreateDashboard } from './create-dashboard.js';
import { registerSiemQuickstart } from './siem-quickstart.js';
import { registerGenerateSearchUi } from './generate-search-ui.js';
import { registerGetDeploymentGuide } from './get-deployment-guide.js';
import { registerGetConnectionConfig } from './get-connection-config.js';
import { registerKibanaInfo } from './kibana-info.js';
import { registerDiscoverSecurityData } from './discover-security-data.js';
import { registerGetSecuritySummary } from './get-security-summary.js';
import { registerGetClusterContext } from './get-cluster-context.js';
import { registerRefreshClusterKnowledge } from './refresh-cluster-knowledge.js';
import { registerClearClusterKnowledge } from './clear-cluster-knowledge.js';
import { registerAllAgentBuilder } from './agent-builder.js';
import { registerManageDetectionRules } from './manage-detection-rules.js';
import { registerTriageAlerts } from './triage-alerts.js';
import { registerManageCases } from './manage-cases.js';

export type { ToolRegistrationContext } from '@elastic-cursor-plugin/shared-types';

export interface SmartToolsOptions {
  hasEs?: boolean;
  hasKibana?: boolean;
  hasCloud?: boolean;
}

export function registerAll(server: ToolRegistrationContext, options: SmartToolsOptions = {}): void {
  // Always register (no external deps)
  registerGetDeploymentGuide(server);
  registerGetConnectionConfig(server);
  registerSetupApm(server);
  registerSetupLogShipping(server);
  registerCreateDashboard(server);
  registerCreateAlertRule(server);
  registerSiemQuickstart(server);
  registerGenerateSearchUi(server);

  // Requires Elasticsearch
  if (options.hasEs) {
    registerDiscoverData(server);
    registerDiscoverO11yData(server);
    registerGetDataSummary(server);
    registerCreateIotDashboard(server);
    registerDiscoverSecurityData(server);
    registerGetSecuritySummary(server);
    registerGetClusterContext(server);
    registerRefreshClusterKnowledge(server);
    registerClearClusterKnowledge(server);
    registerKibanaInfo(server);
  }

  // Requires Kibana
  if (options.hasKibana) {
    registerManageDetectionRules(server);
    registerTriageAlerts(server);
    registerManageCases(server);
    registerAllAgentBuilder(server);
  }
}

export {
  registerDiscoverData,
  registerDiscoverO11yData,
  registerGetDataSummary,
  registerCreateIotDashboard,
  registerSetupApm,
  registerSetupLogShipping,
  registerCreateAlertRule,
  registerCreateDashboard,
  registerSiemQuickstart,
  registerGenerateSearchUi,
  registerGetDeploymentGuide,
  registerGetConnectionConfig,
  registerKibanaInfo,
  registerDiscoverSecurityData,
  registerGetSecuritySummary,
  registerGetClusterContext,
  registerRefreshClusterKnowledge,
  registerClearClusterKnowledge,
  registerAllAgentBuilder,
  registerManageDetectionRules,
  registerTriageAlerts,
  registerManageCases,
};
