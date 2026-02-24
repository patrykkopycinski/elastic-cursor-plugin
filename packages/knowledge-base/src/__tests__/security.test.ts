import { describe, it, expect, afterEach } from 'vitest';
import { stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { hashClusterUuid, getKnowledgeBasePath, getBasePath } from '../paths.js';
import { writeCategory, readCategory, purgeCluster } from '../store.js';

const TEST_UUID = 'security-test-uuid-12345';

describe('security hardening', () => {
  afterEach(async () => {
    await rm(getKnowledgeBasePath(TEST_UUID), { recursive: true, force: true });
  });

  describe('path traversal prevention', () => {
    it('hashes cluster UUID to prevent directory traversal', () => {
      const malicious = '../../../etc/passwd';
      const hashed = hashClusterUuid(malicious);
      expect(hashed).not.toContain('..');
      expect(hashed).not.toContain('/');
      expect(hashed).toMatch(/^[a-f0-9]{32}$/);
    });

    it('produces deterministic hashes', () => {
      const uuid = 'abc-123';
      expect(hashClusterUuid(uuid)).toBe(hashClusterUuid(uuid));
    });

    it('produces different hashes for different UUIDs', () => {
      expect(hashClusterUuid('cluster-a')).not.toBe(hashClusterUuid('cluster-b'));
    });

    it('knowledge base path uses hashed UUID, not raw', () => {
      const path = getKnowledgeBasePath('my-cluster-uuid');
      const basePath = getBasePath();
      const dirName = path.slice(basePath.length + 1);
      expect(dirName).not.toBe('my-cluster-uuid');
      expect(dirName).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('file permissions', () => {
    it('creates directory with owner-only permissions (0700)', async () => {
      await writeCategory(TEST_UUID, '_meta', { name: 'test' });
      const dirStat = await stat(getKnowledgeBasePath(TEST_UUID));
      const perms = dirStat.mode & 0o777;
      expect(perms).toBe(0o700);
    });

    it('creates files with owner-only permissions (0600)', async () => {
      await writeCategory(TEST_UUID, '_meta', { name: 'test' });
      const filePath = join(getKnowledgeBasePath(TEST_UUID), '_meta.json');
      const fileStat = await stat(filePath);
      const perms = fileStat.mode & 0o777;
      expect(perms).toBe(0o600);
    });
  });

  describe('data isolation', () => {
    it('different cluster UUIDs do not share cache', async () => {
      const uuid1 = 'cluster-alpha';
      const uuid2 = 'cluster-beta';

      try {
        await writeCategory(uuid1, '_meta', { name: 'alpha' });
        await writeCategory(uuid2, '_meta', { name: 'beta' });

        const r1 = await readCategory<{ name: string }>(uuid1, '_meta');
        const r2 = await readCategory<{ name: string }>(uuid2, '_meta');

        expect(r1!.data.name).toBe('alpha');
        expect(r2!.data.name).toBe('beta');
      } finally {
        await purgeCluster(uuid1);
        await purgeCluster(uuid2);
      }
    });
  });
});
