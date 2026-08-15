// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Email Service                                  │
// │ Business-layer email service with delivery tracking.         │
// │ Routes email requests through the provider abstraction.      │
// │ EPIC-016 Email Infrastructure v1 / EPIC-017 Phase 3-4        │
// └─────────────────────────────────────────────────────────────┘

import { EmailProvider, SendResult, ProviderHealth } from "./email-provider.js";

export interface EmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  from?: string;
  templateName?: string;
  referenceId?: string;
}

export interface EmailDeliveryRecord {
  id: string;
  referenceId: string;
  templateName: string;
  to: string;
  subject: string;
  from?: string;
  providerName: string;
  status: "requested" | "sent" | "failed";
  providerMessageId?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * Maps a sender (from) address to a named provider.
 * Used by the EmailService to route root-domain sends (e.g.
 * support@agsynergy.ca) to SendGrid while everything else
 * goes through the default Resend provider.
 */
export interface EmailProviderRouting {
  /** Default provider used when no `from` match is found. */
  default: EmailProvider;
  /** Optional map of address → provider for explicit routing. */
  routes?: Record<string, EmailProvider>;
}

export class EmailService {
  private readonly provider: EmailProvider;
  private readonly routing?: EmailProviderRouting;
  private readonly deliveryLog: EmailDeliveryRecord[] = [];

  /** Single-provider constructor (EPIC-016 backward compatibility). */
  constructor(provider: EmailProvider);
  /** Multi-provider routing constructor (EPIC-017: route by `from`). */
  constructor(routing: EmailProviderRouting);
  constructor(providerOrRouting: EmailProvider | EmailProviderRouting) {
    if (providerOrRouting instanceof Object && !("sendEmail" in providerOrRouting)) {
      this.routing = providerOrRouting as EmailProviderRouting;
      this.provider = this.routing.default;
    } else {
      this.provider = providerOrRouting as EmailProvider;
    }
  }

  /** Resolves which provider handles this request based on the `from` address. */
  private resolveProvider(request: EmailRequest): EmailProvider {
    if (this.routing?.routes && request.from) {
      const matched = this.routing.routes[request.from];
      if (matched) return matched;
    }
    return this.provider;
  }

  async sendEmail(request: EmailRequest): Promise<SendResult> {
    const provider = this.resolveProvider(request);
    const recipients = Array.isArray(request.to) ? request.to : [request.to];
    
    // Create delivery record for each recipient
    const records: EmailDeliveryRecord[] = recipients.map(to => ({
      id: crypto.randomUUID(),
      referenceId: request.referenceId ?? "",
      templateName: request.templateName ?? "unknown",
      to,
      subject: request.subject,
      from: request.from,
      providerName: provider.name,
      status: "requested" as const,
      createdAt: new Date().toISOString(),
    }));
    
    this.deliveryLog.push(...records);

    // Send to all recipients via the provider (handles single or multi)
    const result = await provider.sendEmail(request.to, request.subject, request.html, request.text);

    // Update all records with the result
    for (const record of records) {
      record.status = result.success ? "sent" : "failed";
      record.providerMessageId = result.messageId;
      record.error = result.error;
      record.completedAt = new Date().toISOString();
    }

    return result;
  }

  getDeliveryLog(): readonly EmailDeliveryRecord[] {
    return this.deliveryLog;
  }
  getProviderHealth() {
    return this.provider.getProviderHealth();
  }
}
