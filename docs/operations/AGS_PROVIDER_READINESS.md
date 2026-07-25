# EPIC-005 — AGS Provider Readiness Review

**Phase:** 7 — Can Hermes operate AGS without AGS-specific logic?
**Status:** Architecture-only. No source code modified.
**Date:** 2026-07-20

---

## 1. Scenario Under Review

```
Hermes
  ↓
Claude Code          (dev.code.generate / dev.code.review)
  ↓
GitHub               (git.commit / git.pr.open / deploy.infra)
  ↓
Cloudflare           (deploy.website / deploy.worker / storage.object.put)
  ↓
Verification         (security.scan / policy.decide)
  ↓
Audit                (audit.append)
```

Question: **Does any step above require project-specific (AGS) code in Hermes core?**

---

## 2. Mapping Scenario → EPIC-005 Architecture

| Step | EPIC-005 mechanism | AGS-specific code needed? |
|------|--------------------|---------------------------|
| Hermes intends `dev.code.generate` | Capability Model (Phase 1) — intention id | **No** — generic intention |
| Route to Claude Code | Manifest V2 (Phase 2) declares `dev.code.generate`; Selection Engine (Phase 6) ranks it | **No** — data + scoring |
| Drive Claude Code CLI | Transport `cli` (Phase 3) — Hermes-owned, reusable | **No** — generic transport |
| Push to GitHub | Manifest `git.commit`/`git.pr.open`; Transport `https`+oauth | **No** |
| Deploy to Cloudflare | Manifest `deploy.website`; Transport `https`+token | **No** |
| Verify | Capability `security.scan` + existing `ExecutionPolicyEvaluator` | **No** — already generic |
| Audit | `emitAudit` (existing) | **No** — already generic |

---

## 3. Residual Project-Specific Assumptions (findings)

| # | Assumption | Where | Severity | EPIC-005 resolution |
|---|------------|-------|----------|---------------------|
| A1 | `cloudflareBundle` is the only implemented adapter; AGS deploy assumes Cloudflare is active | `providers/index.ts` | Medium | Manifest-driven loader makes Cloudflare *one of N*; no special activation |
| A2 | `isAdapterImplemented` hardcodes `"cloudflare"` as the only live adapter | `providers/index.ts:69` | Medium | Replaced by Trust Model lifecycle (`ACTIVE` state) — any validated provider can be active |
| A3 | Capability ids like `cloudflare:r2` bake AGS's current vendor into the registry key | `capability.ts:23` | Medium | Replaced by intention ids (`storage.object.put`) — see Phase 1 |
| A4 | `knownProviders()` allow-list implies AGS pre-loaded Cloudflare as trusted | `policy-evaluator.ts:208` | Low | Trust Model derives trusted set from validated manifests, not a hardcoded list |
| A5 | The deploy pipeline (`pipeline.sh`) is an AGS-specific external script, not a Hermes capability | `hermes-website/pipeline.sh` | Low | Wrap as a `deploy.website` provider impl behind a manifest — no core change |

---

## 4. Verdict

**AGS can be operated entirely through the EPIC-005 universal architecture with ZERO AGS-specific code in Hermes core.**

The only "AGS-shaped" artifacts are:
1. **Provider manifests** for `claude-code`, `github`, `cloudflare` (data files — not core code).
2. **implKey factory registrations** that bind those manifests to existing adapters/transports (already the established seam).
3. **Operator config** (trust signers, selection weights, approval defaults) — config, not code.

None of these are special cases. A future project ("XYZ Corp") would add its own manifests + implKeys with **identical mechanics**. The Baseline Review's vendor coupling (H1–H5, P1–P4) is fully resolved by Phases 1–6.

---

## 5. What Would Break Readiness (must NOT happen)

- ❌ Adding `if (project === "ags")` anywhere in core.
- ❌ Hardcoding Cloudflare as the default deploy target in the coordinator.
- ❌ Letting the `pipeline.sh` path leak into execution logic instead of behind a manifest capability.
- ❌ Vendor-prefixed capability ids surviving the migration.

All four are prevented by the EPIC-005 ruleset (Phases 1, 2, 6 + the Strict Execution Rules).

---

## 6. Conclusion

The architecture is **AGS-ready by construction**. AGS is just three more provider manifests in the Marketplace. No redesign, no special cases, no AGS code in core.
