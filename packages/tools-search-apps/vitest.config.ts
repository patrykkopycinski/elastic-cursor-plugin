/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts', 'tests/**/*.test.ts'] },
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
});
