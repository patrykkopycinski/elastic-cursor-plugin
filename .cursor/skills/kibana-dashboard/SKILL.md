---
name: kibana-dashboard
description: Create Kibana dashboards from descriptions
---

# Kibana Dashboard

Use when the user wants to create or customize Kibana dashboards (visualizations, Lens, or legacy).

## 1. Prompt
- Clarify: data source (index pattern or data view), metrics or log-based, and key visualizations (time series, bar, table, map).
- Confirm they have access to Kibana and the target indices.

## 2. Provision
- Use `list_indices` and `get_mappings` so the user (or LLM) knows available fields. When KIBANA_URL is set, use `kibana_list_data_views` and `kibana_list_dashboards` to list existing data views and dashboards.
- If they use observability tools: `create_dashboard` (when available) or describe steps in Kibana.

## 3. Integrate
- Guide: create a data view in Kibana for the index pattern; then create visualizations (Lens or legacy) and add them to a dashboard.
- For APM: use the built-in APM dashboards; suggest custom dashboards for specific services.

## 4. Validate
- Confirm the dashboard loads and shows data; suggest filters and time range.
- Recommend saving and sharing the dashboard.
