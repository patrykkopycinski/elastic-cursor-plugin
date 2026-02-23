---
name: apm-nodejs
description: APM setup for Node.js applications (Express, Fastify, Koa, NestJS)
---

# APM for Node.js

Use when the user wants to add Elastic APM to a Node.js app.

## 1. Prompt
- Identify framework: Express, Fastify, Koa, NestJS, or plain Node.
- Confirm Elasticsearch/APM server endpoint and secret token (or API key).

## 2. Provision
- If they use Elastic Cloud, suggest `get_connection_config` or Cloud project setup.
- Ensure APM Server URL and auth are available.

## 3. Integrate
- Add `elastic-apm-node` as a dependency.
- Start the agent as the first require: `require('elastic-apm-node').start({ serverUrl, secretToken })`.
- For Express/Fastify/Koa: middleware is usually auto-instrumented; document manual spans if needed.

### OpenTelemetry (OTel SDK) Alternative
- For OTel-native apps shipping metrics/traces directly to ES (9.x+ native OTLP intake at `/_otlp/`):
  - **Use `@opentelemetry/exporter-metrics-otlp-proto`** (protobuf), NOT `@opentelemetry/exporter-metrics-otlp-http` (JSON). ES native OTLP only accepts `application/x-protobuf` and returns HTTP 406 for `application/json`.
  - Match the exporter version to your `@opentelemetry/sdk-metrics` major version (e.g. proto exporter `0.52.x` for SDK `1.x`; proto exporter `0.212.x` for SDK `2.x`).
  - The OTel SDK's `forceFlush()` may resolve successfully even when the exporter fails silently (e.g. HTTP 406) — always verify data landed in ES after first export.

## 4. Validate
- Run the app and trigger a request; confirm traces appear in Kibana APM.
- Suggest setting service name and environment (e.g. production/staging).
