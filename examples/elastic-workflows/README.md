# Elastic Workflows Demo

E-commerce order enrichment: ingest pipelines, enriched indices, ES|QL analytics, and alerting -- all through AI prompts.

## Setup

```bash
cd examples/elastic-workflows
npm install
export ES_URL="https://your-deployment:9243"
export ES_API_KEY="your-api-key"
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ES_URL` | Yes | Elasticsearch URL |
| `ES_API_KEY` | Yes (or use basic auth) | API key for Elasticsearch |
| `ES_USERNAME` | Alternative | Basic auth username |
| `ES_PASSWORD` | Alternative | Basic auth password |
| `ES_SSL_SKIP_VERIFY` | No | Set to `true` for self-signed certs |
| `KIBANA_URL` | For alerting | Kibana URL for alert rule creation |

## Run

```bash
node run-workflow.js
```

Seeds 10 products and 20 enriched orders, then prints a revenue-by-category summary.

## Demo walkthrough

See **[demo-script.md](demo-script.md)** for the full presenter script with exact prompts and expected MCP tool calls.
