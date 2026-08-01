// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Notification Preferences Dialog                 │
// │ Patient-controlled notification channel and volume settings │
// │ Wave 6 — Communication Centre                               │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { X, Loader2, Bell, BellOff, Smartphone, Mail, Globe, Moon } from "lucide-react";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/message-api";

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  appointment_reminder: "Appointment Reminders",
  medication_reminder: "Medication Reminders",
  lab_result: "Lab Results",
  timeline_update: "Treatment Phase Updates",
  document_shared: "Document Shared",
  clinic_announcement: "Clinic Announcements",
  system: "System Notifications",
};

interface Props {
  onClose: () => void;
}

export default function NotificationPreferencesDialog({ onClose }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNotificationPreferences()
      .then(setPrefs)
      .catch(() => setError("Failed to load preferences"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      const updated = await updateNotificationPreferences(prefs);
      setPrefs(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Card className="w-full max-w-lg">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!prefs) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10">
      <Card className="relative w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Notification Preferences</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          {/* Channels */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Delivery Channels</h3>
            <div className="space-y-3">
              {[
                { key: "in_app" as const, label: "In-app notifications", icon: Globe, desc: "Notifications within the portal" },
                { key: "sms" as const, label: "SMS text messages", icon: Smartphone, desc: "Text messages to your phone" },
                { key: "email" as const, label: "Email notifications", icon: Mail, desc: "Updates sent to your email" },
                { key: "push" as const, label: "Push notifications", icon: Bell, desc: "Mobile app push notifications" },
              ].map(({ key, label, icon: Icon, desc }) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label className="text-sm font-medium">{label}</Label>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={prefs.channels[key]}
                    onCheckedChange={(checked) => {
                      setPrefs({
                        ...prefs,
                        channels: { ...prefs.channels, [key]: checked },
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Daily limit */}
          <div>
            <h3 className="mb-3 text-sm font-medium">
              Daily Notification Limit: {prefs.dailyCap}
            </h3>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">1</span>
              <Slider
                value={[prefs.dailyCap]}
                onValueChange={([v]) => setPrefs({ ...prefs, dailyCap: v })}
                min={1}
                max={20}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground">20</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Maximum notifications per day (recommended: 5)
            </p>
          </div>

          {/* Quiet hours */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Quiet Hours</h3>
              </div>
              <Switch
                checked={prefs.quietHours.enabled}
                onCheckedChange={(enabled) => {
                  setPrefs({
                    ...prefs,
                    quietHours: { ...prefs.quietHours, enabled },
                  });
                }}
              />
            </div>
            {prefs.quietHours.enabled && (
              <div className="flex items-center gap-3">
                <div>
                  <Label className="text-xs">From</Label>
                  <Input
                    type="time"
                    value={prefs.quietHours.start}
                    onChange={(e) => setPrefs({
                      ...prefs,
                      quietHours: { ...prefs.quietHours, start: e.target.value },
                    })}
                    className="h-8"
                  />
                </div>
                <span className="mt-5 text-muted-foreground">→</span>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input
                    type="time"
                    value={prefs.quietHours.end}
                    onChange={(e) => setPrefs({
                      ...prefs,
                      quietHours: { ...prefs.quietHours, end: e.target.value },
                    })}
                    className="h-8"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pause non-critical */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <BellOff className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Pause non-critical notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Useful during sensitive treatment periods
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.pauseNonCritical}
              onCheckedChange={(pauseNonCritical) => {
                setPrefs({ ...prefs, pauseNonCritical });
              }}
            />
          </div>

          {/* Per-type preferences */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Notification Types</h3>
            <div className="space-y-2">
              {Object.entries(NOTIFICATION_TYPE_LABELS).map(([type, label]) => {
                const typePref = prefs.typePreferences[type] ?? { channel: ["in_app"], enabled: true };
                return (
                  <div key={type} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Label className="text-sm font-medium">{label}</Label>
                      <div className="flex gap-1 mt-1">
                        {typePref.channel.map(ch => (
                          <Badge key={ch} variant="outline" className="text-xs capitalize">
                            {ch.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Switch
                      checked={typePref.enabled}
                      onCheckedChange={(enabled) => {
                        setPrefs({
                          ...prefs,
                          typePreferences: {
                            ...prefs.typePreferences,
                            [type]: { ...typePref, enabled },
                          },
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}