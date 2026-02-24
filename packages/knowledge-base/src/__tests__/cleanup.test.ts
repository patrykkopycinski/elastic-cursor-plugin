import { describe, it, expect, afterEach } from 'vitest';
import { writeCategory, readCategory } from '../store.js';
import { cleanupStaleKnowledgeBases } from '../cleanup.js';
import { rm } from 'node:fs/promises';
import { getKnowledgeBasePath } from '../paths.js';

const OLD_UUID = 'cleanup-test-old-00000000';
const FRESH_UUID = 'cleanup-test-fresh-00000000';

describe('cleanup', () => {
  afterEach(async () => {
    await rm(getKnowledgeBasePath(OLD_UUID), { recursive: true, force: true });
    await rm(getKnowledgeBasePath(FRESH_UUID), { recursive: true, force: true });
  });

  it('removes knowledge bases older than 30 days', async () => {
    await writeCategory(OLD_UUID, '_meta', {
      name: 'old-cluster',
      version: '8.0.0',
      lastAccessed: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await cleanupStaleKnowledgeBases();

    const meta = await readCategory(OLD_UUID, '_meta');
    expect(meta).toBeNull();
  });

  it('keeps fresh knowledge bases', async () => {
    await writeCategory(FRESH_UUID, '_meta', {
      name: 'fresh-cluster',
      version: '8.17.0',
      lastAccessed: new Date().toISOString(),
    });

    await cleanupStaleKnowledgeBases();

    const meta = await readCategory(FRESH_UUID, '_meta');
    expect(meta).not.toBeNull();
  });
});
