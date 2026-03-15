#!/usr/bin/env bash
set -euo pipefail

# Additional test data seeding beyond what docker-compose setup creates.
# Run this AFTER docker-compose is healthy.

ES_URL="${ES_URL:-http://localhost:9220}"
ES_USER="${ES_USERNAME:-elastic}"
ES_PASS="${ES_PASSWORD:-changeme}"
AUTH="-u ${ES_USER}:${ES_PASS}"

echo "==> Seeding additional test data into ${ES_URL}..."

wait_for_es() {
  local max_attempts=30
  local attempt=0
  until curl -sf ${AUTH} "${ES_URL}/_cluster/health" > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
      echo "ERROR: Elasticsearch not ready after ${max_attempts} attempts"
      exit 1
    fi
    echo "Waiting for Elasticsearch... (${attempt}/${max_attempts})"
    sleep 2
  done
  echo "Elasticsearch is ready."
}

wait_for_es

# --- E-commerce sample data (for search UI tests) ---
echo "--- Creating sample-ecommerce index ---"
curl -sf ${AUTH} -X PUT "${ES_URL}/sample-ecommerce" \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
    "mappings": {
      "properties": {
        "product_name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
        "category": {"type": "keyword"},
        "price": {"type": "float"},
        "in_stock": {"type": "boolean"},
        "description": {"type": "text"},
        "created_at": {"type": "date"}
      }
    }
  }' || true
echo ""

curl -sf ${AUTH} -X POST "${ES_URL}/sample-ecommerce/_bulk" \
  -H 'Content-Type: application/x-ndjson' \
  -d '{"index":{}}
{"product_name":"Elastic T-Shirt","category":"clothing","price":29.99,"in_stock":true,"description":"Official Elastic branded t-shirt","created_at":"2024-01-10T00:00:00Z"}
{"index":{}}
{"product_name":"Kibana Mug","category":"accessories","price":14.99,"in_stock":true,"description":"Ceramic mug with Kibana logo","created_at":"2024-01-11T00:00:00Z"}
{"index":{}}
{"product_name":"Logstash Hoodie","category":"clothing","price":59.99,"in_stock":false,"description":"Premium hoodie with Logstash branding","created_at":"2024-01-12T00:00:00Z"}
{"index":{}}
{"product_name":"Beats Cap","category":"accessories","price":19.99,"in_stock":true,"description":"Baseball cap with Beats logo","created_at":"2024-01-13T00:00:00Z"}
{"index":{}}
{"product_name":"ES|QL Sticker Pack","category":"accessories","price":4.99,"in_stock":true,"description":"Set of 10 Elastic stickers","created_at":"2024-01-14T00:00:00Z"}
' || true
echo ""

# --- Filebeat-style indices (for log shipping discovery) ---
echo "--- Creating filebeat-* indices ---"
curl -sf ${AUTH} -X PUT "${ES_URL}/filebeat-9.4.0-SNAPSHOT-2024.01.15" \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
    "mappings": {
      "properties": {
        "@timestamp": {"type": "date"},
        "message": {"type": "text"},
        "agent.type": {"type": "keyword"},
        "host.name": {"type": "keyword"},
        "log.file.path": {"type": "keyword"}
      }
    }
  }' || true
echo ""

curl -sf ${AUTH} -X POST "${ES_URL}/filebeat-9.4.0-SNAPSHOT-2024.01.15/_bulk" \
  -H 'Content-Type: application/x-ndjson' \
  -d '{"index":{}}
{"@timestamp":"2024-01-15T10:00:00Z","message":"GET /index.html 200 0.004","agent.type":"filebeat","host.name":"webserver-01","log.file.path":"/var/log/nginx/access.log"}
{"index":{}}
{"@timestamp":"2024-01-15T10:00:01Z","message":"POST /api/login 401 0.012","agent.type":"filebeat","host.name":"webserver-01","log.file.path":"/var/log/nginx/access.log"}
' || true
echo ""

# --- Metricbeat-style indices (for metrics discovery) ---
echo "--- Creating metricbeat-* indices ---"
curl -sf ${AUTH} -X PUT "${ES_URL}/metricbeat-9.4.0-SNAPSHOT-2024.01.15" \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
    "mappings": {
      "properties": {
        "@timestamp": {"type": "date"},
        "metricset.name": {"type": "keyword"},
        "system.cpu.total.pct": {"type": "float"},
        "system.memory.used.pct": {"type": "float"},
        "host.name": {"type": "keyword"}
      }
    }
  }' || true
echo ""

curl -sf ${AUTH} -X POST "${ES_URL}/metricbeat-9.4.0-SNAPSHOT-2024.01.15/_bulk" \
  -H 'Content-Type: application/x-ndjson' \
  -d '{"index":{}}
{"@timestamp":"2024-01-15T10:00:00Z","metricset.name":"cpu","system.cpu.total.pct":0.45,"host.name":"server-01"}
{"index":{}}
{"@timestamp":"2024-01-15T10:00:00Z","metricset.name":"memory","system.memory.used.pct":0.72,"host.name":"server-01"}
' || true
echo ""

# --- Winlogbeat (for security discovery) ---
echo "--- Creating winlogbeat-* index ---"
curl -sf ${AUTH} -X PUT "${ES_URL}/winlogbeat-9.4.0-SNAPSHOT-2024.01.15" \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
    "mappings": {
      "properties": {
        "@timestamp": {"type": "date"},
        "event.action": {"type": "keyword"},
        "event.category": {"type": "keyword"},
        "winlog.event_id": {"type": "long"},
        "source.ip": {"type": "ip"},
        "user.name": {"type": "keyword"}
      }
    }
  }' || true
echo ""

curl -sf ${AUTH} -X POST "${ES_URL}/winlogbeat-9.4.0-SNAPSHOT-2024.01.15/_bulk" \
  -H 'Content-Type: application/x-ndjson' \
  -d '{"index":{}}
{"@timestamp":"2024-01-15T10:00:00Z","event.action":"logon-failed","event.category":"authentication","winlog.event_id":4625,"source.ip":"10.0.0.50","user.name":"admin"}
{"index":{}}
{"@timestamp":"2024-01-15T10:01:00Z","event.action":"logon-failed","event.category":"authentication","winlog.event_id":4625,"source.ip":"10.0.0.50","user.name":"admin"}
{"index":{}}
{"@timestamp":"2024-01-15T10:02:00Z","event.action":"logon-success","event.category":"authentication","winlog.event_id":4624,"source.ip":"10.0.0.51","user.name":"jdoe"}
' || true
echo ""

# --- Packetbeat (for network security discovery) ---
echo "--- Creating packetbeat-* index ---"
curl -sf ${AUTH} -X PUT "${ES_URL}/packetbeat-9.4.0-SNAPSHOT-2024.01.15" \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
    "mappings": {
      "properties": {
        "@timestamp": {"type": "date"},
        "type": {"type": "keyword"},
        "source.ip": {"type": "ip"},
        "destination.ip": {"type": "ip"},
        "destination.port": {"type": "integer"},
        "network.bytes": {"type": "long"}
      }
    }
  }' || true
echo ""

# --- Endpoint security index ---
echo "--- Creating .ds-logs-endpoint.events.process-default ---"
curl -sf ${AUTH} -X PUT "${ES_URL}/logs-endpoint.events.process-default" \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
    "mappings": {
      "properties": {
        "@timestamp": {"type": "date"},
        "process.name": {"type": "keyword"},
        "process.pid": {"type": "long"},
        "process.args": {"type": "keyword"},
        "host.name": {"type": "keyword"},
        "user.name": {"type": "keyword"}
      }
    }
  }' || true
echo ""

curl -sf ${AUTH} -X POST "${ES_URL}/logs-endpoint.events.process-default/_bulk" \
  -H 'Content-Type: application/x-ndjson' \
  -d '{"create":{}}
{"@timestamp":"2024-01-15T10:00:00Z","process.name":"bash","process.pid":1234,"process.args":["/bin/bash"],"host.name":"server-01","user.name":"root"}
{"create":{}}
{"@timestamp":"2024-01-15T10:00:01Z","process.name":"curl","process.pid":1235,"process.args":["curl","http://suspicious.com/payload"],"host.name":"server-01","user.name":"www-data"}
' || true
echo ""

echo "==> All additional test data seeded successfully!"
echo ""
echo "Summary of indices:"
curl -sf ${AUTH} "${ES_URL}/_cat/indices?v&h=index,docs.count,store.size&s=index"
