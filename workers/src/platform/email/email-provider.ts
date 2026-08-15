// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Email Provider Interface                        │
// │ Abstract provider interface for transactional email.          │
// │ Decouples business logic from the concrete email provider.    │
// │ Wave 1 — EPIC-016 Email Infrastructure v1                     │
// └─────────────────────────────────────────────────────────────┘

export interface EmailProvider {
  readonly name: string;
  sendEmail(to: string | string[], subject: string, html: string, text: string): Promise<SendResult>;
  getProviderHealth(): Promise<ProviderHealth>;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerLatencyMs: number;
}

export interface ProviderHealth {
  status: "healthy" | "degraded" | "unavailable";
  providerName: string;
  lastChecked: string;
  latencyMs: number;
}
