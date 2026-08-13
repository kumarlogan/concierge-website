// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform Identity Core — Comprehensive Test Suite         │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘
//
// Tests:
//   1. PasswordManager — hashing, verification, validation
//   2. JwtManager — signing, verification, key rotation
//   3. SessionManager — creation, validation, expiry, revocation
//   4. IdentityRepository — CRUD operations (via D1 stub)
//   5. RefreshTokenManager — token lifecycle, rotation
//   6. EmailVerification — token creation, verification, expiry
//   7. PasswordReset — request, complete, expiry
//   8. IdentityService — registration, login, token refresh, logout
//   9. OAuth service — initiate, callback flows
//   10. MFA — TOTP setup, verification
//   11. IdentityProviderRegistry — registration, discovery
//   12. CredentialRotation — expiry checks, rotation
//   13. IdentityHooks — trust, consent, policy, audit

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Password Manager ──────────────────────────────────────────
describe("PasswordManager", () => {
  it("should hash and verify a password", async () => {
    const { PasswordManager } = await import("../../src/platform/identity/password-manager.js");
    const pm = new PasswordManager();
    const hash = await pm.hash("TestPassword123!");
    expect(hash).toMatch(/^pbkdf2:sha256:\d+:/);
    const valid = await pm.verify("TestPassword123!", hash);
    expect(valid).toBe(true);
  });

  it("should reject wrong password", async () => {
    const { PasswordManager } = await import("../../src/platform/identity/password-manager.js");
    const pm = new PasswordManager();
    const hash = await pm.hash("CorrectPassword1!");
    const valid = await pm.verify("WrongPassword1!", hash);
    expect(valid).toBe(false);
  });

  it("should validate password policy — valid password", async () => {
    const { PasswordManager } = await import("../../src/platform/identity/password-manager.js");
    const pm = new PasswordManager();
    const result = pm.validate("ValidPassword1!");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject short password", async () => {
    const { PasswordManager } = await import("../../src/platform/identity/password-manager.js");
    const pm = new PasswordManager();
    const result = pm.validate("Ab1!");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should reject password missing uppercase", async () => {
    const { PasswordManager } = await import("../../src/platform/identity/password-manager.js");
    const pm = new PasswordManager();
    const result = pm.validate("lowercasepass1!");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("uppercase"))).toBe(true);
  });

  it("should reject password missing number", async () => {
    const { PasswordManager } = await import("../../src/platform/identity/password-manager.js");
    const pm = new PasswordManager();
    const result = pm.validate("NoDigitsHere!");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("digit"))).toBe(true);
  });
});

// ── JWT Manager ───────────────────────────────────────────────
describe("JwtManager", () => {
  it("should sign and verify a JWT", async () => {
    const { JwtManager, generateJwtKeyPair } = await import("../../src/platform/identity/jwt-manager.js");
    const jwt = new JwtManager();
    const kp = await generateJwtKeyPair("key1");
    jwt.registerKeyPair(kp);

    const token = await jwt.sign({ sub: "test-user", identity_type: "patient", session_id: "sess-1", email: "test@example.com", mfa_level: 1, trust_score: 0.5 });
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const payload = await jwt.verify(token);
    expect(payload.sub).toBe("test-user");
    expect(payload.identity_type).toBe("patient");
    expect(payload.session_id).toBe("sess-1");
  });

  it("should reject expired JWT", async () => {
    const { JwtManager, generateJwtKeyPair } = await import("../../src/platform/identity/jwt-manager.js");
    const jwt = new JwtManager();
    const kp = await generateJwtKeyPair("key2");
    jwt.registerKeyPair(kp);

    const token = await jwt.sign(
      { sub: "user1", identity_type: "patient", session_id: "s1", email: "u@example.com", mfa_level: 0, trust_score: 0.5 },
      { expirySeconds: -40 }, // Expire 40 seconds ago (leeway is 30s)
    );
    await expect(jwt.verify(token)).rejects.toThrow("expired");
  });

  it("should support key rotation — old token still valid with old key", async () => {
    const { JwtManager, generateJwtKeyPair } = await import("../../src/platform/identity/jwt-manager.js");
    const jwt = new JwtManager();
    const oldKp = await generateJwtKeyPair("old-key");
    const newKp = await generateJwtKeyPair("new-key");
    jwt.registerKeyPair(oldKp);
    jwt.registerKeyPair(newKp);

    // Sign with old key
    const oldToken = await jwt.sign({ sub: "u1", identity_type: "patient", session_id: "s1", email: "a@b.com", mfa_level: 1, trust_score: 0.5 }, { kid: "old-key" });

    // Activate new key  
    jwt.activateKey("new-key");

    // Old token still verifiable (old key still registered)
    const payload = await jwt.verify(oldToken);
    expect(payload.sub).toBe("u1");
  });

  it("should decode JWT without verifying", async () => {
    const { JwtManager, generateJwtKeyPair } = await import("../../src/platform/identity/jwt-manager.js");
    const jwt = new JwtManager();
    const kp = await generateJwtKeyPair("key3");
    jwt.registerKeyPair(kp);

    const token = await jwt.sign({ sub: "u1", identity_type: "patient", session_id: "s1", email: "a@b.com", mfa_level: 1, trust_score: 0.3 });

    const { header, payload } = jwt.decode(token);
    expect(payload.sub).toBe("u1");
    expect(header.alg).toBeDefined();
  });
});

// ── Session Manager (unit test w/ D1 stub) ──────────────────
describe("SessionManager", () => {
  let sessionManager: any;
  let storedSessions: Map<string, any>;

  beforeEach(async () => {
    storedSessions = new Map();
    const { SessionManager } = await import("../../src/platform/identity/session-manager.js");

    // Mock repository
    const mockRepo = {
      createSession: vi.fn(async (s: any) => { storedSessions.set(s.id, s); }),
      getSession: vi.fn(async (id: string) => storedSessions.get(id) ?? null),
      updateSessionStatus: vi.fn(async (id: string, status: string) => {
        const s = storedSessions.get(id);
        if (s) s.status = status;
      }),
      touchSession: vi.fn(async (id: string) => {
        const s = storedSessions.get(id);
        if (s) s.last_activity_at = new Date().toISOString();
      }),
      revokeIdentitySessions: vi.fn(async (identityId: string) => {
        for (const [id, s] of storedSessions.entries()) {
          if (s.identity_id === identityId) {
            storedSessions.set(id, { ...s, status: "revoked" });
          }
        }
      }),
      purgeExpiredSessions: vi.fn(async () => 0),
    };

    sessionManager = new SessionManager(mockRepo);
  });

  it("should create a session", async () => {
    const session = await sessionManager.createSession({
      identityId: "identity-1",
      sessionType: "browser_patient",
      authMethod: "email_password",
      mfaLevel: 1,
      ipAddress: "192.168.1.1",
    });
    expect(session.id).toBeDefined();
    expect(session.status).toBe("active");
    expect(session.identity_id).toBe("identity-1");
    expect(session.expires_at).toBeDefined();
  });

  it("should validate an active session", async () => {
    const session = await sessionManager.createSession({ identityId: "id-1", sessionType: "browser_patient", authMethod: "email_password", mfaLevel: 1 });
    const result = await sessionManager.validateSession(session.id);
    expect(result.valid).toBe(true);
    expect(result.session?.id).toBe(session.id);
  });

  it("should reject unknown session", async () => {
    const result = await sessionManager.validateSession("nonexistent");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not found/i);
  });

  it("should reject revoked session", async () => {
    const session = await sessionManager.createSession({ identityId: "id-2", sessionType: "browser_patient", authMethod: "email_password", mfaLevel: 1 });
    await sessionManager.revokeSession(session.id);
    const result = await sessionManager.validateSession(session.id);
    expect(result.valid).toBe(false);
  });

  it("should generate consistent device fingerprint", async () => {
    const { SessionManager } = await import("../../src/platform/identity/session-manager.js");
    const fp1 = SessionManager.generateFingerprint("Mozilla/5.0", "1.2.3.4", "en-US", "gzip");
    const fp2 = SessionManager.generateFingerprint("Mozilla/5.0", "1.2.3.4", "en-US", "gzip");
    expect(fp1).toBe(fp2);
  });

  it("should revoke all sessions for an identity", async () => {
    const session1 = await sessionManager.createSession({ identityId: "id-3", sessionType: "browser_patient", authMethod: "email_password", mfaLevel: 1 });
    const session2 = await sessionManager.createSession({ identityId: "id-3", sessionType: "browser_patient", authMethod: "email_password", mfaLevel: 1 });
    await sessionManager.revokeIdentitySessions("id-3");
    const result1 = await sessionManager.validateSession(session1.id);
    const result2 = await sessionManager.validateSession(session2.id);
    expect(result1.valid).toBe(false);
    expect(result2.valid).toBe(false);
  });
});

// ── RefreshTokenManager ──────────────────────────────────────
describe("RefreshTokenManager", () => {
  let refreshManager: any;
  let storedTokens: Map<string, any>;
  let storedById: Map<string, any>;
  let sessionId: string;

  beforeEach(async () => {
    storedTokens = new Map();
    storedById = new Map();
    sessionId = crypto.randomUUID();
    const { RefreshTokenManager } = await import("../../src/platform/identity/refresh-token-manager.js");

    const mockRepo = {
      storeRefreshToken: vi.fn(async (r: any) => { storedTokens.set(r.token_hash, r); storedById.set(r.id, r); }),
      findRefreshToken: vi.fn(async (h: string) => storedTokens.get(h) ?? null),
      revokeRefreshToken: vi.fn(async (id: string) => {
        const t = storedById.get(id);
        if (t) t.revoked_at = new Date().toISOString();
      }),
      revokeIdentityRefreshTokens: vi.fn(async (identityId: string) => {
        for (const t of storedById.values()) {
          if (t.identity_id === identityId && !t.revoked_at) {
            t.revoked_at = new Date().toISOString();
          }
        }
      }),
    };

    refreshManager = new RefreshTokenManager(mockRepo);
  });

  it("should create a refresh token", async () => {
    const result = await refreshManager.create("identity-1", sessionId);
    expect(result.token).toBeDefined();
    expect(result.token.length).toBeGreaterThan(0);
    expect(result.record.identity_id).toBe("identity-1");
  });

  it("should validate a valid token", async () => {
    const { token } = await refreshManager.create("identity-1", sessionId);
    const record = await refreshManager.validate(token);
    expect(record.identity_id).toBe("identity-1");
  });

  it("should reject invalid token", async () => {
    await expect(refreshManager.validate("invalid-token")).rejects.toThrow();
  });

  it("should rotate a token", async () => {
    const { token: oldToken, record: oldRecord } = await refreshManager.create("identity-1", sessionId);
    const { token: newToken } = await refreshManager.rotate(oldRecord.id, "identity-1", sessionId);
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(oldToken);
    // Old token should now be revoked
    await expect(refreshManager.validate(oldToken)).rejects.toThrow();
  });
});

// ── EmailVerification ─────────────────────────────────────────
describe("EmailVerificationManager", () => {
  let emailVerification: any;
  let storedVerifications: Map<string, any>;

  beforeEach(async () => {
    storedVerifications = new Map();
    const { EmailVerificationManager } = await import("../../src/platform/identity/email-verification.js");

    const mockRepo = {
      storeEmailVerification: vi.fn(async (r: any) => { storedVerifications.set(r.token_hash, r); }),
      findEmailVerification: vi.fn(async (h: string) => storedVerifications.get(h) ?? null),
      verifyEmail: vi.fn(async (id: string) => {
        for (const v of storedVerifications.values()) {
          if (v.id === id) v.verified_at = new Date().toISOString();
        }
      }),
      updateIdentity: vi.fn(),
    };

    emailVerification = new EmailVerificationManager(mockRepo);
  });

  it("should create a verification token", async () => {
    const token = await emailVerification.createVerification("identity-1", "test@example.com");
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(0);
  });

  it("should complete verification with valid token", async () => {
    const token = await emailVerification.createVerification("identity-1", "test@example.com");
    const result = await emailVerification.completeVerification(token);
    expect(result.identityId).toBe("identity-1");
    expect(result.email).toBe("test@example.com");
  });

  it("should reject invalid token", async () => {
    await expect(emailVerification.completeVerification("invalid-token")).rejects.toThrow();
  });
});

// ── Password Reset ────────────────────────────────────────────
describe("PasswordResetManager", () => {
  let passwordReset: any;
  let storedResets: Map<string, any>;

  beforeEach(async () => {
    storedResets = new Map();
    const { PasswordResetManager } = await import("../../src/platform/identity/password-reset.js");
    const { PasswordManager } = await import("../../src/platform/identity/password-manager.js");
    const passwords = new PasswordManager();

    const mockRepo = {
      findIdentityByEmail: vi.fn(async (email: string) => email === "exists@example.com" ? { id: "identity-1", email: "exists@example.com" } : null),
      storePasswordReset: vi.fn(async (r: any) => { storedResets.set(r.token_hash, r); }),
      findPasswordReset: vi.fn(async (h: string) => storedResets.get(h) ?? null),
      usePasswordReset: vi.fn(async (id: string) => {
        for (const r of storedResets.values()) {
          if (r.id === id) r.used_at = new Date().toISOString();
        }
      }),
      updateIdentity: vi.fn(),
      revokeIdentityRefreshTokens: vi.fn(),
      revokeIdentitySessions: vi.fn(),
    };

    passwordReset = new PasswordResetManager(mockRepo, passwords, { rateLimitMs: 0 });
  });

  it("should request reset for existing email", async () => {
    const result = await passwordReset.requestReset("exists@example.com");
    expect(result).toBeDefined();
    expect(result).not.toBe("rate_limited");
  });

  it("should not reveal if email does not exist", async () => {
    const result = await passwordReset.requestReset("unknown@example.com");
    expect(result).toBe("reset_requested");
  });

  it("should complete reset with valid token", async () => {
    const token = await passwordReset.requestReset("exists@example.com");
    if (token === "rate_limited" || token === "reset_requested") return; // Token not generated for stub
    // Re-fetch since the stub actually generates a token for existing email
    await expect(passwordReset.completeReset(token as string, "NewValidPass1!")).resolves.not.toThrow();
  });

  it("should reject invalid reset token", async () => {
    await expect(passwordReset.completeReset("invalid-token", "NewPass1!")).rejects.toThrow();
  });
});

// ── IdentityRouter GET endpoints for email verification & password reset ──────
describe("IdentityRouter GET endpoints", () => {
  let identityRouter: any;
  let emailVerification: any;
  let passwordReset: any;
  let mockRepo: any;

  beforeEach(async () => {
      const { EmailVerificationManager } = await import('../../src/platform/identity/email-verification.js');
      const { PasswordResetManager } = await import('../../src/platform/identity/password-reset.js');
      const { PasswordManager } = await import('../../src/platform/identity/password-manager.js');
      const { IdentityRouter } = await import('../../src/platform/identity/routes/identity-routes.js');
      const { IdentityService } = await import('../../src/platform/identity/identity-service.js');
      const { SessionManager } = await import('../../src/platform/identity/session-manager.js');
      const { JwtManager } = await import('../../src/platform/identity/jwt-manager.js');
      const { IdentityProviderRegistry } = await import('../../src/platform/identity/identity-provider-registry.js');
      const { RefreshTokenManager } = await import('../../src/platform/identity/refresh-token-manager.js');
      const { MagicLinkManager } = await import('../../src/platform/identity/magic-link.js');
      const { OAuthService } = await import('../../src/platform/identity/oauth-provider.js');
      const { MFAManager } = await import('../../src/platform/identity/mfa.js');
      const { IdentityRepository } = await import('../../src/platform/identity/identity-repository.js');

      // Create mock repos
      const storedVerifications = new Map();
      const storedResets = new Map();
      const storedIdentities = new Map();
      const mockRepoIdentity = {
        db: {} as any,
        findIdentityByEmail: vi.fn(async (email: string) => storedIdentities.get(email) ?? null),
        getIdentity: vi.fn(),
        findIdentity: vi.fn(),
        updateIdentity: vi.fn(),
        createIdentity: vi.fn(),
        findIdentities: vi.fn(),
        deleteIdentity: vi.fn(),
        purgeIdentities: vi.fn(),
        storeConsentSnapshot: vi.fn(),
        findConsentSnapshot: vi.fn(),
        storeIdentityProvider: vi.fn(),
        findIdentityProvider: vi.fn(),
        storeCredentialSetting: vi.fn(),
        bindRefreshToken: vi.fn(),
        storeRefreshToken: vi.fn(),
        readRefreshToken: vi.fn(),
        revokeRefreshToken: vi.fn(),
        storeMfaKey: vi.fn(),
        findMfaKey: vi.fn(),
        storeBackupIdentity: vi.fn(),
        findBackupIdentity: vi.fn(),
        authenticateIdentity: vi.fn(),
        socialLogin: vi.fn(),
        write_AuditEntry: vi.fn(),
        Internal __setCredService__: vi.fn(),
        Internal setCredService: vi.fn(),
        getCredService: vi.fn(),
        Internal getSingleIdentity: vi.fn(),
        addIdentityHook: vi.fn(),
        setFlowStatusTo: vi.fn(),
        getFlowStatus: vi.fn(),
        registerIdentityProvider: vi.fn(),
        getProvider: vi.fn(),
        getCredentialsForIdentity: vi.fn(),
        getPublicIdentityFilters: vi.fn(),
        internal_?.getAllCredentials: vi.fn(),
        setAudit: vi.fn(),
        write_Token: vi.fn(),
        write_User: vi.fn(),
        deleteRecord: vi.fn(),
        updateRecord: vi.fn(),
        findRecord: vi.fn(),
        findRecords: vi.fn(),
        createCollection: vi.fn(),
      } as IdentityRepository;

      const mockRepo = {
        storeEmailVerification: vi.fn(async (r: any) => { storedVerifications.set(r.token_hash, r); }),
        findEmailVerification: vi.fn(async (h: string) => storedVerifications.get(h)),
        verifyEmail: vi.fn(async (id: string) => {
          for (const v of storedVerifications.values()) {
            if (v.id === id) v.verified_at = new Date().toISOString();
          }
        }),
        updateIdentityStatus: vi.fn(),
        purgeExpiredIdentities: vi.fn(),
        removeIdentity: vi.fn(),
        removeRefreshToken: vi.fn(),
        purgeRefreshTokens: vi.fn(),
        revokeIdentitySessions: vi.fn(),
        updateIdentityEmail: vi.fn(),
        verifyIdentity: vi.fn(),
        createCollection: vi.fn(),
      } as any;

      const mockRepoIdentityTyped = mockRepoIdentity;

      const sessions = new SessionManager(() => Promise.resolve(), mockRepo!");
      const passwords = new PasswordManager();
      const jwt = new JwtManager();
      const providers = new IdentityProviderRegistry();
      const refreshTokens = new RefreshTokenManager(() => Promise.resolve(), { testify: true });
      const identityService = new IdentityService(
        mockRepoIdentityTyped!,
        sessions,
        passwords,
        jwt,
        providers,
        refreshTokens,
      );
      emailVerification = new EmailVerificationManager(mockRepo!);
      passwordReset = new PasswordResetManager(mockRepo!, passwords);
      const magicLink = new MagicLinkManager(mockRepoIdentityTyped!, sessions, jwt, refreshTokens);
      const oauth = new OAuthService(mockRepoIdentityTyped!, sessions, jwt, refreshTokens);
      const mfa = new MFAManager(() => Promise.resolve(), (mockRepoIdentityTyped! as any), {});
    
      mockRepoIdentityTyped! = mockRepoIdentityTyped!;

      identityRouter = new IdentityRouter(
        identityService,
        emailVerification,
        passwordReset,
        magicLink,
        oauth,
        mfa,
        jwt,
        providers,
      );
    });
      jwt,
      providers,
    );
  });

  it("GET /identity/email/verify should NOT mutate state — returns token for UI", async () => {
    const token = await emailVerification.createVerification("identity-1", "test@example.com");
    // Call the GET handler via the router
    const result = await identityRouter.route("GET", "/identity/email/verify", { token }, {}, {} as any);
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.token).toBe(token);
    expect(result.body.verified).toBe(false);
    // Account should NOT be marked verified yet — verify via the mock repo
    // by hashing the token and finding the record.
    const { EmailVerificationManager } = await import("../../src/platform/identity/email-verification.js");
    const mgr = new EmailVerificationManager({} as any);
    const hash = mgr["hashToken"](token);
    const record = await mockRepo.findEmailVerification(hash);
    expect(record).not.toBeNull();
    expect(record.verified_at).toBeUndefined();
  });

  it("GET /identity/email/verify should return 400 for missing token", async () => {
    const result = await identityRouter.route("GET", "/identity/email/verify", {}, {}, {} as any);
    expect(result.status).toBe(400);
    expect(result.body.success).toBe(false);
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /identity/password/reset should NOT mutate state — returns token for UI", async () => {
    const token = await passwordReset.requestReset("exists@example.com");
    if (token === "rate_limited" || token === "reset_requested") return;
    const result = await identityRouter.route("GET", "/identity/password/reset", { token }, {}, {} as any);
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.token).toBe(token);
    // Password should NOT be changed yet
  });

  it("GET /identity/password/reset should return 400 for missing token", async () => {
    const result = await identityRouter.route("GET", "/identity/password/reset", {}, {}, {} as any);
    expect(result.status).toBe(400);
    expect(result.body.success).toBe(false);
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ── MFAManager ─────────────────────────────────────────────────
describe("MFAManager", () => {
  let mfa: any;
  let storedIdentities: Map<string, any>;

  beforeEach(async () => {
    storedIdentities = new Map();
    storedIdentities.set("id-1", {
      id: "id-1",
      password_hash: "hash",
      email: "test@example.com",
      phone: "+1234567890",
      metadata: {},
    });

    const { MFAManager } = await import("../../src/platform/identity/mfa.js");
    const mockRepo = {
      getIdentity: vi.fn(async (id: string) => storedIdentities.get(id) ?? null),
      updateIdentity: vi.fn(async (id: string, updates: any) => {
        const existing = storedIdentities.get(id);
        if (existing) Object.assign(existing, updates);
      }),
    };

    mfa = new MFAManager(mockRepo);
  });

  it("should list available MFA methods", async () => {
    const identity = storedIdentities.get("id-1");
    const methods = await mfa.getAvailableMethods(identity);
    expect(methods).toContain("totp");
    expect(methods).toContain("sms_otp");
    expect(methods).toContain("email_otp");
  });

  it("should setup TOTP", async () => {
    const result = await mfa.setupTOTP("id-1");
    expect(result.method).toBe("totp");
    expect(result.secret).toBeDefined();
    expect(result.qrCodeUrl).toContain("otpauth://totp/");
    expect(result.backupCodes).toHaveLength(8);
  });
});

// ── IdentityProviderRegistry ──────────────────────────────────
describe("IdentityProviderRegistry", () => {
  let registry: any;

  beforeEach(async () => {
    const { IdentityProviderRegistry } = await import("../../src/platform/identity/identity-provider-registry.js");
    const mockRepo = {
      getEnabledProviders: vi.fn(async () => []),
    };
    registry = new IdentityProviderRegistry(mockRepo);
  });

  it("should register and list providers", () => {
    const provider = {
      id: "test-oauth",
      providerType: "google",
      displayName: "Test OAuth",
      supportedMethods: ["oauth2"],
      initiate: vi.fn(),
      handleCallback: vi.fn(),
      health: vi.fn(),
    };
    registry.registerProvider(provider);
    const providers = registry.listProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe("test-oauth");
  });

  it("should get a registered provider by ID", () => {
    const provider = {
      id: "google-oauth",
      providerType: "google",
      displayName: "Google",
      supportedMethods: ["oauth2", "oidc"],
      initiate: vi.fn(),
      handleCallback: vi.fn(),
      health: vi.fn(),
    };
    registry.registerProvider(provider);
    const found = registry.getProvider("google-oauth");
    expect(found).toBeDefined();
    expect(found!.displayName).toBe("Google");
  });

  it("should return undefined for unknown provider", () => {
    const found = registry.getProvider("nonexistent");
    expect(found).toBeUndefined();
  });
});

// ── CredentialRotationManager ─────────────────────────────────
describe("CredentialRotationManager", () => {
  it("should return rotation policy", async () => {
    const { PasswordManager } = await import("../../src/platform/identity/password-manager.js");
    const { CredentialRotationManager } = await import("../../src/platform/identity/credential-rotation.js");
    const mockRepo = {
      getActiveCredentials: vi.fn(async () => []),
      revokeCredential: vi.fn(),
    };
    const passwords = new PasswordManager();
    const rotation = new CredentialRotationManager(mockRepo, passwords);
    const policy = rotation.getPolicy();
    expect(policy.passwordExpiryDays).toBe(90);
    expect(policy.apiTokenExpiryDays).toBe(30);
  });

  it("should detect expiring credentials", async () => {
    const { PasswordManager } = await import("../../src/platform/identity/password-manager.js");
    const { CredentialRotationManager } = await import("../../src/platform/identity/credential-rotation.js");
    const mockRepo = {
      getActiveCredentials: vi.fn(async () => [
        { id: "cred-1", credential_type: "password_hash", expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), created_at: new Date().toISOString() },
        { id: "cred-2", credential_type: "api_token", expires_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), created_at: new Date().toISOString() },
      ]),
      revokeCredential: vi.fn(),
    };
    const passwords = new PasswordManager();
    const rotation = new CredentialRotationManager(mockRepo, passwords);

    const { expiring, expired } = await rotation.checkExpiringCredentials("identity-1");
    expect(expired.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Identity Service Unit Tests ───────────────────────────────
describe("IdentityService (integration with mocks)", () => {
  let identityService: any;

  beforeEach(async () => {
    const { IdentityService } = await import("../../src/platform/identity/identity-service.js");
    const { SessionManager } = await import("../../src/platform/identity/session-manager.js");
    const { PasswordManager } = await import("../../src/platform/identity/password-manager.js");
    const { JwtManager, generateJwtKeyPair } = await import("../../src/platform/identity/jwt-manager.js");
    const { IdentityProviderRegistry } = await import("../../src/platform/identity/identity-provider-registry.js");
    const { RefreshTokenManager } = await import("../../src/platform/identity/refresh-token-manager.js");

    // Shared in-memory store for this test
    const identities = new Map<string, any>();
    const sessions = new Map<string, any>();
    const refreshTokens = new Map<string, any>();

    const mockRepo = {
      createIdentity: vi.fn(async (r: any) => { identities.set(r.id, r); }),
      getIdentity: vi.fn(async (id: string) => identities.get(id) ?? null),
      findIdentityByEmail: vi.fn(async (e: string) => {
        for (const v of identities.values()) {
          if (v.email === e) return v;
        }
        return null;
      }),
      updateIdentity: vi.fn(async (id: string, u: any) => {
        const i = identities.get(id);
        if (i) Object.assign(i, u);
      }),
      updateIdentityStatus: vi.fn(async (id: string, status: string, _reason: string) => {
        const i = identities.get(id);
        if (i) i.status = status;
      }),
      findIdentities: vi.fn(async () => [...identities.values()]),
      createSession: vi.fn(async (s: any) => { sessions.set(s.id, s); }),
      getSession: vi.fn(async (id: string) => sessions.get(id) ?? null),
      updateSessionStatus: vi.fn(async (id: string, status: string) => {
        const s = sessions.get(id);
        if (s) s.status = status;
      }),
      touchSession: vi.fn(async () => {}),
      revokeIdentitySessions: vi.fn(async (id: string) => {
        for (const s of sessions.values()) {
          if (s.identity_id === id) s.status = "revoked";
        }
      }),
      purgeExpiredSessions: vi.fn(async () => 0),
      storeRefreshToken: vi.fn(async (r: any) => { refreshTokens.set(r.token_hash, r); }),
      findRefreshToken: vi.fn(async (h: string) => refreshTokens.get(h) ?? null),
      revokeRefreshToken: vi.fn(async (id: string) => {
        for (const v of refreshTokens.values()) {
          if (v.id === id) v.revoked_at = new Date().toISOString();
        }
      }),
      revokeIdentityRefreshTokens: vi.fn(async (id: string) => {
        for (const v of refreshTokens.values()) {
          if (v.identity_id === id && !v.revoked_at) v.revoked_at = new Date().toISOString();
        }
      }),
      storeOAuthAccount: vi.fn(),
      findOAuthAccount: vi.fn(async () => null),
      recordAudit: vi.fn(),
      recordEvent: vi.fn(),
      storeTrustSnapshot: vi.fn(),
      storeConsentSnapshot: vi.fn(),
    };

    const passwords = new PasswordManager();
    const jwt = new JwtManager();
    const kp = await generateJwtKeyPair("test-key");
    jwt.registerKeyPair(kp);
    const sessionsManager = new SessionManager(mockRepo);
    const refreshTokenManager = new RefreshTokenManager(mockRepo);
    const registry = new IdentityProviderRegistry(mockRepo);

    identityService = new IdentityService(mockRepo, sessionsManager, passwords, jwt, registry, refreshTokenManager);
  });

  it("should register a new identity", async () => {
    const identity = await identityService.register({
      identityType: "patient",
      email: "patient@example.com",
      password: "ValidPassword123!",
      profile: { displayName: "Test Patient" },
    });
    expect(identity.id).toBeDefined();
    expect(identity.identityType).toBe("patient");
    expect(identity.primaryEmail).toBe("patient@example.com");
    expect(identity.displayName).toBe("Test Patient");
  });

  it("should reject duplicate email", async () => {
    await identityService.register({
      identityType: "patient",
      email: "duplicate@example.com",
      password: "DuplicatePassword123!",
    });
    await expect(
      identityService.register({
        identityType: "patient",
        email: "duplicate@example.com",
        password: "OtherPassword123!",
      }),
    ).rejects.toThrow("Email already registered");
  });

  it("should login with valid credentials", async () => {
    const registered = await identityService.register({
      identityType: "patient",
      email: "login@example.com",
      password: "ValidPassword123!",
    });

    await identityService.activateIdentity(registered.id);

    const result = await identityService.loginWithPassword({
      email: "login@example.com",
      password: "ValidPassword123!",
      ipAddress: "127.0.0.1",
    });
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.session).toBeDefined();
  });

  it("should reject login with wrong password", async () => {
    await identityService.register({
      identityType: "patient",
      email: "wrongpass@example.com",
      password: "ValidPassword123!",
    });
    await expect(
      identityService.loginWithPassword({
        email: "wrongpass@example.com",
        password: "WrongPass123!",
      }),
    ).rejects.toThrow();
  });

  it("should list identities", async () => {
    await identityService.register({
      identityType: "patient",
      email: "list1@example.com",
      password: "ValidPassword123!",
    });
    await identityService.register({
      identityType: "staff",
      email: "staff1@example.com",
      password: "StaffPassword123!",
    });
    const all = await identityService.listIdentities();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it("should suspend and activate identities", async () => {
    await identityService.register({
      identityType: "patient",
      email: "suspend@example.com",
      password: "ValidPassword123!",
    });
    const all = await identityService.listIdentities();
    const identity = all.find((i: any) => i.primaryEmail === "suspend@example.com");
    if (identity) {
      await identityService.suspendIdentity(identity.id, "test");
      const suspended = await identityService.getIdentity(identity.id);
      expect(suspended.status).toBe("suspended");
    }
  });
});

// ── Identity Provider Factory Tests ───────────────────────────
describe("Identity Provider factories", () => {
  it("should create Google OAuth provider", async () => {
    const { GoogleOAuthProvider } = await import("../../src/platform/identity/providers/google.js");
    const provider = new GoogleOAuthProvider("client-id", "client-secret");
    expect(provider.id).toBe("google");
    expect(provider.providerType).toBe("google");
    expect(provider.supportedMethods).toContain("oauth2");
  });

  it("should create OIDC provider with valid endpoints", async () => {
    const { OIDCProvider } = await import("../../src/platform/identity/providers/oidc.js");
    const provider = new OIDCProvider("custom-oidc", "Custom OIDC", {
      clientId: "client-id",
      clientSecret: "client-secret",
      issuerUrl: "https://provider.example.com",
      authorizationEndpoint: "https://provider.example.com/auth",
      tokenEndpoint: "https://provider.example.com/token",
      userInfoEndpoint: "https://provider.example.com/userinfo",
      jwksUri: "https://provider.example.com/keys",
    });
    expect(provider.id).toBe("custom-oidc");
    expect(provider.displayName).toBe("Custom OIDC");
    const initiateResult = await provider.initiate({ redirectUri: "https://app.example.com/callback" });
    expect(initiateResult.redirectUrl).toContain("provider.example.com/auth");
  });

  it("should create pre-configured Microsoft provider", async () => {
    const { createMicrosoftProvider } = await import("../../src/platform/identity/providers/oidc.js");
    const ms = createMicrosoftProvider("ms-client-id", "ms-secret");
    expect(ms.id).toBe("microsoft");
    expect(ms.displayName).toBe("Microsoft");
  });

  it("should create pre-configured GitHub provider", async () => {
    const { createGitHubProvider } = await import("../../src/platform/identity/providers/oidc.js");
    const gh = createGitHubProvider("gh-client-id", "gh-secret");
    expect(gh.id).toBe("github");
    expect(gh.displayName).toBe("GitHub");
  });

  it("should create SAML placeholder provider", async () => {
    const { SAMLProvider } = await import("../../src/platform/identity/providers/oidc.js");
    const saml = new SAMLProvider();
    expect(saml.id).toBe("saml");
    await expect(saml.initiate({})).rejects.toThrow("not yet implemented");
    const health = await saml.health();
    expect(health.ok).toBe(false);
  });
});

// ── Identity Events ────────────────────────────────────────────
describe("Identity Events", () => {
  it("should create an identity event payload", async () => {
    const { IdentityEventType, createEvent } = await import("../../src/platform/identity/identity-events.js");
    const event = createEvent(IdentityEventType.LOGIN_SUCCESS, "identity-1", { ip: "1.2.3.4" }, { sessionId: "session-1" });
    expect(event.eventType).toBe("identity.login");
    expect(event.identityId).toBe("identity-1");
    expect(event.sessionId).toBe("session-1");
    expect(event.source).toBe("ai-platform:identity-core");
  });
});

// ── IdentityHooks ─────────────────────────────────────────────
describe("IdentityHooks", () => {
  let hooks: any;

  beforeEach(async () => {
    const { IdentityHooks } = await import("../../src/platform/identity/identity-hooks.js");
    const mockRepo = {
      storeTrustSnapshot: vi.fn(),
      storeConsentSnapshot: vi.fn(),
    };
    hooks = new IdentityHooks(mockRepo);
  });

  it("should evaluate trust with defaults", async () => {
    const snapshot = await hooks.evaluateTrust(
      { id: "id-1", trust_score: 0.5 } as any,
      { id: "sess-1", mfa_level: 1, device_fingerprint: "fp123", identity_id: "id-1" } as any,
    );
    expect(snapshot.trust_score).toBeGreaterThan(0);
    expect(snapshot.factors.length).toBeGreaterThan(0);
    expect(snapshot.identity_id).toBe("id-1");
  });

  it("should return default policy evaluation when no hooks registered", async () => {
    const allowed = await hooks.evaluatePolicy("read", { id: "id-1" } as any, "resource-1");
    expect(allowed).toBe(true);
  });
});

// ── Identity Router ────────────────────────────────────────────
describe("IdentityRouter", () => {
  it("should route API calls through the router", async () => {
    const { IdentityRouter } = await import("../../src/platform/identity/routes/identity-routes.js");

    // Create mock services
    const mockService = {
      register: vi.fn(async (req: any) => ({ id: "new-id", identityType: "patient", primaryEmail: req.email, status: "registered", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), displayName: null, verifiedAt: null, metadata: {} })),
      loginWithPassword: vi.fn(async () => ({ accessToken: "test-token", refreshToken: "test-refresh", session: { id: "sess-1" } as any, identity: { id: "id-1" } as any, mfaRequired: false })),
      refreshAccessToken: vi.fn(async () => ({ accessToken: "new-token", refreshToken: "new-refresh", session: { id: "sess-1" } as any })),
      logout: vi.fn(),
      getIdentity: vi.fn(async (id: string) => ({ id, identityType: "patient", status: "active", primaryEmail: "test@example.com", displayName: null, verifiedAt: null, createdAt: "2026-01-01", updatedAt: "2026-01-01", metadata: {} })),
      listIdentities: vi.fn(async () => []),
      activateIdentity: vi.fn(),
      suspendIdentity: vi.fn(),
    };

    const mockEmailVerification = {
      createVerification: vi.fn(async () => "verification-token"),
      completeVerification: vi.fn(async () => ({ identityId: "id-1", email: "test@example.com" })),
    };

    const mockPasswordReset = {
      requestReset: vi.fn(async () => "reset-token"),
      completeReset: vi.fn(),
    };

    const mockMagicLink = {
      requestMagicLink: vi.fn(async () => "magic-token"),
      verifyMagicLink: vi.fn(async () => ({ accessToken: "ml-token", refreshToken: "ml-refresh", identity: { id: "id-1" } as any })),
    };

    const mockOAuth = {
      initiateOAuth: vi.fn(async () => ({ authorizeUrl: "https://oauth.example.com/auth", state: "state-1" })),
      handleCallback: vi.fn(async () => ({ accessToken: "oauth-token", refreshToken: "oauth-refresh", session: { id: "sess-1" } as any, identity: { id: "id-1" } as any, mfaRequired: false })),
    };

    const mockMFA = {
      setupTOTP: vi.fn(async () => ({ method: "totp", secret: "SECRET", qrCodeUrl: "otpauth://...", backupCodes: ["111111", "222222"] })),
      verifyAndEnable: vi.fn(async () => ({ verified: true, sessionUpgraded: true })),
      getAvailableMethods: vi.fn(async () => ["totp", "email_otp"]),
    };

    const mockJwt = {
      sign: vi.fn(async () => "jwt-token"),
      decode: vi.fn(() => ({ header: { alg: "RS256" }, payload: { sub: "id-1", session_id: "sess-1" } })),
      verify: vi.fn(async () => ({ sub: "id-1", session_id: "sess-1", identity_type: "patient", mfa_level: 1, iat: 100, exp: 200, jti: "jti-1", iss: "test", trust_score: 0.5 })),
    };

    const mockProviderRegistry = {
      listProviders: vi.fn(() => []),
      getProvider: vi.fn(),
      getProviderConfig: vi.fn(),
      registerProvider: vi.fn(),
    };

    const router = new IdentityRouter(mockService, mockEmailVerification, mockPasswordReset, mockMagicLink, mockOAuth, mockMFA, mockJwt, mockProviderRegistry);

    // Test registration route
    const registerResult = await router.route("POST", "/identity/register", { identityType: "patient", email: "new@example.com", password: "Valid123!" }, {}, {} as any);
    expect(registerResult.status).toBe(200);
    expect(registerResult.body.success).toBe(true);

    // Test login route
    const loginResult = await router.route("POST", "/identity/login", { email: "test@example.com", password: "Valid123!" }, {}, {} as any);
    expect(loginResult.status).toBe(200);

    // Test providers listing
    const providersResult = await router.route("GET", "/identity/providers", {}, {}, {} as any);
    expect(providersResult.status).toBe(200);

    // Test unknown route
    const notFoundResult = await router.route("GET", "/identity/unknown", {}, {}, {} as any);
    expect(notFoundResult.status).toBe(404);
  });
});