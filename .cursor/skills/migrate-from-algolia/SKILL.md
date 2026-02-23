---
name: migrate-from-algolia
description: Migration workflow from Algolia to Elasticsearch
---

# Migrate from Algolia to Elasticsearch

Use when the user wants to migrate search from Algolia to Elasticsearch.

## 1. Prompt
- Identify: index structure, attributes for search vs display, facets, and ranking needs.
- Clarify need for typo tolerance, synonyms, and analytics.

## 2. Provision
- Use `create_index` with mappings that mirror Algolia attributes (text, keyword, numeric, nested).
- Configure analyzers for typo tolerance (e.g. standard + phonetic or custom).
- Use `manage_synonyms` to import Algolia synonym sets if available.

## 3. Integrate
- Export records from Algolia (API or dashboard). Transform to Elasticsearch document format.
- Use `bulk_index` to load data. Replicate faceted attributes as keyword or numeric for aggregations.
- Replace Algolia search with `search` tool: use bool query with match for query string, and aggs for facets.

## 4. Validate
- Run side-by-side queries; compare relevance and facet counts.
- Tune analyzers and boost settings to match Algolia behavior where possible.
