// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Clinic Schedule Page                    │
// │ Calendar view of appointments, filter by provider/status/   │
// │ date, ability to view/confirm/cancel appointments.          │
// │ Workstream B — Clinic Experience                             │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  MapPin,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Filter,
} from "lucide-react";

interface ClinicAppointment {
  id: string;
  patientId: string;
  patientName: string;
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

const _mockAppointments: ClinicAppointment[] = [
  { id: "apt-001", patientId: "patient-001", patientName: "Alice Johnson", providerId: "provider-001", type: "consultation", status: "confirmed", priority: "normal", startAt: "2026-07-27T09:00:00Z", endAt: "2026-07-27T09:45:00Z", durationMinutes: 45, title: "Initial Consultation", notes: "First visit", location: "Room 101" },
  { id: "apt-002", patientId: "patient-002", patientName: "Bob Smith", providerId: "provider-001", type: "follow_up", status: "scheduled", priority: "normal", startAt: "2026-07-27T10:00:00Z", endAt: "2026-07-27T10:30:00Z", durationMinutes: 30, title: "Follow-up", notes: "", location: "Room 102" },
  { id: "apt-003", patientId: "patient-003", patientName: "Carol Davis", providerId: "provider-002", type: "consultation", status: "confirmed", priority: "high", startAt: "2026-07-28T11:00:00Z", endAt: "2026-07-28T12:00:00Z", durationMinutes: 60, title: "IVF Consultation", notes: "Bring previous records", location: "Room 201" },
  { id: "apt-004", patientId: "patient-004", patientName: "David Wilson", providerId: "provider-001", type: "procedure", status: "in_progress", priority: "urgent", startAt: "2026-07-27T13:00:00Z", endAt: "2026-07-27T13:30:00Z", durationMinutes: 30, title: "Ultrasound", notes: "", location: "Ultrasound Suite" },
  { id: "apt-005", patientId: "patient-005", patientName: "Eva Martinez", providerId: "provider-002", type: "telehealth", status: "scheduled", priority: "normal", startAt: "2026-07-29T14:00:00Z", endAt: "2026-07-29T14:30:00Z", durationMinutes: 30, title: "Telehealth Follow-up", notes: "Video call", location: null },
  { id: "apt-006", patientId: "patient-007", patientName: "Grace Lee", providerId: "provider-001", type: "follow_up", status: "completed", priority: "normal", startAt: "2026-07-25T10:00:00Z", endAt: "2026-07-25T10:30:00Z", durationMinutes: 30, title: "Post-procedure Check", notes: "Patient recovering well", location: "Room 101" },
  { id: "apt-007", patientId: "patient-008", patientName: "Henry Kim", providerId: "provider-001", type: "consultation", status: "cancelled", priority: "low", startAt: "2026-07-26T09:00:00Z", endAt: "2026-07-26T09:45:00Z", durationMinutes: 45, title: "New Patient Intake", notes: "Cancelled by patient", location: "Room 101" },
];

function statusColor(status: string): string {
  switch (status) {
    case "scheduled": return "bg-blue-100 text-blue-800 border-blue-200";
    case "confirmed": return "bg-green-100 text-green-800 border-green-200";
    case "in_progress": return "bg-amber-100 text-amber-800 border-amber-200";
    case "completed": return "bg-gray-100 text-gray-800 border-gray-200";
    case "cancelled": return "bg-red-100 text-red-800 border-red-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function priorityDot(p: string): string {
  switch (p) {
    case "urgent": return "bg-red-500";
    case "high": return "bg-amber-500";
    case "normal": return "bg-blue-500";
    case "low": return "bg-gray-300";
    default: return "bg-gray-300";
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function ClinicSchedulePage() {
  const [appointments, setAppointments] = useState<ClinicAppointment[]>(_mockAppointments);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedAppointment, setSelectedAppointment] = useState<ClinicAppointment | null>(null);

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      // In production, this would call the API
      // const params = new URLSearchParams();
      // if (filterProvider !== 'all') params.set('providerId', filterProvider);
      // if (filterStatus !== 'all') params.set('status', filterStatus);
      // const res = await fetch(`/api/v1/clinic/schedule?${params}`);
      // const data = await res.json();
      // setAppointments(data.appointments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAppointments = appointments.filter((apt) => {
    if (filterProvider !== "all" && apt.providerId !== filterProvider) return false;
    if (filterStatus !== "all" && apt.status !== filterStatus) return false;
    if (filterDate && !apt.startAt.startsWith(filterDate)) return false;
    return true;
  });

  const handleConfirm = async (id: string) => {
    try {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "confirmed" } : a)),
      );
      // In production: await fetch(`/api/v1/clinic/appointments/${id}/confirm`, { method: 'PATCH' });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a)),
      );
      // In production: await fetch(`/api/v1/appointments/${id}`, { method: 'DELETE' });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    }
  };

  const pendingConfirms = appointments.filter((a) => a.status === "scheduled").length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
          <p className="mt-1 text-muted-foreground">
            Manage clinic appointments
            {pendingConfirms > 0 && (
              <span className="ml-2 text-amber-500 font-medium">
                ({pendingConfirms} pending confirmation)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAppointments}>
            <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
          </div>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-40"
            />
            <Select value={filterProvider} onValueChange={setFilterProvider}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="provider-001">Dr. Smith</SelectItem>
                <SelectItem value="provider-002">Dr. Johnson</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Appointment List */}
      {!loading && !error && (
        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">List View</TabsTrigger>
            <TabsTrigger value="details" disabled={!selectedAppointment}>
              {selectedAppointment ? `${selectedAppointment.patientName}` : "Details"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            {filteredAppointments.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No appointments found</h3>
                  <p className="text-muted-foreground text-center mt-1">
                    Try adjusting your filters.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredAppointments.map((apt) => (
                  <Card
                    key={apt.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedAppointment?.id === apt.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedAppointment(apt)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          {/* Time column */}
                          <div className="min-w-[80px] text-center">
                            <p className="text-sm font-semibold">{formatTime(apt.startAt)}</p>
                            <p className="text-xs text-muted-foreground">{apt.durationMinutes} min</p>
                          </div>
                          {/* Separator */}
                          <div className="hidden h-full w-px bg-border sm:block" />
                          {/* Details */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${priorityDot(apt.priority)}`} />
                              <p className="font-medium">{apt.patientName}</p>
                              <p className="text-sm text-muted-foreground">- {apt.title}</p>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="capitalize">{apt.type.replace(/_/g, " ")}</span>
                              {apt.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> {apt.location}
                                </span>
                              )}
                            </div>
                            {apt.notes && (
                              <p className="mt-1 text-xs text-muted-foreground italic">
                                {apt.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${statusColor(apt.status)} capitalize`}>
                            {apt.status.replace(/_/g, " ")}
                          </Badge>
                          <div className="hidden gap-1 sm:flex">
                            {apt.status === "scheduled" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-500"
                                onClick={(e) => { e.stopPropagation(); handleConfirm(apt.id); }}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            {(apt.status === "scheduled" || apt.status === "confirmed") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500"
                                onClick={(e) => { e.stopPropagation(); handleCancel(apt.id); }}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="details" className="mt-4">
            {selectedAppointment && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{selectedAppointment.title}</CardTitle>
                      <CardDescription>{selectedAppointment.patientName}</CardDescription>
                    </div>
                    <Badge className={`${statusColor(selectedAppointment.status)} capitalize`}>
                      {selectedAppointment.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{formatDate(selectedAppointment.startAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {formatTime(selectedAppointment.startAt)} - {formatTime(selectedAppointment.endAt)} ({selectedAppointment.durationMinutes} min)
                      </span>
                    </div>
                    {selectedAppointment.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{selectedAppointment.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Type:</span>
                      <span className="text-sm capitalize">{selectedAppointment.type.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                  {selectedAppointment.notes && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm">{selectedAppointment.notes}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    {selectedAppointment.status === "scheduled" && (
                      <Button size="sm" onClick={() => handleConfirm(selectedAppointment.id)}>
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Confirm Appointment
                      </Button>
                    )}
                    {(selectedAppointment.status === "scheduled" || selectedAppointment.status === "confirmed") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(selectedAppointment.id)}
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Cancel Appointment
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}