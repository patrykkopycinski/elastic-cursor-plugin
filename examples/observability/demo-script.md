# Observability Demo: Presenter Walkthrough

This walkthrough demonstrates APM instrumentation, log shipping, alerting, and dashboards using the Elastic Cursor plugin. Each step shows the exact prompt to give the AI and the MCP tool it invokes.

Prerequisites: Elastic Cloud deployment (or on-prem Docker stack) with APM Server, Kibana URL, and API key configured in the MCP server env.

---

## Step 1: Instrument the app with APM

**What to say:** "Let's start by asking the AI how to add APM instrumentation to our Express app."

**Prompt to type:**

> Set up APM for my Node.js Express app

**What happens:** The AI calls `setup_apm` with `framework: "express"` and `language: "nodejs"`. It returns the instrumentation snippet (require elastic-apm-node at the top, configure server URL and secret token). Point out that `app.js` already has this wired in.

**MCP tool:** `setup_apm`

---

## Step 2: Ship structured logs to Elasticsearch

**What to say:** "Our app writes structured JSON logs. Let's ship them to Elasticsearch for centralized analysis."

**Prompt to type:**

> Set up log shipping for ./app.log to Elasticsearch

**What happens:** The AI calls `setup_log_shipping` with `log_path: "./app.log"` and your Elasticsearch URL. It returns Filebeat or Elastic Agent configuration for ingesting the JSON log file.

**MCP tool:** `setup_log_shipping`

---

## Step 3: Start the app and generate traffic

**What to say:** "Let's start the app and generate some realistic traffic to populate APM data."

Run in two terminals:

```bash
cd examples/observability
npm install
npm start
```

```bash
cd examples/observability
npm run traffic
```

The traffic generator hits all endpoints for ~60 seconds with random delays. This produces APM traces (including slow requests and errors) and structured log entries in `app.log`.

---

## Step 4: Create an alert rule

**What to say:** "Now let's set up proactive monitoring with an alert rule for high latency."

**Prompt to type:**

> Create an alert rule for when average response time exceeds 500ms on the orders service

**What happens:** The AI calls `create_alert_rule` with parameters like:

```json
{
  "name": "High latency — orders-service",
  "rule_type": "apm.transaction_duration",
  "condition": "avg > 500ms",
  "service_name": "orders-service"
}
```

It returns the rule definition and, if `KIBANA_URL` is configured, creates the rule via the Kibana API.

**MCP tool:** `create_alert_rule`

---

## Step 5: Create a dashboard

**What to say:** "Finally, let's create a dashboard so we can visualize the service health at a glance."

**Prompt to type:**

> Create a dashboard for the orders service showing throughput, latency, and error rate

**What happens:** The AI calls `create_dashboard` with the requested panels. It returns a dashboard definition with visualizations for:

- Request throughput (requests/min)
- Average and p95 latency
- Error rate percentage

If `KIBANA_URL` is set, it creates the dashboard in Kibana directly.

**MCP tool:** `create_dashboard`

---

## Step 6: Explore in Kibana

**What to say:** "Let's open Kibana and see everything come together."

Open Kibana and walk through:

1. **APM > Services** — Select `orders-service`. Show the latency distribution, throughput, and error rate overview.
2. **APM > Traces** — Click into a slow `GET /api/orders/:id` transaction. Show the waterfall timeline and span details.
3. **APM > Errors** — Show the `Deliberate error for APM error tracking demo` from `/api/error`. Click through to the stack trace.
4. **Observability > Logs** — Filter to `app.log` entries. Show the structured JSON fields (method, url, status, duration_ms).
5. **Dashboards** — Open the dashboard created in Step 5. Show throughput, latency, and error rate panels with live data.
6. **Alerting** — Show the rule created in Step 4 under Stack Management > Rules. Trigger it by adjusting the threshold or generating slow traffic.

---

## Summary

| Step | Prompt | MCP tool |
|------|--------|----------|
| 1 | Set up APM for my Node.js Express app | `setup_apm` |
| 2 | Set up log shipping for ./app.log | `setup_log_shipping` |
| 3 | (manual) Start app + traffic generator | — |
| 4 | Create alert rule for high latency | `create_alert_rule` |
| 5 | Create dashboard for orders service | `create_dashboard` |
| 6 | (manual) Explore Kibana | — |
