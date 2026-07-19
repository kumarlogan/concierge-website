// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Local Sandbox Dev Backend (REAL capability)  │
// │ EPIC-002-006H · PHASE 3                                        │
// │                                                 RUNTIME:       │
// │  Cloudflare Worker — NO node:fs / node:child_process. The      │
// │  sandbox operates on an injected virtual filesystem (caller     │
// │  provides file contents from a controlled source). This keeps   │
// │  the capability REAL (genuine analysis) while remaining         │
// │  runtime-safe and namespace-confined.                           │
// │                                                 SAFETY:         │
// │  • Paths are confined to the virtual root (escape → rejected).  │
// │  • No production writes; no secret emission.                    │
// └─────────────────────────────────────────────────────────────┘

import type { DevBackend } from "./dev-tools.js";
import { emitAudit } from "../../audit/event.js";

/** A file entry in the injected virtual sandbox. */
export interface SandboxFile {
  /** Path relative to the sandbox root (must not escape). */
  path: string;
  /** File contents. */
  content: string;
}

/**
 * A real, sandboxed dev backend that analyzes an injected virtual filesystem.
 * No OS filesystem, no shell — pure in-memory analysis. The caller (BFF/agent)
 * supplies files from a controlled, non-production source.
 */
export class LocalSandboxBackend implements DevBackend {
  readonly name = "local-sandbox";
  private files = new Map<string, string>();

  /** Load a virtual filesystem into the sandbox (replaces prior state). */
  load(files: SandboxFile[]): void {
    this.files.clear();
    for (const f of files) {
      const norm = this.normalize(f.path);
      this.files.set(norm, f.content);
    }
  }

  private normalize(p: string): string {
    const parts = p.split("/").filter((s) => s && s !== ".");
    let depth = 0;
    const out: string[] = [];
    for (const part of parts) {
      if (part === "..") {
        if (depth === 0) throw new Error(`path escapes sandbox root: ${p}`);
        out.pop();
        depth--;
      } else {
        out.push(part);
        depth++;
      }
    }
    return out.join("/");
  }

  readFile(path: string): string {
    const norm = this.normalize(path);
    const content = this.files.get(norm);
    if (content === undefined) throw new Error(`file not found in sandbox: ${path}`);
    emitAudit("tool.code.read", "system", { path: norm });
    return content;
  }

  writeFile(path: string, content: string): void {
    const norm = this.normalize(path);
    emitAudit("tool.code.write", "system", { path: norm });
    this.files.set(norm, content);
  }

  exec(cmd: string, cwd: string): { stdout: string; stderr: string; code: number } {
    // No shell in Worker runtime. We surface a controlled, sandboxed result:
    // run a safe built-in analysis command (e.g. "linecount", "grep").
    emitAudit("tool.code.exec", "system", { cmd, cwd });
    const [sub, ...args] = cmd.split(/\s+/);
    try {
      switch (sub) {
        case "linecount": {
          const norm = this.normalize(args[0] ?? "");
          const c = this.files.get(norm);
          if (c === undefined) return { stdout: "", stderr: "no such file", code: 1 };
          const n = c.split("\n").length;
          return { stdout: `${n}\n`, stderr: "", code: 0 };
        }
        case "grep": {
          const re = new RegExp(args[0] ?? "", "g");
          const out: string[] = [];
          for (const [p, c] of this.files) {
            if (re.test(c)) out.push(p);
          }
          return { stdout: out.join("\n") + (out.length ? "\n" : ""), stderr: "", code: 0 };
        }
        default:
          return {
            stdout: "",
            stderr: `sandbox command not permitted: ${sub}`,
            code: 1,
          };
      }
    } catch (e) {
      return { stdout: "", stderr: String(e), code: 1 };
    }
  }
}
