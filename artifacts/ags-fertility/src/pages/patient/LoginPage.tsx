// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Patient Login Page                      │
// │ Consumes AI Platform Identity Core login API.               │
// │ Wave 5 — Patient Workspace                                  │
// └─────────────────────────────────────────────────────────────┘

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login, completeMFA } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/patient/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "MFA_REQUIRED") {
        setMfaRequired(true);
      } else {
        toast.error(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await completeMFA(mfaCode);
      toast.success("Verified! Welcome back.");
      navigate("/patient/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "MFA verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Patient Login</CardTitle>
          <CardDescription>Access your AG Synergy patient portal</CardDescription>
        </CardHeader>

        {!mfaRequired ? (
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/patient/forgot-password"
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {/* Social login buttons */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" type="button" className="w-full" disabled>
                  Google
                </Button>
                <Button variant="outline" type="button" className="w-full" disabled>
                  OIDC
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/patient/register" className="text-primary hover:underline">
                  Register
                </Link>
              </p>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleMFA}>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the verification code from your authenticator app.
              </p>
              <div className="space-y-2">
                <Label htmlFor="mfa-code">Verification Code</Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  required
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Verifying..." : "Verify"}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}