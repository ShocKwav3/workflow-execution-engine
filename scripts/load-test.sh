#!/usr/bin/env bash
# Runs the k6 load test and samples `kubectl top pods` until it ends; both go into one log file.
set -euo pipefail

BASE_URL="${LOAD_TEST_BASE_URL:-http://localhost:3000}"
DURATION="${LOAD_TEST_DURATION:-3m}"
INTERVAL="${LOAD_TEST_INTERVAL:-60}"
NAMESPACE="${LOAD_TEST_NAMESPACE:-workflow-engine}"
OUT="${LOAD_TEST_OUT:-load-test.log}"
SUMMARY="$(mktemp)"

sample() {
  { echo "=== $(date -u +%T)"; kubectl top pods -n "$NAMESPACE" || echo "kubectl top failed"; echo; } >> "$OUT"
}

: > "$OUT"
(while true; do sample; sleep "$INTERVAL"; done) &
SAMPLER=$!
trap 'kill "$SAMPLER" 2>/dev/null || true; rm -f "$SUMMARY"' EXIT

status=0
k6 run \
  -e LOAD_TEST_BASE_URL="$BASE_URL" \
  -e LOAD_TEST_DURATION="$DURATION" \
  -e LOAD_TEST_SUMMARY_FILE="$SUMMARY" \
  "$(dirname "$0")/load-executions.js" || status=$?

kill "$SAMPLER" 2>/dev/null || true
sample
{ echo "=== k6 summary"; cat "$SUMMARY"; } >> "$OUT"
echo "Samples and k6 summary written to $OUT"
exit "$status"
