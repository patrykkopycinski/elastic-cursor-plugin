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

## 4. Validate
- Run the query with `esql_query` and show tabular output.
- Suggest LIMIT for large result sets and mention DISSECT/GROK for log parsing when relevant.
