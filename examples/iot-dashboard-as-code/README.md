# IoT Dashboard as Code

End-to-end example: spin up a local Elastic stack, ingest real OpenTelemetry IoT metrics from the [iot-demo](https://github.com/poulsbopete/iot-demo) project, discover data via MCP tools, and programmatically create a Kibana dashboard — all from your IDE.

## Prerequisites

- **Docker Desktop** (8GB+ RAM recommended)
- **Node.js 20+**
- **Elastic Cursor Plugin** built from the repo root: `npm install && npm run build`

## Quick Start

```bash
cd examples/iot-dashboard-as-code

# 1. Start the Elastic stack (ES + Kibana + APM Server with OTLP)
docker compose up -d

# 2. Clone iot-demo, configure it, install deps, generate data
bash setup.sh

# 3. Open Cursor, then ask the AI:
#    "What indices have IoT data?"
#    "Create a dashboard for the IoT metrics"

# 4. Open Kibana to see your dashboard
open http://localhost:5601
# Login: elastic / changeme
```

## What Gets Created

The setup script:
1. Starts **Elasticsearch 9.4**, **Kibana**, and **APM Server** (OTLP receiver) via Docker
2. Clones and configures the **iot-demo** Next.js app to ship OTel metrics to the local stack
3. Generates **~80 simulation steps** producing metrics across **3 sites** and **3 device types**

Then, using the Elastic Cursor Plugin's MCP tools, the AI can:
- **Discover** indices, mappings, and data via `list_indices`, `get_mappings`, `esql_query`
- **Create** a rich Kibana dashboard via `kibana_create_dashboard` with metric panels, time-series charts, gauges, and data tables

Data lands in `metrics-generic.otel-default` data stream with metrics under `metrics.*` fields and attributes under `attributes.*` fields (OTel mapping mode).

## IoT Metrics

The iot-demo simulates Ecolab-style equipment across 3 sites:

| Metric | Unit | Device Type |
|--------|------|-------------|
| `chemical.dosing_rate_lpm` | L/min | Chemical Dosing Pump |
| `chemical.tank_level_pct` | % | Chemical Dosing Pump |
| `chemical.conductivity_uS` | µS | Chemical Dosing Pump |
| `sanitation.cycle_count` | count | Dishwasher |
| `sanitation.water_temp_c` | °C | Dishwasher |
| `sanitation.sanitizer_ppm` | PPM | Dishwasher |
| `water.ph` | pH | Water System |
| `water.conductivity_uS` | µS | Water System |
| `water.flow_rate_lpm` | L/min | Water System |
| `device.status` | 0/1 | All |

**Sites:** Hospital (NA), Restaurant (EMEA), Food Plant (APAC)

## Stack Details

| Service | URL | Credentials |
|---------|-----|-------------|
| Elasticsearch | http://localhost:9200 | `elastic` / `changeme` |
| Kibana | http://localhost:5601 | `elastic` / `changeme` |
| APM/OTLP | http://localhost:8200 | Basic auth (elastic) |
| iot-demo | http://localhost:3000 | — |

## Re-generate Data

If you need more data without re-running the full setup:

```bash
node setup.js --generate-data-only
```

## Teardown

```bash
# Stop containers and remove volumes
docker compose down -v

# Remove the cloned iot-demo directory
rm -rf iot-demo
```

## Troubleshooting

**Stack won't start**
- Ensure Docker Desktop is running with at least 8GB RAM allocated
- Check for port conflicts: 9200, 5601, 8200, 3000
- View logs: `docker compose logs -f`

**No data appearing**
- Verify APM Server is running: `curl http://localhost:8200`
- Check the iot-demo app is running: `curl http://localhost:3000`
- Re-generate data: `node setup.js --generate-data-only`
- Check ES indices: `curl -u elastic:changeme http://localhost:9200/_cat/indices/metrics-*`

**Dashboard creation fails**
- Ensure Kibana is healthy: `curl http://localhost:5601/api/status`
- This example uses the Kibana 9.4+ as-code Dashboard API with feature flags enabled in `docker-compose.yml` (`dashboardAgent.enabled`, `lens.apiFormat`, `lens.enable_esql`)
- Check MCP config in `.cursor/mcp.json` has correct KIBANA_URL and credentials

## Demo Script

See [demo-script.md](./demo-script.md) for a step-by-step presenter walkthrough with exact prompts and expected MCP tool calls.
