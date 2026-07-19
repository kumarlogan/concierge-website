# AG Synergy API Worker

> Cloudflare Workers backend for the AG Synergy Platform — Phase 1 Concierge.

## Purpose

This Worker is the **backend API layer** for the AG Synergy Platform. It handles all
API requests from the frontend, enforces business logic, and manages data access.

The frontend (static site) does **not** directly access storage (D1/R2). All data
operations flow through this Worker.

## Architecture

```
Browser / Frontend
       │
       ▼
agsynergy.ca (Cloudflare Pages — static site)
       │
       │  fetch() to api.agsynergy.ca
       ▼
agsynergy-api Worker  ← you are here
       │
       ├── D1  (SQLite database) — coming in EPIC-001-005
       └── R2  (object storage)  — Phase 2+
```

## Local Development

Start the Worker in development mode:

```bash
npx wrangler@4 dev --port 8787
```

**Requirements:** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` must be set
in the environment (even for local development — Wrangler v4 requires authentication).

The Worker will be available at `http://localhost:8787`.

### Verify

```bash
curl http://localhost:8787/api/v1/health
# → {"status":"ok","version":"0.1.0","timestamp":"..."}
```

## Deployment

### Preview (workers.dev subdomain)

```bash
npx wrangler@4 deploy
# Deploys to: https://agsynergy-api.kumarlogan.workers.dev
```

### Production (custom domain: api.agsynergy.ca)

```bash
npx wrangler@4 deploy --env production
# Deploys to: https://api.agsynergy.ca
```

**Requirements:** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` must be set.

### Verify deployment

```bash
curl https://agsynergy-api.kumarlogan.workers.dev/api/v1/health
# → {"status":"ok","version":"0.1.0","timestamp":"..."}
```

## Environment Variables

| Variable | Environment | Purpose |
|---|---|---|
| `ENVIRONMENT` | `production` / `preview` | Indicates deployment environment |

Additional variables (D1 bindings, API keys) will be added in future tasks.

## Project Structure

```
workers/
  src/
    index.ts       — Worker entry point (fetch handler + routing)
    routes/         — Route handlers (placeholder)
    services/       — Business logic (placeholder)
    middleware/      — Request/response middleware (placeholder)
    types/          — Shared TypeScript types (placeholder)
  wrangler.jsonc    — Wrangler configuration
  package.json      — Dependencies and scripts
  tsconfig.json     — TypeScript configuration
  README.md         — This file
```

## Notes

- **Epic 1 status:** Backend Foundation — EPIC-001-002 complete.
- **D1/R2 integration** comes in later tasks (EPIC-001-005 through EPIC-001-007).
- **Authentication** arrives in Phase 2. No auth in Phase 1.
- **No business logic yet** — current Worker is scaffolding only.