// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Auth Guards                             │
// │ Protected route wrappers for the Patient and Clinic         │
// │ Workspaces.                                                 │
// │ Wave 5 — Patient Workspace                                  │
// │ Workstream B — Clinic Workspace (ClinicGuard)                │
// └─────────────────────────────────────────────────────────────┘

import { type ReactNode } from "react";
import { Link, Redirect } from "wouter";
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

// ── Clinic Workspace ───────────────────────────────────────

/**
 * Identity types permitted to enter the Clinic Workspace.
 *
 * Mirrors IdentityType in workers/src/platform/identity/types.ts.
 * This is a fail-closed allowlist: any identity type NOT listed here is
 * denied, which deliberately includes authenticated patients — a patient
 * session must never reach a clinic console.
 */
const CLINIC_IDENTITY_TYPES: readonly string[] = [
  "clinic",
  "staff",
  "administrator",
];

/**
 * True only when the identity type is explicitly allowlisted for the
 * Clinic Workspace. Undefined, empty, or unknown types return false.
 */
export function isClinicIdentity(identityType: string | undefined | null): boolean {
  if (!identityType) return false;
  return CLINIC_IDENTITY_TYPES.includes(identityType.trim().toLowerCase());
}

/**
 * Wraps clinic routes. Three outcomes:
 *   1. Auth state still resolving  → loading state (never renders children)
 *   2. Not authenticated           → redirect to login
 *   3. Authenticated, wrong type   → 403 notice, children never render
 *
 * Renders children only for an allowlisted clinic identity.
 */
export function ClinicGuard({ children, fallback }: AuthGuardProps) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">
            Verifying clinic access...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback ?? <Redirect to="/patient/login" />;
  }

  if (!isClinicIdentity(user?.identityType)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-xl font-semibold">Access restricted</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The Clinic Portal is available to authorised clinic staff only.
            Your account does not have clinic access.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Link
              href="/"
              className="text-sm font-medium text-primary hover:underline"
            >
              Return to the website
            </Link>
            <button
              onClick={() => void logout()}
              className="text-sm text-muted-foreground hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}