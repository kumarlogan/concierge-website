// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Mailpit Email Provider (Test/QA Only)          │
// │ Concrete implementation of EmailProvider using Mailpit SMTP. │
// │ FOR TEST ENVIRONMENTS ONLY — NEVER USE IN PRODUCTION.       │
// └─────────────────────────────────────────────────────────────┘

import { EmailProvider, SendResult, ProviderHealth } from "../email-provider.js";

export class MailpitProvider implements EmailProvider {
  readonly name = "mailpit";
  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly apiUrl: string;
  private readonly fromAddress: string;

  constructor(
    smtpHost: string = "localhost",
    smtpPort: number = 1025,
    apiUrl: string = "http://localhost:8025",
    fromAddress: string = "test@agsynergy.ca",
  ) {
    this.smtpHost = smtpHost;
    this.smtpPort = smtpPort;
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.fromAddress = fromAddress;
  }

  /**
   * Send email via Mailpit's SMTP endpoint using the Mailpit HTTP API.
   * This uses Mailpit's /api/v1/send endpoint which accepts SMTP-style data.
   */
  async sendEmail(
    to: string | string[],
    subject: string,
    html: string,
    text: string,
  ): Promise<SendResult> {
    const startTime = Date.now();
    const recipients = Array.isArray(to) ? to : [to];

    try {
      // Mailpit's REST API for sending messages
      // POST /api/v1/send with { from, to, subject, text, html }
      const response = await fetch(`${this.apiUrl}/api/v1/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: recipients,
          subject,
          text,
          html,
        }),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          error: `Mailpit API error (${response.status}): ${errorBody}`,
          providerLatencyMs: latency,
        };
      }

      const data = await response.json() as { id?: string; messageId?: string };
      return {
        success: true,
        messageId: data.id ?? data.messageId,
        providerLatencyMs: latency,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        providerLatencyMs: Date.now() - startTime,
      };
    }
  }

  async getProviderHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      // Mailpit health check: GET /api/v1/info
      const response = await fetch(`${this.apiUrl}/api/v1/info`, {
        method: "GET",
      });

      return {
        status: response.ok ? "healthy" : "degraded",
        providerName: this.name,
        lastChecked: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      };
    } catch {
      return {
        status: "unavailable",
        providerName: this.name,
        lastChecked: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get the Mailpit Web UI URL for manual inspection.
   */
  getWebUiUrl(): string {
    return this.apiUrl;
  }

  /**
   * Get the Mailpit API base URL.
   */
  getApiUrl(): string {
    return this.apiUrl;
  }
}

/**
 * Create a MailpitProvider from environment variables.
 * Returns null if Mailpit is not configured (production-safe default).
 * 
 * Environment variables:
 * - MAILPIT_SMTP_HOST (default: localhost)
 * - MAILPIT_SMTP_PORT (default: 1025)
 * - MAILPIT_API_URL (default: http://localhost:8025)
 * - MAILPIT_FROM_ADDRESS (default: test@agsynergy.ca)
 * 
 * All must be explicitly set for the provider to be created.
 * This ensures Mailpit can NEVER be accidentally activated in production.
 */
export function createMailpitProviderFromEnv(env: {
  MAILPIT_SMTP_HOST?: string;
  MAILPIT_SMTP_PORT?: string;
  MAILPIT_API_URL?: string;
  MAILPIT_FROM_ADDRESS?: string;
}): MailpitProvider | null {
  const smtpHost = env.MAILPIT_SMTP_HOST;
  const smtpPort = env.MAILPIT_SMTP_PORT;
  const apiUrl = env.MAILPIT_API_URL;
  const fromAddress = env.MAILPIT_FROM_ADDRESS;

  // Require explicit configuration — if any is missing, return null
  // This is the critical production safety guard
  if (!smtpHost || !smtpPort || !apiUrl || !fromAddress) {
    return null;
  }

  return new MailpitProvider(
    smtpHost,
    parseInt(smtpPort, 10),
    apiUrl,
    fromAddress,
  );
}