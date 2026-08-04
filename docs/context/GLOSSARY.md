# Glossary — kumarlogan/concierge-website

**Generated:** 2026-08-04  
**Evidence sources:** `G_root_docs_catalogue.md`, `H_docs_tree_catalogue.md`, `I_repo_activity.md`  
**All definitions drawn from those files. Anything not found there is marked `unknown`.**

---

## Naming Relationships (Read First)

These five names refer to distinct but related things and are frequently confused in older documents:

| Name | What it is | Scope |
|---|---|---|
| **AGS** | The legal company entity (AG Synergy Inc. or equivalent) | Corporate |
| **Hermes** | The AI engineering agent / software platform that powers automated delivery | Software / Platform |
| **AI Platform** | The organizational layer between AGS and individual products; replaces "Hermes Platform" in governance headers after GOV-001 | Org layer |
| **Concierge** | The internal product name for the AGS Fertility patient portal — used in all engineering, planning, and governance documents | Product (internal) |
| **AG Synergy** / agsynergy.ca | The public patient-facing brand for the same product | Product (public) |

**Repo naming history:** The repository was originally named `hermes-website`. It was renamed `concierge-website` via GOV-001 (2026-07-26) to reflect the product-first naming standard. The live Cloudflare Worker was intentionally **not** renamed at the same time — it still carries the name `hermes-website` as of 2026-08-04. References to `hermes-website` in Cloudflare infrastructure are deliberate keep-as-is entries, not oversights.

Evidence: `NAMING_STANDARDS.md`, `GOV-001_MIGRATION_CHECKLIST.md`, `GOV-001_REFERENCE_AUDIT.md`

---

## Term Definitions

### ADR — Architecture Decision Record

A numbered document recording a significant architectural decision: the context, the options considered, the decision taken, and its consequences. ADRs are intended to be immutable once accepted.

**In this repo:** Two directories hold ADRs with overlapping number ranges. `docs/decisions/` contains ADR-001 through ADR-016 (early series). `docs/adr/` contains ADR-012 through ADR-018 (newer series, currently active). ADR-016 exists in both directories with different content — a known collision. Always qualify ADR references with the directory path when the number falls in the overlap zone (ADR-012 to ADR-016).

Evidence: `H_docs_tree_catalogue.md` §3

---

### AGS

The legal company entity behind the Concierge product and the agsynergy.ca platform. Used in document headers, regulatory compliance statements (PIPEDA, PHIPA, CASL), and the public brand name "AG Synergy." Not to be confused with Hermes (the engineering platform) or Concierge (the product).

Evidence: `NAMING_STANDARDS.md`, `G_root_docs_catalogue.md` §Product/Platform Naming

---

### AG Synergy

The public patient-facing brand name for the AGS Fertility Concierge product. Appears on agsynergy.ca and in all customer-facing surfaces. Engineering and governance documents use "Concierge" instead. The two names refer to the same product viewed from different audiences.

Evidence: `NAMING_STANDARDS.md`

---

### Capability Maturity Model

An 8-level scale used to rate the maturity of each AI Platform capability:

1. Concept
2. Architecture
3. Prototype
4. Development
5. Production Ready
6. Operational
7. Deprecated
8. Retired

Each of the 14 platform capabilities is rated against this scale. The model governs promotion criteria and deprecation policy.

Evidence: `H_docs_tree_catalogue.md` §7 (Engineering Standards, ADR-011)

---

### Certification

A formal point-in-time assessment declaring that a component, capability, or process meets defined quality and governance standards. Certifications in this repo are frozen records — they are HISTORICAL documents, not living policies. Examples: `HERMES_PLATFORM_CERTIFICATION.md`, `SECURITY_CERTIFICATION_REPORT.md`, `EPIC-007_CERTIFICATION.md`.

Certifications are intentionally retained and must not be deleted; they form the audit trail for governance decisions.

Evidence: `G_root_docs_catalogue.md` §Catalogue Table, `docs/certification/`

---

### Clinic vs Patient Workspace

Two distinct workspace contexts within the Concierge product:

- **Patient workspace:** The patient-facing portal (agsynergy.ca) where patients manage their fertility journey, access documents, communicate with their care team.
- **Clinic workspace:** The clinic-side administrative and clinical view, gated by clinic identity. Routes prefixed `/clinic/*` require verified clinic identity (enforced by `fix(security)` work in PR #3, 2026-08-03).

The distinction matters for security: the `fix(security): require clinic identity for all /clinic/* routes` commit (2026-08-03) addresses a gap where clinic routes were accessible without clinic identity verification.

Evidence: `I_repo_activity.md` §6, `H_docs_tree_catalogue.md` §7

---

### Concierge

The internal engineering name for the AGS Fertility patient portal product. Used in all engineering, planning, governance, and architecture documents. The public-facing brand name for the same product is AG Synergy.

Evidence: `NAMING_STANDARDS.md`, `PROJECT.md`

---

### EPCL — Executive Planning & Control Layer

AI Platform Capability #14, defined in ADR-018. The strategic planning engine that decomposes a roadmap into executable plan atoms, routes work to the appropriate discipline, and manages context budget. The certified execution path for autonomous work runs: EPCL → WAS → WEF.

EPCL has 12 stages. `EPIC-007_CERTIFICATION.md` records a conditional pass (748/750 tests) for EPCL certification.

**Critical gap:** `WAVE2_AUDIT_REPORT.md` documents that Wave 2 was implemented by bypassing the EPCL→WAS→WEF certified path entirely — all EPCL flags defaulted to false. The audit report confirms this as a gap, not a feature. No code changes were recommended at the time of the audit.

Evidence: `H_docs_tree_catalogue.md` §7 (ADR-018), `EPIC-007_CERTIFICATION.md`, `WAVE2_AUDIT_REPORT.md`

---

### EPIC / EPIC-NNN-NNN (Two-Tier Scheme)

A major unit of planned work. EPICs are numbered using a two-tier scheme:

- **First tier (NNN):** The parent epic group (e.g., EPIC-002 = Hermes Platform sub-epics; EPIC-003 = Execution/Workforce Platform)
- **Second tier (NNN):** The specific sub-epic within that group (e.g., EPIC-002-006G, EPIC-003-005)

Later EPICs shift to a simpler single-tier with part notation (e.g., EPIC-004 (1/6) through (6/6)) or dot notation (EPIC-005.9, EPIC-014, EPIC-015).

Complete EPIC list observed in commits: EPIC-001-001 through EPIC-001-009; EPIC-002-001 through EPIC-002-008 (including sub-variants EPIC-002-006G, EPIC-002-006H); EPIC-003-001 through EPIC-003-006; EPIC-004 through EPIC-015.

Evidence: `I_repo_activity.md` §2

---

### Foundation / Foundation Freeze

**Hermes Foundation** is the set of core platform components that were certified as production-ready and then deliberately frozen at version 1.0.0 on 2026-07-30. The frozen components include: Intent Engine, EPCL, WAS, WEF, and related platform capabilities.

**Foundation Freeze** (`FOUNDATION_FREEZE.md`) is the active governance constraint declaring that no new capabilities may be added to the Foundation. The only permitted actions within the frozen Foundation are: bug fixes, security patches, and changes triggered by engineering, architecture, or compliance needs. The freeze is not a deprecation — the Foundation is in active production use.

Evidence: `FOUNDATION_FREEZE.md`, `FOUNDATION_CHANGELOG.md`, `FOUNDATION_v1_RELEASE_NOTES.md`

---

### GOV-NNN

Governance framework work items, distinct from product EPICs. Examples:

- **GOV-001:** Repo rename from hermes-website to concierge-website; adoption of canonical naming standards (2026-07-26)
- **GOV-002:** Operational Governance & Phase 2 Kickoff (observed in commit history)
- **GOV-004:** Final governance wave; governance declared feature-complete after GOV-004; no standalone governance waves permitted thereafter

Evidence: `I_repo_activity.md` §2, `H_docs_tree_catalogue.md` §7 (Governance Freeze, ADR-015)

---

### Hermes

The AI engineering agent and software platform that manages automated delivery of the Concierge product. Hermes is the builder — Concierge is the thing being built.

Hermes commits to the repository directly (two commits are authored as `Hermes Agent`: SHA `97cf0e4` and `0b17339`). Hermes operates under strict constraints: it cannot deploy, merge, activate bots, or expand scope without explicit human approval. These constraints are codified in `OPERATING_MODEL_v1.md` and `AI_OPERATING_MODEL.md`.

The name "Hermes" is preserved for the software platform even though the organizational layer above it was renamed from "Hermes Platform" to "AI Platform" via GOV-001.

Evidence: `NAMING_STANDARDS.md`, `AI_OPERATING_MODEL.md`, `I_repo_activity.md` §1

---

### Identity Core

The Trust & Identity platform capability. Manages PHI (Personal Health Information) handling, patient identity lifecycle, verified clinic identity, and the six-level identity state machine (including VERIFIED state reached via email verification). Identity Core is one of the 14 AI Platform capabilities.

The identity verification fix (PR #2, 2026-07-29) resolved a production Error 1101 caused by a missing `consentEngine.initialize()` call in the identity flow.

Evidence: `H_docs_tree_catalogue.md` §7 (Security Model, ADR-002/ADR-012/ADR-013), `I_repo_activity.md` §6

---

### M1–M9 — Milestones

Sequential milestones within an EPIC, used to track implementation progress at a finer grain than wave or sprint. Example from `HERMES_CORE_NIGHT_PROMPT.md`:

- M1: Trust persistence — complete
- M2: Checksum — complete
- M3: Signature verification — complete
- M4: Authentication — awaiting review before starting

Not all EPICs use M-notation; some use part notation (1/6, 2/6, etc.) or wave notation instead.

Evidence: `HERMES_CORE_NIGHT_PROMPT.md`, `I_repo_activity.md` §2

---

### PSER — Project State & Execution Registry

AI Platform Capability #12, defined in ADR-016 (`docs/adr/`). A machine-readable project state store using Cloudflare D1, KV, and R2. Its purpose is to give Hermes deterministic context at the start of each session, replacing the fragile approach of parsing markdown files.

PSER activation records are in `docs/launch/PSER_ACTIVATION.md`.

Evidence: `H_docs_tree_catalogue.md` §7 (ADR-016/ADR-018), `docs/launch/`

---

### ProviderRuntimeGuard

A security component in the Hermes platform execution stack (Stack A). Applies 8 fail-closed checks before any capability is executed. A critical architecture gap exists: Stack B (`ExecutionCoordinator` → `executeCapability`) does NOT pass through `ProviderRuntimeGuard`, meaning tenant isolation and runtime security checks are not enforced on the Stack B path.

Evidence: `H_docs_tree_catalogue.md` §7 (Hermes Platform Architecture, HERMES_PLATFORM_M1.md)

---

### Reconciliation

The process of aligning runtime agent/capability/organization state with the intended architecture, resolving discrepancies between what was planned and what is actually running. Reconciliation artifacts are stored in `docs/reconciliation/` (21 files). These are historical snapshots, not living documents.

Evidence: `H_docs_tree_catalogue.md` §2 (`docs/reconciliation/`)

---

### Stack A / Stack B

Two parallel execution paths in the Hermes platform, discovered as an architecture gap:

- **Stack A:** `UniversalCapabilityPlatform` + `ProviderRuntimeGuard` (8 fail-closed security checks; tenant isolation enforced)
- **Stack B:** `ExecutionCoordinator` → `executeCapability` (NO `ProviderRuntimeGuard`; NO tenant check; security gap)

Two capability registries also coexist: `MemoryCapabilityRegistry` and a module-level `REGISTRY` Map. The divergent stacks were documented in `docs/architecture/HERMES_PLATFORM_M1.md` as identified gaps requiring remediation.

Evidence: `H_docs_tree_catalogue.md` §7 (Hermes Platform Architecture)

---

### Trust Runtime

The runtime enforcement layer for trust and identity decisions. Encompasses `ProviderRuntimeGuard`, tenant isolation checks, approval token verification, and audit logging. Currently has known weaknesses: the approval token verifier accepts any non-empty string (so `"human-token"` is a valid token), and the audit log is in-process rather than durable, meaning it is lost on Worker restart.

Evidence: `H_docs_tree_catalogue.md` §7 (Hermes Platform Architecture, ADR-013)

---

### WAS — Workforce Activation Service

The component that sits between EPCL and WEF in the certified execution path. Receives decomposed plan atoms from EPCL and activates the appropriate workforce unit (agent or agent team) to execute them. Part of the Hermes Foundation (frozen at v1.0).

Evidence: `EPIC-007_CERTIFICATION.md`, `WAVE2_AUDIT_REPORT.md`, `FOUNDATION_FREEZE.md`

---

### Wave

A delivery increment within a Phase, covering one or more related EPICs. Waves are the primary unit of product delivery tracking in Phase 2. Waves 1–9 delivered Phase 2 (Patient Workflow Platform) between approximately 2026-07-19 and 2026-07-27.

Wave-level records are in `docs/ops/` (scorecards, release notes, PO review packages). Point-in-time wave completion reports for Waves 7 and 8 are in `docs/wave7/` and `docs/wave8/`.

Known waves: Wave 3 (Timeline Engine), Wave 4 (Care Companion), Wave 5 (Document Centre), Wave 5.1 (hardening), Wave 6 (Communication Centre), Wave 7 (Notification & Engagement Platform), Wave 8 (Workflow & Automation Engine), Wave 8.1 (hardening), Wave 9 (final Phase 2 wave).

Evidence: `I_repo_activity.md` §2, `ROADMAP.md`, `CHANGELOG.md`

---

### WebOps

unknown — the term "WebOps" does not appear in the evidence files.

---

### WDC — Workforce Development Cycle

The original name for what is now called WEF (Workforce Execution Framework). ADR-014 (`docs/decisions/ADR-014-workforce-development-cycle.md`) defined WDC v1.0. ADR-015 superseded it with the rename to WEF. The file `docs/governance/WORKFORCE_DEVELOPMENT_CYCLE.md` is preserved with a historical note per ADR-015.

Evidence: `H_docs_tree_catalogue.md` §3 (ADR-014), §6.3

---

### WEF — Workforce Execution Framework

The enterprise execution model, also called "Workforce Execution Framework v1.1." Defined in ADR-015 (as the successor to WDC v1.0) and upgraded to v1.1 in ADR-017 (Enterprise Operating Model).

WEF defines the full execution hierarchy:
Company → Business Unit → Platform → Product → Portfolio → Roadmap → Phase → Wave → Epic → Sprint → Story → Task

WEF v1.1 compliance is one of the security and governance certification criteria. `SECURITY-REVIEW-v2.md` records 87% WEF compliance at MVP security baseline.

Evidence: `H_docs_tree_catalogue.md` §7 (ADR-015, ADR-017), `ARCHITECTURE.md`, `MVP_SECURITY_BASELINE.md`
