/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { readFile, writeFile, rename, unlink, chmod, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getKnowledgeBasePath, ensureDir, FILE_MODE } from './paths.js';

export interface CategoryEnvelope<T> {
  updatedAt: string;
  data: T;
}

export type CategoryName =
  | '_meta'
  | 'indices'
  | 'data-streams'
  | 'templates'
  | 'pipelines'
  | 'lifecycle'
  | 'o11y'
  | 'security';

function categoryFile(clusterUuid: string, category: CategoryName): string {
  return join(getKnowledgeBasePath(clusterUuid), `${category}.json`);
}

export async function writeCategory<T>(
  clusterUuid: string,
  category: CategoryName,
  data: T
): Promise<boolean> {
  const dir = getKnowledgeBasePath(clusterUuid);
  if (!(await ensureDir(dir))) return false;

  const envelope: CategoryEnvelope<T> = {
    updatedAt: new Date().toISOString(),
    data,
  };

  const filePath = categoryFile(clusterUuid, category);
  const tmpPath = join(dir, `.tmp-${randomUUID()}.json`);

  try {
    await writeFile(tmpPath, JSON.stringify(envelope, null, 2), {
      encoding: 'utf-8',
      mode: FILE_MODE,
    });
    // Belt-and-suspenders: enforce permissions even if umask overrode them
    await chmod(tmpPath, FILE_MODE).catch(() => { });
    await rename(tmpPath, filePath);
    return true;
  } catch {
    try {
      await unlink(tmpPath);
    } catch {
      /* ignore cleanup failure */
    }
    return false;
  }
}

export async function readCategory<T>(
  clusterUuid: string,
  category: CategoryName
): Promise<CategoryEnvelope<T> | null> {
  try {
    const raw = await readFile(categoryFile(clusterUuid, category), 'utf-8');
    return JSON.parse(raw) as CategoryEnvelope<T>;
  } catch {
    return null;
  }
}

export async function readCategoryTimestamp(
  clusterUuid: string,
  category: CategoryName
): Promise<string | null> {
  const envelope = await readCategory<unknown>(clusterUuid, category);
  return envelope?.updatedAt ?? null;
}

/**
 * Securely remove a single category cache file.
 */
export async function purgeCategory(
  clusterUuid: string,
  category: CategoryName
): Promise<boolean> {
  try {
    await unlink(categoryFile(clusterUuid, category));
    return true;
  } catch {
    return false;
  }
}

/**
 * Securely remove all cached data for a cluster.
 */
export async function purgeCluster(clusterUuid: string): Promise<boolean> {
  try {
    await rm(getKnowledgeBasePath(clusterUuid), { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}
