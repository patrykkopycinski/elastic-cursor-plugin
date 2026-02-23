/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Client } from '@elastic/elasticsearch';

export interface HealthResult {
  ok: boolean;
  message: string;
  clusterName?: string;
  version?: string;
}

/**
 * Run a startup health check against Elasticsearch (ping + cluster info).
 * Does not throw; returns a result object.
 */
export async function checkElasticsearchHealth(client: Client | null): Promise<HealthResult> {
  if (!client) {
    return {
      ok: false,
      message:
        'No Elasticsearch configuration. Set ES_URL + ES_API_KEY (or ES_USERNAME/ES_PASSWORD), or ES_CLOUD_ID + ES_API_KEY, or ES_CLUSTERS.',
    };
  }

  try {
    const ping = await client.ping();
    if (!ping) {
      return { ok: false, message: 'Ping returned false.' };
    }

    const info = await client.info();
    const clusterName = info.cluster_name;
    const version = info.version?.number;

    return {
      ok: true,
      message: 'Connected to Elasticsearch.',
      clusterName,
      version,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Elasticsearch health check failed: ${message}` };
  }
}
