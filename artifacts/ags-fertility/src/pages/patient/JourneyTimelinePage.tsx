// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Journey Timeline Page (Wave 3)          │
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
} from "lucide-react";
import {
  getTimeline,
  advanceStage,
} from "@/lib/timeline-api";
import type {
  FullTimeline,
  StageStatus,
  Milestone,
  TimelineEvent,
  IvfStage,
} from "@/lib/timeline-api";

// ═══════════════════════════════════════════════════════════════
// Stage Colors & Icons
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════

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
            <div className={`flex-1 min-w-0 rounded-lg border p-3 ${
              isActive
                ? `bg-blue-50/50 border-blue-200 ${config.color}`
                : isCompleted
                  ? "bg-green-50/30 border-green-200"
                  : "bg-background"
            }`}>
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
              </div>

              {stage.notes && (
                <p className="mt-1.5 text-xs italic text-muted-foreground">
                  {stage.notes}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MilestoneList({ milestones, limit }: { milestones: Milestone[]; limit?: number }) {
  const [showAll, setShowAll] = useState(false);
  const display = limit && !showAll ? milestones.slice(0, limit) : milestones;

  if (milestones.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-6 text-center">
        <ListChecks className="mx-auto h-6 w-6 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">No milestones yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {display.map((m) => (
        <div
          key={m.id}
          className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
            m.achieved ? "bg-green-50/30 border-green-200" : "bg-background"
          }`}
        >
          <div className="mt-0.5 flex-shrink-0">
            {m.achieved ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium ${m.achieved ? "text-green-700" : ""}`}>
                {m.title}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${MILESTONE_COLORS[m.type] || "bg-slate-100 text-slate-700"}`}>
                {m.type.replace(/_/g, " ")}
              </span>
              {m.autoGenerated && (
                <span className="text-[10px] text-muted-foreground/60">auto</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>{formatDate(m.date)}</span>
              {m.achieved && m.achievedAt && (
                <span className="text-green-600">Achieved {daysAgo(m.achievedAt)}</span>
              )}
              {m.expectedDate && !m.achieved && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Due {formatDate(m.expectedDate)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
      {limit && milestones.length > limit && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <><EyeOff className="mr-1 h-3 w-3" /> Show less</>
          ) : (
            <><Eye className="mr-1 h-3 w-3" /> Show all {milestones.length} milestones</>
          )}
        </Button>
      )}
    </div>
  );
}

function EventLog({ events, limit }: { events: TimelineEvent[]; limit?: number }) {
  const [showAll, setShowAll] = useState(false);
  const display = limit && !showAll ? events.slice(0, limit) : events;

  if (events.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-6 text-center">
        <History className="mx-auto h-6 w-6 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">No events recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {display.map((event) => (
        <div key={event.id} className="flex items-start gap-3 rounded-md p-2 text-sm hover:bg-muted/30">
          <div className="mt-0.5 flex-shrink-0">
            <div className={`h-2 w-2 rounded-full ${
              event.category === "stage_change" ? "bg-blue-400" :
              event.category === "milestone_achieved" ? "bg-green-400" :
              event.category === "system" ? "bg-slate-400" :
              "bg-amber-400"
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs">{event.title}</span>
              <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                {daysAgo(event.timestamp)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{event.description}</p>
          </div>
        </div>
      ))}
      {limit && events.length > limit && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs mt-1"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <><ChevronUp className="mr-1 h-3 w-3" /> Show less</>
          ) : (
            <><ChevronDown className="mr-1 h-3 w-3" /> Show all {events.length} events</>
          )}
        </Button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════

export default function JourneyTimelinePage() {
  const [timeline, setTimeline] = useState<FullTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [advanceSuccess, setAdvanceSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTimeline();
      setTimeline(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timeline");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdvanceStage = async () => {
    try {
      setAdvancing(true);
      setAdvanceSuccess(false);
      await advanceStage();
      setAdvanceSuccess(true);
      await fetchData(); // Refresh
      setTimeout(() => setAdvanceSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to advance stage");
    } finally {
      setAdvancing(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      </div>
    );
  }

  if (error && !timeline) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Journey Timeline</h1>
          <p className="mt-1 text-muted-foreground">Track your treatment journey</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={fetchData}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!timeline) return null;

  const stages = timeline.stages;
  const currentStage = stages.find((s) => s.status === "active");
  const completedStages = stages.filter((s) => s.status === "completed");
  const isAtEnd = currentStage === null && completedStages.length === stages.length;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Journey Timeline</h1>
        <p className="mt-1 text-muted-foreground">
          Track your treatment journey from registration through ongoing care.
        </p>
      </div>

      {/* Progress Overview */}
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Route className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Treatment Progress</CardTitle>
              <CardDescription>
                {currentStage
                  ? `Currently in ${currentStage.label}`
                  : isAtEnd
                    ? "All stages completed"
                    : "Treatment journey overview"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{timeline.progress.overallPercent}% Complete</span>
              <span className="text-muted-foreground">
                {timeline.progress.stagesCompleted} of {timeline.progress.stagesTotal} stages
              </span>
            </div>
            <Progress value={timeline.progress.overallPercent} className="h-3" />
          </div>

          {/* Stats row */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-muted/20 p-3 text-center">
              <Trophy className="mx-auto h-5 w-5 text-amber-500" />
              <p className="mt-1 text-lg font-bold">{timeline.progress.milestonesAchieved}</p>
              <p className="text-[11px] text-muted-foreground">Milestones</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-blue-500" />
              <p className="mt-1 text-lg font-bold">
                {currentStage ? stages.indexOf(currentStage) + 1 : stages.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Current Stage</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 text-center">
              <Calendar className="mx-auto h-5 w-5 text-purple-500" />
              <p className="mt-1 text-lg font-bold">
                {timeline.progress.estimatedRemainingDays ?? "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">Days Remaining</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advance Stage Action */}
      {currentStage && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <ArrowUpRight className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Ready to advance?</p>
                  <p className="text-xs text-muted-foreground">
                    Current: {currentStage.label} → Next in sequence
                  </p>
                </div>
              </div>
              <Button
                onClick={handleAdvanceStage}
                disabled={advancing}
                size="sm"
              >
                {advancing ? <Spinner className="mr-1 h-4 w-4" /> : null}
                Advance Stage
              </Button>
            </div>
            {advanceSuccess && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-green-50 p-2 text-sm text-green-700">
                <PartyPopper className="h-4 w-4" />
                Stage advanced successfully!
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stage Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Route className="h-5 w-5" />
            Treatment Stages
          </CardTitle>
          <CardDescription>
            Your journey through {stages.length} stages of fertility treatment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StageTimeline stages={stages} />
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-amber-500" />
            Milestones
          </CardTitle>
          <CardDescription>
            {timeline.progress.milestonesAchieved} achieved, {timeline.progress.milestonesTotal} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MilestoneList milestones={timeline.milestones} limit={5} />
        </CardContent>
      </Card>

      {/* Event History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Activity History
          </CardTitle>
          <CardDescription>
            Recent events and changes in your treatment journey
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventLog events={timeline.events} limit={10} />
        </CardContent>
      </Card>
    </div>
  );
}