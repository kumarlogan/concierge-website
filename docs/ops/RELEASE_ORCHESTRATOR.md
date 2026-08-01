# Release Orchestrator

## Purpose

The Release Orchestrator is Hermes' runtime coordination layer for the release pipeline. It does NOT deploy directly — it coordinates existing certified components.

**Hermes owns orchestration.**
**GitHub Actions owns deployment.**
**Cloudflare owns infrastructure.**
**Wrangler owns deployment implementation.**

## Architecture

```
Release Orchestrator (Hermes)
    │
    ├──→ GitHub Actions (deployment engine)
    │       ├──→ Preview Deployment
    │       └──→ Production Deployment
    │
    ├──→ Cloudflare (infrastructure)
    │       ├──→ R2 (document storage)
    │       ├──→ D1 (database)
    │       └──→ Workers (compute)
    │
    ├──→ Wrangler (deployment tool)
    │       └──→ Deploy to Cloudflare Workers
    │
    └──→ Verification Layer
            ├──→ Smoke Tests
            ├──→ Health Checks
            ├──→ Accessibility Certification
            └──→ Performance Review
```

## Responsibilities

1. **Release Candidate Management** — Track the commit, tag, and artifact being released
2. **Workflow Triggering** — Initiate GitHub Actions workflow_dispatch for Preview and Production
3. **Monitoring** — Track workflow runs (queued, running, succeeded, failed, cancelled)
4. **Evidence Collection** — Gather deployment evidence from workflow runs
5. **Verification Coordination** — Run smoke tests, health checks, accessibility, performance
6. **PO Review Package Generation** — Produce the review package for Product Owner approval
7. **Production Promotion** — On PO approval, trigger production promotion (identical artifact)
8. **Post-Release** — Generate reports, update dashboard, capture knowledge, close release

## Release Pipeline

```
Release Candidate
    ↓
Trigger Preview Workflow
    ↓
Monitor GitHub Actions
    ↓
Collect Logs + Deployment Evidence
    ↓
Run Smoke Tests + Health Checks
    ↓
Run Accessibility + Performance Certification
    ↓
Generate Product Owner Review Package
    ↓
WAIT FOR PRODUCT OWNER
    ↓
On Approval:
    ↓
Trigger Production Promotion
    ↓
Monitor Production Deployment
    ↓
Verify Production (frontend, API, health, smoke)
    ↓
Update Executive Dashboard
    ↓
Generate Executive Report
    ↓
Knowledge Capture
    ↓
Close Release
```

## Reuses

- Release Gates (from EPIC-013)
- Execution Modes (Dev/Preview/Prod)
- Executive Reports (from Wave 4)
- Verification Gates (from Wave 4)
- Knowledge Capture (from Wave 4)
- Deployment Evidence Model (from Wave 4)
- Executive Dashboard (from Wave 4)
- Operator Experience (from Wave 4)
- Preview Pipeline (from Wave 4)
- Production Pipeline (from Wave 4)

## Foundation Impact

- **Zero** new platform capabilities
- **Zero** new Hermes services
- **Zero** breaking changes
- Reuses all existing certified runtime components
