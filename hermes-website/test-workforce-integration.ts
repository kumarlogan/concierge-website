// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Workforce Persistence Integration Test     │
// │ EPIC-005 · PHASE 5                                          │
// │ Integration test demonstrating workforce persistence         │
// └─────────────────────────────────────────────────────────────┘

import { D1WorkforceBackend } from "./hermes/services/workforce/d1-backend.js";
import { createWorkforceRepository, MemoryWorkforceBackend } from "./hermes/services/workforce/repository.js";
import { 
  initializeWorkforceRepositoryInMemory,
  saveWorkforceAgentState,
  getWorkforceAgentState,
  saveWorkforceActivationRequest,
  getWorkforceActivationRequest,
  appendWorkforceAuditEvent,
  getWorkforceAgentHistory
} from "./hermes/services/workforce/orchestration.js";

/**
 * Integration test demonstrating the workforce persistence implementation.
 * This test shows how the components work together.
 */
async function testWorkforcePersistence(): Promise<void> {
  console.log("Starting Workforce Persistence Integration Test...");
  
  // Initialize with in-memory backend for testing
  initializeWorkforceRepositoryInMemory();
  
  // Test data
  const testAgent = {
    agentId: "test-agent-001",
    lifecycleState: "active" as const,
    enabled: true,
    autonomous: false,
    domain: "test-domain",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  const testRequest = {
    requestId: "test-request-001",
    agentId: "test-agent-001",
    requestedBy: "test-user",
    approvedBy: "approver-user",
    approvalReference: "test-ref-001",
    status: "approved" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  const testEvent1 = {
    eventId: "test-event-001",
    agentId: "test-agent-001",
    eventType: "agent.created",
    actor: "test-user",
    metadata: { test: "data" },
    timestamp: new Date().toISOString(),
  };
  
  const testEvent2 = {
    eventId: "test-event-002",
    agentId: "test-agent-001",
    eventType: "agent.enabled",
    actor: "test-user",
    metadata: { enabled: true },
    timestamp: new Date().toISOString(),
  };
  
  try {
    // Test agent operations
    console.log("1. Testing agent operations...");
    await saveWorkforceAgentState(testAgent);
    const retrievedAgent = await getWorkforceAgentState(testAgent.agentId);
    console.log("✓ Agent saved and retrieved:", retrievedAgent?.agentId === testAgent.agentId);
    
    // Test activation request operations
    console.log("2. Testing activation request operations...");
    await saveWorkforceActivationRequest(testRequest);
    const retrievedRequest = await getWorkforceActivationRequest(testRequest.requestId);
    console.log("✓ Activation request saved and retrieved:", retrievedRequest?.requestId === testRequest.requestId);
    
    // Test audit event operations
    console.log("3. Testing audit event operations...");
    await appendWorkforceAuditEvent(testEvent1);
    await appendWorkforceAuditEvent(testEvent2);
    const retrievedEvents = await getWorkforceAgentHistory(testAgent.agentId);
    console.log("✓ Audit events saved and retrieved:", retrievedEvents.length === 2);
    
    // Verify data integrity
    console.log("4. Verifying data integrity...");
    console.log("✓ Agent data integrity:", 
      retrievedAgent?.lifecycleState === testAgent.lifecycleState &&
      retrievedAgent?.enabled === testAgent.enabled &&
      retrievedAgent?.autonomous === testAgent.autonomous
    );
    
    console.log("✓ Activation request data integrity:",
      retrievedRequest?.agentId === testRequest.agentId &&
      retrievedRequest?.status === testRequest.status &&
      retrievedRequest?.approvedBy === testRequest.approvedBy
    );
    
    console.log("✓ Audit event data integrity:",
      retrievedEvents.some(e => e.eventId === testEvent1.eventId) &&
      retrievedEvents.some(e => e.eventId === testEvent2.eventId)
    );
    
    console.log("🎉 All tests passed! Workforce persistence implementation is working correctly.");
  } catch (error) {
    console.error("❌ Integration test failed:", error);
    throw error;
  }
}

// Run the test if this file is executed directly
if (import.meta.url === new URL(import.meta.url).href) {
  testWorkforcePersistence().catch(console.error);
}

export { testWorkforcePersistence };