// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Patient Layout (Wave 7)                      │
// │ Updated with notification badge on mobile bottom nav.    │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { getUnreadCount } from "@/lib/message-api";
import { Bell, BellOff, Home, Calendar, MessageSquare, Settings, ChevronDown } from "lucide-react";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const { identity } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!identity) return;
    refreshUnreadCount();
  }, [identity]);

  const refreshUnreadCount = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently handle
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center px-4">
          <a href="/patient/dashboard" className="font-bold text-lg mr-6">
            Concierge
          </a>
          <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
            <a href="/patient/dashboard" className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <Home className="h-4 w-4" />
              Dashboard
            </a>
            <a href="/patient/appointments" className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <Calendar className="h-4 w-4" />
              Appointments
            </a>
            <a href="/patient/messages" className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <MessageSquare className="h-4 w-4" />
              Messages
            </a>
            <a href="/patient/notifications" className="flex items-center gap-1.5 hover:text-primary transition-colors relative">
              <Bell className="h-4 w-4" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 rounded-full px-1.5 py-0 text-[10px] min-w-[18px] h-[18px]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </a>
            <a href="/patient/settings" className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <Settings className="h-4 w-4" />
              Settings
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-6 px-4">{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="flex items-center justify-around h-14">
          <a href="/patient/dashboard" className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground hover:text-primary">
            <Home className="h-5 w-5" />
            Home
          </a>
          <a href="/patient/appointments" className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground hover:text-primary">
            <Calendar className="h-5 w-5" />
            Appointments
          </a>
          <a href="/patient/messages" className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground hover:text-primary">
            <MessageSquare className="h-5 w-5" />
            Messages
          </a>
          <a href="/patient/notifications" className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground hover:text-primary relative">
            <Bell className="h-5 w-5" />
            Alerts
            {unreadCount > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-3 rounded-full px-1 py-0 text-[9px] min-w-[16px] h-[16px]">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </a>
          <a href="/patient/settings" className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground hover:text-primary">
            <Settings className="h-5 w-5" />
            Settings
          </a>
        </div>
      </nav>

      {/* Spacer for mobile nav */}
      <div className="md:hidden h-14" />
    </div>
  );
}