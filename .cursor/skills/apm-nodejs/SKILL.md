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

## 4. Validate
- Run the app and trigger a request; confirm traces appear in Kibana APM.
- Suggest setting service name and environment (e.g. production/staging).
