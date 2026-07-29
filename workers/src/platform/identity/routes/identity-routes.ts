// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Router                           │
// │ Reusable API endpoints for identity operations.             │
// │ NOT Concierge-specific — any product consumes these.        │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

import { IdentityService } from "../identity-service.js";
import { EmailVerificationManager } from "../email-verification.js";
import { PasswordResetManager } from "../password-reset.js";
import { MagicLinkManager } from "../magic-link.js";
import { OAuthService } from "../oauth-provider.js";
import { MFAManager } from "../mfa.js";
import { JwtManager } from "../jwt-manager.js";
import { IdentityProviderRegistry } from "../identity-provider-registry.js";

// ── Worker environment type (keeps this file self-contained) ──
interface Env {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DB: any;
  [key: string]: unknown;
}

import type { D1Database } from "@cloudflare/workers-types";

// ── Request/Response wrappers ──────────────────────────────

interface ApiResponse {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

function ok(data: Record<string, unknown>, status = 200): ApiResponse {
  return { status, body: { success: true, ...data } };
}

function error(message: string, status = 400, code = "ERROR"): ApiResponse {
  return { status, body: { success: false, error: { code, message } } };
}

// ── Identity Router ────────────────────────────────────────

export class IdentityRouter {
  constructor(
    private readonly identityService: IdentityService,
    private readonly emailVerification: EmailVerificationManager,
    private readonly passwordReset: PasswordResetManager,
    private readonly magicLink: MagicLinkManager,
    private readonly oauth: OAuthService,
    private readonly mfa: MFAManager,
    private readonly jwt: JwtManager,
    private readonly providerRegistry: IdentityProviderRegistry,
  ) {}

  /**
   * Route an identity API request.
   * Used by the main Worker router to handle /identity/* paths.
   */
  async route(
    method: string,
    path: string,
    body: Record<string, unknown>,
    headers: Record<string, string>,
    env: Env,
  ): Promise<ApiResponse> {
    try {
      switch (true) {
        // ── Identity ──
        case method === "POST" && path === "/identity/register":
          return this.handleRegister(body, headers);
        case method === "POST" && path === "/identity/login":
          return this.handleLogin(body, headers);
        case method === "POST" && path === "/identity/logout":
          return this.handleLogout(body, headers);

        // ── Tokens ──
        case method === "POST" && path === "/identity/refresh":
          return this.handleRefresh(body);

        // ── Password ──
        case method === "POST" && path === "/identity/password/reset":
          return this.handlePasswordResetRequest(body);
        case method === "POST" && path === "/identity/password/change":
          return this.handlePasswordResetComplete(body);
        case method === "POST" && path === "/identity/password/update":
          return this.handlePasswordChange(body, headers);

        // ── Email Verification ──
        case method === "POST" && path === "/identity/email/verify":
          return this.handleEmailVerification(body);
        case method === "POST" && path === "/identity/email/verify/complete":
          return this.handleEmailVerificationComplete(body);

        // ── Magic Link ──
        case method === "POST" && path === "/identity/magic-link":
          return this.handleMagicLinkRequest(body);
        case method === "POST" && path === "/identity/magic-link/verify":
          return this.handleMagicLinkVerify(body, headers);

        // ── OAuth ──
        case method === "POST" && path === "/identity/oauth/initiate":
          return this.handleOAuthInitiate(body);
        case method === "POST" && path === "/identity/oauth/callback":
          return this.handleOAuthCallback(body, headers);

        // ── MFA ──
        case method === "POST" && path === "/identity/mfa/setup":
          return this.handleMFASetup(body, headers);
        case method === "POST" && path === "/identity/mfa/verify":
          return this.handleMFAVerify(body, headers);

        // ── GET ──
        case method === "GET" && path === "/identity/me":
          return this.handleGetIdentity(body, headers);
        case method === "GET" && path === "/identity/providers":
          return this.handleListProviders();

        default:
          return error("Not found", 404, "NOT_FOUND");
      }
    } catch (err) {
      // Duck-type check: IdentityError subclasses carry status + code
      const e = err as Record<string, unknown>;
      if (e !== null && typeof e === "object" && typeof e.status === "number" && typeof e.code === "string") {
        return error(e.message as string, e.status as number, e.code as string);
      }
      if (err instanceof Error) {
        return error(err.message, 500, "INTERNAL_ERROR");
      }
      return error("Unknown error", 500, "INTERNAL_ERROR");
    }
  }

  private async handleRegister(body: Record<string, unknown>, headers: Record<string, string>): Promise<ApiResponse> {
    const identity = await this.identityService.register({
      identityType: body.identityType as any,
      email: body.email as string,
      password: body.password as string | undefined,
      profile: body.profile as any,
      metadata: body.metadata as Record<string, unknown> | undefined,
    }, { ipAddress: headers["x-forwarded-for"] });
    return ok({ identity });
  }

  private async handleLogin(body: Record<string, unknown>, headers: Record<string, string>): Promise<ApiResponse> {
    const result = await this.identityService.loginWithPassword({
      email: body.email as string,
      password: body.password as string,
      ipAddress: headers["x-forwarded-for"] || (body.ipAddress as string),
      deviceFingerprint: body.deviceFingerprint as string | undefined,
      userAgent: headers["user-agent"],
    });
    return ok(result as unknown as Record<string, unknown>);
  }

  private async handleLogout(body: Record<string, unknown>, headers: Record<string, string>): Promise<ApiResponse> {
    const authHeader = headers["authorization"] || "";
    const token = authHeader.replace("Bearer ", "");
    let payload: { sub?: string; session_id?: string };
    try {
      payload = await this.jwt.verify(token);
    } catch {
      return error("Invalid authorization", 401, "AUTH_ERROR");
    }
    await this.identityService.logout(payload.session_id!, payload.sub!);
    return ok({ message: "Logged out" });
  }

  private async handleRefresh(body: Record<string, unknown>): Promise<ApiResponse> {
    const result = await this.identityService.refreshAccessToken(
      body.refreshToken as string,
    );
    return ok(result as unknown as Record<string, unknown>);
  }

  private async handlePasswordResetRequest(body: Record<string, unknown>): Promise<ApiResponse> {
    const token = await this.passwordReset.requestReset(body.email as string);
    // In production, token is emailed — here we return it for development
    return ok({ token, message: "If the email exists, a reset link has been sent" });
  }

  private async handlePasswordResetComplete(body: Record<string, unknown>): Promise<ApiResponse> {
    await this.passwordReset.completeReset(body.token as string, body.newPassword as string);
    return ok({ message: "Password reset successfully" });
  }

  private async handlePasswordChange(body: Record<string, unknown>, headers: Record<string, string>): Promise<ApiResponse> {
    // Requires auth
    const authHeader = headers["authorization"] || "";
    const token = authHeader.replace("Bearer ", "");
    let identityId: string;
    try {
      identityId = (await this.jwt.verify(token)).sub;
    } catch {
      return error("Invalid authorization", 401, "AUTH_ERROR");
    }
    const identity = await this.identityService.getIdentity(identityId);
    if (!identity) return error("Identity not found", 404, "NOT_FOUND");

    // Change password logic
    await this.passwordReset.completeReset("", body.newPassword as string);
    return ok({ message: "Password changed successfully" });
  }

  private async handleEmailVerification(body: Record<string, unknown>): Promise<ApiResponse> {
    const token = await this.emailVerification.createVerification(
      body.identityId as string,
      body.email as string,
    );
    return ok({ token, message: "Verification email sent (development: token returned)" });
  }

  private async handleEmailVerificationComplete(body: Record<string, unknown>): Promise<ApiResponse> {
    const result = await this.emailVerification.completeVerification(body.token as string);
    return ok({ message: "Email verified", identityId: result.identityId });
  }

  private async handleMagicLinkRequest(body: Record<string, unknown>): Promise<ApiResponse> {
    const result = await this.magicLink.requestMagicLink(body.email as string);
    return ok({ token: result, message: "If email exists, magic link sent" });
  }

  private async handleMagicLinkVerify(body: Record<string, unknown>, headers: Record<string, string>): Promise<ApiResponse> {
    const result = await this.magicLink.verifyMagicLink(
      body.token as string,
      headers["x-forwarded-for"] || (body.ipAddress as string),
      headers["user-agent"],
      body.deviceFingerprint as string | undefined,
    );
    return ok(result as unknown as Record<string, unknown>);
  }

  private async handleOAuthInitiate(body: Record<string, unknown>): Promise<ApiResponse> {
    const result = await this.oauth.initiateOAuth(
      body.providerType as any,
      body.redirectUri as string,
    );
    return ok(result as unknown as Record<string, unknown>);
  }

  private async handleOAuthCallback(body: Record<string, unknown>, headers: Record<string, string>): Promise<ApiResponse> {
    const result = await this.oauth.handleCallback({
      providerType: body.providerType as any,
      code: body.code as string,
      redirectUri: body.redirectUri as string,
      deviceFingerprint: body.deviceFingerprint as string | undefined,
      ipAddress: headers["x-forwarded-for"] || (body.ipAddress as string),
      userAgent: headers["user-agent"],
    });
    return ok(result as unknown as Record<string, unknown>);
  }

  private async handleMFASetup(body: Record<string, unknown>, headers: Record<string, string>): Promise<ApiResponse> {
    const authHeader = headers["authorization"] || "";
    const token = authHeader.replace("Bearer ", "");
    let identityId: string;
    try {
      identityId = (await this.jwt.verify(token)).sub;
    } catch {
      return error("Invalid authorization", 401, "AUTH_ERROR");
    }
    const result = await this.mfa.setupTOTP(identityId);
    return ok(result as unknown as Record<string, unknown>);
  }

  private async handleMFAVerify(body: Record<string, unknown>, headers: Record<string, string>): Promise<ApiResponse> {
    const authHeader = headers["authorization"] || "";
    const token = authHeader.replace("Bearer ", "");
    let identityId: string;
    try {
      identityId = (await this.jwt.verify(token)).sub;
    } catch {
      return error("Invalid authorization", 401, "AUTH_ERROR");
    }
    const result = await this.mfa.verifyAndEnable(identityId, body.code as string);
    return ok(result as unknown as Record<string, unknown>);
  }

  private async handleGetIdentity(body: Record<string, unknown>, headers: Record<string, string>): Promise<ApiResponse> {
    const authHeader = headers["authorization"] || "";
    const token = authHeader.replace("Bearer ", "");
    let identityId: string;
    try {
      identityId = (await this.jwt.verify(token)).sub;
    } catch {
      return error("Invalid authorization", 401, "AUTH_ERROR");
    }
    const identity = await this.identityService.getIdentity(identityId);
    return ok({ identity });
  }

  private async handleListProviders(): Promise<ApiResponse> {
    const providers = this.providerRegistry.listProviders().map((p) => ({
      id: p.id,
      name: p.displayName,
      type: p.providerType,
      methods: p.supportedMethods,
    }));
    return ok({ providers });
  }
}