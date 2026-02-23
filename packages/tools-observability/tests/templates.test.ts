/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { describe, it, expect } from 'vitest';
import { listTemplates, getTemplate, generateDashboard } from '../src/templates/index.js';
import type { DiscoveryResult } from '../src/discovery-types.js';

const mockDiscoveryResult: DiscoveryResult = {
  cluster_info: { name: 'test', version: '8.15.0', is_serverless: false },
  services: [
    {
      name: 'web-app',
      environment: 'prod',
      language: 'nodejs',
      throughput_per_min: 100,
      time_range: { from: '2025-01-01T00:00:00Z', to: '2025-01-02T00:00:00Z' },
      freshness: { last_document: '2025-01-02T00:00:00Z', status: 'active' },
      data_streams: ['traces-apm-default'],
    },
  ],
  hosts: [
    {
      name: 'host-1',
      metric_types: ['cpu', 'memory'],
      collection_interval_seconds: 60,
      time_range: { from: '2025-01-01T00:00:00Z', to: '2025-01-02T00:00:00Z' },
      freshness: { last_document: '2025-01-02T00:00:00Z', status: 'active' },
    },
  ],
  containers: [],
  log_sources: [
    {
      dataset: 'app.logs',
      service_name: 'web-app',
      host_name: 'host-1',
      estimated_docs_per_day: 10000,
      is_structured: true,
      field_count: 15,
      time_range: { from: '2025-01-01T00:00:00Z', to: '2025-01-02T00:00:00Z' },
      freshness: { last_document: '2025-01-02T00:00:00Z', status: 'active' },
      log_level_distribution: { info: 8000, error: 2000 },
    },
  ],
  data_streams: [],
  iot_profiles: [],
  discovery_time_ms: 100,
};

const emptyDiscoveryResult: DiscoveryResult = {
  cluster_info: { name: 'test', version: '8.15.0', is_serverless: false },
  services: [],
  hosts: [],
  containers: [],
  log_sources: [],
  data_streams: [],
  iot_profiles: [],
  discovery_time_ms: 50,
};

describe('dashboard templates', () => {
  describe('listTemplates', () => {
    it('returns 5 templates', () => {
      const templates = listTemplates();
      expect(templates).toHaveLength(5);
      const names = templates.map((t) => t.name);
      expect(names).toContain('service-overview');
      expect(names).toContain('infrastructure-health');
      expect(names).toContain('log-analysis');
      expect(names).toContain('composite');
      expect(names).toContain('iot-overview');
    });
  });

  describe('getTemplate', () => {
    it('returns null for unknown template', () => {
      expect(getTemplate('nonexistent')).toBeNull();
    });
  });

  describe('service-overview', () => {
    it('generates panels', () => {
      const config = generateDashboard('service-overview', mockDiscoveryResult);
      expect(config.title).toBeTruthy();
      expect(config.panels.length).toBeGreaterThan(0);

      const markdownPanel = config.panels.find(
        (p) => (p as { type: string }).type === 'DASHBOARD_MARKDOWN'
      );
      expect(markdownPanel).toBeDefined();

      for (const panel of config.panels) {
        const grid = (panel as { grid: { x: number; y: number; w: number; h: number } }).grid;
        expect(grid.x).toBeGreaterThanOrEqual(0);
        expect(grid.y).toBeGreaterThanOrEqual(0);
        expect(grid.w).toBeGreaterThan(0);
        expect(grid.h).toBeGreaterThan(0);
      }
    });
  });

  describe('infrastructure-health', () => {
    it('generates panels with grid positions', () => {
      const config = generateDashboard('infrastructure-health', mockDiscoveryResult);
      expect(config.panels.length).toBeGreaterThan(0);

      for (const panel of config.panels) {
        const grid = (panel as { grid: { x: number; y: number; w: number; h: number } }).grid;
        expect(grid).toBeDefined();
        expect(grid.w).toBeGreaterThan(0);
        expect(grid.h).toBeGreaterThan(0);
      }
    });
  });

  describe('log-analysis', () => {
    it('generates panels including log volume', () => {
      const config = generateDashboard('log-analysis', mockDiscoveryResult);
      expect(config.panels.length).toBeGreaterThan(0);

      const volumePanel = config.panels.find(
        (p) => (p as { title: string }).title === 'Log Volume Over Time'
      );
      expect(volumePanel).toBeDefined();
    });
  });

  describe('composite', () => {
    it('combines categories and has more panels than any single template', () => {
      const composite = generateDashboard('composite', mockDiscoveryResult);
      const serviceOnly = generateDashboard('service-overview', mockDiscoveryResult);
      const infraOnly = generateDashboard('infrastructure-health', mockDiscoveryResult);
      const logsOnly = generateDashboard('log-analysis', mockDiscoveryResult);

      expect(composite.panels.length).toBeGreaterThan(serviceOnly.panels.length);
      expect(composite.panels.length).toBeGreaterThan(infraOnly.panels.length);
      expect(composite.panels.length).toBeGreaterThan(logsOnly.panels.length);
    });
  });

  describe('overrides', () => {
    it('respects title override', () => {
      const config = generateDashboard('service-overview', mockDiscoveryResult, {
        title: 'Custom Title',
      });
      expect(config.title).toBe('Custom Title');
    });
  });

  describe('grid overlap', () => {
    it('panels have non-overlapping grids within each template', () => {
      const templateNames = ['service-overview', 'infrastructure-health', 'log-analysis', 'composite'];

      for (const name of templateNames) {
        const config = generateDashboard(name, mockDiscoveryResult);

        for (let i = 0; i < config.panels.length; i++) {
          for (let j = i + 1; j < config.panels.length; j++) {
            const a = (config.panels[i] as { grid: { x: number; y: number; w: number; h: number } }).grid;
            const b = (config.panels[j] as { grid: { x: number; y: number; w: number; h: number } }).grid;

            const xOverlap = a.x < b.x + b.w && a.x + a.w > b.x;
            const yOverlap = a.y < b.y + b.h && a.y + a.h > b.y;

            if (xOverlap && yOverlap) {
              throw new Error(
                `Panels overlap in template "${name}": panel ${i} (x:${a.x},y:${a.y},w:${a.w},h:${a.h}) and panel ${j} (x:${b.x},y:${b.y},w:${b.w},h:${b.h})`
              );
            }
          }
        }
      }
    });
  });

  describe('iot-overview', () => {
    const iotDiscoveryResult: DiscoveryResult = {
      ...emptyDiscoveryResult,
      iot_profiles: [
        {
          data_stream: 'metrics-generic.otel-default',
          sites: ['Hospital', 'Restaurant', 'Food Plant'],
          device_types: ['water_quality', 'chemical', 'sanitation'],
          devices: [
            { site: 'Hospital', device_type: 'water_quality', metric_families: [], doc_count: 300 },
            { site: 'Restaurant', device_type: 'chemical', metric_families: [], doc_count: 250 },
          ],
          metric_fields: [
            'metrics.water.ph',
            'metrics.water.flow_rate_lpm',
            'metrics.chemical.dosing_rate_lpm',
            'metrics.sanitation.sanitizer_ppm',
          ],
          attribute_fields: ['attributes.site.name', 'attributes.device.type', 'attributes.region'],
          total_docs: 800,
          time_range: { from: '2025-01-01T00:00:00Z', to: '2025-01-02T00:00:00Z' },
          freshness: { last_document: '2025-01-02T00:00:00Z', status: 'active' },
        },
      ],
    };

    it('generates panels from IoT profile', () => {
      const config = generateDashboard('iot-overview', iotDiscoveryResult);
      expect(config.title).toContain('IoT');
      expect(config.panels.length).toBeGreaterThan(0);
      expect(config.tags).toContain('iot');
      expect(config.tags).toContain('otel');
    });

    it('includes header, KPI, time-series, and table panels', () => {
      const config = generateDashboard('iot-overview', iotDiscoveryResult);

      const header = config.panels.find(
        (p) => (p as { type: string }).type === 'DASHBOARD_MARKDOWN'
      );
      expect(header).toBeDefined();

      const metrics = config.panels.filter(
        (p) => (p as { type: string }).type === 'metric'
      );
      expect(metrics.length).toBeGreaterThan(0);

      const charts = config.panels.filter(
        (p) => (p as { type: string }).type === 'xy'
      );
      expect(charts.length).toBeGreaterThan(0);

      const tables = config.panels.filter(
        (p) => (p as { type: string }).type === 'datatable'
      );
      expect(tables.length).toBeGreaterThan(0);
    });

    it('generates gauge for pH field', () => {
      const config = generateDashboard('iot-overview', iotDiscoveryResult);

      const gauge = config.panels.find(
        (p) => (p as { type: string }).type === 'gauge'
      );
      expect(gauge).toBeDefined();
    });

    it('returns empty panels with no IoT data', () => {
      const config = generateDashboard('iot-overview', emptyDiscoveryResult);
      expect(config.panels).toHaveLength(0);
      expect(config.title).toContain('IoT');
    });

    it('respects title override', () => {
      const config = generateDashboard('iot-overview', iotDiscoveryResult, {
        title: 'My IoT Dashboard',
      });
      expect(config.title).toBe('My IoT Dashboard');
    });

    it('panels have non-overlapping grids', () => {
      const config = generateDashboard('iot-overview', iotDiscoveryResult);

      for (let i = 0; i < config.panels.length; i++) {
        for (let j = i + 1; j < config.panels.length; j++) {
          const a = (config.panels[i] as { grid: { x: number; y: number; w: number; h: number } }).grid;
          const b = (config.panels[j] as { grid: { x: number; y: number; w: number; h: number } }).grid;

          const xOverlap = a.x < b.x + b.w && a.x + a.w > b.x;
          const yOverlap = a.y < b.y + b.h && a.y + a.h > b.y;

          if (xOverlap && yOverlap) {
            throw new Error(
              `IoT panels overlap: panel ${i} (x:${a.x},y:${a.y},w:${a.w},h:${a.h}) and panel ${j} (x:${b.x},y:${b.y},w:${b.w},h:${b.h})`
            );
          }
        }
      }
    });
  });

  describe('error handling', () => {
    it('throws for unknown template', () => {
      expect(() => generateDashboard('nonexistent', mockDiscoveryResult)).toThrow();
    });
  });

  describe('empty data', () => {
    it('returns valid config with empty discovery result', () => {
      const config = generateDashboard('composite', emptyDiscoveryResult);
      expect(config.title).toBeTruthy();
      expect(Array.isArray(config.panels)).toBe(true);
      expect(config.time_from).toBeTruthy();
      expect(config.time_to).toBeTruthy();
    });
  });
});
