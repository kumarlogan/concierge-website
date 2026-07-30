// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Cloudflare Turnstile Verification      │
// │ Phase 1: Concierge Platform Foundation — Sprint 2.2          │
// └─────────────────────────────────────────────────────────────┘
//
// Verifies Cloudflare Turnstile tokens server-side.
// Called from public route handlers (consultations, contact).
//
// If TURNSTILE_SECRET_KEY is not configured, verification is
// silently skipped (development mode).

interface TurnstileResult {
  success: boolean;
  error?: string;
}

/**
 * Verify a Cloudflare Turnstile token.
 *
 * @param token — The `cf-turnstile-response` value from the request body
 * @param secretKey — The Turnstile secret key (from env.TURNSTILE_SECRET_KEY)
 * @param ip — Optional visitor IP for strict verification
 */
export async function verifyTurnstile(
  token: string | undefined,
  secretKey: string | undefined,
  ip?: string,
): Promise<TurnstileResult> {
  // Turnstile not configured — skip verification (development mode)
  if (!secretKey) {
    return { success: true };
  }

  // No token supplied
  if (!token) {
    return { success: false, error: "Missing Turnstile token" };
  }

  try {
    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (ip) formData.append("remoteip", ip);

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: formData },
    );

    const result = (await response.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    if (!result.success) {
      return {
        success: false,
        error: `Turnstile verification failed: ${(result["error-codes"] || ["unknown"]).join(", ")}`,
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `Turnstile verification error: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}