# Vector Search Demo

Semantic and hybrid movie search powered by Elasticsearch and the Elastic Cursor Plugin.

This example includes:

- **seed-data.json** -- 15 well-known movies with titles, directors, genres, plot descriptions, and ratings.
- **app.js** -- Express server with `/search` (semantic kNN), `/hybrid` (text + kNN), and `/seed` (bulk index) routes.
- **demo-script.md** -- Step-by-step presenter walkthrough using Cursor AI and MCP tools to set up inference, pipelines, indexing, and search from the IDE.

## Quick start

```bash
cd examples/vector-search
npm install
```

Set your Elasticsearch credentials:

```bash
export ES_URL=https://your-cluster.es.cloud:9243
export ES_API_KEY=your-api-key
```

Before running the app, you need an inference endpoint, ingest pipeline, and index with the right mappings. Follow **[demo-script.md](demo-script.md)** steps 1--3 to create them using Cursor AI, or set them up manually.

Seed the data and start the server:

```bash
node app.js
curl -X POST http://localhost:3000/seed
```

Query:

```bash
curl "http://localhost:3000/search?q=space+exploration+and+survival"
curl "http://localhost:3000/hybrid?q=thriller"
```

## Live demo

For a full presenter walkthrough (inference endpoint, ingest pipeline, index creation, bulk indexing, semantic search, hybrid search, and the Express API), see **[demo-script.md](demo-script.md)**.

## How it works

1. An ELSER inference endpoint generates text embeddings server-side.
2. An ingest pipeline calls the inference endpoint on the `plot` field during indexing, writing the result to `plot_embedding`.
3. At query time, `query_vector_builder` converts the search text into a vector using the same model.
4. Semantic search uses kNN on `plot_embedding`. Hybrid search combines kNN with BM25 text matching for better relevance.

The app never handles raw vectors. Elasticsearch manages embedding generation at both index and query time.
