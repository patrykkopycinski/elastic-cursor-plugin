# Data Discovery Output Schema

## Overview

The `discover_o11y_data` tool scans an Elasticsearch cluster for observability data — APM services, host metrics, container metrics, log sources, and raw data streams — and returns a structured JSON object describing what it found.

This output serves as the foundation for downstream tools:

- **`get_data_summary`** consumes the discovery result to generate human-readable summaries and actionable recommendations (dashboards, SLOs, alerts).
- **Workflow templates** reference discovery output fields via `${steps.discover.output}` substitution to drive conditional logic and parameterize dashboard/SLO creation.
- **`kibana_create_dashboard`** and **`create_slo`** receive configuration derived from discovery data.

---

## Schema Reference

### Top-level structure

```typescript
interface DiscoveryResult {
  cluster_info: ClusterInfo;
  services: Service[];
  hosts: Host[];
  containers: Container[];
  log_sources: LogSource[];
  data_streams: DataStream[];
  discovery_time_ms: number;
}
```

---

### `cluster_info`

General information about the connected Elasticsearch cluster.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Cluster name. |
| `version` | `string` | Elasticsearch version (e.g. `"8.17.0"`). |
| `is_serverless` | `boolean` | `true` when connected to an Elastic Serverless project. |

---

### `services[]`

APM services discovered via `traces-apm*` and `metrics-apm*` data streams.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Service name as reported by the APM agent. |
| `environment` | `string` | Deployment environment (e.g. `"production"`, `"staging"`). |
| `language` | `string` | Agent language/runtime (e.g. `"nodejs"`, `"python"`, `"java"`). |
| `throughput` | `number` | Average transactions per minute over the queried time range. |
| `time_range` | `{ from: string, to: string }` | ISO-8601 timestamps bounding the data window. |
| `freshness` | `string` | Data freshness status — see [Freshness Status](#freshness-status). |
| `data_streams` | `string[]` | List of backing data stream names (e.g. `["traces-apm-default", "metrics-apm.internal-default"]`). |

---

### `hosts[]`

Infrastructure hosts discovered via `metrics-system*` and `metrics-elastic_agent*` data streams.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Hostname as reported by the agent. |
| `metric_types` | `string[]` | Categories of metrics available (e.g. `["cpu", "memory", "disk", "network"]`). |
| `collection_interval` | `string` | Metric collection period (e.g. `"10s"`, `"60s"`). |
| `freshness` | `string` | Data freshness status — see [Freshness Status](#freshness-status). |

---

### `containers[]`

Container and Kubernetes pod information from `metrics-kubernetes*` and `metrics-docker*` data streams.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Container or pod name. |
| `namespaces` | `string[]` | Kubernetes namespaces the container appears in (empty for non-k8s). |
| `nodes` | `string[]` | Kubernetes node names running this container. |
| `metric_families` | `string[]` | Metric categories (e.g. `["cpu", "memory", "network", "filesystem"]`). |

---

### `log_sources[]`

Log datasets discovered via `logs-*` data streams.

| Field | Type | Description |
|-------|------|-------------|
| `dataset` | `string` | Dataset name (e.g. `"nginx.access"`, `"system.syslog"`). |
| `volume` | `number` | Approximate document count over the queried time range. |
| `structured` | `boolean` | `true` when the majority of documents have parsed fields beyond `message`. |
| `log_level_distribution` | `object` | Breakdown of log levels. Keys are level names, values are counts (e.g. `{ "error": 120, "warn": 340, "info": 9500 }`). |

---

### `data_streams[]`

Raw data stream metadata for streams that don't fall into the above categories, or as a superset view.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Full data stream name (e.g. `"metrics-system.cpu-default"`). |
| `doc_count` | `number` | Total document count in the stream. |
| `key_fields` | `string[]` | Most common field names found in a sample of documents. |

---

### `discovery_time_ms`

Total wall-clock time the discovery operation took, in milliseconds.

---

## Freshness Status

The `freshness` field on `services` and `hosts` indicates how recently data was ingested:

| Value | Meaning |
|-------|---------|
| `active` | Most recent document is within the last 24 hours. |
| `stale` | Most recent document is older than 24 hours. |
| `no_data` | No documents found in the queried time range. |

---

## Input Parameters

The `discover_o11y_data` tool accepts optional parameters to scope the discovery:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `data_streams` | `string[]` | all | Limit discovery to data streams matching these patterns (e.g. `["metrics-*", "traces-*"]`). |
| `service_names` | `string[]` | all | Restrict APM service discovery to these service names. |
| `time_range_from` | `string` | `"now-24h"` | Start of the time window (ES date math, e.g. `"now-7d"`). |
| `time_range_to` | `string` | `"now"` | End of the time window. |
| `max_indices` | `number` | `50` | Maximum number of data streams to profile. Increase for large clusters at the cost of longer discovery times. |

---

## Example Output

```json
{
  "cluster_info": {
    "name": "my-production-cluster",
    "version": "8.17.0",
    "is_serverless": false
  },
  "services": [
    {
      "name": "payment-api",
      "environment": "production",
      "language": "nodejs",
      "throughput": 842.3,
      "time_range": {
        "from": "2025-02-16T00:00:00.000Z",
        "to": "2025-02-23T00:00:00.000Z"
      },
      "freshness": "active",
      "data_streams": [
        "traces-apm-default",
        "metrics-apm.internal-default"
      ]
    },
    {
      "name": "checkout-service",
      "environment": "production",
      "language": "java",
      "throughput": 215.7,
      "time_range": {
        "from": "2025-02-16T00:00:00.000Z",
        "to": "2025-02-23T00:00:00.000Z"
      },
      "freshness": "active",
      "data_streams": [
        "traces-apm-default",
        "metrics-apm.internal-default",
        "metrics-apm.service_summary-default"
      ]
    }
  ],
  "hosts": [
    {
      "name": "ip-10-0-1-42.ec2.internal",
      "metric_types": ["cpu", "memory", "disk", "network"],
      "collection_interval": "10s",
      "freshness": "active"
    },
    {
      "name": "ip-10-0-2-87.ec2.internal",
      "metric_types": ["cpu", "memory"],
      "collection_interval": "60s",
      "freshness": "stale"
    }
  ],
  "containers": [
    {
      "name": "payment-api-7b9f4d6c8-x2k9p",
      "namespaces": ["payments"],
      "nodes": ["ip-10-0-1-42.ec2.internal"],
      "metric_families": ["cpu", "memory", "network"]
    }
  ],
  "log_sources": [
    {
      "dataset": "nginx.access",
      "volume": 1250000,
      "structured": true,
      "log_level_distribution": {
        "info": 1200000,
        "warn": 48000,
        "error": 2000
      }
    },
    {
      "dataset": "system.syslog",
      "volume": 340000,
      "structured": false,
      "log_level_distribution": {
        "info": 310000,
        "warn": 25000,
        "error": 5000
      }
    }
  ],
  "data_streams": [
    {
      "name": "metrics-system.cpu-default",
      "doc_count": 8640000,
      "key_fields": ["system.cpu.total.pct", "system.cpu.user.pct", "system.cpu.system.pct", "host.name"]
    },
    {
      "name": "logs-nginx.access-default",
      "doc_count": 1250000,
      "key_fields": ["url.path", "http.response.status_code", "source.address", "user_agent.original"]
    }
  ],
  "discovery_time_ms": 3420
}
```
