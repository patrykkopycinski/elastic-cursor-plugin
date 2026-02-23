/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ToolRegistrationContext } from './types.js';
import { registerCreateCloudProject } from './create-cloud-project.js';
import { registerListCloudProjects } from './list-cloud-projects.js';
import { registerGetCloudProject } from './get-cloud-project.js';
import { registerCreateProjectApiKey } from './create-project-api-key.js';
import { registerGetConnectionConfig } from './get-connection-config.js';
import { registerGetDeploymentGuide } from './get-deployment-guide.js';

export type { ToolRegistrationContext } from './types.js';

export function registerAll(server: ToolRegistrationContext): void {
  registerCreateCloudProject(server);
  registerListCloudProjects(server);
  registerGetCloudProject(server);
  registerCreateProjectApiKey(server);
  registerGetConnectionConfig(server);
  registerGetDeploymentGuide(server);
}
