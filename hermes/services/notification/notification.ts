// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Notification Service (contract stub)         │
// │ EPIC-002-006C · PHASE 1                                        │
// │ Fan-out boundary. Uses shared/interfaces/notification. No SDK. │
// └─────────────────────────────────────────────────────────────┘

import type { NotificationProvider, Notification } from "../../../shared/interfaces/notification.js";
import { emitAudit } from "../../audit/event.js";

let PROVIDER: NotificationProvider | null = null;

/** Inject the concrete provider (Cloudflare/Telegram/etc). No SDK imported. */
export function bindNotificationProvider(p: NotificationProvider): void {
  PROVIDER = p;
}

export async function notify(msg: Notification, actor: string): Promise<void> {
  emitAudit("notification.send", actor, { channel: msg.channel, to: msg.to });
  if (!PROVIDER) {
    // No provider bound yet — record intent, do not fail.
    return;
  }
  await PROVIDER.send(msg);
}
