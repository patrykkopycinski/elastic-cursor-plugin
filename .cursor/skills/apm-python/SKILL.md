---
name: apm-python
description: APM setup for Python applications (Django, Flask, FastAPI)
---

# APM for Python

Use when the user wants to add Elastic APM to a Python application.

## 1. Prompt
- Identify framework: Django, Flask, FastAPI, or other.
- Confirm APM Server URL and secret token or API key.

## 2. Provision
- Use Elastic Cloud tools if they need a cluster; otherwise assume existing cluster.
- Ensure `elastic-apm` package and correct server URL/token.

## 3. Integrate
- Install: `pip install elastic-apm`.
- Django: add `elasticapm.contrib.django` to INSTALLED_APPS and configure in settings.
- Flask: initialize `ElasticAPM(app, server_url=..., secret_token=...)`.
- FastAPI: use `elasticapm.contrib.starlette.ElasticAPM` middleware.

## 4. Validate
- Send a test request and verify transactions in Kibana APM.
- Recommend setting service_name and environment.
