/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { z } from 'zod';
import type { ToolRegistrationContext } from './types.js';
import { kibanaFetch } from './types.js';
import {
  ok,
  fail,
  requireKibanaUrl,
  enableFeatureFlags,
  dashboardUrl,
  kibanaAsCodeFetch,
} from './dashboard-helpers.js';

const dataViewDatasetSchema = z.object({
  type: z.literal('dataView'),
  id: z.string().describe('Data view ID'),
});

const esqlDatasetSchema = z.object({
  type: z.literal('esql'),
  query: z.string().describe('ES|QL query string'),
});

const datasetSchema = z.discriminatedUnion('type', [dataViewDatasetSchema, esqlDatasetSchema]);

const columnRefSchema = z.object({
  type: z.string().optional().describe('Metric type: "primary" or "secondary" (required for metric chart metrics array)'),
  operation: z.string().optional().describe('Operation type: "value" for ES|QL columns, or aggregation like "count", "average", "sum", "terms", "date_histogram"'),
  column: z.string().optional().describe('Column name from ES|QL query result'),
  field: z.string().optional().describe('Field name for dataView aggregations'),
  size: z.number().optional().describe('Number of buckets for terms aggregation'),
  label: z.string().optional().describe('Custom label (only for metric/datatable panels, NOT for xy y-axis with ES|QL)'),
});

const xyLayerSchema = z.object({
  type: z.enum([
    'bar', 'line', 'area',
    'area_percentage', 'area_stacked',
    'bar_horizontal', 'bar_horizontal_stacked', 'bar_horizontal_percentage',
    'bar_percentage', 'bar_stacked',
  ]).default('bar').describe('Layer chart type'),
  dataset: datasetSchema.describe('Data source for this layer (required for as-code API — each XY layer carries its own dataset)'),
  x: columnRefSchema.optional().describe('X-axis dimension'),
  y: z.array(columnRefSchema).optional().describe('Y-axis metrics. For ES|QL layers only "operation"+"column" are valid (no "label")'),
  breakdown_by: columnRefSchema.optional().describe('Breakdown/split series dimension'),
});

const lensMarkdownPanelSchema = z.object({
  type: z.literal('DASHBOARD_MARKDOWN'),
  uid: z.string().optional().describe('Unique panel ID'),
  content: z.string().describe('Markdown text content'),
  grid: z
    .object({
      x: z.number().default(0),
      y: z.number().optional(),
      w: z.number().default(48),
      h: z.number().default(4),
    })
    .optional(),
});

const lensPanelSchema = z.object({
  type: z
    .enum(['metric', 'xy', 'gauge', 'heatmap', 'tagcloud', 'datatable', 'region_map', 'legacy_metric'])
    .describe('Lens chart type'),
  uid: z.string().optional().describe('Unique panel ID'),
  title: z.string().optional().describe('Panel title'),
  dataset: datasetSchema.optional().describe('Data source: esql or dataView. For xy panels, put dataset on each layer instead.'),
  grid: z
    .object({
      x: z.number().default(0),
      y: z.number().optional(),
      w: z.number().default(24),
      h: z.number().default(10),
    })
    .optional(),
  metric: columnRefSchema.optional().describe('Primary metric (for gauge). For metric type, use "metrics" array instead.'),
  metrics: z.array(columnRefSchema).optional().describe('Metrics array. For metric type: [{ type: "primary", operation: "value", column: "col" }]. For datatable: [{ operation: "value", column: "col" }]'),
  layers: z.array(xyLayerSchema).optional().describe('Chart layers (for xy type). Each layer must have its own dataset.'),
  xAxis: columnRefSchema.optional().describe('X-axis (for heatmap)'),
  yAxis: columnRefSchema.optional().describe('Y-axis (for heatmap)'),
  rows: z.array(columnRefSchema).optional().describe('Row dimensions (for datatable)'),
  columns: z.array(columnRefSchema).optional().describe('Column definitions (for datatable)'),
  breakdown_by: columnRefSchema.optional().describe('Breakdown dimension (for metric type)'),
  tag_by: columnRefSchema.optional().describe('Tag dimension (for tagcloud)'),
  region: z.object({
    operation: z.string().optional(),
    column: z.string().optional(),
    field: z.string().optional(),
    fields: z.array(z.string()).optional(),
    size: z.number().optional(),
    ems: z.object({
      boundaries: z.string(),
      join: z.string(),
    }).optional(),
  }).optional().describe('Region dimension (for region_map)'),
});

const panelSchema = z.discriminatedUnion('type', [
  lensMarkdownPanelSchema,
  lensPanelSchema.extend({ type: z.literal('metric') }),
  lensPanelSchema.extend({ type: z.literal('xy') }),
  lensPanelSchema.extend({ type: z.literal('gauge') }),
  lensPanelSchema.extend({ type: z.literal('heatmap') }),
  lensPanelSchema.extend({ type: z.literal('tagcloud') }),
  lensPanelSchema.extend({ type: z.literal('datatable') }),
  lensPanelSchema.extend({ type: z.literal('region_map') }),
  lensPanelSchema.extend({ type: z.literal('legacy_metric') }),
]);

const inputSchema = z.object({
  title: z.string().describe('Dashboard title'),
  description: z.string().optional().describe('Dashboard description'),
  panels: z.array(panelSchema).min(1).describe('Panels to add to the dashboard'),
  id: z.string().optional().describe('Custom dashboard ID (auto-generated if omitted)'),
  tags: z.array(z.string()).optional().describe('Tag names to attach'),
  time_from: z.string().optional().describe('Time range start (default: "now-24h")'),
  time_to: z.string().optional().describe('Time range end (default: "now")'),
  space: z.string().optional().describe('Kibana space ID (default: "default")'),
});

type PanelInput = z.infer<typeof panelSchema>;
type CreateDashboardInput = z.infer<typeof inputSchema>;

function isEsqlDataset(dataset?: { type: string }): boolean {
  return dataset?.type === 'esql';
}

function stripLabel(ref: Record<string, unknown>): Record<string, unknown> {
  const { label, ...rest } = ref;
  return rest;
}

function buildAsCodePanels(panels: PanelInput[]): Array<Record<string, unknown>> {
  let currentY = 0;

  return panels.map((panel, i) => {
    const defaultGrid = panel.type === 'DASHBOARD_MARKDOWN'
      ? { x: 0, w: 48, h: 4 }
      : { x: 0, w: 24, h: 10 };

    const grid = {
      x: panel.grid?.x ?? defaultGrid.x,
      y: panel.grid?.y ?? currentY,
      w: panel.grid?.w ?? defaultGrid.w,
      h: panel.grid?.h ?? defaultGrid.h,
    };
    currentY = grid.y + grid.h;

    if (panel.type === 'DASHBOARD_MARKDOWN') {
      return {
        type: 'DASHBOARD_MARKDOWN',
        uid: panel.uid ?? `panel_${i}`,
        grid,
        config: { content: panel.content },
      };
    }

    const attributes: Record<string, unknown> = { type: panel.type };
    if (panel.title) attributes.title = panel.title;

    if (panel.type === 'metric') {
      if (panel.dataset) attributes.dataset = panel.dataset;
      const esql = isEsqlDataset(panel.dataset);
      if (panel.metrics?.length) {
        attributes.metrics = panel.metrics.map((m) => ({
          type: m.type ?? 'primary',
          operation: m.operation ?? 'value',
          ...(m.column ? { column: m.column } : {}),
          ...(m.field ? { field: m.field } : {}),
          ...(m.label ? { label: m.label } : {}),
        }));
      } else if (panel.metric) {
        attributes.metrics = [{
          type: 'primary',
          operation: panel.metric.operation ?? 'value',
          ...(panel.metric.column ? { column: panel.metric.column } : {}),
          ...(panel.metric.field ? { field: panel.metric.field } : {}),
        }];
      }
      if (panel.breakdown_by) {
        attributes.breakdown_by = esql ? stripLabel(panel.breakdown_by) : panel.breakdown_by;
      }
    } else if (panel.type === 'xy') {
      if (panel.layers) {
        attributes.layers = panel.layers.map((layer) => {
          const l: Record<string, unknown> = { type: layer.type };
          const layerEsql = isEsqlDataset(layer.dataset);
          l.dataset = layer.dataset ?? panel.dataset;
          if (layer.x) l.x = layerEsql ? stripLabel(layer.x) : layer.x;
          if (layer.y) {
            l.y = layerEsql
              ? layer.y.map(stripLabel)
              : layer.y;
          }
          if (layer.breakdown_by) {
            l.breakdown_by = layerEsql ? stripLabel(layer.breakdown_by) : layer.breakdown_by;
          }
          return l;
        });
      }
    } else if (panel.type === 'gauge') {
      if (panel.dataset) attributes.dataset = panel.dataset;
      if (panel.metric) attributes.metric = panel.metric;
    } else if (panel.type === 'datatable') {
      if (panel.dataset) attributes.dataset = panel.dataset;
      if (panel.metrics) attributes.metrics = panel.metrics;
      if (panel.rows) attributes.rows = panel.rows;
      if (panel.columns) attributes.columns = panel.columns;
    } else {
      if (panel.dataset) attributes.dataset = panel.dataset;
      if (panel.metric) attributes.metric = panel.metric;
      if (panel.metrics) attributes.metrics = panel.metrics;
      if (panel.xAxis) attributes.xAxis = panel.xAxis;
      if (panel.yAxis) attributes.yAxis = panel.yAxis;
      if (panel.rows) attributes.rows = panel.rows;
      if (panel.columns) attributes.columns = panel.columns;
      if (panel.tag_by) attributes.tag_by = panel.tag_by;
      if (panel.region) attributes.region = panel.region;
    }

    return {
      type: 'lens',
      uid: panel.uid ?? `panel_${i}`,
      grid,
      config: { attributes },
    };
  });
}

function buildSavedObjectPanels(
  panels: PanelInput[],
  lensRefs: Array<{ id: string; type: string }>
): { panelsJSON: string; references: Array<{ name: string; type: string; id: string }> } {
  const references: Array<{ name: string; type: string; id: string }> = [];
  let lensIdx = 0;
  let currentY = 0;

  const soPanels = panels.map((panel, i) => {
    const isMarkdown = panel.type === 'DASHBOARD_MARKDOWN';
    const defaultW = isMarkdown ? 48 : 24;
    const defaultH = isMarkdown ? 4 : 10;
    const w = panel.grid?.w ?? defaultW;
    const h = panel.grid?.h ?? defaultH;
    const gridData = { x: panel.grid?.x ?? 0, y: panel.grid?.y ?? currentY, w, h, i: String(i) };
    currentY = gridData.y + h;

    if (isMarkdown && panel.type === 'DASHBOARD_MARKDOWN') {
      return {
        gridData,
        panelIndex: String(i),
        type: 'visualization',
        embeddableConfig: {
          savedVis: {
            type: 'markdown',
            title: '',
            params: { markdown: panel.content, fontSize: 12 },
          },
        },
      };
    }

    const ref = lensRefs[lensIdx++];
    if (ref) {
      const refName = `panel_${i}:panel_${i}`;
      references.push({ name: refName, type: 'lens', id: ref.id });
      return { gridData, panelIndex: String(i), type: 'lens', panelRefName: refName };
    }
    return { gridData, panelIndex: String(i), type: 'lens', embeddableConfig: {} };
  });

  return { panelsJSON: JSON.stringify(soPanels), references };
}

async function createViaAsCodeApi(input: CreateDashboardInput): Promise<{ ok: boolean; result?: ReturnType<typeof ok>; error?: string }> {
  const panels = buildAsCodePanels(input.panels);
  const body: Record<string, unknown> = {
    data: {
      title: input.title,
      description: input.description ?? '',
      panels,
      time_range: { from: input.time_from ?? 'now-24h', to: input.time_to ?? 'now' },
    },
  };
  if (input.id) body.id = input.id;
  if (input.space) body.spaces = [input.space];
  if (input.tags?.length) (body.data as Record<string, unknown>).tags = input.tags;

  const res = await kibanaAsCodeFetch('/api/dashboards', { method: 'POST', body });

  if (res.ok) {
    const data = res.data as { id?: string; data?: { title?: string; panels?: unknown[] } };
    const id = data?.id ?? input.id ?? 'unknown';
    const url = dashboardUrl(id);
    return {
      ok: true,
      result: ok(
        [
          `Dashboard created via as-code API.`,
          `ID: ${id}`,
          `Panels: ${data?.data?.panels?.length ?? panels.length}`,
          url ? `URL: ${url}` : '',
          `Strategy: Dashboard as-code API`,
        ].filter(Boolean).join('\n')
      ),
    };
  }

  return { ok: false, error: res.error ?? 'Dashboard as-code API request failed' };
}

async function createViaSavedObjects(input: CreateDashboardInput): Promise<{ ok: boolean; result?: ReturnType<typeof ok>; error?: string }> {
  const lensRefs: Array<{ id: string; type: string }> = [];

  for (const panel of input.panels) {
    if (panel.type === 'DASHBOARD_MARKDOWN') continue;

    const lensBody: Record<string, unknown> = {
      title: panel.title ?? input.title,
      visualizationType: panel.type === 'xy' ? 'lnsXY' : `lns${panel.type.charAt(0).toUpperCase()}${panel.type.slice(1)}`,
      state: {
        datasourceStates: { textBased: { layers: {} } },
        visualization: {},
        query: { query: '', language: 'kuery' },
        filters: [],
      },
    };

    const lensResult = await kibanaFetch('/api/saved_objects/lens', {
      method: 'POST',
      body: { attributes: lensBody },
    });

    if (!lensResult.ok) {
      return { ok: false, error: `Failed to create Lens "${panel.title ?? panel.type}": ${lensResult.error}` };
    }

    const so = lensResult.data as { id?: string };
    if (so.id) lensRefs.push({ id: so.id, type: 'lens' });
  }

  const { panelsJSON, references } = buildSavedObjectPanels(input.panels, lensRefs);

  const dashResult = await kibanaFetch('/api/saved_objects/dashboard', {
    method: 'POST',
    body: {
      attributes: {
        title: input.title,
        description: input.description ?? '',
        panelsJSON,
        optionsJSON: JSON.stringify({ useMargins: true, syncColors: true, syncTooltips: true, syncCursor: true }),
        timeRestore: true,
        timeFrom: input.time_from ?? 'now-24h',
        timeTo: input.time_to ?? 'now',
        kibanaSavedObjectMeta: { searchSourceJSON: '{"query":{"query":"","language":"kuery"},"filter":[]}' },
      },
      references,
    },
  });

  if (!dashResult.ok) {
    return { ok: false, error: `Failed to create dashboard saved object: ${dashResult.error}` };
  }

  const dash = dashResult.data as { id?: string };
  const id = dash?.id ?? 'unknown';
  const url = dashboardUrl(id);
  const lensIds = lensRefs.map((r) => r.id).join(', ');

  return {
    ok: true,
    result: ok(
      [
        `Dashboard created via Saved Objects API (legacy fallback).`,
        `Dashboard ID: ${id}`,
        lensIds ? `Lens IDs: ${lensIds}` : '',
        url ? `URL: ${url}` : '',
        `Strategy: Saved Objects fallback`,
      ].filter(Boolean).join('\n')
    ),
  };
}

const TOOL_DESCRIPTION = `Programmatically create a Kibana dashboard with Lens visualizations and markdown panels.

Uses the Kibana as-code API format (Kibana 9.4+). Panels use semantic chart types and minimal definitions.

**Strategy:**
1. Attempt to enable feature flags (lens.apiFormat, dashboardAgent.enabled) dynamically
2. Create via Dashboard as-code API (POST /api/dashboards with Elastic-Api-Version: 1)
3. Fall back to Saved Objects API for older Kibana versions

**Grid system:** 48-column, infinite-row. Full-width = w:48, half = w:24, third = w:16, quarter = w:12.
Above-the-fold on 1080p ≈ 20-24 rows. Design for density: 8-12 panels above the fold.

**Chart types:** metric, xy (line/bar/area), gauge, heatmap, tagcloud, datatable, region_map
**Dataset types:** esql (ES|QL query), dataView (data view ID)
**Markdown:** Use type "DASHBOARD_MARKDOWN" with a "content" field.

**CRITICAL schema rules for the as-code API (Kibana 9.4+):**
- **metric panels (ES|QL):** dataset at panel level, metrics array with {type:"primary", operation:"value", column:"col"}
- **xy panels:** dataset must be on EACH LAYER (not panel level). Use breakdown_by (not breakdown). ES|QL y-axis columns accept only operation+column (no label).
- **gauge panels (ES|QL):** dataset at panel level, metric object with {operation:"value", column:"col"}
- **datatable panels (ES|QL):** dataset at panel level, metrics with {operation:"value", column}, rows with {operation:"value", column}
- **ES|QL y-axis columns in xy layers do NOT support "label" — the column name from the query is used.

Requires KIBANA_URL and auth (KIBANA_API_KEY, or KIBANA_USERNAME + KIBANA_PASSWORD).`;

export function registerCreateDashboard(server: ToolRegistrationContext): void {
  server.registerTool(
    'kibana_create_dashboard',
    {
      title: 'Kibana: Create Dashboard (as Code)',
      description: TOOL_DESCRIPTION,
      inputSchema,
    },
    async (args) => {
      if (!requireKibanaUrl()) {
        return fail('Set KIBANA_URL and auth (KIBANA_API_KEY or KIBANA_USERNAME/KIBANA_PASSWORD) to create dashboards.');
      }

      const input = args as CreateDashboardInput;
      const notes = await enableFeatureFlags();

      const asCode = await createViaAsCodeApi(input);
      if (asCode.ok && asCode.result) {
        const prefix = notes.length ? notes.join(' ') + '\n\n' : '';
        return ok(prefix + (asCode.result.content[0]?.text ?? ''));
      }
      notes.push(`As-code API failed: ${asCode.error}`);

      const savedObj = await createViaSavedObjects(input);
      if (savedObj.ok && savedObj.result) {
        const prefix = notes.join(' ') + '\n\n';
        return ok(prefix + (savedObj.result.content[0]?.text ?? ''));
      }
      notes.push(`Saved Objects fallback failed: ${savedObj.error}`);

      return fail(
        [
          'All strategies failed to create the dashboard.',
          '',
          ...notes,
          '',
          'Troubleshooting:',
          '- Verify KIBANA_URL and auth credentials are correct',
          '- For as-code API: requires Kibana 9.4+, server.restrictInternalApis: false',
          '- For as-code API: add to kibana.yml: feature_flags.overrides: { lens.apiFormat: true }',
          '- For Saved Objects: ensure saved_objects API access is allowed',
        ].join('\n')
      );
    }
  );
}
