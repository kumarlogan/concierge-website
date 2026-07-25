// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Provider-neutral Process Spawner (EPIC-007)  │
// │                                                               │
// │ The single seam a real backend uses to invoke a vendor CLI     │
// │ (wrangler / gh / git). Provider-neutral: no vendor SDK, no     │
// │ node:* import. Production wires this to a real child_process    │
// │ spawner; tests inject a fake that records argv + returns a      │
// │ scripted result. This keeps every backend portable + testable. │
// └─────────────────────────────────────────────────────────────┘

export interface SpawnResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface SpawnOpts {
  env?: Record<string, string>;
  timeoutMs?: number;
  cwd?: string;
}

export interface Spawner {
  run(cmd: string, args: string[], opts?: SpawnOpts): Promise<SpawnResult>;
}

/** Map a SpawnResult to a platform ToolResult (fail-closed on non-zero). */
export function spawnResultToTool(
  res: SpawnResult,
  backend: string,
  okData?: unknown,
): { ok: boolean; error?: string; data?: unknown; backend: string } {
  if (res.code === 0) {
    return { ok: true, data: okData ?? res.stdout, backend };
  }
  return {
    ok: false,
    error: `${backend} exited ${res.code}: ${res.stderr || res.stdout}`.trim(),
    backend,
  };
}
