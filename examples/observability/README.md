# Observability demo

A self-contained Node.js Express API instrumented with Elastic APM and structured logging via pino. Use it to demonstrate the full observability workflow: APM traces, log shipping, alerting, and dashboards.

## What's in this demo

- **app.js** — Express API (`/api/orders` CRUD + `/api/error`) with Elastic APM agent and pino JSON logging to stdout and `app.log`.
- **generate-traffic.js** — Hits all endpoints in a loop for ~60 seconds with random delays. Produces varied traces and log entries.
- **demo-script.md** — Step-by-step presenter walkthrough showing exact AI prompts and which MCP tools get called.

## Quick start

```bash
cd examples/observability
npm install
```

Set environment variables (or accept defaults for local APM server):

```bash
export APM_SERVER_URL=http://localhost:8200
export APM_SECRET_TOKEN=your-token
```

Start the app:

```bash
npm start
```

In another terminal, generate traffic:

```bash
npm run traffic
```

## Demo flow

See [demo-script.md](demo-script.md) for the full presenter walkthrough. Summary:

| Step | Action | MCP tool |
|------|--------|----------|
| 1 | Instrument app with APM | `setup_apm` |
| 2 | Ship `app.log` to Elasticsearch | `setup_log_shipping` |
| 3 | Start app + traffic generator | manual |
| 4 | Create latency alert rule | `create_alert_rule` |
| 5 | Create throughput/latency/error dashboard | `create_dashboard` |
| 6 | Explore traces, errors, logs in Kibana | manual |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `APM_SERVER_URL` | `http://localhost:8200` | Elastic APM server URL |
| `APM_SECRET_TOKEN` | (empty) | APM secret token |
| `PORT` | `3000` | Express listen port |
| `NODE_ENV` | `development` | APM environment tag |
