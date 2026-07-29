// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Patient Registration Page              │
// │ Consumes AI Platform Identity Core register API.           │
// │ Wave 5 — Patient Workspace                                  │
// └─────────────────────────────────────────────────────────────┘

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { patientAuth } from "@/lib/patient-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

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
  if (PASSWORD_RULES.requireSpecialChar && !/[!@#$%^&*()_+\-=[\]{}|;':",./<>?`~]/.test(password)) {
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
  const [showRules, setShowRules] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      setIsLoading(false);
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) {
      toast.error(pwError);
      setIsLoading(false);
      return;
    }

    try {
      const result = await register(email, password, displayName || undefined);
      // Step 2: auto-verify email (dev mode — in production the user would
      // click a link from their email).
      setStep("verifying");
      const identityId = result.id;
      const verifyResult = await patientAuth.requestEmailVerification(identityId, email);
      // Complete the verification immediately
      await patientAuth.completeEmailVerification(verifyResult.token);
      setStep("done");
      toast.success("Email verified! You can now log in.");
      navigate("/patient/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
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
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name (optional)</Label>
              <Input
                id="name"
                placeholder="Jane Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder={PASSWORD_HINT}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (e.target.value) setShowRules(true);
                }}
                onFocus={() => setShowRules(true)}
                onBlur={() => { if (!password) setShowRules(false); }}
                required
                autoComplete="new-password"
              />
              {showRules && (
                <ul className="space-y-1 mt-2">
                  {RULE_CHECKS.map((rule) => {
                    const passed = rule.test(password);
                    return (
                      <li key={rule.key} className={`flex items-center gap-2 text-xs transition-colors ${passed ? "text-green-600" : "text-muted-foreground"}`}>
                        {passed ? <Check className="h-3 w-3 text-green-500 shrink-0" /> : <X className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
                        <span>{rule.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {step === "verifying" ? "Verifying email..." : isLoading ? "Creating account..." : "Create Account"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link href="/patient/login" className="text-primary hover:underline">
                Sign In
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}