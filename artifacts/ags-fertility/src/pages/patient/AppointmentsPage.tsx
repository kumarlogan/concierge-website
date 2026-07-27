// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Patient Appointments Page               │
// │ View, create, and manage appointments.                     │
// │ Wave 8 — End-to-End Integration                              │
// │ Wave 8.1 — Shared API adoption: uses appointment-api.ts     │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Video,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { getAppointments, cancelAppointment } from "@/lib/appointment-api";

interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  type: string;
  status: string;
  priority: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  title: string;
  notes: string;
  location: string | null;
}

function statusColor(status: string): string {
  switch (status) {
    case "scheduled":
      return "bg-blue-100 text-blue-800";
    case "confirmed":
      return "bg-green-100 text-green-800";
    case "in_progress":
      return "bg-amber-100 text-amber-800";
    case "completed":
      return "bg-gray-100 text-gray-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function typeIcon(type: string) {
  if (type === "telehealth") return <Video className="h-4 w-4" />;
  return <Calendar className="h-4 w-4" />;
}

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await getAppointments();
      setAppointments(data as Appointment[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleCancel = async (id: string) => {
    try {
      await cancelAppointment(id);
      // Refresh the list after cancellation
      fetchAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground mt-1">
            Manage your upcoming and past appointments
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Book Appointment
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading appointments...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={fetchAppointments}>
                <RefreshCw className="mr-1 h-3 w-3" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && appointments.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No appointments yet</h3>
            <p className="text-muted-foreground text-center mt-1">
              Book your first appointment to get started with your fertility journey.
            </p>
            <Button className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Book Appointment
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Appointments List */}
      {!loading && !error && appointments.length > 0 && (
        <div className="space-y-4">
          {appointments.map((appt) => (
            <Card key={appt.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {typeIcon(appt.type)}
                    <div>
                      <CardTitle className="text-lg">{appt.title}</CardTitle>
                      <CardDescription className="capitalize">
                        {appt.type.replace("_", " ")}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className={statusColor(appt.status)}>
                    {appt.status.replace("_", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(appt.startAt).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {new Date(appt.startAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      ({appt.durationMinutes} min)
                    </span>
                  </div>
                  {appt.location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{appt.location}</span>
                    </div>
                  )}
                </div>
                {appt.notes && (
                  <p className="mt-3 text-sm text-muted-foreground">{appt.notes}</p>
                )}
                <div className="mt-4 flex gap-2">
                  {appt.status === "scheduled" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancel(appt.id)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}