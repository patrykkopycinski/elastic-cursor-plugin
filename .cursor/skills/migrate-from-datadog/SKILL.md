---
name: migrate-from-datadog
description: APM and observability migration from Datadog to Elastic
---

# Migrate from Datadog to Elastic

Use when the user wants to move APM or observability from Datadog to Elastic.

## 1. Prompt
- Clarify: APM only, or logs/metrics too. Identify language and framework (Node, Python, Java, Go, .NET).
- Confirm they have or will create an Elastic cluster (Cloud or self-managed).

## 2. Provision
- Use Elastic Cloud tools if they need a new project. Ensure APM Server is available (included in Cloud).
- Use the appropriate APM skill (apm-nodejs, apm-python, apm-java) for instrumentation.

## 3. Integrate
- Remove Datadog agent and tracer; install Elastic APM agent for their stack.
- Configure server URL and auth (API key or secret token). Set service name and environment to match or improve on Datadog naming.
- For logs: replace Datadog log pipeline with Filebeat or Elastic Agent to Elasticsearch.

## 4. Validate
- Deploy to a test environment; confirm traces and errors in Kibana APM.
- Compare key metrics (latency, error rate) and suggest dashboard migration.
