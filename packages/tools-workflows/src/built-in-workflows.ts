/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { WorkflowDefinition } from './types.js';

export const fullO11ySetup: WorkflowDefinition = {
  name: 'full-o11y-setup',
  description:
    'End-to-end observability setup: discover data, generate dashboards for each recommended service, and create SLOs.',
  version: '1.0.0',
  variables: {
    cluster_url: {
      description: 'Elasticsearch cluster URL',
      type: 'string',
      required: false,
    },
    kibana_url: {
      description: 'Kibana URL for dashboard and SLO creation',
      type: 'string',
      required: false,
    },
  },
  steps: [
    {
      id: 'discover',
      name: 'Discover observability data',
      tool: 'discover_o11y_data',
      parameters: {},
      on_error: 'stop',
    },
    {
      id: 'summarize',
      name: 'Summarize discovered data',
      tool: 'get_data_summary',
      parameters: { format: 'json' },
      on_error: 'stop',
    },
    {
      id: 'create_dashboards',
      name: 'Create recommended dashboards',
      tool: 'create_dashboard',
      parameters: {
        title: 'O11y Overview Dashboard',
        service_name: '${steps.summarize.output.primary_service}',
      },
      condition: 'steps.summarize.output.has_apm_data == true',
      on_error: 'continue',
    },
    {
      id: 'create_slos',
      name: 'Create recommended SLOs',
      tool: 'create_slo',
      parameters: {
        service_name: '${steps.summarize.output.primary_service}',
        slo_type: 'availability',
        target: 99.9,
      },
      condition: 'steps.summarize.output.has_apm_data == true',
      on_error: 'continue',
    },
  ],
};

export const serviceDashboard: WorkflowDefinition = {
  name: 'service-dashboard',
  description:
    'Create a service-specific overview dashboard: discover data for the service, summarize, and generate a dashboard.',
  version: '1.0.0',
  variables: {
    service_name: {
      description: 'APM service name to scope the dashboard to',
      type: 'string',
      required: true,
    },
  },
  steps: [
    {
      id: 'discover',
      name: 'Discover service data',
      tool: 'discover_o11y_data',
      parameters: { service_name: '${variables.service_name}' },
      on_error: 'stop',
    },
    {
      id: 'summarize',
      name: 'Summarize service data',
      tool: 'get_data_summary',
      parameters: { service_name: '${variables.service_name}' },
      on_error: 'stop',
    },
    {
      id: 'create_dashboard',
      name: 'Create service overview dashboard',
      tool: 'create_dashboard',
      parameters: {
        title: '${variables.service_name} — Service Overview',
        service_name: '${variables.service_name}',
      },
      on_error: 'stop',
    },
  ],
};

export const sloFromApm: WorkflowDefinition = {
  name: 'slo-from-apm',
  description:
    'Discover APM data, summarize recommended SLOs, and create them.',
  version: '1.0.0',
  variables: {
    service_name: {
      description: 'Optional APM service name to scope SLO creation',
      type: 'string',
      required: false,
    },
    target: {
      description: 'SLO target percentage',
      type: 'number',
      default: 99.9,
    },
  },
  steps: [
    {
      id: 'discover',
      name: 'Discover APM data',
      tool: 'discover_o11y_data',
      parameters: { service_name: '${variables.service_name}' },
      on_error: 'stop',
    },
    {
      id: 'summarize',
      name: 'Summarize SLO recommendations',
      tool: 'get_data_summary',
      parameters: { format: 'json', service_name: '${variables.service_name}' },
      on_error: 'stop',
    },
    {
      id: 'create_slo',
      name: 'Create availability SLO',
      tool: 'create_slo',
      parameters: {
        service_name: '${variables.service_name}',
        slo_type: 'availability',
        target: '${variables.target}',
      },
      condition: 'steps.summarize.output.has_apm_data == true',
      on_error: 'continue',
    },
  ],
};

export const infrastructureOverview: WorkflowDefinition = {
  name: 'infrastructure-overview',
  description:
    'Discover infrastructure metrics and create a health dashboard covering hosts, containers, and pods.',
  version: '1.0.0',
  variables: {
    index_pattern: {
      description: 'Metrics index pattern to query',
      type: 'string',
      default: 'metrics-*',
    },
  },
  steps: [
    {
      id: 'discover',
      name: 'Discover infrastructure data',
      tool: 'discover_o11y_data',
      parameters: {},
      on_error: 'stop',
    },
    {
      id: 'summarize',
      name: 'Summarize infrastructure data',
      tool: 'get_data_summary',
      parameters: {},
      on_error: 'stop',
    },
    {
      id: 'create_dashboard',
      name: 'Create infrastructure health dashboard',
      tool: 'create_dashboard',
      parameters: {
        title: 'Infrastructure Health Overview',
        index_pattern: '${variables.index_pattern}',
      },
      on_error: 'stop',
    },
  ],
};

export const builtInWorkflows: ReadonlyArray<WorkflowDefinition> = [
  fullO11ySetup,
  serviceDashboard,
  sloFromApm,
  infrastructureOverview,
];
