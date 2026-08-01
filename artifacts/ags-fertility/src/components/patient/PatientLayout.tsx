// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Patient Workspace Layout               │
// │ Responsive sidebar + header navigation for patient area.   │
// │ Wave 5 — Patient Workspace                                  │
// └─────────────────────────────────────────────────────────────┘

import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  User,
  Shield,
  ClipboardCheck,
  Bell,
  Calendar,
  MessageSquare,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Clock,
  ListTodo,
  Trophy,
  Sparkles,
  Users,
  Route,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  { href: "/patient/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/patient/care-plan", label: "Care Plan", icon: <Route className="h-4 w-4" /> },
  { href: "/patient/tasks", label: "Tasks", icon: <ListTodo className="h-4 w-4" /> },
  { href: "/patient/milestones", label: "Milestones", icon: <Trophy className="h-4 w-4" /> },
  { href: "/patient/coordination", label: "Coordination", icon: <Users className="h-4 w-4" /> },
  { href: "/patient/appointments", label: "Appointments", icon: <Calendar className="h-4 w-4" /> },
  { href: "/patient/communication", label: "Communication", icon: <MessageSquare className="h-4 w-4" /> },
  { href: "/patient/profile", label: "Profile", icon: <User className="h-4 w-4" /> },
  { href: "/patient/security", label: "Security", icon: <Shield className="h-4 w-4" /> },
  { href: "/patient/consents", label: "Consents", icon: <ClipboardCheck className="h-4 w-4" /> },
  { href: "/patient/timeline", label: "Journey Timeline", icon: <Clock className="h-4 w-4" /> },
  { href: "/patient/hub", label: "Journey Hub", icon: <Sparkles className="h-4 w-4" /> },
];

export function PatientLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/patient/login";
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between border-b px-4 py-4">
          <Link href="/patient/dashboard" className="text-lg font-semibold">
            Patient Portal
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1 hover:bg-accent lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="border-t p-3">
          <div className="mb-2 truncate text-xs text-muted-foreground">
            {user?.email}
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex items-center border-b bg-card px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="mr-3 rounded-md p-1 hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">Patient Portal</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}