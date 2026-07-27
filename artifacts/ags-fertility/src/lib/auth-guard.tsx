// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Auth Guard                              │
// │ Protected route wrapper for the Patient Workspace.          │
// │ Wave 5 — Patient Workspace                                  │
// └─────────────────────────────────────────────────────────────┘

import { type ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "./auth-context";

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Wraps patient routes that require authentication.
 * Redirects to /patient/login if not authenticated.
 * Shows a loading state while checking auth status.
 */
export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading your workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback ?? <Redirect to="/patient/login" />;
  }

  return <>{children}</>;
}

/**
 * Guest guard — redirects authenticated users away from login/register pages.
 */
export function GuestGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/patient/dashboard" />;
  }

  return <>{children}</>;
}