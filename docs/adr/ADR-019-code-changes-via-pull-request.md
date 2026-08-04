# ADR-019: Code changes land via pull request until a CI gate exists

- **Status:** Accepted
- **Date:** 2026-08-04
- **Deciders:** External engineering workforce (documented for review)
- **Supersedes:** nothing
- **Related:** PRG-002 / GAP-004, ADR-015 (governance freeze)

## Context

`.github/workflows/deploy.yml` triggers on every push to `main` and deploys
both Cloudflare Workers — `agsynergy-api` and `hermes-website` — straight to
production. It runs three integrity checks and a production-bundle guard, but
it does **not** run the test suite and does **not** typecheck.

`main` is therefore not a branch. It is a deploy button.

That is tolerable for documentation commits. It is not tolerable for
application code on a platform that serves real fertility patients and holds
their health information, particularly when the repository carries a
documented baseline of pre-existing TypeScript errors (EPIC-015) and the
external engineering environment cannot install dependencies — no npm registry
access means no local `tsc`, no local `vitest`.

The combination is the problem: code that nothing verifies, deployed by the act
of committing it.

## Decision

**Application code changes are delivered on a branch and merged via pull
request. Only documentation may be committed directly to `main`.**

This holds until the CI gate proposed in
`docs/engineering/proposed-workflows/ci.yml` is installed and marked as a
required status check on `main`. Once CI verifies every push, the trunk-based
workflow the team prefers becomes safe again and this ADR can be revisited.

## Consequences

**Positive**

- Untested code cannot reach patients by accident.
- Changes become reviewable artifacts rather than silent deploys.
- Once CI is installed, the PR becomes the verification environment that the
  authoring environment cannot provide.

**Negative**

- Slower than direct commits, and the team's established practice is
  trunk-based with roughly 98% of commits going straight to `main`. This ADR
  deliberately diverges from that practice for code, and only for code.
- A PR that no one reviews is only marginally safer than a direct commit. The
  value depends on CI landing.

**Neutral**

- Documentation commits continue to go direct to `main`, since a docs deploy is
  a no-op rebuild of unchanged workers.

## Implementation note — a constraint worth recording

The external engineering integration **cannot install the CI workflow itself**.
It lacks the GitHub App `workflows` permission and receives
`403 Resource not accessible by integration` on any write under
`.github/workflows/`. All other repository paths are writable.

The workflow is therefore staged at
`docs/engineering/proposed-workflows/ci.yml` with installation instructions,
and a human must perform a one-line `git mv` to activate it.

Until that happens, this ADR's protection is procedural rather than enforced —
the pull request exists, but nothing checks it. **Installing the CI gate is the
single highest-leverage action available in this repository.**

## Alternatives considered

**Commit directly to `main` as previously authorised.** Rejected: the earlier
authorisation was given for documentation, and applying it to unverified
application code on a live patient platform would be a misreading of intent
rather than a faithful execution of it.

**Add the test gate to `deploy.yml` instead of a separate workflow.** Rejected:
`deploy.yml` cannot be modified either — same permission limit — and a gate
inside the deploy job would still let the job start. A separate PR-time
workflow catches problems earlier and keeps deploy concerns separate from
verification concerns.

**Disable auto-deploy on `main`.** Rejected as out of scope: it changes the
team's release model, which the engagement guardrails place off limits without
review. Recorded here as an option the team may wish to consider separately.
