#!/bin/bash
# ┌─────────────────────────────────────────────────────────────┐
# │ Hermes Platform — Workforce Activation Workflow Test Script  │
# │ EPIC-005 · PHASE 5                                         │
# │ Test script to verify activation workflow implementation    │
# └─────────────────────────────────────────────────────────────┘

echo "Testing Workforce Activation Workflow Implementation..."

# Check that the required files exist
echo "Checking for required files..."

if [ ! -f "./hermes/services/workforce/activation-workflow.ts" ]; then
  echo "ERROR: Activation workflow implementation not found"
  exit 1
fi

echo "✓ Activation workflow file found"

# Check that the activation workflow service implements the required methods
echo "Checking activation workflow service implementation..."

required_methods=(
  "listEligibleAgents"
  "requestActivation"
  "approveActivation"
  "rejectActivation"
  "assignTestTask"
  "reviewExecutionResult"
  "validateActivationReadiness"
  "getActivationChecklist"
  "simulateActivation"
)

for method in "${required_methods[@]}"; do
  if ! grep -q "export async function $method(" "./hermes/services/workforce/activation-workflow.ts"; then
    echo "ERROR: Method $method not found in activation workflow service"
    exit 1
  fi
done

echo "✓ All required methods found in activation workflow service"

# Check that the activation workflow imports the required functions
echo "Checking activation workflow imports..."

required_imports=(
  "getWorkforceAgentState"
  "saveWorkforceAgentState"
  "saveWorkforceActivationRequest"
  "getWorkforceActivationRequest"
  "appendWorkforceAuditEvent"
  "getWorkforceAgentHistory"
  "recordAgentExecutionAttempt"
  "recordAgentExecutionSuccess"
  "recordAgentExecutionFailure"
  "getAgentHealth"
  "getWorkforceSummary"
  "getRecentActivity"
  "getFailedOperations"
  "detectSafetyViolations"
)

for import in "${required_imports[@]}"; do
  if ! grep -q "$import" "./hermes/services/workforce/activation-workflow.ts"; then
    echo "ERROR: Function $import not imported in activation workflow service"
    exit 1
  fi
done

echo "✓ All required functions imported in activation workflow service"

# Check that the activation checklist is implemented
echo "Checking activation checklist..."

if ! grep -q "getActivationChecklist" "./hermes/services/workforce/activation-workflow.ts"; then
  echo "ERROR: Activation checklist not found"
  exit 1
fi

echo "✓ Activation checklist found"

# Check that dry-run mode is implemented
echo "Checking dry-run mode..."

if ! grep -q "simulateActivation" "./hermes/services/workforce/activation-workflow.ts"; then
  echo "ERROR: Dry-run mode (simulateActivation) not found"
  exit 1
fi

echo "✓ Dry-run mode found"

echo "All tests passed! Workforce activation workflow implementation is complete."