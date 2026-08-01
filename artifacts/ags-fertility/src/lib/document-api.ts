// Document Centre API client.
// Communicates with the existing document upload/download APIs.

import { queryClient } from "@tanstack/react-query";

const API_BASE = "/api/v1";

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
  const response = await fetch(`${API_BASE}/documents`, {
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
  const response = await fetch(`${API_BASE}/documents/${id}`, {
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
  const response = await fetch(`${API_BASE}/documents/upload`, {
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
  const response = await fetch(uploadUrl, {
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
 * Download a document by ID.
 */
export async function downloadDocument(id: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/documents/${id}/download`, {
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
  const response = await fetch(`${API_BASE}/documents/${id}/preview`, {
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
  const response = await fetch(`${API_BASE}/documents/${documentId}/share`, {
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
  const response = await fetch(
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
  const response = await fetch(`${API_BASE}/documents/${id}/audit`, {
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
