/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, access, chmod, constants } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const BASE_DIR = join(homedir(), '.elastic-cursor', 'knowledge');

/**
 * Owner-only permissions for directories (rwx------) and files (rw-------).
 * Prevents other users on a shared system from reading cached cluster metadata,
 * detection rule names, alert data, or index names.
 */
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

export { DIR_MODE, FILE_MODE };

/**
 * Derives a filesystem-safe directory name from a cluster UUID.
 * Uses SHA-256 hash to avoid leaking the raw UUID on disk and to
 * prevent path traversal via crafted UUIDs containing "../" or
 * other special characters.
 */
export function hashClusterUuid(clusterUuid: string): string {
  return createHash('sha256').update(clusterUuid).digest('hex').slice(0, 32);
}

export function getKnowledgeBasePath(clusterUuid: string): string {
  return join(BASE_DIR, hashClusterUuid(clusterUuid));
}

export function getBasePath(): string {
  return BASE_DIR;
}

export async function ensureDir(dirPath: string): Promise<boolean> {
  try {
    await mkdir(dirPath, { recursive: true, mode: DIR_MODE });
    // Re-apply in case the directory already existed with looser permissions
    await chmod(dirPath, DIR_MODE).catch(() => { });
    return true;
  } catch {
    return false;
  }
}

export async function isWritable(dirPath: string): Promise<boolean> {
  try {
    await access(dirPath, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
