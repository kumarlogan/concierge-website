// ┌─────────────────────────────────────────────────────────────┐
// │ Verification Email Template                                    │
// └─────────────────────────────────────────────────────────────┘

export function renderVerificationEmail(verificationUrl: string, patientName: string): { html: string; text: string; subject: string } {
  const subject = "Verify your AG Synergy account";
  const html = `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Welcome to AG Synergy</h1>
    <p>Hello ${patientName},</p>
    <p>Please verify your email address by clicking the link below:</p>
    <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a>
    <p>This link expires in 24 hours.</p>
    <p>If you did not create this account, please ignore this email.</p>
  </body></html>`;
  const text = `Hello ${patientName},\n\nPlease verify your email address by visiting: ${verificationUrl}\n\nThis link expires in 24 hours.\n\nIf you did not create this account, please ignore this email.`;
  return { html, text, subject };
}
