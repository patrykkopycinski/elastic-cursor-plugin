# Elastic Cursor Plugin — Quick start

Get Elastic search and tools in Cursor in **3 steps**. Choose **Cloud** (no servers) or **on-prem** (Docker).

---

## Prerequisites

- **Node.js 20+** — check with `node -v`
- **Cloud path:** [Elastic Cloud](https://cloud.elastic.co) account (free trial) and an API key, or a deployment URL + API key  
- **On-prem path:** Docker and Docker Compose

---

## Step 1: Get credentials

**Cloud (recommended):**

- Sign up at [cloud.elastic.co](https://cloud.elastic.co) and create a deployment, **or**
- Use the plugin: in Cursor, ask *"Set up Elastic for me"* → choose Cloud → the AI will use `create_cloud_project` (needs `ELASTIC_CLOUD_API_KEY` in MCP env) and give you a connection snippet.

Copy your **Elasticsearch URL** and **API key** (from the Cloud console or from the AI’s response).

**On-prem:**

- From the repo: `cd examples/on-prem-docker && docker compose up -d`
- Use URL `http://localhost:9200`, user `elastic`, password from `ELASTIC_PASSWORD` (or from `docker compose logs elasticsearch`)

---

## Step 2: Add the MCP server in Cursor

1. Open **Cursor → Settings → MCP** (or your MCP config file).
2. Add this server (replace placeholders with your values):

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

- **`cwd`**: Path to this repo (where you cloned `elastic-cursor-plugin`).
- **`ES_URL`**: Your Elasticsearch URL (Cloud or `http://localhost:9200` for Docker).
- **`ES_API_KEY`**: Your API key, or use `ES_USERNAME` and `ES_PASSWORD` for basic auth.

**From repo:** Run `npm install && npm run build` in the repo first so `packages/mcp-server/dist/index.js` exists.

---

## Step 3: Restart Cursor and use it

Restart Cursor (or reload MCP). The **elastic** tools and skills will appear. In chat you can say:

- *"List my indices"*
- *"Create an index called my-index"*
- *"Search my-index for 'hello'"*
- *"Set up Elastic from zero"* (AI will ask Cloud vs on-prem and guide you)

---

## One-config summary

| You have              | Use this in MCP config                                      |
|-----------------------|-------------------------------------------------------------|
| Cloud URL + API key   | `ES_URL` + `ES_API_KEY` in `env`                           |
| On-prem Docker        | `ES_URL=http://localhost:9200` + `ES_USERNAME`/`ES_PASSWORD` |
| Cloud + create project| Set `ELASTIC_CLOUD_API_KEY` in `env`; AI can run `create_cloud_project` |

Same single config block above; only the `env` values change. No extra setup.

---

## O11Y Workflows — Discover and configure in one conversation

Once connected, you can use **O11Y Workflows** to automatically discover your data and create dashboards and SLOs:

### Quick example

Say to Cursor:

> *"Discover what observability data I have and create dashboards for it"*

The agent will:
1. Call `discover_o11y_data` to scan for APM services, host metrics, and log streams
2. Call `get_data_summary` to analyze and recommend dashboards + SLOs
3. Ask you which recommendations to apply
4. Create dashboards via `kibana_create_dashboard` and SLOs via `create_slo`

### Available workflows

| Workflow | What it does |
|----------|-------------|
| `full-o11y-setup` | Discover all data → create dashboards + SLOs |
| `service-dashboard` | Create an APM service overview dashboard |
| `slo-from-apm` | Create SLOs from APM latency and error data |
| `infrastructure-overview` | Create a host metrics dashboard |

### Requirements for O11Y tools

Add `KIBANA_URL` and `KIBANA_API_KEY` to your MCP config env to enable dashboard and SLO creation:

```json
{
  "env": {
    "ES_URL": "...",
    "ES_API_KEY": "...",
    "KIBANA_URL": "https://your-kibana-url:5601",
    "KIBANA_API_KEY": "your-kibana-api-key"
  }
}
```
