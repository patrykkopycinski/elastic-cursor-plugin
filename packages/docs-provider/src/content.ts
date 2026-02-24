/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export const DOCS_API_SEARCH = `# Elasticsearch Search API

## POST /<index>/_search

Execute a search with Query DSL.

### Request body
- \`query\`: Query DSL (match, term, bool, range, kNN, etc.)
- \`size\`: Number of hits (default 10)
- \`from\`: Offset
- \`sort\`: Sort specification
- \`aggs\`: Aggregations
- \`highlight\`: Highlight configuration

### Example
\`\`\`json
POST /my-index/_search
{
  "query": { "match": { "message": "hello" } },
  "size": 10
}
\`\`\`

[Reference](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-search.html)
`;

export const DOCS_MIGRATION_8_TO_9 = `# Migration: Elasticsearch 8.x to 9.x

## Key changes
- **Breaking**: Removal of deprecated mapping and API options. Review deprecation warnings in 8.x.
- **Security**: Default security settings tightened; ensure TLS and API keys in production.
- **ES|QL**: Enhanced; prefer ES|QL for analytics where applicable.
- **Indexing**: Some legacy index options removed; reindex if using deprecated settings.

## Steps
1. Run the Elasticsearch 8.x migration assistant (Kibana or API).
2. Fix deprecations in your queries and mappings.
3. Test in a 9.x staging cluster before upgrading production.
4. Plan a reindex for indices using removed features.

[Migration Guide](https://www.elastic.co/guide/en/elasticsearch/reference/current/migrating-8.0.html)
`;

export const DOCS_ESQL = `# ES|QL (Elasticsearch Query Language)

## Syntax
\`\`\`
FROM index [| WHERE condition] [| EVAL expr] [| STATS ... BY key] [| SORT ...] [| LIMIT n]
\`\`\`

## Examples
- \`FROM logs | WHERE status == "error" | LIMIT 100\`
- \`FROM metrics | STATS avg(cpu) BY host\`
- \`FROM my-index | EVAL round(price * 1.1, 2) | SORT price DESC | LIMIT 10\`

Use POST /_query with body \`{ "query": "..." }\`. Returns columns and values.
`;

export const DOCS_API_ELASTICSEARCH = `# Elasticsearch REST API Reference

## Index Management

### PUT /<index>
Create an index with optional settings and mappings.
- \`settings\`: shards, replicas, analysis config
- \`mappings\`: field type definitions

### GET /<index>
Retrieve index settings, mappings, and aliases.

### DELETE /<index>
Delete an index. Supports wildcards and comma-separated list.

### GET /_cat/indices?v
List all indices with health, status, doc count, and store size.
- \`format=json\`: Return JSON instead of text
- \`h=index,health,docs.count,store.size\`: Select columns

### GET /<index>/_mapping
Get field mappings for an index.

### PUT /<index>/_mapping
Add new fields to an existing mapping. Fields cannot be removed or have their type changed.
- Body: \`{ "properties": { "field": { "type": "keyword" } } }\`

---

## Document CRUD

### POST /<index>/_doc
Index a document with an auto-generated ID.
- Body: the JSON document
- \`?pipeline=<name>\`: Apply an ingest pipeline
- \`?refresh=wait_for\`: Make document searchable immediately

### PUT /<index>/_doc/<id>
Index or replace a document with a specific ID.

### GET /<index>/_doc/<id>
Retrieve a document by ID. Returns \`_source\` with the document body.

### DELETE /<index>/_doc/<id>
Delete a document by ID.

### POST /_bulk
Execute multiple index, create, update, or delete operations in a single request.
\`\`\`json
POST /_bulk
{ "index": { "_index": "my-index", "_id": "1" } }
{ "field": "value" }
{ "delete": { "_index": "my-index", "_id": "2" } }
\`\`\`
- \`?refresh=wait_for\`: Refresh after bulk completes
- Each action + optional body is a separate newline-delimited JSON line

---

## Search

### POST /<index>/_search
Execute a search query against one index.
- \`query\`: Query DSL object (match, term, bool, range, knn, nested, etc.)
- \`size\`: Number of hits to return (default 10)
- \`from\`: Offset for pagination
- \`sort\`: Array of sort clauses, e.g. \`[{ "timestamp": "desc" }]\`
- \`aggs\`: Aggregation definitions (see Aggregations section)
- \`highlight\`: Highlight matching terms in results
- \`_source\`: Filter returned fields, e.g. \`["title", "date"]\`
- \`track_total_hits\`: Set to \`true\` for exact total count

### POST /_search
Search across all indices or use comma-separated index names in the path.

\`\`\`json
POST /logs-*/_search
{
  "query": {
    "bool": {
      "must": [{ "match": { "message": "error" } }],
      "filter": [{ "range": { "@timestamp": { "gte": "now-1h" } } }]
    }
  },
  "size": 20,
  "sort": [{ "@timestamp": "desc" }]
}
\`\`\`

---

## Aggregations

Use within the \`aggs\` field of a search request.

| Aggregation | Description | Example |
|---|---|---|
| \`terms\` | Group by field values | \`{ "aggs": { "by_status": { "terms": { "field": "status" } } } }\` |
| \`date_histogram\` | Bucket by date interval | \`{ "fixed_interval": "1h", "field": "@timestamp" }\` |
| \`avg\` | Average of a numeric field | \`{ "avg": { "field": "response_time" } }\` |
| \`sum\` | Sum of a numeric field | \`{ "sum": { "field": "bytes" } }\` |
| \`min\` / \`max\` | Min/max of a numeric field | \`{ "min": { "field": "price" } }\` |
| \`cardinality\` | Approximate distinct count | \`{ "cardinality": { "field": "user.id" } }\` |

Aggregations can be nested: place sub-aggregations inside a bucket aggregation's \`aggs\` key.

---

## Ingest Pipelines

### PUT /_ingest/pipeline/<id>
Create or update an ingest pipeline.
\`\`\`json
PUT /_ingest/pipeline/my-pipeline
{
  "description": "Extract fields",
  "processors": [
    { "grok": { "field": "message", "patterns": ["%{IP:client}"] } },
    { "set": { "field": "ingested_at", "value": "{{{_ingest.timestamp}}}" } }
  ]
}
\`\`\`

### GET /_ingest/pipeline
List all pipelines. Use \`GET /_ingest/pipeline/<id>\` for a specific one.

### DELETE /_ingest/pipeline/<id>
Delete a pipeline.

### POST /_ingest/pipeline/<id>/_simulate
Test a pipeline against sample documents.
- \`docs\`: Array of \`{ "_source": { ... } }\` documents

---

## Inference

### PUT /_inference/<task_type>/<id>
Create an inference endpoint. Task types: \`text_embedding\`, \`completion\`, \`sparse_embedding\`, \`rerank\`.
- \`service\`: Provider name (e.g. \`elasticsearch\`, \`openai\`, \`cohere\`, \`azure_openai\`)
- \`service_settings\`: Provider-specific config (model_id, api_key, etc.)

### GET /_inference
List all inference endpoints. Use \`GET /_inference/<task_type>/<id>\` for a specific one.

### DELETE /_inference/<task_type>/<id>
Delete an inference endpoint.

---

## Cluster

### GET /_cluster/health
Cluster health status (green/yellow/red), node count, active shards.
- \`?level=indices\`: Per-index health breakdown

### GET /_cluster/stats
Comprehensive cluster statistics: nodes, indices, memory, disk, JVM.

### GET /_cat/shards?v
List shard allocation across nodes.
- \`format=json\`: Return JSON

### GET /_nodes/stats
Per-node stats: JVM heap, thread pools, OS metrics, indexing/search rates.

---

## ES|QL

### POST /_query
Execute an ES|QL query. Returns columnar results.
\`\`\`json
POST /_query
{
  "query": "FROM logs-* | WHERE status == \\"error\\" | STATS count = COUNT(*) BY host | SORT count DESC | LIMIT 10"
}
\`\`\`
- \`format\`: Response format (\`json\`, \`csv\`, \`txt\`)
- \`columnar\`: If \`true\`, return columns instead of rows
`;

export const DOCS_API_KIBANA = `# Kibana REST API Reference

> **Required headers for all Kibana API requests:**
> \`\`\`
> kbn-xsrf: true
> x-elastic-internal-origin: kibana
> Content-Type: application/json
> \`\`\`

## Saved Objects

### GET /api/saved_objects/_find
Search for saved objects across types.
- \`type\`: Required. Object type (\`dashboard\`, \`visualization\`, \`index-pattern\`, \`lens\`, etc.)
- \`search\`: Search query string
- \`per_page\` / \`page\`: Pagination (default 20 per page)
- \`sort_field\` / \`sort_order\`: Sorting

### POST /api/saved_objects/_find
Same as GET, with body parameters.

### GET /api/saved_objects/<type>/<id>
Retrieve a single saved object by type and ID.

### POST /api/saved_objects/<type>
Create a new saved object.
- \`attributes\`: Object-specific data
- \`references\`: Array of related objects

### DELETE /api/saved_objects/<type>/<id>
Delete a saved object. Use \`?force=true\` to delete even if other objects reference it.

---

## Dashboards

### GET /api/dashboards/dashboard/<id>
Retrieve a dashboard by ID. Returns panels, filters, and metadata.

### POST /api/dashboards/dashboard
Create a new dashboard.
- \`attributes.title\`: Dashboard title
- \`attributes.panels\`: Array of panel configs (visualization references, grid position, size)
- \`attributes.optionsJSON\`: Dashboard options (useMargins, syncColors, etc.)

### PUT /api/dashboards/dashboard/<id>
Update an existing dashboard (full replacement).

### DELETE /api/dashboards/dashboard/<id>
Delete a dashboard.

---

## Data Views

### GET /api/data_views
List all data views. Returns array of \`{ id, title, name }\`.

### POST /api/data_views/data_view
Create a data view.
\`\`\`json
{
  "data_view": {
    "title": "logs-*",
    "name": "Logs",
    "timeFieldName": "@timestamp"
  }
}
\`\`\`

### GET /api/data_views/data_view/<id>
Get a specific data view by ID.

### DELETE /api/data_views/data_view/<id>
Delete a data view.

---

## Alerting

### POST /api/alerting/rule
Create a new alerting rule.
- \`name\`: Rule name
- \`rule_type_id\`: Rule type (e.g. \`.es-query\`, \`metrics.alert.threshold\`, \`apm.anomaly\`)
- \`consumer\`: Kibana app that owns the rule (e.g. \`alerts\`, \`infrastructure\`, \`apm\`)
- \`schedule\`: \`{ "interval": "5m" }\`
- \`params\`: Rule-type-specific parameters
- \`actions\`: Array of actions (connector_id, params)

### GET /api/alerting/rules/_find
Search alerting rules.
- \`search\`: Search string
- \`per_page\` / \`page\`: Pagination

### GET /api/alerting/rule/<id>
Get a single rule by ID.

### PUT /api/alerting/rule/<id>
Update a rule (full replacement of mutable fields: name, schedule, params, actions).

### DELETE /api/alerting/rule/<id>
Delete a rule.

---

## SLOs (Service Level Objectives)

### POST /api/observability/slos
Create an SLO.
- \`name\`, \`description\`: Metadata
- \`indicator\`: SLI definition (type: \`sli.kql.custom\`, \`sli.apm.transactionDuration\`, etc.)
- \`timeWindow\`: Rolling or calendar window
- \`objective\`: \`{ "target": 0.99 }\`
- \`budgetingMethod\`: \`occurrences\` or \`timeslices\`

### GET /api/observability/slos
List all SLOs. Supports \`?kqlQuery=\` for filtering.

### GET /api/observability/slos/<id>
Get a specific SLO.

### PUT /api/observability/slos/<id>
Update an SLO.

### DELETE /api/observability/slos/<id>
Delete an SLO.

---

## Detection Rules (Security)

### POST /api/detection_engine/rules
Create a detection rule.
- \`name\`, \`description\`: Rule metadata
- \`type\`: Rule type (\`query\`, \`eql\`, \`threshold\`, \`machine_learning\`, \`esql\`)
- \`query\`: Detection query (KQL or ES|QL depending on type)
- \`index\`: Index patterns to query
- \`severity\`: \`low\`, \`medium\`, \`high\`, \`critical\`
- \`risk_score\`: 0–100
- \`interval\`: Run frequency, e.g. \`"5m"\`
- \`enabled\`: Boolean

### GET /api/detection_engine/rules/_find
Search detection rules.
- \`per_page\` / \`page\`: Pagination
- \`filter\`: KQL filter string

### PUT /api/detection_engine/rules
Update an existing detection rule (include \`id\` or \`rule_id\` in body).

### DELETE /api/detection_engine/rules
Delete a rule. Pass \`?id=<rule_id>\` as query parameter.
`;

export const DOCS_API_CLOUD = `# Elastic Cloud API Reference

> **Base URL:** \`https://api.elastic-cloud.com\`
> **Auth header:** \`Authorization: ApiKey <cloud-api-key>\`

## Serverless Projects

### GET /api/v1/serverless/projects/elasticsearch
List all Elasticsearch serverless projects.

### POST /api/v1/serverless/projects/elasticsearch
Create a new serverless Elasticsearch project.
- \`name\`: Project name
- \`region_id\`: Deployment region (e.g. \`aws-us-east-1\`, \`gcp-us-central1\`)
- \`optimized_for\`: \`general_purpose\`, \`vector_search\`

### GET /api/v1/serverless/projects/elasticsearch/<id>
Get details of a specific serverless project (endpoints, status, credentials).

### DELETE /api/v1/serverless/projects/elasticsearch/<id>
Delete a serverless project. This is irreversible.

---

## API Keys (Serverless)

### POST /api/v1/serverless/projects/elasticsearch/<id>/credentials/api-key
Generate an API key for a serverless project.
- \`name\`: Key name
- \`role_descriptors\`: Permission scoping (optional; omit for full access)
- \`expiration\`: Key TTL, e.g. \`"30d"\` (optional)

Returns \`{ "id", "api_key", "encoded" }\`. The \`encoded\` value is used in the \`Authorization: ApiKey <encoded>\` header.

---

## Traditional (Hosted) Deployments

### GET /api/v1/deployments
List all deployments. Supports \`?size=\` and \`?from=\` for pagination.

### GET /api/v1/deployments/<id>
Get deployment details: Elasticsearch endpoint, Kibana URL, node configurations, health.

### POST /api/v1/deployments/<id>/elasticsearch/main-elasticsearch/_reset-password
Reset the \`elastic\` user password. Returns \`{ "username": "elastic", "password": "..." }\`.

---

## Common Patterns

### Get connection config for a serverless project
1. \`GET /api/v1/serverless/projects/elasticsearch/<id>\` → extract \`endpoints.elasticsearch\`
2. \`POST .../credentials/api-key\` → get \`encoded\` API key
3. Connect: \`ES_URL=<endpoint>\`, \`ES_API_KEY=<encoded>\`
`;

const cache = new Map<string, string>();

export function getCached(uri: string): string | undefined {
  return cache.get(uri);
}

export function setCached(uri: string, content: string): void {
  cache.set(uri, content);
}

export function getDocByPath(path: string): string | null {
  const normalized = path.replace(/^\/+/, '').toLowerCase();
  if (normalized === 'api/search' || normalized === 'api/search-api') return DOCS_API_SEARCH;
  if (normalized === 'migration/8-to-9' || normalized === 'migration/8x-9x') return DOCS_MIGRATION_8_TO_9;
  if (normalized === 'esql' || normalized === 'esql-guide') return DOCS_ESQL;
  if (normalized === 'api/elasticsearch') return DOCS_API_ELASTICSEARCH;
  if (normalized === 'api/kibana') return DOCS_API_KIBANA;
  if (normalized === 'api/cloud') return DOCS_API_CLOUD;
  return null;
}
