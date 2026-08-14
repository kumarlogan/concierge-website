// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Reset Password Page                     │
// │ Reached via the link in the password-reset email:            │
// │   https://www.agsynergy.ca/reset-password?token=<resetToken> │
// │ Reads ?token=, lets the user set a new password, calls       │
// │ POST /identity/password/change.                              │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { patientAuth, ApiError } from "@/lib/patient-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";

type Status = "loading" | "form" | "submitting" | "success" | "error";

// Must match backend password policy in password-manager.ts
const PASSWORD_RULES = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecialChar: true,
};

const RULE_CHECKS = [
  { key: "length", label: `At least ${PASSWORD_RULES.minLength} characters`, test: (p: string) => p.length >= PASSWORD_RULES.minLength },
  { key: "upper", label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower", label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { key: "digit", label: "One number", test: (p: string) => /\d/.test(p) },
  { key: "special", label: "One special character", test: (p: string) => /[!@#$%^&*()_+\-=[\]{}|;':",./<>?`~]/.test(p) },
] as const;

function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_RULES.minLength) return `Password must be at least ${PASSWORD_RULES.minLength} characters`;
  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) return "Password must contain a lowercase letter";
  if (PASSWORD_RULES.requireDigit && !/\d/.test(password)) return "Password must contain a digit";
  if (PASSWORD_RULES.requireSpecialChar && !/[!@#$%^&*()_+\-=[\]{}|;':",./<>?`~]/.test(password)) return "Password must contain a special character";
  return null;
}

export default function ResetPasswordPage() {
  // NOTE: wouter's useLocation() returns ONLY the pathname. Read the token
  // directly from window.location.search.
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [status, setStatus] = useState<Status>(token ? "form" : "error");
  const [errorMessage, setErrorMessage] = useState<string | null>(
    token ? null : "The reset link is missing its token. Please use the full link from your email.",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validate the token with a GET once on mount (non-mutating) so we can
  // surface "expired/used" before the user types a password.
  const validatedRef = useRef(false);
  useEffect(() => {
    if (!token || validatedRef.current) return;
    validatedRef.current = true;
    setStatus("loading");
    patientAuth
      .validatePasswordReset(token)
      .then(() => setStatus("form"))
      .catch((err) => {
        if (err instanceof ApiError) {
          if (err.code === "NOT_FOUND") {
            setErrorMessage("This reset link is invalid or has expired.");
          } else if (err.code === "AUTHENTICATION_ERROR") {
            setErrorMessage("This reset link has already been used. Please request a new one.");
          } else {
            setErrorMessage(err.message || "This reset link is invalid.");
          }
        } else {
          setErrorMessage("This reset link is invalid or has expired.");
        }
        setStatus("error");
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }
    const pwError = validatePassword(password);
    if (pwError) {
      setErrorMessage(pwError);
      return;
    }
    setErrorMessage(null);
    setStatus("submitting");
    try {
      await patientAuth.completePasswordReset(token, password);
      setStatus("success");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "NOT_FOUND") {
          setErrorMessage("This reset link is invalid or has expired.");
        } else if (err.code === "AUTHENTICATION_ERROR") {
          setErrorMessage("This reset link has already been used. Please request a new one.");
        } else {
          setErrorMessage(err.message || "We could not reset your password. Please try again.");
        }
      } else {
        setErrorMessage("We could not reset your password. Please try again.");
      }
      setStatus("error");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>AG Synergy patient portal</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Validating your link…</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <p className="text-sm text-foreground">Your password has been reset. You can now sign in.</p>
            </div>
          )}

          {(status === "error") && (
            <div className="flex flex-col items-center gap-3 py-6">
              <AlertCircle className="h-12 w-12 text-amber-500" />
              <p className="text-sm text-foreground">{errorMessage}</p>
            </div>
          )}

          {(status === "form" || status === "submitting") && (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {errorMessage && (
                <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{errorMessage}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter a new password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (errorMessage) setErrorMessage(null); }}
                    required
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <ul className="space-y-1 mt-2" aria-label="Password requirements">
                  {RULE_CHECKS.map((rule) => {
                    const passed = rule.test(password);
                    return (
                      <li key={rule.key} className={`flex items-center gap-2 text-xs transition-colors ${passed ? "text-green-600" : "text-muted-foreground"}`}>
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${passed ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground/50"}`} aria-hidden="true">
                          {passed ? <CheckCircle2 className="h-3 w-3" /> : <span className="text-xs">•</span>}
                        </span>
                        <span>{rule.label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); if (errorMessage) setErrorMessage(null); }}
                    required
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? "Hide password" : "Show password"} tabIndex={-1}>
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={status === "submitting"} aria-busy={status === "submitting"}>
                {status === "submitting" ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting…</>) : "Reset Password"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/patient/login" className="text-xs text-primary hover:underline">
            Back to Sign In
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
