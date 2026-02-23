---
name: kibana-lens
description: Create and edit visualizations with Kibana Lens
---

# Kibana Lens

Use when the user wants to create or customize visualizations (charts, tables, gauges) in Kibana using Lens.

## 1. Prompt
- Clarify: data source (data view), metric or breakdown fields, and chart type (bar, line, pie, table, etc.).
- Use `kibana_list_data_views` when KIBANA_URL is set to suggest a data view.

## 2. Provision
- Ensure the data view exists and has the needed fields; use `get_mappings` or index APIs if defining new indices.
- Point to Lens via Dashboard (Add panel → Lens) or Discover (Visualize → Create Lens visualization).

## 3. Integrate
- Guide: add a Lens panel, choose visualization type, drag fields to dimensions and metrics, adjust formatting.
- For dashboards: use `kibana_list_dashboards` to list existing dashboards; suggest adding the Lens chart to one.

## 4. Validate
- Confirm the visualization renders and updates with time range and filters.
- Recommend saving the Lens visualization and adding it to a dashboard (see kibana-dashboard skill).
