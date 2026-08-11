// ┌─────────────────────────────────────────────────────────────┐
// │ Appointment Confirmation Email Template                        │
// └─────────────────────────────────────────────────────────────┘

export function renderAppointmentConfirmation(details: { date: string; time: string; type: string; patientName: string }): { html: string; text: string; subject: string } {
  const subject = "Your appointment is confirmed";
  const html = `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Appointment Confirmed</h1>
    <p>Hello ${details.patientName},</p>
    <p>Your appointment has been confirmed:</p>
    <ul>
      <li><strong>Date:</strong> ${details.date}</li>
      <li><strong>Time:</strong> ${details.time}</li>
      <li><strong>Type:</strong> ${details.type}</li>
    </ul>
  </body></html>`;
  const text = `Hello ${details.patientName},\n\nYour appointment has been confirmed:\nDate: ${details.date}\nTime: ${details.time}\nType: ${details.type}`;
  return { html, text, subject };
}
