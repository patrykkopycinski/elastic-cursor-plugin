/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Client } from '@elastic/elasticsearch';
import type { ToolRegistrationContext } from '@elastic-cursor-plugin/shared-types';
import { registerElasticsearchApi } from './elasticsearch-api.js';
import { registerKibanaApi } from './kibana-api.js';
import { registerCloudApi } from './cloud-api.js';
import { registerEsqlQuery } from './esql-query.js';

export type { ToolRegistrationContext } from '@elastic-cursor-plugin/shared-types';

export interface GatewayRegistrationOptions {
  esClient?: Client | null;
  hasKibana?: boolean;
  hasCloud?: boolean;
}

export function registerAll(server: ToolRegistrationContext, options: GatewayRegistrationOptions): void {
  if (options.esClient) {
    registerElasticsearchApi(server, options.esClient);
    registerEsqlQuery(server, options.esClient);
  }
  if (options.hasKibana) {
    registerKibanaApi(server);
  }
  if (options.hasCloud) {
    registerCloudApi(server);
  }
}
