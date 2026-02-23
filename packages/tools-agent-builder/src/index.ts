/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ToolRegistrationContext } from './types.js';
import { registerListAgentBuilderTools } from './list-agent-builder-tools.js';
import { registerCreateAgentBuilderTool } from './create-agent-builder-tool.js';
import { registerTestAgentBuilderTool } from './test-agent-builder-tool.js';
import { registerGetAgentBuilderMcpConfig } from './get-agent-builder-mcp-config.js';

export type { ToolRegistrationContext } from './types.js';

export function registerAll(server: ToolRegistrationContext): void {
  registerListAgentBuilderTools(server);
  registerCreateAgentBuilderTool(server);
  registerTestAgentBuilderTool(server);
  registerGetAgentBuilderMcpConfig(server);
}
