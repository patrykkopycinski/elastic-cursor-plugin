---
name: search-app-setup
description: Build an Elastic search application from scratch
---

# Search Application Setup

Use when the user wants to create a search application with Elastic (Search Applications, App Search, or programmatic search).

## 1. Prompt
- Clarify: Search UI / custom front-end vs Kibana Discover. Need for synonyms, relevance tuning, or analytics.

## 2. Provision
- Use `create_index` for the search index; optionally `create_search_application` when that tool is available.
- Use `manage_synonyms` if they need synonym support.

## 3. Integrate
- Index sample data with `index_document` or `bulk_index`.
- Use `search` tool to run queries; optionally `test_search` for validation.
- For UI: suggest `generate_search_ui` (when available) or point to Search UI library and Elasticsearch client.

## 4. Validate
- Run `test_search` or manual `search` with expected queries; confirm results and relevance.
- Tune mappings and analyzers if needed.
