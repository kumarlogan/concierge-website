// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Patient Search Page                     │
// │ Search/find patients by name, ID, or status.                │
// │ Workstream B — Clinic Experience                             │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Users,
  RefreshCw,
  AlertCircle,
  Mail,
  Calendar,
  User,
  ChevronRight,
} from "lucide-react";

interface Patient {
  id: string;
  name: string;
  email: string;
  status: string;
  lastAppointment: string | null;
  nextAppointment: string | null;
  providerId: string;
}

const _mockPatients: Patient[] = [
  { id: "patient-001", name: "Alice Johnson", email: "alice@example.com", status: "active", lastAppointment: "2026-07-20T10:00:00Z", nextAppointment: "2026-08-03T14:00:00Z", providerId: "provider-001" },
  { id: "patient-002", name: "Bob Smith", email: "bob@example.com", status: "active", lastAppointment: "2026-07-18T09:00:00Z", nextAppointment: "2026-08-01T11:00:00Z", providerId: "provider-001" },
  { id: "patient-003", name: "Carol Davis", email: "carol@example.com", status: "pending", lastAppointment: null, nextAppointment: "2026-07-28T15:00:00Z", providerId: "provider-002" },
  { id: "patient-004", name: "David Wilson", email: "david@example.com", status: "completed", lastAppointment: "2026-06-15T10:00:00Z", nextAppointment: null, providerId: "provider-001" },
  { id: "patient-005", name: "Eva Martinez", email: "eva@example.com", status: "active", lastAppointment: "2026-07-25T13:00:00Z", nextAppointment: "2026-08-10T09:00:00Z", providerId: "provider-002" },
  { id: "patient-006", name: "Frank Brown", email: "frank@example.com", status: "inactive", lastAppointment: "2026-05-01T10:00:00Z", nextAppointment: null, providerId: "provider-002" },
  { id: "patient-007", name: "Grace Lee", email: "grace@example.com", status: "active", lastAppointment: "2026-07-22T11:00:00Z", nextAppointment: "2026-08-05T10:00:00Z", providerId: "provider-001" },
  { id: "patient-008", name: "Henry Kim", email: "henry@example.com", status: "pending", lastAppointment: null, nextAppointment: "2026-07-30T14:00:00Z", providerId: "provider-001" },
  { id: "patient-009", name: "Iris Chen", email: "iris@example.com", status: "active", lastAppointment: "2026-07-26T09:00:00Z", nextAppointment: "2026-08-12T10:00:00Z", providerId: "provider-002" },
  { id: "patient-010", name: "Jack Taylor", email: "jack@example.com", status: "completed", lastAppointment: "2026-07-01T14:00:00Z", nextAppointment: null, providerId: "provider-001" },
];

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active": return "default";
    case "pending": return "secondary";
    case "completed": return "outline";
    case "inactive": return "destructive";
    default: return "secondary";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PatientSearchPage() {
  const [patients, setPatients] = useState<Patient[]>(_mockPatients);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = async () => {
    setLoading(true);
    setError(null);
    try {
      // In production: const params = new URLSearchParams({ search: searchQuery, status: statusFilter });
      // const res = await fetch(`/api/v1/clinic/patients?${params}`);
      // const data = await res.json();
      // setPatients(data.patients);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredPatients = patients.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Search Patients</h1>
        <p className="mt-1 text-muted-foreground">
          Find patients by name, ID, or filter by status
        </p>
      </div>

      {/* Search + Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or patient ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchPatients}>
              <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Search
            </Button>
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

      {/* Results */}
      {!loading && !error && (
        <>
          <p className="text-sm text-muted-foreground">
            {filteredPatients.length} patient(s) found
          </p>
          {filteredPatients.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No patients found</h3>
                <p className="text-muted-foreground text-center mt-1">
                  Try adjusting your search or filter criteria.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredPatients.map((patient) => (
                <Card key={patient.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{patient.name}</p>
                        <Badge variant={statusVariant(patient.status)} className="capitalize">
                          {patient.status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {patient.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Last: {formatDate(patient.lastAppointment)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Next: {formatDate(patient.nextAppointment)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}