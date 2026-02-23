---
name: apm-java
description: APM setup for Java/Spring Boot applications
---

# APM for Java / Spring Boot

Use when the user wants to add Elastic APM to a Java or Spring Boot application.

## 1. Prompt
- Confirm Spring Boot version and build tool (Maven/Gradle).
- Get APM Server URL and secret token or API key.

## 2. Provision
- Ensure they have an Elastic Stack with APM Server (or Elastic Cloud with APM).

## 3. Integrate
- Add the co.elastic.apm:elastic-apm-agent dependency (or download the agent JAR).
- Start the app with the Java agent: `-javaagent:/path/to/elastic-apm-agent.jar` and set `ELASTIC_APM_SERVER_URL` and `ELASTIC_APM_SECRET_TOKEN` (or API key).
- Spring Boot is auto-instrumented; document custom spans if needed.

## 4. Validate
- Run the application and trigger an HTTP request; confirm traces in Kibana APM.
- Suggest service_name and environment labels.
