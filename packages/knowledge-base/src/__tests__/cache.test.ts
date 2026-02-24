/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { describe, it, expect } from 'vitest';
import { getCacheStatus, formatAge } from '../cache.js';

describe('getCacheStatus', () => {
  it('returns missing when updatedAt is null', () => {
    expect(getCacheStatus(null, '_meta')).toBe('missing');
  });

  it('returns fresh when within TTL', () => {
    const now = new Date().toISOString();
    expect(getCacheStatus(now, '_meta')).toBe('fresh');
  });

  it('returns stale when past TTL but within 2x TTL', () => {
    const thirtyHoursAgo = new Date(
      Date.now() - 30 * 60 * 60 * 1000
    ).toISOString();
    expect(getCacheStatus(thirtyHoursAgo, '_meta')).toBe('stale');
  });

  it('returns expired when past 2x TTL', () => {
    const threeDaysAgo = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000
    ).toISOString();
    expect(getCacheStatus(threeDaysAgo, '_meta')).toBe('expired');
  });

  it('uses category-specific TTLs', () => {
    const twentyMinAgo = new Date(
      Date.now() - 20 * 60 * 1000
    ).toISOString();
    // security has 15min TTL, so 20min ago should be stale
    expect(getCacheStatus(twentyMinAgo, 'security')).toBe('stale');
    // templates has 4h TTL, so 20min ago should be fresh
    expect(getCacheStatus(twentyMinAgo, 'templates')).toBe('fresh');
  });
});

describe('formatAge', () => {
  it('formats recent timestamps as "just now"', () => {
    expect(formatAge(new Date().toISOString())).toBe('just now');
  });

  it('formats minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatAge(fiveMinAgo)).toBe('5m ago');
  });

  it('formats hours ago', () => {
    const twoHoursAgo = new Date(
      Date.now() - 2 * 60 * 60 * 1000
    ).toISOString();
    expect(formatAge(twoHoursAgo)).toBe('2h ago');
  });

  it('formats days ago', () => {
    const threeDaysAgo = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000
    ).toISOString();
    expect(formatAge(threeDaysAgo)).toBe('3d ago');
  });
});
