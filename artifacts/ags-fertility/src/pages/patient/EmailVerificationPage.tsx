// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Email Verification Page                  │
// │ Consumes AI Platform Identity Core verify-complete API.      │
// │ Self-serve flow: user clicks link in verification email →   │
// │ lands here with ?token=<verificationToken> → we complete    │
// │ the verification and show the result.                        │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { patientAuth, ApiError } from "@/lib/patient-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Status = "idle" | "verifying" | "success" | "error" | "missing";

export default function EmailVerificationPage() {
  const [location] = useLocation();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invoke and re-entrancy.
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(location.split("?")[1] || "");
    const token = params.get("token");

    if (!token) {
      setStatus("missing");
      setMessage("The verification link is missing its token. Please use the full link from your email.");
      return;
    }

    (async () => {
      setStatus("verifying");
      try {
        await patientAuth.completeEmailVerification(token);
        setStatus("success");
        setMessage("Your email address has been verified. You can now sign in.");
      } catch (err) {
        if (err instanceof ApiError) {
          // Map common backend errors to friendly copy.
          if (err.code === "CONFLICT") {
            setMessage("This email has already been verified. You can sign in.");
          } else if (err.code === "NOT_FOUND") {
            setMessage("This verification link is invalid or has already been used.");
          } else {
            setMessage(err.message || "We could not verify your email. The link may have expired.");
          }
        } else {
          setMessage("We could not verify your email. The link may have expired — please request a new one.");
        }
        setStatus("error");
      }
    })();
  }, [location]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Email Verification</CardTitle>
          <CardDescription>
            AG Synergy patient portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "verifying" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verifying your email…</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <p className="text-sm text-foreground">{message}</p>
            </div>
          )}

          {(status === "error" || status === "missing") && (
            <div className="flex flex-col items-center gap-3 py-6">
              <AlertCircle className="h-12 w-12 text-amber-500" />
              <p className="text-sm text-foreground">{message}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button asChild className="w-full max-w-xs">
            <Link href="/patient/login">Go to Sign In</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
