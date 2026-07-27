// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Patient Consent Management UI          │
// │ View and manage data sharing consents.                     │
// │ Consumes AI Platform Trust Runtime consent APIs.           │
// │ Wave 5 — Patient Workspace                                  │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect } from "react";
import { patientConsent, type Consent } from "@/lib/patient-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ClipboardCheck, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

const consentLabels: Record<string, string> = {
  medical_treatment: "Medical Treatment",
  privacy: "Privacy Policy",
  marketing: "Marketing Communications",
  research: "Research Participation",
  document_sharing: "Document Sharing",
  clinic_sharing: "Clinic Information Sharing",
  international_transfer: "International Data Transfer",
  ai_assistance: "AI-Assisted Care",
  delegated_caregiver: "Delegated Caregiver Access",
};

const consentDescriptions: Record<string, string> = {
  medical_treatment: "Consent for medical treatment and procedures.",
  privacy: "Agreement to the privacy policy and data handling practices.",
  marketing: "Receive marketing communications about products and services.",
  research: "Participate in anonymized research studies.",
  document_sharing: "Share medical documents with authorized providers.",
  clinic_sharing: "Share information with other clinics for coordinated care.",
  international_transfer: "Allow international transfer of health data.",
  ai_assistance: "Use AI-assisted tools in your care journey.",
  delegated_caregiver: "Authorize a caregiver to access your health information.",
};

export default function ConsentManagementPage() {
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConsents = async () => {
    setLoading(true);
    try {
      const result = await patientConsent.list();
      setConsents(result.consents);
    } catch {
      // Consents may not be available without auth
      setConsents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConsents();
  }, []);

  const handleGrant = async (consentType: string) => {
    try {
      await patientConsent.grant(consentType);
      toast.success("Consent granted");
      loadConsents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to grant consent");
    }
  };

  const handleRevoke = async (consentId: string) => {
    try {
      await patientConsent.revoke(consentId, "Patient request");
      toast.success("Consent withdrawn");
      loadConsents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to withdraw consent");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Consent Management</h1>
        <p className="mt-1 text-muted-foreground">
          View and manage your data sharing preferences. Your consent choices are
          respected by AG Synergy's Trust Runtime.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
            Your Consents
          </CardTitle>
          <CardDescription>
            These are the data sharing permissions you have granted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : consents.length === 0 ? (
            <div className="py-6 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                No consents recorded yet. Use the list below to grant consent for
                specific data uses.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {consents.map((consent) => (
                <div key={consent.consentId}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {consentLabels[consent.consentType] ?? consent.consentType}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {consentDescriptions[consent.consentType] ?? ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          consent.state === "granted" ? "default" : "secondary"
                        }
                        className="capitalize"
                      >
                        {consent.state}
                      </Badge>
                      {consent.state === "granted" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500"
                          onClick={() => handleRevoke(consent.consentId)}
                        >
                          Withdraw
                        </Button>
                      )}
                    </div>
                  </div>
                  {consent.grantedAt && (
                    <p className="text-xs text-muted-foreground">
                      Granted: {new Date(consent.grantedAt).toLocaleDateString()}
                      {consent.expiresAt &&
                        ` · Expires: ${new Date(consent.expiresAt).toLocaleDateString()}`}
                    </p>
                  )}
                  <Separator className="mt-3" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Available Consents ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            Available Consent Types
          </CardTitle>
          <CardDescription>
            Grant consent for specific data uses. You can withdraw at any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(consentLabels).map(([type, label]) => {
              const existing = consents.find((c) => c.consentType === type);
              if (existing?.state === "granted") return null;

              return (
                <div key={type} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {consentDescriptions[type]}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGrant(type)}
                  >
                    Grant Consent
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Info ── */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Your Rights</p>
            <p className="text-xs text-amber-700">
              You can grant or withdraw consent at any time. Withdrawing consent
              does not affect the lawfulness of processing based on consent
              before its withdrawal. Your choices are enforced by the AG Synergy
              Trust Runtime across all platform services.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}