// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Forgot Password Page                    │
// │ Consumes AI Platform Identity Core password reset API.     │
// │ Wave 5 — Patient Workspace                                  │
// └─────────────────────────────────────────────────────────────┘

import { useState } from "react";
import { Link } from "wouter";
import { patientAuth } from "@/lib/patient-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await patientAuth.requestPasswordReset(email);
      setSent(true);
      toast.success("If that email exists, a reset link has been sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            {sent
              ? "Check your email for the reset link"
              : "Enter your email to receive a reset link"}
          </CardDescription>
        </CardHeader>
        {!sent ? (
          <form onSubmit={handleSubmit}>
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
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                <Link href="/patient/login" className="text-primary hover:underline">
                  Back to Sign In
                </Link>
              </p>
            </CardFooter>
          </form>
        ) : (
          <CardFooter>
            <Link href="/patient/login" className="w-full">
              <Button variant="outline" className="w-full">
                Back to Sign In
              </Button>
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}