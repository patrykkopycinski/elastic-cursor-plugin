---
name: vector-search-setup
description: Complete flow from index creation to working vector search with Elasticsearch
---

# Vector Search Setup with Elasticsearch

Use this skill when the user wants to add vector/semantic search to their application.

## 1. Prompt
- Clarify use case: semantic search, hybrid (keyword + vector), or RAG retrieval.
- Identify source of embeddings (application-generated vs ingest pipeline).

## 2. Provision
- Use `create_index` with a mapping that includes a `dense_vector` field (dimensions match your model, e.g. 384 or 768).
- Optionally use `create_inference_endpoint` for an embedding model (e.g. ELSER or a third-party endpoint).
- Use `create_ingest_pipeline` with an inference processor to embed text at index time if needed.

## 3. Integrate
- Index documents with `index_document` or `bulk_index`; ensure the vector field is populated (from app or pipeline).
- Use the `search` tool with a `knn` query (or `hybrid` with a keyword query) to run vector search.

## 4. Validate
- Run a sample `search` with a kNN query and confirm hits and scores.
- Suggest tuning: size, num_candidates, and optional re-ranking.
