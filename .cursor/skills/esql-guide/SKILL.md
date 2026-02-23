---
name: esql-guide
description: Teach ES|QL query writing and when to use it
---

# ES|QL Guide

Use when the user wants to write or understand ES|QL (Elasticsearch Query Language) queries.

## 1. Prompt
- Clarify goal: ad-hoc analysis, aggregations, filtering, or transforming data.
- Identify the index (or indices) and key fields.

## 2. Provision
- Use `get_mappings` or `list_indices` so the user knows index and field names.
- Remind: ES|QL uses `FROM index | WHERE ... | STATS ... | SORT ... | LIMIT n`.

## 3. Integrate
- Teach basic syntax: FROM, WHERE, EVAL, STATS, SORT, LIMIT. Use `esql_query` to run the query.
- For aggregations: STATS count = COUNT(*), sum(field), avg(field) BY key_field.
- For time series: use DATE_TRUNC or time_bucket in EVAL/STATS.

### Display-Quality Patterns (for Kibana panels)

When writing ES|QL for Kibana dashboard panels, the column alias IS the display label:

- **Use readable aliases**: `` STATS `Tank Level (%)` = AVG(field) `` not `STATS avg_val = AVG(field)`. The alias appears as the metric subtitle, axis label, and table header.
- **ROUND() for clean numbers**: `` STATS `pH` = ROUND(AVG(field), 2) `` avoids showing `7.003575848691441` in KPIs.
- **Rename dimension columns**: `` BY `Site` = \`attributes.site.name\` `` for clean breakdown legends instead of raw dotted field paths.
- **BUCKET() interval must match data density**: If data spans 2 minutes, use `BUCKET(@timestamp, 30 seconds)`. If data spans hours, use `5 minute`. Too-large buckets collapse everything into one flat point.
- **Filter nulls for charts**: `WHERE field IS NOT NULL` prevents empty data points in time-series panels.
- **OTel counter metrics reject aggregations**: Fields with `time_series_metric: "counter"` (e.g. `metrics.sanitation.cycle_count`) reject AVG/SUM/MAX. Cast first: `EVAL c = TO_DOUBLE(counter_field) | STATS AVG(c)`.

## 4. Validate
- Run the query with `esql_query` and show tabular output.
- Suggest LIMIT for large result sets and mention DISSECT/GROK for log parsing when relevant.
