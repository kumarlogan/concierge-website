// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core JWT Manager                      │
// │ Reusable JWT signing, verification, and key isolation.      │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

/**
 * JWT payload for AI Platform identity tokens.
 * Contains identity claims but NEVER PHI.
 */
export interface JwtPayload {
  sub: string;                    // identity_id
  identity_type: string;
  session_id?: string;
  email?: string;
  mfa_level: number;
  trust_score?: number;
  iat: number;
  exp: number;
  jti: string;                    // unique token id (replay protection)
  iss: string;                    // issuer
  aud?: string;                   // audience (product/service)
}

/**
 * JWT signing key pair (isolated from PHI encryption keys).
 */
export interface JwtKeyPair {
  publicKey: string;   // PEM-encoded
  privateKey: string;  // PEM-encoded
  kid: string;         // Key ID (for rotation)
  algorithm: string;   // "RS256" | "ES256"
}

const DEFAULT_ALGORITHM = "RS256";
const DEFAULT_ISSUER = "ai-platform:identity-core";
const DEFAULT_EXPIRY_SECONDS = 3600; // 1 hour

/**
 * Manager for JWT signing, verification, and key isolation.
 * Keys are supplied via config — NEVER stored with PHI data.
 */
export class JwtManager {
  private readonly keyPairs: Map<string, JwtKeyPair> = new Map();
  private activeKid: string | null = null;
  private readonly algorithm: string;
  private readonly issuer: string;

  constructor(
    opts: {
      algorithm?: string;
      issuer?: string;
    } = {},
  ) {
    this.algorithm = opts.algorithm ?? DEFAULT_ALGORITHM;
    this.issuer = opts.issuer ?? DEFAULT_ISSUER;
  }

  /**
   * Register a signing key pair. The first registered key becomes active.
   * Supports key rotation: add new key, tokens signed with old kid remain
   * valid until expiry.
   */
  registerKeyPair(kp: JwtKeyPair): void {
    this.keyPairs.set(kp.kid, kp);
    if (!this.activeKid) {
      this.activeKid = kp.kid;
    }
  }

  /**
   * Rotate to a new signing key. Old keys remain for verification.
   */
  activateKey(kid: string): boolean {
    if (!this.keyPairs.has(kid)) return false;
    this.activeKid = kid;
    return true;
  }

  /**
   * Sign a JWT payload. Returns the compact serialized JWT.
   * In Worker runtime, uses Web Crypto API (SubtleCrypto).
   */
  async sign(payload: Omit<JwtPayload, "iat" | "exp" | "jti" | "iss">, opts: {
    expirySeconds?: number;
    audience?: string;
    kid?: string;
  } = {}): Promise<string> {
    const kid = opts.kid ?? this.activeKid;
    if (!kid) throw new Error("No active signing key registered");
    const kp = this.keyPairs.get(kid);
    if (!kp) throw new Error(`Signing key "${kid}" not found`);

    const now = Math.floor(Date.now() / 1000);
    const exp = now + (opts.expirySeconds ?? DEFAULT_EXPIRY_SECONDS);

    const jwtPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp,
      jti: crypto.randomUUID(),
      iss: this.issuer,
      aud: opts.audience,
    };

    return this.encodeJwt(jwtPayload, kp);
  }

  /**
   * Verify and decode a JWT. Returns the payload if valid, throws on
   * invalid signature, expiry, or other errors.
   */
  async verify(token: string, opts: {
    audience?: string;
    leeway?: number;
  } = {}): Promise<JwtPayload> {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT format");

    // Decode header to find kid
    let header: { alg?: string; kid?: string };
    try {
      header = JSON.parse(this.base64urlDecode(parts[0]));
    } catch {
      throw new Error("Invalid JWT header");
    }

    const kid = header.kid;
    if (!kid || !this.keyPairs.has(kid)) {
      throw new Error(`Unknown signing key: ${kid}`);
    }

    const kp = this.keyPairs.get(kid)!;

    // Verify signature using Web Crypto
    const valid = await this.verifySignature(token, kp);
    if (!valid) throw new Error("Invalid JWT signature");

    // Decode payload
    let payload: JwtPayload;
    try {
      payload = JSON.parse(this.base64urlDecode(parts[1])) as JwtPayload;
    } catch {
      throw new Error("Invalid JWT payload");
    }

    // Verify expiry (with leeway)
    const leeway = opts.leeway ?? 30;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp + leeway < now) throw new Error("JWT expired");
    if (payload.iat - leeway > now) throw new Error("JWT not yet valid");

    // Verify issuer
    if (payload.iss !== this.issuer) throw new Error("Invalid JWT issuer");

    // Verify audience if requested
    if (opts.audience && payload.aud !== opts.audience) {
      throw new Error("Invalid JWT audience");
    }

    return payload;
  }

  /**
   * Decode a JWT without verifying (for extracting header info only).
   */
  decode(token: string): { header: Record<string, unknown>; payload: JwtPayload } {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT format");
    try {
      const header = JSON.parse(this.base64urlDecode(parts[0]));
      const payload = JSON.parse(this.base64urlDecode(parts[1]));
      return { header, payload };
    } catch {
      throw new Error("Invalid JWT format");
    }
  }

  // ── Private helpers ──────────────────────────────────────

  private async encodeJwt(payload: JwtPayload, kp: JwtKeyPair): Promise<string> {
    const header = { alg: kp.algorithm, kid: kp.kid, typ: "JWT" };
    const headerB64 = this.base64urlEncode(JSON.stringify(header));
    const payloadB64 = this.base64urlEncode(JSON.stringify(payload));
    const signingInput = `${headerB64}.${payloadB64}`;

    // signWithKey already returns base64url-encoded signature
    const sigB64 = await this.signWithKey(signingInput, kp);

    return `${signingInput}.${sigB64}`;
  }

  private async signWithKey(data: string, kp: JwtKeyPair): Promise<string> {
    // For Workers runtime: uses SubtleCrypto
    const encoder = new TextEncoder();
    const keyData = encoder.encode(data);

    const algorithm = kp.algorithm === "ES256"
      ? { name: "ECDSA", hash: "SHA-256", namedCurve: "P-256" }
      : { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };

    // Import the private key
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      this.pemToArrayBuffer(kp.privateKey),
      algorithm,
      false,
      ["sign"],
    );

    const signatureBytes = await crypto.subtle.sign(algorithm, privateKey, keyData);
    // Return base64url-encoded signature directly
    return this.base64urlEncode(String.fromCharCode(...new Uint8Array(signatureBytes)));
  }

  private async verifySignature(token: string, kp: JwtKeyPair): Promise<boolean> {
    const parts = token.split(".");
    const signingInput = `${parts[0]}.${parts[1]}`;
    const signature = this.base64urlDecodeToBytes(parts[2]);

    const encoder = new TextEncoder();
    const data = encoder.encode(signingInput);

    const algorithm = kp.algorithm === "ES256"
      ? { name: "ECDSA", hash: "SHA-256", namedCurve: "P-256" }
      : { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };

    const publicKey = await crypto.subtle.importKey(
      "spki",
      this.pemToArrayBuffer(kp.publicKey),
      algorithm,
      false,
      ["verify"],
    );

    return crypto.subtle.verify(algorithm, publicKey, signature, data);
  }

  private pemToArrayBuffer(pem: string): ArrayBuffer {
    const b64 = pem
      .replace(/-----BEGIN [A-Z ]+-----/g, "")
      .replace(/-----END [A-Z ]+-----/g, "")
      .replace(/\s+/g, "");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return bytes.buffer;
  }

  private base64urlEncode(data: string): string {
    return btoa(data)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  private base64urlDecode(data: string): string {
    data = data.replace(/-/g, "+").replace(/_/g, "/");
    while (data.length % 4) data += "=";
    return atob(data);
  }

  private base64urlDecodeToBytes(data: string): ArrayBuffer {
    const str = this.base64urlDecode(data);
    return Uint8Array.from(str, (c) => c.charCodeAt(0)).buffer;
  }
}

/**
 * Generate a new RSA key pair for JWT signing.
 * Returns PEM-encoded keys.
 */
export async function generateJwtKeyPair(
  kid?: string,
): Promise<JwtKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );

  const publicKeyPem = await exportPublicKeyToPem(keyPair.publicKey);
  const privateKeyPem = await exportPrivateKeyToPem(keyPair.privateKey);

  return {
    kid: kid ?? crypto.randomUUID(),
    publicKey: publicKeyPem,
    privateKey: privateKeyPem,
    algorithm: DEFAULT_ALGORITHM,
  };
}

async function exportPublicKeyToPem(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("spki", key);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  return `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g)?.join("\n") ?? b64}\n-----END PUBLIC KEY-----`;
}

async function exportPrivateKeyToPem(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("pkcs8", key);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  const pemLines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN PRIVATE KEY-----\n${pemLines}\n-----END PRIVATE KEY-----`;
  }