/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ToolRegistrationContext } from './types.js';
import { registerCreateDetectionRule } from './create-detection-rule.js';
import { registerListDetectionRules } from './list-detection-rules.js';
import { registerEnableDetectionRules } from './enable-detection-rules.js';
import { registerGetSecurityAlerts } from './get-security-alerts.js';
import { registerUpdateAlertStatus } from './update-alert-status.js';
import { registerAddRuleException } from './add-rule-exception.js';
import { registerSiemQuickstart } from './siem-quickstart.js';

export type { ToolRegistrationContext } from './types.js';

export function registerAll(server: ToolRegistrationContext): void {
  registerCreateDetectionRule(server);
  registerListDetectionRules(server);
  registerEnableDetectionRules(server);
  registerGetSecurityAlerts(server);
  registerUpdateAlertStatus(server);
  registerAddRuleException(server);
  registerSiemQuickstart(server);
}
