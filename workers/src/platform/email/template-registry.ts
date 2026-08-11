// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Email Template Registry                          │
// │ Maps template names to their renderers.                       │
// │ Wave 1 — EPIC-016 Email Infrastructure v1                     │
// └─────────────────────────────────────────────────────────────┘

import { renderVerificationEmail } from "./templates/verification.js";
import { renderPasswordResetEmail } from "./templates/password-reset.js";
import { renderConsultationConfirmation } from "./templates/consultation-confirmation.js";
import { renderAppointmentConfirmation } from "./templates/appointment-confirmation.js";
import { renderDocumentUploadConfirmation } from "./templates/document-upload.js";
import { renderNotification } from "./templates/notification.js";

export type TemplateName = "verification" | "password-reset" | "consultation-confirmation" | "appointment-confirmation" | "document-upload" | "notification";

export interface TemplateContext {
  verificationUrl?: string;
  resetUrl?: string;
  patientName: string;
  date?: string;
  time?: string;
  doctor?: string;
  type?: string;
  documentType?: string;
  message?: string;
  [key: string]: string | undefined;
}

export function renderTemplate(name: TemplateName, ctx: TemplateContext): { html: string; text: string; subject: string } {
  switch (name) {
    case "verification":
      return renderVerificationEmail(ctx.verificationUrl ?? "", ctx.patientName);
    case "password-reset":
      return renderPasswordResetEmail(ctx.resetUrl ?? "", ctx.patientName);
    case "consultation-confirmation":
      return renderConsultationConfirmation({ date: ctx.date ?? "", time: ctx.time ?? "", doctor: ctx.doctor ?? "", patientName: ctx.patientName });
    case "appointment-confirmation":
      return renderAppointmentConfirmation({ date: ctx.date ?? "", time: ctx.time ?? "", type: ctx.type ?? "", patientName: ctx.patientName });
    case "document-upload":
      return renderDocumentUploadConfirmation(ctx.patientName, ctx.documentType ?? "medical");
    case "notification":
      return renderNotification(ctx.patientName, ctx.message ?? "");
    default:
      throw new Error(`Unknown template: ${name}`);
  }
}
