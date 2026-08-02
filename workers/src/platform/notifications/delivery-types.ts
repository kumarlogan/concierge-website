// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Delivery Types                                    │
// │ Wave 7 — Notification & Engagement Platform                  │
// └─────────────────────────────────────────────────────────────┘

export enum DeliveryStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  READ = "read",
  FAILED = "failed",
}

export enum EscalationLevel {
  LEVEL_1 = 1,
  LEVEL_2 = 2,
  LEVEL_3 = 3,
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channel: string;
  status: DeliveryStatus;
  error: string | null;
  retryCount: number;
  lastRetryAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface EscalationEvent {
  id: string;
  notificationId: string;
  level: EscalationLevel;
  targetRole: string;
  triggeredAt: string;
  resolvedAt: string | null;
  createdAt: string;
}

export interface NotificationAnalytics {
  date: string;
  notificationType: string;
  channel: string;
  deliveredCount: number;
  readCount: number;
  dismissedCount: number;
  failedCount: number;
  escalatedCount: number;
  avgDeliveryTimeMs: number;
  avgReadTimeMs: number;
  engagementRate: number;
}
