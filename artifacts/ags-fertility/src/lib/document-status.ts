// Document status tracking for the Document Centre.
// Documents move through a lifecycle from required to complete.

export enum DocumentStatus {
  REQUIRED = "required",
  UPLOADED = "uploaded",
  MISSING = "missing",
  EXPIRING = "expiring",
  EXPIRED = "expired",
  PENDING_REVIEW = "pending-review",
  REJECTED = "rejected",
}

export function statusLabel(status: DocumentStatus): string {
  switch (status) {
    case DocumentStatus.REQUIRED:
      return "Required";
    case DocumentStatus.UPLOADED:
      return "Uploaded";
    case DocumentStatus.MISSING:
      return "Missing";
    case DocumentStatus.EXPIRING:
      return "Expiring Soon";
    case DocumentStatus.EXPIRED:
      return "Expired";
    case DocumentStatus.PENDING_REVIEW:
      return "Pending Review";
    case DocumentStatus.REJECTED:
      return "Rejected";
    default:
      return status;
  }
}

export function statusColor(status: DocumentStatus): string {
  switch (status) {
    case DocumentStatus.REQUIRED:
      return "warning";
    case DocumentStatus.UPLOADED:
      return "success";
    case DocumentStatus.MISSING:
      return "error";
    case DocumentStatus.EXPIRING:
      return "warning";
    case DocumentStatus.EXPIRED:
      return "error";
    case DocumentStatus.PENDING_REVIEW:
      return "info";
    case DocumentStatus.REJECTED:
      return "error";
    default:
      return "default";
  }
}
