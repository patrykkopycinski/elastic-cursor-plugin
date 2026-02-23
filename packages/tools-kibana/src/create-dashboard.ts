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
import { kibanaFetch, getKibanaUrl } from './types.js';

const panelSchema = z.object({
  title: z.string().describe('Panel title shown in the dashboard'),
  visualization_type: z
    .enum(['lnsXY', 'lnsPie', 'lnsMetric', 'lnsDatatable', 'lnsGauge', 'lnsHeatmap', 'markdown'])
    .describe('Lens visualization type or "markdown" for a text panel'),
  esql_query: z
    .string()
    .optional()
    .describe('ES|QL query for data (ignored for markdown panels)'),
  markdown_content: z
    .string()
    .optional()
    .describe('Markdown text (only for markdown panels)'),
  width: z.number().optional().default(24).describe('Grid width (1-48, default 24 = half row)'),
  height: z.number().optional().default(15).describe('Grid height (default 15)'),
});

const inputSchema = z.object({
  title: z.string().describe('Dashboard title'),
  description: z.string().optional().default('').describe('Dashboard description'),
  panels: z.array(panelSchema).min(1).describe('Panels to add to the dashboard'),
  tags: z.array(z.string()).optional().describe('Tag names to attach'),
  time_from: z.string().optional().default('now-15m').describe('Time range start (e.g. "now-24h")'),
  time_to: z.string().optional().default('now').describe('Time range end (e.g. "now")'),
  data_view_id: z
    .string()
    .optional()
    .describe('Default data view ID for Lens panels (overrides per-panel ES|QL)'),
});

type PanelInput = z.infer<typeof panelSchema>;
type CreateDashboardInput = z.infer<typeof inputSchema>;

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

const ok = (text: string): ToolResult => ({ content: [{ type: 'text', text }] });
const fail = (text: string): ToolResult => ({ content: [{ type: 'text', text }], isError: true });

async function tryEnableDashboardAgent(): Promise<'enabled' | 'already_enabled' | 'unavailable'> {
  const flagCheck = await kibanaFetch(
    '/internal/core/_settings?apiVersion=1',
    { method: 'PUT', body: { 'feature_flags.overrides': { 'dashboardAgent.enabled': true } } }
  );
  if (flagCheck.ok) return 'enabled';

  const statusCheck = await kibanaFetch('/api/status');
  if (!statusCheck.ok) return 'unavailable';

  return 'unavailable';
}

async function createViaDashboardApi(input: CreateDashboardInput): Promise<ToolResult> {
  const panels = layoutPanels(input.panels);

  const body: Record<string, unknown> = {
    title: input.title,
    description: input.description,
    panels,
    time_range: { from: input.time_from, to: input.time_to },
  };
  if (input.tags?.length) body.tags = input.tags;

  const result = await kibanaFetch('/api/dashboards?apiVersion=1', {
    method: 'POST',
    body,
  });

  if (result.ok) {
    const data = result.data as { id?: string };
    const base = getKibanaUrl()?.replace(/\/$/, '') ?? '';
    return ok(
      [
        `Dashboard created via Dashboard API (experimental).`,
        `ID: ${data.id ?? 'unknown'}`,
        base ? `URL: ${base}/app/dashboards#/view/${data.id}` : '',
        `Strategy: Dashboard CRUD API (Tier 2)`,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  return fail(result.error ?? 'Dashboard API request failed');
}

async function createViaSavedObjects(input: CreateDashboardInput): Promise<ToolResult> {
  const createdPanelRefs: Array<{ id: string; type: string; title: string }> = [];

  for (const panel of input.panels) {
    if (panel.visualization_type === 'markdown') continue;

    const lensState = buildLensState(panel, input.data_view_id);
    const lensResult = await kibanaFetch('/api/saved_objects/lens', {
      method: 'POST',
      body: {
        attributes: {
          title: panel.title,
          visualizationType: panel.visualization_type,
          state: lensState,
        },
      },
    });

    if (!lensResult.ok) {
      return fail(`Failed to create Lens visualization "${panel.title}": ${lensResult.error}`);
    }

    const so = lensResult.data as { id?: string };
    if (so.id) {
      createdPanelRefs.push({ id: so.id, type: 'lens', title: panel.title });
    }
  }

  const { panelsJSON, references } = buildSavedObjectPanels(input.panels, createdPanelRefs);

  const dashResult = await kibanaFetch('/api/saved_objects/dashboard', {
    method: 'POST',
    body: {
      attributes: {
        title: input.title,
        description: input.description,
        panelsJSON,
        optionsJSON: JSON.stringify({
          useMargins: true,
          syncColors: true,
          syncTooltips: true,
          syncCursor: true,
        }),
        timeRestore: true,
        timeFrom: input.time_from,
        timeTo: input.time_to,
        kibanaSavedObjectMeta: { searchSourceJSON: '{"query":{"query":"","language":"kuery"},"filter":[]}' },
      },
      references,
    },
  });

  if (!dashResult.ok) {
    return fail(`Failed to create dashboard saved object: ${dashResult.error}`);
  }

  const dash = dashResult.data as { id?: string };
  const base = getKibanaUrl()?.replace(/\/$/, '') ?? '';
  const lensIds = createdPanelRefs.map((r) => r.id).join(', ');

  return ok(
    [
      `Dashboard created via Saved Objects API.`,
      `Dashboard ID: ${dash.id ?? 'unknown'}`,
      lensIds ? `Lens visualization IDs: ${lensIds}` : '',
      base ? `URL: ${base}/app/dashboards#/view/${dash.id}` : '',
      `Strategy: Saved Objects fallback (Tier 3)`,
    ]
      .filter(Boolean)
      .join('\n')
  );
}

function layoutPanels(panels: PanelInput[]): Array<Record<string, unknown>> {
  let currentY = 0;

  return panels.map((panel, i) => {
    const grid = { x: 0, y: currentY, w: panel.width, h: panel.height };
    currentY += panel.height;

    if (panel.visualization_type === 'markdown') {
      return {
        type: 'visualization',
        uid: `panel_${i}`,
        grid,
        config: {
          savedVis: {
            type: 'markdown',
            title: panel.title,
            params: { markdown: panel.markdown_content ?? '', fontSize: 12 },
          },
        },
      };
    }

    return {
      type: 'lens',
      uid: `panel_${i}`,
      grid,
      config: buildLensConfig(panel),
    };
  });
}

function buildLensConfig(panel: PanelInput): Record<string, unknown> {
  return {
    attributes: {
      title: panel.title,
      visualizationType: panel.visualization_type,
      state: buildLensState(panel),
    },
  };
}

function buildLensState(
  panel: PanelInput,
  dataViewId?: string
): Record<string, unknown> {
  const query = panel.esql_query
    ? { esql: panel.esql_query }
    : { query: '', language: 'kuery' };

  return {
    datasourceStates: {
      textBased: {
        layers: {
          layer_0: {
            index: dataViewId ?? '',
            query: panel.esql_query ? { esql: panel.esql_query } : undefined,
            columns: [],
          },
        },
      },
    },
    visualization: { layerId: 'layer_0', layerType: 'data' },
    query,
    filters: [],
  };
}

function buildSavedObjectPanels(
  panels: PanelInput[],
  lensRefs: Array<{ id: string; type: string; title: string }>
): { panelsJSON: string; references: Array<{ name: string; type: string; id: string }> } {
  const references: Array<{ name: string; type: string; id: string }> = [];
  let lensIdx = 0;
  let currentY = 0;

  const soPanel = panels.map((panel, i) => {
    const gridData = { x: 0, y: currentY, w: panel.width, h: panel.height, i: String(i) };
    currentY += panel.height;

    if (panel.visualization_type === 'markdown') {
      return {
        gridData,
        panelIndex: String(i),
        type: 'visualization',
        embeddableConfig: {
          savedVis: {
            type: 'markdown',
            title: panel.title,
            params: { markdown: panel.markdown_content ?? '', fontSize: 12 },
          },
        },
      };
    }

    const ref = lensRefs[lensIdx++];
    if (ref) {
      const refName = `panel_${i}:panel_${i}`;
      references.push({ name: refName, type: 'lens', id: ref.id });
      return {
        gridData,
        panelIndex: String(i),
        type: 'lens',
        panelRefName: refName,
      };
    }

    return { gridData, panelIndex: String(i), type: 'lens', embeddableConfig: {} };
  });

  return { panelsJSON: JSON.stringify(soPanel), references };
}

export function registerCreateDashboard(server: ToolRegistrationContext): void {
  server.registerTool(
    'kibana_create_dashboard',
    {
      title: 'Kibana: Create Dashboard (as Code)',
      description: `Programmatically create a Kibana dashboard with Lens visualizations and markdown panels.

Uses a tiered strategy:
1. Try enabling the Dashboard Agent feature flag (requires coreApp.allowDynamicConfigOverrides: true)
2. Fall back to the Dashboard CRUD API (internal/experimental, requires ?apiVersion=1)
3. Fall back to creating Lens saved objects + Dashboard saved object via the Saved Objects API

Requires KIBANA_URL and KIBANA_API_KEY (or ES_API_KEY).`,
      inputSchema,
    },
    async (args) => {
      const base = getKibanaUrl();
      if (!base) {
        return fail(
          'Set KIBANA_URL and KIBANA_API_KEY (or ES_API_KEY) to create dashboards programmatically.'
        );
      }

      const raw = args as Partial<CreateDashboardInput>;
      const input: CreateDashboardInput = {
        title: raw.title ?? '',
        description: raw.description ?? '',
        panels: (raw.panels ?? []).map((p) => ({
          ...p,
          width: p.width ?? 24,
          height: p.height ?? 15,
        })),
        tags: raw.tags,
        time_from: raw.time_from ?? 'now-15m',
        time_to: raw.time_to ?? 'now',
        data_view_id: raw.data_view_id,
      };
      const strategies: Array<{ name: string; attempt: () => Promise<ToolResult> }> = [];
      const notes: string[] = [];

      const agentStatus = await tryEnableDashboardAgent();
      if (agentStatus === 'enabled') {
        notes.push('Dashboard Agent feature flag enabled successfully.');
      } else if (agentStatus === 'already_enabled') {
        notes.push('Dashboard Agent feature flag was already enabled.');
      } else {
        notes.push(
          'Dashboard Agent feature flag could not be enabled (coreApp.allowDynamicConfigOverrides may be false).'
        );
      }

      strategies.push(
        { name: 'Dashboard CRUD API', attempt: () => createViaDashboardApi(input) },
        { name: 'Saved Objects API', attempt: () => createViaSavedObjects(input) }
      );

      for (const strategy of strategies) {
        const result = await strategy.attempt();
        if (!result.isError) {
          const prefix = notes.length ? notes.join(' ') + '\n\n' : '';
          const text = result.content[0]?.text ?? '';
          return ok(prefix + text);
        }
        notes.push(`${strategy.name} failed: ${result.content[0]?.text ?? 'unknown error'}`);
      }

      return fail(
        [
          'All strategies failed to create the dashboard.',
          '',
          ...notes,
          '',
          'Troubleshooting:',
          '- Verify KIBANA_URL and KIBANA_API_KEY are correct',
          '- Check that the Kibana user has dashboard create permissions',
          '- For Dashboard CRUD API: the API is internal/experimental',
          '- For Saved Objects: ensure saved_objects API access is allowed',
        ].join('\n')
      );
    }
  );
}
