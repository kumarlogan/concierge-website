// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Activation API                              │
// │ REST endpoint to activate the EPCL→WAS→WEF execution pipeline │
// │ via HTTP. This makes the certified architecture reachable.    │
// │ Wave 9 — Concierge Launch & Platform Activation               │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: This endpoint stores NO PHI. It accepts a roadmap
// reference and returns execution metadata — never patient data.

import type { Env } from "../types/env.js";
import type { Router } from "../router/index.js";
import { ExecutivePlanningWorkflow } from "../platform/epcl/executive-workflow.js";
import type { WorkflowResult } from "../platform/epcl/executive-workflow.js";

// ── Types ──────────────────────────────────────────

interface ActivateRequest {
  roadmapId?: string;
  roadmap?: string;
  source?: string;
  config?: Record<string, unknown>;
}

interface ActivateResponse {
  ok: boolean;
  planId?: string;
  analysis?: Record<string, unknown>;
  stages?: Array<{ stage: string; ok: boolean; output: unknown }>;
  error?: string;
}

// ── Singleton workflow instance ────────────────────

let _workflow: ExecutivePlanningWorkflow | null = null;
function getWorkflow(): ExecutivePlanningWorkflow {
  if (!_workflow) {
    _workflow = ExecutivePlanningWorkflow.getInstance();
  }
  return _workflow;
}

// ── Route handler ──────────────────────────────────

export async function activateEPCL(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as ActivateRequest;

  const roadmapInput = body.roadmap ?? body.roadmapId ?? "";
  const source = body.source ?? "http";

  if (!roadmapInput) {
    return jsonResponse(
      { error: "roadmap or roadmapId is required" },
      400,
    );
  }

  try {
    const workflow = getWorkflow();
    const result: WorkflowResult = await workflow.execute(
      roadmapInput,
      source,
      body.config as Record<string, unknown>,
    );

    const stages: Array<{ stage: string; ok: boolean; output: unknown }> = [];
    for (const s of result.stages) {
      stages.push({ stage: s.stage, ok: s.ok, output: s.output });
    }

    const response: ActivateResponse = {
      ok: result.ok,
      planId: result.plan?.id,
      analysis: result.analysis
        ? {
            totalPhases: result.analysis.totalPhases,
            totalEpics: result.analysis.totalEpics,
            totalMilestones: result.analysis.totalMilestones,
            readyEpics: result.analysis.readyEpics,
            blockedEpics: result.analysis.blockedEpics,
            disciplines: result.analysis.disciplines,
            capabilities: result.analysis.capabilities,
          }
        : undefined,
      stages,
    };

    return jsonResponse(response, result.ok ? 200 : 422);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse(
      { error: "EPCL activation failed", detail: message } as unknown as ActivateResponse,
      500,
    );
  }
}

// ── Registration ───────────────────────────────────

export function registerEPCLRoutes(router: Router): void {
  router.post("/api/v1/epcl/activate", activateEPCL);
  router.get("/api/v1/epcl/health", (_request, _env, _params) => {
    return jsonResponse({
      ok: true,
      service: "epcl",
      status: "ready",
    });
  });
}

// ── Helpers ────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}