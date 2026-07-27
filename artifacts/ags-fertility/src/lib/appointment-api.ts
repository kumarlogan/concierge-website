// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Appointment API Client                          │
// │ Patient-facing API client for Appointment Management.        │
// ═══════════════════════════════════════════════════════════

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  type: string;
  status: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  title: string;
  notes: string;
  location: string | null;
}

export async function getAppointments(): Promise<Appointment[]> {
  const res = await fetch(`${API_BASE}/api/v1/appointments`);
  if (!res.ok) throw new Error(`Failed to fetch appointments: ${res.status}`);
  const data: { appointments: Appointment[] } = await res.json();
  return data.appointments ?? [];
}

export async function getAppointment(id: string): Promise<Appointment> {
  const res = await fetch(`${API_BASE}/api/v1/appointments/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch appointment: ${res.status}`);
  const data: { appointment: Appointment } = await res.json();
  return data.appointment;
}

export async function createAppointment(data: {
  providerId: string;
  type: string;
  startAt: string;
  durationMinutes: number;
  timezone: string;
  title: string;
  notes?: string;
  location?: string;
}): Promise<Appointment> {
  const res = await fetch(`${API_BASE}/api/v1/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create appointment: ${res.status}`);
  const json: { appointment: Appointment } = await res.json();
  return json.appointment;
}

export async function updateAppointment(
  id: string,
  data: Partial<{ status: string; startAt: string; durationMinutes: number; title: string; notes: string; location: string }>,
): Promise<Appointment> {
  const res = await fetch(`${API_BASE}/api/v1/appointments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update appointment: ${res.status}`);
  const json: { appointment: Appointment } = await res.json();
  return json.appointment;
}

export async function cancelAppointment(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/appointments/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to cancel appointment: ${res.status}`);
}

export async function checkAvailability(startAt: string, endAt: string): Promise<boolean> {
  const params = new URLSearchParams({ startAt, endAt });
  const res = await fetch(`${API_BASE}/api/v1/appointments/slots/available?${params}`);
  if (!res.ok) throw new Error(`Failed to check availability: ${res.status}`);
  const data: { available: boolean } = await res.json();
  return data.available;
}