/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Client } from '@elastic/elasticsearch';
import type { ToolRegistrationContext } from './types.js';
import { registerListIndices } from './list-indices.js';
import { registerCreateIndex } from './create-index.js';
import { registerGetMappings } from './get-mappings.js';
import { registerDeleteIndex } from './delete-index.js';
import { registerIndexDocument } from './index-document.js';
import { registerBulkIndex } from './bulk-index.js';
import { registerSearch } from './search.js';
import { registerEsqlQuery } from './esql-query.js';
import { registerCreateIngestPipeline } from './create-ingest-pipeline.js';
import { registerListIngestPipelines } from './list-ingest-pipelines.js';
import { registerCreateInferenceEndpoint } from './create-inference-endpoint.js';
import { registerListInferenceEndpoints } from './list-inference-endpoints.js';
import { registerClusterHealth } from './cluster-health.js';
import { registerGetShards } from './get-shards.js';

export type { ToolRegistrationContext, ElasticsearchClient } from './types.js';

export function registerAll(server: ToolRegistrationContext, client: Client | null): void {
  if (!client) return;
  registerListIndices(server, client);
  registerCreateIndex(server, client);
  registerGetMappings(server, client);
  registerDeleteIndex(server, client);
  registerIndexDocument(server, client);
  registerBulkIndex(server, client);
  registerSearch(server, client);
  registerEsqlQuery(server, client);
  registerCreateIngestPipeline(server, client);
  registerListIngestPipelines(server, client);
  registerCreateInferenceEndpoint(server, client);
  registerListInferenceEndpoints(server, client);
  registerClusterHealth(server, client);
  registerGetShards(server, client);
}
