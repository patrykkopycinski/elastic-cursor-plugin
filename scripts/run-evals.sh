#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Run plugin evals end-to-end: start infrastructure, build, seed data, run evals.

Options:
  --layer LAYER    Run only specific layer(s): static, unit, integration, llm, performance
  --suite SUITE    Run only specific suite(s)
  --ci             Run in CI mode (enforce thresholds, exit non-zero on failure)
  --skip-docker    Skip Docker startup (use existing cluster)
  --skip-seed      Skip test data seeding
  --skip-build     Skip plugin build step
  --mock           Run with mock fixtures (no live cluster needed)
  --verbose        Enable debug logging
  --teardown       Stop Docker containers after run
  -h, --help       Show this help

Environment:
  OPENAI_API_KEY   Required for LLM layer evals (judge model)
  ES_URL           Override Elasticsearch URL (default: http://localhost:9220)

Examples:
  ./scripts/run-evals.sh                        # Full e2e run
  ./scripts/run-evals.sh --layer static         # Static checks only (no Docker needed)
  ./scripts/run-evals.sh --layer unit           # Unit checks only (no Docker needed)
  ./scripts/run-evals.sh --layer integration    # Integration tests (needs Docker)
  ./scripts/run-evals.sh --ci                   # CI mode with threshold enforcement
  ./scripts/run-evals.sh --skip-docker --ci     # CI against existing cluster
EOF
  exit 0
}

LAYERS=()
SUITES=()
CI_MODE=""
SKIP_DOCKER=""
SKIP_SEED=""
SKIP_BUILD=""
MOCK=""
VERBOSE=""
TEARDOWN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --layer) LAYERS+=("--layer" "$2"); shift 2 ;;
    --suite) SUITES+=("--suite" "$2"); shift 2 ;;
    --ci) CI_MODE="--ci"; shift ;;
    --skip-docker) SKIP_DOCKER="1"; shift ;;
    --skip-seed) SKIP_SEED="1"; shift ;;
    --skip-build) SKIP_BUILD="1"; shift ;;
    --mock) MOCK="--mock"; shift ;;
    --verbose) VERBOSE="--verbose"; shift ;;
    --teardown) TEARDOWN="1"; shift ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

cd "$PROJECT_ROOT"

cleanup() {
  if [[ -n "$TEARDOWN" ]]; then
    echo ""
    echo "==> Tearing down Docker containers..."
    docker compose -f docker/docker-compose.yml down -v 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Load test env
if [[ -f .env.test ]]; then
  set -a
  source .env.test
  set +a
fi

# --- Step 1: Start Docker infrastructure ---
if [[ -z "$SKIP_DOCKER" && -z "$MOCK" ]]; then
  echo "==> Starting Docker infrastructure..."
  docker compose -f docker/docker-compose.yml up -d --wait --wait-timeout 120

  echo "==> Waiting for Elasticsearch to be healthy..."
  local_url="${ES_URL:-http://localhost:9220}"
  max_wait=60
  waited=0
  until curl -sf -u "${ES_USERNAME:-elastic}:${ES_PASSWORD:-changeme}" "${local_url}/_cluster/health" > /dev/null 2>&1; do
    waited=$((waited + 2))
    if [[ $waited -ge $max_wait ]]; then
      echo "ERROR: Elasticsearch not healthy after ${max_wait}s"
      docker compose -f docker/docker-compose.yml logs elasticsearch
      exit 1
    fi
    sleep 2
  done
  echo "Elasticsearch is healthy."
fi

# --- Step 2: Seed test data ---
if [[ -z "$SKIP_SEED" && -z "$MOCK" ]]; then
  echo ""
  echo "==> Seeding test data..."
  bash scripts/seed-test-data.sh
fi

# --- Step 3: Build plugin ---
if [[ -z "$SKIP_BUILD" ]]; then
  echo ""
  echo "==> Building plugin..."
  npm run build
fi

# --- Step 4: Run evals ---
echo ""
echo "==> Running plugin evals..."
EVAL_CMD=(npx cursor-plugin-evals run)

if [[ ${#LAYERS[@]} -gt 0 ]]; then
  EVAL_CMD+=("${LAYERS[@]}")
fi

if [[ ${#SUITES[@]} -gt 0 ]]; then
  EVAL_CMD+=("${SUITES[@]}")
fi

[[ -n "$CI_MODE" ]] && EVAL_CMD+=("$CI_MODE")
[[ -n "$MOCK" ]] && EVAL_CMD+=("$MOCK")
[[ -n "$VERBOSE" ]] && EVAL_CMD+=("$VERBOSE")

echo "Running: ${EVAL_CMD[*]}"
"${EVAL_CMD[@]}"
exit_code=$?

echo ""
if [[ $exit_code -eq 0 ]]; then
  echo "✅ All evals passed!"
else
  echo "❌ Evals failed with exit code ${exit_code}"
fi

exit $exit_code
