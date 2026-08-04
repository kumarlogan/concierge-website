# Wave 7 UX Blueprint — Notification & Engagement Platform

**Date:** 2026-08-02
**Product:** AGS Fertility Concierge v1.6.0
**Wave:** 7 — Notification & Engagement Platform
**Status:** ✅ Blueprint Complete

---

## Design Principles

1. **Patient-first**: Every notification designed around patient needs and IVF journey stage
2. **PHI-safe**: No PHI in push/email/SMS payloads — only deep links to portal
3. **Accessible**: WCAG 2.1 AA compliance, screen reader compatible, keyboard navigable
4. **Mobile-first**: Touch-friendly targets, swipe gestures, responsive layout
5. **Respectful**: Quiet hours honored, daily caps enforced, opt-in required
6. **Transparent**: Patients see delivery status, can manage preferences

---

## Notification Centre Redesign

### Current State (Wave 6)

- NotificationCenterPage shows categories (not actual notifications)
- CommunicationPage has unified inbox (messages + notifications)
- No live unread badge on mobile navigation
- No filtering, search, or archive

### Target State (Wave 7)

```
┌─────────────────────────────────────────────┐
│  🔔 Notifications          3 unread    ⋮   │
│─────────────────────────────────────────────│
│  [All] [Unread] [Appointments] [Messages]  │
│─────────────────────────────────────────────│
│  🔴 Upcoming Appointment                    │
│     Tomorrow at 9:00 AM with Dr. Smith     │
│     2h ago                                  │
│     [View] [Dismiss]                        │
│─────────────────────────────────────────────│
│  🟡 Medication Reminder                     │
│     Time for your evening Gonal-F dose     │
│     4h ago                                  │
│     [View] [Dismiss]                        │
│─────────────────────────────────────────────│
│  🔵 Lab Results Available                   │
│     Your blood work results are ready      │
│     1d ago                                  │
│     [View] [Dismiss] [Archive]              │
│─────────────────────────────────────────────│
│  [Load More]                                │
└─────────────────────────────────────────────┘
```

### Key UX Changes

1. **Live list**: Actual notifications displayed (not categories)
2. **Unread badge**: Real-time count on mobile nav icon
3. **Filter tabs**: All / Unread / By type
4. **Swipe actions**: Swipe left to dismiss, swipe right to archive
5. **Search**: Filter notifications by keyword
6. **Grouping**: Group by date ("Today", "Yesterday", "This Week")
7. **Batch actions**: Select multiple → mark read / dismiss / archive
8. **Empty state**: Friendly illustration when no notifications
9. **Pull-to-refresh**: Manual refresh of notification list
10. **Offline indicator**: Shows when device is offline

---

## Notification Preferences UX

### Current State

- NotificationPreferencesDialog exists (Wave 6)
- Per-type channel preferences
- Daily cap and quiet hours

### Target State (Wave 7)

- **Channel toggles**: SMS, Email, Push, In-App (per type and global)
- **Quiet hours**: Time picker (start/end) with timezone awareness
- **Daily cap**: Slider (1-20 notifications per day)
- **Pause non-critical**: Toggle to suppress informational notifications
- **Escalation preferences**: Opt-in/out of escalation chain
- **Push token management**: View registered devices, revoke tokens

---

## Mobile Navigation Badge

### Design

```
┌─────────────────────────────────┐
│  🏠 Home    📅 Appointments    │
│  💬 Messages 🔔 Notifications  │
│         ┌─────────────────┐     │
│         │ 🔔 3            │     │
│         └─────────────────┘     │
└─────────────────────────────────┘
```

- Badge shows unread count
- Badge auto-clears when Notification Centre opened
- Badge persists across sessions (D1-backed)
- Badge shows "9+" for counts > 9

---

## Accessibility Specifications

### Screen Reader

- ARIA live region for new notifications: `aria-live="polite"`
- Notification role: `role="alert"` for critical, `role="status"` for informational
- Label each notification with type and priority: `aria-label="Appointment reminder: Tomorrow at 9 AM"`
- Live region for unread count changes

### Keyboard Navigation

- `Tab` to navigate notification items
- `Enter` to open notification detail
- `Escape` to close notification detail
- `Ctrl+Shift+R` to mark all as read
- `Ctrl+Shift+A` to mark all as archived
- Focus trap in notification preferences dialog

### Reduced Motion

- Respect `prefers-reduced-motion` media query
- No slide animations, only fade transitions
- Badge updates instant (no animation)

### Color Independence

- Icons + text labels for all status indicators
- Colorblind-friendly palette (no red/green-only indicators)
- Priority indicators use icons + text, not just color

### Touch Targets

- Minimum 44x44px for all interactive elements
- 8px spacing between touch targets
- Swipe gestures with visible affordance

---

## Notification Types — UX Mappings

| Type | Icon | Color | Action |
|------|------|-------|--------|
| `appointment_reminder` | Calendar | Green | Navigate to appointment |
| `medication_reminder` | Pill | Purple | View medication details |
| `timeline_update` | Route | Rose | Navigate to care plan |
| `lab_result` | Flask | Blue | Navigate to documents |
| `document_shared` | FileText | Indigo | Open document |
| `clinic_announcement` | Megaphone | Orange | View announcement |
| `system` | Bell | Gray | View system notice |

---

## Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| Mobile (< 640px) | Full-screen notification list, bottom nav badge |
| Tablet (640-1024px) | Side panel notification list, main content area |
| Desktop (> 1024px) | Notification centre as slide-out panel |

---

## Interaction Patterns

### Swipe Gestures (Mobile)

| Direction | Action | Visual Feedback |
|-----------|--------|-----------------|
| Swipe left | Dismiss | Red background, trash icon |
| Swipe right | Archive | Gray background, archive icon |
| Swipe down | Refresh | Pull-to-refresh spinner |

### Batch Actions

1. Enter selection mode (checkbox icon)
2. Select notifications (checkboxes appear)
3. Toolbar appears with: Mark Read, Dismiss, Archive
4. Tap outside selection mode to exit

---

## Notification Detail View

```
┌─────────────────────────────────────┐
│ ← Back          Upcoming Appointment │
│─────────────────────────────────────│
│ 🔴 Important                    2h ago│
│─────────────────────────────────────│
│                                     │
│  Reminder: You have a monitoring    │
│  appointment tomorrow at 9:00 AM   │
│  with Dr. Smith. Please arrive     │
│  15 minutes early.                  │
│                                     │
│─────────────────────────────────────│
│ 📎 Preparation: Fasting required    │
│ 📍 Location: Main Clinic, Room 204 │
│ 📞 Contact: (555) 123-4567         │
│                                     │
│ [Confirm Attendance] [Reschedule]   │
│ [Dismiss]                           │
└─────────────────────────────────────┘
```

---

## Delivery Status Indicators

| Status | Icon | Description |
|--------|------|-------------|
| Pending | ⏳ | Queued for delivery |
| Sent | ✉️ | Sent to channel provider |
| Delivered | ✅ | Channel provider confirmed |
| Read | 👁️ | Recipient opened/read |
| Failed | ❌ | Delivery failed |
| Escalated | 🔺 | Escalated to next level |

---

*UX Blueprint for Wave 7 — Notification & Engagement Platform.*
