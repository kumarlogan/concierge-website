// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — GitHub Provider Config (EPIC-006 · P2)         │
// │                                                               │
// │ Reads GitHub connection config from the injected SecretSource  │
// │ (operator-owned). No secrets in source. If required config is   │
// │ missing, `validateGitHubConfig` returns a failure describing    │
// │ exactly what's absent so the bootstrap can mark the provider    │
// │ NOT_INSTALLED (fail-closed, never fabricated).                  │
// │                                                               │
// │ This module performs NO execution and NO network I/O. It owns   │
// │ configuration resolution + validation only.                     │
// └─────────────────────────────────────────────────────────────┘

import { resolveSecret } from "../secret-source.js";

export interface GitHubConfig {
  token: string;
  repository: string;
}

export interface ConfigValidation<T> {
  ok: boolean;
  config?: T;
  /** Human-readable reasons the provider is NOT_INSTALLED (multi-line). */
  missing: string[];
}

const GITHUB_TOKEN_REF = "GITHUB_TOKEN";
const GITHUB_REPO_REF = "AGS_GITHUB_REPOSITORY";

/** Resolve + validate GitHub config from the secret source. */
export function validateGitHubConfig(): ConfigValidation<GitHubConfig> {
  const missing: string[] = [];
  const token = resolveSecret(GITHUB_TOKEN_REF);
  const repository = resolveSecret(GITHUB_REPO_REF);
  if (!token) missing.push(`missing secret "${GITHUB_TOKEN_REF}"`);
  if (!repository) missing.push(`missing config "${GITHUB_REPO_REF}"`);
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, config: { token: token!, repository: repository! }, missing: [] };
}
