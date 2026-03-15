/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { DataFreshness } from './discovery-types.js';

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export interface EsAggBucket {
  key: string;
  doc_count: number;
  [sub: string]: unknown;
}

export function buckets(aggs: Record<string, unknown> | undefined, name: string): EsAggBucket[] {
  const agg = aggs?.[name] as { buckets?: EsAggBucket[] } | undefined;
  return agg?.buckets ?? [];
}

export function aggValueAsString(agg: unknown): string | null {
  if (agg && typeof agg === 'object' && 'value_as_string' in agg) {
    return (agg as { value_as_string: string }).value_as_string;
  }
  if (agg && typeof agg === 'object' && 'value' in agg) {
    const v = (agg as { value: unknown }).value;
    return typeof v === 'number' ? new Date(v).toISOString() : null;
  }
  return null;
}

export function computeFreshness(lastDocIso: string | null): DataFreshness {
  if (!lastDocIso) {
    return { last_document: '', status: 'no_data' };
  }
  const age = Date.now() - new Date(lastDocIso).getTime();
  return {
    last_document: lastDocIso,
    status: age < STALE_THRESHOLD_MS ? 'active' : 'stale',
  };
}
