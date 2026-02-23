---
name: kibana-discover
description: Use Kibana Discover for ad-hoc search and exploration
---

# Kibana Discover

Use when the user wants to search or explore data in Kibana (ad-hoc search, log exploration, or building saved searches).

## 1. Prompt
- Clarify: which index or data view they use, time range, and whether they need a saved search or one-off exploration.
- If KIBANA_URL is set, use `kibana_list_data_views` to list available data views.

## 2. Provision
- Ensure a data view exists for the target index (Stack Management → Data Views, or Discover → Create data view).
- Use `kibana_info` for quick links; point to `/app/discover` for Discover.

## 3. Integrate
- Guide: open Discover, select the data view, set time range and query (KQL or Lucene).
- For saved searches: create in Discover then save; use `kibana_list_saved_objects` with type `search` to list them.

## 4. Validate
- Confirm they can run a query and see results; suggest columns and filters.
- Recommend saving the search if they will reuse it or add it to a dashboard.
