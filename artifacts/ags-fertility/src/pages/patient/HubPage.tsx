// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Patient Journey Hub                      │
// │ Central hub for patient journey: timeline summary,          │
// │ care team chat, upcoming tasks & milestones, quick links.   │
// │ Wave 6 — Patient Journey Hub                                   │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  CheckCircle2,
  CircleDot,
  ListTodo,
  Trophy,
  MessageSquare,
  ChevronRight,
  Loader2,
  AlertCircle,
  Calendar,
  Users,
  Route,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { getTimeline } from "@/lib/timeline-api";
import { ChatPanel } from "@/components/patient/ChatPanel";
import type { ChatMessage } from "@/components/patient/ChatPanel";

// ── Helper ──────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return "TBD";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Components ──────────────────────────────────────

function JourneySummary({
  progressPercent,
  currentPhaseName,
  nextMilestone,
}: {
  progressPercent: number;
  currentPhaseName: string | null;
  nextMilestone: { title: string; date: string } | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Journey Overview
        </CardTitle>
        <CardDescription>Your current progress and next steps</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {currentPhaseName && (
          <div className="flex items-center gap-2 text-sm">
            <CircleDot className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Current Phase:</span>
            <span className="font-medium">{currentPhaseName}</span>
          </div>
        )}

        {nextMilestone && (
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="text-muted-foreground">Next Milestone:</span>
            <span className="font-medium">{nextMilestone.title}</span>
            <Badge variant="outline" className="ml-auto text-[10px]">
              {formatDate(nextMilestone.date)}
            </Badge>
          </div>
        )}

        <Link href="/patient/timeline">
          <Button variant="outline" size="sm" className="w-full">
            <Route className="mr-2 h-4 w-4" />
            View Full Journey Timeline
            <ChevronRight className="ml-auto h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function UpcomingTasks({
  tasks,
  loading,
  error,
}: {
  tasks: Array<{ id: string; title: string; status: string; dueDate: string | null }>;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            Upcoming Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tasks...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Upcoming Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            Upcoming Tasks
          </CardTitle>
          <CardDescription>No pending tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All caught up! No tasks are pending right now.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="h-4 w-4 text-orange-500" />
          Upcoming Tasks
          <Badge variant="secondary" className="ml-auto">
            {tasks.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2" role="list">
          {tasks.slice(0, 5).map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-accent/50"
            >
              <CircleDot className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                {task.dueDate && (
                  <p className="text-[11px] text-muted-foreground">
                    Due {formatDate(task.dueDate)}
                  </p>
                )}
              </div>
              <Badge
                variant={
                  task.status === "in_progress"
                    ? "default"
                    : "secondary"
                }
                className="text-[10px]"
              >
                {task.status.replace("_", " ")}
              </Badge>
            </li>
          ))}
        </ul>
        {tasks.length >= 5 && (
          <Link href="/patient/tasks">
            <Button variant="outline" size="sm" className="w-full mt-3">
              View All Tasks
              <ChevronRight className="ml-auto h-4 w-4" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function NextMilestone({
  milestone,
  loading,
  error,
}: {
  milestone: { title: string; description: string; date: string; type: string } | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) return null;
  if (error) return null;
  if (!milestone) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-amber-500" />
            Next Milestone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">All milestones achieved!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-amber-500" />
          Next Milestone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-medium">{milestone.title}</p>
          <p className="text-sm text-muted-foreground">{milestone.description}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Target:</span>
          <Badge variant="outline">{formatDate(milestone.date)}</Badge>
          <Badge
            variant="outline"
            className="ml-auto capitalize"
          >
            {milestone.type.replace("_", " ")}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────

interface PatientHubPageMessage extends ChatMessage {
  role: "user" | "assistant" | "system";
}

export default function PatientHubPage() {
  const { user } = useAuth();

  const [timelineData, setTimelineData] = useState<{
    progressPercent: number;
    currentPhaseName: string | null;
    nextMilestone: { title: string; description: string; date: string; type: string } | null;
    upcomingTasks: Array<{ id: string; title: string; status: string; dueDate: string | null }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const data = await getTimeline();

      const nextMs = data.milestones.find((m) => !m.achieved);
      const inProgressStage = data.stages.find(
        (s) => s.status === "active"
      );
      const currentPhaseName = inProgressStage?.label ?? null;

      setTimelineData({
        progressPercent: data.progress.overallPercent,
        currentPhaseName,
        nextMilestone: nextMs
          ? {
              title: nextMs.title,
              description: nextMs.description,
              date: nextMs.date,
              type: nextMs.type,
            }
          : null,
        upcomingTasks: data.milestones
          .filter((m) => !m.achieved)
          .slice(0, 5)
          .map((m) => ({
            id: m.id,
            title: m.title,
            status: m.achieved ? "completed" : "pending",
            dueDate: m.date,
          })),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load journey data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, []);

  const handleChatSend = async (message: string) => {
    // Placeholder for actual chat integration
    // In production, this would call the coordination/chat API
    // and add the response to chatMessages state
  };

  return (
    <div className="space-y-6" role="main" aria-label="Patient Journey Hub">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Patient Journey Hub
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back, {user?.displayName || user?.email}. Here is your journey at a glance.
        </p>
      </div>

      {/* Error State */}
      {error && !loading && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchTimeline}>
            Try Again
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12" role="status" aria-label="Loading journey data">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Loading your journey overview...</p>
          </div>
        </div>
      )}

      {/* Hub Grid */}
      {timelineData && !loading && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Journey Summary — spans 2 cols on lg */}
            <div className="lg:col-span-2">
              <JourneySummary
                progressPercent={timelineData.progressPercent}
                currentPhaseName={timelineData.currentPhaseName}
                nextMilestone={timelineData.nextMilestone}
              />
            </div>

            {/* Quick Nav */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href="/patient/timeline">
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Clock className="mr-2 h-4 w-4" />
                      Journey Timeline
                    </Button>
                  </Link>
                  <Link href="/patient/care-plan">
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Route className="mr-2 h-4 w-4" />
                      Care Plan
                    </Button>
                  </Link>
                  <Link href="/patient/tasks">
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <ListTodo className="mr-2 h-4 w-4" />
                      Tasks
                    </Button>
                  </Link>
                  <Link href="/patient/coordination">
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Users className="mr-2 h-4 w-4" />
                      Care Team
                    </Button>
                  </Link>
                  <Link href="/patient/milestones">
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Trophy className="mr-2 h-4 w-4" />
                      Milestones
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <NextMilestone
                milestone={timelineData.nextMilestone}
                loading={false}
                error={null}
              />
            </div>
          </div>

          {/* Tasks + Chat row */}
          <div className="grid gap-6 md:grid-cols-5">
            <div className="md:col-span-2">
              <UpcomingTasks
                tasks={timelineData.upcomingTasks}
                loading={false}
                error={null}
              />
            </div>
            <div className="md:col-span-3">
              <Card className="h-full flex flex-col" style={{ minHeight: "420px" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Care Companion
                  </CardTitle>
                  <CardDescription>Chat with your care team</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0">
                  <ChatPanel
                    initialMessages={chatMessages}
                    onSend={handleChatSend}
                    placeholder="Ask about your treatment plan, appointments, or next steps..."
                    className="flex-1 border-0 rounded-none"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
