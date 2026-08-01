# Wave 6 — Communication Centre: UX Blueprint

**Product:** AG Synergy
**Wave:** 6 — Communication Centre
**Discipline:** Experience & Design
**Status:** ✅ Complete

---

## 1. Page Structure

### Route: `/patient/communication`

### Layout
```
┌──────────────────────────────────────────────────────┐
│ Header: Communication Centre                 ⚙️ Prefs │
├──────────────────────────────────────────────────────┤
│ [📥 Inbox] [✉️ Messages] [🔔 Alerts] [📢 Announce] │
├──────────────────────────────────────────────────────┤
│ 🔍 Search messages and notifications...  [Filter ▼] │
├──────────────────────────────────────────────────────┤
│ ┌───────────────┐ ┌──────────────────────────────┐   │
│ │ Thread List   │ │ Conversation / Detail View   │   │
│ │               │ │                              │   │
│ │ 📬 Dr. Smith  │ │ [Message bubbles]            │   │
│ │    "Your labs"│ │                              │   │
│ │    ● 2 min ago│ │ [Compose box]                │   │
│ │               │ │                              │   │
│ │ 🔔 Appointment│ │ OR (notification selected)   │   │
│ │    Tomorrow   │ │ [Notification detail card]   │   │
│ │    3h ago     │ │ [Action button → deep link]  │   │
│ │               │ │                              │   │
│ │ 📢 Clinic     │ │ OR (empty state)             │   │
│ │    Holiday hrs│ │ [No messages yet illustration]│   │
│ │               │ │ [Compose first message]      │   │
│ └───────────────┘ └──────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Mobile Responsive
| Breakpoint | Left Panel | Right Panel |
|------------|-----------|-------------|
| ≥768px | 380px fixed | Remaining |
| <768px | Full width (tap item → replace) | Slide in full width |

---

## 2. Tabs

| Tab | Content | Source |
|-----|---------|--------|
| **Inbox** (default) | All messages + notifications merged chronologically | `getThreads()` + `getNotifications()` |
| **Messages** | Conversations only — existing thread list | `getThreads()` |
| **Alerts** | Notifications only — all types | `getNotifications({ type: filter })` |
| **Announcements** | Clinic broadcasts only (one-to-many) | `getNotifications({ type: "clinic_announcement" })` |

---

## 3. Thread List Items

### Message Thread
```
┌────────────────────────────────────────────────┐
│ [Avatar] Subject line (bold if unread)         │
│          Preview text (1 line, truncated)      │
│          ● Status dot + Timestamp     🔢 badge │
└────────────────────────────────────────────────┘
```
- **Badge**: Unread count for this thread
- **Status dot**: Sent (blue) / Delivered (green) / Read (gray)
- **Tap/click**: Opens conversation view in right panel

### Notification Item
```
┌────────────────────────────────────────────────┐
│ [Icon by type] Title (bold if unread)          │
│               Body preview (1 line, truncated) │
│               Timestamp               👁️ read │
└────────────────────────────────────────────────┘
```
- **Icon**: Contextual — 🗓️ appointment, 💊 medication, 📋 results, 📄 document, 📢 announcement, ⚙️ system
- **Unread**: Bold title + blue left border
- **Tap/click**: Opens detail view with action button

### Announcement Item
```
┌────────────────────────────────────────────────┐
│ [📢] Clinic Notice: Subject                    │
│      Body preview               📌 Pinned     │
│      Timestamp                                 │
└────────────────────────────────────────────────┘
```
- **Pinned badge**: For unread/pinned announcements
- **Tap/click**: Opens full announcement

---

## 4. Conversation View (Existing MessagesPage logic)

| Element | Description |
|---------|-------------|
| Header | Back button, thread subject, participant name |
| Message bubbles | Right-aligned (patient), Left-aligned (other). Blue bg vs white bg |
| Status indicators | Sent/read timestamps below own messages |
| Attachments | Paperclip icon if present (new) |
| Compose | Text input + Send button. Enter to send, Shift+Enter for newline |
| Attachment button | Paperclip icon → opens file picker (new) |

---

## 5. Notification Detail View

```
┌──────────────────────────────────────────────────────┐
│ [← Back]                                              │
│                                                       │
│ [Icon] Title                                          │
│ Body text (full)                                      │
│                                                       │
│ Priority: Important   Type: Appointment               │
│ Received: Aug 1, 2026 2:30 PM                         │
│                                                       │
│ [View Appointment →] [Dismiss]                        │
└──────────────────────────────────────────────────────┘
```

---

## 6. Notification Preferences Dialog

### Access: Gear icon ⚙️ in header

```
┌──────────────────────────────────────────────────────┐
│             Notification Preferences                  │
│ ────────────────────────────────────────────────────  │
│                                                        │
│ Channels                                                │
│ ☑ In-app notifications                                  │
│ ☐ SMS text messages                              (opt) │
│ ☐ Email notifications                           (opt) │
│ ☐ Push notifications (mobile)                  (opt) │
│                                                        │
│ Daily Limit                                             │
│ 🔵───────────────●─────────────── 5/day           │
│ (1-20 slider)                                          │
│                                                        │
│ Quiet Hours                                             │
│ ☑ Enable quiet hours                                    │
│ From [🕐 20:00] To [🕐 08:00]                         │
│                                                        │
│ ☐ Pause non-critical notifications 🧘                  │
│   (Useful during sensitive periods)                     │
│                                                        │
│ Notification Types                                      │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Appointment Reminders              ☑ In-app    ☐ ⇢│ │
│ │ Medication Reminders               ☑ In-app    ☐ ⇢│ │
│ │ Lab Results                        ☑ In-app    ☐ ⇢│ │
│ │ Treatment Phase Updates            ☑ In-app    ☐ ⇢│ │
│ │ Document Shared                    ☑ In-app    ☐ ⇢│ │
│ │ Clinic Announcements               ☑ In-app    ☐ ⇢│ │
│ │ System Notifications               ☑ In-app    ☐ ⇢│ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ [Save Preferences]    [Reset to Defaults]              │
└──────────────────────────────────────────────────────┘
```

- **Channels**: Master toggles per delivery channel
- **Daily cap**: Slider 1-20 (default 5, hard max 20)
- **Quiet hours**: Toggle + time pickers
- **Pause non-critical**: Single toggle, shows status indicator in header when active
- **Type preferences**: Each type shows enabled channels; tap ⇢ for per-channel detail

---

## 7. States

### Loading
- Skeleton cards in thread list (3-4 items)
- Right panel: "Loading..." centered
- No flash of broken layout

### Empty
- **No threads**: Illustration + "No conversations yet. Send your first message to your care team."
- **No notifications**: "No recent notifications. You'll see appointment reminders, lab results, and other updates here."
- **No results (search)**: "No messages or notifications matching your search."

### Error
- Inline error banner below header: "Couldn't load messages. [Retry]"
- Retry button triggers re-fetch
- Error state persists per section (threads may load if notifications fail)

---

## 8. Search

| Feature | Behavior |
|---------|----------|
| Scope | Searches both messages and notifications |
| Fields | Subject, body content, sender name |
| Debounce | 300ms after last keystroke |
| Results | Shown inline in thread list, replacing normal list |
| Empty | "No results" state |
| Clear | X button in search field clears and restores list |

### Filters (dropdown)
| Filter | Options |
|--------|---------|
| Type | All, Messages, Notifications, Announcements |
| Date | All time, Today, Last 7 days, Last 30 days, Custom |
| Status | All, Unread only |
| Priority | All, Critical, Important, Informational |

---

## 9. Accessibility

- All icons have `aria-label`
- Tab order: search → tabs → thread list → conversation
- Keyboard: Escape closes detail view, Tab navigates, Enter activates
- Focus ring on all interactive elements
- Screen reader announcements for new messages (aria-live region)
- Color not sole indicator — status dots have text labels for screen readers

---

## 10. Color & Visual Identity

| Element | Token |
|---------|-------|
| Message bubble (self) | `bg-blue-50 border-blue-200` |
| Message bubble (other) | `bg-white border-gray-200` |
| Unread indicator | `bg-primary` (blue dot/border) |
| Critical notification | `border-l-4 border-l-red-500` |
| Important notification | `border-l-4 border-l-amber-500` |
| Informational notification | `border-l-4 border-l-blue-500` |
| Active tab | `border-b-2 border-primary` |
| Search | Standard input with `Search` icon |

---

*Blueprint reviewed against WCAG 2.1 AA, mobile-first principles, and IVF-specific communication requirements.*