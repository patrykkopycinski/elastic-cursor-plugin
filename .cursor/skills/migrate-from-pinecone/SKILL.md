---
name: migrate-from-pinecone
description: Migration workflow from Pinecone to Elasticsearch
---

# Migrate from Pinecone to Elasticsearch

Use when the user wants to move from Pinecone to Elasticsearch for vector search.

## 1. Prompt
- Identify: index name, dimensions, and whether they use metadata filtering.
- Confirm embedding model (same model recommended for compatibility).

## 2. Provision
- Create an Elasticsearch index with `create_index`: include a `dense_vector` field (same dimensions as Pinecone) and any metadata fields they filter on.
- Use `create_ingest_pipeline` with inference for embeddings if they want server-side embedding; otherwise app-side.

## 3. Integrate
- Export vectors (and metadata) from Pinecone (API or export). Map to ES document shape.
- Use `bulk_index` to load data into Elasticsearch. Use same embedding model for queries.
- Replace Pinecone query calls with `search` tool using kNN query.

## 4. Validate
- Run the same test queries on both systems and compare top-k results.
- Tune num_candidates and size for latency/recall tradeoff.
