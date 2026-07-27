// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Clinic Workspace Layout                 │
// │ Responsive sidebar + header navigation for clinic area.     │
// │ Workstream B — Clinic Experience                             │
// └─────────────────────────────────────────────────────────────┘

import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  Users,
  Activity,
  Search,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Stethoscope,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  { href: "/clinic/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/clinic/schedule", label: "Schedule", icon: <Calendar className="h-4 w-4" /> },
  { href: "/clinic/patients", label: "Patients", icon: <Users className="h-4 w-4" /> },
  { href: "/clinic/patient-status", label: "Patient Status", icon: <Activity className="h-4 w-4" /> },
  { href: "/clinic/search", label: "Search Patients", icon: <Search className="h-4 w-4" /> },
  { href: "/clinic/messages", label: "Messages", icon: <MessageSquare className="h-4 w-4" /> },
];

export function ClinicLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    window.location.href = "/";
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
          <Link href="/clinic/dashboard" className="text-lg font-semibold">
            <span className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Clinic Portal
            </span>
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

        {/* Bottom section */}
        <div className="border-t p-3">
          <div className="mb-2 truncate text-xs text-muted-foreground">
            Clinic Portal v1.0
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Back to Website
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
          <span className="text-sm font-semibold">Clinic Portal</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}