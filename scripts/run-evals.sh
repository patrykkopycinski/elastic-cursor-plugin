#!/usr/bin/env bash
# Run full e2e eval suite for the elastic-cursor-plugin.
# Usage: ./scripts/run-evals.sh [--layer <layers...>] [--ci]
#
# Requires:
#   - Docker ES running on port 9220 (see docker/docker-compose.yml)
#   - LiteLLM proxy credentials in ../cursor-plugin-evals/.env (or env vars)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EVAL_FRAMEWORK_ENV="${PLUGIN_DIR}/../cursor-plugin-evals/.env"

# Load test cluster credentials
if [[ -f "$PLUGIN_DIR/.env.test" ]]; then
  set -a
  source "$PLUGIN_DIR/.env.test"
  set +a
fi

# Load eval framework credentials (LiteLLM, judge model, etc.)
if [[ -f "$EVAL_FRAMEWORK_ENV" ]]; then
  set -a
  source "$EVAL_FRAMEWORK_ENV"
  set +a
fi

# Route LLM traffic through LiteLLM proxy
if [[ -n "${LITELLM_PROXY_URL:-}" ]]; then
  export OPENAI_BASE_URL="${LITELLM_PROXY_URL}/v1"
  export OPENAI_API_KEY="${LITELLM_API_KEY:-}"
fi

echo "=== Elastic Plugin Eval Suite ==="
echo "  ES_URL:     ${ES_URL:-not set}"
echo "  KIBANA_URL: ${KIBANA_URL:-not set}"
echo "  JUDGE_MODEL: ${JUDGE_MODEL:-default}"
echo "  LiteLLM:    ${LITELLM_PROXY_URL:-not configured}"
echo ""

# Build the plugin first
echo "Building plugin..."
cd "$PLUGIN_DIR"
npm run build --silent 2>/dev/null || npm run build

# Run evals
echo ""
echo "Running evaluations..."
exec cursor-plugin-evals run "$@"
