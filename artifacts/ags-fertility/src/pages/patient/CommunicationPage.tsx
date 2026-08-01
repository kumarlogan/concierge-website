// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Communication Centre                           │
// │ Unified inbox combining messages and notifications.         │
// │ Wave 6 — Communication Centre                               │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Send,
  RefreshCw,
  Inbox,
  ArrowLeft,
  Bell,
  Settings,
  Search,
  X,
  Eye,
  Megaphone,
  BellOff,
  Loader2,
  Filter,
  CheckCheck,
} from "lucide-react";
import {
  getThreads,
  getThreadMessages,
  sendMessage,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
  type Message as ApiMessage,
  type MessageThread,
  type Notification,
} from "@/lib/message-api";
import { getNotifIcon, getNotifIconColor } from "@/components/notifications/NotifIcon";
import NotificationPreferencesDialog from "@/components/notifications/NotificationPreferencesDialog";

type TabType = "inbox" | "messages" | "alerts" | "announcements";

type InboxItem = 
  | { kind: "message"; thread: MessageThread }
  | { kind: "notification"; notification: Notification };

export default function CommunicationPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("inbox");
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPrefs, setShowPrefs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterType, setFilterType] = useState<string>("all");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const participantId = user?.id ?? "anonymous";

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [threadData, notifData, count] = await Promise.all([
        getThreads().catch(() => []),
        getNotifications().catch(() => []),
        getUnreadCount().catch(() => 0),
      ]);
      
      setThreads((threadData as unknown as MessageThread[]) || []);
      setNotifications(notifData || []);
      setUnreadCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll every 30s for new notifications
    pollRef.current = setInterval(() => {
      getUnreadCount().then(setUnreadCount).catch(() => {});
    }, 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData]);

  const fetchThreadMessages = async (threadId: string) => {
    try {
      const data = await getThreadMessages(threadId);
      setMessages(data as unknown as ApiMessage[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    }
  };

  useEffect(() => {
    if (selectedThread) {
      fetchThreadMessages(selectedThread);
    }
  }, [selectedThread]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedThread) return;
    try {
      const thread = threads.find(t => t.threadId === selectedThread);
      const lastMsg = thread?.lastMessage;
      const recipientId = lastMsg
        ? (lastMsg.senderId === participantId ? lastMsg.recipientId : lastMsg.senderId)
        : "";
      await sendMessage({
        threadId: selectedThread,
        recipientId,
        type: "text",
        subject: "",
        content: newMessage.trim(),
      });
      setNewMessage("");
      fetchThreadMessages(selectedThread);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (notif.status === "unread") {
      await markNotificationRead(notif.id).catch(() => {});
      setNotifications(prev =>
        prev.map(n => n.id === notif.id ? { ...n, status: "read" as const, readAt: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setSelectedNotification(notif);
  };

  const handleMarkAllRead = async () => {
    const count = await markAllNotificationsRead().catch(() => 0);
    if (count > 0) {
      setNotifications(prev => prev.map(n => ({ ...n, status: "read" as const, readAt: n.readAt || new Date().toISOString() })));
      setUnreadCount(0);
    }
  };

  // Merge threads + notifications for unified inbox
  const getInboxItems = (): InboxItem[] => {
    const items: InboxItem[] = [
      ...threads.map(t => ({ kind: "message" as const, thread: t })),
      ...notifications.map(n => ({ kind: "notification" as const, notification: n })),
    ];

    // Filter by search
    const q = searchQuery.toLowerCase();
    const filtered = q ? items.filter(item => {
      if (item.kind === "message") {
        const m = item.thread.lastMessage;
        return (m.subject?.toLowerCase().includes(q) || m.content?.toLowerCase().includes(q));
      } else {
        return item.notification.title.toLowerCase().includes(q) 
          || item.notification.body.toLowerCase().includes(q);
      }
    }) : items;

    // Sort by date descending
    filtered.sort((a, b) => {
      const dateA = a.kind === "message" 
        ? new Date(a.thread.lastMessage.createdAt).getTime()
        : new Date(a.notification.createdAt).getTime();
      const dateB = b.kind === "message"
        ? new Date(b.thread.lastMessage.createdAt).getTime()
        : new Date(b.notification.createdAt).getTime();
      return dateB - dateA;
    });

    return filtered;
  };

  // Filter by tab
  const getFilteredInbox = (): InboxItem[] => {
    const items = getInboxItems();
    switch (activeTab) {
      case "messages":
        return items.filter(i => i.kind === "message");
      case "alerts":
        return items.filter(i => i.kind === "notification");
      case "announcements":
        return items.filter(i => i.kind === "notification" && i.notification.type === "clinic_announcement");
      default:
        return items;
    }
  };

  const filteredItems = getFilteredInbox();
  const unreadNotifications = notifications.filter(n => n.status === "unread").length;

  // Render thread list
  const renderThreadList = () => {
    if (loading) {
      return (
        <div className="space-y-3 p-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse rounded-lg border bg-muted/20 p-4">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="mt-2 h-3 w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      );
    }

    if (filteredItems.length === 0) {
      const emptyMessages = {
        inbox: "No messages or notifications yet. Your communication centre will populate as your care team reaches out.",
        messages: "No conversations yet. Messages from your care team will appear here.",
        alerts: "No recent alerts. Appointment reminders, lab results, and other updates will appear here.",
        announcements: "No clinic announcements. Important notices from your clinic will appear here.",
      };
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <Inbox className="mb-3 h-12 w-12 opacity-20" />
          <p className="text-sm">{emptyMessages[activeTab]}</p>
        </div>
      );
    }

    return (
      <div className="divide-y">
        {filteredItems.map((item, idx) => {
          if (item.kind === "message") {
            const t = item.thread;
            const isUnread = t.unreadCount > 0;
            return (
              <button
                key={`msg-${t.threadId}-${idx}`}
                onClick={() => { setSelectedThread(t.threadId); setSelectedNotification(null); }}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50 ${
                  selectedThread === t.threadId ? "bg-accent" : ""
                } ${isUnread ? "border-l-2 border-l-primary" : ""}`}
              >
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${isUnread ? "font-semibold" : ""}`}>
                      {t.lastMessage.subject ?? "Conversation"}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(t.lastMessage.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{t.lastMessage.content}</p>
                </div>
                {t.unreadCount > 0 && (
                  <Badge variant="default" className="ml-auto shrink-0 text-xs">{t.unreadCount}</Badge>
                )}
              </button>
            );
          } else {
            const n = item.notification;
            const isUnread = n.status === "unread";
            const NotifIcon = getNotifIcon(n.type);
            return (
              <button
                key={`notif-${n.id}-${idx}`}
                onClick={() => handleNotificationClick(n)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50 ${
                  selectedNotification?.id === n.id ? "bg-accent" : ""
                } ${isUnread ? "border-l-2 border-l-blue-500" : ""}`}
              >
                <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-muted ${getNotifIconColor(n.type, n.priority)}`}>
                  <NotifIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${isUnread ? "font-semibold" : ""}`}>{n.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                </div>
                {isUnread && <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
              </button>
            );
          }
        })}
      </div>
    );
  };

  // Render conversation view
  const renderConversation = () => {
    if (selectedNotification) {
      const n = selectedNotification;
      const NotifIcon = getNotifIcon(n.type);
      return (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedNotification(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-sm font-semibold">Notification</h2>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-muted ${getNotifIconColor(n.type, n.priority)}`}>
                <NotifIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{n.title}</h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs capitalize">{n.type.replace(/_/g, " ")}</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{n.priority}</Badge>
                </div>
              </div>
            </div>
            <p className="text-sm leading-relaxed">{n.body}</p>
            <div className="text-xs text-muted-foreground">
              Received: {new Date(n.createdAt).toLocaleString()}
              {n.readAt && <> · Read: {new Date(n.readAt).toLocaleString()}</>}
            </div>
            {n.actionUrl && (
              <Button variant="default" size="sm" onClick={() => window.location.href = n.actionUrl!}>
                View Details
              </Button>
            )}
          </div>
        </div>
      );
    }

    if (!selectedThread) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <MessageSquare className="mb-3 h-12 w-12 opacity-20" />
          <p className="text-sm">Select a conversation to view messages</p>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedThread(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm font-semibold">Conversation</h2>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.senderId === participantId ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.senderId === participantId
                    ? "bg-blue-500 text-white"
                    : "bg-muted"
                }`}
              >
                <p>{msg.content}</p>
                <div className={`mt-1 flex items-center gap-1 text-xs ${
                  msg.senderId === participantId ? "text-blue-100" : "text-muted-foreground"
                }`}>
                  <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                  {msg.status === "read" && <CheckCheck className="h-3 w-3" />}
                  {msg.status === "delivered" && <CheckCheck className="h-3 w-3" />}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t p-4">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend} disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-6xl flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h1 className="text-xl font-bold">Communication Centre</h1>
          <p className="text-xs text-muted-foreground">
            All your conversations and updates in one place
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadNotifications > 0 && activeTab !== "messages" && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="gap-1">
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowPrefs(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between bg-red-50 px-4 py-2 text-sm text-red-600">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b">
        {([
          { id: "inbox" as TabType, label: "Inbox", count: unreadNotifications },
          { id: "messages" as TabType, label: "Messages", count: threads.reduce((s, t) => s + t.unreadCount, 0) },
          { id: "alerts" as TabType, label: "Alerts", count: unreadNotifications },
          { id: "announcements" as TabType, label: "Announcements", count: 0 },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedNotification(null); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent/50 ${
              activeTab === tab.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
          >
            {tab.label}
            {tab.count > 0 && activeTab !== tab.id && tab.id !== "announcements" && (
              <Badge variant="default" className="ml-1 text-xs">{tab.count}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search messages and notifications..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 border-0 bg-transparent p-0 text-sm placeholder:text-muted-foreground focus-visible:ring-0"
        />
        {searchQuery && (
          <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* List panel */}
        <div className={`w-full overflow-y-auto border-r md:w-96 ${selectedThread || selectedNotification ? "hidden md:block" : "block"}`}>
          {renderThreadList()}
        </div>

        {/* Detail panel */}
        <div className={`flex-1 overflow-hidden ${selectedThread || selectedNotification ? "block" : "hidden md:block"}`}>
          {renderConversation()}
        </div>
      </div>

      {/* Preferences Dialog */}
      {showPrefs && (
        <NotificationPreferencesDialog
          onClose={() => setShowPrefs(false)}
        />
      )}
    </div>
  );
}