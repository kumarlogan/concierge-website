// Document Centre API client.
// Communicates with the existing document upload/download APIs.

import { QueryClient } from "@tanstack/react-query";
import { tokenStore } from "./patient-api";

const queryClient = new QueryClient();

const API_BASE = "/api/v1";

function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = tokenStore.getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

interface DocumentListItem {
  id: string;
  identityId: string;
  patientId: string;
  category: string;
  status: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  expiresAt: string | null;
  version: number;
  phiClassification: string;
}

interface DocumentListResponse {
  documents: DocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
  missingRequired: string[];
}

interface UploadInitResponse {
  uploadUrl: string;
  documentId: string;
  fieldName: string;
}

interface DocumentDetail {
  id: string;
  identityId: string;
  patientId: string;
  category: string;
  status: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  expiresAt: string | null;
  version: number;
  phiClassification: string;
  downloadUrl: string | null;
  previewUrl: string | null;
  shareUrl: string | null;
  auditTrail: AuditEntry[];
}

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details: string;
  ipAddress: string;
}

interface ShareRecord {
  id: string;
  documentId: string;
  sharedWith: string;
  role: string;
  sharedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

interface UploadProgress {
  documentId: string;
  fileName: string;
  progress: number;
  status: "uploading" | "complete" | "error";
  error?: string;
}

/**
 * Fetch the document list for the current patient.
 */
export async function fetchDocuments(): Promise<DocumentListResponse> {
  const response = await authFetch(`${API_BASE}/documents`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch documents: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch a single document by ID.
 */
export async function fetchDocument(id: string): Promise<DocumentDetail> {
  const response = await authFetch(`${API_BASE}/documents/${id}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.status}`);
  }

  return response.json();
}

/**
 * Initiate a file upload and return the pre-signed URL.
 */
export async function initiateUpload(
  category: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
): Promise<UploadInitResponse> {
  const response = await authFetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      category,
      fileName,
      fileSize,
      mimeType,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to initiate upload: ${response.status}`);
  }

  return response.json();
}

/**
 * Upload a file to the pre-signed URL.
 */
export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const response = await authFetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
}

/**
 * Upload a document using the correct two-step flow:
 * Step 1 — POST /documents to create the record.
 * Step 2 — POST /documents/:id/upload to send the raw bytes.
 */
export async function uploadDocument(
  file: File,
  category: string,
  onProgress?: (progress: number) => void,
): Promise<{ id: string; fileName: string; status: string }> {
  onProgress?.(10);

  // Step 1: Create document record
  const createResp = await authFetch(`${API_BASE}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      category,
      fileSize: file.size,
    }),
  });
  if (!createResp.ok) {
    throw new Error(`Failed to create document record: ${createResp.status}`);
  }
  const created = await createResp.json() as { id: string; fileName: string; status: string };
  onProgress?.(40);

  // Step 2: Upload bytes directly to the document endpoint
  const uploadResp = await authFetch(`${API_BASE}/documents/${created.id}/upload`, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploadResp.ok) {
    throw new Error(`Failed to upload document: ${uploadResp.status}`);
  }
  onProgress?.(100);

  return created;
}

/**
 * Download a document by ID.
 */
export async function downloadDocument(id: string): Promise<Blob> {
  const response = await authFetch(`${API_BASE}/documents/${id}/download`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to download document: ${response.status}`);
  }

  return response.blob();
}

/**
 * Get the preview URL for a document.
 */
export async function getPreviewUrl(id: string): Promise<string | null> {
  const response = await authFetch(`${API_BASE}/documents/${id}/preview`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.previewUrl ?? null;
}

/**
 * Share a document with a coordinator or another patient.
 */
export async function shareDocument(
  documentId: string,
  sharedWith: string,
  role: string,
): Promise<ShareRecord> {
  const response = await authFetch(`${API_BASE}/documents/${documentId}/share`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sharedWith, role }),
  });

  if (!response.ok) {
    throw new Error(`Failed to share document: ${response.status}`);
  }

  return response.json();
}

/**
 * Revoke a document share.
 */
export async function revokeShare(documentId: string, shareId: string): Promise<void> {
  const response = await authFetch(
    `${API_BASE}/documents/${documentId}/share/${shareId}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to revoke share: ${response.status}`);
  }
}

/**
 * Get the audit trail for a document.
 */
export async function fetchAuditTrail(id: string): Promise<AuditEntry[]> {
  const response = await authFetch(`${API_BASE}/documents/${id}/audit`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch audit trail: ${response.status}`);
  }

  return response.json();
}

/**
 * Invalidate the document list cache.
 */
export function invalidateDocumentCache(): void {
  queryClient.invalidateQueries({ queryKey: ["documents"] });
}
