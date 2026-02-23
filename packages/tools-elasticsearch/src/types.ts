/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Client } from '@elastic/elasticsearch';

export type { Client as ElasticsearchClient };

export interface ToolRegistrationContext {
  registerTool(
    name: string,
    definition: { title: string; description: string; inputSchema: unknown },
    handler: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>
  ): void;
}
