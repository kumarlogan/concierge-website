-- ┌─────────────────────────────────────────────────────────────┐
-- │ AG Synergy — Wave 7 Notification Schema Migration            │
-- │ Notification & Engagement Platform                             │
-- └─────────────────────────────────────────────────────────────┘

-- Notifications table (persistent, D1-backed)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  priority TEXT NOT NULL DEFAULT 'informational',
  channel TEXT NOT NULL DEFAULT 'in_app',
  action_url TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_identity ON notifications(identity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- Notification delivery tracking (per-channel status)
CREATE TABLE IF NOT EXISTS notification_delivery (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delivery_notification ON notification_delivery(notification_id);
CREATE INDEX IF NOT EXISTS idx_delivery_channel ON notification_delivery(channel);

-- Notification escalation tracking
CREATE TABLE IF NOT EXISTS notification_escalation (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  target_role TEXT NOT NULL,
  triggered_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);

-- Notification analytics (daily aggregation)
CREATE TABLE IF NOT EXISTS notification_analytics (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  dismissed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  escalated_count INTEGER DEFAULT 0,
  avg_delivery_time_ms INTEGER DEFAULT 0,
  avg_read_time_ms INTEGER DEFAULT 0,
  engagement_rate REAL DEFAULT 0.0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_date ON notification_analytics(date);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON notification_analytics(notification_type);

-- Notification preferences (D1-backed)
CREATE TABLE IF NOT EXISTS notification_preferences (
  identity_id TEXT PRIMARY KEY,
  preferences TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);