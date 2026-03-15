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

Copy your **Elasticsearch URL** and **API key** (from the Cloud console or from the AI's response).

**On-prem:**

- From the repo: `cd examples/on-prem-docker && docker compose up -d`
- Use URL `http://localhost:9200`, user `elastic`, password from `ELASTIC_PASSWORD` (or from `docker compose logs elasticsearch`)

---

## Step 2: Add the MCP server in Cursor

1. Open **Cursor → Settings → MCP** (or your MCP config file).
2. Add this server.

**Option A — `.env` file (recommended):**

Create a `.env` file in the repo root with your credentials:

```bash
ES_URL=https://your-deployment.es.us-central1.gcp.cloud.es.io:9243
ES_API_KEY=your_base64_api_key
```

The plugin's `mcp.json` already uses `envFile: ".env"` — Cursor will load it automatically. No secrets in the MCP config.

**Option B — Shell environment variables:**

Export credentials in your shell profile (`~/.zshrc`, `~/.bashrc`):

```bash
export ES_URL="https://your-deployment.es.us-central1.gcp.cloud.es.io:9243"
export ES_API_KEY="your_base64_api_key"
```

The plugin's `mcp.json` uses `${env:ES_URL}` interpolation — Cursor resolves these from your shell environment.

**Option C — Hardcoded (quick & dirty):**

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

> **Warning**: Avoid this for production credentials — secrets are stored in plaintext JSON.

**From repo:** Run `npm install && npm run build` in the repo first so `packages/mcp-server/dist/index.js` exists.

---

## Securing credentials

### 1Password CLI (recommended for teams)

Store secrets in a 1Password vault and inject them at runtime. Secrets exist only in memory — never on disk.

Create `.env.1password` (safe to commit — contains references, not values):

```bash
ES_URL=op://Development/elastic-cloud/url
ES_API_KEY=op://Development/elastic-cloud/api-key
ELASTIC_CLOUD_API_KEY=op://Development/elastic-cloud/cloud-api-key
```

Configure Cursor to launch via 1Password:

```json
{
  "mcpServers": {
    "elastic": {
      "command": "op",
      "args": [
        "run", "--env-file=.env.1password", "--",
        "node", "packages/mcp-server/dist/index.js"
      ],
      "cwd": "/path/to/elastic-cursor-plugin"
    }
  }
}
```

### macOS Keychain

Store credentials in the native keychain and resolve at launch:

```bash
# Store once
security add-generic-password -s elastic-es-url -a elastic -w "https://your-url:9243"
security add-generic-password -s elastic-api-key -a elastic -w "your_api_key"
```

```json
{
  "mcpServers": {
    "elastic": {
      "command": "sh",
      "args": [
        "-c",
        "ES_URL=$(security find-generic-password -s elastic-es-url -w) ES_API_KEY=$(security find-generic-password -s elastic-api-key -w) exec node packages/mcp-server/dist/index.js"
      ],
      "cwd": "/path/to/elastic-cursor-plugin"
    }
  }
}
```

### Credential file with restricted permissions

Create `~/.elastic-credentials` (chmod 600) and reference via `envFile`:

```json
{
  "mcpServers": {
    "elastic": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "cwd": "/path/to/elastic-cursor-plugin",
      "envFile": "${userHome}/.elastic-credentials"
    }
  }
}
```

---

## Step 3: Restart Cursor and use it

Restart Cursor (or reload MCP). The **elastic** tools and skills will appear. In chat you can say:

- *"List my indices"*
- *"Create an index called my-index"*
- *"Search my-index for 'hello'"*
- *"Set up Elastic from zero"* (AI will ask Cloud vs on-prem and guide you)

---

## Environment variable reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ES_URL` | Yes (or `ES_CLOUD_ID`) | Elasticsearch endpoint URL |
| `ES_API_KEY` | Recommended | Base64 API key for authentication |
| `ES_USERNAME` | Alt auth | Username for basic auth (usually `elastic`) |
| `ES_PASSWORD` | Alt auth | Password for basic auth |
| `ES_CLOUD_ID` | Alt | Elastic Cloud deployment ID |
| `KIBANA_URL` | For dashboards/SLOs | Kibana endpoint URL |
| `KIBANA_API_KEY` | For dashboards/SLOs | Kibana API key |
| `ELASTIC_CLOUD_API_KEY` | For provisioning | Elastic Cloud management API key |
| `ES_SSL_SKIP_VERIFY` | Dev only | Set `true` to skip TLS verification |
| `ES_CLUSTERS` | Multi-cluster | JSON: `{"name": {"url": "...", "apiKey": "..."}}` |

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

Add `KIBANA_URL` and `KIBANA_API_KEY` to your `.env` file (or MCP config env) to enable dashboard and SLO creation:

```bash
ES_URL=...
ES_API_KEY=...
KIBANA_URL=https://your-kibana-url:5601
KIBANA_API_KEY=your-kibana-api-key
```
