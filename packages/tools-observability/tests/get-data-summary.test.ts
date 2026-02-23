/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { registerAll } from '../src/index.js';
import { createCaptureServer, invokeTool } from './capture-server.js';

const mockDiscoveryResult = {
  cluster_info: { name: 'test-cluster', version: '8.15.0', is_serverless: false },
  services: [
    {
      name: 'frontend',
      environment: 'production',
      language: 'javascript',
      throughput_per_min: 150,
      time_range: { from: '2025-01-01T00:00:00Z', to: '2025-01-02T00:00:00Z' },
      freshness: { last_document: '2025-01-02T00:00:00Z', status: 'active' },
      data_streams: ['traces-apm-default'],
    },
    {
      name: 'backend',
      environment: 'production',
      language: 'java',
      throughput_per_min: 300,
      time_range: { from: '2025-01-01T00:00:00Z', to: '2025-01-02T00:00:00Z' },
      freshness: { last_document: '2025-01-02T00:00:00Z', status: 'active' },
      data_streams: ['traces-apm-default'],
    },
  ],
  hosts: [
    {
      name: 'host-1',
      metric_types: ['cpu', 'memory', 'disk'],
      collection_interval_seconds: 60,
      time_range: { from: '2025-01-01T00:00:00Z', to: '2025-01-02T00:00:00Z' },
      freshness: { last_document: '2025-01-02T00:00:00Z', status: 'active' },
    },
  ],
  containers: [],
  log_sources: [
    {
      dataset: 'nginx.access',
      service_name: null,
      host_name: 'host-1',
      estimated_docs_per_day: 50000,
      is_structured: true,
      field_count: 25,
      time_range: { from: '2025-01-01T00:00:00Z', to: '2025-01-02T00:00:00Z' },
      freshness: { last_document: '2025-01-02T00:00:00Z', status: 'active' },
      log_level_distribution: { info: 45000, warn: 4000, error: 1000 },
    },
  ],
  data_streams: [
    {
      name: 'traces-apm-default',
      type: 'traces',
      doc_count: 100000,
      time_range: { from: '2025-01-01T00:00:00Z', to: '2025-01-02T00:00:00Z' },
      freshness: { last_document: '2025-01-02T00:00:00Z', status: 'active' },
      key_fields: [{ name: 'transaction.duration.us', type: 'long', cardinality: 0, sample_values: [] }],
    },
    {
      name: 'metrics-system-default',
      type: 'metrics',
      doc_count: 50000,
      time_range: { from: '2025-01-01T00:00:00Z', to: '2025-01-02T00:00:00Z' },
      freshness: { last_document: '2025-01-02T00:00:00Z', status: 'active' },
      key_fields: [{ name: 'system.cpu.total.pct', type: 'double', cardinality: 0, sample_values: [] }],
    },
  ],
  discovery_time_ms: 350,
};

const mockIoTDiscoveryResult = {
  cluster_info: { name: 'iot-cluster', version: '8.15.0', is_serverless: false },
  services: [],
  hosts: [],
  containers: [],
  log_sources: [],
  data_streams: [],
  iot_profiles: [
    {
      data_stream: 'metrics-generic.otel-default',
      sites: ['Hospital', 'Restaurant'],
      device_types: ['water_quality', 'chemical'],
      devices: [
        { site: 'Hospital', device_type: 'water_quality', metric_families: [], doc_count: 400 },
      ],
      metric_fields: ['metrics.water.ph', 'metrics.chemical.dosing_rate_lpm'],
      attribute_fields: ['attributes.site.name', 'attributes.device.type'],
      total_docs: 800,
      time_range: { from: '2025-01-01T00:00:00Z', to: '2025-01-02T00:00:00Z' },
      freshness: { last_document: '2025-01-02T00:00:00Z', status: 'active' },
    },
  ],
  discovery_time_ms: 100,
};

describe('get_data_summary', () => {
  let server: ReturnType<typeof createCaptureServer>;

  beforeEach(() => {
    server = createCaptureServer();
    registerAll(server);
  });

  it('registers the tool', () => {
    expect(server.tools.has('get_data_summary')).toBe(true);
  });

  it('produces text format with markdown headers and table rows', async () => {
    const out = await invokeTool(server, 'get_data_summary', {
      discovery_result: mockDiscoveryResult,
      format: 'text',
    });

    const text = out.content[0].text;
    expect(text).toContain('# Data Summary');
    expect(text).toContain('frontend');
    expect(text).toContain('backend');
    expect(text).toContain('host-1');
    expect(text).toContain('nginx.access');
    expect(text).toContain('| Service |');
  });

  it('produces valid JSON format with expected top-level keys', async () => {
    const out = await invokeTool(server, 'get_data_summary', {
      discovery_result: mockDiscoveryResult,
      format: 'json',
    });

    const json = JSON.parse(out.content[0].text);
    expect(json).toHaveProperty('cluster');
    expect(json).toHaveProperty('services');
    expect(json).toHaveProperty('metrics');
    expect(json).toHaveProperty('logs');
    expect(json).toHaveProperty('recommendations');
    expect(json).toHaveProperty('health');

    expect(json.cluster.name).toBe('test-cluster');
    expect(json.services.service_count).toBe(2);
    expect(json.metrics.host_count).toBe(1);
    expect(json.logs.source_count).toBe(1);
  });

  it('generates dashboard recommendations', async () => {
    const out = await invokeTool(server, 'get_data_summary', {
      discovery_result: mockDiscoveryResult,
      format: 'json',
    });

    const json = JSON.parse(out.content[0].text);
    const templates = json.recommendations.dashboards.map((d: { template: string }) => d.template);

    expect(templates).toContain('service-overview');
    expect(templates).toContain('infrastructure-health');
    expect(templates).toContain('log-analysis');
    expect(templates).toContain('composite');
  });

  it('generates SLO recommendations for services', async () => {
    const out = await invokeTool(server, 'get_data_summary', {
      discovery_result: mockDiscoveryResult,
      format: 'json',
    });

    const json = JSON.parse(out.content[0].text);
    const sloNames = json.recommendations.slos.map((s: { name: string }) => s.name);

    expect(sloNames).toContain('frontend Latency SLO');
    expect(sloNames).toContain('frontend Error Rate SLO');
    expect(sloNames).toContain('backend Latency SLO');
    expect(sloNames).toContain('backend Error Rate SLO');
  });

  it('detects health issues for stale services', async () => {
    const staleResult = {
      ...mockDiscoveryResult,
      services: [
        {
          ...mockDiscoveryResult.services[0],
          name: 'stale-service',
          freshness: { last_document: '2020-01-01T00:00:00Z', status: 'stale' },
        },
      ],
    };

    const out = await invokeTool(server, 'get_data_summary', {
      discovery_result: staleResult,
      format: 'json',
    });

    const json = JSON.parse(out.content[0].text);
    const staleIssues = json.health.issues.filter(
      (i: { entity: string; issue: string }) =>
        i.entity === 'stale-service' && i.issue.includes('stale')
    );
    expect(staleIssues.length).toBeGreaterThan(0);
    expect(json.health.overall).not.toBe('healthy');
  });

  it('handles empty discovery result', async () => {
    const emptyResult = {
      cluster_info: { name: 'empty-cluster', version: '8.15.0', is_serverless: false },
      services: [],
      hosts: [],
      containers: [],
      log_sources: [],
      data_streams: [],
      discovery_time_ms: 10,
    };

    const out = await invokeTool(server, 'get_data_summary', {
      discovery_result: emptyResult,
      format: 'text',
    });

    expect(out.isError).toBeUndefined();
    const text = out.content[0].text;
    expect(text).toContain('No APM services');
  });

  it('returns error for invalid input', async () => {
    const out = await invokeTool(server, 'get_data_summary', {
      discovery_result: { garbage: true },
      format: 'text',
    });

    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain('Invalid');
  });

  it('recommends iot-overview dashboard for IoT data', async () => {
    const out = await invokeTool(server, 'get_data_summary', {
      discovery_result: mockIoTDiscoveryResult,
      format: 'json',
    });

    const json = JSON.parse(out.content[0].text);
    const templates = json.recommendations.dashboards.map((d: { template: string }) => d.template);
    expect(templates).toContain('iot-overview');
  });

  it('includes IoT section in text summary', async () => {
    const out = await invokeTool(server, 'get_data_summary', {
      discovery_result: mockIoTDiscoveryResult,
      format: 'text',
    });

    const text = out.content[0].text;
    expect(text).toContain('IoT Data');
    expect(text).toContain('Hospital');
    expect(text).toContain('metrics.water.ph');
  });
});
