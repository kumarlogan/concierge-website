// ┌─────────────────────────────────────────────────────────────┐
// │ Generic Notification Email Template                            │
// └─────────────────────────────────────────────────────────────┘

export function renderNotification(patientName: string, message: string): { html: string; text: string; subject: string } {
  const subject = "AG Synergy — Notification";
  const html = `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Notification</h1>
    <p>Hello ${patientName},</p>
    <p>${message}</p>
  </body></html>`;
  const text = `Hello ${patientName},\n\n${message}`;
  return { html, text, subject };
}
