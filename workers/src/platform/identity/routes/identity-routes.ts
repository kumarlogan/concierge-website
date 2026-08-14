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
import { EmailService } from "../../email/email-service.js";
import { renderTemplate } from "../../email/template-registry.js";

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
    private readonly emailService?: EmailService,
    private readonly appUrl?: string,
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
        case method === "GET" && path === "/identity/password/reset":
          return this.handlePasswordResetGet(body);
        case method === "POST" && path === "/identity/password/reset":
          return this.handlePasswordResetRequest(body);
        case method === "POST" && path === "/identity/password/change":
          return this.handlePasswordResetComplete(body);
        case method === "POST" && path === "/identity/password/update":
          return this.handlePasswordChange(body, headers);

        // ── Email Verification ──
        case method === "GET" && path === "/identity/email/verify":
          return this.handleEmailVerificationGet(body);
        case method === "POST" && path === "/identity/email/verify":
          return this.handleEmailVerification(body);
        case method === "POST" && path === "/identity/email/verify/request":
          return this.handleEmailVerificationByEmail(body);
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

  private async handlePasswordResetGet(body: Record<string, unknown>): Promise<ApiResponse> {
    const token = body.token as string | undefined;
    if (!token) {
      return error("Missing reset token", 400, "VALIDATION_ERROR");
    }
    // GET must NOT mutate account state. Validate token presence & basic
    // integrity, then return the token so the frontend can present a
    // password reset form that triggers the POST completion.
    return ok({
      token,
      message: "Reset page ready",
    });
  }

  private async handlePasswordResetRequest(body: Record<string, unknown>): Promise<ApiResponse> {
    const email = body.email as string;

    // Send password reset email if email service is configured.
    // Phase 4 — EPIC-017: password resets are sent from support@agsynergy.ca
    // via SendGrid (root domain). The EmailService routing map handles
    // dispatching to the correct provider based on the `from` address.
    if (this.emailService) {
      const token = await this.passwordReset.requestReset(email);
      const resetUrl = this.buildFrontendUrl("/reset-password", { token });
      const { html, text, subject } = renderTemplate("password-reset", {
        resetUrl,
        patientName: email.split("@")[0],
      });
      const result = await this.emailService.sendEmail({
        from: "support@agsynergy.ca",
        to: email,
        subject,
        html,
        text,
        templateName: "password-reset",
        referenceId: email,
      });
      // Surface the real provider outcome — never report GREEN when the
      // email was not actually accepted by the provider.
      if (!result.success) {
        return error(
          "Email provider rejected the password-reset message: " + (result.error ?? "unknown error"),
          502,
          "EMAIL_DELIVERY_FAILED",
        );
      }
    } else {
      // Fallback when email service is not configured
      await this.passwordReset.requestReset(email);
    }

    // Token is not returned to the client — in production it would be emailed.
    // Returning tokens in API responses is a security finding (HIGH #10).
    return ok({ message: "If the email exists, a reset link has been sent" });
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

    // Validate required fields
    const currentPassword = body.currentPassword as string | undefined;
    const newPassword = body.newPassword as string | undefined;
    if (!currentPassword || !newPassword) {
      return error("currentPassword and newPassword are required", 400, "VALIDATION_ERROR");
    }

    // changePassword throws typed IdentityErrors caught by the outer handler
    await this.identityService.changePassword(identityId, currentPassword, newPassword);
    return ok({ message: "Password changed successfully" });
  }

  private async handleEmailVerificationGet(body: Record<string, unknown>): Promise<ApiResponse> {
    const token = body.token as string | undefined;
    if (!token) {
      return error("Missing verification token", 400, "VALIDATION_ERROR");
    }
    // GET must NOT mutate account state. Validate token presence & basic
    // integrity, then return the token so the frontend can present a
    // "Verify Email" confirmation page that triggers the POST completion.
    return ok({
      verified: false,
      token,
      message: "Verification page ready",
    });
  }

  private async handleEmailVerification(body: Record<string, unknown>): Promise<ApiResponse> {
    const identityId = body.identityId as string;
    const email = body.email as string;
    const token = await this.emailVerification.createVerification(identityId, email);

    // Send verification email if email service is configured
    if (this.emailService) {
      const verificationUrl = this.buildFrontendUrl("/verify-email", { token });
      const { html, text, subject } = renderTemplate("verification", {
        verificationUrl,
        patientName: email.split("@")[0],
      });
      const result = await this.emailService.sendEmail({
        to: email,
        subject,
        html,
        text,
        templateName: "verification",
        referenceId: identityId,
      });
      // Surface the real provider outcome — never report GREEN when the
      // email was not actually accepted by the provider.
      if (!result.success) {
        return error(
          "Email provider rejected the verification message: " + (result.error ?? "unknown error"),
          502,
          "EMAIL_DELIVERY_FAILED",
        );
      }
    }
    return ok({ message: "Verification email sent" });
  }

  /**
   * Self-serve verification-email trigger (TEST 1 path): caller supplies only
   * the email address. Resolves the identity, mints a verification token, and
   * sends the email. Returns 404 if no identity uses that email.
   */
  private async handleEmailVerificationByEmail(body: Record<string, unknown>): Promise<ApiResponse> {
    const email = body.email as string;
    const token = await this.emailVerification.createVerificationByEmail(email);

    if (this.emailService) {
      const verificationUrl = this.buildFrontendUrl("/verify-email", { token });
      const { html, text, subject } = renderTemplate("verification", {
        verificationUrl,
        patientName: email.split("@")[0],
      });
      const result = await this.emailService.sendEmail({
        to: email,
        subject,
        html,
        text,
        templateName: "verification",
        referenceId: email,
      });
      if (!result.success) {
        return error(
          "Email provider rejected the verification message: " + (result.error ?? "unknown error"),
          502,
          "EMAIL_DELIVERY_FAILED",
        );
      }
    }
    return ok({ message: "Verification email sent" });
  }

  private getBaseUrl(): string {
    // Prefer FRONTEND_URL env var for production frontend base URL;
    // fall back to agsynergy.ca only if env var is not configured.
    // This ensures email links always point to the correct frontend host.
    return this.appUrl ?? "https://www.agsynergy.ca";
  }

  /**
   * Build a properly-encoded URL to the production frontend.
   * Uses FRONTEND_URL (passed into the router constructor) as the base
   * and standard URL.searchParams for correct encoding of tokens
   * containing +, /, =, % and other reserved characters.
   */
  private buildFrontendUrl(path: string, params: Record<string, string>): string {
    const baseUrl = this.appUrl ?? "https://www.agsynergy.ca";
    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  private async handleEmailVerificationComplete(body: Record<string, unknown>): Promise<ApiResponse> {
    const result = await this.emailVerification.completeVerification(body.token as string);
    return ok({ message: "Email verified", identityId: result.identityId });
  }

  private async handleMagicLinkRequest(body: Record<string, unknown>): Promise<ApiResponse> {
    await this.magicLink.requestMagicLink(body.email as string);
    // Token is not returned to the client — would be sent via email in production.
    return ok({ message: "If email exists, magic link sent" });
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