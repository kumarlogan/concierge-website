// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Cloudflare Provider Config (EPIC-006 · P2)     │
// │                                                               │
// │ Reads Cloudflare connection config from the injected SecretSource│
// │ (operator-owned). No secrets in source. If required config is    │
// │ missing, `validateCloudflareConfig` reports exactly what's absent│
// │ so bootstrap can mark the provider NOT_INSTALLED (fail-closed,   │
// │ never fabricated).                                              │
// │                                                               │
// │ No execution, no network I/O. Configuration resolution +        │
// │ validation only.                                                │
// └─────────────────────────────────────────────────────────────┘

import { resolveSecret } from "../secret-source.js";

export interface CloudflareConfig {
  token: string;
  account: string;
  project: string;
}

export interface ConfigValidation<T> {
  ok: boolean;
  config?: T;
  missing: string[];
}

const CF_TOKEN_REF = "CLOUDFLARE_API_TOKEN";
const CF_ACCOUNT_REF = "AGS_CLOUDFLARE_ACCOUNT";
const CF_PROJECT_REF = "AGS_CLOUDFLARE_PROJECT";

/** Resolve + validate Cloudflare config from the secret source. */
export function validateCloudflareConfig(): ConfigValidation<CloudflareConfig> {
  const missing: string[] = [];
  const token = resolveSecret(CF_TOKEN_REF);
  const account = resolveSecret(CF_ACCOUNT_REF);
  const project = resolveSecret(CF_PROJECT_REF);
  if (!token) missing.push(`missing secret "${CF_TOKEN_REF}"`);
  if (!account) missing.push(`missing config "${CF_ACCOUNT_REF}"`);
  if (!project) missing.push(`missing config "${CF_PROJECT_REF}"`);
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, config: { token: token!, account: account!, project: project! }, missing: [] };
}
