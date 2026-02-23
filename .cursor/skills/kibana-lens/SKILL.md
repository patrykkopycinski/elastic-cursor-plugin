---
name: kibana-lens
description: Create and edit visualizations with Kibana Lens
---

# Kibana Lens

Use when the user wants to create or customize visualizations (charts, tables, gauges) in Kibana using Lens.

## 1. Prompt
- Clarify: data source (data view or ES|QL query), metric or breakdown fields, and chart type (bar, line, pie, table, gauge, etc.).
- Use `kibana_list_data_views` when KIBANA_URL is set to suggest a data view.

## 2. Provision
- Ensure the data view exists and has the needed fields; use `get_mappings` or index APIs if defining new indices.
- Point to Lens via Dashboard (Add panel → Lens) or Discover (Visualize → Create Lens visualization).
- For programmatic creation, use `kibana_create_dashboard` (see kibana-dashboard skill) — it wraps Lens panels in the as-code API format.

## 3. Integrate
- Guide: add a Lens panel, choose visualization type, drag fields to dimensions and metrics, adjust formatting.
- For dashboards: use `kibana_list_dashboards` to list existing dashboards; suggest adding the Lens chart to one.

### Display Quality Tips
- **Column aliases are labels**: In ES|QL-powered Lens panels, the column alias from `STATS` becomes the axis label, subtitle, and table header. Use `` `Avg pH` `` not `avg_val`.
- **ROUND() values**: KPI metrics and gauges look cleaner with `ROUND(AVG(field), 1)` than raw decimals.
- **Chart type choice**: Line for precision/trend metrics (chemical levels), area for flow/continuous data (water systems), bar_stacked for volume/count data.
- **Breakdown legends**: Rename dimension columns (`` site = \`attributes.site.name\` ``) so legends show "Hospital" not "attributes.site.name".

## 4. Validate
- Confirm the visualization renders and updates with time range and filters.
- Check that axis labels and legends are human-readable (not raw field names).
- Recommend saving the Lens visualization and adding it to a dashboard (see kibana-dashboard skill).
