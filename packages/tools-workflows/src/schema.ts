/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export const workflowSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'WorkflowDefinition',
  description: 'Schema for validating workflow YAML/JSON definitions',
  type: 'object',
  required: ['name', 'description', 'steps'],
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      pattern: '^[a-z0-9][a-z0-9-]*$',
      description: 'Unique workflow identifier (lowercase, hyphens only)',
    },
    description: {
      type: 'string',
      minLength: 1,
      description: 'Human-readable description of the workflow',
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$',
      description: 'Semantic version (e.g. "1.0.0")',
    },
    variables: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['description', 'type'],
        additionalProperties: false,
        properties: {
          description: { type: 'string' },
          type: { type: 'string', enum: ['string', 'number', 'boolean', 'object'] },
          default: {},
          required: { type: 'boolean' },
        },
      },
      description: 'Input variables the workflow accepts',
    },
    steps: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'name', 'tool', 'parameters'],
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
            minLength: 1,
            pattern: '^[a-z_][a-z0-9_]*$',
            description: 'Unique step identifier within the workflow',
          },
          name: {
            type: 'string',
            minLength: 1,
            description: 'Human-readable step name',
          },
          tool: {
            type: 'string',
            minLength: 1,
            description: 'MCP tool name to invoke',
          },
          parameters: {
            type: 'object',
            description: 'Parameters passed to the tool (supports ${variable} substitution)',
          },
          condition: {
            type: 'string',
            description: 'Expression that must evaluate to truthy for the step to run',
          },
          output_mapping: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Map step output fields to workflow variables',
          },
          on_error: {
            type: 'string',
            enum: ['stop', 'skip', 'continue'],
            description: 'Behavior when the step fails (default: stop)',
          },
        },
      },
    },
  },
} as const;
