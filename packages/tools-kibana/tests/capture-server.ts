/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Test helper: capture registered tools and invoke handlers by name.
 */
import type { ToolRegistrationContext } from '../src/types.js';

export type ToolEntry = {
  name: string;
  definition: { title: string; description: string; inputSchema: unknown };
  handler: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>;
};

export function createCaptureServer(): ToolRegistrationContext & { tools: Map<string, ToolEntry> } {
  const tools = new Map<string, ToolEntry>();
  return {
    tools,
    registerTool(name, definition, handler) {
      tools.set(name, { name, definition, handler });
    },
  };
}

export async function invokeTool(
  server: ReturnType<typeof createCaptureServer>,
  name: string,
  args: unknown = {}
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const entry = server.tools.get(name);
  if (!entry) throw new Error(`Tool not registered: ${name}`);
  return entry.handler(args);
}
