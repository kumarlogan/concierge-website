// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Patient Status Tracking Page            │
// │ View all patients with their current status (active,        │
// │ pending, completed, etc.), filterable and sortable.         │
// │ Workstream B — Clinic Experience                             │
// └─────────────────────────────────────────────────────────────┘

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  Search,
  RefreshCw,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Users,
  Mail,
  Calendar,
  Phone,
} from "lucide-react";

interface PatientStatus {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "active" | "pending" | "completed" | "inactive" | "on_hold";
  provider: string;
  lastContact: string | null;
  nextAppointment: string | null;
  totalAppointments: number;
  stage: string;
}

const _mockPatients: PatientStatus[] = [
  { id: "patient-001", name: "Alice Johnson", email: "alice@example.com", phone: "+1-555-0101", status: "active", provider: "Dr. Smith", lastContact: "2026-07-27T09:45:00Z", nextAppointment: "2026-08-03T14:00:00Z", totalAppointments: 5, stage: "Treatment" },
  { id: "patient-002", name: "Bob Smith", email: "bob@example.com", phone: "+1-555-0102", status: "active", provider: "Dr. Smith", lastContact: "2026-07-26T10:30:00Z", nextAppointment: "2026-08-01T11:00:00Z", totalAppointments: 3, stage: "Consultation" },
  { id: "patient-003", name: "Carol Davis", email: "carol@example.com", phone: "+1-555-0103", status: "pending", provider: "Dr. Johnson", lastContact: null, nextAppointment: "2026-07-28T15:00:00Z", totalAppointments: 0, stage: "Intake" },
  { id: "patient-004", name: "David Wilson", email: "david@example.com", phone: "+1-555-0104", status: "completed", provider: "Dr. Smith", lastContact: "2026-06-15T10:00:00Z", nextAppointment: null, totalAppointments: 12, stage: "Post-Treatment" },
  { id: "patient-005", name: "Eva Martinez", email: "eva@example.com", phone: "+1-555-0105", status: "active", provider: "Dr. Johnson", lastContact: "2026-07-25T13:30:00Z", nextAppointment: "2026-08-10T09:00:00Z", totalAppointments: 8, stage: "Treatment" },
  { id: "patient-006", name: "Frank Brown", email: "frank@example.com", phone: "+1-555-0106", status: "inactive", provider: "Dr. Johnson", lastContact: "2026-05-01T10:00:00Z", nextAppointment: null, totalAppointments: 2, stage: "On Hold" },
  { id: "patient-007", name: "Grace Lee", email: "grace@example.com", phone: "+1-555-0107", status: "active", provider: "Dr. Smith", lastContact: "2026-07-22T11:00:00Z", nextAppointment: "2026-08-05T10:00:00Z", totalAppointments: 6, stage: "Treatment" },
  { id: "patient-008", name: "Henry Kim", email: "henry@example.com", phone: "+1-555-0108", status: "pending", provider: "Dr. Smith", lastContact: null, nextAppointment: "2026-07-30T14:00:00Z", totalAppointments: 0, stage: "Intake" },
  { id: "patient-009", name: "Iris Chen", email: "iris@example.com", phone: "+1-555-0109", status: "on_hold", provider: "Dr. Johnson", lastContact: "2026-07-20T09:00:00Z", nextAppointment: "2026-09-01T10:00:00Z", totalAppointments: 4, stage: "On Hold" },
  { id: "patient-010", name: "Jack Taylor", email: "jack@example.com", phone: "+1-555-0110", status: "completed", provider: "Dr. Smith", lastContact: "2026-07-01T14:00:00Z", nextAppointment: null, totalAppointments: 15, stage: "Post-Treatment" },
];

type SortField = "name" | "status" | "lastContact" | "nextAppointment" | "totalAppointments";
type SortDir = "asc" | "desc";

function statusColor(status: string): string {
  switch (status) {
    case "active": return "bg-green-100 text-green-800 border-green-200";
    case "pending": return "bg-amber-100 text-amber-800 border-amber-200";
    case "completed": return "bg-blue-100 text-blue-800 border-blue-200";
    case "inactive": return "bg-gray-100 text-gray-800 border-gray-200";
    case "on_hold": return "bg-purple-100 text-purple-800 border-purple-200";
    default: return "bg-gray-100 text-gray-800";
  }
}

function statusDot(status: string): string {
  switch (status) {
    case "active": return "bg-green-500";
    case "pending": return "bg-amber-500";
    case "completed": return "bg-blue-500";
    case "inactive": return "bg-gray-400";
    case "on_hold": return "bg-purple-500";
    default: return "bg-gray-300";
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

export default function PatientStatusPage() {
  const [patients, setPatients] = useState<PatientStatus[]>(_mockPatients);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [loading, setLoading] = useState(false);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // In production: const res = await fetch(`/api/v1/clinic/patients?status=${statusFilter}`);
      // const data = await res.json();
      // setPatients(data.patients);
    } catch {
      // stub
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients
    .filter((p) => {
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
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "lastContact":
          cmp = (a.lastContact || "").localeCompare(b.lastContact || "");
          break;
        case "nextAppointment":
          cmp = (a.nextAppointment || "").localeCompare(b.nextAppointment || "");
          break;
        case "totalAppointments":
          cmp = a.totalAppointments - b.totalAppointments;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

  const statusCounts = {
    active: patients.filter((p) => p.status === "active").length,
    pending: patients.filter((p) => p.status === "pending").length,
    completed: patients.filter((p) => p.status === "completed").length,
    inactive: patients.filter((p) => p.status === "inactive").length,
    on_hold: patients.filter((p) => p.status === "on_hold").length,
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3" />;
    return sortDir === "asc" ? (
      <ChevronUp className="ml-1 h-3 w-3" />
    ) : (
      <ChevronDown className="ml-1 h-3 w-3" />
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Patient Status</h1>
          <p className="mt-1 text-muted-foreground">
            Track and manage patient treatment statuses
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-500">{statusCounts.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-amber-500">{statusCounts.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-blue-500">{statusCounts.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">On Hold</p>
            <p className="text-2xl font-bold text-purple-500">{statusCounts.on_hold}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Inactive</p>
            <p className="text-2xl font-bold text-gray-500">{statusCounts.inactive}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
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
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
                  <span className="flex items-center">
                    Patient <SortIcon field="name" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer hidden md:table-cell" onClick={() => toggleSort("status")}>
                  <span className="flex items-center">
                    Status <SortIcon field="status" />
                  </span>
                </TableHead>
                <TableHead className="hidden lg:table-cell">Stage</TableHead>
                <TableHead className="hidden md:table-cell">Provider</TableHead>
                <TableHead className="cursor-pointer hidden lg:table-cell" onClick={() => toggleSort("lastContact")}>
                  <span className="flex items-center">
                    Last Contact <SortIcon field="lastContact" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer hidden md:table-cell" onClick={() => toggleSort("nextAppointment")}>
                  <span className="flex items-center">
                    Next Appt <SortIcon field="nextAppointment" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("totalAppointments")}>
                  <span className="flex items-center justify-end">
                    Appts <SortIcon field="totalAppointments" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.map((patient) => (
                <TableRow key={patient.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${statusDot(patient.status)}`} />
                      <div>
                        <p className="font-medium">{patient.name}</p>
                        <p className="text-xs text-muted-foreground hidden sm:block">{patient.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge className={`${statusColor(patient.status)} capitalize`}>
                      {patient.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm">{patient.stage}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {patient.provider}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {formatDate(patient.lastContact)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {formatDate(patient.nextAppointment)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {patient.totalAppointments}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}