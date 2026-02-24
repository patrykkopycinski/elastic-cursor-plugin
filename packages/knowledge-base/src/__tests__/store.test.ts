import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeCategory, readCategory, readCategoryTimestamp, purgeCategory, purgeCluster } from '../store.js';
import { rm } from 'node:fs/promises';
import { getKnowledgeBasePath } from '../paths.js';

const TEST_UUID = 'test-cluster-00000000-0000-0000-0000-000000000000';

describe('store', () => {
  beforeEach(async () => {
    await rm(getKnowledgeBasePath(TEST_UUID), { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(getKnowledgeBasePath(TEST_UUID), { recursive: true, force: true });
  });

  it('writes and reads a category', async () => {
    const data = { name: 'test-cluster', version: '8.17.0' };
    const ok = await writeCategory(TEST_UUID, '_meta', data);
    expect(ok).toBe(true);

    const result = await readCategory<typeof data>(TEST_UUID, '_meta');
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(data);
    expect(result!.updatedAt).toBeTruthy();
  });

  it('returns null for missing category', async () => {
    const result = await readCategory(TEST_UUID, 'security');
    expect(result).toBeNull();
  });

  it('reads category timestamp', async () => {
    await writeCategory(TEST_UUID, '_meta', { name: 'test' });
    const ts = await readCategoryTimestamp(TEST_UUID, '_meta');
    expect(ts).toBeTruthy();
    expect(new Date(ts!).getTime()).toBeGreaterThan(0);
  });

  it('overwrites existing category', async () => {
    await writeCategory(TEST_UUID, '_meta', { name: 'v1' });
    await writeCategory(TEST_UUID, '_meta', { name: 'v2' });

    const result = await readCategory<{ name: string }>(TEST_UUID, '_meta');
    expect(result!.data.name).toBe('v2');
  });

  it('purges a single category', async () => {
    await writeCategory(TEST_UUID, '_meta', { name: 'test' });
    expect(await readCategory(TEST_UUID, '_meta')).not.toBeNull();

    const ok = await purgeCategory(TEST_UUID, '_meta');
    expect(ok).toBe(true);
    expect(await readCategory(TEST_UUID, '_meta')).toBeNull();
  });

  it('purges an entire cluster knowledge base', async () => {
    await writeCategory(TEST_UUID, '_meta', { name: 'test' });
    await writeCategory(TEST_UUID, 'indices', []);

    const ok = await purgeCluster(TEST_UUID);
    expect(ok).toBe(true);
    expect(await readCategory(TEST_UUID, '_meta')).toBeNull();
    expect(await readCategory(TEST_UUID, 'indices')).toBeNull();
  });
});
