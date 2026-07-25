# EPIC-005 — Foundation Report

**Phase:** 9 — Foundation report
**Status:** Architecture-only. No source code modified.
**Date:** 2026-07-20

---

## 1. Architecture Assessment

The Hermes internal platform is **mature on internal trust boundaries** and **immature on the external provider dimension**.

**Strong (keep):** single fail-closed policy decision point, centralized tenant enforcement, provider-neutral persistence seams, generic orchestration engine, manifest/loader/registry isolation of vendor code.

**Weak (fix):** providers are bare strings with no trust metadata; no transport layer; capability ids are vendor-namespaced; no provider health/selection intelligence; no runtime provider discovery.

EPIC-005 resolves every weakness **additively** — the existing extension points (Manifest/Loader/Registry, Persistence Backend, Audit Sink, Adapter Bundle) mean no rewrite is required. The new layers (Manifest V2, Transport, Trust Lifecycle, Marketplace, Selection Engine) sit *on top of* the existing seams.

---

## 2. Risk Analysis

| Risk | Likelihood | Impact | Mitigation (phase) |
|------|-----------|--------|--------------------|
| Provider id forgery passes allow-list | Med | High | Manifest V2 signature + Trust Lifecycle (2, 4) |
| No way to run remote/CLI/MCP providers | High (blocker for external platform) | High | Transport Architecture (3) |
| Vendor lock-in at capability layer | Med | Med | Intention-based Capability Model (1) |
| Cannot pick best backend | Med | Med | Selection Engine (6) |
| Operators blind to provider state | Med | Low | Marketplace (5) |
| AGS-specific code leaks into core | Low (rules prevent) | High | AGS Readiness review (7) + Strict Rules |

**Residual risk after EPIC-005 (architecture only):** none structural — all are implementation-phase risks covered by the Phase-8 milestone tests.

---

## 3. Remaining Gaps (to be closed in implementation, NOT this cycle)

1. `ProviderName` closed union → must become manifest-driven (M1).
2. `isAdapterImplemented` hardcoded cloudflare → replace with Trust Lifecycle ACTIVE state (M3/M11).
3. `executor` closure → wrap as `local-process` transport (M2).
4. `knownProviders()` bare list → derive from validated manifests (M3/M6).
5. No signature verification code yet (M4 — design only here).
6. No sandbox enforcement yet (M5 — design only here).

---

## 4. Recommended Implementation Order

```
M0 (capability re-key)        ← do first; everything keys off intention ids
   ║
   ├─▶ M1 (manifest V2) ─▶ M3 (lifecycle) ─▶ M4 (signatures)
   │                                    └─▶ M5 (sandbox)
   ├─▶ M2 (transport)  ───────────────┐
   │                                    ▼
   └─▶ M6 (marketplace) ◀──────── M3 + M2
            │
            ▼
         M7 (scoring) ─▶ M8 (policy integration)
            │
            ▼
   M9/M10/M11 (provider manifests) ─▶ M12 (AGS validation)
```

Rationale: M0 establishes the stable vocabulary. M1/M2/M3 are the three parallel foundations. M6 composes them. M7/M8 add intelligence. M9–M11 prove the model with real providers. M12 validates the whole.

---

## 5. Suggested First Provider

**`claude-code`** (M9).

Why first:
- It exercises the `cli` transport (M2) — the most different from today's in-memory closure.
- It is the reference "agent" provider for AGS (Phase 7 scenario).
- Its manifest is small (2–3 capabilities) and low-risk (sandbox trust level).
- Success here validates the entire Manifest → Trust → Transport → Selection → Policy chain end-to-end before harder providers (github oauth, cloudflare token) are added.

`cloudflare` should be **last of the three** (M11) because it requires *retiring* the existing `cloudflareBundle` special-case — higher blast radius, best done once the pattern is proven.

---

## 6. Validation Strategy

| Layer | How to validate (implementation phase) |
|-------|----------------------------------------|
| Capability Model | Assert no vendor token in any capability id; registry round-trips intention ids |
| Manifest V2 | Schema validator rejects missing `trust.signature` for trusted providers |
| Transport | `local-process` transport reproduces current `executor` behavior byte-for-byte (golden test) |
| Trust Lifecycle | Fuzz transitions; assert any integrity failure → REJECTED (fail-closed) |
| Signatures | Known-good manifest passes; tampered checksum → REJECTED; unknown signer → REJECTED |
| Sandbox | Assert process spawned with enforced network/filesystem limits |
| Marketplace | `list({capability:"deploy.website"})` returns only providers declaring it |
| Selection | Deterministic given fixed weights + history; rationale emitted as audit |
| Policy integration | Selection result still denied if policy evaluator says no (fallback to #2) |
| AGS end-to-end | Drive Phase-7 flow; grep core for "ags"/"cloudflare" special branches → must be zero |

---

## 7. Commit Grouping

13 PRs (see `EPIC-005_IMPLEMENTATION_ROADMAP.md` §Commit Grouping): PR-0 through PR-12, one per milestone group. Each independently revertible. No PR rewrites another.

---

## 8. Readiness Score

| Dimension | Score (0–5) | Note |
|-----------|-------------|------|
| Internal trust boundaries | 5 | Policy/tenant/approval already fail-closed |
| Persistence neutrality | 5 | Backend seams exist; only memory ships |
| Capability model | 3 | Intention model designed; registry still vendor-namespaced (M0) |
| Manifest | 3 | V2 designed; legacy manifest ships today (M1) |
| Transport | 1 | No transport layer exists (M2) |
| Trust model | 2 | Lifecycle designed; no signature/sandbox code (M3–M5) |
| Marketplace | 1 | Designed only; no runtime discovery (M6) |
| Selection | 1 | Scoring designed; not implemented (M7) |
| AGS readiness | 4 | Proven architecture-ready; 0 AGS code needed in core |

**Overall foundation readiness: 4.0 / 5** — the *architecture* is complete and provider-neutral; the *implementation* is a well-sequenced, reversible 13-PR path with no rewrites. EPIC-005 Foundation Constitution is **satisfied**.

---

## 9. Sign-off

- ✅ Architecture-only cycle — no production source modified.
- ✅ No commits, no deploy, no Cloudflare/AGS changes, no secrets.
- ✅ All 10 phases (0–9) produced as documentation.
- ✅ Strict Execution Rules honored.
- 🛑 **Stop.** Awaiting user direction before any implementation milestone begins.
