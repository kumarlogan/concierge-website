// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Provider Dashboard Page                 │
// │ Dashboard showing today's schedule, pending actions,        │
// │ and patient status overview for clinic providers.           │
// │ Workstream B — Clinic Experience                             │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  Users,
  MessageSquare,
  Activity,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Stethoscope,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Link } from "wouter";

interface TodayAppointment {
  id: string;
  patientName: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  type: string;
}

interface PendingAction {
  id: string;
  type: string;
  description: string;
  patientName: string;
  priority: "high" | "medium" | "low";
}

interface PatientStatusSummary {
  status: string;
  count: number;
  color: string;
}

const _mockAppointments: TodayAppointment[] = [
  { id: "apt-001", patientName: "Alice Johnson", title: "Initial Consultation", startAt: "2026-07-27T09:00:00Z", endAt: "2026-07-27T09:45:00Z", status: "confirmed", type: "consultation" },
  { id: "apt-002", patientName: "Bob Smith", title: "Follow-up", startAt: "2026-07-27T10:00:00Z", endAt: "2026-07-27T10:30:00Z", status: "scheduled", type: "follow_up" },
  { id: "apt-003", patientName: "Carol Davis", title: "IVF Consultation", startAt: "2026-07-27T11:00:00Z", endAt: "2026-07-27T12:00:00Z", status: "confirmed", type: "consultation" },
  { id: "apt-004", patientName: "Grace Lee", title: "Ultrasound", startAt: "2026-07-27T13:00:00Z", endAt: "2026-07-27T13:30:00Z", status: "in_progress", type: "procedure" },
  { id: "apt-005", patientName: "Henry Kim", title: "New Patient Intake", startAt: "2026-07-27T14:00:00Z", endAt: "2026-07-27T14:45:00Z", status: "scheduled", type: "consultation" },
];

const _mockPendingActions: PendingAction[] = [
  { id: "act-001", type: "lab_results", description: "Review lab results", patientName: "Alice Johnson", priority: "high" },
  { id: "act-002", type: "consent", description: "Approve consent form", patientName: "Bob Smith", priority: "medium" },
  { id: "act-003", type: "message", description: "Reply to patient message", patientName: "Eva Martinez", priority: "low" },
];

const _mockStatusSummary: PatientStatusSummary[] = [
  { status: "Active", count: 45, color: "text-green-500" },
  { status: "Pending", count: 12, color: "text-amber-500" },
  { status: "Completed", count: 89, color: "text-blue-500" },
  { status: "Inactive", count: 23, color: "text-gray-500" },
];

function statusBadgeVariant(status: string) {
  switch (status) {
    case "confirmed": return "default";
    case "scheduled": return "secondary";
    case "in_progress": return "outline";
    case "completed": return "secondary";
    case "cancelled": return "destructive";
    default: return "secondary";
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function priorityColor(p: string): string {
  switch (p) {
    case "high": return "text-red-500";
    case "medium": return "text-amber-500";
    case "low": return "text-blue-500";
    default: return "text-gray-500";
  }
}

export default function ProviderDashboardPage() {
  const [appointments] = useState<TodayAppointment[]>(_mockAppointments);
  const [pendingActions] = useState<PendingAction[]>(_mockPendingActions);
  const [statusSummary] = useState<PatientStatusSummary[]>(_mockStatusSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // In production, this would call the API
      // const res = await fetch('/api/v1/clinic/schedule/today');
      // const data = await res.json();
      // setAppointments(data.appointments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-800">{error}</p>
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchData}>
            <RefreshCw className="mr-1 h-3 w-3" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Provider Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        {loading && <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />}
      </div>

      {/* Patient Status Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statusSummary.map((s) => (
          <Card key={s.status}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{s.status}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
              </div>
              <Activity className={`h-8 w-8 ${s.color} opacity-50`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Schedule */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-primary" />
                Today&apos;s Schedule
              </CardTitle>
              <CardDescription>{appointments.length} appointment(s)</CardDescription>
            </div>
            <Link href="/clinic/schedule">
              <Button variant="ghost" size="sm" className="gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{apt.patientName}</p>
                      <p className="text-xs text-muted-foreground">{apt.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(apt.startAt)} - {formatTime(apt.endAt)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusBadgeVariant(apt.status)} className="capitalize">
                    {statusLabel(apt.status)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Pending Actions
            </CardTitle>
            <CardDescription>{pendingActions.length} items requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingActions.map((action) => (
                <div key={action.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${priorityColor(action.priority)}`}>
                      {action.priority === "high" ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{action.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {action.patientName} &middot; {action.type.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`capitalize ${priorityColor(action.priority)}`}
                  >
                    {action.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/clinic/schedule">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Full Schedule</h3>
                <p className="text-xs text-muted-foreground">View and manage all appointments</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/clinic/messages">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Messages</h3>
                <p className="text-xs text-muted-foreground">Patient triage and communications</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/clinic/patients">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">All Patients</h3>
                <p className="text-xs text-muted-foreground">Browse and manage patient records</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}