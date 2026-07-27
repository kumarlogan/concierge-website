// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — JWT Authentication Middleware                  │
// │ Reusable JWT verification for all protected endpoints.       │
// │ Wave 8.1 — Production Hardening & Security Closure           │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: Middleware extracts identity ID from JWT only.
// No PHI is processed or stored by this middleware.
// Reusable: Every AGS product applies this middleware identically.

import type { Env, RouteHandler } from "../types/env.js";
import type { JwtPayload } from "../platform/identity/jwt-manager.js";

// ════════════════════════════════════════════════
// Authenticated Identity (attached to request)
// ════════════════════════════════════════════════

export interface AuthenticatedIdentity {
  identityId: string;
  identityType: string;
  sessionId?: string;
  email?: string;
  mfaLevel: number;
  trustScore?: number;
}

// ════════════════════════════════════════════════
// JWT Verification Error
// ════════════════════════════════════════════════

export class JwtAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 401,
  ) {
    super(message);
    this.name = "JwtAuthError";
  }
}

// ════════════════════════════════════════════════
// JWT Extraction & Verification
// ════════════════════════════════════════════════

/**
 * Extract and verify JWT from Authorization header.
 * Returns the verified payload or throws JwtAuthError.
 */
export async function verifyJwtFromRequest(
  request: Request,
  env: Env,
): Promise<AuthenticatedIdentity> {
  // ── Step 1: Extract token from Authorization header ──────
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    throw new JwtAuthError("Missing Authorization header", "MISSING_AUTH_HEADER");
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new JwtAuthError("Invalid Authorization header format", "INVALID_AUTH_FORMAT");
  }

  const token = parts[1];
  if (!token) {
    throw new JwtAuthError("Empty bearer token", "EMPTY_TOKEN");
  }

  // ── Step 2: Verify JWT signature ─────────────────────────
  // Use the Identity Core's JwtManager for cryptographic verification.
  // Every token MUST have a verifiable signature.
  const { JwtManager } = await import("../platform/identity/jwt-manager.js");
  const jwtManager = new JwtManager();

  // Register the platform key pair for verification
  const platformKid = env.PLATFORM_JWT_KID || "default";
  const platformPublicKey = env.PLATFORM_JWT_PUBLIC_KEY;

  if (platformPublicKey) {
    jwtManager.registerKeyPair({
      kid: platformKid,
      publicKey: platformPublicKey,
      privateKey: "", // Not needed for verification
      algorithm: "RS256",
    });
  }

  // Verify JWT — fails closed on any verification error
  let payload: JwtPayload;
  try {
    payload = await jwtManager.verify(token);
  } catch {
    throw new JwtAuthError("JWT verification failed", "VERIFICATION_FAILED");
  }

  // ── Step 3: Validate token claims ────────────────────────
  if (!payload.sub) {
    throw new JwtAuthError("JWT missing subject claim", "MISSING_SUBJECT");
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new JwtAuthError("JWT expired", "TOKEN_EXPIRED");
  }

  // Check issuer
  const validIssuers = [
    "ai-platform:identity-core",
    "ai-platform:concierge",
  ];
  if (payload.iss && !validIssuers.includes(payload.iss)) {
    throw new JwtAuthError("Invalid issuer", "INVALID_ISSUER");
  }

  // ── Step 4: Return authenticated identity ────────────────
  return {
    identityId: payload.sub,
    identityType: payload.identity_type || "patient",
    sessionId: payload.session_id,
    email: payload.email,
    mfaLevel: payload.mfa_level || 0,
    trustScore: payload.trust_score,
  };
}

// ════════════════════════════════════════════════
// Route Handler Wrapper
// ════════════════════════════════════════════════

/**
 * Wrap a route handler with JWT authentication.
 * Attaches authenticated identity to the request for downstream handlers.
 */
export function withJwtAuth(
  handler: RouteHandler,
): RouteHandler {
  return async (request: Request, env: Env, params: Record<string, string>): Promise<Response> => {
    try {
      const identity = await verifyJwtFromRequest(request, env);

      // Attach identity to request headers for downstream handlers
      // This replaces the spoofable x-identity-id header
      const headers = new Headers(request.headers);
      headers.set("x-authenticated-identity-id", identity.identityId);
      headers.set("x-authenticated-identity-type", identity.identityType);
      if (identity.sessionId) {
        headers.set("x-authenticated-session-id", identity.sessionId);
      }

      // Create new request with authenticated headers
      const authenticatedRequest = new Request(request.url, {
        method: request.method,
        headers,
        body: request.body,
      });

      return handler(authenticatedRequest, env, params);
    } catch (err) {
      if (err instanceof JwtAuthError) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: err.message,
            code: err.code,
          }),
          {
            status: err.status,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      throw err;
    }
  };
}

// ════════════════════════════════════════════════
// Identity Extraction Helper
// ════════════════════════════════════════════════

/**
 * Extract authenticated identity from request headers.
 * Use in route handlers after withJwtAuth wrapper.
 */
export function getAuthenticatedIdentity(request: Request): AuthenticatedIdentity {
  const identityId = request.headers.get("x-authenticated-identity-id");
  const identityType = request.headers.get("x-authenticated-identity-type") || "patient";
  const sessionId = request.headers.get("x-authenticated-session-id") || undefined;

  if (!identityId) {
    throw new JwtAuthError("No authenticated identity found", "NO_IDENTITY", 401);
  }

  return {
    identityId,
    identityType,
    sessionId,
    mfaLevel: 0,
  };
}

/**
 * Get identity ID from request (JWT-authenticated only).
 * Only works inside handlers wrapped with withJwtAuth.
 * x-identity-id header is NOT accepted — cryptographically bound identity required.
 */
export function getIdentityId(request: Request): string {
  const authIdentity = request.headers.get("x-authenticated-identity-id");
  if (authIdentity) return authIdentity;

  throw new JwtAuthError("No authenticated identity found — endpoint requires JWT auth", "NO_IDENTITY", 401);
}
