# GOV-001 Reference Audit

> Comprehensive audit of every `hermes-website` repository reference.
> Generated 2026-07-26 as part of GOV-001 migration.

---

## Summary

| Category | Count |
|---|---|
| ✅ Updated (automated) | 55+ references across ~45 files |
| 🟡 Manual review required | 5 references (org architecture docs) |
| 🟢 Cloudflare Worker name (leave as-is) | 14 references (operational docs) |
| 📜 Historical records (leave as-is) | 15 references (baseline reports) |
| 🗑️ Artifact cleanup | 5 references (stale subdirectory) |
| **Total remaining** | **39 references across 22 files** |

---

## A. Updated References (55+ across ~45 files)

These were automatically replaced from `kumarlogan/hermes-website` → `kumarlogan/concierge-website`
and `/home/ubuntu/hermes-website` → `/home/ubuntu/concierge-website`.

| Category | Files Updated |
|---|---|
| Root governance docs | README.md, PROJECT.md, ROADMAP.md, ARCHITECTURE.md, CHANGELOG.md, CURRENT_SPRINT.md, TASKS.md, DECISIONS.md, SECURITY.md, STYLEGUIDE.md |
| Organization docs | ORGANIZATION_ARCHITECTURE.md, ORGANIZATION_ROADMAP.md, HERMES_PLATFORM.md, ENVIRONMENT_MODEL.md, IDENTITY_MODEL.md, INFRASTRUCTURE_INVENTORY.md, REPOSITORY_STRUCTURE.md, MIGRATION_STRATEGY.md |
| ADRs | ADR-004-organization-architecture.md, ADR-005-hermes-platform.md |
| Operations docs | AGS_FIRST_STAGING_RUN.md, AGS_STAGING_RUNBOOK.md, AGS_PROVIDER_READINESS.md, AGS_PROVIDER_INTEGRATION.md, AGS_ACTIVATION_BASELINE.md, AGS_FERTILITY_DEPLOYMENT_DIAGNOSTIC_REPORT.md |
| EPIC reports | EPIC-002-006A*, EPIC-002-006A1*, EPIC-002-006A2*, EPIC-002-006A3*, EPIC-002-006A4*, EPIC-002-006A4B*, EPIC-002-006A4C*, EPIC-002-006B*, EPIC-002-006D*, EPIC-002-006A_*, EPIC-003-002*, EPIC-003-003*, EPIC-004.6*, EPIC-005.8A* |
| Infrastructure docs | DEPLOYMENT.md, AUDIT_REPORT.md, SESSION_HANDOFF.md, HERMES_FOUNDATION_ACCEPTANCE_AUDIT.md |
| Release docs | HERMES_v1_RELEASE_NOTES.md, HERMES_PROJECT_STATE_AUDIT.md, HERMES_V1_STABILIZATION_REPORT.md, PLATFORM_BASELINE_v1.md |
| Deployment | deploy.sh |

---

## B. Manual Review Required

These references discuss the architectural relationship between `hermes-website` (the repo
name/current state) and future organization structure. They require human judgment to
decide whether to update.

| File | Line | Context | Recommendation |
|---|---|---|---|
| docs/organization/ORGANIZATION_ARCHITECTURE.md | 259 | `# ← today's hermes-website/workers` | **UPDATE** — references current repo; replace with concierge-website |
| docs/organization/HERMES_PLATFORM.md | 45 | `"What exists today as hermes-website/workers"` | **UPDATE** — references current repo path |
| docs/organization/ENVIRONMENT_MODEL.md | 61 | `"Today hermes-website deploys one Cloudflare target"` | **UPDATE** — references current repo in architectural analysis |
| docs/organization/IDENTITY_MODEL.md | 63 | Identity model table row | **UPDATE** — references repo identity |
| docs/organization/INFRASTRUCTURE_INVENTORY.md | 25, 47 | Resource IDs and inventory table | **UPDATE** — infrastructure inventory |

**These documents are future-state organizational architecture docs, not historical records.**
They should reflect the new naming post-MVP extraction.

---

## C. Cloudflare Worker Name (Keep As-Is)

These references describe the **actual deployed Cloudflare Worker name** (`hermes-website`).
The Worker has not been renamed and will not be as part of GOV-001.

| File | Reference Type |
|---|---|
| EPIC-010_DEPLOY_GOVERNANCE.md:35 | Deployment identity: worker name (with annotation) |
| EPIC-010_DEPLOY_GOVERNANCE.md:73 | Rollback command |
| AGS_FIRST_STAGING_RUN.md:14, 26 | Cloudflare project name |
| AGS_FERTILITY_DEPLOYMENT_DIAGNOSTIC_REPORT.md:139, 158 | wrangler.jsonc name field |
| AGS_PROVIDER_INTEGRATION.md:57 | deploy.worker reference |
| AGS_ACTIVATION_BASELINE.md:61 | pipeline.sh reference |
| EPIC-002-006A_BASELINE_REPORT.md:88 | Site Worker table |
| EPIC-002-006A_READINESS_REPORT.md:25 | Worker name in description |
| EPIC-002-006A2_SCRIPT_REVIEW.md:71, 75, 76 | Historical script references |
| EPIC-002-006A3_REPOSITORY_HYGIENE_PLAN.md:35 | wrangler.jsonc worker name |
| SESSION_HANDOFF.md:92 | Cloudflare Pages project name |

---

## D. Historical Records (Keep As-Is)

These are **historical baseline and audit reports** documenting the state of the repository
at a point in time. Changing them would alter historical records.

| File | References | Date |
|---|---|---|
| AUDIT_REPORT.md | `hermes-website/` new directory | 2026-07-19 |
| EPIC-002-006A3_REPOSITORY_HYGIENE_PLAN.md | Repo structure plan with `hermes-website/` | 2026-07-19 |
| AGS_PROVIDER_READINESS.md | `hermes-website/pipeline.sh` reference | 2026-07-19 |
| PLATFORM_BASELINE_v1.md | Directory listing | 2026-07-19 |
| .hermes/reconciliation-report.md | Session artifact | 2026-07-XX |

---

## E. Artifact Cleanup

These references relate to a stale `hermes-website/` subdirectory that was created as a
session artifact and should be cleaned up.

| File | Lines | Notes |
|---|---|---|
| HERMES_PROJECT_STATE_AUDIT_2026-07-25.md | 723 | Subdirectory audit |
| HERMES_V1_STABILIZATION_REPORT.md | 66, 149 | Temp/scratch subdirectory |
| HERMES_V1_STABILIZATION_REPORT.md | 225, 226 | Cleanup commands already in report |
| .hermes/reconciliation-report.md | 75 | Session artifact reference |

---

## F. Product Name Audit Summary

| Pattern | Occurrences | Action |
|---|---|---|
| `hermes-website` (repo refs in docs) | 47 files | Updated to `concierge-website` where appropriate; categorized above for remaining |
| `AG Synergy Product` | 2 files | Updated to `Concierge` |
| `Hermes Platform` (org hierarchy) | ~50 files | Updated to `AI Platform` in governance header; left as Hermes software platform in engineering context |
| `AG Synergy Platform` (doc descriptions) | ~25 files | **Left as-is** — public branding / product descriptions |
| `AG Synergy Roadmap` | 0 files | No occurrences found |