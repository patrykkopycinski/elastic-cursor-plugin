/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { Client } from '@elastic/elasticsearch';
import type { ClustersConfig, EsConnectionConfig } from './types.js';

const SKIP_VERIFY = process.env.ES_SSL_SKIP_VERIFY === 'true';

/**
 * Build a single Elasticsearch client from environment variables.
 * Supports: ES_URL + ES_API_KEY, ES_URL + ES_USERNAME/ES_PASSWORD, ES_CLOUD_ID + ES_API_KEY.
 */
export function createClientFromEnv(): Client | null {
  const url = process.env.ES_URL;
  const cloudId = process.env.ES_CLOUD_ID;
  const apiKey = process.env.ES_API_KEY;
  const username = process.env.ES_USERNAME;
  const password = process.env.ES_PASSWORD;

  if (cloudId && apiKey) {
    return new Client({
      cloud: { id: cloudId },
      auth: { apiKey },
      tls: SKIP_VERIFY ? { rejectUnauthorized: false } : undefined,
    });
  }

  if (url) {
    const node = url;
    if (apiKey) {
      return new Client({
        node,
        auth: { apiKey },
        tls: SKIP_VERIFY ? { rejectUnauthorized: false } : undefined,
      });
    }
    if (username && password) {
      return new Client({
        node,
        auth: { username, password },
        tls: SKIP_VERIFY ? { rejectUnauthorized: false } : undefined,
      });
    }
    return new Client({
      node,
      tls: SKIP_VERIFY ? { rejectUnauthorized: false } : undefined,
    });
  }

  return null;
}

/**
 * Parse ES_CLUSTERS JSON into a record of name -> config.
 */
export function getClustersFromEnv(): ClustersConfig | null {
  const raw = process.env.ES_CLUSTERS;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, { url: string; apiKey?: string; username?: string; password?: string }>;
    const result: ClustersConfig = {};
    for (const [name, c] of Object.entries(parsed)) {
      if (c && typeof c.url === 'string') {
        result[name] = {
          url: c.url,
          apiKey: c.apiKey,
          username: c.username,
          password: c.password,
        };
      }
    }
    return Object.keys(result).length ? result : null;
  } catch {
    return null;
  }
}

/**
 * Get the default Elasticsearch client (from ES_* env) or the first named cluster.
 * Returns null if no configuration is present.
 */
export function getDefaultClient(): Client | null {
  const client = createClientFromEnv();
  if (client) return client;

  const clusters = getClustersFromEnv();
  if (!clusters) return null;

  const first = Object.values(clusters)[0];
  if (!first) return null;

  return new Client({
    node: first.url,
    auth: first.apiKey
      ? { apiKey: first.apiKey }
      : first.username && first.password
        ? { username: first.username, password: first.password }
        : undefined,
    tls: SKIP_VERIFY ? { rejectUnauthorized: false } : undefined,
  });
}

/**
 * Get a client for a named cluster (from ES_CLUSTERS). Falls back to default client if name is missing or not found.
 */
export function getClientForCluster(clusterName?: string | null): Client | null {
  if (clusterName) {
    const clusters = getClustersFromEnv();
    const config = clusters?.[clusterName];
    if (config) {
      return new Client({
        node: config.url,
        auth: config.apiKey
          ? { apiKey: config.apiKey }
          : config.username && config.password
            ? { username: config.username!, password: config.password }
            : undefined,
        tls: SKIP_VERIFY ? { rejectUnauthorized: false } : undefined,
      });
    }
  }
  return getDefaultClient();
}
