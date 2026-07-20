// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Security Automation — Local Tool Detection (M8)       │
// │ EPIC-003-004                                                │
// │ Local-first execution support. Detects whether a security   │
// │ tool binary is available, its version, and whether execution │
// │ is supported — WITHOUT requiring the tool to be installed.   │
// │                                                            │
// │ Future cloud/container execution MUST plug into the same    │
// │ { isAvailable, version, executable } interface so providers │
// │ stay backend-neutral. This module only inspects the local   │
// │ environment; it never calls a provider directly.            │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../../audit/event.js";

/** Result of probing a local tool binary. */
export interface LocalToolStatus {
  /** Tool key (e.g. "gitleaks"). */
  tool: string;
  /** Absolute or resolved command name (e.g. "gitleaks"). */
  command: string;
  /** Whether the binary is resolvable on PATH. */
  available: boolean;
  /** Semantic version string if the binary reported one, else undefined. */
  version?: string;
  /** Whether Hermes can dispatch executions through this tool. */
  executable: boolean;
  /** Human-readable detail (error / detection note). */
  detail: string;
  /** When the probe ran. */
  checkedAt: string;
}

/**
 * Resolve a binary from PATH and read its version via `--version` / `version`.
 * Never throws: missing binaries return available:false (fail closed, not fail
 * loud). Reads are side-effect free and constrained to read-only version probes.
 */
export async function detectLocalTool(
  tool: string,
  command: string = tool,
  versionArg: string = "--version",
): Promise<LocalToolStatus> {
  const checkedAt = new Date().toISOString();
  // Use `command -v` (POSIX) to test presence without executing the tool.
  const whichRes = await runShell(`command -v ${shellQuote(command)}`);
  if (!whichRes.ok || !whichRes.stdout.trim()) {
    emitAudit("sec.tool.not_installed", "system", { tool, command });
    return {
      tool,
      command,
      available: false,
      executable: false,
      detail: `Binary not found on PATH: ${command}`,
      checkedAt,
    };
  }

  // Probe version (read-only). Tolerate failures — version is best-effort.
  let version: string | undefined;
  const verRes = await runShell(`${shellQuote(command)} ${versionArg}`);
  if (verRes.ok) {
    version = extractVersion(verRes.stdout);
  }

  emitAudit("sec.tool.detected", "system", { tool, command, version: version ?? null });
  return {
    tool,
    command,
    available: true,
    version,
    executable: true,
    detail: version ? `Detected ${tool} ${version}` : `Detected ${tool} (version unknown)`,
    checkedAt,
  };
}

/** Map a LocalToolStatus to the platform ProviderHealth vocabulary. */
export function localStatusToHealth(s: LocalToolStatus): "not_installed" | "healthy" | "unknown" {
  if (!s.available || !s.executable) return "not_installed";
  return "healthy";
}

// ── internal helpers ───────────────────────────────────────────

interface ShellOut {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

function runShell(cmd: string): Promise<ShellOut> {
  // Local-first detection. In a Node runtime we probe PATH via `command -v`.
  // In a Worker/edge runtime `child_process` is unavailable — degrade
  // gracefully (fail closed toward "not installed") instead of throwing.
  // We resolve the Node builtin at runtime via `require` (declared loosely so
  // the module type-checks without @types/node being installed) and treat any
  // failure to load or execute as "not present".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeRequire = (globalThis as any).require as ((id: string) => any) | undefined;
  let cp: any;
  try {
    cp = nodeRequire ? nodeRequire("node:child_process") : undefined;
  } catch {
    cp = undefined;
  }
  if (!cp || typeof cp.exec !== "function") {
    return Promise.resolve({ ok: false, stdout: "", stderr: "no-child_process", code: 127 });
  }
  return new Promise<ShellOut>((resolve) => {
    try {
      cp.exec(cmd, { timeout: 4000 }, (err: any, stdout: any, stderr: any) => {
        if (err) {
          // Non-zero exit (command not found, etc.) => treat as not present.
          resolve({ ok: false, stdout: String(stdout ?? ""), stderr: String(stderr ?? ""), code: err?.code ?? 1 });
          return;
        }
        resolve({ ok: true, stdout: String(stdout ?? ""), stderr: String(stderr ?? ""), code: 0 });
      });
    } catch {
      // Runtime does not implement exec (e.g. Miniflare Worker sandbox).
      resolve({ ok: false, stdout: "", stderr: "exec-not-implemented", code: 127 });
    }
  });
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function extractVersion(text: string): string | undefined {
  // Match semver-ish: v1.2.3, 1.2.3, 2024.01
  const m = text.match(/(\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?)/);
  return m ? m[1] : undefined;
}
