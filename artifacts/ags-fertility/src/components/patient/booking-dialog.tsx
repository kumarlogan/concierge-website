// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Booking Dialog Component                │
// │ Dialog form for booking new appointments.                   │
// │ Production Readiness — P1-4: Repair Book Appointment button │
// └───�─────────────────────────────────────────────────────────┘

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarDays, Loader2, Plus } from "lucide-react";
import { createAppointment } from "@/lib/appointment-api";

interface BookingDialogProps {
  onSuccess: () => void;
}

const APPOINTMENT_TYPES = [
  { value: "consultation", label: "Consultation" },
  { value: "follow_up", label: "Follow-up" },
  { value: "ultrasound", label: "Ultrasound" },
  { value: "blood_work", label: "Blood Work" },
  { value: "procedure", label: "Procedure" },
  { value: "telehealth", label: "Telehealth" },
];

const DURATION_OPTIONS = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
  { value: "90", label: "90 min" },
  { value: "120", label: "2 hours" },
];

export default function BookingDialog({ onSuccess }: BookingDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    type: "",
    startAt: "",
    durationMinutes: "30",
    notes: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      type: "",
      startAt: "",
      durationMinutes: "30",
      notes: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setError(null);
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.type || !formData.startAt) {
      setError("Please fill in all required fields.");
      return;
    }

    try {
      setSubmitting(true);
      await createAppointment({
        providerId: user?.id ?? "",
        type: formData.type,
        startAt: new Date(formData.startAt).toISOString(),
        durationMinutes: parseInt(formData.durationMinutes, 10),
        timezone: formData.timezone,
        title: formData.title.trim(),
        notes: formData.notes.trim() || undefined,
      });
      setOpen(false);
      resetForm();
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to book appointment"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Book Appointment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              Book an Appointment
            </DialogTitle>
            <DialogDescription>
              Fill in the details to schedule a new appointment.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., Initial Consultation"
                value={formData.title}
                onChange={(e) => updateField("title", e.target.value)}
              />
            </div>

            {/* Type and Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type">
                  Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => updateField("type", v)}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duration">Duration</Label>
                <Select
                  value={formData.durationMinutes}
                  onValueChange={(v) => updateField("durationMinutes", v)}
                >
                  <SelectTrigger id="duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date/Time */}
            <div className="grid gap-2">
              <Label htmlFor="startAt">
                Date & Time <span className="text-red-500">*</span>
              </Label>
              <Input
                id="startAt"
                type="datetime-local"
                value={formData.startAt}
                onChange={(e) => updateField("startAt", e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                placeholder="Any special requirements..."
                value={formData.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? "Booking..." : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}