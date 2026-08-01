// Document Centre utilities.
// Wave 5 — AG Synergy Document Centre.

export { DOCUMENT_CATEGORIES } from './document-categories';
export type { DocumentCategoryId, DocumentCategory } from './document-categories';

export {
  DocumentStatus,
  statusLabel,
  statusColor,
} from './document-status';

export {
  fetchDocuments,
  fetchDocument,
  initiateUpload,
  uploadToPresignedUrl,
  downloadDocument,
  getPreviewUrl,
  shareDocument,
  revokeShare,
  fetchAuditTrail,
  invalidateDocumentCache,
  type DocumentListItem,
  type DocumentDetail,
  type AuditEntry,
  type UploadProgress,
} from './document-api';
