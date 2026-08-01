// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Notification Types                               │
// │ Wave 6 — Communication Centre                                 │
// └─────────────────────────────────────────────────────────────┘

export enum NotificationPriority {
  CRITICAL = "critical",
  IMPORTANT = "important",
  INFORMATIONAL = "informational",
}

export enum NotificationStatus {
  UNREAD = "unread",
  READ = "read",
  DISMISSED = "dismissed",
}

export enum NotificationChannel {
  IN_APP = "in_app",
  SMS = "sms",
  EMAIL = "email",
  PUSH = "push",
}

export type NotificationType = 
  | "appointment_reminder"
  | "medication_reminder"
  | "timeline_update"
  | "lab_result"
  | "document_shared"
  | "clinic_announcement"
  | "system";

export interface Notification {
  id: string;
  identityId: string;
  type: NotificationType;
  title: string;
  body: string;
  status: NotificationStatus;
  priority: NotificationPriority;
  channel: NotificationChannel;
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPreferences {
  identityId: string;
  channels: {
    sms: boolean;
    email: boolean;
    push: boolean;
    in_app: boolean;
  };
  dailyCap: number;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  pauseNonCritical: boolean;
  typePreferences: Record<string, {
    channel: NotificationChannel[];
    enabled: boolean;
  }>;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, 'identityId'> = {
  channels: {
    sms: false,
    email: true,
    push: false,
    in_app: true,
  },
  dailyCap: 5,
  quietHours: {
    enabled: true,
    start: "20:00",
    end: "08:00",
  },
  pauseNonCritical: false,
  typePreferences: {
    appointment_reminder: { channel: [NotificationChannel.IN_APP, NotificationChannel.SMS], enabled: true },
    medication_reminder: { channel: [NotificationChannel.IN_APP, NotificationChannel.SMS], enabled: true },
    timeline_update: { channel: [NotificationChannel.IN_APP], enabled: true },
    lab_result: { channel: [NotificationChannel.IN_APP, NotificationChannel.EMAIL], enabled: true },
    document_shared: { channel: [NotificationChannel.IN_APP, NotificationChannel.EMAIL], enabled: true },
    clinic_announcement: { channel: [NotificationChannel.IN_APP, NotificationChannel.EMAIL], enabled: true },
    system: { channel: [NotificationChannel.IN_APP], enabled: true },
  },
};