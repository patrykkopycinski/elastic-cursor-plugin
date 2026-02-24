/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { describe, it, expect } from 'vitest';
import { textResponse, errorResponse, jsonResponse } from './index.js';

describe('textResponse', () => {
  it('wraps text in MCP content format', () => {
    const result = textResponse('hello');
    expect(result).toEqual({ content: [{ type: 'text', text: 'hello' }] });
  });

  it('does not set isError', () => {
    const result = textResponse('hello');
    expect(result.isError).toBeUndefined();
  });
});

describe('errorResponse', () => {
  it('extracts Error message', () => {
    const result = errorResponse(new Error('failed'));
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: failed' }],
      isError: true,
    });
  });

  it('handles string errors', () => {
    const result = errorResponse('string error');
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: string error' }],
      isError: true,
    });
  });

  it('handles non-string non-Error values', () => {
    const result = errorResponse(42);
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: 42' }],
      isError: true,
    });
  });
});

describe('jsonResponse', () => {
  it('pretty-prints JSON', () => {
    const result = jsonResponse({ count: 42 });
    expect(result).toEqual({
      content: [{ type: 'text', text: '{\n  "count": 42\n}' }],
    });
  });

  it('handles arrays', () => {
    const result = jsonResponse([1, 2, 3]);
    expect(result.content[0]?.text).toBe('[\n  1,\n  2,\n  3\n]');
  });

  it('does not set isError', () => {
    const result = jsonResponse({});
    expect(result.isError).toBeUndefined();
  });
});
