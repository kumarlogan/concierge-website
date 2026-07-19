# Operations

> Runbooks, deployment guides, testing setup, and AI session management for the AG Synergy Platform.

## Contents

| Document | Purpose |
|---|---|
| [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) | **Start here.** Concise operational overview — current phase, capabilities, infrastructure, limitations, next epic, quick links |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Cloudflare Workers + D1 deployment runbook — deploy, rollback, secrets, troubleshooting |
| [`TESTING.md`](./TESTING.md) | Backend testing foundation — 74 tests, Vitest + Workers pool, coverage targets |
| [`AI_SESSION_MANAGEMENT.md`](./AI_SESSION_MANAGEMENT.md) | How Hermes and AI agents manage long-running engineering sessions — initialization, context pressure, handoff format |
| [`SESSION_HANDOFF.md`](./SESSION_HANDOFF.md) | Active session handoff state — written before session close, read on `/resume` |
| *(monitoring & alerting)* | Planned — health checks, error alerting, uptime monitoring |
| *(incident response)* | Planned — rollback procedures, incident classification |
| *(backup & recovery)* | Planned — D1 backup strategy, R2 data retention |

## Quick Reference

### Deploy

```bash
cd workers && wrangler deploy --env production
```

### Run Tests

```bash
cd workers && pnpm test
```

### Health Check

```bash
curl https://agsynergy-api.kumarlogan.workers.dev/api/v1/health
```

### Session Handoff

The active session handoff lives at [`SESSION_HANDOFF.md`](./SESSION_HANDOFF.md).
It is written by Hermes before closing a session and read by the next session on
`/resume`.

### Related Documents

- [`../CURRENT_SPRINT.md`](../CURRENT_SPRINT.md) — Active sprint tracking
- [`../TASKS.md`](../TASKS.md) — Task registry with status and dependencies
- [`../DECISIONS.md`](../DECISIONS.md) — ADR index