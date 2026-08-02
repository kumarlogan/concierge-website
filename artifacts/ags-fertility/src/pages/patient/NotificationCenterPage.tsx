// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Notification Center Page (Wave 7)              │
// │ Persistent notification list with filters, search, batch   │
// │ actions, and real-time updates via SSE.                     │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bell,
  BellOff,
  ArrowRight,
  Calendar,
  Pill,
  FlaskConical,
  Route,
  FileText,
  Megaphone,
  Settings,
  Search,
  X,
  Eye,
  CheckCheck,
  Filter,
  ChevronDown,
  ChevronUp,
  Archive,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Info,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
  type Notification,
} from "@/lib/message-api";
import { getNotifIcon, getNotifIconColor } from "@/components/notifications/NotifIcon";
import { NotificationPreferencesDialog } from "@/components/notifications/NotificationPreferencesDialog";

type FilterType = "all" | "unread" | "appointment_reminder" | "medication_reminder" | "timeline_update" | "lab_result" | "document_shared" | "clinic_announcement" | "system";

export default function NotificationCenterPage() {
  const { identity } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPreferences, setShowPreferences] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const opts: { unreadOnly?: boolean; type?: string; limit?: number } = {};
      if (filter === "unread") opts.unreadOnly = true;
      if (filter !== "all" && filter !== "unread") opts.type = filter;

      const data = await getNotifications(opts);
      let filtered = data;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.body.toLowerCase().includes(q) ||
            n.type.toLowerCase().includes(q),
        );
      }

      setNotifications(filtered);
    } catch {
      // Silently handle — user can retry
    } finally {
      setLoading(false);
    }
  }, [filter, searchQuery]);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently handle
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    refreshUnreadCount();
  }, [fetchNotifications, refreshUnreadCount]);

  // SSE connection for real-time updates
  useEffect(() => {
    if (!identity) return;

    const token = localStorage.getItem("agsynergy_token");
    if (!token) return;

    try {
      const source = new EventSource(`${import.meta.env.VITE_API_BASE || ""}/api/v1/notifications/stream`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      source.onopen = () => setSseConnected(true);
      source.onerror = () => {
        setSseConnected(false);
        source.close();
      };

      source.addEventListener("notification.new", () => {
        fetchNotifications();
        refreshUnreadCount();
      });

      source.addEventListener("notification.read", () => {
        fetchNotifications();
        refreshUnreadCount();
      });

      source.addEventListener("notification.unread-count", () => {
        refreshUnreadCount();
      });

      eventSourceRef.current = source;

      return () => {
        source.close();
        eventSourceRef.current = null;
      };
    } catch {
      // SSE not supported — polling fallback already handled by fetchNotifications
    }
  }, [identity, fetchNotifications, refreshUnreadCount]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "read" as const, readAt: new Date().toISOString() } : n)),
    );
    refreshUnreadCount();
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, status: "read" as const, readAt: n.readAt ?? new Date().toISOString() })));
    setSelectedIds(new Set());
    refreshUnreadCount();
  };

  const handleDismiss = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    refreshUnreadCount();
  };

  const handleBatchDismiss = async () => {
    for (const id of selectedIds) {
      await markNotificationRead(id);
    }
    setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)));
    setSelectedIds(new Set());
    refreshUnreadCount();
  };

  const handleBatchMarkRead = async () => {
    for (const id of selectedIds) {
      await markNotificationRead(id);
    }
    setNotifications((prev) =>
      prev.map((n) =>
        selectedIds.has(n.id) ? { ...n, status: "read" as const, readAt: n.readAt ?? new Date().toISOString() } : n,
      ),
    );
    setSelectedIds(new Set());
    refreshUnreadCount();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map((n) => n.id)));
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "critical":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "important":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "unread", label: "Unread" },
    { value: "appointment_reminder", label: "Appointments" },
    { value: "medication_reminder", label: "Medication" },
    { value: "timeline_update", label: "Timeline" },
    { value: "lab_result", label: "Lab Results" },
    { value: "document_shared", label: "Documents" },
    { value: "clinic_announcement", label: "Announcements" },
    { value: "system", label: "System" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="rounded-full px-2 py-1 text-xs">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
          {sseConnected && (
            <Badge variant="secondary" className="text-xs">
              Live
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreferences(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Preferences
          </Button>
          <Button variant="outline" size="sm" onClick={() => { fetchNotifications(); refreshUnreadCount(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Batch Actions */}
      {selectedIds.size > 0 && (
        <Card className="border-primary/20">
          <CardContent className="py-2 px-4 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            <Button variant="ghost" size="sm" onClick={handleBatchMarkRead}>
              <CheckCheck className="h-4 w-4 mr-1" /> Mark Read
            </Button>
            <Button variant="ghost" size="sm" onClick={handleBatchDismiss}>
              <Archive className="h-4 w-4 mr-1" /> Dismiss
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {filterOptions.map((opt) => (
            <Button
              key={opt.value}
              variant={filter === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(opt.value)}
              className="whitespace-nowrap"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Notification List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BellOff className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No notifications</p>
              <p className="text-sm text-muted-foreground mt-1">
                {filter === "all" ? "You're all caught up!" : "No notifications match your filters"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = getNotifIcon(notification.type);
                const iconColor = getNotifIconColor(notification.type);
                const isSelected = selectedIds.has(notification.id);

                return (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 p-4 hover:bg-accent/50 transition-colors cursor-pointer ${
                      notification.status === "unread" ? "bg-accent/30" : ""
                    }`}
                    onClick={() => handleMarkRead(notification.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(notification.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 h-4 w-4 rounded border-input"
                    />
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm truncate">{notification.title}</h3>
                        {getPriorityIcon(notification.priority)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{notification.body}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-muted-foreground">{formatTimeAgo(notification.createdAt)}</span>
                        {notification.actionUrl && (
                          <Button variant="ghost" size="sm" className="h-auto p-0 text-xs" asChild>
                            <a href={notification.actionUrl}>
                              View <ArrowRight className="h-3 w-3 ml-1" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismiss(notification.id);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mark All Read */}
      {notifications.some((n) => n.status === "unread") && (
        <Button variant="outline" className="w-full" onClick={handleMarkAllRead}>
          <CheckCheck className="h-4 w-4 mr-2" />
          Mark All as Read
        </Button>
      )}

      {/* Preferences Dialog */}
      {showPreferences && (
        <NotificationPreferencesDialog open={showPreferences} onOpenChange={setShowPreferences} />
      )}
    </div>
  );
}