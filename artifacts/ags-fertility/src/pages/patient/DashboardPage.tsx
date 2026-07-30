// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Patient Dashboard Shell                │
// │ Main patient dashboard with overview, quick actions, and   │
// │ journey progress widgets.                                  │
// │ Wave 5 — Patient Workspace                                 │
// │ Workstream A — Patient Journey Enhancements                │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  User,
  Shield,
  ClipboardCheck,
  Bell,
  Calendar,
  Activity,
  MessageSquare,
  ArrowRight,
  Route,
  ListTodo,
  Trophy,
  Users,
  Sparkles,
  Clock,
  Star,
  Loader2,
  RefreshCw,
  Compass,
} from "lucide-react";
import { Link } from "wouter";
import { getTimeline } from "@/lib/timeline-api";

export default function DashboardPage() {
  const { user } = useAuth();
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentPhaseName, setCurrentPhaseName] = useState<string | null>(null);
  const [nextMilestone, setNextMilestone] = useState<{ title: string; description: string; date: string } | null>(null);
  const [upcomingTasksCount, setUpcomingTasksCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const fetchTimelineData = async () => {
    try {
      const data = await getTimeline();
      setProgressPercent(data.carePlan.progressPercent);

      const currentPhase = data.carePlan.phases.find(
        (p) => p.id === data.carePlan.currentPhase
      );
      setCurrentPhaseName(currentPhase?.name ?? null);

      const next = data.milestones.find((m) => !m.achieved);
      setNextMilestone(
        next
          ? {
              title: next.title,
              description: next.description,
              date: next.date,
            }
          : null
      );

      const pendingTasks = data.tasks.filter(
        (t) => t.status === "pending" || t.status === "in_progress"
      );
      setUpcomingTasksCount(pendingTasks.length);
    } catch (err) {
      setTimelineError(err instanceof Error ? err.message : "Failed to load timeline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimelineData();
  }, []);

  const quickActions = [
    {
      title: "Care Plan",
      description: "View your treatment plan and progress",
      href: "/patient/care-plan",
      icon: Route,
      color: "text-rose-500",
    },
    {
      title: "Tasks",
      description: "Manage your treatment to-dos",
      href: "/patient/tasks",
      icon: ListTodo,
      color: "text-orange-500",
    },
    {
      title: "Milestones",
      description: "Track achievements in your journey",
      href: "/patient/milestones",
      icon: Trophy,
      color: "text-amber-500",
    },
    {
      title: "Coordination",
      description: "Your care team and appointments",
      href: "/patient/coordination",
      icon: Users,
      color: "text-cyan-500",
    },
    {
      title: "Appointments",
      description: "Book and manage your appointments",
      href: "/patient/appointments",
      icon: Calendar,
      color: "text-indigo-500",
    },
    {
      title: "Messages",
      description: "Secure messaging with your care team",
      href: "/patient/messages",
      icon: MessageSquare,
      color: "text-teal-500",
    },
    {
      title: "Profile",
      description: "View and update your personal information",
      href: "/patient/profile",
      icon: User,
      color: "text-blue-500",
    },
    {
      title: "Security",
      description: "Manage MFA, sessions, and security settings",
      href: "/patient/security",
      icon: Shield,
      color: "text-purple-500",
    },
    {
      title: "Consents",
      description: "View and manage your data sharing consents",
      href: "/patient/consents",
      icon: ClipboardCheck,
      color: "text-green-500",
    },
    {
      title: "Notifications",
      description: "View your recent notifications",
      href: "/patient/notifications",
      icon: Bell,
      color: "text-amber-500",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* ── Welcome Header ── */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome{user?.displayName ? `, ${user.displayName}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage your patient portal settings and preferences.
        </p>
      </div>

      {/* ── Timeline Error Banner ── */}
      {!loading && timelineError && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-3">
            <RefreshCw className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              Some dashboard data could not be loaded.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-8 text-xs"
              onClick={fetchTimelineData}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Journey Progress Section ── */}
      <Card className="relative overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Your Treatment Journey</CardTitle>
                <CardDescription>
                  {currentPhaseName
                    ? `Currently in: ${currentPhaseName}`
                    : "Track your progress through treatment"}
                </CardDescription>
              </div>
            </div>
            <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progressPercent} className="h-3" aria-label={`Treatment journey ${progressPercent}% complete`} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Registration</span>
            <span>Ongoing Care</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Journey Widgets Row ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Care Plan Phase Indicator */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Route className="h-4 w-4 text-muted-foreground" />
              Care Plan Phase
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : currentPhaseName ? (
              <div>
                <p className="font-medium text-base">{currentPhaseName}</p>
                <Link href="/patient/care-plan">
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1 mt-1">
                    View full plan
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not yet started</p>
            )}
          </CardContent>
        </Card>

        {/* Next Milestone Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-amber-500" />
              Next Milestone
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : nextMilestone ? (
              <div>
                <p className="font-medium text-sm">{nextMilestone.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(nextMilestone.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <Link href="/patient/milestones">
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1 mt-1">
                    View milestones
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">All milestones achieved!</p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Tasks Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              Upcoming Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <div>
                <p className="text-2xl font-bold">{upcomingTasksCount}</p>
                <p className="text-xs text-muted-foreground">
                  {upcomingTasksCount === 1 ? "task" : "tasks"} pending or in progress
                </p>
                <Link href="/patient/tasks">
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1 mt-1">
                    View all tasks
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Identity Summary ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="text-sm font-medium">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd>
                <Badge
                  variant={user?.status === "active" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {user?.status ?? "unknown"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">MFA</dt>
              <dd className="text-sm font-medium">
                {user?.mfaEnabled ? (
                  <Badge variant="outline" className="text-green-500">
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-500">
                    Not Configured
                  </Badge>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* ── Getting Started for New Users ── */}
      {!loading && !currentPhaseName && !timelineError && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Compass className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Getting Started</CardTitle>
                <CardDescription>
                  Your fertility journey is about to begin. Here's how to get started.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              <li className="flex items-start gap-3 text-sm">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  1
                </span>
                <div>
                  <p className="font-medium">Complete your profile</p>
                  <p className="text-muted-foreground">Add your personal details to get personalized care.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  2
                </span>
                <div>
                  <p className="font-medium">Book your first appointment</p>
                  <p className="text-muted-foreground">Schedule an initial consultation with a specialist.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  3
                </span>
                <div>
                  <p className="font-medium">Review your consents</p>
                  <p className="text-muted-foreground">Set your data sharing preferences in the Trust Runtime.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  4
                </span>
                <div>
                  <p className="font-medium">Explore your care plan</p>
                  <p className="text-muted-foreground">View your personalized treatment journey and milestones.</p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>
      )}

      {/* ── Quick Actions ── */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="flex items-start gap-4 p-4">
                    <div className={`rounded-lg bg-muted p-2 ${action.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{action.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Placeholder Sections ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Upcoming Appointments
            </CardTitle>
            <CardDescription>No upcoming appointments</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your appointment information will appear here once scheduled.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
            <CardDescription>No recent activity</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your recent portal activity will appear here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Messages
            </CardTitle>
            <CardDescription>No unread messages</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/patient/messages">
              <Button variant="outline" size="sm" className="gap-2">
                View Messages
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* ── Journey Timeline link ── */}
      <div className="text-center">
        <Link href="/patient/timeline">
          <Button variant="outline" className="gap-2">
            View Your Treatment Journey
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}