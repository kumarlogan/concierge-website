# CONTEXT_MAINTENANCE.md

**The update contract for `docs/context/`.**

Generated 2026-08-04 by an external AI engineering session.

This context layer describes the repository accurately as of the date above. It
will stay accurate only if changes to the repository are accompanied by changes
to these files. This document defines that obligation precisely enough to be
followed without judgement calls.

The failure mode this prevents is already visible elsewhere in this repository:
514 markdown files, of which a substantial share describe a state the code left
behind. The context layer must not become the 515th.

---

## 1. The rule

> **If your change makes a statement in `docs/context/` untrue, fix it in the same
> commit.**

Not a follow-up commit. Not a TODO. The same commit — because a context file that
is wrong for even a day can misdirect a parallel session.

---

## 2. Change type → files to update

| If you change… | Update | What specifically |
|---|---|---|
| A Cloudflare binding, worker, route domain, or `wrangler.jsonc` | `ARCHITECTURE.yaml`, `PROJECT_STATE.yaml` | `bindings:`, `runtime_topology:`, `deployed_state:` |
| An HTTP endpoint (add/remove/change auth) | `ARCHITECTURE.yaml` | `auth_model:` if the auth path changed; endpoint counts in `PROJECT_STATE.yaml.scale` |
| A platform subsystem's maturity — wiring it to a route, adding persistence, enabling a flag | `ARCHITECTURE.yaml`, `PROJECT_STATE.yaml` | `platform_subsystems:` entry (`maturity`, `http_exposed`, `persistence`); the matching `capabilities:` bucket |
| A database migration | `ARCHITECTURE.yaml`, `ENGINEERING_GUIDE.md` | `data_layer:` counts; the next-migration convention if numbering changed |
| A build, test, or CI/CD step | `ENGINEERING_GUIDE.md`, `ARCHITECTURE.yaml` | Commands table; `build_and_deploy:`, `testing:` |
| The frontend stack, routing, or auth storage | `ARCHITECTURE.yaml`, `ENGINEERING_GUIDE.md` | `frontend:`; the frontend section |
| A path alias, package, or dependency direction | `ARCHITECTURE.yaml`, `ENGINEERING_GUIDE.md` | `dependency_direction:`, `code_areas:` |
| Anything that closes a known gap | `KNOWN_GAPS.yaml` | Remove the entry, or set it to resolved with the resolving commit |
| Anything that reveals a new gap | `KNOWN_GAPS.yaml` | Add an entry with the next free `GAP-NNN` id |
| An architectural decision | `docs/adr/`, `DECISION_LOG.md` | New ADR; a row in the index |
| Roadmap, wave, or phase status | `ROADMAP.yaml` | The `waves:` or `phases:` entry, with evidence |
| What you are working on | `CURRENT_WORK.yaml` | `active_streams:`, `open_pull_requests:` |
| Adding or superseding a document | `DOCUMENT_INDEX.md` | Add the row; set authority; update the superseded document's row |
| Introducing a new term or acronym | `GLOSSARY.md` | Define it with an evidence path |

---

## 3. File-by-file ownership and volatility

| File | Volatility | Re-derive when |
|---|---|---|
| `PROJECT_STATE.yaml` | Medium | Capability status changes, or quarterly |
| `ARCHITECTURE.yaml` | Medium | Any structural change to code, bindings, or persistence |
| `KNOWN_GAPS.yaml` | High | Every gap opened or closed |
| `CURRENT_WORK.yaml` | **Very high — assume stale** | Every session; see §4 |
| `ROADMAP.yaml` | Medium | Wave or phase transitions |
| `DECISION_LOG.md` | Low | Each new ADR |
| `DOCUMENT_INDEX.md` | Medium | Documents added, retired, or superseded |
| `ENGINEERING_GUIDE.md` | Low | Tooling, commands, or conventions change |
| `GLOSSARY.md` | Low | New terminology appears |
| `AI_COLLABORATION.md` | Low | The collaboration model itself changes |
| `CONTEXT_MAINTENANCE.md` | Low | This contract changes |

---

## 4. Re-deriving `CURRENT_WORK.yaml`

This file is a snapshot and is expected to be stale. Do not trust its `as_of`
date without checking. To rebuild it:

1. List recent commits on `main` (last ~30) — establishes the active stream.
2. List open pull requests — establishes what is proposed but unmerged.
3. List non-`main` branches with last-activity dates — establishes parked work.
4. Confirm the GitHub Issues count (historically 0; work is tracked in markdown).
5. Rewrite `active_streams:`, `open_pull_requests:`, `branches:`, and `as_of:`.

If the `as_of` date is more than about two weeks old, re-derive before relying on
it.

---

## 5. Standards for writing into this layer

**Evidence or nothing.** Every factual claim cites a repository path. If you
cannot cite it, mark it `unknown` and state what would resolve it.

**Confidence is explicit.** YAML entries carry `confidence: observed | inferred |
unknown`. Prose uses `[OBSERVED]` / `[INFERRED]` / `[RECOMMENDED]` / `[UNKNOWN]`.

**Recommendations are labelled.** A recommendation must never be phrased so it
reads as a description of current state. This is the most common way a context
layer becomes a lie.

**Record conflicts; do not silently resolve them.** Where two documents disagree,
the context layer names both and designates one authoritative, with reasoning. It
does not quietly pick a side.

**Preserve history.** Nothing in this repository is deleted to make the context
layer tidier. Superseded documents get a pointer, not a gravestone.

**YAML must parse.** Before committing a `.yaml` change:

```bash
python3 -c "import yaml,glob,sys; [yaml.safe_load(open(f)) for f in glob.glob('docs/context/*.yaml')]" && echo OK
```

---

## 6. Periodic reconciliation `[RECOMMENDED]`

A full re-verification of the context layer against the code — the exercise that
produced it — is worth repeating roughly quarterly, or after any wave completes.
The method is recorded in `docs/engineering/reports/REPOSITORY_DISCOVERY_REPORT.md`
so it can be reproduced by any provider.

A lighter weekly check: confirm `CURRENT_WORK.yaml` still reflects reality, and
confirm no `KNOWN_GAPS.yaml` entry has been silently fixed without being closed.

---

## 7. If you cannot meet this contract

If a change is urgent and you genuinely cannot update the context layer in the
same commit, add a dated entry under a `pending_context_updates:` key in
`CURRENT_WORK.yaml` describing what is now out of date. An acknowledged gap is
recoverable; a silent one is not.
