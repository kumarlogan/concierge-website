// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Patient Security Settings Page         │
// │ MFA enrollment, session management, trusted devices.       │
// │ Consumes AI Platform Identity Core MFA & session APIs.     │
// │ Wave 5 — Patient Workspace                                  │
// └─────────────────────────────────────────────────────────────┘

import { useState } from "react";
import { patientAuth } from "@/lib/patient-api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Shield, Key, Smartphone, AlertTriangle } from "lucide-react";

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaQRUrl, setMfaQRUrl] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [mfaCode, setMfaCode] = useState("");
  const [isSettingUpMFA, setIsSettingUpMFA] = useState(false);

  const handleSetupMFA = async () => {
    setIsSettingUpMFA(true);
    try {
      const result = await patientAuth.setupMFA();
      setMfaSecret(result.secret ?? "");
      setMfaQRUrl(result.qrCodeUrl ?? "");
      setBackupCodes(result.backupCodes ?? []);
      setShowMFASetup(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set up MFA");
    } finally {
      setIsSettingUpMFA(false);
    }
  };

  const handleVerifyMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await patientAuth.verifyMFA(mfaCode);
      toast.success("MFA enabled successfully");
      setShowMFASetup(false);
      setMfaCode("");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "MFA verification failed");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage multi-factor authentication, sessions, and security preferences.
        </p>
      </div>

      {/* ── MFA ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Multi-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user?.mfaEnabled ? (
            <div className="space-y-3">
              <Badge variant="outline" className="text-green-500">
                MFA is enabled
              </Badge>
              <p className="text-sm text-muted-foreground">
                Your account is protected with multi-factor authentication.
              </p>
            </div>
          ) : showMFASetup ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted p-4">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Smartphone className="h-4 w-4" />
                  Set up TOTP Authenticator
                </h4>
                <p className="mb-3 text-xs text-muted-foreground">
                  Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
                  or enter the secret key manually.
                </p>

                {mfaQRUrl && (
                  <div className="mb-3 flex justify-center">
                    <img
                      src={mfaQRUrl}
                      alt="MFA QR Code"
                      className="h-40 w-40 rounded-lg border"
                    />
                  </div>
                )}

                {mfaSecret && (
                  <div className="mb-3">
                    <Label className="text-xs">Secret Key</Label>
                    <code className="block mt-1 rounded bg-background p-2 text-xs break-all">
                      {mfaSecret}
                    </code>
                  </div>
                )}

                {backupCodes.length > 0 && (
                  <div className="mb-3">
                    <Label className="text-xs">Backup Codes (save these)</Label>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      {backupCodes.map((code, i) => (
                        <code key={i} className="rounded bg-background px-2 py-1 text-xs font-mono">
                          {code}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={handleVerifyMFA} className="space-y-2">
                  <Label htmlFor="mfa-setup-code">Verify with authenticator code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="mfa-setup-code"
                      type="text"
                      inputMode="numeric"
                      placeholder="000000"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      required
                      maxLength={6}
                      className="max-w-[140px] text-center tracking-widest"
                    />
                    <Button type="submit">Verify & Enable</Button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Badge variant="outline" className="text-amber-500">
                Not configured
              </Badge>
              <p className="text-sm text-muted-foreground">
                Multi-factor authentication is not yet enabled for your account.
              </p>
              <Button onClick={handleSetupMFA} disabled={isSettingUpMFA}>
                <Key className="mr-2 h-4 w-4" />
                {isSettingUpMFA ? "Setting up..." : "Set Up MFA"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Session Management (placeholder) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            Active Sessions
          </CardTitle>
          <CardDescription>Manage your active login sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Session management will be available in a future update.
          </p>
        </CardContent>
      </Card>

      {/* ── Danger Zone ── */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Account deactivation and data deletion are managed through your clinic.
            Please contact your healthcare provider for assistance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}