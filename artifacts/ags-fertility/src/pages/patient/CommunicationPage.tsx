// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Communication Page (Wave 7)              │
// │ Unified inbox with SSE real-time updates and delivery  │
// │ status indicators.                                       │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  CheckCheck,
  Filter,
  Loader2,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
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

type DeliveryStatus = "pending" | "sent" | "delivered" | "read" | "failed";

function getDeliveryIcon(status: DeliveryStatus) {
  switch (status) {
    case "pending":
      return <Clock className="h-3 w-3 text-muted-foreground" />;
    case "sent":
      return <AlertCircle className="h-3 w-3 text-blue-500" />;
    case "delivered":
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    case "read":
      return <Eye className="h-3 w-3 text-purple-500" />;
    case "failed":
      return <XCircle className="h-3 w-3 text-red-500" />;
  }
}

export default function CommunicationPage() {
  const { identity } = useAuth();
  const [activeTab, setActiveTab] = useState("messages");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      const data = await getNotifications({ limit: 20 });
      setNotifications(data);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently handle
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    refreshUnreadCount();
  }, [loadNotifications, refreshUnreadCount]);

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
        loadNotifications();
        refreshUnreadCount();
      });

      source.addEventListener("notification.read", () => {
        loadNotifications();
        refreshUnreadCount();
      });

      eventSourceRef.current = source;

      return () => {
        source.close();
        eventSourceRef.current = null;
      };
    } catch {
      // SSE not supported
    }
  }, [identity, loadNotifications, refreshUnreadCount]);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Communication Centre</h1>
        <div className="flex items-center gap-2">
          {sseConnected ? (
            <Badge variant="secondary" className="text-xs">
              <Wifi className="h-3 w-3 mr-1" /> Live
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              <WifiOff className="h-3 w-3 mr-1" /> Offline
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => { loadNotifications(); refreshUnreadCount(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="notifications">
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 rounded-full px-1.5 py-0 text-[10px]">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Messages and threads are managed in the dedicated Messages section.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Notifications</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={markAllNotificationsRead}>
                  <CheckCheck className="h-4 w-4 mr-1" /> Mark All Read
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bell className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No notifications</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => {
                    const Icon = getNotifIcon(notification.type);
                    const iconColor = getNotifIconColor(notification.type);

                    return (
                      <div
                        key={notification.id}
                        className={`flex items-start gap-3 p-3 hover:bg-accent/50 transition-colors ${
                          notification.status === "unread" ? "bg-accent/30" : ""
                        }`}
                      >
                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${iconColor}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm truncate">{notification.title}</h4>
                            {notification.status === "unread" && (
                              <Badge variant="secondary" className="text-[10px]">New</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{notification.body}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(notification.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => markNotificationRead(notification.id)}
                        >
                          {notification.status === "unread" ? (
                            <CheckCheck className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}