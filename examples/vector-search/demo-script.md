# Vector Search Demo Script

Step-by-step walkthrough for presenting semantic movie search with the Elastic Cursor Plugin.

**Prerequisites:** Elastic Cursor Plugin MCP server running in Cursor with valid `ES_URL` and `ES_API_KEY`.

---

## Step 1: Create an inference endpoint

**What to say:** "First, we deploy an embedding model directly in Elasticsearch so vectors are generated server-side."

Prompt the AI:

> Create an inference endpoint called "elser" using the ELSER model for text embedding.

**MCP tool invoked:** `create_inference_endpoint`

The AI will call:

```json
{
  "task_type": "text_embedding",
  "inference_id": "elser",
  "service": "elasticsearch",
  "service_settings": {
    "model_id": ".elser_model_2_linux-x86_64",
    "num_allocations": 1,
    "num_threads": 1
  }
}
```

Wait for the model to deploy (may take a minute on first use).

---

## Step 2: Create an ingest pipeline

**What to say:** "Next, we create a pipeline that automatically generates embeddings when documents are indexed."

Prompt the AI:

> Create an ingest pipeline called "movie-embeddings" that uses the "elser" inference endpoint to generate embeddings from the "plot" field into "plot_embedding".

**MCP tool invoked:** `create_ingest_pipeline`

The AI will call:

```json
{
  "id": "movie-embeddings",
  "description": "Generate plot embeddings using ELSER",
  "processors": [
    {
      "inference": {
        "model_id": "elser",
        "input_output": [
          {
            "input_field": "plot",
            "output_field": "plot_embedding"
          }
        ]
      }
    }
  ]
}
```

---

## Step 3: Create the movies index

**What to say:** "Now we create the index with the right mappings and wire it to our embedding pipeline."

Prompt the AI:

> Create an index called "movies" with text fields for title, plot, and director; keyword for genres; float for rating; integer for year; and dense_vector for plot_embedding with 384 dimensions. Set the default pipeline to "movie-embeddings".

**MCP tool invoked:** `create_index`

The AI will call:

```json
{
  "index": "movies",
  "settings": {
    "default_pipeline": "movie-embeddings"
  },
  "mappings": {
    "properties": {
      "title": { "type": "text" },
      "plot": { "type": "text" },
      "director": { "type": "text" },
      "genres": { "type": "keyword" },
      "rating": { "type": "float" },
      "year": { "type": "integer" },
      "plot_embedding": {
        "type": "dense_vector",
        "dims": 384,
        "index": true,
        "similarity": "cosine"
      }
    }
  }
}
```

---

## Step 4: Index sample movies

**What to say:** "Let's bulk-index our movies. The pipeline will automatically generate embeddings for each plot."

Prompt the AI:

> Bulk index the movies from the seed-data.json file into the "movies" index.

**MCP tool invoked:** `bulk_index`

You can also paste the contents of `seed-data.json` directly, or reference the file. The ingest pipeline automatically generates embeddings for each document's `plot` field.

Give Elasticsearch a few seconds to process the inference pipeline for all 15 documents.

---

## Step 5: Semantic search

**What to say:** "Here's the magic -- we search by meaning, not keywords. Let's find movies about space exploration."

Prompt the AI:

> Search the movies index for "space exploration and survival" using kNN on the plot_embedding field.

**MCP tool invoked:** `search`

The AI will call:

```json
{
  "index": "movies",
  "knn": {
    "field": "plot_embedding",
    "query_vector_builder": {
      "text_embedding": {
        "model_id": "elser",
        "model_text": "space exploration and survival"
      }
    },
    "k": 5,
    "num_candidates": 20
  }
}
```

Expected top results: Interstellar, Gravity, WALL-E, Arrival.

---

## Step 6: Hybrid search

**What to say:** "Hybrid search combines keyword matching with semantic similarity for the best of both worlds."

Prompt the AI:

> Do a hybrid search on the movies index for "thriller" combining a text match on plot, title, and genres with kNN vector search on plot_embedding.

**MCP tool invoked:** `search`

The AI will call:

```json
{
  "index": "movies",
  "query": {
    "bool": {
      "should": [
        { "match": { "plot": "thriller" } },
        { "match": { "title": "thriller" } },
        { "match": { "genres": "thriller" } }
      ]
    }
  },
  "knn": {
    "field": "plot_embedding",
    "query_vector_builder": {
      "text_embedding": {
        "model_id": "elser",
        "model_text": "thriller"
      }
    },
    "k": 5,
    "num_candidates": 20
  },
  "size": 10
}
```

Hybrid search combines lexical matches (documents with "thriller" in text fields) with semantic similarity (plot embeddings close to the concept of "thriller"). Results are ranked by a combined score.

---

## Step 7: Run the Express API

**What to say:** "And here's the same search logic wrapped in a REST API you can ship to production."

Set environment variables and start the server:

```bash
cd examples/vector-search
npm install
ES_URL=https://your-cluster:9243 ES_API_KEY=your-key node app.js
```

Test the endpoints:

```bash
# Semantic search
curl "http://localhost:3000/search?q=space+exploration+and+survival"

# Hybrid search
curl "http://localhost:3000/hybrid?q=thriller"
```

These routes use the same Elasticsearch queries from steps 5 and 6, wrapped in a REST API.

---

## What this demonstrates

- **Inference endpoints** and **ingest pipelines** handle embedding generation server-side. Application code never touches raw vectors.
- **kNN search** with `query_vector_builder` converts a text query into a vector at query time, so the API accepts plain text, not vector arrays.
- **Hybrid search** combines lexical (BM25) and semantic (kNN) scoring in a single request for better relevance than either approach alone.
- The Elastic Cursor Plugin exposes all of this through MCP tools that the AI can invoke directly from the IDE.
