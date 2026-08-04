# AI Context Layer

**Start here.** This directory is the machine-readable engineering memory of the
`concierge-website` repository. It exists so that an engineer or an AI session can
begin work from the repository alone, without needing a previous conversation.

Generated 2026-08-04 by an external AI engineering session, from repository
evidence only.

---

## Read in this order

| Order | File | Answers |
|---|---|---|
| 1 | [`PROJECT_STATE.yaml`](./PROJECT_STATE.yaml) | What is this, what is deployed, what actually works? |
| 2 | [`KNOWN_GAPS.yaml`](./KNOWN_GAPS.yaml) | What is already known to be broken? (20 catalogued) |
| 3 | [`CURRENT_WORK.yaml`](./CURRENT_WORK.yaml) | What is in flight right now? |
| 4 | [`ARCHITECTURE.yaml`](./ARCHITECTURE.yaml) | How is the system actually built? |
| 5 | [`ENGINEERING_GUIDE.md`](./ENGINEERING_GUIDE.md) | How do I make a change here safely? |

Then as needed:

| File | Use when |
|---|---|
| [`DOCUMENT_INDEX.md`](./DOCUMENT_INDEX.md) | Before reading any other markdown in this repo — tells you what to trust |
| [`DECISION_LOG.md`](./DECISION_LOG.md) | Before changing anything architectural — indexes all 19 ADRs |
| [`ROADMAP.yaml`](./ROADMAP.yaml) | Before proposing new work |
| [`GLOSSARY.md`](./GLOSSARY.md) | When you hit an unfamiliar acronym — there are many |
| [`AI_COLLABORATION.md`](./AI_COLLABORATION.md) | You are an AI session — read this too |
| [`CONTEXT_MAINTENANCE.md`](./CONTEXT_MAINTENANCE.md) | Before you finish — your obligation to keep this true |

Full supporting evidence lives in [`../engineering/reports/`](../engineering/reports/).

---

## Three things to know before you read anything else

**1. This repository has more documentation than code.**
514 markdown files against roughly 400 source files. Documentation is not missing
here; navigation and authority ranking were. About half the 47 root markdown files
are point-in-time historical records that read like current-state documents.
`DOCUMENT_INDEX.md` marks every one as `AUTHORITATIVE`, `HISTORICAL`,
`SUPERSEDED`, or `UNCERTAIN`. Check it before trusting a document.

**2. Documented capability is not running capability.**
The Hermes platform track — EPCL planning, WAS activation, WEF execution — is
extensively designed, substantially coded, and largely unreachable at runtime. All
11 relevant feature flags default to `false` and no HTTP route reaches the
pipeline. `ARCHITECTURE.yaml` gives every subsystem a `maturity` and an
`http_exposed` flag. Trust those over prose.

**3. Nothing gates a push to production.**
Every commit to `main` auto-deploys both Cloudflare Workers. There is no test run
and no typecheck in the pipeline. Verify locally; the pipeline will not catch you.

---

## Naming, in one paragraph

**AGS** is the company. **Hermes** is the AI engineering platform. **Concierge**
is the internal product name. **AG Synergy** (agsynergy.ca) is the public
patient-facing brand. The repository was renamed from `hermes-website` to
`concierge-website` under GOV-001 in July 2026, but the live Worker still carries
the old name. All four terms appear throughout the corpus, often in the same
document. See `GLOSSARY.md`.

---

## How this layer was built

Read-only discovery across the full repository — build tooling and CI/CD, the
Worker HTTP layer, all 15 platform subsystems, the frontend, the D1 data layer,
shared libraries, both documentation trees, and repository activity — followed by
an evidence-based assessment. Every claim in every file traces to a repository
path. Nothing was invented; unknowns are marked `unknown`.

No application code, configuration, or existing documentation was modified. This
layer is purely additive.

**Conventions used throughout:**

- YAML entries carry `confidence: observed | inferred | unknown`
- Prose uses `[OBSERVED]` / `[INFERRED]` / `[RECOMMENDED]` / `[UNKNOWN]`
- Recommendations are always labelled, never phrased as current state
- Conflicts between existing documents are recorded, not silently resolved

---

## Keeping it true

This layer is accurate as of 2026-08-04. It stays accurate only if changes to the
repository come with changes to these files.
[`CONTEXT_MAINTENANCE.md`](./CONTEXT_MAINTENANCE.md) maps every kind of change to
the files it obliges you to update. Please honour it — a stale context layer is
worse than none, because it is trusted.
