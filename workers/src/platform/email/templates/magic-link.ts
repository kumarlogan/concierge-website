// ┌─────────────────────────────────────────────────────────────┐
// │ Magic Link Email Template                                      │
// └─────────────────────────────────────────────────────────────┘

export function renderMagicLinkEmail(magicLinkUrl: string, patientName: string): { html: string; text: string; subject: string } {
  const subject = "Your AG Synergy Sign-In Link";
  const html = `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>AG Synergy — Secure Sign-In Link</h1>
    <p>Hello ${patientName},</p>
    <p>You requested a secure sign-in link for your AG Synergy patient account.</p>
    <p>Click the button below to sign in:</p>
    <a href="${magicLinkUrl}" style="display: inline-block; padding: 14px 28px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Sign In to AG Synergy</a>
    <p style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 6px; font-size: 14px; color: #475569;">
      <strong>Security details:</strong><br>
      • This link expires in <strong>15 minutes</strong><br>
      • This link can only be used <strong>once</strong><br>
      • If you did not request this sign-in link, please ignore this email — no action is needed
    </p>
    <hr style="margin: 24px 0; border: none; border-top: 1px solid #e2e8f0;">
    <p style="font-size: 12px; color: #94a3b8;">This email was sent by AG Synergy. If you have questions, contact support@agsynergy.ca</p>
  </body></html>`;
  const text = `Hello ${patientName},\n\nYou requested a secure sign-in link for your AG Synergy patient account.\n\nClick the link below to sign in:\n${magicLinkUrl}\n\nSecurity details:\n• This link expires in 15 minutes\n• This link can only be used once\n• If you did not request this sign-in link, please ignore this email — no action is needed\n\n---\nThis email was sent by AG Synergy. If you have questions, contact support@agsynergy.ca`;
  return { html, text, subject };
}