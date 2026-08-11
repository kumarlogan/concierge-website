// ┌─────────────────────────────────────────────────────────────┐
// │ Document Upload Confirmation Email Template                    │
// └─────────────────────────────────────────────────────────────┘

export function renderDocumentUploadConfirmation(patientName: string, documentType: string): { html: string; text: string; subject: string } {
  const subject = "Your documents have been received";
  const html = `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Documents Received</h1>
    <p>Hello ${patientName},</p>
    <p>We have received your <strong>${documentType}</strong> documents.</p>
    <p>Our team will review them and contact you if any additional information is needed.</p>
  </body></html>`;
  const text = `Hello ${patientName},\n\nWe have received your ${documentType} documents.\n\nOur team will review them and contact you if any additional information is needed.`;
  return { html, text, subject };
}
