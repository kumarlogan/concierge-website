# What We Refused to Build

> **Phase H deliverable** — A conscious, deliberate catalog of features,
> products, designs, and patterns that the WEF v2 operating system evolution
> **deliberately excludes**, with the reasoning behind each decision.
>
> This document is the "anti-document." Every entry here is a decision, not
> an oversight. If something is missing, assume it was considered and excluded.

## 1. No Separate Worker Product Architecture

**Excluded:** Adding `website.deploy`, `website.rollback`, `website.logs`
as a separate product or service.

**What we did instead:** The 10 AGS website capabilities (`website.*`) route
through the **same** provider framework as every other capability. They are
registration entries in the framework's routing table, not a separate deployable
unit.

**Why:** The AGS website (Concierge) runs on Cloudflare Pages. It has no workers,
no Lambda, no container. The entire stack is `apps/` (frontend) + `workers/` (API)
+ Cloudflare Pages (hosting). Adding a deploy product would create an artificial
operational boundary where none exists. The routing table captures all website
operations in ~50 lines of declarative config. A separate product would require
its own manifest, its own agent roster, its own approval policies, and its own
CI/CD — all to manage the same deploy target.

**Future pivot threshold:** If Concierge ever runs on a multi-platform deploy
(Cloudflare + Vercel + self-hosted), a separate deploy product becomes justified.
Until then, a routing table entry is sufficient.

## 2. No Approval API

**Excluded:** A REST API endpoint for granting/revoking approvals.

**What we did instead:** Approvals flow through the **Admin Console** (the
existing 6-domain UI). The console shows the pending approval card, and the
operator acts through its interface. There is no programmatic approval API.

**Why:** A programmatic approval API means an attacker who compromises a
service token can auto-approve any capability call. The `DurableApproval`
system (Phase C2) is already a powerful trust primitive — exposing it as
an API re-introduces the systemic vulnerability the approval model was
designed to eliminate. Keeping approvals in the Admin Console forces them
through a human-in-the-loop UI that requires operator authentication,
session context, and explicit action.

**Future pivot threshold:** If the platform needs machine-to-machine
approval chains (e.g., "approve if the CI pipeline says green"), build
a policy-based auto-approval system — not an open approval API. The
`ExecutionPolicyEvaluator` in the provider framework is the right
extension point.

## 3. No WebSocket / Real-Time Push

**Excluded:** Using WebSockets, Server-Sent Events, or any push protocol
for the cognitive efficiency tools (Dashboard, Timeline, Decision Log).

**What we did instead:** Poll-driven views with manual refresh triggers.
The observability service already polls at configurable intervals. The
Admin Console workforce view refreshes when the operator requests it.

**Why:** Real-time push adds: authentication on every connection, connection
recovery logic, server-side state tracking (who's connected), and a WebSocket
endpoint that must be secured and ratelimited. The cognitive efficiency tools
answer "what's the state right now?" — not "what's the state right this
millisecond?" An operator checking agent status once every 30 seconds gets
the same information as a WebSocket push, with none of the complexity.
Real-time adds surface area without proportional value.

**Future pivot threshold:** If the platform supports hundreds of human
operators who need instant notifications of failing agents, re-evaluate.
At the current scale (1-3 operators), polling is correct.

## 4. No "Agent Market" or Public Marketplace

**Excluded:** A public-facing marketplace where third parties publish agents
or capabilities that anyone can install.

**What we did instead:** The `DynamicProviderManager` supports provider
discovery and trust admission — but through an **operator-administered**
process. Capabilities are registered by platform operators, not by end users.
The marketplace view shows providers that have passed (or failed) trust
admission, but only operators see it.

**Why:** A public marketplace implies (a) trust is delegated to the
marketplace operator, (b) third-party code runs in the platform's trust
boundary, and (c) the platform's fail-closed guarantees apply to code
the platform didn't write. All three violate the platform's security
model. The `DynamicProviderManager` already handles trust-gated provider
loading — adding a public-facing UI for that process is a product decision,
not an architecture gap. It would not be hard to build, but it is consciously
deferred.

**Future pivot threshold:** If multiple AGS divisions independently adopt
the AI Platform and want to share capabilities, build an **internal**
capability registry first — not a public marketplace. Start with the
internal trust boundary, prove the sharing model works, and only then
consider external contributions.

## 5. No Observability Export Pipeline

**Excluded:** Exporting observability data (agent health, execution traces,
audit events) to an external monitoring stack (Datadog, Grafana, New Relic).

**What we did instead:** Observability data stays in the platform's D1
(`agent_audit_events`, `agent_health`, `agent_metrics` tables). The
cognitive efficiency tools query D1 directly.

**Why:** Every external export adds: (a) a new dependency (the target
service must be available), (b) a new auth secret (API keys, tokens),
(c) a new failure mode (what happens when the export fails), and (d)
ongoing cost (outbound bandwidth, target service pricing). The platform
currently has a single deployment, a handful of agents, and a small
observability footprint. D1 queries complete in under 100ms. An export
pipeline would be a solution in search of a problem. When the agent count
grows beyond 20-30, or when multiple operators need different views into
the same data, revisit.

**Future pivot threshold:** When D1 queries exceed 500ms consistently,
or when an operator requests a view that D1 cannot efficiently produce.
Until then, the in-house cognitive tools are sufficient.

## 6. No Granular Audit Event Retention Policy

**Excluded:** Different retention periods for different audit event types
(e.g., keep execution traces for 90 days, keep approvals forever, purge
health checks after 7 days).

**What we did instead:** One retention policy for all audit events in D1
(platform-level default). The data volume is low enough that selective
retention adds no value.

**Why:** Granular retention policies require: (a) tagging every event with
a retention class, (b) a D1 cleanup job per class, (c) configuration for
each class, and (d) documentation of what's retained when. The platform
currently generates ~100-500 audit events per day (614 test executions
are a batch event). At that volume, a single retention policy covers years
of data in D1's free tier. Adding granular retention adds engineering
complexity without measurable benefit. The right time to implement is when
audit volume exceeds the retention-relevant threshold (e.g., >10K events/day).

**Future pivot threshold:** When monthly audit event volume passes 300K,
or when a compliance requirement mandates different retention periods.
Until then, the single default is sufficient.

## 7. No Approval Delegation / Escalation

**Excluded:** An escalation matrix where an approval request can be routed
from one operator to another, or delegated to a backup approver.

**What we did instead:** One operator owns all approvals. If they are
unavailable, the system denies the capability request (fail-closed).
There is no fallback approver.

**Why:** Approval delegation implies that the platform tracks operator
availability, shift schedules, backup assignments, and escalation timeouts.
This is organizational complexity that the platform is not ready to model —
and that no product requirement demands. The fail-closed default means
a missing approver is a safe state (nothing executes), not an unsafe one
(everything auto-approves). For a concierge scheduling platform where
patient-facing operations are the primary concern, safe-in-the-absence-of-
an-operator is the correct default.

**Future pivot threshold:** When the platform has 5+ operators on different
schedules, or when a compliance audit requires documented backup approvers.
Until then, one operator + fail-closed is correct.

## 8. No "Quick Deploy" Bypass for Approved Operators

**Excluded:** A flag or role that lets "trusted" operators skip the approval
gate for production deploys.

**What we did instead:** Every production capability execution goes through
the full gateway (StackBGatewayGuard + ApprovalRef check). No exceptions.
Not for admins. Not for the platform operator. Not for the developer.

**Why:** An approval bypass for "trusted" operators creates two vulnerabilities:
(a) the bypass is a target — an attacker who compromises a "trusted" account
skips all gates, and (b) the bypass creates a second-class audit trail
("this operator runs without approval, so we don't log the approval step").
The entire WEF v2 model is built on the principle that approval exists for
production, period. A bypass nullifies the principle. If the approval process
is too slow, fix the process — don't create a privileged escape hatch.

**Future pivot threshold:** None. This is a permanent architectural invariant.
All production deploys require approval, regardless of operator identity.

## 9. No Agent Sleep/Wake Schedule

**Excluded:** Cron-based agent scheduling where agents sleep during off-hours
and wake during business hours.

**What we did instead:** Agents are always either active or disabled. There
is no time-based scheduling. Operators manually pause/resume agents when
schedules change.

**Why:** Sleep/wake scheduling adds: (a) a timezone-aware scheduler, (b)
alerting when an agent fails to wake, (c) an edge case where an agent
sleeps mid-execution, and (d) operator confusion about why an agent is
sleeping. The current agent roster is small (3-5 agents). Manual pause/resume
is a 5-second operation. Adding autonomous scheduling before the agent count
justifies it is premature optimization.

**Future pivot threshold:** When the platform manages 20+ agents that need
to respect business-hours-only operation, or when a product requirement
mandates timed execution patterns.

## 10. No Multi-Region / Multi-Cloud

**Excluded:** Running the platform across multiple Cloudflare regions or
across multiple cloud providers (AWS, GCP, Azure).

**What we did instead:** Single-region Cloudflare Workers deployment
(workers.dev + D1).

**Why:** Multi-region adds: (a) D1 replication (not yet GA), (b) cross-region
failover logic, (c) data consistency concerns, and (d) operational cost.
The platform serves a single business domain (AGS Fertility) from a single
location. Multi-region is a cost center, not a value-add, at this stage.
The platform's architecture is cloud-agnostic at the capability contract
level (no vendor SDKs in the core), so migration to another provider is
a deploy-time wiring change. Multi-region is not ruled out — it's just
not the next thing to build.

**Future pivot threshold:** When D1 global replication is GA and the
platform serves multiple regions with latency-sensitive operations.

## 11. No AI/ML Training Pipeline

**Excluded:** A pipeline that collects execution data, agent decisions, and
operator reviews to train a model that auto-approves common capability calls.

**What we did instead:** All decisions are rule-based (approval required
per environment) or human-in-the-loop. No ML component exists anywhere
in the approval, execution, or observability path.

**Why:** ML-based auto-approval introduces: (a) training data curation
(what data is safe to train on?), (b) model drift (what happens when the
model's accuracy drops?), (c) audit complexity (why was this auto-approved?
"the model decided" is not a regulatory answer), and (d) the risk of the
model approving something a human would deny. The platform is not at a
scale where ML approval provides value over rule-based or human-in-the-loop.
Phase 3's "AI-Enhanced Patient Experience" involves AI agents — but they
go through the same approval gates as human operators. There is no "approval
AI" in the roadmap.

**Future pivot threshold:** When the platform processes 500+ capability
executions per day and the operator is the bottleneck. Even then, the
correct solution is policy-based auto-approval (e.g., "auto-approve if
the capability, environment, requester, and time all match a pre-defined
pattern"), not ML. That is a policy extension, not an AI product.

## 12. No Vendor SDK in Core

**Excluded (architectural invariant):** Importing a vendor SDK (Anthropic
SDK, Cloudflare API client, GitHub Octokit) directly into any core
platform module (`hermes/services/activation/`, `hermes/services/execution/`,
`hermes/services/providers/`).

**What we did instead:** Vendor SDKs are wired at deploy time through
`set<Provider>Executor()` functions. The core interacts only with the
`CapabilityExecutor` port (function signature + return type). See the
anti-pattern enforcement in the `claude-code.ts` header comment: "NO
vendor SDK / CLI import here."

**Why:** This is the **most important architectural invariant** in the
entire platform. Vendor SDKs bring vendor-specific types, error handling,
auth flows, and dependency chains into the core. Once a vendor SDK is in
the core, swapping vendors requires: (a) removing the old SDK, (b) adding
the new SDK, (c) changing the core type references, and (d) fixing any
incompatibilities in the vendor's error model. By keeping the core
vendor-SDK-free, provider swaps are a deploy-time wiring change —
not a core code change.

## 13. No "Execute Everything" Admin Console Button

**Excluded:** A button in the Admin Console that runs ALL pending capability
executions at once.

**What we did instead:** Each pending capability has its own approval card.
Operators approve/deny individually. There is no batch approve operation.

**Why:** A "run all" button is a single point of failure. If an operator
intends to approve one capability but accidentally clicks "run all,"
every pending production deploy, rollback, and PR merge goes through.
The approval model is designed for deliberate, per-action authorization.
Batch operations violate this intent. If the number of pending capabilities
grows large enough that individual approval cards are a burden, the correct
fix is to reduce the number of pending capabilities (auto-deny stale ones,
consolidate duplicate ones) — not to add a bypass.

**Future pivot threshold:** None. This is a deliberate anti-pattern enforced
at the UX level.

## 14. Summary: The Refusal Catalog

| Refused Feature | Rationale | Revisit Threshold |
|---|---|---|
| Separate deploy product | Routing table is sufficient | Multi-platform deploy |
| Approval API | Security — would bypass human-in-the-loop | Policy-based auto-approval system |
| Real-time push | Polling is sufficient at current scale | 100+ operator notifications |
| Public marketplace | Trust boundary violation | Internal capability registry proven |
| Observability export | D1 is sufficient at current volume | D1 queries >500ms |
| Granular retention | Volume too low to justify complexity | >300K events/month |
| Approval delegation | Fail-closed is safe default | 5+ operators on different schedules |
| Quick deploy bypass | Violates invariant: all prod needs approval | Never |
| Agent sleep/wake | Manual pause/resume is 5s | 20+ agents needing scheduling |
| Multi-region/cloud | Single-region sufficient | D1 global replication + latency need |
| ML training pipeline | Rule-based + human-in-the-loop sufficient | 500+ executions/day + policy extension |
| Vendor SDK in core | Architectural invariant — always fail-closed | Never |
| Batch approve all | Anti-pattern — violates per-action authorization | Never |

---

*This document is Phase H of the WEF v2 Evolution Blueprint (Phase C).
It is the architecture discipline layer — proving that what is absent is
as intentional as what is present.*