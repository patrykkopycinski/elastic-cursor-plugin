# Agent Builder and MCP Demo

Build a knowledge base search tool in Agent Builder, test it, and connect Cursor via MCP -- all through AI prompts.

## Setup

```bash
cd examples/agent-builder-and-mcp
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
| `KIBANA_URL` | For Agent Builder | Kibana URL for Agent Builder API access |

## Run

```bash
node setup-kb.js
```

Indexes 15 internal documentation articles into `knowledge-base`.

## Demo walkthrough

See **[demo-script.md](demo-script.md)** for the full presenter script with exact prompts and expected MCP tool calls.
