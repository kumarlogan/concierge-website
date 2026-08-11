// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — SendGrid Email Provider                        │
// │ Concrete impl of EmailProvider using SendGrid.               │
// │ Phase 2B — EPIC-017 Email Production Activation             │
// │                                                             │
// │ Used exclusively for root-domain sending:                    │
// │   support@agsynergy.ca                                       │
// │ The existing ResendProvider remains for mail.agsynergy.ca.   │
// └─────────────────────────────────────────────────────────────┘

import { EmailProvider, SendResult, ProviderHealth } from "../email-provider.js";

type SgApiKey = string;

export class SendGridProvider implements EmailProvider {
  readonly name = "sendgrid";
  private readonly sKey: SgApiKey;
  private readonly fromAddress: string;

  constructor(sKey: SgApiKey, fromAddress: string) {
    this.sKey = sKey;
    this.fromAddress = fromAddress;
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<SendResult> {
    const startTime = Date.now();
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.sKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }], subject }],
          from: { email: this.fromAddress, name: "AG Synergy" },
          content: [
            { type: "text/plain", value: text },
            { type: "text/html", value: html },
          ],
        }),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          error: errorBody,
          providerLatencyMs: latency,
        };
      }

      // SendGrid returns X-Message-ID header on success
      const messageId = response.headers.get("X-Message-ID") || undefined;
      return {
        success: true,
        messageId,
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
      // SendGrid API: GET /user/profile to verify auth (no side effects)
      const response = await fetch("https://api.sendgrid.com/v3/user/profile", {
        headers: { Authorization: `Bearer ${this.sKey}` },
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
}
