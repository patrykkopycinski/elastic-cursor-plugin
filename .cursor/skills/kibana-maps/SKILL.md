---
name: kibana-maps
description: Create and use Kibana Maps for geospatial data
---

# Kibana Maps

Use when the user wants to visualize geospatial data (points, regions, heatmaps) in Kibana.

## 1. Prompt
- Clarify: data source (index/data view), geo field (geo_point or geo_shape), and whether they have base layers or WMS.
- Use `kibana_list_data_views` and `get_mappings` to confirm geo fields exist.

## 2. Provision
- Ensure the index has a geo_point or geo_shape field and a data view. Create the data view if needed (see kibana-data-views skill).
- Use `kibana_list_saved_objects` with type `map` to list existing maps when KIBANA_URL is set.

## 3. Integrate
- Guide: open Maps, add a layer (e.g. Documents from index), choose the geo field and optional metrics/labels. Add layers (EMS, WMS) as needed.
- Reference `kibana_info` for the Maps app URL: `/app/maps`.

## 4. Validate
- Confirm the map loads and documents render; suggest filters and time range. Recommend saving the map and adding to a dashboard if useful.
