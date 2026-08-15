// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Contact Form Route Handler            │
// │ Workstream D: Business Activation                           │
// └─────────────────────────────────────────────────────────────┘
//
// POST /api/v1/contact
//
// Stores contact form submissions (name, email, phone, message)
// to D1 database. Sends notification to configured support recipients.
// Returns a 201 on success.
//
// Architecture: Request → Route → D1 → Email → Response

import type { Env, RouteHandler } from "../types/env.js";
import { EmailService } from "../platform/email/email-service.js";
import { ResendProvider } from "../platform/email/resend-provider.js";
import { SendGridProvider } from "../platform/email/providers/sendgrid-provider.js";

interface ContactBody {
  name: string;
  email: string;
  phone: string;
  message?: string;
}

function isContactBody(obj: unknown): obj is ContactBody {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.name === "string" &&
    o.name.length >= 1 &&
    typeof o.email === "string" &&
    o.email.length >= 1 &&
    typeof o.phone === "string" &&
    o.phone.length >= 1
  );
}

function buildEmailService(env: Env): EmailService | undefined {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    const resendProvider = new ResendProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
    const routing = {
      default: resendProvider,
      routes: {
        "support@agsynergy.ca": new SendGridProvider(env.SENDGRID_API_KEY ?? "", "support@agsynergy.ca"),
      },
    };
    return new EmailService(routing);
  }
  return undefined;
}

function parseRecipients(envValue?: string): string[] {
  if (!envValue) return [];
  return envValue
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.includes("@"));
}

export const handleContact: RouteHandler = async (request, env, _params) => {
  // ── Parse JSON body ────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: "validation_error",
        message: "Request body must be valid JSON",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // ── Validate required fields ───────────────────────────────
  if (!isContactBody(body)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "validation_error",
        message: "Required fields: name, email, phone. All must be non-empty strings.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { name, email, phone, message } = body;

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "validation_error",
        message: "Invalid email format.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // ── Store in D1 ────────────────────────────────────────────
  let submissionId: number | null = null;
  try {
    const result = await env.DB.prepare(
      `INSERT INTO contact_submissions (name, email, phone, message, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    )
      .bind(name, email, phone, message || null)
      .run();

    submissionId = result.meta?.last_row_id ?? null;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: "server_error",
        message: "Failed to store submission. Please try again later.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // ── Send notification email to support recipients ──────────
  const emailService = buildEmailService(env);
  if (emailService) {
    const supportRecipients = parseRecipients(env.EMAIL_SUPPORT_TO);
    const operationsRecipients = parseRecipients(env.EMAIL_OPERATIONS_TO);
    const allRecipients = [...new Set([...supportRecipients, ...operationsRecipients])];
    
    if (allRecipients.length > 0) {
      const subject = `New Contact Form Submission #${submissionId}`;
      const html = `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1>New Contact Form Submission</h1>
        <p><strong>Submission ID:</strong> ${submissionId}</p>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Message:</strong></p>
        <p>${message || "(no message)"}</p>
        <hr>
        <p style="font-size: 12px; color: #666;">This is an automated notification from the AG Synergy contact form.</p>
      </body></html>`;
      const text = `New Contact Form Submission #${submissionId}\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nMessage: ${message || "(no message)"}\n\n---\nAutomated notification from AG Synergy contact form.`;

      try {
        const result = await emailService.sendEmail({
          from: "support@agsynergy.ca",
          to: allRecipients,
          subject,
          html,
          text,
          templateName: "contact-notification",
          referenceId: `contact-${submissionId}`,
        });
        
        if (!result.success) {
          console.warn(`Contact form email delivery failed: ${result.error}`);
        }
      } catch (err) {
        console.warn(`Contact form email exception: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      id: submissionId,
      message: "Thank you! Your message has been received. We will be in touch soon.",
    }),
    {
      status: 201,
      headers: { "Content-Type": "application/json" },
    },
  );
};