# AI_COLLABORATION.md

**How AI engineering sessions work in this repository.**

Generated 2026-08-04 by an external AI engineering session. This document is
written primarily for a machine reader — an AI agent starting a session on this
codebase with no prior conversation history — and secondarily for the humans
directing them.

---

## 1. The premise

This repository is the shared memory. Conversations carry intent; the repository
carries knowledge. If a fact only exists in a chat log, it is lost.

The practical consequence: **a session should be startable with a short intent
prompt.** Something like *"Fix GAP-003"* or *"Add an endpoint for X, following the
route conventions"* should be sufficient, because everything needed to act on it
is in `docs/context/`.

That works only if the context layer stays true. Section 5 is not optional
etiquette — it is the mechanism that keeps this property alive.

---

## 2. Session start protocol

Read these, in this order, before touching anything:

| # | File | Why |
|---|---|---|
| 1 | `docs/context/PROJECT_STATE.yaml` | What this is, what is deployed, what actually works. |
| 2 | `docs/context/KNOWN_GAPS.yaml` | What is already known to be broken. Do not rediscover it. |
| 3 | `docs/context/CURRENT_WORK.yaml` | What is in flight right now, and what not to collide with. |
| 4 | `docs/context/ARCHITECTURE.yaml` | The system as built. |
| 5 | `docs/context/ENGINEERING_GUIDE.md` | How to actually make a change here. |

Then, as needed for the specific task:

- `DOCUMENT_INDEX.md` — before reading any other markdown in the repository. It
  tells you which documents are current and which are historical records.
- `DECISION_LOG.md` — before changing anything architectural.
- `GLOSSARY.md` — when you hit an unfamiliar acronym. There are many.
- `ROADMAP.yaml` — before proposing new work.

**Reading `docs/context/` first is cheaper than exploring the repository.** There
are 514 markdown files here. Undirected exploration will find superseded documents
and act on them; that failure mode is the reason this layer exists.

---

## 3. Rules that prevent the most common failures

These are derived from actual conditions found in this repository, not general
best practice.

**Do not trust a document because it sounds current.**
Roughly half the root markdown files are point-in-time reports that read like
current-state documents. `DOCUMENT_INDEX.md` marks each one `AUTHORITATIVE`,
`HISTORICAL`, `SUPERSEDED`, or `UNCERTAIN`. Check before relying on one.

**Do not assume documented capability is running capability.**
The platform track is extensively documented and largely dormant — 11 feature
flags default to `false` and the EPCL → WAS → WEF pipeline has no reachable route.
`ARCHITECTURE.yaml` gives each subsystem a `maturity` and an `http_exposed` flag.
Trust those over prose.

**Do not assume an endpoint persists its data.**
Several subsystems use in-memory singletons that look like storage and are not.
Check `persistence` in `ARCHITECTURE.yaml` before building on one.

**Do not delete documentation.**
Historical records are retained deliberately. If a document is wrong, mark it —
add a header pointing to the current source — rather than removing it.

**Do not renumber existing ADRs or migrations.**
Both namespaces already have collisions. They are recorded in `KNOWN_GAPS.yaml`
(GAP-011, GAP-017) with forward-only conventions. Fix going forward, not backward.

**Verify before you deploy.**
Every push to `main` deploys to production with no test or typecheck gate
(GAP-004). Run the suite and the typecheck yourself. The pipeline will not catch
you.

**Prefer updating authoritative documentation over writing a long chat response.**
If you discover something durable, it belongs in the repository.

---

## 4. Scope discipline

State clearly, in your output, which category each statement falls into:

- **Observed** — you read it in a repository file. Cite the path.
- **Inferred** — you reasoned it from repository evidence. Show the reasoning.
- **Recommended** — you think it should be done. Mark it; never let a
  recommendation read as a description of current state.

Machine-readable context files carry this as a `confidence:` field. Prose files
use `[OBSERVED]` / `[INFERRED]` / `[RECOMMENDED]` / `[UNKNOWN]` tags.

Where something cannot be determined from the repository, write `unknown` and say
what would resolve it. **Do not fill gaps with plausible content.** A confident
invention is worse than an acknowledged gap, because the next session will build
on it.

---

## 5. Session end protocol — the maintenance obligation

A session that changes the repository and leaves the context layer untouched has
degraded it. Before finishing:

1. Consult `CONTEXT_MAINTENANCE.md` for the change-type → file-to-update mapping.
2. Update the affected context files in the same commit as the code change.
3. If you closed a gap, remove or amend its entry in `KNOWN_GAPS.yaml`.
4. If you found a new gap, add one, with the next free `GAP-NNN` id.
5. If you made an architectural decision, add an ADR and index it in
   `DECISION_LOG.md`.
6. Refresh `CURRENT_WORK.yaml` if what is in flight has changed.

`CURRENT_WORK.yaml` is the one file guaranteed to go stale — it is a snapshot. It
carries instructions for re-deriving itself from commit history and open PRs.

---

## 6. Multi-provider expectations

This repository is intended to be worked by several AI providers and future
engineering vendors. The context layer is the contract between them.

- **Provider-neutral.** Nothing in `docs/context/` assumes a particular agent
  platform, tool surface, or vendor.
- **Repository-anchored.** Every claim is traceable to a repository path, so any
  provider can verify it independently rather than trusting a predecessor.
- **Concurrency-aware.** Trunk-based development with ~98% direct-to-main commits
  means parallel sessions collide easily. Check `CURRENT_WORK.yaml` before
  starting, and prefer a branch when work will span more than one sitting.

---

## 7. What a good session looks like

Small intent prompt in. Context layer read. Change made, verified locally against
the test suite and typecheck. Context files updated in the same commit. Findings
recorded in the repository rather than in the conversation.

The measure of success is that the *next* session — possibly a different model,
on a different platform, months later — can pick up from the repository alone.
