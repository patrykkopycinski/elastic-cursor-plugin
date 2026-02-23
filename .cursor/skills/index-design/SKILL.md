---
name: index-design
description: Guide optimal index mapping and design for Elasticsearch
---

# Index Design

Use when the user wants to design or optimize Elasticsearch index mappings and settings.

## 1. Prompt
- Clarify: use case (search, vectors, logs, metrics), query patterns, and scale (doc volume, QPS).
- Identify key fields: full-text vs keyword, numeric, date, nested, dense_vector.

## 2. Provision
- Use `get_mappings` on existing indices if they are refining; otherwise design from scratch.
- Apply index-design rules: keyword for exact/facet, text with right analyzer for search, dense_vector with correct dimensions, avoid unnecessary nested if not required.

## 3. Integrate
- Use `create_index` with the designed mappings and settings (number_of_shards, refresh_interval if needed).
- Document: dynamic mapping behavior, runtime fields vs indexed fields, and when to use copy_to for combined search.

## 4. Validate
- Index sample docs and run representative queries with `search` or `esql_query`.
- Suggest index templates and ILM for time-based indices if applicable.
