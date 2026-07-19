// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Local Security Backend (REAL capability)     │
// │ EPIC-002-006H · PHASE 3                                        │
// │                                                 RUNTIME:       │
// │  Cloudflare Worker — pure in-memory analysis over provided      │
// │  file contents. No node:fs, no network egress.                  │
// │                                                 CAPABILITIES:  │
// │  • secret scan — regex sweep for secret patterns. Findings      │
// │    never include the matched value (redacted fingerprint).      │
// │  • dependency scan — parse provided manifests for known-vuln    │
// │    package names (offline heuristic).                           │
// │                                                 SAFETY:         │
// │  • Read-only, no writes, no prod access, no secret emission.     │
// └─────────────────────────────────────────────────────────────┘

import type { SecurityBackend, SecurityFinding } from "./security-tools.js";
import { emitAudit } from "../../audit/event.js";
import type { SandboxFile } from "./local-sandbox-backend.js";

// Known secret patterns. Conservative; we never emit the matched value.
const SECRET_PATTERNS: { id: string; re: RegExp }[] = [
  { id: "aws-key", re: /AKIA[0-9A-Z]{16}/g },
  { id: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { id: "github-token", re: /gh[po]_[A-Za-z0-9]{36,}/g },
  { id: "jwt", re: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { id: "generic-secret", re: /(secret|api[_-]?key|token|password)\s*[:=]\s*['"][^'"]{8,}/gi },
];

// High-risk dependency names with known historical CVEs (offline heuristic).
const VULN_PACKAGES = new Set([
  "lodash",
  "minimist",
  "axios",
  "moment",
  "node-fetch",
  "tar",
  "semver",
  "jsonwebtoken",
]);

const SCANNABLE = /\.(ts|js|json|env|yml|yaml|toml|txt|md)$/;

/**
 * Real, Worker-runtime-safe security scanner. Operates on an injected file
 * set (caller provides from a controlled, non-production source).
 */
export class LocalSecurityBackend implements SecurityBackend {
  readonly name = "local-scanner";

  /** Build a backend bound to a set of files (e.g. a repo snapshot). */
  constructor(private readonly files: SandboxFile[] = []) {}

  scan(_target: string, kind: "sast" | "dast" | "secret"): SecurityFinding[] {
    emitAudit("tool.security.scan", "system", { target: _target, kind });
    if (kind === "secret") return this.scanSecrets();
    if (kind === "sast") return this.scanDeps();
    return []; // dast requires a live target — out of scope for local scan
  }

  private scanSecrets(): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    for (const file of this.files) {
      if (!SCANNABLE.test(file.path)) continue;
      const lines = file.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        for (const { id, re } of SECRET_PATTERNS) {
          re.lastIndex = 0;
          if (re.test(lines[i])) {
            findings.push({
              id: `${id}:${file.path}:${i + 1}`,
              severity: "high",
              title: `Potential ${id} secret`,
              location: `${file.path}:${i + 1}`,
              cwe: "CWE-798",
            });
          }
        }
      }
    }
    return findings;
  }

  private scanDeps(): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    for (const file of this.files) {
      if (!/package\.json$/.test(file.path)) continue;
      try {
        const pkg = JSON.parse(file.content) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        for (const name of Object.keys(deps)) {
          if (VULN_PACKAGES.has(name)) {
            findings.push({
              id: `dep:${name}`,
              severity: "medium",
              title: `Known-vulnerable dependency: ${name}`,
              location: file.path,
              cwe: "CWE-1104",
            });
          }
        }
      } catch {
        continue;
      }
    }
    return findings;
  }
}
