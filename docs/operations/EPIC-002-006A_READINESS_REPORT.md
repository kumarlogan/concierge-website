# EPIC-002-006A — Implementation Readiness Report

**Milestone:** Phase 0 Baseline · Hermes Platform Extraction
**Date:** 2026-07-19 · **Repo:** `/home/ubuntu/concierge-website`
**Governing decision:** ADR-007 (Proposed)
**Mode:** Documentation only — no production changes

---

## Summary

The extraction baseline for Hermes Platform (EPIC-002-006A) is **captured and
verified**. All technical prerequisites for a safe, reversible extraction are
in place. One administrative blocker remains: the git working tree is dirty and
must be resolved before the `baseline-002-006` tag can be created against a
clean commit.

## Verified facts

- **Commit:** `8f836548985d4803abb290172a5adcbdcb07bd5b` (branch `main`)
- **Tests:** 141/141 passing (7 files, vitest) — auth, RBAC, audit, Telegram,
  ops, consultation, health all green.
- **Migrations:** 0001–0004 applied; none pending; schema frozen for Phase 0.
- **Workers:** `agsynergy-api` (D1 `agsynergy-db`, `api.agsynergy.ca`) +
  `hermes-website` site (static). Single Worker currently hosts app + auth +
  bot.
- **Auth flow:** `resolveIdentity → buildPrincipal → hasPermission →
  writeAuditEvent → Principal|401/403`. Data-driven (ADR-003), OWNER
  short-circuit, tolerant audit writer.
- **Extraction targets:** `hermes/{identity,permissions,audit,providers}` +
  `shared/{interfaces,contracts}` mapped file-by-file from current `auth/*`,
  `routes/telegram.ts`, and RBAC migrations.

## Golden regression gates (must hold every phase)

Authentication · Authorization · RBAC · Audit · Telegram identity · Lead access
· Consultation · Health — **141/141 total, byte-identical golden requests**.

## Rollback

Flag-gated (`HERMES_PLATFORM_MODE`) per phase + universal
`git checkout baseline-002-006 -- workers/`. Phase 4 adds compensating
migration `0002_rollback.sql`.

## Readiness verdict

| Gate | Result |
|---|---|
| Tests green | ✅ |
| Schema frozen | ✅ |
| Auth documented | ✅ |
| Inventory complete | ✅ |
| Golden checks defined | ✅ |
| Rollback defined | ✅ |
| **Clean tree for tag** | ⚠️ **BLOCKER** |

**CONDITIONALLY READY** — proceed to tag only after the dirty tree (§1.2 of the
baseline report: regenerated API clients, source edits, 2 untracked docs) is
committed or stashed.

## No changes made

- ✅ No Worker code modified
- ✅ No migrations modified
- ✅ No Cloudflare config touched
- ✅ No deployment performed
- ✅ No secrets accessed or modified

*Stopping after readiness report per milestone rules.*
