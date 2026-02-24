---
name: o11y-service-dashboard
description: Interactive guide for creating an APM service overview dashboard — discovers service data, presents metrics, and creates a tailored dashboard.
---

# O11Y Service Dashboard Workflow

Guide the user through creating a comprehensive dashboard for a specific APM service.

## Steps

### 1. Identify Target Service
If the user hasn't specified a service name, call `discover_o11y_data` to find available APM services.

Present the list of discovered services:
- Service name, environment, language
- Throughput and data freshness

Ask the user which service they want to dashboard.

### 2. Discover Service Data
Call `discover_o11y_data` with `service_names: ["<selected_service>"]` to get detailed data for the target service.

### 3. Generate Service Summary
Call `get_data_summary` with the scoped discovery result.

Present the service profile:
- Transaction types and throughput
- Error rate
- Available metrics
- Suggested dashboard panels

### 4. User Decision Point — Dashboard Configuration
Ask the user:
- Dashboard title (suggest: "<Service Name> - Service Overview")
- Time range (suggest: last 24 hours)
- Any additional panels or customizations
- Whether to include related infrastructure or log panels (if data exists)

### 5. Create Dashboard
Call `kibana_api` with `POST /api/dashboards/dashboard` and the service-overview template configuration populated with the service data as the request body.

### 6. Report
Present:
- Dashboard URL (clickable link)
- List of panels created
- Suggested follow-ups: create an SLO, set up alerts, add to a composite dashboard

## Tools Used
- `discover_o11y_data` — discover APM services and their data
- `get_data_summary` — generate service profile and panel suggestions
- `kibana_api` — create the dashboard (`POST /api/dashboards/dashboard`)

## API References
- `elastic://docs/api/kibana` — Kibana REST API reference for dashboard endpoints

## Prerequisites
- `ES_URL` and `ES_API_KEY` configured
- APM data for at least one service
