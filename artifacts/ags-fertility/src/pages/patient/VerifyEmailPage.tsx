// ┌─────────────────────────────────────────────────────────────┐
// │ PRG-004 — Email Verification Landing Page                   │
// │ Publicly accessible — no AuthGuard required.               │
// │ Extracts ?token= from URL and calls completeEmailVerification│
// └─────────────────────────────────────────────────────────────┘

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { patientAuth } from '@/lib/patient-api';

type VerifyState =
  | { status: 'no-token' }
  | { status: 'loading' }
  | { status: 'success' }
  | { status: 'error'; message: string };

export default function VerifyEmailPage() {
  const [, navigate] = useLocation();

  // Extract token from query string (no router params — this is a plain ?token= link)
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  const [state, setState] = useState<VerifyState>(
    token ? { status: 'loading' } : { status: 'no-token' },
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    patientAuth
      .completeEmailVerification(token)
      .then(() => {
        if (!cancelled) setState({ status: 'success' });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Verification failed. Please try again.';
          setState({ status: 'error', message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6 py-6">
          {state.status === 'no-token' && (
            <>
              <AlertCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
              <div className="text-center space-y-1">
                <p className="font-semibold text-destructive">Invalid verification link</p>
                <p className="text-sm text-muted-foreground">
                  This link is missing a verification token. Please use the link from your
                  verification email, or request a new one.
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/patient/login')}>
                Back to sign in
              </Button>
            </>
          )}

          {state.status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Verifying your email address…</p>
            </>
          )}

          {state.status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 text-green-600" aria-hidden="true" />
              <div className="text-center space-y-1">
                <p className="font-semibold">Email verified</p>
                <p className="text-sm text-muted-foreground">
                  Your email has been verified. You can now sign in.
                </p>
              </div>
              <Button onClick={() => navigate('/patient/login')}>Sign in</Button>
            </>
          )}

          {state.status === 'error' && (
            <>
              <AlertCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
              <div className="text-center space-y-1">
                <p className="font-semibold text-destructive">Verification failed</p>
                <p className="text-sm text-muted-foreground">{state.message}</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/patient/login')}>
                Back to sign in
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
