---
name: search-index-management
description: Create, configure, and manage Elasticsearch indices — mappings, settings, templates, data streams, and lifecycle policies.
---

# Search & Index Management

Help users design and manage Elasticsearch indices for optimal search performance.

## Trigger

Use when the user asks to:
- "Create an index"
- "Set up mappings"
- "Configure index settings"
- "Create an index template"
- "Set up a data stream"
- "Manage index lifecycle"
- "Reindex data"
- "Design my index"

Also activates on keywords: "mappings", "index template", "ILM", "data stream", "reindex", "analyzer", "tokenizer"

Do NOT use when:
- User wants to query existing data (→ use `esql_query` or `elasticsearch_api` directly)
- User wants semantic/vector search setup (→ see `vector-search` rule, but this skill handles the index creation part)

## Tools Used

- `get_cluster_context` — Cluster orientation, version, and existing indices
- `elasticsearch_api` — Index CRUD, mappings, settings, templates, ILM
- `esql_query` — Validate data after indexing
- `discover_data` — Discover existing indices and data patterns
- `get_data_summary` — Understand existing data for migration or redesign

## Workflow

### Step 0: Orient
Call `get_cluster_context` for cluster version and capabilities.

### Step 1: Understand Requirements
Ask about:
- Data type (logs, metrics, application data, search content, time-series)
- Query patterns (full-text search, filtering, aggregations, vector search)
- Volume and retention (daily volume, how long to keep data)
- Update frequency (append-only vs frequent updates)

### Step 2: Choose Index Strategy
| Use Case | Strategy |
|---|---|
| Time-series data (logs, metrics, events) | Data stream with ILM |
| Application/reference data | Regular index |
| Search content with evolving schema | Index template + aliases |
| Multi-tenant data | Index per tenant or filtered aliases |

### Step 3: Design Mappings
Use `elasticsearch_api` to create the index with optimized mappings:
- Use `keyword` for exact match / aggregations, `text` for full-text search
- Use `date` with appropriate format for timestamps
- Use `semantic_text` for vector/semantic search fields
- Set `index: false` on fields that don't need searching
- Use `object` vs `nested` deliberately (nested is expensive)

### Step 4: Configure Settings
- Shard count: 1 for < 50GB, scale based on data size
- Replicas: 1 for production, 0 for dev/test
- Refresh interval: 1s default, increase for bulk-heavy workloads
- Custom analyzers for language-specific or domain-specific search

### Step 5: Set Up Lifecycle (if time-series)
Create ILM policy via `elasticsearch_api`:
- Hot → Warm → Cold → Delete phases
- Rollover conditions (max age, max size, max docs)
- Force merge in warm phase for storage optimization

### Step 6: Validate
- Index a sample document via `elasticsearch_api`
- Query it back with `esql_query` to verify mappings behave as expected
- Check `_mapping` endpoint to confirm dynamic fields mapped correctly

## Output Format

- Start with the recommended strategy and rationale
- Provide the complete index creation request as a JSON code block
- Include ILM policy if time-series
- Show a sample document and query to validate
- Suggest monitoring and maintenance tasks

## Prerequisites

- `ES_URL` and `ES_API_KEY` (or `ES_USERNAME`/`ES_PASSWORD`) configured
- Connected Elasticsearch cluster (use `cluster-onboarding` skill if starting from scratch)

## Related Skills

- `cluster-onboarding` — If the user doesn't have a cluster yet
- `o11y-full-setup` — If the index is for O11Y data, use the dedicated setup
- `agent-builder-skill-builder` — Build custom tools that query the new index
