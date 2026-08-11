// ┌─────────────────────────────────────────────────────────────┐
// │ Password Reset Email Template                                  │
// └─────────────────────────────────────────────────────────────┘

export function renderPasswordResetEmail(resetUrl: string, patientName: string): { html: string; text: string; subject: string } {
  const subject = "Reset your AG Synergy password";
  const html = `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Password Reset</h1>
    <p>Hello ${patientName},</p>
    <p>Click the link below to reset your password:</p>
    <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a>
    <p>This link expires in 1 hour.</p>
    <p>If you did not request a password reset, please ignore this email.</p>
  </body></html>`;
  const text = `Hello ${patientName},\n\nClick the link below to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you did not request a password reset, please ignore this email.`;
  return { html, text, subject };
}
