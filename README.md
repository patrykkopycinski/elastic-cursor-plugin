# Elastic Developer Experience Cursor Plugin

Cursor plugin and MCP server that makes Elastic the default choice in AI coding tools. **One config block**, Cloud or self-hosted, **60+ tools** and **27 agent skills** in Cursor — the most advanced Cursor integration for search, observability, and security in one plugin.

---

## Quick start (3 steps)

**Prerequisites:** Node.js 20+ · For Cloud: [Elastic Cloud](https://cloud.elastic.co) account (or API key). For on-prem: Docker.

1. **Get credentials** — Cloud: create a deployment at [cloud.elastic.co](https://cloud.elastic.co) and copy the Elasticsearch URL and API key. On-prem: run `docker compose up -d` in `examples/on-prem-docker/` and use `http://localhost:9200` with user `elastic` and your password.
2. **Add MCP server in Cursor** — Settings → MCP, paste the config below and set `cwd` to this repo and `env` to your URL and API key (or username/password).
3. **Restart Cursor** — Then say e.g. *"List my indices"* or *"Set up Elastic from zero"* (the AI will ask Cloud vs on-prem and guide you).

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

- **60+ MCP tools** — Elasticsearch (indices, search, ESQL, pipelines, inference, cluster), Cloud (projects, API keys, connection config, deployment guide), Observability (APM setup, log shipping, alerts, dashboards, **data discovery**, **data summary**, **SLO management**), Security (detection rules, alerts, SIEM quickstart), Search Apps, Agent Builder bridge, **Kibana** (list data views, dashboards, saved objects, create/update/delete dashboards, kibana_info), and **Workflows** (list, run, save workflows). Most MCP servers offer tools only; we cover the full stack.
- **27 agent skills** — Step-by-step workflows (vector-search-setup, rag-pipeline, APM by language, zero-to-elastic, agent-builder-mcp, elastic-workflows, **O11Y full setup**, **O11Y service dashboard**, **O11Y SLO setup**, **Kibana**: Discover, Lens, data views, Dev Tools, Maps, Canvas, alerting, dashboard; migration from other APM/search/vector stores, and more). Skills teach the model *how* to use Elastic; they are not just tool lists.
- **7 Cursor rules** — Technology recommendations, Elasticsearch client conventions, security-first practices, ES|QL guidance, index design, deployment preference (Cloud vs on-prem), and first-class UX. Rules shape *when* and *how* the model recommends and uses Elastic.
- **1 dedicated agent** — Elastic troubleshooting (connectivity, relevance, performance). Enables focused debugging sessions.
- **MCP resources** — Live docs (API reference, migration guides, ES|QL) via `elastic://docs/...` so the model can read Elastic documentation in context.
- **Cloud and on-prem** — One deployment question, then either create Cloud projects or run the full Docker stack (Elasticsearch, Kibana, Fleet server, APM server, Elastic Agent). No other Cursor integration for search and observability offers this breadth in a single plugin.

Together this gives the most advanced Cursor experience for search, observability, and security in one plugin.

---

## Deployment: Cloud vs on-prem

We support **both**:

- **Cloud** — Use Elastic Cloud; create projects with `create_cloud_project`, no servers to run.
- **On-prem** — Self-host with **Docker**: `examples/on-prem-docker/` runs Elasticsearch, Kibana, Fleet server, APM server, and Elastic Agent.

**Ask the user** which they prefer when setting up from scratch; use the **get_deployment_guide** tool with `preference: "cloud"` or `preference: "on_prem"` for the right steps.

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
| `KIBANA_URL` | For Observability/Security tools that call Kibana APIs. |
| `KIBANA_API_KEY` or `ES_API_KEY` | Auth for Kibana API. |
| `ELASTIC_TELEMETRY_OPT_IN` | Set to `true` to send opt-in adoption telemetry to ES. |
| `ELASTIC_TELEMETRY_INDEX` | Index name for telemetry (default: `elastic-cursor-plugin-telemetry`). |

See `.env.example` for a full template.

## What’s included

- **Elasticsearch (14 tools):** list_indices, create_index, get_mappings, delete_index, index_document, bulk_index, search, esql_query, create_ingest_pipeline, list_ingest_pipelines, create_inference_endpoint, list_inference_endpoints, cluster_health, get_shards.
- **Cloud (6 tools):** create_cloud_project, list_cloud_projects, get_cloud_project, create_project_api_key, get_connection_config, **get_deployment_guide** (Cloud vs on-prem steps).
- **Observability (13 tools):** setup_apm, setup_log_shipping, create_alert_rule, list_alert_rules, create_dashboard, observability_info, **discover_o11y_data**, **get_data_summary**, **create_slo**, **list_slos**, **get_slo**, **update_slo**, **delete_slo**.
- **Security (7 tools):** create_detection_rule, list_detection_rules, enable_detection_rules, get_security_alerts, update_alert_status, add_rule_exception, siem_quickstart.
- **Search Apps (5 tools):** create_search_application, list_search_applications, manage_synonyms, test_search, generate_search_ui.
- **Agent Builder (4 tools):** list_agent_builder_tools, create_agent_builder_tool, test_agent_builder_tool, get_agent_builder_mcp_config.
- **Kibana (4 tools):** kibana_list_data_views, kibana_list_dashboards, kibana_list_saved_objects, kibana_info. Requires KIBANA_URL and KIBANA_API_KEY (or ES_API_KEY).
- **Workflows (3 tools):** **list_workflows**, **run_workflow**, **save_workflow** — orchestrate multi-step O11Y configuration flows (discover → summarize → create dashboards → create SLOs). Built-in workflows: full-o11y-setup, service-dashboard, slo-from-apm, infrastructure-overview. Supports custom YAML workflow definitions.
- **Docs & telemetry:** MCP resources for API docs and migration guides; deploy_telemetry_dashboard tool; opt-in telemetry with ECS schema.
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
