#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "=== IoT Dashboard-as-Code Setup ==="
echo ""

if ! command -v docker &>/dev/null; then
  echo "Error: docker is not installed. Please install Docker Desktop."
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "Error: node is not installed. Please install Node.js 20+."
  exit 1
fi

# Start the Elastic stack if not already running
if ! docker compose ps --status running 2>/dev/null | grep -q elasticsearch; then
  echo "Starting Elastic stack (ES + Kibana + APM Server)..."
  docker compose up -d
  echo "Waiting for Elasticsearch to be healthy..."
  until curl -sf -u "elastic:${ELASTIC_PASSWORD:-changeme}" http://localhost:9200/_cluster/health >/dev/null 2>&1; do
    sleep 5
  done
  echo "Elasticsearch is ready."
else
  echo "Elastic stack already running."
fi

# Run the Node.js setup script
node setup.js "$@"
