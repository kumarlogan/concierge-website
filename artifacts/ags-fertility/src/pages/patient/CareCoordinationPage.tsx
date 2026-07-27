// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Care Coordination Page                  │
// │ Care team view, appointments summary, upcoming events.      │
// │ Workstream A — Patient Journey                              │
// └─────────────────────────────────────────────────────────────┘

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  MessageSquare,
  RefreshCw,
  UserCircle,
  Stethoscope,
  Shield,
} from "lucide-react";
import { Link } from "wouter";

// ── Mock Care Team Data ─────────────────────────────────────

interface CareTeamMember {
  id: string;
  name: string;
  role: string;
  specialty: string;
  email: string;
  phone: string;
  avatar: string;
  availability: string;
}

const careTeam: CareTeamMember[] = [
  {
    id: "dr-sharma",
    name: "Dr. Ananya Sharma",
    role: "Lead Fertility Specialist",
    specialty: "Reproductive Endocrinology",
    email: "sharma@agsynergy.ca",
    phone: "+1 (555) 123-4567",
    avatar: "AS",
    availability: "Mon-Fri, 9 AM - 5 PM",
  },
  {
    id: "coordinator-patel",
    name: "Priya Patel",
    role: "Care Coordinator",
    specialty: "Patient Care Management",
    email: "ppatel@agsynergy.ca",
    phone: "+1 (555) 123-4568",
    avatar: "PP",
    availability: "Mon-Sat, 8 AM - 6 PM",
  },
  {
    id: "nurse-taylor",
    name: "Sarah Taylor",
    role: "Fertility Nurse",
    specialty: "Reproductive Nursing",
    email: "staylor@agsynergy.ca",
    phone: "+1 (555) 123-4569",
    avatar: "ST",
    availability: "Mon-Fri, 7 AM - 7 PM",
  },
];

// ── Mock Upcoming Events ────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  type: "appointment" | "procedure" | "consultation" | "check-in";
  date: string;
  time: string;
  location: string;
  withPerson: string;
  status: "confirmed" | "pending" | "completed";
}

const upcomingEvents: CalendarEvent[] = [
  {
    id: "evt-1",
    title: "Treatment Planning Consultation",
    type: "consultation",
    date: "2025-03-12",
    time: "10:00 AM",
    location: "Virtual (Video Call)",
    withPerson: "Dr. Ananya Sharma",
    status: "confirmed",
  },
  {
    id: "evt-2",
    title: "Medication Orientation",
    type: "appointment",
    date: "2025-03-18",
    time: "2:30 PM",
    location: "Main Clinic - Room 204",
    withPerson: "Sarah Taylor",
    status: "confirmed",
  },
  {
    id: "evt-3",
    title: "Pre-Procedure Check-in",
    type: "check-in",
    date: "2025-04-10",
    time: "9:00 AM",
    location: "Main Clinic - Reception",
    withPerson: "Priya Patel",
    status: "pending",
  },
];

// ── Helper Functions ────────────────────────────────────────

function eventTypeIcon(type: string) {
  switch (type) {
    case "appointment":
      return <Calendar className="h-4 w-4" />;
    case "procedure":
      return <Stethoscope className="h-4 w-4" />;
    case "consultation":
      return <MessageSquare className="h-4 w-4" />;
    case "check-in":
      return <UserCircle className="h-4 w-4" />;
    default:
      return <Calendar className="h-4 w-4" />;
  }
}

function eventTypeColor(type: string): string {
  switch (type) {
    case "appointment":
      return "bg-blue-100 text-blue-700";
    case "procedure":
      return "bg-amber-100 text-amber-700";
    case "consultation":
      return "bg-purple-100 text-purple-700";
    case "check-in":
      return "bg-teal-100 text-teal-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function CareCoordinationPage() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Care Coordination</h1>
          <p className="mt-1 text-muted-foreground">
            Your care team, appointments, and coordination at a glance
          </p>
        </div>
        <Link href="/patient/appointments">
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            View All Appointments
          </Button>
        </Link>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading coordination data...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Care Team */}
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
              <Users className="h-5 w-5 text-muted-foreground" />
              Your Care Team
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {careTeam.map((member) => (
                <Card key={member.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center">
                      <Avatar className="h-16 w-16 mb-3">
                        <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                          {member.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="font-semibold">{member.name}</h3>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                      <Badge variant="secondary" className="mt-2 text-xs">
                        {member.specialty}
                      </Badge>
                      <div className="mt-4 w-full space-y-2 text-left text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate text-xs">{member.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="text-xs">{member.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="text-xs">{member.availability}</span>
                        </div>
                      </div>
                      <Link href="/patient/messages">
                        <Button variant="outline" size="sm" className="mt-4 w-full gap-2">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Send Message
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Coordination Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Coordination Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border bg-green-50/50 p-4 text-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 mx-auto">
                    <Users className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-green-700">3</p>
                  <p className="text-xs text-green-600">Active Team Members</p>
                </div>
                <div className="rounded-lg border bg-blue-50/50 p-4 text-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 mx-auto">
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-blue-700">3</p>
                  <p className="text-xs text-blue-600">Upcoming Events</p>
                </div>
                <div className="rounded-lg border bg-amber-50/50 p-4 text-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 mx-auto">
                    <Clock className="h-4 w-4 text-amber-600" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-amber-700">2</p>
                  <p className="text-xs text-amber-600">Pending Actions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              Upcoming Events
            </h2>
            <div className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No upcoming events</h3>
                    <p className="text-muted-foreground text-center mt-1">
                      Your scheduled events will appear here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                upcomingEvents.map((event) => (
                  <Card key={event.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="flex items-start gap-4 py-4">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${eventTypeColor(event.type)}`}>
                        {eventTypeIcon(event.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-medium">{event.title}</h3>
                          <Badge
                            variant={event.status === "confirmed" ? "default" : "secondary"}
                            className="capitalize text-xs"
                          >
                            {event.status}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(event.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {event.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <UserCircle className="h-3 w-3" />
                            {event.withPerson}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}