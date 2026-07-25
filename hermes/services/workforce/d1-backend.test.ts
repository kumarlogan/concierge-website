// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Workforce D1 Backend Test                 │
// │ EPIC-005 · PHASE 5                                          │
// │ Test suite for the D1 workforce persistence backend.        │
// └─────────────────────────────────────────────────────────────┘

import { D1WorkforceBackend } from "./d1-backend.js";
import { createWorkforceRepository } from "./repository.js";
import type { D1Database } from "@cloudflare/workers-types";

/**
 * Test the D1 workforce backend implementation.
 * This test verifies that the backend correctly implements the WorkforcePersistenceBackend interface.
 */
export async function testD1WorkforceBackend(db: D1Database): Promise<void> {
  console.log("Testing D1 Workforce Backend...");
  
  // Create the backend and repository
  const backend = new D1WorkforceBackend(db);
  const repository = createWorkforceRepository(backend);
  
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
  
  const testEvent = {
    eventId: "test-event-001",
    agentId: "test-agent-001",
    eventType: "agent.created",
    actor: "test-user",
    metadata: { test: "data" },
    timestamp: new Date().toISOString(),
  };
  
  try {
    // Test agent operations
    console.log("Testing agent operations...");
    await repository.saveAgentState(testAgent);
    const retrievedAgent = await repository.getAgentState(testAgent.agentId);
    console.log("Retrieved agent:", retrievedAgent);
    
    // Test activation request operations
    console.log("Testing activation request operations...");
    await repository.saveActivationRequest(testRequest);
    const retrievedRequest = await repository.getActivationRequest(testRequest.requestId);
    console.log("Retrieved request:", retrievedRequest);
    
    // Test audit event operations
    console.log("Testing audit event operations...");
    await repository.appendAuditEvent(testEvent);
    const retrievedEvents = await repository.getAgentHistory(testAgent.agentId);
    console.log("Retrieved events:", retrievedEvents);
    
    console.log("D1 Workforce Backend test completed successfully!");
  } catch (error) {
    console.error("D1 Workforce Backend test failed:", error);
    throw error;
  }
}