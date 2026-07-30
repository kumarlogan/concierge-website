// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Patient Security Settings Page         │
// │ MFA enrollment, session management, trusted devices.       │
// │ Consumes AI Platform Identity Core MFA & session APIs.     │
// │ Wave 5 — Patient Workspace                                  │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect } from "react";
import { patientAuth, SessionResponse } from "@/lib/patient-api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Shield, Key, Smartphone, AlertTriangle, RefreshCw } from "lucide-react";

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaQRUrl, setMfaQRUrl] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [mfaCode, setMfaCode] = useState("");
  const [isSettingUpMFA, setIsSettingUpMFA] = useState(false);
  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const result = await patientAuth.listSessions();
      setSessions(result.sessions);
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      await patientAuth.revokeSession(sessionId);
      toast.success("Session revoked");
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke session");
    } finally {
      setRevokingId(null);
      setRevokeTarget(null);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

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

      {/* ── Active Sessions ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            Active Sessions
          </CardTitle>
          <CardDescription>Manage your active login sessions across devices.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading sessions...
            </div>
          ) : sessionsError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">{sessionsError}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={fetchSessions}>
                <RefreshCw className="mr-1 h-3 w-3" />
                Retry
              </Button>
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions found.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.sessionId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {session.deviceName || "Unknown device"}
                      </span>
                      {session.isCurrent && (
                        <Badge variant="outline" className="text-xs text-green-500">
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {session.ipAddress && <span>IP: {session.ipAddress}</span>}
                      <span>
                        Last activity: {new Date(session.lastActivity).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <AlertDialog
                      open={revokeTarget === session.sessionId}
                      onOpenChange={(open) => {
                        if (open) setRevokeTarget(session.sessionId);
                        else setRevokeTarget(null);
                      }}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          disabled={revokingId === session.sessionId}
                        >
                          {revokingId === session.sessionId ? "Revoking..." : "Revoke"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke Session</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to revoke this session? The device will be signed out immediately.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setRevokeTarget(null)}>
                            Keep Session
                          </AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => handleRevokeSession(session.sessionId)}
                          >
                            Yes, Revoke
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </div>
          )}
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