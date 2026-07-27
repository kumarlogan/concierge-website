// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Care Plan Page                          │
// │ Displays the patient's fertility treatment care plan with   │
// │ phases, timeline progress, and next steps.                  │
// │ Workstream A — Patient Journey                              │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  RefreshCw,
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  Sparkles,
  Route,
} from "lucide-react";
import { getPhases, type CarePlanPhase } from "@/lib/timeline-api";
import { Link } from "wouter";

const phaseStatusConfig = {
  not_started: {
    label: "Not Started",
    color: "bg-gray-100 text-gray-600",
    icon: Circle,
  },
  in_progress: {
    label: "In Progress",
    color: "bg-blue-100 text-blue-700",
    icon: Clock,
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle2,
  },
} as const;

export default function CarePlanPage() {
  const [phases, setPhases] = useState<CarePlanPhase[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getPhases();
      setPhases(data.phases.sort((a, b) => a.order - b.order));
      setCurrentPhase(data.currentPhase);
      setProgressPercent(data.progressPercent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load care plan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Find current phase name for display
  const currentPhaseData = phases.find((p) => p.id === currentPhase);
  const nextPhase = phases.find((p) => p.status === "not_started");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Care Plan</h1>
          <p className="mt-1 text-muted-foreground">
            Your personalized fertility treatment journey
          </p>
        </div>
        <Link href="/patient/timeline">
          <Button variant="outline" className="gap-2">
            <Route className="h-4 w-4" />
            View Timeline
          </Button>
        </Link>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading care plan...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchData}>
              <RefreshCw className="mr-2 h-3 w-3" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <>
          {/* Progress Overview */}
          <Card className="relative overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Treatment Progress</CardTitle>
                    <CardDescription>
                      {currentPhaseData
                        ? `Currently in: ${currentPhaseData.name}`
                        : "Your journey is about to begin"}
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

          {/* Current Phase Highlight */}
          {currentPhaseData && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-primary" />
                    Current Phase
                  </CardTitle>
                  <Badge className="bg-blue-100 text-blue-700">In Progress</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="font-semibold">{currentPhaseData.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{currentPhaseData.description}</p>
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tasks in this phase</p>
                  <ul className="mt-2 space-y-2">
                    {currentPhaseData.tasks.map((task) => (
                      <li key={task} className="flex items-center gap-2 text-sm">
                        <Circle className="h-3 w-3 text-muted-foreground" />
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link href="/patient/tasks">
                  <Button variant="outline" size="sm" className="mt-4 gap-2">
                    View Tasks
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Next Steps */}
          {nextPhase && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  Next Steps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <h3 className="font-semibold">{nextPhase.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{nextPhase.description}</p>
              </CardContent>
            </Card>
          )}

          {/* All Phases Timeline */}
          <div>
            <h2 className="mb-4 text-xl font-semibold">Treatment Phases</h2>
            <div className="space-y-4">
              {phases.map((phase, index) => {
                const config = phaseStatusConfig[phase.status];
                const Icon = config.icon;
                const isCurrent = phase.id === currentPhase;

                return (
                  <Card
                    key={phase.id}
                    className={`relative ${isCurrent ? "border-primary/50 ring-1 ring-primary/20" : ""}`}
                  >
                    {/* Phase connector line */}
                    {index < phases.length - 1 && (
                      <div className="absolute left-8 top-16 bottom-0 w-0.5 bg-border" aria-hidden="true" />
                    )}
                    <CardContent className="flex items-start gap-4 py-4">
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                          phase.status === "completed"
                            ? "border-green-500 bg-green-50"
                            : phase.status === "in_progress"
                              ? "border-primary bg-primary/10"
                              : "border-gray-300 bg-gray-50"
                        }`}
                        aria-hidden="true"
                      >
                        <Icon
                          className={`h-5 w-5 ${
                            phase.status === "completed"
                              ? "text-green-600"
                              : phase.status === "in_progress"
                                ? "text-primary"
                                : "text-gray-400"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-medium">{phase.name}</h3>
                          <Badge className={config.color}>{config.label}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{phase.description}</p>
                        {phase.startDate && (
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Started: {new Date(phase.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                            {phase.completedDate && (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                Completed: {new Date(phase.completedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="mt-2">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tasks</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {phase.tasks.map((task) => (
                              <Badge key={task} variant="secondary" className="text-xs font-normal">
                                <ClipboardList className="mr-1 h-3 w-3" />
                                {task}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}