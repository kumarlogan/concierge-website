// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Patient Registration Page              │
// │ Consumes AI Platform Identity Core register API.           │
// │ Wave 5 — Patient Workspace                                  │
// │ MVP-UX-001 — Authentication Experience Polish               │
// └─────────────────────────────────────────────────────────────┘

import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { patientAuth, ApiError } from "@/lib/patient-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

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
  { key: "special", label: "One special character", test: (p: string) => /[!@#$%^&*()_+\-=[\]{}|;':\",./<>?`~]/.test(p) },
] as const;

function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_RULES.minLength) {
    return `Password must be at least ${PASSWORD_RULES.minLength} characters`;
  }
  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    return "Password must contain an uppercase letter";
  }
  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    return "Password must contain a lowercase letter";
  }
  if (PASSWORD_RULES.requireDigit && !/\d/.test(password)) {
    return "Password must contain a digit";
  }
  if (PASSWORD_RULES.requireSpecialChar && !/[!@#$%^&*()_+\-=[\]{}|;':\",./<>?`~]/.test(password)) {
    return "Password must contain a special character";
  }
  return null;
}

const PASSWORD_HINT = `At least ${PASSWORD_RULES.minLength} characters, with uppercase, lowercase, number & special character`;

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"form" | "verifying" | "done">("form");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"generic" | "duplicate" | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);

  // Focus email field on mount
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setErrorType(null);

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      setIsLoading(false);
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) {
      setErrorMessage(pwError);
      setIsLoading(false);
      return;
    }

    try {
      const result = await register(email, password, displayName || undefined);
      // Request the verification email. The patient must click the link in
      // their email to complete verification — auto-verify was removed as
      // it bypassed the entire identity-confirmation security control (PRG-003).
      setStep("verifying");
      const identityId = result.id;
      await patientAuth.requestEmailVerification(identityId, email);
      setStep("done");
      toast.success(
        "Account created. Please check your email to verify your address before signing in.",
      );
      navigate("/patient/login");
    } catch (err) {
      if (err instanceof ApiError && err.code === "CONFLICT") {
        setErrorMessage("An account with this email already exists.");
        setErrorType("duplicate");
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : "Registration failed",
        );
      }
      setStep("form");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Join AG Synergy's patient portal</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4">
            {/* Inline error banner */}
            {errorMessage && (
              <div
                role="alert"
                className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
                  errorType === "duplicate"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex-1">
                  <p>{errorMessage}</p>
                  {errorType === "duplicate" && (
                    <Link
                      href="/patient/login"
                      className="mt-1 inline-block text-xs font-medium text-amber-700 underline hover:text-amber-900"
                    >
                      Sign in instead?
                    </Link>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Full Name (optional)</Label>
              <Input
                id="name"
                placeholder="Jane Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                ref={emailRef}
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                required
                autoComplete="email"
                aria-describedby={errorMessage ? "register-error" : undefined}
                aria-invalid={errorMessage ? "true" : undefined}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={PASSWORD_HINT}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {/* Password requirements — always visible */}
              <ul className="space-y-1 mt-2" aria-label="Password requirements">
                {RULE_CHECKS.map((rule) => {
                  const passed = rule.test(password);
                  return (
                    <li
                      key={rule.key}
                      className={`flex items-center gap-2 text-xs transition-colors ${
                        passed ? "text-green-600" : "text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                          passed
                            ? "bg-green-100 text-green-600"
                            : "bg-muted text-muted-foreground/50"
                        }`}
                        aria-hidden="true"
                      >
                        {passed ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <span className="text-xs">•</span>
                        )}
                      </span>
                      <span>{rule.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {step === "verifying" ? "Verifying email..." : "Creating account..."}
                </>
              ) : (
                "Create Account"
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/patient/login"
                className="text-primary hover:underline"
              >
                Sign In
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
