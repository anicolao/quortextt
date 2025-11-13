#!/bin/bash

# Script to run the AI Rematch test 100 times to check for flakiness
# Usage: ./scripts/test-ai-rematch-flakiness.sh

ITERATIONS=100
TEST_FILE="tests/aiRematch.test.ts"
RESULTS_DIR="test-results/flakiness"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$RESULTS_DIR/ai-rematch-test-$TIMESTAMP.log"

# Create results directory if it doesn't exist
mkdir -p "$RESULTS_DIR"

# Initialize counters
PASSED=0
FAILED=0
TIMEOUT=0

echo "Running AI Rematch test $ITERATIONS times..." | tee "$LOG_FILE"
echo "Test file: $TEST_FILE" | tee -a "$LOG_FILE"
echo "Started at: $(date)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

# Run the test multiple times
for i in $(seq 1 $ITERATIONS); do
    echo -n "Iteration $i/$ITERATIONS... " | tee -a "$LOG_FILE"
    
    # Run the test with a timeout
    OUTPUT=$(timeout 90s npm test -- "$TEST_FILE" --reporter=verbose 2>&1)
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "PASSED" | tee -a "$LOG_FILE"
        ((PASSED++))
    elif [ $EXIT_CODE -eq 124 ]; then
        echo "TIMEOUT" | tee -a "$LOG_FILE"
        ((TIMEOUT++))
        echo "$OUTPUT" >> "$RESULTS_DIR/timeout-$i.log"
    else
        echo "FAILED (exit code: $EXIT_CODE)" | tee -a "$LOG_FILE"
        ((FAILED++))
        echo "$OUTPUT" >> "$RESULTS_DIR/failure-$i.log"
    fi
done

echo "========================================" | tee -a "$LOG_FILE"
echo "Finished at: $(date)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Results:" | tee -a "$LOG_FILE"
echo "  Passed:  $PASSED / $ITERATIONS" | tee -a "$LOG_FILE"
echo "  Failed:  $FAILED / $ITERATIONS" | tee -a "$LOG_FILE"
echo "  Timeout: $TIMEOUT / $ITERATIONS" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Calculate success rate
SUCCESS_RATE=$(awk "BEGIN {printf \"%.2f\", ($PASSED/$ITERATIONS)*100}")
echo "Success rate: $SUCCESS_RATE%" | tee -a "$LOG_FILE"

if [ $FAILED -gt 0 ] || [ $TIMEOUT -gt 0 ]; then
    echo "" | tee -a "$LOG_FILE"
    echo "TEST IS FLAKY - Found $((FAILED + TIMEOUT)) failures/timeouts out of $ITERATIONS runs" | tee -a "$LOG_FILE"
    echo "Check logs in $RESULTS_DIR/ for details" | tee -a "$LOG_FILE"
    exit 1
else
    echo "" | tee -a "$LOG_FILE"
    echo "TEST IS STABLE - All $ITERATIONS iterations passed" | tee -a "$LOG_FILE"
    exit 0
fi
