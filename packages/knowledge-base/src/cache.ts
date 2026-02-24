/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { CategoryName } from './store.js';
import { readCategory, readCategoryTimestamp } from './store.js';

export type CacheStatus = 'fresh' | 'stale' | 'expired' | 'missing';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const DEFAULT_TTLS: Record<CategoryName, number> = {
  '_meta': 24 * HOUR,
  'indices': 1 * HOUR,
  'data-streams': 1 * HOUR,
  'templates': 4 * HOUR,
  'pipelines': 4 * HOUR,
  'lifecycle': 4 * HOUR,
  'o11y': 30 * MINUTE,
  'security': 15 * MINUTE,
};

export function getCacheStatus(
  updatedAt: string | null,
  category: CategoryName
): CacheStatus {
  if (!updatedAt) return 'missing';

  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const ttl = DEFAULT_TTLS[category];

  if (ageMs <= ttl) return 'fresh';
  if (ageMs <= ttl * 2) return 'stale';
  return 'expired';
}

export function formatAge(updatedAt: string): string {
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  if (ageMs < MINUTE) return 'just now';
  if (ageMs < HOUR) return `${Math.round(ageMs / MINUTE)}m ago`;
  if (ageMs < 24 * HOUR) return `${Math.round(ageMs / HOUR)}h ago`;
  return `${Math.round(ageMs / (24 * HOUR))}d ago`;
}

export async function checkCategory(
  clusterUuid: string,
  category: CategoryName
): Promise<{ status: CacheStatus; updatedAt: string | null }> {
  const updatedAt = await readCategoryTimestamp(clusterUuid, category);
  return { status: getCacheStatus(updatedAt, category), updatedAt };
}

export async function readIfFresh<T>(
  clusterUuid: string,
  category: CategoryName
): Promise<{ data: T; updatedAt: string } | null> {
  const envelope = await readCategory<T>(clusterUuid, category);
  if (!envelope) return null;

  const status = getCacheStatus(envelope.updatedAt, category);
  if (status === 'fresh' || status === 'stale') {
    return { data: envelope.data, updatedAt: envelope.updatedAt };
  }
  return null;
}

export { DEFAULT_TTLS };
