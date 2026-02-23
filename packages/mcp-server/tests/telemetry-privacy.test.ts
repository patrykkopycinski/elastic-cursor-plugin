/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Privacy tests: telemetry must not collect or send personal data.
 * Only allowed fields: @timestamp, ecs.version, event, elastic.cursor_plugin (tool_name or skill_name, version).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Load telemetry after setting env so OPT_IN is true
const TELEMETRY_INDEX = 'elastic-cursor-plugin-telemetry-privacy-test';

describe('telemetry privacy', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock;
    process.env.ELASTIC_TELEMETRY_OPT_IN = 'true';
    process.env.ES_URL = 'https://es.example.com';
    process.env.ES_API_KEY = 'test-key';
    process.env.ELASTIC_TELEMETRY_INDEX = TELEMETRY_INDEX;
    // Re-import so OPT_IN is read with env set
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ELASTIC_TELEMETRY_OPT_IN;
    delete process.env.ES_URL;
    delete process.env.ES_API_KEY;
    delete process.env.ELASTIC_TELEMETRY_INDEX;
  });

  const ALLOWED_TOP_LEVEL = new Set(['@timestamp', 'ecs.version', 'event', 'elastic.cursor_plugin']);
  const ALLOWED_PLUGIN = new Set(['tool_name', 'skill_name', 'version']);

  function assertNoPII(obj: unknown): void {
    if (obj === null || typeof obj !== 'object') return;
    const str = JSON.stringify(obj).toLowerCase();
    // No email-like, IP-like, or obvious PII patterns
    expect(str).not.toMatch(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/);
    expect(str).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    expect(str).not.toMatch(/\buser[-_]?id\b|\busername\b|\bemail\b|\b(first_?name|last_?name|full_?name)\b|\baddress\b/);
    for (const value of Object.values(obj as Record<string, unknown>)) {
      assertNoPII(value);
    }
  }

  function parseBulkBody(body: string): unknown[] {
    const docs: unknown[] = [];
    const lines = body.trim().split('\n');
    for (let i = 0; i < lines.length; i += 2) {
      if (lines[i]?.startsWith('{"index"')) {
        const docLine = lines[i + 1];
        if (docLine) docs.push(JSON.parse(docLine));
      }
    }
    return docs;
  }

  it('sends only allowed fields in tool invocation events', async () => {
    const { recordToolInvocation, flushSync } = await import('../src/telemetry.js');
    recordToolInvocation('search');
    await flushSync();
    expect(fetchMock).toHaveBeenCalled();
    const [, options] = fetchMock.mock.calls[0];
    const body = options?.body as string;
    const docs = parseBulkBody(body);
    expect(docs.length).toBeGreaterThanOrEqual(1);
    for (const doc of docs) {
      const d = doc as Record<string, unknown>;
      expect(Object.keys(d).every((k) => ALLOWED_TOP_LEVEL.has(k))).toBe(true);
      if (d['elastic.cursor_plugin']) {
        const plugin = d['elastic.cursor_plugin'] as Record<string, unknown>;
        expect(Object.keys(plugin).every((k) => ALLOWED_PLUGIN.has(k))).toBe(true);
        expect(plugin.tool_name === undefined || typeof plugin.tool_name === 'string').toBe(true);
        expect(plugin.version).toBeDefined();
      }
      assertNoPII(doc);
    }
  });

  it('sends only allowed fields in skill usage events', async () => {
    const { recordSkillUsage, flushSync } = await import('../src/telemetry.js');
    recordSkillUsage('zero-to-elastic');
    await flushSync();
    expect(fetchMock).toHaveBeenCalled();
    const [, options] = fetchMock.mock.calls[0];
    const docs = parseBulkBody(options?.body as string);
    expect(docs.length).toBeGreaterThanOrEqual(1);
    for (const doc of docs) {
      const d = doc as Record<string, unknown>;
      if (d['elastic.cursor_plugin']) {
        const plugin = d['elastic.cursor_plugin'] as Record<string, unknown>;
        expect(Object.keys(plugin).every((k) => ALLOWED_PLUGIN.has(k))).toBe(true);
        expect(plugin.skill_name === undefined || typeof plugin.skill_name === 'string').toBe(true);
      }
      assertNoPII(doc);
    }
  });

  it('does not send when ELASTIC_TELEMETRY_OPT_IN is not true', async () => {
    delete process.env.ELASTIC_TELEMETRY_OPT_IN;
    vi.resetModules();
    const { recordToolInvocation, flushSync } = await import('../src/telemetry.js');
    recordToolInvocation('search');
    await flushSync();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
