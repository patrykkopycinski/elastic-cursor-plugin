/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ToolRegistrationContext } from './types.js';
import { registerListDataViews } from './list-data-views.js';
import { registerListDashboards } from './list-dashboards.js';
import { registerListSavedObjects } from './list-saved-objects.js';
import { registerKibanaInfo } from './kibana-info.js';

export type { ToolRegistrationContext } from './types.js';

export function registerAll(server: ToolRegistrationContext): void {
  registerListDataViews(server);
  registerListDashboards(server);
  registerListSavedObjects(server);
  registerKibanaInfo(server);
}
