// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Journey Timeline Page (Wave 3)        │
// │ IVF journey timeline with stage progression, milestones,   │
// │ historical events, expected dates, and progress tracking.  │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Route,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Trophy,
  Sparkles,
  ArrowUpRight,
  ListChecks,
  History,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  PartyPopper,
  Flag,
  Target,
  Star,
  RefreshCw,
} from "lucide-react";
import {
  getTimeline,
  advanceStage,
  getProgress,
  getMilestones,
  getEvents,
} from "@/lib/timeline-api";
import type {
  FullTimeline,
  StageStatus,
  Milestone,
  TimelineEvent,
  IvfStage,
  ProgressSummary,
} from "@/lib/timeline-api";

// ═══════════════════════════════════════════════════════════
// Stage Colors & Icons
// ═══════════════════════════════════════════════════════════

const STAGE_CONFIG: Record<IvfStage, { color: string; bg: string; border: string }> = {
  registration:   { color: "text-purple-600",   bg: "bg-purple-100",   border: "border-purple-300" },
  consultation:   { color: "text-blue-600",     bg: "bg-blue-100",     border: "border-blue-300" },
  treatment_plan: { color: "text-indigo-600",   bg: "bg-indigo-100",   border: "border-indigo-300" },
  ivf_cycle:      { color: "text-pink-600",     bg: "bg-pink-100",     border: "border-pink-300" },
  retrieval:      { color: "text-amber-600",    bg: "bg-amber-100",    border: "border-amber-300" },
  transfer:       { color: "text-orange-600",   bg: "bg-orange-100",   border: "border-orange-300" },
  follow_up:      { color: "text-teal-600",     bg: "bg-teal-100",     border: "border-teal-300" },
  success:        { color: "text-green-600",    bg: "bg-green-100",    border: "border-green-300" },
};

const MILESTONE_COLORS: Record<string, string> = {
  registration:     "bg-purple-100 text-purple-700",
  consultation:     "bg-blue-100 text-blue-700",
  treatment_plan:   "bg-indigo-100 text-indigo-700",
  ivf_cycle_start:  "bg-pink-100 text-pink-700",
  retrieval:        "bg-amber-100 text-amber-700",
  transfer:         "bg-orange-100 text-orange-700",
  pregnancy_test:   "bg-rose-100 text-rose-700",
  follow_up:        "bg-teal-100 text-teal-700",
  success:          "bg-green-100 text-green-700",
  procedure:        "bg-amber-100 text-amber-700",
  custom:           "bg-slate-100 text-slate-700",
};

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86_400_000,
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff} days ago`;
}

// ═══════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════

function StageIcon({ stage, status }: { stage: IvfStage; status: string }) {
  if (status === "completed") {
    return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  }
  if (status === "active") {
    return <Sparkles className="h-5 w-5 text-blue-600 animate-pulse" />;
  }
  return <Circle className="h-5 w-5 text-muted-foreground/40" />;
}

function StageBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-100 text-green-700 border-green-200">Completed</Badge>;
    case "active":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 animate-pulse">In Progress</Badge>;
    case "skipped":
      return <Badge variant="outline" className="text-muted-foreground">Skipped</Badge>;
    default:
      return <Badge variant="outline" className="text-muted-foreground/60">Pending</Badge>;
  }
}

function StageTimeline({ stages }: { stages: StageStatus[] }) {
  return (
    <div className="relative space-y-0">
      {stages.map((stage, index) => {
        const config = STAGE_CONFIG[stage.stage];
        const isCompleted = stage.status === "completed";
        const isActive = stage.status === "active";

        return (
          <div key={stage.stage} className="relative flex gap-4 pb-8 last:pb-0">
            {/* Vertical connector line */}
            {index < stages.length - 1 && (
              <div
                className={`absolute left-[17px] top-8 w-0.5 h-full -translate-x-1/2 ${
                  isCompleted ? "bg-green-300" : "bg-muted-foreground/20"
                }`}
              />
            )}

            {/* Stage dot */}
            <div className="relative z-10 mt-0.5 flex-shrink-0">
              <StageIcon stage={stage.stage} status={stage.status} />
            </div>

            {/* Stage content */}
            <div
              className={`flex-1 min-w-0 rounded-lg border p-3 ${
                isActive
                  ? `bg-blue-50/50 border-blue-200 ${config.color}`
                  : isCompleted
                    ? "bg-green-50/30 border-green-200"
                    : "bg-background"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium ${isActive ? config.color : ""}`}>
                      {stage.label}
                    </span>
                    <StageBadge status={stage.status} />
                  </div>
                  {stage.expectedDurationDays > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Typical duration: {stage.expectedDurationDays} days
                    </p>
                  )}
                </div>
              </div>

              {/* Date info */}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {stage.enteredAt && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Started: {formatDate(stage.enteredAt)}
                  </span>
                )}
                {stage.completedAt && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Completed: {formatDate(stage.completedAt)}
                    {stage.actualDurationDays !== null && ` (${stage.actualDurationDays}d)`}
                  </span>
                )}
                {isActive && stage.expectedCompletionDate && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Expected: {formatDate(stage.expectedCompletionDate)}
                  </span>
                )}
                {isActive && !stage.enteredAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Awaiting start
                  </span>
                )}
              </div>

              {stage.notes && (
                <p className="mt-2 text-xs text-muted-foreground/80 italic">{stage.notes}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const colorClass = MILESTONE_COLORS[milestone.type] ?? MILESTONE_COLORS.custom;

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        milestone.achieved ? "bg-green-50/30 border-green-200" : "bg-background"
      }`}
    >
      <div className="mt-0.5 flex-shrink-0">
        {milestone.achieved ? (
          <Trophy className="h-4 w-4 text-green-600" />
        ) : (
          <Flag className="h-4 w-4 text-muted-foreground/40" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{milestone.title}</span>
          <Badge className={colorClass}>{milestone.type}</Badge>
          {milestone.autoGenerated && (
            <Badge variant="outline" className="text-xs">Auto</Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{milestone.description}</p>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(milestone.date)}
          </span>
          {milestone.achieved && milestone.achievedAt && (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              Achieved {daysAgo(milestone.achievedAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EventItem({ event }: { event: TimelineEvent }) {
  const categoryColors: Record<string, string> = {
    stage_change: "bg-blue-100 text-blue-700",
    milestone_achieved: "bg-green-100 text-green-700",
    task_completed: "bg-amber-100 text-amber-700",
    appointment_scheduled: "bg-purple-100 text-purple-700",
    note_added: "bg-slate-100 text-slate-700",
    system: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 flex-shrink-0">
        <History className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{event.title}</span>
          <Badge className={categoryColors[event.category] ?? "bg-gray-100 text-gray-700"}>
            {event.category.replace("_", " ")}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
        <span className="text-xs text-muted-foreground/60">{formatDate(event.timestamp)}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

export default function JourneyTimelinePage() {
  const [timeline, setTimeline] = useState<FullTimeline | null>(null);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [showEvents, setShowEvents] = useState(true);
  const [showMilestones, setShowMilestones] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [timelineData, progressData, milestonesData, eventsData] = await Promise.all([
        getTimeline(),
        getProgress(),
        getMilestones(),
        getEvents(),
      ]);
      setTimeline(timelineData);
      setProgress(progressData);
      setMilestones(milestonesData);
      setEvents(eventsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timeline data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdvanceStage = async () => {
    try {
      setAdvancing(true);
      await advanceStage("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to advance stage");
    } finally {
      setAdvancing(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Spinner className="h-8 w-8 animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading your journey timeline...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !timeline) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Unable to Load Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadData} variant="outline" size="sm">
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!timeline) return null;

  const { stages, milestones: allMilestones, events: allEvents } = timeline;
  const activeStage = stages.find((s) => s.status === "active");
  const completedCount = stages.filter((s) => s.status === "completed").length;

  return (
    <div className="space-y-6">
      {/* ── Progress Overview ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                IVF Journey Timeline
              </CardTitle>
              <CardDescription>
                {completedCount} of {stages.length} stages completed
              </CardDescription>
            </div>
            {progress && (
              <div className="text-right">
                <div className="text-2xl font-bold">{progress.overallPercent}%</div>
                <div className="text-xs text-muted-foreground">Overall Progress</div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progress?.overallPercent ?? 0} className="h-2" />
          {activeStage && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-blue-600 animate-pulse" />
              <span className="font-medium">
                Current Stage: {activeStage.label}
              </span>
              {activeStage.expectedCompletionDate && (
                <span className="text-muted-foreground">
                  — Expected completion: {formatDate(activeStage.expectedCompletionDate)}
                </span>
              )}
            </div>
          )}
          {progress && progress.estimatedRemainingDays !== null && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Estimated remaining: {progress.estimatedRemainingDays} days
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Stage Timeline ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Stage Progression
          </CardTitle>
          <CardDescription>
            Your journey through each stage of the IVF process
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StageTimeline stages={stages} />
        </CardContent>
      </Card>

      {/* ── Milestones & Events ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Milestones */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Milestones
              <Badge variant="outline" className="ml-auto">
                {allMilestones.filter((m) => m.achieved).length} / {allMilestones.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allMilestones.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No milestones yet. Start your journey to see milestones appear.
                </p>
              )}
              {allMilestones.map((m) => (
                <MilestoneCard key={m.id} milestone={m} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Events */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Event History
            </CardTitle>
            <CardDescription>
              Chronological record of all timeline events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {allEvents.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No events recorded yet.
                </p>
              )}
              {allEvents.map((evt) => (
                <EventItem key={evt.id} event={evt} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Action Bar ───────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {activeStage
                ? `You are currently in the ${activeStage.label} stage.`
                : "Your journey has been completed. Congratulations!"}
            </div>
            {activeStage && (
              <Button
                onClick={handleAdvanceStage}
                disabled={advancing}
                size="sm"
              >
                {advancing ? (
                  <>
                    <Spinner className="h-3 w-3 mr-1" />
                    Advancing...
                  </>
                ) : (
                  <>
                    Advance Stage
                    <ArrowUpRight className="h-3 w-3 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
