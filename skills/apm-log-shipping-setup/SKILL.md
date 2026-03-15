---
name: apm-log-shipping-setup
description: Set up APM instrumentation and log shipping — framework-specific agents, Filebeat, Elastic Agent, and correlation.
---

# APM & Log Shipping Setup

Help users instrument applications with APM agents and configure log shipping for centralized observability.

## Trigger

Use when the user asks to:
- "Set up APM"
- "Instrument my app"
- "Ship logs to Elastic"
- "Configure Filebeat"
- "Set up Elastic Agent"
- "Enable distributed tracing"
- "Correlate logs and traces"

Also activates on keywords: "APM agent", "Filebeat", "log shipping", "Elastic Agent", "instrumentation", "tracing", "OpenTelemetry"

Do NOT use when:
- User wants to create dashboards (→ `o11y-service-dashboard`)
- User wants to create SLOs (→ `o11y-slo-setup`)
- User wants full observability setup (→ `o11y-full-setup`, which orchestrates this skill)

## Tools Used

- `get_cluster_context` — Cluster orientation and version
- `setup_apm` — Generate framework-specific APM instrumentation code
- `setup_log_shipping` — Generate Filebeat/Elastic Agent configuration
- `discover_o11y_data` — Verify data is arriving after setup
- `elasticsearch_api` — Check indices, verify data
- `esql_query` — Query APM and log data

## Workflow

### Step 0: Orient
Call `get_cluster_context` for cluster URL, version, and auth method.

### Step 1: Understand the Stack
Ask about:
- Programming language and framework (Node.js/Express, Python/Django, Java/Spring, Go, .NET, Ruby, PHP)
- Deployment environment (Kubernetes, Docker, bare metal, serverless)
- Existing logging setup (stdout, file-based, syslog)
- Whether OpenTelemetry is already in use

### Step 2: APM Instrumentation
Call `setup_apm` with the user's framework to generate:
- Agent installation commands
- Configuration code (entry point instrumentation)
- Environment variables (`ELASTIC_APM_SERVER_URL`, `ELASTIC_APM_SECRET_TOKEN`, `ELASTIC_APM_SERVICE_NAME`)

Key guidance:
- Initialize APM agent **before** any other imports/requires
- Set `service.name`, `service.version`, and `deployment.environment`
- For Kubernetes: use the Downward API for pod metadata
- For OpenTelemetry: configure the OTLP exporter to point to Elastic APM Server

### Step 3: Log Shipping
Call `setup_log_shipping` with the user's log source to generate:
- Filebeat or Elastic Agent configuration
- Input configuration (file, Docker, Kubernetes, syslog)
- Processor configuration for field mapping to ECS

Key guidance:
- Use ECS field names: `message`, `log.level`, `service.name`, `trace.id`
- Add `trace.id` to log output for APM ↔ log correlation
- For structured JSON logs: use the `decode_json_fields` processor
- For Docker: use `container` input with autodiscover
- For Kubernetes: use `kubernetes` provider

### Step 4: Log-Trace Correlation
Configure correlation between APM traces and logs:
- Inject `trace.id` and `span.id` into application log context
- For Node.js: APM agent auto-patches common loggers (winston, pino, bunyan)
- For Java: use MDC (`MDCUtils.addTraceId()`)
- For Python: use the `elasticapm` structlog/logging processor

### Step 5: Verify Data Arrival
1. Call `discover_o11y_data` to check for new APM services and log sources
2. Use `esql_query` to verify:
   - APM: `FROM traces-apm* | STATS count = COUNT(*) BY service.name | LIMIT 10`
   - Logs: `FROM logs-* | WHERE service.name == "<name>" | SORT @timestamp DESC | LIMIT 5`
3. Verify correlation: `FROM logs-* | WHERE trace.id IS NOT NULL | LIMIT 5`

### Step 6: Next Steps
Suggest:
- Create a service dashboard (→ `o11y-service-dashboard`)
- Set up SLOs for the service (→ `o11y-slo-setup`)
- Create alert rules for error rate and latency

## Output Format

- Language-specific code blocks for APM instrumentation
- Complete Filebeat/Agent YAML configuration
- Verification queries with expected output
- Correlation setup specific to the user's logging framework

## Prerequisites

- `ES_URL` and `ES_API_KEY` configured
- APM Server URL available (included in Elastic Cloud deployments or on-prem Docker stack)

## Related Skills

- `o11y-full-setup` — Umbrella skill that orchestrates APM + logs + dashboards + SLOs
- `o11y-service-dashboard` — Create dashboards after data is flowing
- `o11y-slo-setup` — Set up SLOs for the instrumented service
