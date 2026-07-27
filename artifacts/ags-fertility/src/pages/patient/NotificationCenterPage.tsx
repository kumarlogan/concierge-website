// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Notification Center                    │
// │ View notification categories including timeline-specific   │
// │ updates for treatment phases, milestones, and tasks.       │
// │ Wave 5 — Patient Workspace                                 │
// │ Workstream A — Timeline Notifications                      │
// └─────────────────────────────────────────────────────────────┘

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, ArrowRight, Route, Trophy, ListTodo, Clock } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const notificationCategories = [
  {
    title: "Security Alerts",
    description: "Login notifications, MFA changes, and security events",
    color: "text-purple-500",
    icon: Bell,
    href: null,
  },
  {
    title: "Consent Updates",
    description: "When a consent is granted, revoked, or expired",
    color: "text-blue-500",
    icon: Bell,
    href: null,
  },
  {
    title: "Appointment Reminders",
    description: "Upcoming appointments and schedule changes",
    color: "text-green-500",
    icon: Bell,
    href: "/patient/appointments",
  },
  {
    title: "Treatment Phase Changes",
    description: "Notifications when you move to a new treatment phase",
    color: "text-rose-500",
    icon: Route,
    href: "/patient/care-plan",
  },
  {
    title: "Milestone Reached",
    description: "Celebrate when you achieve a treatment milestone",
    color: "text-amber-500",
    icon: Trophy,
    href: "/patient/milestones",
  },
  {
    title: "Task Due Reminders",
    description: "Reminders for upcoming or overdue treatment tasks",
    color: "text-orange-500",
    icon: ListTodo,
    href: "/patient/tasks",
  },
  {
    title: "System Notifications",
    description: "Portal updates, maintenance announcements, and alerts",
    color: "text-gray-500",
    icon: Bell,
    href: null,
  },
];

export default function NotificationCenterPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="mt-1 text-muted-foreground">
          Stay informed about your account, appointments, treatment journey, and care team updates.
        </p>
      </div>

      <Card className="relative overflow-hidden">
        {/* Coming Soon banner */}
        <div className="absolute right-0 top-0 z-10">
          <Badge className="rounded-bl-lg rounded-tr-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-wider">
            Coming Soon
          </Badge>
        </div>

        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Notification Center</CardTitle>
              <CardDescription>
                Real-time updates about your account, treatment journey, and care coordination
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Coming Soon hero */}
          <div className="rounded-lg border bg-muted/30 p-6 text-center">
            <BellOff className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <h3 className="mt-3 text-base font-medium">
              Notifications are not yet available
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              The notification service will be integrated with the platform event bus
              in a future wave. Once active, you'll receive real-time alerts here for
              all your treatment journey updates.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href="/patient/care-plan">
                <Button variant="outline" size="sm" className="gap-1">
                  <Route className="h-3.5 w-3.5" />
                  Care Plan
                </Button>
              </Link>
              <Link href="/patient/tasks">
                <Button variant="outline" size="sm" className="gap-1">
                  <ListTodo className="h-3.5 w-3.5" />
                  Tasks
                </Button>
              </Link>
              <Link href="/patient/milestones">
                <Button variant="outline" size="sm" className="gap-1">
                  <Trophy className="h-3.5 w-3.5" />
                  Milestones
                </Button>
              </Link>
            </div>
          </div>

          {/* Preview of notification types */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Notification types
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {notificationCategories.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex items-center gap-3 rounded-lg border bg-background p-3"
                  >
                    <div className={`flex-shrink-0 ${item.color}`}>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted/50">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </p>
                    </div>
                    {item.href ? (
                      <Link href={item.href}>
                        <ArrowRight className="ml-auto h-4 w-4 flex-shrink-0 text-muted-foreground/40 hover:text-foreground cursor-pointer" />
                      </Link>
                    ) : (
                      <ArrowRight className="ml-auto h-4 w-4 flex-shrink-0 text-muted-foreground/40" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60">
            Notifications are delivered in real-time via the platform event bus.
            Timeline notifications include treatment phase changes, milestone reached alerts,
            and task due reminders. This feature will be activated in Wave 6+.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}