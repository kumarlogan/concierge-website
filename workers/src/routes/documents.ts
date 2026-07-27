// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Secure Document Upload APIs                     │
// │ REST API handlers for the Secure Document Upload module.     │
// │ Product-agnostic endpoints consumed by Concierge             │
// │ and all future AGS products.                                │
// │ Phase 2 — Wave 6: Secure Document Upload & Consent Runtime   │
// │ Wave 8.1 — Production Hardening: JWT auth on all endpoints   │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: API handlers pass PHI through opaque IDs only.
// Document payloads traverse R2 pre-signed URLs, never inline.
// Document metadata in JSON responses contains NO PHI payloads.

import type { Env } from "../types/env.js";
import type { Router } from "../router/index.js";
import type {
  DocumentCreateRequest,
  DocumentUploadResponse,
  DocumentDownloadResponse,
  DocumentAccessLog,
  DocumentShareRecord,
  DocumentMetadata,
} from "../platform/documents/types.js";
import { DocumentServiceError } from "../platform/documents/types.js";
import { getIdentityId, withJwtAuth } from "../middleware/jwt-auth.js";

// ════════════════════════════════════════════════
// Document Registration API
// ════════════════════════════════════════════════

export async function documentCreate(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const body = await request.json<DocumentCreateRequest>();

  if (!body.fileName || !body.mimeType || !body.category) {
    return jsonResponse(
      { error: "fileName, mimeType, and category are required" },
      400,
    );
  }

  try {
    const result = await env.DOCUMENT_SERVICE.createDocument(body);

    return jsonResponse(result, 201);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

// ════════════════════════════════════════════════
// Document Upload API
// ════════════════════════════════════════════════

export async function documentUpload(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const documentId = params.documentId;
  if (!documentId) {
    return jsonResponse({ error: "documentId is required" }, 400);
  }

  try {
    const contentType = request.headers.get("content-type") || "application/octet-stream";
    const buffer = await request.arrayBuffer();

    const result = await env.DOCUMENT_SERVICE.uploadDocument(
      documentId,
      buffer,
      contentType,
    );

    return jsonResponse(result);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

// ════════════════════════════════════════════════
// Document Read API
// ════════════════════════════════════════════════

export async function documentGet(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const documentId = params.documentId;
  const identityId = getIdentityId(request);

  if (!documentId) {
    return jsonResponse({ error: "documentId is required" }, 400);
  }

  try {
    const result = await env.DOCUMENT_SERVICE.getDocument(documentId, identityId);
    return jsonResponse(result);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

// ════════════════════════════════════════════════
// Document Download API (pre-signed URL)
// ════════════════════════════════════════════════

export async function documentDownload(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const documentId = params.documentId;
  const identityId = getIdentityId(request);

  if (!documentId) {
    return jsonResponse({ error: "documentId is required" }, 400);
  }

  try {
    const result = await env.DOCUMENT_SERVICE.downloadDocument(documentId, identityId);
    return jsonResponse(result);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

// ════════════════════════════════════════════════
// Document List API
// ════════════════════════════════════════════════

export async function documentList(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const identityId = getIdentityId(request);
  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const filters: Record<string, unknown> = { limit, offset };
  if (category) filters.category = category;
  if (status) filters.status = status;

  try {
    const result = await env.DOCUMENT_SERVICE.listDocuments(identityId, filters);
    return jsonResponse(result);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

// ════════════════════════════════════════════════
// Document Share API
// ════════════════════════════════════════════════

export async function documentShare(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const documentId = params.documentId;
  const body = await request.json<{
    delegateeId: string;
    accessLevel?: string;
    expiresAt?: string;
    purposeOfUse?: string;
  }>();

  const identityId = getIdentityId(request);

  if (!documentId) {
    return jsonResponse({ error: "documentId is required" }, 400);
  }
  if (!body.delegateeId) {
    return jsonResponse({ error: "delegateeId is required" }, 400);
  }

  try {
    const result = await env.DOCUMENT_SERVICE.shareDocument(
      documentId,
      identityId,
      body.delegateeId,
      body.accessLevel ?? "read",
      body.expiresAt,
      body.purposeOfUse,
    );

    return jsonResponse(result, 201);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

// ════════════════════════════════════════════════
// Document Share Revoke API
// ════════════════════════════════════════════════

export async function documentRevokeShare(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const documentId = params.documentId;
  const shareId = params.shareId;
  const body = await request.json<{ reason?: string }>();

  const identityId = getIdentityId(request);

  if (!documentId || !shareId) {
    return jsonResponse({ error: "documentId and shareId are required" }, 400);
  }

  try {
    const result = await env.DOCUMENT_SERVICE.revokeShare(
      documentId,
      shareId,
      identityId,
      body.reason,
    );

    return jsonResponse(result);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

// ════════════════════════════════════════════════
// Shared Documents API
// ════════════════════════════════════════════════

export async function documentSharedWithMe(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);

  try {
    const result = await env.DOCUMENT_SERVICE.getSharedDocuments(identityId);
    return jsonResponse(result);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

// ════════════════════════════════════════════════
// Document Delete API (soft delete)
// ════════════════════════════════════════════════

export async function documentDelete(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const documentId = params.documentId;
  const identityId = getIdentityId(request);

  if (!documentId) {
    return jsonResponse({ error: "documentId is required" }, 400);
  }

  try {
    const result = await env.DOCUMENT_SERVICE.deleteDocument(documentId, identityId);
    return jsonResponse(result);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

// ════════════════════════════════════════════════
// Document Archive API
// ════════════════════════════════════════════════

export async function documentArchive(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const documentId = params.documentId;
  const identityId = getIdentityId(request);

  if (!documentId) {
    return jsonResponse({ error: "documentId is required" }, 400);
  }

  try {
    const result = await env.DOCUMENT_SERVICE.archiveDocument(documentId, identityId);
    return jsonResponse(result);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

// ════════════════════════════════════════════════
// Document Access Log API
// ════════════════════════════════════════════════

export async function documentAccessLog(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const documentId = params.documentId;
  const identityId = getIdentityId(request);

  if (!documentId) {
    return jsonResponse({ error: "documentId is required" }, 400);
  }

  try {
    const result = await env.DOCUMENT_SERVICE.getDocumentAccessLog(documentId, identityId);
    return jsonResponse(result);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

// ════════════════════════════════════════════════
// Document Integrity Verification API
// ════════════════════════════════════════════════

export async function documentVerifyIntegrity(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const documentId = params.documentId;
  const identityId = getIdentityId(request);

  if (!documentId) {
    return jsonResponse({ error: "documentId is required" }, 400);
  }

  try {
    const result = await env.DOCUMENT_SERVICE.verifyDocumentIntegrity(documentId, identityId);
    return jsonResponse(result);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

// ════════════════════════════════════════════════
// Caregiver Authorization API
// ════════════════════════════════════════════════

export async function caregiverAuthorize(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const body = await request.json<{
    caregiverId: string;
    documentIds?: string[];
    categories?: string[];
    accessLevel?: string;
    expiresAt: string;
    purposeOfUse?: string;
  }>();

  const identityId = getIdentityId(request);

  if (!body.caregiverId) {
    return jsonResponse({ error: "caregiverId is required" }, 400);
  }
  if (!body.expiresAt) {
    return jsonResponse({ error: "expiresAt is required" }, 400);
  }

  try {
    const result = await env.DOCUMENT_CONSENT_INTEGRATION.createDelegatedConsent(
      identityId,
      body.caregiverId,
      body.documentIds ?? [],
      body.accessLevel ?? "read",
      body.expiresAt,
      body.purposeOfUse,
    );

    return jsonResponse(result, 201);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

export async function caregiverRevoke(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const body = await request.json<{ delegationId: string; reason?: string }>();

  const identityId = getIdentityId(request);

  if (!body.delegationId) {
    return jsonResponse({ error: "delegationId is required" }, 400);
  }

  try {
    const result = await env.DOCUMENT_CONSENT_INTEGRATION.revokeDelegatedConsent(
      body.delegationId,
      identityId,
      body.reason,
    );

    return jsonResponse(result);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

export async function caregiverDocuments(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);

  try {
    const result = await env.DOCUMENT_CONSENT_INTEGRATION.getCaregiverDocuments(identityId);
    return jsonResponse(result);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

export async function caregiverAuthorizations(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);

  try {
    const result = await env.DOCUMENT_CONSENT_INTEGRATION.getCaregiverAuthorizations(identityId);
    return jsonResponse(result);
  } catch (err) {
    if (err instanceof DocumentServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    throw err;
  }
}

// ════════════════════════════════════════════════
// API Registration
// ════════════════════════════════════════════════

export function registerDocumentRoutes(router: Router): void {
  // Document CRUD — all JWT-authenticated
  router.post("/api/v1/documents", withJwtAuth(documentCreate));
  router.post("/api/v1/documents/:documentId/upload", withJwtAuth(documentUpload));
  router.get("/api/v1/documents/:documentId", withJwtAuth(documentGet));
  router.get("/api/v1/documents", withJwtAuth(documentList));
  router.delete("/api/v1/documents/:documentId", withJwtAuth(documentDelete));
  router.post("/api/v1/documents/:documentId/archive", withJwtAuth(documentArchive));

  // Document download
  router.get("/api/v1/documents/:documentId/download", withJwtAuth(documentDownload));

  // Document sharing
  router.post("/api/v1/documents/:documentId/share", withJwtAuth(documentShare));
  router.post("/api/v1/documents/:documentId/shares/:shareId/revoke", withJwtAuth(documentRevokeShare));
  router.get("/api/v1/documents/shared-with-me", withJwtAuth(documentSharedWithMe));

  // Document audit
  router.get("/api/v1/documents/:documentId/access-log", withJwtAuth(documentAccessLog));

  // Document integrity
  router.get("/api/v1/documents/:documentId/verify", withJwtAuth(documentVerifyIntegrity));

  // Caregiver authorization
  router.post("/api/v1/caregiver/authorize", withJwtAuth(caregiverAuthorize));
  router.post("/api/v1/caregiver/revoke", withJwtAuth(caregiverRevoke));
  router.get("/api/v1/caregiver/documents", withJwtAuth(caregiverDocuments));
  router.get("/api/v1/caregiver/authorizations", withJwtAuth(caregiverAuthorizations));
}

// ════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  });
}