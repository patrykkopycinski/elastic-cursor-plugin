#!/usr/bin/env bash
set -euo pipefail

# Continuous eval improvement loop.
# Runs evals, audits for issues, and generates a report.
# Designed to be invoked by AI agents or humans.
#
# Usage:
#   ./scripts/continuous-improve.sh [max_iterations]
#
# Environment:
#   Loads .env.test and the framework's .env automatically.
#   Set FRAMEWORK_DIR to override the framework path (default: ../cursor-plugin-evals)

MAX_ITER=${1:-10}
FRAMEWORK_DIR="${FRAMEWORK_DIR:-../cursor-plugin-evals}"
REPORT_DIR=".cursor-plugin-evals/improvement-reports"
TIMESTAMP=$(date +%Y%m%dT%H%M%S)
REPORT_FILE="${REPORT_DIR}/${TIMESTAMP}.md"

mkdir -p "$REPORT_DIR"

# Load environment
[ -f .env.test ] && export $(grep -v '^#' .env.test | xargs) 2>/dev/null
[ -f "$FRAMEWORK_DIR/.env" ] && export $(grep -v '^#' "$FRAMEWORK_DIR/.env" | xargs) 2>/dev/null

echo "=== Continuous Improvement Loop ==="
echo "Max iterations: $MAX_ITER"
echo "Report: $REPORT_FILE"
echo ""

{
  echo "# Continuous Improvement Report"
  echo "**Started:** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "**Max iterations:** $MAX_ITER"
  echo ""
} > "$REPORT_FILE"

PREV_PASS_RATE=""
STEADY_COUNT=0

for i in $(seq 1 "$MAX_ITER"); do
  echo "--- Iteration $i/$MAX_ITER ---"
  echo "" >> "$REPORT_FILE"
  echo "## Iteration $i" >> "$REPORT_FILE"

  npm run build 2>&1 | tail -3

  OUTPUT=$(npx cursor-plugin-evals run --config plugin-eval.yaml --ci --verbose 2>&1) || true
  EXIT_CODE=${PIPESTATUS[0]:-$?}

  PASS_RATE=$(echo "$OUTPUT" | grep -oP '\d+\.\d+% pass rate' | head -1 || echo "unknown")
  PASSED=$(echo "$OUTPUT" | grep -oP '(\d+) passed' | head -1 || echo "0")
  FAILED=$(echo "$OUTPUT" | grep -oP '(\d+) failed' | head -1 || echo "0")
  VIOLATIONS=$(echo "$OUTPUT" | grep -c 'threshold violation' || true)

  echo "Pass rate: $PASS_RATE | Exit: $EXIT_CODE | Violations: $VIOLATIONS"

  {
    echo "- **Pass rate:** $PASS_RATE"
    echo "- **Exit code:** $EXIT_CODE"
    echo "- **Threshold violations:** $VIOLATIONS"
  } >> "$REPORT_FILE"

  # Extract failure details
  FAILURES=$(echo "$OUTPUT" | sed -n '/Failure Details/,/Confidence Intervals/p' || true)

  if [ "$EXIT_CODE" -eq 0 ] && [ "$VIOLATIONS" -eq 0 ]; then
    echo "All CI thresholds pass!"
    echo "" >> "$REPORT_FILE"
    echo "**Result:** All CI thresholds pass. No action needed." >> "$REPORT_FILE"

    # Steady state: if same pass rate for 2 consecutive iterations, we're converged
    if [ "$PASS_RATE" = "$PREV_PASS_RATE" ]; then
      STEADY_COUNT=$((STEADY_COUNT + 1))
    else
      STEADY_COUNT=0
    fi

    if [ "$STEADY_COUNT" -ge 1 ]; then
      echo "Converged after $i iterations (steady state detected)."
      echo "" >> "$REPORT_FILE"
      echo "---" >> "$REPORT_FILE"
      echo "**Converged** after $i iterations." >> "$REPORT_FILE"
      break
    fi
  else
    STEADY_COUNT=0
    echo "" >> "$REPORT_FILE"
    echo "### Failures" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "$FAILURES" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**Action needed:** Fix failures and re-run." >> "$REPORT_FILE"
  fi

  PREV_PASS_RATE="$PASS_RATE"
done

{
  echo ""
  echo "---"
  echo "**Finished:** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >> "$REPORT_FILE"

echo ""
echo "Report saved to: $REPORT_FILE"
