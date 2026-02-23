# Security (SIEM) Demo

Simulated auth log analysis: generate realistic authentication events, create detection rules, inspect alerts, and manage exceptions -- all through AI prompts.

## Setup

```bash
cd examples/security
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
| `KIBANA_URL` | For rules/alerts | Kibana URL for detection rule and alert APIs |

## Run

```bash
node generate-auth-logs.js
```

Indexes ~200 auth events into `auth-logs` with brute-force patterns, privilege escalations, and account lockouts.

## Demo walkthrough

See **[demo-script.md](demo-script.md)** for the full presenter script with exact prompts and expected MCP tool calls.
