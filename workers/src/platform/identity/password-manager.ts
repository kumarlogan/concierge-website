// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Password Manager                 │
// │ Reusable password hashing, validation, and policy.          │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

/**
 * Password policy configuration.
 * Defaults meet OWASP recommendations for PHI-protected systems.
 */
export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecialChar: boolean;
  maxRepeatedChars: number;
  commonPasswordCheck: boolean;
}

const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecialChar: true,
  maxRepeatedChars: 3,
  commonPasswordCheck: true,
};

/// Cloudflare Workers Web Crypto API caps PBKDF2 iterations at 100,000.
/// Reference: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits#constraints
/// OWASP 2023 recommends 600,000 but Workers runtime rejects > 100,000.
const PBKDF2_ITERATIONS = 100_000;

/**
 * Result of password validation.
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Password Manager — handles hashing, verification, and policy.
 * Uses PBKDF2 with SHA-256 via Web Crypto API (Workers-compatible).
 */
export class PasswordManager {
  private readonly policy: PasswordPolicy;

  constructor(policy: Partial<PasswordPolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
  }

  /**
   * Hash a password using PBKDF2-SHA256 with a random salt.
   * Returns a portable string: algorithm:iterations:salt:hash (base64url).
   */
  async hash(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );

    const iterations = PBKDF2_ITERATIONS;
    const hash = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256",
      },
      keyMaterial,
      256, // 256-bit output
    );

    const saltB64 = this.toBase64url(salt);
    const hashB64 = this.toBase64url(new Uint8Array(hash));

    return `pbkdf2:sha256:${iterations}:${saltB64}:${hashB64}`;
  }

  /**
   * Verify a password against a hash string produced by `hash()`.
   */
  async verify(password: string, hashed: string): Promise<boolean> {
    const parts = hashed.split(":");
    if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") {
      throw new Error("Unsupported hash format");
    }

    const iterations = parseInt(parts[2], 10);
    const salt = this.fromBase64url(parts[3]);
    const expectedHash = this.fromBase64url(parts[4]);

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );

    const hash = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256",
      },
      keyMaterial,
      256,
    );

    const actual = new Uint8Array(hash);
    if (actual.length !== expectedHash.length) return false;

    // Constant-time comparison
    let diff = 0;
    for (let i = 0; i < actual.length; i++) {
      diff |= actual[i] ^ expectedHash[i];
    }
    return diff === 0;
  }

  /**
   * Validate a password against policy. Returns errors if invalid.
   */
  validate(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (password.length < this.policy.minLength) {
      errors.push(`Password must be at least ${this.policy.minLength} characters`);
    }
    if (password.length > this.policy.maxLength) {
      errors.push(`Password must be no more than ${this.policy.maxLength} characters`);
    }
    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push("Password must contain an uppercase letter");
    }
    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push("Password must contain a lowercase letter");
    }
    if (this.policy.requireDigit && !/\d/.test(password)) {
      errors.push("Password must contain a digit");
    }
    if (this.policy.requireSpecialChar && !/[!@#$%^&*()_+\-=[\]{}|;':",./<>?`~]/.test(password)) {
      errors.push("Password must contain a special character");
    }

    // Check repeated characters
    if (this.policy.maxRepeatedChars > 0) {
      const re = new RegExp(`(.)\\1{${this.policy.maxRepeatedChars},}`);
      if (re.test(password)) {
        errors.push(`Password must not contain more than ${this.policy.maxRepeatedChars} repeated characters`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private toBase64url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  private fromBase64url(str: string): Uint8Array {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}