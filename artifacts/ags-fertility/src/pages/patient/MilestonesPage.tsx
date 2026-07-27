// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Milestones Page                         │
// │ Treatment milestones tracking with timeline and confetti.   │
// │ Workstream A — Patient Journey                              │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  RefreshCw,
  CheckCircle2,
  Circle,
  Star,
  Sparkles,
  ArrowRight,
  Gift,
} from "lucide-react";
import { getMilestones, type Milestone } from "@/lib/timeline-api";
import { Link } from "wouter";

const milestoneTypeConfig = {
  registration: { label: "Registration", color: "bg-purple-100 text-purple-700", icon: Star },
  consultation: { label: "Consultation", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  treatment_plan: { label: "Treatment Plan", color: "bg-indigo-100 text-indigo-700", icon: Sparkles },
  procedure: { label: "Procedure", color: "bg-amber-100 text-amber-700", icon: Gift },
  follow_up: { label: "Follow-up", color: "bg-teal-100 text-teal-700", icon: ArrowRight },
  success: { label: "Success", color: "bg-green-100 text-green-700", icon: Trophy },
} as const;

function getConfetti(): { id: number; x: number; delay: number; color: string; shape: string }[] {
  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];
  const shapes = ["circle", "square", "triangle"];
  return Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    shape: shapes[Math.floor(Math.random() * shapes.length)],
  }));
}

function ConfettiExplosion({ show }: { show: boolean }) {
  const [particles, setParticles] = useState<{ id: number; x: number; delay: number; color: string; shape: string }[]>([]);

  useEffect(() => {
    if (show) {
      setParticles(getConfetti());
    } else {
      setParticles([]);
    }
  }, [show]);

  if (!show || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti"
          style={{
            left: `${p.x}%`,
            top: "-10px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        >
          <div
            className={`w-3 h-3 ${
              p.shape === "circle" ? "rounded-full" : p.shape === "square" ? "rounded-sm" : "rounded-sm rotate-45"
            }`}
            style={{ backgroundColor: p.color }}
          />
        </div>
      ))}
    </div>
  );
}

export default function MilestonesPage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [hasNewAchievement, setHasNewAchievement] = useState(false);

  const fetchMilestones = async () => {
    try {
      setLoading(true);
      const data = await getMilestones();
      const sorted = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setMilestones(sorted);

      // Check if there are any achieved milestones — show confetti for new achievements
      const achieved = data.filter((m) => m.achieved);
      if (achieved.length > 0) {
        setHasNewAchievement(true);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load milestones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMilestones();
  }, []);

  const achieved = milestones.filter((m) => m.achieved);
  const upcoming = milestones.filter((m) => !m.achieved);
  const nextMilestone = upcoming[0];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <ConfettiExplosion show={showConfetti} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Milestones</h1>
          <p className="mt-1 text-muted-foreground">
            Track your treatment journey milestones and celebrate progress
          </p>
        </div>
        <Link href="/patient/care-plan">
          <Button variant="outline" className="gap-2">
            <ArrowRight className="h-4 w-4" />
            View Care Plan
          </Button>
        </Link>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Trophy className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{achieved.length}</p>
              <p className="text-xs text-muted-foreground">Achieved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <Star className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upcoming.length}</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{milestones.length}</p>
              <p className="text-xs text-muted-foreground">Total Milestones</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Next Milestone Highlight */}
      {nextMilestone && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-amber-500" />
              Next Milestone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-dashed border-amber-300 bg-amber-50">
                <Star className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{nextMilestone.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{nextMilestone.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Target: {new Date(nextMilestone.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading milestones...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchMilestones}>
              <RefreshCw className="mr-2 h-3 w-3" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <>
          {/* Achieved Milestones */}
          {achieved.length > 0 && (
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                <Trophy className="h-5 w-5 text-green-500" />
                Achieved
              </h2>
              <div className="space-y-3">
                {achieved.map((milestone) => {
                  const config = milestoneTypeConfig[milestone.type];
                  const Icon = config.icon;

                  return (
                    <Card key={milestone.id} className="border-green-200 bg-green-50/50">
                      <CardContent className="flex items-start gap-4 py-4">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-green-500 bg-green-100">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-medium">{milestone.title}</h3>
                            <Badge className={config.color}>{config.label}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{milestone.description}</p>
                          {milestone.achievedAt && (
                            <p className="mt-2 text-xs text-green-600">
                              Achieved: {new Date(milestone.achievedAt).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Milestones */}
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
              <Star className="h-5 w-5 text-amber-500" />
              Upcoming Milestones
            </h2>
            <div className="space-y-3">
              {upcoming.map((milestone, index) => {
                const config = milestoneTypeConfig[milestone.type];
                const Icon = config.icon;

                return (
                  <Card key={milestone.id}>
                    <CardContent className="flex items-start gap-4 py-4">
                      {/* Timeline connector */}
                      {index < upcoming.length - 1 && (
                        <div className="absolute left-8 top-14 bottom-0 w-0.5 bg-border" aria-hidden="true" />
                      )}
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-50">
                        <Icon className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-medium">{milestone.title}</h3>
                          <Badge className={config.color}>{config.label}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{milestone.description}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Target: {new Date(milestone.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {upcoming.length === 0 && achieved.length > 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Trophy className="h-12 w-12 text-green-500 mb-4" />
                    <h3 className="text-lg font-semibold">All Milestones Achieved!</h3>
                    <p className="text-muted-foreground text-center mt-1">
                      Congratulations on completing your treatment journey milestones. New milestones will be added as you progress.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}