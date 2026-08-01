// Document categories supported by the Document Centre.
// Each category maps to a specific document type the patient
// can upload, download, preview, and share.

export const DOCUMENT_CATEGORIES = [
  {
    id: "passport",
    label: "Passport",
    icon: "passport",
    description: "Government-issued identification document",
    required: false,
    expiryTracking: true,
  },
  {
    id: "visa",
    label: "Visa",
    icon: "visa",
    description: "Visa or residence permit documentation",
    required: false,
    expiryTracking: true,
  },
  {
    id: "medical-reports",
    label: "Medical Reports",
    icon: "medical-report",
    description: "Clinical reports and medical summaries",
    required: true,
    expiryTracking: false,
  },
  {
    id: "lab-results",
    label: "Laboratory Results",
    icon: "lab-results",
    description: "Blood work, imaging, and lab test results",
    required: true,
    expiryTracking: false,
  },
  {
    id: "treatment-docs",
    label: "Treatment Documents",
    icon: "treatment-doc",
    description: "Treatment plans, protocols, and procedure records",
    required: true,
    expiryTracking: false,
  },
  {
    id: "consent-forms",
    label: "Consent Forms",
    icon: "consent-form",
    description: "Signed consent and authorization forms",
    required: true,
    expiryTracking: true,
  },
  {
    id: "prescriptions",
    label: "Prescriptions",
    icon: "prescription",
    description: "Medication prescriptions and pharmacy records",
    required: false,
    expiryTracking: true,
  },
  {
    id: "financial-docs",
    label: "Financial Documents",
    icon: "financial-doc",
    description: "Invoices, receipts, insurance documents, and payment records",
    required: false,
    expiryTracking: false,
  },
] as const;

export type DocumentCategoryId = typeof DOCUMENT_CATEGORIES[number]["id"];
export type DocumentCategory = typeof DOCUMENT_CATEGORIES[number];
