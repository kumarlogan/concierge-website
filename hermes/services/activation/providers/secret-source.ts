// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Secret Source Abstraction (EPIC-006 · P2)     │
// │                                                               │
// │ Operator-owned credentials are resolved at deploy time through  │
// │ THIS abstraction. The platform NEVER hardcodes a secret, and   │
// │ provider code never reads process.env directly — it asks the   │
// │ injected SecretSource. A deploy supplies one implementation     │
// │ (env vars, a vault, a platform secret store); the default is    │
// │ "env" which reads ONLY at resolution time, never at import.    │
// │                                                               │
// │ If a required secret is absent, the provider is reported        │
// │ NOT_INSTALLED and its capabilities are refused fail-closed —    │
// │ never fabricated.                                              │
// └─────────────────────────────────────────────────────────────┘

export interface SecretSource {
  /** Resolve a named secret reference (e.g. "github.token"). Empty = missing. */
  get(ref: string): string | undefined;
}

/** Default source: environment variables. No caching of values. */
export class EnvSecretSource implements SecretSource {
  constructor(private readonly env: Record<string, string | undefined> = process.env) {}
  get(ref: string): string | undefined {
    const v = this.env[ref];
    return v && v.length > 0 ? v : undefined;
  }
}

/**
 * Pluggable source for operators who wire a vault/store. Set once at platform
 * init; if unset, the platform falls back to EnvSecretSource.
 */
let activeSource: SecretSource | undefined;

export function setSecretSource(src: SecretSource): void {
  activeSource = src;
}

export function getSecretSource(): SecretSource {
  return activeSource ?? new EnvSecretSource();
}

/** Resolve a secret, returning undefined (not "") when absent. */
export function resolveSecret(ref: string): string | undefined {
  return getSecretSource().get(ref);
}
