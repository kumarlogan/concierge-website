# AI Session Management

> Version 1.0 | 2026-07-18
>
> Defines how Hermes and future AI agents manage long-running engineering
> sessions efficiently. Establishes session continuity rules for the AG Synergy
> Platform engineering workflow.

---

## 1. Purpose

AI agents — including Hermes — operate within **temporary chat sessions**.
Context windows are finite. Sessions end. Conversations are not durable.
Without deliberate session management, continuity is lost every time a session
closes or context pressure forces a reset.

The **repository documentation** is the permanent record. When an AI session
begins, it loads project documentation to reconstruct context. When a session
ends, it writes its state back to the repository so the next session can continue
without repeating work or losing decisions.

### The Core Principle

> **AI context is temporary. Repository documentation is permanent.**

The goal is maintaining engineering continuity **without depending on chat
history**. A new session starting from scratch — with no memory of prior
conversations — must be able to pick up exactly where the last session left off
by reading the repository.

This applies to:

- Multi-session epics spanning days or weeks
- Handoffs between different AI models or providers
- Session resets forced by context pressure
- Human engineers reviewing AI-assisted work
- Future AI agents that did not participate in earlier sessions

---

## 2. Session Initialization

At the beginning of every significant engineering session, Hermes must review
the authoritative project documentation to reconstruct the current state.

### Required Reading (in order)

| # | Document | What It Provides |
|---|---|---|
| 1 | [`PROJECT.md`](../PROJECT.md) | Project constitution — vision, principles, technology philosophy, operating rules. Establishes the highest-level constraints. |
| 2 | [`AI_OPERATING_MODEL.md`](../AI_OPERATING_MODEL.md) | AI agent roles, authority boundaries, collaboration workflow. Defines what Hermes can and cannot do without human approval. |
| 3 | [`PRODUCT_BOUNDARIES.md`](../PRODUCT_BOUNDARIES.md) | Product scope, core services, healthcare provider responsibilities, AI prohibitions, phase boundaries, patient data principles. |
| 4 | [`ARCHITECTURE.md`](../ARCHITECTURE.md) | Complete system architecture — component map, data flow, security boundaries, technology stack, Phase 1 scope. |
| 5 | [`CURRENT_SPRINT.md`](../CURRENT_SPRINT.md) | Active sprint goal, objectives, task progress, blockers, risks. **The single most important file for knowing what to work on.** |
| 6 | [`TASKS.md`](../TASKS.md) | Full task registry with priorities, status, and dependencies. Provides the granular "what's next." |
| 7 | [`DECISIONS.md`](../DECISIONS.md) | ADR index — all architectural decisions made. Prevents re-litigating settled questions. |

### Session Initialization Checklist

```
[ ] PROJECT.md reviewed — understand vision and constraints
[ ] AI_OPERATING_MODEL.md reviewed — understand authority boundaries
[ ] PRODUCT_BOUNDARIES.md reviewed — understand scope limits
[ ] ARCHITECTURE.md reviewed — understand system design
[ ] CURRENT_SPRINT.md reviewed — know the sprint goal and status
[ ] TASKS.md reviewed — know which task is next
[ ] DECISIONS.md reviewed — know past architectural decisions
[ ] docs/operations/SESSION_HANDOFF.md reviewed (if exists) — pick up from last session
```

If any of these documents are stale or missing, Hermes should **flag the gap**
before beginning work. Working from stale documentation is worse than working
from no documentation — it creates false confidence and contradictory decisions.

---

## 3. Active Session Management

During active work, Hermes must maintain awareness of the engineering context.
This is not about memorizing conversation history — it is about tracking the
**structured state** that the next session will need.

### State to Track During a Session

| Element | Where It Lives | How It Changes |
|---|---|---|
| **Current objective** | `CURRENT_SPRINT.md` — Sprint Goal | Stable for the sprint; may refine as tasks clarify |
| **Current sprint** | `CURRENT_SPRINT.md` — Sprint ID + dates | Fixed for the sprint duration |
| **Completed tasks** | `TASKS.md` — Status column | Updated as each task reaches Definition of Done |
| **Pending tasks** | `TASKS.md` — Status column | Depletes as work progresses; new tasks added if scope changes |
| **Architectural decisions** | `docs/decisions/ADR-NNN-*.md` | New ADRs created when significant decisions are made |
| **Risks** | `CURRENT_SPRINT.md` — Blockers & Risks | Updated as risks materialize, are mitigated, or are retired |
| **Active PRs / branches** | `CURRENT_SPRINT.md` or task notes | Referenced so the next session can continue or review |

### Updating State

Hermes must update the repository as it works, not at the end. Key moments to
write state:

| Trigger | Action |
|---|---|
| Task starts | Update `TASKS.md` — mark task `🚧 In Progress` |
| Task completes | Update `TASKS.md` — mark task `✅ Done`; update `CURRENT_SPRINT.md` progress |
| Decision made | Create ADR in `docs/decisions/`; update `DECISIONS.md` index |
| Blocker found | Update `CURRENT_SPRINT.md` — add to Blockers & Risks |
| Sprint completes | Update `CURRENT_SPRINT.md` — mark closed; add retrospective; update `ROADMAP.md` |
| Documentation changes | Update the affected document immediately — not as a follow-up task |

**Do not defer state updates.** An unrecorded task completion is a task the next
session will redo. An unrecorded decision is a decision the next session will
re-litigate.

---

## 4. Context Pressure Management

AI context windows are finite. As a session grows, response quality, speed, and
accuracy degrade. Sessions must be prepared to hand off **before** context
pressure becomes a problem, not after.

### Indicators That a Handoff Is Needed

| Indicator | Description |
|---|---|
| **Long conversations** | Session has accumulated extensive back-and-forth. The AI is spending more tokens on conversation history than on the current task. |
| **Large implementation tasks** | A task involves many files, complex logic, or multi-step workflows. The session may not have room for both the full implementation and the full conversation leading up to it. |
| **Reduced response efficiency** | The AI takes longer to respond, repeats itself, loses track of earlier decisions, or requires re-prompting for context that was already established. |
| **Major milestone completion** | A sprint, epic, or significant phase has been completed. This is a natural break point — write the handoff, close the session, start fresh for the next milestone. |
| **Provider or model change** | Switching between AI providers or models may lose conversational context. A handoff note ensures continuity regardless of which model picks up the work. |

### Response to Context Pressure

When context pressure is detected:

1. **Complete the current atomic unit of work** — finish the task, merge the PR, or reach a clean stopping point. Do not leave work half-done.
2. **Update all repository state** — tasks, sprint progress, ADRs, documentation. The repository must be current.
3. **Generate `SESSION_HANDOFF.md`** — capture everything the next session needs (see §5).
4. **Announce the handoff** — in the current session, state that a handoff has been written and the session is ready to close.
5. **Start a fresh session** — the new session reads the handoff and continues.

### When NOT to Hand Off

Do not hand off in the middle of:

- A partially completed task with uncommitted code
- An in-progress PR that has not been reviewed or merged
- An architectural decision that has been discussed but not recorded as an ADR
- A debugging session where the root cause has not been identified
- A deployment that has not been verified

A handoff should capture **completed state**, not **work-in-progress chaos**.
If the session must end mid-task, write a handoff clearly marked as
`STATUS: INCOMPLETE — DO NOT CONTINUE WITHOUT REVIEW`.

---

## 5. Session Handoff Format

When a session prepares to hand off, it writes `docs/operations/SESSION_HANDOFF.md`.
This file is the bridge between sessions — the next session reads it first,
before any other document.

### Location

```
docs/operations/SESSION_HANDOFF.md
```

This is a **single file overwritten on each handoff**. It is not versioned
(though it lives in the repository for accessibility). Only the most recent
handoff is relevant — a new session should never load a stale handoff.

For persistent handoff history, see the planned `/handoff` command (§6), which
will archive handoffs with timestamps.

### Structure

```markdown
# Session Handoff

> Generated: YYYY-MM-DD HH:MM UTC
> Sprint: EPIC-XXX
> Session Context: [Brief description of what this session worked on]

---

## 1. Completed

- [List of tasks completed in this session]
- [Each with task ID and brief outcome]
- [Include links to merged PRs, deployed changes]

## 2. Current State

- **Active branch:** `branch-name`
- **Open PR(s):** `#NN` — [description]
- **Deployed version:** [version or commit hash]
- **Database state:** [migrations applied, schema version]

## 3. Pending Work

- [ ] EPIC-001-00X — [task description] — **Next task to start**
- [ ] EPIC-001-00Y — [task description] — Blocked by [reason]
- [ ] [Any other pending items]

## 4. Important Decisions

- [Decision made this session and its rationale]
- [ADR reference if one was created]
- [Any deviation from the original plan and why]

## 5. Known Issues

- [Bugs, limitations, or edge cases discovered]
- [Workarounds applied]
- [Issues that need attention but weren't blocking]

## 6. Next Recommended Action

[1-3 sentences describing exactly what the next session should do first.
Be specific: which task, which file, which command. Do not make the next
session guess.]

---

*End of handoff. Next session: read PROJECT.md, ARCHITECTURE.md, CURRENT_SPRINT.md,
and this file.*
```

### Handoff Quality Rules

- **Be specific.** "Continue Epic 1 work" is useless. "Start EPIC-001-001: run `npm create cloudflare@latest` in `workers/` directory" is useful.
- **Reference by ID.** Use task IDs (EPIC-001-004), PR numbers (#12), file paths (`workers/src/index.ts`). The next session must be able to navigate without guessing.
- **Explain deviations.** If the session did something not in the sprint plan, explain why. The next session should not reverse a deliberate decision.
- **Mark blockers clearly.** If something is blocked, say what is blocking it and who can unblock it. The next session should not waste time rediscovering the blocker.
- **Keep it concise.** The handoff is a map, not a novel. The next session will load the full documentation — the handoff just tells it where to start.

---

## 6. Future Commands

The following Telegram commands are planned for direct Hermes session management.
These are **not yet implemented**. They are documented here so that:

- Hermes knows the intended interface when implementation begins
- The engineering team understands the planned workflow
- Session management behavior is consistent with the future command surface

### `/status`

```
/status
```

**Purpose:** Report current project state.

**Response includes:**

- Active sprint (ID, goal, progress percentage)
- Completed tasks this sprint
- Pending tasks (next 3 by priority)
- Open PRs
- Current blockers
- Context window usage estimate (if available)

**Use when:** Starting a session to orient quickly; mid-session to confirm
you're on track; after completing a task to see what's next.

---

### `/handoff`

```
/handoff
```

**Purpose:** Create a structured session summary and save state.

**Behavior:**

1. Generates `docs/operations/SESSION_HANDOFF.md` using the format in §5
2. Archives a timestamped copy at `docs/operations/handoffs/YYYY-MM-DD-HHMM.md`
3. Updates all task statuses in `TASKS.md`
4. Updates `CURRENT_SPRINT.md` progress
5. Reports: "Handoff saved. Session ready to close."

**Use when:** Context pressure is detected (§4); completing a major milestone;
ending a work session; preparing for a model/provider change.

---

### `/new`

```
/new
```

**Purpose:** Start a clean session after saving current state.

**Behavior:**

1. Automatically runs `/handoff` to save current state
2. Clears the session context
3. Confirms: "New session started. Previous state saved to SESSION_HANDOFF.md."

**Use when:** Context pressure is high; finishing a sprint; switching to
unrelated work; any time a fresh context window would improve efficiency.

---

### `/resume`

```
/resume [handoff-file]
```

**Purpose:** Load the latest handoff context and resume work.

**Behavior:**

1. Loads `docs/operations/SESSION_HANDOFF.md` (or specified archived handoff)
2. Loads the standard initialization documents (§2)
3. Summarizes: "Resuming EPIC-001. 5/9 tasks complete. Next: EPIC-001-004."
4. Session proceeds with full context of where work left off

**Use when:** Starting any new engineering session; continuing work after a
`/new`; picking up work that was handed off by a different session.

---

### Command Workflow

```
Session Start
    │
    ▼
/resume ─── Loads handoff + project docs
    │
    ▼
Active Work ─── /status (as needed)
    │
    ▼
Context Pressure or Milestone
    │
    ▼
/handoff ─── Saves state
    │
    ▼
/new ─── Clears context
    │
    ▼
(Next session)
    │
    ▼
/resume ─── Continues
```

---

## 7. Principles

These principles govern all AI session management decisions. When a specific
situation is not covered by the procedures above, these principles provide the
default answer.

### 1. The Repository Is the Source of Truth

The repository documentation — not chat history, not AI memory, not a Hermes
plugin — is the single authoritative record of the project's state.

If it is not in the repository, it does not exist for the next session. Every
decision, every task completion, every architectural choice must be written to
a repository file that the next session will read.

### 2. Chat History Is Temporary

Conversation history is a working tool, not a permanent record. It survives only
as long as the session survives. Relying on chat history for continuity is
relying on something that will disappear.

Treat chat history as disposable. Write everything that matters to the repository.

### 3. Documentation Must Survive AI Changes

The AI model, provider, or agent used in the next session may be different from
the current one. Documentation must be **model-agnostic and provider-agnostic**:

- Write in plain, structured Markdown — not in model-specific formats
- Use file paths and task IDs, not conversational references ("the thing we
  discussed earlier")
- Assume the next AI has no memory of this conversation
- Assume the next AI may have different capabilities, strengths, and weaknesses

### 4. Human Approval Remains Required

AI session management automates context continuity — it does not automate
decision-making authority. The boundaries defined in `AI_OPERATING_MODEL.md` §3
remain in effect:

- Production deployments require human confirmation
- Database migrations against production data require human confirmation
- Security-sensitive changes require human confirmation
- Financial commitments require human confirmation

Session management makes it **easier for humans to approve** by providing clear,
current state. It does not reduce the requirement for approval.

### 5. Handoffs Are a Courtesy to Future Sessions

Every handoff is written for an AI agent that does not exist yet. That agent
has no context, no memory, and no obligation to trust what this session wrote.
The handoff must be:

- **Complete** — all necessary context is included or referenced
- **Honest** — does not claim completion for incomplete work
- **Actionable** — the next session can act on it immediately
- **Verifiable** — the next session can confirm the stated state against the repository

A bad handoff is worse than no handoff. A handoff that claims a task is complete
when it is not will cause the next session to skip necessary work. A handoff
that omits a critical decision will cause the next session to re-litigate it.
When in doubt, err on the side of **too much detail** and **explicit verification
instructions**.

### 6. Session Continuity Serves Delivery

Session management exists to keep engineering work moving forward. It is a means,
not an end. If session management procedures become burdensome — if they take more
time than the work they support — they should be simplified.

The test of good session management: a new session starts, reads the handoff,
and begins productive work within **2 minutes**. If it takes longer, the handoff
is insufficient or the repository documentation is stale.

---

## Appendix A: Handoff Triggers Reference

| Trigger | Action | Urgency |
|---|---|---|
| Sprint milestone reached | `/handoff` → `/new` | Required — natural break point |
| Task completed (last in session) | Update TASKS.md | Required |
| ADR written | Update DECISIONS.md | Required |
| Session approaching context limits | Complete current unit → `/handoff` → `/new` | High |
| Switching to unrelated work | `/handoff` → `/new` | Recommended |
| End of workday / work session | `/handoff` | Recommended |
| Provider or model change | `/handoff` → `/new` | Required |
| Deployment completed | Update CURRENT_SPRINT.md | Required |
| Blocker encountered | Update CURRENT_SPRINT.md Blockers | Required |

## Appendix B: Related Documents

| Document | Relationship |
|---|---|
| [`PROJECT.md`](../PROJECT.md) §7 | Hermes AI Operating Philosophy — defines Hermes's operational domains and authority boundaries |
| [`PROJECT.md`](../PROJECT.md) §11 | Documentation Policy — documentation is the single source of truth |
| [`AI_OPERATING_MODEL.md`](../AI_OPERATING_MODEL.md) §3 | Authority Boundaries — human approval requirements |
| [`ROADMAP.md`](../ROADMAP.md) | Future Capabilities: AI Session Management — planned commands |
| [`ARCHITECTURE.md`](../ARCHITECTURE.md) §7 | Hermes Integration Architecture — Hermes's role in the system |

---

*End of AI Session Management. Version 1.0, ratified 2026-07-18.*