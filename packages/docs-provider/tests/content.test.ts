/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Tests for docs-provider content and caching.
 */
import { describe, it, expect } from 'vitest';
import {
  getDocByPath,
  getCached,
  setCached,
  DOCS_API_SEARCH,
  DOCS_MIGRATION_8_TO_9,
  DOCS_ESQL,
} from '../src/content.js';

describe('getDocByPath', () => {
  it('returns Search API doc for api/search and api/search-api', () => {
    expect(getDocByPath('api/search')).toBe(DOCS_API_SEARCH);
    expect(getDocByPath('api/search-api')).toBe(DOCS_API_SEARCH);
    expect(getDocByPath('/api/search')).toBe(DOCS_API_SEARCH);
  });

  it('returns migration doc for migration/8-to-9 and migration/8x-9x', () => {
    expect(getDocByPath('migration/8-to-9')).toBe(DOCS_MIGRATION_8_TO_9);
    expect(getDocByPath('migration/8x-9x')).toBe(DOCS_MIGRATION_8_TO_9);
  });

  it('returns ES|QL doc for esql and esql-guide', () => {
    expect(getDocByPath('esql')).toBe(DOCS_ESQL);
    expect(getDocByPath('esql-guide')).toBe(DOCS_ESQL);
  });

  it('returns null for unknown path', () => {
    expect(getDocByPath('unknown')).toBeNull();
    expect(getDocByPath('')).toBeNull();
    expect(getDocByPath('foo/bar')).toBeNull();
  });

  it('normalizes path to lowercase', () => {
    expect(getDocByPath('API/SEARCH')).toBe(DOCS_API_SEARCH);
    expect(getDocByPath('ESQL')).toBe(DOCS_ESQL);
  });
});

describe('cache', () => {
  it('getCached returns undefined when not set', () => {
    expect(getCached('elastic://docs/unknown')).toBeUndefined();
  });

  it('setCached and getCached round-trip', () => {
    const uri = 'elastic://docs/test';
    const text = '# Test doc';
    setCached(uri, text);
    expect(getCached(uri)).toBe(text);
  });
});

describe('content shape', () => {
  it('Search API doc contains expected sections', () => {
    expect(DOCS_API_SEARCH).toContain('Elasticsearch Search API');
    expect(DOCS_API_SEARCH).toContain('POST /<index>/_search');
    expect(DOCS_API_SEARCH).toContain('query');
    expect(DOCS_API_SEARCH).toContain('size');
  });

  it('Migration doc contains key changes', () => {
    expect(DOCS_MIGRATION_8_TO_9).toContain('Migration');
    expect(DOCS_MIGRATION_8_TO_9).toContain('8.x');
    expect(DOCS_MIGRATION_8_TO_9).toContain('9.x');
  });

  it('ES|QL doc contains syntax and examples', () => {
    expect(DOCS_ESQL).toContain('ES|QL');
    expect(DOCS_ESQL).toContain('FROM');
    expect(DOCS_ESQL).toContain('WHERE');
    expect(DOCS_ESQL).toContain('POST /_query');
  });
});
