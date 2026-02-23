---
name: kibana-dashboard
description: Create Kibana dashboards from descriptions
---

# Kibana Dashboard (as Code)

Use when the user wants to create or customize Kibana dashboards programmatically via the `kibana_create_dashboard` tool.

## 1. Discover Data

- Use `list_indices` and `get_mappings` to understand available fields.
- Use `esql_query` or `search` to sample data and verify field names.
- When KIBANA_URL is set, use `kibana_list_data_views` and `kibana_list_dashboards` to check existing resources.
- **Check actual data time range** — query `"aggs": { "ts": { "stats": { "field": "@timestamp" } } }` to confirm when data exists. Dashboards with `now-1h` won't show data older than 1 hour.

## 2. Create Dashboard

Call `kibana_create_dashboard` with a title, panels array, and time range.

The tool uses a **simplified panel format** — it translates panels into the raw Kibana as-code API format (`POST /api/dashboards` with `Elastic-Api-Version: 1`). The tool also handles:
- Wrapping panels in `type: "lens"` + `config.attributes` for the raw API
- Stripping unsupported `label` properties from ES|QL XY y-axis columns
- Enabling feature flags (`lens.apiFormat`, `dashboardAgent.enabled`, `lens.enable_esql`) dynamically
- Falling back to Saved Objects API for pre-9.4 Kibana

### Required Feature Flags

Kibana 9.4+ needs these in `kibana.yml` or as Docker env vars:
```yaml
feature_flags.overrides:
  dashboardAgent.enabled: true
  lens.apiFormat: true
  lens.enable_esql: true   # Required for ES|QL datasets
```
Also set `coreApp.allowDynamicConfigOverrides: true` and `server.restrictInternalApis: false` to allow the tool to enable flags at runtime.

### Grid System
- 48-column layout, infinite rows. Full-width = `w:48`, half = `w:24`, third = `w:16`, quarter = `w:12`.
- Above-the-fold on 1080p ≈ 20–24 rows. Aim for 8–12 panels above the fold.
- Heights: KPI metrics `h:8`, charts `h:12–14`, gauge `h:10–12`, tables `h:10`, markdown headers `h:4`.

### Panel Types and Schema Rules

**Markdown panel:**
```json
{ "type": "DASHBOARD_MARKDOWN", "content": "# Title\nBody text", "grid": { "x": 0, "w": 48, "h": 4 } }
```

**Metric panel (ES|QL):**
- `dataset` at panel level: `{ "type": "esql", "query": "..." }`
- `metrics` is an **array** (not a single object): `[{ "type": "primary", "operation": "value", "column": "col_name" }]`
- Optional secondary metric: add a second entry with `"type": "secondary"`
- Optional `breakdown_by`: `{ "operation": "value", "column": "col_name" }`
```json
{
  "type": "metric",
  "title": "Avg Dosing Rate",
  "dataset": { "type": "esql", "query": "FROM my-index | STATS `L/min` = AVG(field)" },
  "metrics": [{ "type": "primary", "operation": "value", "column": "L/min" }]
}
```

**XY panel (ES|QL):**
- **Dataset goes on EACH LAYER, not at the panel level.**
- Use `breakdown_by` (NOT `breakdown` — the wrong name silently causes validation failure).
- ES|QL `y` columns accept ONLY `operation` + `column` — **no `label` property** (causes hard validation error).
- The ES|QL column alias becomes the displayed axis label, so use readable aliases (e.g. `dosing` not `avg_val`).
- Layer types: `line`, `area`, `area_stacked`, `area_percentage`, `bar`, `bar_stacked`, `bar_horizontal`, `bar_horizontal_stacked`, `bar_percentage`, `bar_horizontal_percentage`
```json
{
  "type": "xy",
  "title": "Trend Over Time by Category",
  "layers": [{
    "dataset": { "type": "esql", "query": "FROM my-index | WHERE field IS NOT NULL | STATS val = AVG(field) BY @timestamp = BUCKET(@timestamp, 5 minute), category = attributes.category" },
    "type": "line",
    "x": { "operation": "value", "column": "@timestamp" },
    "y": [{ "operation": "value", "column": "val" }],
    "breakdown_by": { "operation": "value", "column": "category" }
  }]
}
```

**Gauge panel (ES|QL):**
- `dataset` at panel level
- `metric` is a **single object** (not an array): `{ "operation": "value", "column": "col" }`
```json
{
  "type": "gauge",
  "title": "Water pH (target 6.5–8.5)",
  "dataset": { "type": "esql", "query": "FROM my-index | STATS pH = AVG(metrics.water.ph)" },
  "metric": { "operation": "value", "column": "pH" }
}
```

**Datatable panel (ES|QL):**
- `dataset` at panel level
- Use `rows` + `metrics` arrays (NOT `columns` — that key is rejected)
- Both use `{ "operation": "value", "column": "col" }`
- ES|QL column aliases become the table column headers — use readable names with backtick quoting
```json
{
  "type": "datatable",
  "title": "Summary Table",
  "dataset": { "type": "esql", "query": "FROM my-index | STATS `Count` = COUNT(*), `Avg Value` = AVG(f) BY `Category` = cat_field | SORT `Category`" },
  "rows": [{ "operation": "value", "column": "Category" }],
  "metrics": [{ "operation": "value", "column": "Count" }, { "operation": "value", "column": "Avg Value" }]
}
```

### ES|QL Query Tips for Dashboards

- **Column aliases ARE the display labels.** Use `\`L/min\`` or `\`Avg pH\`` in STATS, not generic names like `avg_val`.
- **BUCKET granularity must match data density.** If data spans 1 minute, use `BUCKET(@timestamp, 10 second)`. If data spans hours, use `5 minute`. Too-large buckets collapse everything into one point.
- **Rename dimension columns** for cleaner breakdown legends: `site = attributes.site.name` instead of raw `attributes.site.name`.
- **Filter nulls** in chart queries with `WHERE field IS NOT NULL` to avoid empty data points.
- **Use AVG for counter/gauge metrics**, not SUM — OTel counter metrics may not support SUM aggregation.
- **Cross-device aggregations produce nulls** — when a metric only exists for one device type (e.g. `water.ph` for WaterSystem only), aggregating across all device types shows `null` for rows without that metric. This is expected.

### Common Mistakes to Avoid

| Mistake | Symptom | Fix |
|---------|---------|-----|
| `dataset` at XY panel root | Validation error on all layers | Move `dataset` into each layer |
| `breakdown` instead of `breakdown_by` | Validation error | Use `breakdown_by` |
| `label` on ES|QL XY y-axis columns | Validation error | Remove `label`; use readable ES|QL aliases |
| Single `metric` for metric panels | Validation error | Use `metrics` array with `type: "primary"` |
| `columns` array on datatable | Validation error | Use `rows` + `metrics` arrays |
| `time_range: "now-1h"` on old data | Empty panels | Check actual data timestamps, set absolute range |
| `BUCKET(@timestamp, 5 minute)` on 1-min data | Single flat point per series | Use smaller bucket (e.g. `10 second`) |
| `SUM` on OTel counter metrics | ES|QL error | Use `AVG` or `MAX` |
| Raw field names as ES|QL aliases | Ugly subtitles like `avg_val` | Use readable names: `` `L/min` ``, `` `pH` `` |
| Missing `lens.enable_esql` feature flag | `esql` dataset rejected with "expected dataView or index" | Add flag to `kibana.yml` or Docker env |

### dataView (non-ES|QL) Datasets

For non-ES|QL panels, use `{ "type": "dataView", "id": "data-view-id" }` or `{ "type": "index", "index": "my-index-*" }`. Operations use aggregation names: `"count"`, `"average"`, `"sum"`, `"unique_count"`, `"last_value"`, `"percentile"`, `"terms"`, `"date_histogram"` with a `field` property.

### Raw Kibana As-Code API Format

If calling `POST /api/dashboards` directly (without `kibana_create_dashboard`), the panel structure differs:
```json
{
  "title": "Dashboard Title",
  "panels": [
    {
      "type": "lens",
      "uid": "unique_id",
      "grid": { "x": 0, "y": 0, "w": 24, "h": 10 },
      "config": {
        "attributes": {
          "type": "metric",
          "title": "Panel Title",
          "dataset": { "type": "esql", "query": "..." },
          "metrics": [{ "type": "primary", "operation": "value", "column": "col" }]
        }
      }
    }
  ]
}
```
Note: Lens panels are wrapped in `type: "lens"` with chart config inside `config.attributes`. Markdown panels use `type: "DASHBOARD_MARKDOWN"` with `config.content`. The `kibana_create_dashboard` tool handles this translation automatically.

## 3. Validate

- Open the dashboard URL returned by the tool.
- Confirm all panels render with data — look for error icons or empty charts.
- Verify the time range covers the actual data window.
- Check that breakdown series appear as distinct colored lines (not collapsed into one).
- Confirm table column headers are human-readable.
- Recommend saving and sharing the dashboard.
