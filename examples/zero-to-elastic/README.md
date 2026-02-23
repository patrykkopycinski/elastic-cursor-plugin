# Zero to Elastic -- Bookstore Search Demo

A small Node.js Express app that acts as a bookstore search API backed by
Elasticsearch. Use it to demonstrate the "zero to first search" experience with
the Elastic Cursor Plugin.

## What is included

| File | Purpose |
|------|---------|
| `app.js` | Express server with `/health`, `/search?q=`, `/books/:id`, and `POST /seed` routes |
| `seed-data.json` | 20 sample books across sci-fi, mystery, history, romance, and technology |
| `demo-script.md` | Step-by-step presenter walkthrough using MCP tools from the Cursor chat |
| `package.json` | Dependencies: `express`, `@elastic/elasticsearch` |

## Quick start

```bash
cd examples/zero-to-elastic
npm install

# Set your Elasticsearch credentials
export ES_URL=http://localhost:9200
export ES_USERNAME=elastic
export ES_PASSWORD=changeme

node app.js
```

Seed the data and search:

```bash
curl -X POST http://localhost:3000/seed
curl "http://localhost:3000/search?q=science+fiction"
curl http://localhost:3000/books/1
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ES_URL` | Yes | Elasticsearch endpoint |
| `ES_API_KEY` | No | API key auth (preferred over basic auth) |
| `ES_USERNAME` | No | Basic auth username |
| `ES_PASSWORD` | No | Basic auth password |
| `ES_SSL_SKIP_VERIFY` | No | Set `true` to skip TLS verification (dev only) |
| `PORT` | No | HTTP port (default 3000) |

## Live demo

See **[demo-script.md](demo-script.md)** for a presenter-friendly walkthrough
that provisions Elasticsearch, creates the index, seeds data, runs searches, and
executes ES|QL queries -- all from the Cursor chat panel in under 5 minutes.
