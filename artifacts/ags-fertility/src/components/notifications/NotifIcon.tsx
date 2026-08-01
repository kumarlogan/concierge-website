// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Notification Icon by Type                       │
// │ Wave 6 — Communication Centre                               │
// └─────────────────────────────────────────────────────────────┘

import {
  Calendar,
  Pill,
  FlaskConical,
  Route,
  FileText,
  Megaphone,
  Bell,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  appointment_reminder: Calendar,
  medication_reminder: Pill,
  lab_result: FlaskConical,
  timeline_update: Route,
  document_shared: FileText,
  clinic_announcement: Megaphone,
  system: Bell,
};

export function getNotifIcon(type: string): LucideIcon {
  return iconMap[type] ?? Bell;
}

export function getNotifIconColor(type: string, priority?: string): string {
  if (priority === "critical") return "text-red-500";
  if (priority === "important") return "text-amber-500";
  
  switch (type) {
    case "appointment_reminder": return "text-green-500";
    case "medication_reminder": return "text-purple-500";
    case "lab_result": return "text-blue-500";
    case "timeline_update": return "text-rose-500";
    case "document_shared": return "text-indigo-500";
    case "clinic_announcement": return "text-orange-500";
    default: return "text-gray-500";
  }
}