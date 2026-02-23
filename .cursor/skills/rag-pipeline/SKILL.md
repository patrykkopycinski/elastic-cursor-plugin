---
name: rag-pipeline
description: RAG setup with Elasticsearch as the retrieval backend
---

# RAG Pipeline with Elasticsearch

Use when the user wants to build a RAG (retrieval-augmented generation) system using Elasticsearch.

## 1. Prompt
- Clarify: chunking strategy, embedding model, and whether they use Elasticsearch only or with an LLM.

## 2. Provision
- Create an index with a `dense_vector` field and a text field for chunks.
- Create an ingest pipeline with an inference processor to generate embeddings from the text field.
- Or use application-side embeddings and index precomputed vectors.

## 3. Integrate
- Bulk index document chunks (with or without pipeline). Use `bulk_index` for large corpora.
- At query time: embed the user question (same model), then run `search` with a kNN query against the vector field.
- Return top-k hits to the LLM as context.

## 4. Validate
- Run a test query and verify retrieved chunks are relevant.
- Suggest ELSER/sparse for keyword-style semantics if appropriate.
