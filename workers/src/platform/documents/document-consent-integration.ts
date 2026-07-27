// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Document Consent Integration                    │
// │ Wires document operations to the Trust Runtime's             │
// │ Consent and Delegation engines.                              │
// │ Wave 6 — AI Platform Secure Document Upload v1              │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: This module handles consent and delegation checks
// for document access. It references PHI documents by opaque ID
// only — never by content. Consent and delegation metadata are
// stored in the Trust Runtime, separate from PHI.

import type { ConsentEngine } from "../trust/consent-engine.js";
import type { DelegationEngine } from "../trust/delegation-engine.js";
import {
  ConsentType,
  ConsentSource,
  DelegationType,
  DelegationStatus,
} from "../trust/types.js";
import { DocumentConsentError, DocumentServiceError } from "./types.js";

// ════════════════════════════════════════════════════════════════
// Consent Integration Configuration
// ════════════════════════════════════════════════════════════════

/**
 * Configuration for the Document Consent Integration.
 */
export interface DocumentConsentIntegrationConfig {
  /** Consent engine instance from Trust Runtime */
  consentEngine: ConsentEngine;
  /** Delegation engine instance from Trust Runtime */
  delegationEngine: DelegationEngine;
}

// ════════════════════════════════════════════════════════════════
// Document Consent Integration
// ════════════════════════════════════════════════════════════════

/**
 * Document Consent Integration — bridges document operations to
 * the Trust Runtime's Consent and Delegation engines.
 *
 * Fail-closed: if no consent exists, access is denied.
 * Every access check, grant, and revocation is auditable.
 */
export class DocumentConsentIntegration {
  private readonly consentEngine: ConsentEngine;
  private readonly delegationEngine: DelegationEngine;

  constructor(config: DocumentConsentIntegrationConfig) {
    this.consentEngine = config.consentEngine;
    this.delegationEngine = config.delegationEngine;
  }

  // ── checkDocumentAccessConsent ─────────────────────────────

  /**
   * Verify that an identity has consent to access a document.
   * Checks for DOCUMENT_SHARING consent type.
   * Fail-closed: no consent = deny.
   *
   * @param identityId - Identity requesting access
   * @param documentId - Document being accessed
   * @param purposeOfUse - Purpose of the access request
   * @returns True if consent exists and is valid
   * @throws DocumentConsentError if consent is not granted
   */
  async checkDocumentAccessConsent(
    identityId: string,
    documentId: string,
    purposeOfUse?: string,
  ): Promise<boolean> {
    try {
      // Check if the identity has DOCUMENT_SHARING consent for this document
      const history = await this.consentEngine.getHistory({
        identityId,
        consentType: ConsentType.DOCUMENT_SHARING,
        limit: 100,
        offset: 0,
      });

      const hasConsent = history.entries.some((entry) => {
        // Check if consent is granted
        if (!entry.granted) {
          return false;
        }

        // Check if consent scope includes this document
        const scopeMatch = entry.scope.includes(documentId) || entry.scope.includes("*");

        // Check if consent is not expired
        const notExpired = !entry.expiresAt || new Date(entry.expiresAt) > new Date();

        // Check if not revoked
        const notRevoked = !entry.revokedAt;

        // Check purpose match
        const purposeMatch = !purposeOfUse || entry.purpose === purposeOfUse || entry.purpose === "*";

        return scopeMatch && notExpired && notRevoked && purposeMatch;
      });

      if (!hasConsent) {
        throw new DocumentConsentError(
          `No consent granted for identity ${identityId} to access document ${documentId}`,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof DocumentConsentError) {
        throw error;
      }
      throw new DocumentConsentError(
        `Failed to check document access consent: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // ── grantDocumentSharingConsent ────────────────────────────

  /**
   * Grant consent for sharing a document with another identity.
   * Creates a DOCUMENT_SHARING consent record.
   *
   * @param ownerId - Document owner identity
   * @param delegateeId - Identity receiving access
   * @param documentId - Document to share
   * @param scope - Scope of access (e.g., ["read", "write"])
   * @param expiry - ISO 8601 expiry timestamp
   * @returns Consent grant result with consent ID
   */
  async grantDocumentSharingConsent(
    ownerId: string,
    delegateeId: string,
    documentId: string,
    scope: string[],
    expiry: string,
  ): Promise<{ consentId: string; granted: boolean; createdAt: string }> {
    try {
      const result = await this.consentEngine.grant({
        identityId: delegateeId,
        consentType: ConsentType.DOCUMENT_SHARING,
        scope: [documentId, ...scope],
        purpose: `document_sharing:${documentId}`,
        source: ConsentSource.EXPLICIT,
        expiresAt: expiry,
        delegatorId: ownerId,
        metadata: {
          documentId,
          ownerId,
          scope,
        },
      });

      return {
        consentId: result.id,
        granted: result.granted,
        createdAt: result.createdAt,
      };
    } catch (error) {
      throw new DocumentServiceError(
        `Failed to grant document sharing consent: ${error instanceof Error ? error.message : "Unknown error"}`,
        "CONSENT_GRANT_FAILED",
        500,
      );
    }
  }

  // ── revokeDocumentSharingConsent ───────────────────────────

  /**
   * Revoke a previously granted document sharing consent.
   *
   * @param consentId - Consent identifier to revoke
   * @returns Revocation result
   */
  async revokeDocumentSharingConsent(
    consentId: string,
  ): Promise<{ consentId: string; revoked: boolean; revokedAt: string }> {
    try {
      const result = await this.consentEngine.withdraw({
        consentId,
        reason: "Document sharing consent revoked by owner",
        revokedBy: "document_service",
      });

      return {
        consentId: result.consentId,
        revoked: result.revoked,
        revokedAt: result.revokedAt,
      };
    } catch (error) {
      throw new DocumentServiceError(
        `Failed to revoke document sharing consent: ${error instanceof Error ? error.message : "Unknown error"}`,
        "CONSENT_REVOKE_FAILED",
        500,
      );
    }
  }

  // ── getDocumentConsents ───────────────────────────────────

  /**
   * List all consents associated with a document.
   *
   * @param documentId - Document identifier
   * @returns List of consent records
   */
  async getDocumentConsents(
    documentId: string,
  ): Promise<Array<{ identityId: string; consentId: string; scope: string[]; granted: boolean; expiresAt: string | null }>> {
    try {
      // Query all identities that have consents for this document
      // Note: In production, this would use a database query.
      // For now, we return an empty array as the consent engine
      // doesn't support global document-level queries.
      return [];
    } catch (error) {
      throw new DocumentServiceError(
        `Failed to get document consents: ${error instanceof Error ? error.message : "Unknown error"}`,
        "CONSENT_QUERY_FAILED",
        500,
      );
    }
  }

  // ── checkDelegatedAccess ──────────────────────────────────

  /**
   * Check if a delegatee has access to a document through a
   * delegation chain.
   *
   * Fail-closed: if no valid delegation exists, access is denied.
   *
   * @param delegateeId - Identity acting on behalf of another
   * @param documentId - Document being accessed
   * @param action - Action being performed (read, write, share, etc.)
   * @returns True if delegated access is valid
   * @throws DocumentConsentError if delegation is not valid
   */
  async checkDelegatedAccess(
    delegateeId: string,
    documentId: string,
    action: string,
  ): Promise<boolean> {
    try {
      // Check if there's an active delegation for this delegatee
      const delegations = this.delegationEngine.getActiveDelegations(delegateeId);

      const validDelegation = delegations.some((delegation) => {
        // Check scope includes this document
        const scopeMatch = delegation.scope.includes(documentId) || delegation.scope.includes("*");

        // Check not expired (already filtered by getActiveDelegations)
        const notExpired = !delegation.expiresAt || new Date(delegation.expiresAt) > new Date();

        // Check not revoked (already filtered by getActiveDelegations)
        const notRevoked = !delegation.revokedAt;

        return scopeMatch && notExpired && notRevoked;
      });

      if (!validDelegation) {
        throw new DocumentConsentError(
          `No valid delegation for identity ${delegateeId} to access document ${documentId}`,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof DocumentConsentError) {
        throw error;
      }
      throw new DocumentConsentError(
        `Failed to check delegated access: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // ── createDelegatedConsent ────────────────────────────────

  /**
   * Create a caregiver delegation for document access.
   * Uses DELEGATED_CAREGIVER delegation type.
   *
   * @param ownerId - Patient identity (document owner)
   * @param caregiverId - Caregiver identity receiving access
   * @param documentIds - Documents to grant access to
   * @param scope - Access scope (e.g., ["read", "write"])
   * @param expiry - ISO 8601 expiry timestamp
   * @returns Delegation creation result
   */
  async createDelegatedConsent(
    ownerId: string,
    caregiverId: string,
    documentIds: string[],
    scope: string[],
    expiry: string,
  ): Promise<{ delegationId: string; createdAt: string }> {
    try {
      const delegation = await this.delegationEngine.create({
        delegatorId: ownerId,
        delegateeId: caregiverId,
        scope: [...documentIds, ...scope],
        type: DelegationType.PATIENT_TO_FAMILY,
        expiresAt: expiry,
        maxPrivilege: "limited",
        constraints: {
          purposeOfUse: "caregiver_access",
          maxDurationMinutes: 24 * 60, // 24 hours default
        },
        auditTag: `document_caregiver:${ownerId}`,
        metadata: {
          documentIds,
          scope,
          consentType: ConsentType.DELEGATED_CAREGIVER,
        },
      });

      return {
        delegationId: delegation.id,
        createdAt: delegation.createdAt,
      };
    } catch (error) {
      throw new DocumentServiceError(
        `Failed to create delegated consent: ${error instanceof Error ? error.message : "Unknown error"}`,
        "DELEGATION_CREATE_FAILED",
        500,
      );
    }
  }

  // ── revokeDelegatedConsent ────────────────────────────────

  /**
   * Revoke a caregiver delegation.
   *
   * @param delegationId - Delegation identifier to revoke
   * @returns Revocation result
   */
  async revokeDelegatedConsent(
    delegationId: string,
  ): Promise<{ delegationId: string; revoked: boolean; revokedAt: string }> {
    try {
      const result = await this.delegationEngine.revoke({
        delegationId,
        revokedBy: "document_service",
        reason: "Caregiver delegation revoked by patient",
      });

      return {
        delegationId: delegationId,
        revoked: result.revoked,
        revokedAt: result.revokedAt,
      };
    } catch (error) {
      throw new DocumentServiceError(
        `Failed to revoke delegated consent: ${error instanceof Error ? error.message : "Unknown error"}`,
        "DELEGATION_REVOKE_FAILED",
        500,
      );
    }
  }

  // ── getCaregiverDocuments ─────────────────────────────────

  /**
   * List documents accessible by a caregiver through delegation.
   *
   * @param caregiverId - Caregiver identity
   * @returns List of document IDs accessible via delegation
   */
  async getCaregiverDocuments(caregiverId: string): Promise<string[]> {
    try {
      const delegations = this.delegationEngine.getActiveDelegations(caregiverId);

      const documentIds: string[] = [];

      for (const delegation of delegations) {
        // Extract document IDs from delegation scope
        const scope = delegation.scope ?? [];
        for (const item of scope) {
          // Scope items that look like document UUIDs
          if (item.match(/^[0-9a-f-]{36}$/)) {
            documentIds.push(item);
          }
        }
      }

      // Deduplicate
      return [...new Set(documentIds)];
    } catch (error) {
      throw new DocumentServiceError(
        `Failed to get caregiver documents: ${error instanceof Error ? error.message : "Unknown error"}`,
        "CAREGIVER_DOCUMENTS_FAILED",
        500,
      );
    }
  }

  // ── getCaregiverAuthorizations ────────────────────────────

  /**
   * List active caregiver authorizations for a patient.
   *
   * @param patientId - Patient identity
   * @returns List of active caregiver authorizations
   */
  async getCaregiverAuthorizations(
    patientId: string,
  ): Promise<Array<{
    delegationId: string;
    caregiverId: string;
    scope: string[];
    expiresAt: string;
    createdAt: string;
  }>> {
    try {
      // Access the delegation engine's internal index by delegator
      // Note: In production, this should use a database query.
      const delegationsByDelegator = (this.delegationEngine as any).delegationsByDelegator;
      const delegations: any[] = delegationsByDelegator?.get(patientId) ?? [];

      const authorizations: Array<{
        delegationId: string;
        caregiverId: string;
        scope: string[];
        expiresAt: string;
        createdAt: string;
      }> = [];

      for (const delegation of delegations) {
        if (delegation.revokedAt) {
          continue;
        }
        if (delegation.expiresAt && new Date(delegation.expiresAt) < new Date()) {
          continue;
        }

        authorizations.push({
          delegationId: delegation.id,
          caregiverId: delegation.delegateeId,
          scope: delegation.scope ?? [],
          expiresAt: delegation.expiresAt,
          createdAt: delegation.createdAt,
        });
      }

      return authorizations;
    } catch (error) {
      throw new DocumentServiceError(
        `Failed to get caregiver authorizations: ${error instanceof Error ? error.message : "Unknown error"}`,
        "CAREGIVER_AUTHORIZATIONS_FAILED",
        500,
      );
    }
  }
}