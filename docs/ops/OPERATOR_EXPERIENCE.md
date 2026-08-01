# Operator Experience — Single-Command Preview Execution

**EPIC-013 — Product Owner Review & Release Gates**
**Phase E: Operator Experience**
**Date**: 2026-08-01
**Product**: Hermes Platform (reusable by every future Hermes product)
**Hermes Runtime**: v1.0 (Foundation frozen)

---

## Executive Summary

The operator needs only one command to execute a full Preview deployment cycle. Hermes performs everything automatically — from build through certification, review package generation, and approval waiting — until the Product Owner makes a decision. After approval, Hermes promotes the current Preview to Production without rebuilding.

---

## The Single Command

```
Execute AG Synergy Wave X in Preview Mode
```

### What Happens Automatically

1. **Build** — Frontend + API Worker
2. **Typecheck** — All TypeScript
3. **Test** — Full test suite
4. **Verify** — Import integrity, required files, deployment config
5. **Deploy Preview** — Push to Cloudflare Workers preview environment
6. **Smoke Test** — Verify preview API and frontend are healthy
7. **Certify** — Browser compatibility, UX, accessibility checks
8. **Generate Review Package** — `PRODUCT_OWNER_REVIEW_PACKAGE.md` auto-populated with real data
9. **Notify PO** — Alert the Product Owner for review
10. **Wait for Approval** — Block until PO decides
11. **Promote to Production** (on approval) — Deploy same commit to production
12. **Close Release** — Release notes, knowledge capture, executive report

---

## Command Reference

### Execute Preview Mode

```
Execute AG Synergy Wave X in Preview Mode
```

**Parameters**:
- `Wave X` — The wave number (e.g., Wave 4)

**Behavior**:
1. Validates current working tree is clean (or commits pending changes)
2. Runs the full Preview pipeline (steps 1–10 above)
3. Produces `PRODUCT_OWNER_REVIEW_PACKAGE.md`
4. Sends notification to Product Owner
5. Waits for PO approval
6. On approval, triggers Production deployment (same commit, no rebuild)
7. On rejection, returns to development with PO feedback

### Approve Preview for Production

```
Approve Wave X Preview for Production
```

**Behavior**:
1. Records PO approval with timestamp
2. Promotes current Preview commit to Production
3. Runs production smoke tests
4. Generates Release Notes, Knowledge Capture, Executive Report
5. Marks wave as RELEASED

### Reject Preview

```
Reject Wave X Preview — [reason]
```

**Behavior**:
1. Records PO rejection with reason
2. Returns to development phase
3. Engineering addresses feedback
4. Re-runs Preview pipeline

---

## Automation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Operator: "Execute AG Synergy Wave X in Preview Mode"         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Build (Frontend + API Worker)                         │
│  Step 2: Typecheck all TypeScript                              │
│  Step 3: Execute all tests                                     │
│  Step 4: Run verification gates                                │
│  Step 5: Deploy to Preview environment                         │
│  Step 6: Run smoke tests                                       │
│  Step 7: Run certifications (browser, UX, accessibility)       │
│  Step 8: Generate PRODUCT_OWNER_REVIEW_PACKAGE.md              │
│  Step 9: Notify Product Owner                                  │
│  Step 10: Wait for PO approval                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │  PO Approves  │ │ PO Requests  │ │ PO Rejects   │
     │               │ │ Changes      │ │              │
     └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
            │                 │                  │
            ▼                 ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Step 11: Promote │ │ Return to dev    │ │ Return to dev    │
│ to Production    │ │ with feedback    │ │ with reason      │
│ Step 12: Close   │ │ Re-run preview   │ │ Re-run preview   │
│ Release          │ │ pipeline         │ │ pipeline         │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## Production Promotion (No Rebuild)

When the PO approves the Preview, Hermes promotes the **same commit** to Production. No rebuild is required because:

1. The Preview and Production environments use the **same build artifacts**
2. The only difference is the **deployment target** (preview vs. production)
3. The **same CI/CD pipeline** is used — just a different environment flag
4. All **verification gates** have already passed in Preview

### Promotion Command

```
Promote Wave X Preview to Production
```

**What happens**:
1. Records PO approval
2. Triggers production deployment via CI/CD (`workflow_dispatch` on main)
3. Runs production smoke tests
4. Verifies production health
5. Captures deployment evidence
6. Generates Release Notes, Knowledge Capture, Executive Report
7. Marks wave as RELEASED

---

## Operator Checklist

| Step | Action | Automated? |
|------|--------|-----------|
| 1 | Execute Preview Mode | ✅ Yes |
| 2 | Review Review Package | ⚠️ PO only |
| 3 | Approve/Reject/Request Changes | ⚠️ PO only |
| 4 | If Approved → Promote to Production | ✅ Yes |
| 5 | If Rejected → Address feedback | ⚠️ Engineering |
| 6 | Verify Production is Live | ✅ Yes (auto) |
| 7 | Close Release | ✅ Yes (auto) |

---

## Governance

| Rule | Enforcement |
|------|-------------|
| No production deploy without PO approval | GATE-05 blocks GATE-06 |
| No rebuild on promotion | Same commit promoted |
| No governance bypasses | All gates enforced |
| Complete evidence chain | Every step produces artifacts |
| Rollback available | Rollback plan at GATE-06 |

---

## Next Phase

→ **Phase F**: Certification — dry-run using the completed Wave 4 Preview
