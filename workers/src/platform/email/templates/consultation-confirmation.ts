// ┌─────────────────────────────────────────────────────────────┐
// │ Consultation Confirmation Email Template                       │
// └─────────────────────────────────────────────────────────────┘

export function renderConsultationConfirmation(details: { date: string; time: string; doctor: string; patientName: string }): { html: string; text: string; subject: string } {
  const subject = "Your consultation is confirmed";
  const html = `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Consultation Confirmed</h1>
    <p>Hello ${details.patientName},</p>
    <p>Your consultation has been confirmed:</p>
    <ul>
      <li><strong>Date:</strong> ${details.date}</li>
      <li><strong>Time:</strong> ${details.time}</li>
      <li><strong>Doctor:</strong> ${details.doctor}</li>
    </ul>
    <p>We look forward to seeing you.</p>
  </body></html>`;
  const text = `Hello ${details.patientName},\n\nYour consultation has been confirmed:\nDate: ${details.date}\nTime: ${details.time}\nDoctor: ${details.doctor}\n\nWe look forward to seeing you.`;
  return { html, text, subject };
}
