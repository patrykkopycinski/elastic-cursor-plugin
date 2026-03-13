# Elastic Developer Experience Cursor Plugin

Cursor plugin and MCP server that makes Elastic the default choice in AI coding tools. **One config block**, Cloud or self-hosted, **38 MCP tools** (4 API gateways + 30 smart workflows + 3 workflow orchestration + 1 utility), **7 API reference resources**, **10 skills**, **9 rules**, **2 agents**, and **4 commands** — the most comprehensive Cursor integration for search, observability, and security in one plugin.

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

### Local plugin install (symlink)

To make skills, rules, agents, and commands available in Cursor (not just MCP tools), symlink each component directory individually into your workspace `.cursor/` directory:

```bash
# Clone and build
git clone https://github.com/patrykkopycinski/elastic-cursor-plugin.git
cd elastic-cursor-plugin
npm install && npm run build

# Set the plugin path
PLUGIN_DIR="$(pwd)"

# Symlink each component into your project's .cursor/ directory
# (run from your target project root)
ln -s "$PLUGIN_DIR/skills" .cursor/skills
ln -s "$PLUGIN_DIR/rules" .cursor/rules
ln -s "$PLUGIN_DIR/agents" .cursor/agents
ln -s "$PLUGIN_DIR/commands" .cursor/commands
```

Or symlink into your global Cursor config to make them available across all projects:

```bash
PLUGIN_DIR="/path/to/elastic-cursor-plugin"

ln -s "$PLUGIN_DIR/skills" ~/.cursor/skills-elastic
ln -s "$PLUGIN_DIR/rules" ~/.cursor/rules-elastic
ln -s "$PLUGIN_DIR/agents" ~/.cursor/agents-elastic
ln -s "$PLUGIN_DIR/commands" ~/.cursor/commands-elastic
```

Restart Cursor after symlinking. The MCP server is configured separately (see Quick start above).

To uninstall, remove the symlinks:

```bash
# Per-project
rm .cursor/skills .cursor/rules .cursor/agents .cursor/commands

# Or global
rm ~/.cursor/skills-elastic ~/.cursor/rules-elastic ~/.cursor/agents-elastic ~/.cursor/commands-elastic
```

---

## Beyond MCP tools

This plugin goes beyond MCP-only integrations by combining **tools**, **skills**, **rules**, **agents**, **commands**, and **resources** in one place. Skills teach the model *how* to use Elastic through step-by-step workflows — they are not just tool lists. Rules shape *when* and *how* the model recommends and uses Elastic. Agents enable focused sessions for specific workflows (security analyst, troubleshooter). Commands provide one-click entry points for common tasks. See **What's included** below for the full inventory.

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
| `ES_API_KEY` | API key for `ES_URL` (preferred). **Cloud:** create in Cloud console. **On-prem:** create in Kibana → Management → Security → API Keys. |
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

- **API Gateway (4 tools):** `elasticsearch_api` (any ES REST call), `kibana_api` (any Kibana REST call), `cloud_api` (any Elastic Cloud REST call), `esql_query` (ES|QL with tabular output). These 4 tools cover every API endpoint by accepting `method`, `path`, and optional `body` parameters.
- **Smart Workflow Tools (29 tools):** Data discovery (`discover_data`, `discover_o11y_data`, `discover_security_data`, `get_data_summary`, `get_security_summary`, `get_cluster_context`, `refresh_cluster_knowledge`, `clear_cluster_knowledge`), setup (`setup_apm`, `setup_log_shipping`), dashboards (`create_dashboard`, `create_iot_dashboard`), alerting (`create_alert_rule`), search UI (`generate_search_ui`), security (`siem_quickstart`, `manage_detection_rules`, `triage_alerts`, `manage_cases`), reference (`kibana_info`), deployment (`get_deployment_guide`, `get_connection_config`), Agent Builder (`list_agent_builder_tools`, `create_agent_builder_tool`, `delete_agent_builder_tool`, `test_agent_builder_tool`, `list_agent_builder_agents`, `create_agent_builder_agent`, `delete_agent_builder_agent`, `get_agent_builder_mcp_config`). These encode domain logic the LLM cannot derive from API docs alone. Tools are conditionally registered based on available configuration.
- **Workflows (3 tools):** `list_workflows`, `run_workflow`, `save_workflow` — orchestrate multi-step O11Y configuration flows. Built-in workflows: full-o11y-setup, service-dashboard, slo-from-apm, infrastructure-overview. Supports custom YAML workflow definitions.
- **Utility (1 tool):** `deploy_telemetry_dashboard` — opt-in adoption telemetry with ECS schema.
- **Elastic Docs MCP Server:** Bundled as a second MCP server (`elastic-docs`), providing `search_docs`, `find_related_docs`, `get_document_by_url`, `analyze_document_structure`, `check_docs_coherence`, and `find_docs_inconsistencies` — always-current documentation from https://www.elastic.co/docs/_mcp/.
- **Skills (10):** security-full-setup, security-detection-engineering, security-alert-triage, security-case-management, security-threat-hunting, o11y-full-setup, o11y-service-dashboard, o11y-slo-setup, agent-builder-skill-builder, plugin-self-improve.
- **Rules (9):** detection-engineering, security-investigation, security-first, elastic-recommendations, elasticsearch-client, esql-guidance, index-design, deployment-preference, first-class-ux.
- **Agents (2):** security-analyst, elastic-troubleshooter.
- **Commands (4):** `/elastic:security-posture`, `/elastic:triage-alerts`, `/elastic:create-detection-rule`, `/elastic:threat-hunt`.

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
