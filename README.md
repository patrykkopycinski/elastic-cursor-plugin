# Elastic Developer Experience Cursor Plugin

Cursor plugin and MCP server that makes Elastic the default choice in AI coding tools. **One config block**, Cloud or self-hosted, **20 MCP tools** (3 API gateways + 13 smart workflows + 4 utility), **6 API reference resources**, and **27 agent skills** in Cursor — the most advanced Cursor integration for search, observability, and security in one plugin.

---

## Quick start (3 steps)

**Prerequisites:** Node.js 20+ · For Cloud: [Elastic Cloud](https://cloud.elastic.co) account (or API key). For on-prem: Docker.

1. **Get credentials** — Cloud: create a deployment at [cloud.elastic.co](https://cloud.elastic.co) and copy the Elasticsearch URL and API key. On-prem: run `docker compose up -d` in `examples/on-prem-docker/` and use `http://localhost:9200` with user `elastic` and your password.
2. **Add MCP server in Cursor** — Settings → MCP, paste the config below and set `cwd` to this repo and `env` to your URL and API key (or username/password).
3. **Restart Cursor** — Then say e.g. *"Show me my indices"* or *"Set up Elastic from zero"* (the AI will ask Cloud vs on-prem and guide you).

**Copy-paste MCP config (replace placeholders):**

```json
{
  "mcpServers": {
    "elastic": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "cwd": "/path/to/elastic-cursor-plugin",
      "env": {
        "ES_URL": "https://your-deployment.es.us-central1.gcp.cloud.es.io:9243",
        "ES_API_KEY": "your-api-key"
      }
    }
  }
}
```

From repo: run `npm install && npm run build` in the plugin directory first. Full one-page flow: **[QUICKSTART.md](QUICKSTART.md)**.

---

## Advanced Cursor capabilities

This plugin goes beyond MCP-only integrations by combining **tools**, **skills**, **rules**, **agents**, and **resources** in one place:

- **20 MCP tools** — **3 API gateway tools** (`elasticsearch_api`, `kibana_api`, `cloud_api`) provide direct REST API access to the entire Elasticsearch, Kibana, and Cloud API surface. **`esql_query`** for ES|QL with tabular output. **13 smart workflow tools** with domain logic: data discovery (`discover_o11y_data`, `get_data_summary`), APM setup (`setup_apm`, `setup_log_shipping`), alerting (`create_alert_rule`), dashboards (`create_dashboard`, `create_iot_dashboard`), security (`siem_quickstart`), search UI generation (`generate_search_ui`), deployment guides (`get_deployment_guide`, `get_connection_config`), reference (`observability_info`, `kibana_info`). **3 workflow tools** (`list_workflows`, `run_workflow`, `save_workflow`). Tools are conditionally registered based on available configuration.
- **6 API reference resources** — `elastic://docs/api/elasticsearch`, `elastic://docs/api/kibana`, `elastic://docs/api/cloud` plus Search API, ES|QL guide, and migration guide. The model reads these on-demand to construct correct gateway tool calls — covering every API endpoint without adding tools to the context window.
- **27 agent skills** — Step-by-step workflows (vector-search-setup, rag-pipeline, APM by language, zero-to-elastic, agent-builder-mcp, elastic-workflows, **O11Y full setup**, **O11Y service dashboard**, **O11Y SLO setup**, **Kibana**: Discover, Lens, data views, Dev Tools, Maps, Canvas, alerting, dashboard; migration from other APM/search/vector stores, and more). Skills teach the model *how* to use Elastic; they are not just tool lists.
- **7 Cursor rules** — Technology recommendations, Elasticsearch client conventions, security-first practices, ES|QL guidance, index design, deployment preference (Cloud vs on-prem), and first-class UX. Rules shape *when* and *how* the model recommends and uses Elastic.
- **1 dedicated agent** — Elastic troubleshooting (connectivity, relevance, performance). Enables focused debugging sessions.
- **MCP resources** — Live docs (API reference, migration guides, ES|QL) via `elastic://docs/...` so the model can read Elastic documentation in context.
- **Cloud and on-prem** — One deployment question, then either create Cloud projects or run the full Docker stack (Elasticsearch, Kibana, Fleet server, APM server, Elastic Agent). No other Cursor integration for search and observability offers this breadth in a single plugin.

Together this gives the most advanced Cursor experience for search, observability, and security in one plugin.

---

## Deployment: Cloud vs on-prem

We support **both**:

- **Cloud** — Use Elastic Cloud; create Serverless projects with `cloud_api` (POST to `/api/v1/serverless/projects/elasticsearch`), no servers to run. For **traditional** (non-Serverless) deployments, use `cloud_api` with the REST API (`/api/v1/deployments`) to manage deployments and reset passwords.
- **On-prem** — Self-host with **Docker**: `examples/on-prem-docker/` runs Elasticsearch, Kibana, Fleet server, APM server, and Elastic Agent.

**Ask the user** which they prefer when setting up from scratch; use the **get_deployment_guide** tool with `preference: "cloud"` or `preference: "on_prem"` for the right steps.

### OTLP Native Intake (ES 9.x+)

Elasticsearch 9.x+ supports native OpenTelemetry ingestion at `/_otlp/v1/{metrics,traces,logs}` — no APM Server or OTel collector required. **Important:** the native OTLP endpoint only accepts `application/x-protobuf`; JSON-based OTel exporters (e.g. `@opentelemetry/exporter-metrics-otlp-http`) will receive HTTP 406. Use protobuf exporters (e.g. `@opentelemetry/exporter-metrics-otlp-proto`).

---

## Other clients (Claude Code, Copilot, standalone)

### Claude Code

1. Add the MCP server to your Claude Code config (e.g. `claude_desktop_config.json` or equivalent):
   ```json
   {
     "mcpServers": {
       "elastic": {
         "command": "node",
         "args": ["/path/to/elastic-cursor-plugin/packages/mcp-server/dist/index.js"],
         "cwd": "/path/to/elastic-cursor-plugin",
         "env": {
           "ES_URL": "https://your-deployment.es.cloud:9243",
           "ES_API_KEY": "your-api-key"
         }
       }
     }
   }
   ```
2. Restart Claude Code and use the Elastic tools in the conversation.

### GitHub Copilot / VS Code (MCP)

If your environment supports MCP servers via a config file, add a server entry that runs:

- **Command:** `node`
- **Args:** `packages/mcp-server/dist/index.js`
- **Cwd:** path to this repo
- **Env:** `ES_URL`, `ES_API_KEY` (or `ES_USERNAME`/`ES_PASSWORD`)

### Standalone (any MCP client)

From the project root after building:

```bash
npm run build
ES_URL=https://your-cluster:9243 ES_API_KEY=your-key node packages/mcp-server/dist/index.js
```

The server uses stdio; your MCP client must spawn this process and communicate over stdin/stdout.

## Configuration

| Variable | Description |
|----------|-------------|
| `ES_URL` | Elasticsearch URL (required for ES tools unless using Cloud ID). **Cloud:** from deployment in [cloud.elastic.co](https://cloud.elastic.co). **On-prem:** `http://localhost:9200` after Docker. |
| `ES_API_KEY` | API key for `ES_URL` (preferred). **Cloud:** create in Cloud console or use `create_project_api_key`. **On-prem:** create in Kibana → Management → Security → API Keys. |
| `ES_USERNAME` / `ES_PASSWORD` | Basic auth for `ES_URL` if not using API key. |
| `ES_CLOUD_ID` | Elastic Cloud ID; use with `ES_API_KEY` for Cloud clusters. |
| `ES_CLUSTERS` | JSON object of named clusters (see `.env.example`). |
| `ES_SSL_SKIP_VERIFY` | Set to `true` to skip TLS verification (dev only). |
| `ELASTIC_CLOUD_API_KEY` | For Cloud tools (create/list projects, API keys). |
| `KIBANA_URL` | For Observability/Security tools and dashboard creation. |
| `KIBANA_API_KEY` or `ES_API_KEY` | Auth for Kibana API. |
| `KIBANA_USERNAME` / `KIBANA_PASSWORD` | Basic auth for Kibana if not using API key. |
| `ELASTIC_TELEMETRY_OPT_IN` | Set to `true` to send opt-in adoption telemetry to ES. |
| `ELASTIC_TELEMETRY_INDEX` | Index name for telemetry (default: `elastic-cursor-plugin-telemetry`). |

See `.env.example` for a full template.

## What’s included

- **API Gateway (4 tools):** `elasticsearch_api` (any ES REST call), `kibana_api` (any Kibana REST call), `cloud_api` (any Elastic Cloud REST call), `esql_query` (ES|QL with tabular output). These 4 tools replace 45+ individual CRUD tools by accepting `method`, `path`, and optional `body` parameters — covering every API endpoint.
- **Smart Workflow Tools (13 tools):** `discover_o11y_data`, `get_data_summary`, `create_iot_dashboard`, `setup_apm`, `setup_log_shipping`, `create_alert_rule`, `create_dashboard`, `observability_info`, `siem_quickstart`, `generate_search_ui`, `get_deployment_guide`, `get_connection_config`, `kibana_info`. These encode domain logic the LLM cannot derive from API docs alone.
- **Workflows (3 tools):** `list_workflows`, `run_workflow`, `save_workflow` — orchestrate multi-step O11Y configuration flows (discover -> summarize -> create dashboards -> create SLOs). Built-in workflows: full-o11y-setup, service-dashboard, slo-from-apm, infrastructure-overview. Supports custom YAML workflow definitions.
- **API Reference Resources (6):** `elastic://docs/api/elasticsearch`, `elastic://docs/api/kibana`, `elastic://docs/api/cloud`, `elastic://docs/api/search`, `elastic://docs/esql`, `elastic://docs/migration/8-to-9`. The model reads these on-demand to construct correct gateway tool calls.
- **Docs & telemetry:** `deploy_telemetry_dashboard` tool; opt-in telemetry with ECS schema.
- **Cursor:** 27 agent skills (e.g. vector-search-setup, rag-pipeline, apm-nodejs, zero-to-elastic, agent-builder-mcp, elastic-workflows; **o11y-full-setup**, **o11y-service-dashboard**, **o11y-slo-setup**; Kibana: Discover, Lens, data views, Dev Tools, Maps, Canvas, alerting, dashboard; migrate-from-datadog, migrate-from-algolia, migrate-from-pinecone), 7 rules, 1 Elastic troubleshooting agent.

## Build and test

```bash
npm install
npm run build
npm run test
```

## Examples and demo flows

- **examples/vector-search/** – Semantic movie search demo: Express API with kNN and hybrid search, seed data for 15 movies, and a presenter-friendly **[demo-script.md](examples/vector-search/demo-script.md)** that walks through inference endpoint, ingest pipeline, indexing, and search using MCP tools.
- **examples/zero-to-elastic/** – **Bookstore search demo**: a Node.js Express API backed by Elasticsearch with 20 sample books, plus a [presenter walkthrough](examples/zero-to-elastic/demo-script.md) that goes from zero to first search in under 5 minutes using MCP tools. See the [example README](examples/zero-to-elastic/README.md).
- **examples/observability/** – Complete APM + log shipping + alerting demo: instrumented Express API, traffic generator, and presenter walkthrough with exact AI prompts and MCP tool calls.
- **examples/security/** – Simulated auth log analysis for SIEM: generate ~200 auth events with brute-force patterns, create detection rules, inspect alerts, add exceptions. Runnable script + [presenter demo script](examples/security/demo-script.md).
- **examples/agent-builder-and-mcp/** – Knowledge base search tool for Agent Builder: index 15 internal docs, create/test a search tool, connect Cursor via MCP. Seed data + setup script + [presenter demo script](examples/agent-builder-and-mcp/demo-script.md).
- **examples/elastic-workflows/** – E-commerce order enrichment: ingest pipelines, enriched indices, ES|QL analytics, and alerting. Seed data + runnable workflow + [presenter demo script](examples/elastic-workflows/demo-script.md).
- **examples/on-prem-docker/** – **On-prem with Docker**: Elasticsearch, Kibana, Fleet server, APM server, Elastic Agent. Use when the user prefers on-prem over Cloud; **ask for preference** (Cloud vs on-prem) first, then use this stack or Cloud tools accordingly.
- **examples/iot-dashboard-as-code/** – **IoT Dashboard as Code**: ingest OpenTelemetry IoT metrics from the [iot-demo](https://github.com/poulsbopete/iot-demo) project, discover data via MCP tools, and programmatically create a Kibana dashboard — all from the IDE. Supports **local Docker stack** or **Elastic Cloud** (ES 9.x+ native OTLP intake). See [README](examples/iot-dashboard-as-code/README.md) and [demo script](examples/iot-dashboard-as-code/demo-script.md).

See each example’s README for step-by-step flows.

## License

This software is offered under a triple license. You may choose, at your election, one of:

- **[Elastic License 2.0](licenses/ELASTIC-LICENSE-2.0.txt)**
- **[GNU Affero General Public License v3.0 only](licenses/AGPL-LICENSE-3.0.txt)**
- **[Server Side Public License, v 1](licenses/SSPL-LICENSE.txt)**

See [LICENSE.txt](LICENSE.txt) for details.

## Distribution

Distribution (Cursor marketplace, Claude Code marketplace, npm publish, Docker publish) is **not** performed by this repo; it requires explicit approval and is prepared only as documented in the project plan.

**Publishing workflow:** See **[docs/RELEASE.md](docs/RELEASE.md)** for how to prepare a release (build, test, `npm pack`) and for the approval gate. Do not run `npm publish` or submit to marketplaces without approval.
