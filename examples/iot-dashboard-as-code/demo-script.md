# IoT Dashboard-as-Code: Presenter Walkthrough

This walkthrough demonstrates the full "Dashboard as Code" workflow: spinning up a local Elastic stack, ingesting OTel metrics from an IoT simulation, discovering data via MCP tools, and programmatically creating a Kibana dashboard.

**Prerequisites:**
- Docker Desktop running (8GB+ RAM recommended)
- Node.js 20+
- The Elastic Cursor Plugin built (`npm run build` from repo root)
- Cursor IDE with MCP configured (see `.cursor/mcp.json`)

---

## Step 1: Start the Elastic Stack

**What to say:** "First, let's spin up a local Elastic stack with OTLP support."

```bash
cd examples/iot-dashboard-as-code
docker compose up -d
```

Wait for all services to be healthy (~60 seconds). Then verify via the AI:

**Prompt to type:**

> Check the health of my Elasticsearch cluster

**What happens:** The AI calls `cluster_health` and returns the cluster status (green/yellow), node count, and shard info.

**MCP tool:** `cluster_health`

---

## Step 2: Ingest IoT Data

**What to say:** "Now let's clone the IoT demo app and start shipping OpenTelemetry metrics."

```bash
bash setup.sh
```

This clones the [iot-demo](https://github.com/poulsbopete/iot-demo), configures it for the local stack, installs dependencies, starts the Next.js dev server, and generates ~80 simulation steps (800+ metric data points across 3 sites and 3 device types).

**Prompt to verify data arrived:**

> What indices have IoT data in my cluster?

**What happens:** The AI calls `list_indices` and returns the `metrics-*` data streams containing OTel metrics (e.g., `metrics-generic.otel-default`).

**MCP tool:** `list_indices`

---

## Step 3: Discover the Data

**What to say:** "Before building a dashboard, let's explore what data we have."

### 3a. Explore field mappings

**Prompt to type:**

> Show me the field mappings for the metrics-generic.otel-default data stream

**What happens:** The AI calls `get_mappings` on the metrics index and identifies the OTel metric structure: values under `metrics.*` (e.g. `metrics.chemical.dosing_rate_lpm`, `metrics.water.ph`) and attributes under `attributes.*` (e.g. `attributes.site.name`, `attributes.device.type`, `attributes.region`).

**MCP tool:** `get_mappings`

### 3b. Query with ES|QL

**Prompt to type:**

> Use ES|QL to show me the distinct metric names and how many data points each has

**What happens:** The AI calls `esql_query` with something like:

```
FROM metrics-generic.otel-default
| STATS count = COUNT(*) BY attributes.site.name, attributes.device.type
| SORT attributes.site.name, attributes.device.type
```

This returns a breakdown by site and device type. The metric fields are stored under `metrics.*` (e.g. `metrics.chemical.dosing_rate_lpm`, `metrics.sanitation.sanitizer_ppm`, `metrics.water.ph`) and attributes under `attributes.*` (e.g. `attributes.site.name`, `attributes.device.type`).

**MCP tool:** `esql_query`

### 3c. Sample raw documents

**Prompt to type:**

> Search for a few sample IoT metric documents to see their structure

**What happens:** The AI calls `search` on the metrics index with `size: 3` and returns raw documents showing the OTel metric structure (metric name, value, timestamp, resource attributes).

**MCP tool:** `search`

---

## Step 4: Create the Dashboard

**What to say:** "Now for the main event — let's create a comprehensive IoT dashboard using code."

**Prompt to type:**

> Create a Kibana dashboard for the IoT metrics data. Include:
> - A markdown header "IoT Command Center — Dashboard as Code"
> - Metric panels for average dosing rate, average sanitizer PPM, average water pH, and device count
> - Time-series line charts for dosing rate and sanitizer PPM over time, broken down by site
> - A gauge for water pH level
> - A data table showing the latest device status by site and device type
> Use a mix of ES|QL and dataView datasets to showcase both approaches.

**What happens:** The AI calls `kibana_create_dashboard` with a full dashboard definition. Here is an example of the payload the AI should produce:

```json
{
  "title": "IoT Command Center — Dashboard as Code",
  "description": "End-to-end IoT monitoring dashboard created programmatically via MCP tools",
  "time_from": "now-1h",
  "time_to": "now",
  "panels": [
    {
      "type": "DASHBOARD_MARKDOWN",
      "content": "# IoT Command Center\n**Dashboard as Code** — Created programmatically using the Elastic Cursor Plugin's `kibana_create_dashboard` MCP tool.\n\n3 sites (Hospital, Restaurant, Food Plant) · 3 device types · 10 metrics · OpenTelemetry",
      "grid": { "x": 0, "w": 48, "h": 4 }
    },
    {
      "type": "metric",
      "title": "Avg Dosing Rate",
      "dataset": { "type": "esql", "query": "FROM metrics-generic.otel-default | STATS `L/min` = AVG(metrics.chemical.dosing_rate_lpm)" },
      "metrics": [{ "type": "primary", "operation": "value", "column": "L/min" }],
      "grid": { "x": 0, "w": 12, "h": 8 }
    },
    {
      "type": "metric",
      "title": "Avg Sanitizer",
      "dataset": { "type": "esql", "query": "FROM metrics-generic.otel-default | STATS `PPM` = AVG(metrics.sanitation.sanitizer_ppm)" },
      "metrics": [{ "type": "primary", "operation": "value", "column": "PPM" }],
      "grid": { "x": 12, "w": 12, "h": 8 }
    },
    {
      "type": "metric",
      "title": "Avg Water pH",
      "dataset": { "type": "esql", "query": "FROM metrics-generic.otel-default | STATS `pH` = AVG(metrics.water.ph)" },
      "metrics": [{ "type": "primary", "operation": "value", "column": "pH" }],
      "grid": { "x": 24, "w": 12, "h": 8 }
    },
    {
      "type": "metric",
      "title": "Total Readings",
      "dataset": { "type": "esql", "query": "FROM metrics-generic.otel-default | STATS `count` = COUNT(*)" },
      "metrics": [{ "type": "primary", "operation": "value", "column": "count" }],
      "grid": { "x": 36, "w": 12, "h": 8 }
    },
    {
      "type": "xy",
      "title": "Dosing Rate Over Time by Site",
      "layers": [
        {
          "dataset": { "type": "esql", "query": "FROM metrics-generic.otel-default | WHERE metrics.chemical.dosing_rate_lpm IS NOT NULL | STATS dosing = AVG(metrics.chemical.dosing_rate_lpm) BY @timestamp = BUCKET(@timestamp, 5 minute), site = attributes.site.name" },
          "type": "line",
          "x": { "operation": "value", "column": "@timestamp" },
          "y": [{ "operation": "value", "column": "dosing" }],
          "breakdown_by": { "operation": "value", "column": "site" }
        }
      ],
      "grid": { "x": 0, "w": 24, "h": 14 }
    },
    {
      "type": "xy",
      "title": "Sanitizer PPM Over Time by Site",
      "layers": [
        {
          "dataset": { "type": "esql", "query": "FROM metrics-generic.otel-default | WHERE metrics.sanitation.sanitizer_ppm IS NOT NULL | STATS sanitizer = AVG(metrics.sanitation.sanitizer_ppm) BY @timestamp = BUCKET(@timestamp, 5 minute), site = attributes.site.name" },
          "type": "line",
          "x": { "operation": "value", "column": "@timestamp" },
          "y": [{ "operation": "value", "column": "sanitizer" }],
          "breakdown_by": { "operation": "value", "column": "site" }
        }
      ],
      "grid": { "x": 24, "w": 24, "h": 14 }
    },
    {
      "type": "gauge",
      "title": "Water pH (target 6.5–8.5)",
      "dataset": { "type": "esql", "query": "FROM metrics-generic.otel-default | STATS pH = AVG(metrics.water.ph)" },
      "metric": { "operation": "value", "column": "pH" },
      "grid": { "x": 0, "w": 12, "h": 12 }
    },
    {
      "type": "xy",
      "title": "Water Flow Rate Over Time",
      "layers": [
        {
          "dataset": { "type": "esql", "query": "FROM metrics-generic.otel-default | WHERE metrics.water.flow_rate_lpm IS NOT NULL | STATS flow = AVG(metrics.water.flow_rate_lpm) BY @timestamp = BUCKET(@timestamp, 5 minute), site = attributes.site.name" },
          "type": "area",
          "x": { "operation": "value", "column": "@timestamp" },
          "y": [{ "operation": "value", "column": "flow" }],
          "breakdown_by": { "operation": "value", "column": "site" }
        }
      ],
      "grid": { "x": 12, "w": 36, "h": 12 }
    },
    {
      "type": "datatable",
      "title": "Summary: Site × Device Type",
      "dataset": { "type": "esql", "query": "FROM metrics-generic.otel-default | STATS `Avg Dosing` = AVG(metrics.chemical.dosing_rate_lpm), `Avg pH` = AVG(metrics.water.ph), `Avg Sanitizer` = AVG(metrics.sanitation.sanitizer_ppm), `Readings` = COUNT(*) BY `Site` = attributes.site.name, `Device` = attributes.device.type | SORT `Site`, `Device`" },
      "rows": [
        { "operation": "value", "column": "Site" },
        { "operation": "value", "column": "Device" }
      ],
      "metrics": [
        { "operation": "value", "column": "Avg Dosing" },
        { "operation": "value", "column": "Avg pH" },
        { "operation": "value", "column": "Avg Sanitizer" },
        { "operation": "value", "column": "Readings" }
      ],
      "grid": { "x": 0, "w": 48, "h": 10 }
    }
  ]
}
```

The tool first tries the Kibana as-code API (9.4+), then falls back to Saved Objects for 8.x. Either way, it returns the dashboard ID and URL.

**MCP tool:** `kibana_create_dashboard`

---

## Step 5: Explore in Kibana

**What to say:** "Let's open the dashboard and see everything come together."

Open Kibana at http://localhost:5601 (login: `elastic` / `changeme`):

1. **Dashboards** — Find "IoT Command Center — Dashboard as Code" in the dashboard list. Open it.
2. **KPI Metrics** — Top row shows average dosing rate, sanitizer PPM, water pH, and active device count.
3. **Time-series Charts** — Dosing rate and sanitizer PPM trends broken down by site (Hospital, Restaurant, Food Plant).
4. **Gauge** — Water pH level showing the current average reading.
5. **Flow Rate** — Area chart showing water flow rates across sites.
6. **Device Table** — Full-width table with device status per site and device type.
7. **Try filters** — Click on a site name in any panel to filter the entire dashboard to that site.

---

## Summary

| Step | Prompt / Action | MCP Tool(s) |
|------|----------------|-------------|
| 1 | Check cluster health | `cluster_health` |
| 2 | Run `setup.sh`, verify indices | `list_indices` |
| 3a | Show field mappings | `get_mappings` |
| 3b | ES\|QL distinct metrics | `esql_query` |
| 3c | Sample documents | `search` |
| 4 | Create IoT dashboard | `kibana_create_dashboard` |
| 5 | (manual) Explore Kibana | — |
