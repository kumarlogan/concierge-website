// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Journey Timeline                       │
// │ This feature is coming in a future wave.                   │
// │ Wave 5 — Patient Workspace                                  │
// └─────────────────────────────────────────────────────────────┘

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Route, Clock, ArrowRight } from "lucide-react";

export default function JourneyTimelinePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Journey Timeline</h1>
        <p className="mt-1 text-muted-foreground">
          Track your treatment journey from registration through ongoing care.
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
              <Route className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Treatment Journey</CardTitle>
              <CardDescription>
                A visual timeline of your fertility treatment milestones
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Preview of what's coming */}
          <div className="rounded-lg border bg-muted/30 p-6 text-center">
            <Clock className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <h3 className="mt-3 text-base font-medium">Interactive Timeline</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your treatment journey will be visualized here, showing key milestones
              from registration through ongoing care — including consultations,
              medications, procedures, and recovery tracking.
            </p>
          </div>

          {/* Milestone preview chips */}
          <div className="flex flex-wrap gap-2">
            {["Registration", "Consultation", "Treatment Plan", "Procedure", "Follow-up"].map(
              (step) => (
                <div
                  key={step}
                  className="flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground"
                >
                  {step}
                  <ArrowRight className="h-3 w-3" />
                </div>
              ),
            )}
            <div className="rounded-full border border-dashed bg-background px-3 py-1 text-xs text-muted-foreground/60">
              + more
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60">
            This feature will be activated once the platform event bus and treatment
            tracking services are integrated. Stay tuned.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}