// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Resend Email Provider                          │
// │ Concrete implementation of EmailProvider using Resend.       │
// │ Wave 1 — EPIC-016 Email Infrastructure v1                     │
// └─────────────────────────────────────────────────────────────┘

import { EmailProvider, SendResult, ProviderHealth } from "./email-provider.js";

export class ResendProvider implements EmailProvider {
  readonly name = "resend";
  private readonly apiKey: string;
  private readonly fromAddress: string;

  constructor(apiKey: string, fromAddress: string) {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
  }

  async sendEmail(to: string | string[], subject: string, html: string, text: string): Promise<SendResult> {
    const startTime = Date.now();
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text,
        }),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorBody = await response.text();
        return { success: false, error: errorBody, providerLatencyMs: latency };
      }

      const data = await response.json() as { id: string };
      return { success: true, messageId: data.id, providerLatencyMs: latency };
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
      const response = await fetch("https://api.resend.com/v1/emails", {
        headers: { "Authorization": `Bearer ${this.apiKey}` },
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
