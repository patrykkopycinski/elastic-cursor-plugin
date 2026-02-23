---
name: kibana-data-views
description: Create and manage Kibana data views (index patterns)
---

# Kibana Data Views

Use when the user wants to create, list, or manage Kibana data views (index patterns) for use in Discover, Dashboards, and Lens.

## 1. Prompt
- Clarify: index pattern (e.g. `logs-*`, `metrics-*`), time field (e.g. `@timestamp`), and optional name.
- Use `kibana_list_data_views` when KIBANA_URL and auth are set to show existing data views.

## 2. Provision
- Data views are created in Kibana: Stack Management → Data Views → Create data view. Provide index pattern, time field, and name.
- If indices don’t exist yet, use Elasticsearch tools (`create_index`, `index_document`) first.

## 3. Integrate
- Guide: create the data view in Kibana; then use it in Discover, Dashboard, or Lens. Reference `kibana_info` for Stack Management URL.
- For rollups or scripted fields, direct them to the data view edit screen in Kibana.

## 4. Validate
- Confirm the data view appears in `kibana_list_data_views` (if configured) and in Discover’s data view picker.
- Recommend one data view per logical dataset (e.g. logs, metrics, APM) for clarity.
