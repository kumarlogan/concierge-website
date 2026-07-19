// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Real Tool Provider Registration             │
// │ EPIC-002-006H · PHASE 3                                        │
// │ Registers the functional (sandboxed) tool providers ALONGSIDE  │
// │ the safe noop defaults. Both coexist; the BFF/agent selects the │
// │ real backend only when a controlled sandbox source is supplied. │
// │ The noop remains the fail-closed default.                       │
// └─────────────────────────────────────────────────────────────┘

import {
  DevToolsProvider,
  type DevBackend,
} from "./dev-tools.js";
import {
  SecurityToolsProvider,
  type SecurityBackend,
} from "./security-tools.js";
import { registerToolProvider } from "./tool-provider.js";
import { LocalSandboxBackend, type SandboxFile } from "./local-sandbox-backend.js";
import { LocalSecurityBackend } from "./local-security-backend.js";
import { emitAudit } from "../../audit/event.js";

/**
 * A DevToolsProvider backed by the real sandboxed backend. Its id is distinct
 * from the noop default so both can be registered. The sandbox is loaded from
 * a controlled, non-production file set before any call.
 */
export class RealDevToolsProvider extends DevToolsProvider {
  readonly id = "tool:code.local-sandbox";
  readonly label = "Dev Tools (real sandbox)";
  private sandbox = new LocalSandboxBackend();

  /** Load the virtual filesystem the sandbox will operate on. */
  loadSandbox(files: SandboxFile[]): void {
    this.sandbox.load(files);
    emitAudit("tool.code.sandbox.loaded", "system", { count: files.length });
  }

  constructor() {
    super(undefined as unknown as DevBackend); // backend swapped below
    // Override the private backend via the load method.
    (this as unknown as { backend: DevBackend }).backend = this.sandbox;
  }
}

/**
 * A SecurityToolsProvider backed by the real local scanner. Its id is distinct
 * from the noop default.
 */
export class RealSecurityToolsProvider extends SecurityToolsProvider {
  readonly id = "tool:security.local-scanner";
  readonly label = "Security Tools (real scanner)";
  private scanner = new LocalSecurityBackend();

  /** Bind the file set the scanner analyzes. */
  loadFiles(files: SandboxFile[]): void {
    this.scanner = new LocalSecurityBackend(files);
    emitAudit("tool.security.files.loaded", "system", { count: files.length });
  }

  constructor() {
    super(undefined as unknown as SecurityBackend);
    (this as unknown as { backend: SecurityBackend }).backend = this.scanner;
  }
}

// Register the real providers. The noop defaults (registered in
// dev-tools.ts / security-tools.ts) remain; resolution prefers the real
// backend when explicitly requested by id.
registerToolProvider(new RealDevToolsProvider());
registerToolProvider(new RealSecurityToolsProvider());
