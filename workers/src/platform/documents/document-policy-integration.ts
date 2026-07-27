// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Document Policy Integration                    │
// │ Wires document authorization to the Policy Engine.          │
// │ Wave 6 — AI Platform Secure Document Upload v1              │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: Policy evaluation operates on opaque resource
// identifiers (document IDs), never PHI payloads. Resource types
// and actions are string constants defined here.

import type { PolicyEngine } from "../trust/policy-engine.js";
import type { PolicyEvaluationResult, EvaluationContext, Policy } from "../trust/types.js";
import { PolicyCategory, Decision } from "../trust/types.js";
import { DocumentServiceError } from "./types.js";

// ════════════════════════════════════════════════════════════════
// Document Resource Type & Actions
// ════════════════════════════════════════════════════════════════

/**
 * Resource type for document access policies.
 * Used as the resource identifier in policy evaluations.
 */
export const DOCUMENT_ACCESS_RESOURCE_TYPE = "document";

/**
 * Document action constants for policy evaluation.
 */
export const DocumentAction = {
  READ: "document:read",
  WRITE: "document:write",
  SHARE: "document:share",
  DELETE: "document:delete",
  ARCHIVE: "document:archive",
} as const;

/**
 * All document actions in a single array for iteration.
 */
export const ALL_DOCUMENT_ACTIONS = Object.values(DocumentAction);

// ════════════════════════════════════════════════════════════════
// Default Policy IDs
// ════════════════════════════════════════════════════════════════

const POLICY_OWNER_ACCESS = "doc-policy-owner-access";
const POLICY_SHARED_ACCESS = "doc-policy-shared-access";
const POLICY_CAREGIVER_ACCESS = "doc-policy-caregiver-access";
const POLICY_EMERGENCY_ACCESS = "doc-policy-emergency-access";

// ════════════════════════════════════════════════════════════════
// Policy Registration Helper
// ════════════════════════════════════════════════════════════════

/**
 * Create the default document access policies.
 * These are registered with the Policy Engine at startup.
 *
 * Default policies:
 * 1. Owner Access: Document owner always has full access.
 * 2. Shared Access: Shared documents require consent (DOCUMENT_SHARING).
 * 3. Caregiver Access: Caregivers require delegation (DELEGATED_CAREGIVER).
 * 4. Emergency Access: Break-glass with audit trail.
 */
export function createDefaultDocumentPolicies(): Policy[] {
  const now = new Date().toISOString();

  return [
    {
      id: POLICY_OWNER_ACCESS,
      name: "Document Owner Access",
      description: "Document owner always has full access to their documents",
      category: PolicyCategory.RBAC,
      version: 1,
      enabled: true,
      failClosed: false, // Owner should never be locked out
      precedence: 100,   // Highest precedence
      content: {
        rules: [
          {
            id: "owner-read",
            name: "Owner can read",
            action: "document:read",
            resource: "document:*",
            effect: "allow",
            conditions: [],
            precedence: 100,
          },
          {
            id: "owner-write",
            name: "Owner can write",
            action: "document:write",
            resource: "document:*",
            effect: "allow",
            conditions: [],
            precedence: 100,
          },
          {
            id: "owner-share",
            name: "Owner can share",
            action: "document:share",
            resource: "document:*",
            effect: "allow",
            conditions: [],
            precedence: 100,
          },
          {
            id: "owner-delete",
            name: "Owner can delete",
            action: "document:delete",
            resource: "document:*",
            effect: "allow",
            conditions: [],
            precedence: 100,
          },
          {
            id: "owner-archive",
            name: "Owner can archive",
            action: "document:archive",
            resource: "document:*",
            effect: "allow",
            conditions: [],
            precedence: 100,
          },
        ],
      },
      metadata: {
        description: "Default owner access policy for documents",
        scope: "owner_only",
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: POLICY_SHARED_ACCESS,
      name: "Document Shared Access",
      description: "Shared document access requires DOCUMENT_SHARING consent",
      category: PolicyCategory.ABAC,
      version: 1,
      enabled: true,
      failClosed: true,    // No consent = deny
      precedence: 50,
      content: {
        rules: [
          {
            id: "shared-read",
            name: "Shared read requires consent",
            action: "document:read",
            resource: "document:shared",
            effect: "allow",
            conditions: [
              {
                id: "has-sharing-consent",
                type: "consent",
                attribute: "consent.document_sharing",
                operator: "eq",
                value: true,
                weight: 1.0,
              },
            ],
            precedence: 50,
          },
        ],
        purposeConstraints: [
          {
            id: "shared-purpose",
            name: "Shared access purpose",
            purposes: ["treatment", "care_coordination", "document_sharing"],
            requiresConsent: true,
            consentTypes: ["document_sharing" as any],
            action: "allow",
          },
        ],
      },
      metadata: {
        description: "Shared document access requires active consent",
        consentType: "document_sharing",
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: POLICY_CAREGIVER_ACCESS,
      name: "Document Caregiver Access",
      description: "Caregiver document access requires delegation",
      category: PolicyCategory.REBAC,
      version: 1,
      enabled: true,
      failClosed: true,    // No delegation = deny
      precedence: 40,
      content: {
        rules: [
          {
            id: "caregiver-read",
            name: "Caregiver read requires delegation",
            action: "document:read",
            resource: "document:caregiver",
            effect: "allow",
            conditions: [
              {
                id: "has-delegation",
                type: "consent",
                attribute: "delegation.active",
                operator: "eq",
                value: true,
                weight: 1.0,
              },
            ],
            precedence: 40,
          },
        ],
      },
      metadata: {
        description: "Caregiver document access requires valid delegation",
        delegationType: "delegated_caregiver",
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: POLICY_EMERGENCY_ACCESS,
      name: "Document Emergency Access",
      description: "Emergency break-glass access to documents with audit trail",
      category: PolicyCategory.EMERGENCY,
      version: 1,
      enabled: true,
      failClosed: true,
      precedence: 30,
      content: {
        emergencyRules: [
          {
            id: "break-glass",
            name: "Emergency document access",
            breakGlassCode: "EMERGENCY-DOC-ACCESS",
            allowedActions: ["document:read", "document:write"],
            maxDurationMinutes: 60,
            requiresApproval: true,
            approvalChain: ["admin", "supervisor"],
            auditRequired: true,
          },
        ],
      },
      metadata: {
        description: "Emergency break-glass access for critical document access",
        emergencyType: "break_glass",
      },
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// ════════════════════════════════════════════════════════════════
// Document Policy Integration
// ════════════════════════════════════════════════════════════════

/**
 * Document Policy Integration — bridges document authorization
 * to the Policy Engine.
 *
 * All document access is evaluated against registered policies
 * before being allowed. Fail-closed: if no policy matches or
 * evaluation errors occur, access is denied.
 */
export class DocumentPolicyIntegration {
  private readonly policyEngine: PolicyEngine;

  constructor(policyEngine: PolicyEngine) {
    this.policyEngine = policyEngine;
  }

  /**
   * Evaluate whether an identity can perform an action on a document.
   *
   * @param identityId - Identity requesting access
   * @param documentId - Document being accessed
   * @param action - Action to evaluate (document:read, document:write, etc.)
   * @param context - Evaluation context (time, location, device, risk, etc.)
   * @returns Policy evaluation result
   */
  async evaluateDocumentAccess(
    identityId: string,
    documentId: string,
    action: string,
    context?: EvaluationContext,
  ): Promise<PolicyEvaluationResult> {
    try {
      const result = await this.policyEngine.evaluate({
        identityId,
        identityType: "patient", // Default — overridden by context if needed
        action,
        resource: `${DOCUMENT_ACCESS_RESOURCE_TYPE}:${documentId}`,
        context: {
          time: new Date().toISOString(),
          ...(context ?? {}),
        },
        policyCategories: [
          PolicyCategory.RBAC,
          PolicyCategory.ABAC,
          PolicyCategory.REBAC,
          PolicyCategory.TIME,
          PolicyCategory.RISK,
          PolicyCategory.PURPOSE_OF_USE,
          PolicyCategory.EMERGENCY,
        ],
      });

      return result;
    } catch (error) {
      // Fail-closed: evaluation error = deny
      throw new DocumentServiceError(
        `Policy evaluation failed for document access: ${error instanceof Error ? error.message : "Unknown error"}`,
        "POLICY_EVALUATION_FAILED",
        500,
        { identityId, documentId, action },
      );
    }
  }

  /**
   * Register the default document policies with the Policy Engine.
   * Called during service initialization.
   *
   * @returns Array of registered policy IDs
   */
  async registerDocumentPolicies(): Promise<string[]> {
    try {
      const policies = createDefaultDocumentPolicies();
      const policyIds: string[] = [];

      for (const policy of policies) {
        this.policyEngine.register(policy);
        policyIds.push(policy.id);
      }

      return policyIds;
    } catch (error) {
      throw new DocumentServiceError(
        `Failed to register document policies: ${error instanceof Error ? error.message : "Unknown error"}`,
        "POLICY_REGISTRATION_FAILED",
        500,
      );
    }
  }

  /**
   * Get the evaluation result for a specific policy evaluation.
   *
   * @param policyId - Policy identifier
   * @returns Policy evaluation result or null if not found
   */
  async getDocumentPolicyEvaluation(
    policyId: string,
  ): Promise<Policy | null> {
    try {
      const policy = this.policyEngine.getPolicy(policyId);
      return policy ?? null;
    } catch (error) {
      throw new DocumentServiceError(
        `Failed to get policy evaluation: ${error instanceof Error ? error.message : "Unknown error"}`,
        "POLICY_QUERY_FAILED",
        500,
      );
    }
  }
}