---
name: o11y-slo-setup
description: Interactive guide for creating SLOs from discovered APM and metric data — identifies candidates, lets user configure targets, and creates SLOs.
---

# O11Y SLO Setup Workflow

Guide the user through creating Service Level Objectives based on their available data.

## Steps

### 1. Discover Data
Call `discover_o11y_data` to find APM services and metrics that can support SLOs.

### 2. Identify SLO Candidates
Call `get_data_summary` with `format: "json"` to get SLO recommendations.

Present each candidate:
- **APM Latency SLOs**: For each service with transaction data — "Service X: p95 latency < threshold, target 99.5%"
- **APM Availability SLOs**: For each service with error data — "Service X: availability target 99.9%"
- **Custom Metric SLOs**: For any numeric metrics suitable as SLIs

### 3. User Decision Point — Select SLOs
Ask the user:
- Which SLO candidates to create (numbered list, allow "all")
- For each selected SLO, confirm or adjust:
  - Name (suggest based on service and indicator type)
  - Target percentage (show recommended default)
  - Time window (suggest 30d rolling)
  - Any tags to apply

### 4. Check Existing SLOs
Call `kibana_api` with `GET /api/observability/slos` to check for duplicates.
If any existing SLOs overlap with selections, warn the user and ask whether to skip or create anyway.

### 5. Create SLOs
For each approved SLO, call `kibana_api` with `POST /api/observability/slos` and the configured parameters as the request body.

Report each created SLO:
- Name and ID
- Indicator type and target
- Kibana URL to view

### 6. Summary
Present:
- Total SLOs created
- Current status of each (if available from creation response)
- Suggested next steps: monitor burn rates, set up burn rate alerts, create an SLO dashboard

## Tools Used
- `discover_o11y_data` — discover APM services and metrics for SLO candidates
- `get_data_summary` — generate SLO recommendations
- `kibana_api` — list existing SLOs (`GET /api/observability/slos`) and create new ones (`POST /api/observability/slos`)

## API References
- `elastic://docs/api/kibana` — Kibana REST API reference for SLO endpoints (`/api/observability/slos`)

## Prerequisites
- `ES_URL` and `ES_API_KEY` configured
- SLO feature enabled in Kibana (Observability → SLOs)
- APM data or custom metrics flowing
