/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { getBasePath } from './paths.js';

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface ClusterMeta {
  name: string;
  version: string;
  lastAccessed?: string;
}

interface MetaEnvelope {
  updatedAt: string;
  data: ClusterMeta;
}

/**
 * Reads _meta.json directly from a hashed directory on disk,
 * bypassing the UUID-hashing path resolution (since the directory
 * name IS already the hash).
 */
async function readMetaFromDir(dirPath: string): Promise<MetaEnvelope | null> {
  try {
    const raw = await readFile(join(dirPath, '_meta.json'), 'utf-8');
    return JSON.parse(raw) as MetaEnvelope;
  } catch {
    return null;
  }
}

export async function cleanupStaleKnowledgeBases(): Promise<string[]> {
  const basePath = getBasePath();
  let entries: string[];
  try {
    entries = await readdir(basePath);
  } catch {
    return [];
  }

  const removed: string[] = [];
  const now = Date.now();

  for (const entry of entries) {
    const dirPath = join(basePath, entry);
    const meta = await readMetaFromDir(dirPath);

    if (!meta) {
      // Directory without _meta.json — orphaned, remove it
      try {
        await rm(dirPath, { recursive: true, force: true });
        removed.push(entry);
      } catch { /* ignore */ }
      continue;
    }

    const lastAccessed = meta.data.lastAccessed ?? meta.updatedAt;
    const age = now - new Date(lastAccessed).getTime();

    if (age > MAX_AGE_MS) {
      try {
        await rm(dirPath, { recursive: true, force: true });
        removed.push(entry);
      } catch { /* ignore removal failure */ }
    }
  }

  return removed;
}
