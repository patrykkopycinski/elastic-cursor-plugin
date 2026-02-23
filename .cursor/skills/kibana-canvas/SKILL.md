---
name: kibana-canvas
description: Create pixel-perfect reports and dashboards with Kibana Canvas
---

# Kibana Canvas

Use when the user wants to build pixel-perfect reports, slide decks, or custom dashboards in Kibana Canvas.

## 1. Prompt
- Clarify: purpose (report, status board, slide deck), data sources (data views, saved searches), and design (layout, text, images).
- Use `kibana_list_saved_objects` with type `canvas-workpad` to list workpads when KIBANA_URL is set.

## 2. Provision
- Ensure required data views and (if needed) saved searches exist. Use `kibana_list_data_views` to suggest data views.
- Point to Canvas via `kibana_info`: `/app/canvas`.

## 3. Integrate
- Guide: create a workpad, add elements (text, images, charts), add data sources (Elasticsearch SQL, saved search, etc.), and style. Use Canvas expressions for dynamic content.
- For scheduled reports, direct them to reporting or export options in Kibana.

## 4. Validate
- Confirm the workpad renders and data elements update; suggest refreshing and saving. Recommend sharing or exporting (PDF, PNG) as needed.
