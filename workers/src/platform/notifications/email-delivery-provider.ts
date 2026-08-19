// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Email Delivery Provider                           │
// │ Wraps EmailService for use by the DeliveryEngine.           │
// │ Wave 7 — Notification & Engagement Platform                 │
// └─────────────────────────────────────────────────────────────┘

import { EmailService } from "../../email/email-service.js";
import type { Notification } from "./notification-types.js";

export class EmailDeliveryProvider {
  private readonly emailService: EmailService;

  constructor(emailService: EmailService) {
    this.emailService = emailService;
  }

  async send(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Build email content from notification
      const subject = notification.title;
      const html = this.buildHtml(notification);
      const text = this.buildText(notification);

      const result = await this.emailService.sendEmail({
        to: notification.metadata?.email as string ?? "",
        subject,
        html,
        text,
        templateName: "notification",
        referenceId: notification.id,
      });

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private buildHtml(notification: Notification): string {
    return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>${notification.title}</h1>
  <p>${notification.body}</p>
  ${notification.actionUrl ? `<p><a href="${notification.actionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View in Portal</a></p>` : ""}
  <p style="color: #6b7280; font-size: 12px;">This notification was sent from AG Synergy. You can manage notification preferences in your portal settings.</p>
</body>
</html>`;
  }

  private buildText(notification: Notification): string {
    return `${notification.title}\n\n${notification.body}\n\n${notification.actionUrl ? `View in Portal: ${notification.actionUrl}\n` : ""}This notification was sent from AG Synergy. You can manage notification preferences in your portal settings.`;
  }
}