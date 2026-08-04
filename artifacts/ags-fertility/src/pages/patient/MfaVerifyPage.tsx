// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — MFA Verification Page                   │
// │ Completes MFA after login for enrolled patients.            │
// │ Fixes PRG-005: /patient/mfa was missing from the router,   │
// │ leaving MFA-enrolled patients permanently locked out.       │
// └─────────────────────────────────────────────────────────────┘

import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, AlertCircle, ShieldCheck } from "lucide-react";

export default function MfaVerifyPage() {
  const [, navigate] = useLocation();
  const { mfaRequired, completeMFA, isAuthenticated } = useAuth();

  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const codeRef = useRef<HTMLInputElement>(null);

  // Focus the code input on mount
  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  // If the user is already fully authenticated (no MFA pending), or if MFA
  // was never required, redirect to dashboard rather than showing an orphaned form.
  useEffect(() => {
    if (!mfaRequired && isAuthenticated) {
      navigate("/patient/dashboard");
    } else if (!mfaRequired && !isAuthenticated) {
      // MFA state was lost (e.g. page refresh) — send back to login
      navigate("/patient/login");
    }
  }, [mfaRequired, isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = code.trim().replace(/\s/g, "");
    if (!trimmed || trimmed.length < 4) {
      setErrorMessage("Please enter your verification code.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await completeMFA(trimmed);
      toast.success("Verification successful. Welcome back.");
      navigate("/patient/dashboard");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Invalid or expired code. Please try again.",
      );
      setCode("");
      codeRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Two-factor verification</CardTitle>
          <CardDescription>
            Enter the code from your authenticator app or the one-time code
            sent to your device.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="mfa-code">Verification code</Label>
              <Input
                ref={codeRef}
                id="mfa-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9 ]*"
                autoComplete="one-time-code"
                placeholder="123 456"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                maxLength={7}
                className="text-center text-lg tracking-widest"
                aria-invalid={errorMessage ? "true" : undefined}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !code.trim()}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                "Verify"
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Having trouble?{" "}
              <a
                href="/patient/login"
                className="text-primary hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/patient/login");
                }}
              >
                Back to login
              </a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
