// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Escalation Types                                  │
// │ Wave 7 — Notification & Engagement Platform                  │
// └─────────────────────────────────────────────────────────────┘

export enum EscalationLevel {
  LEVEL_1 = 1,
  LEVEL_2 = 2,
  LEVEL_3 = 3,
}

export interface EscalationConfig {
  level: EscalationLevel;
  timeoutMinutes: number;
  channels: string[];
  targetRole: string;
}

export const ESCALATION_CHAIN: EscalationConfig[] = [
  {
    level: EscalationLevel.LEVEL_1,
    timeoutMinutes: 15,
    channels: ["in_app", "push"],
    targetRole: "patient",
  },
  {
    level: EscalationLevel.LEVEL_2,
    timeoutMinutes: 30,
    channels: ["in_app", "email", "sms"],
    targetRole: "care_coordinator",
  },
  {
    level: EscalationLevel.LEVEL_3,
    timeoutMinutes: 60,
    channels: ["in_app", "email", "sms", "phone"],
    targetRole: "physician",
  },
];

export interface EscalationEvent {
  id: string;
  notificationId: string;
  level: EscalationLevel;
  targetRole: string;
  triggeredAt: string;
  resolvedAt: string | null;
  createdAt: string;
}