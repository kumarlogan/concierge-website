export type NotificationChannel = "telegram" | "email" | "sms" | "webhook";

export interface Notification {
  channel: NotificationChannel;
  to: string;
  subject?: string;
  body: string;
}

export interface NotificationProvider {
  send(notification: Notification): Promise<void>;
}
