/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolResponse {
  content: TextContent[];
  isError?: boolean;
}

export interface ToolRegistrationContext {
  registerTool(
    name: string,
    definition: { title: string; description: string; inputSchema: unknown },
    handler: (args: unknown) => Promise<ToolResponse>
  ): void;
}

export function textResponse(text: string): ToolResponse {
  return { content: [{ type: 'text', text }] };
}

export function errorResponse(err: unknown): ToolResponse {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
}

export function jsonResponse(data: unknown): ToolResponse {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}
