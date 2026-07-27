// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Message Policy & PHI Enforcement               │
// │ Enforces PHI boundaries and consent checks for messaging.   │
// ══════════════════════════════════════════════════════════

import type { Message, CreateMessageRequest } from "./message-types.js";
import type { Decision } from "../trust/types.js";

export interface MessagePolicy {
  /** Verify a message complies with PHI and consent policies */
  validate(request: CreateMessageRequest, consentDecision: Decision): { valid: boolean; reason: string };
  /** Determine if content requires encryption */
  requiresEncryption(content: string): boolean;
  /** Check if a message can be stored based on retention policy */
  canStore(message: Message): boolean;
}