# Program Status Dashboard

> **Executive dashboard for the entire AGS organization.**
> Single source of truth for engineering and commercial program status.
> Updated every epic completion.

**Last Updated:** 2026-07-26

---

## 1. Organization Hierarchy

```
Company        AGS
Platform       AI Platform
Product        Concierge
Public Brand   AG Synergy

Roadmap        Concierge Roadmap
  └─ Phase
       └─ Epic
            └─ Sprint
                 └─ Story / Task
```

---

## 2. Platform Hierarchy

| Layer | Technology | Status |
|---|---|---|
| Static Hosting | Cloudflare Pages (agsynergy.ca) | ✅ **Live** |
| Frontend | React 18 + Vite 7 + TypeScript + Tailwind CSS 4 | ✅ **Deployed** |
| API Layer | Cloudflare Workers (agsynergy-api) | ✅ **Deployed** (workers.dev) |
| API Custom Domain | api.agsynergy.ca | ⚠️ **Not deployed** — Production env needs first deploy |
| Database | Cloudflare D1 (agsynergy-db) | ✅ **Live** — 5 migrations, 24 tables |
| Object Storage | Cloudflare R2 | 🔧 **Configured** — Not actively used |
| Authorization | Workers RBAC engine (`src/auth/`) | ✅ **Live** |
| Administration | Telegram + Operations Bot + Admin Bot | ✅ **Live** — wire-ready (needs bot tokens) |

---

## 3. Product Inventory

| Product | Internal Name | Public Brand | Status |
|---|---|---|---|
| Fertility Concierge | Concierge | AG Synergy | 🚧 Phase 1 Complete, Phase 2 In Planning |

---

## 4. Active Product

**Product:** Concierge (public brand: AG Synergy)

---

## 5. Current Roadmap

**Roadmap:** [Concierge Roadmap](../../ROADMAP.md)

---

## 6. Current Phase

| Phase | Name | Status |
|---|---|---|
| Phase 0 | Platform Foundation | ✅ **Complete** (2026-07-18) |
| **Phase 1** | **Digital Concierge Platform** | ✅ **Complete (2026-07-26)** |
| Phase 2 | Patient Workflow Platform | 🚧 In Planning |
| Phase 3 | Clinic Collaboration Platform | 📋 Future |
| Phase 4 | AI-Assisted Operations Platform | 📋 Future |

---

## 7. Current Epic

**None.** Phase 1 epics all closed. Phase 2 epics pending planning sprint.

---

## 8. Current Sprint

**Phase 1** — ✅ **Closed** (2026-07-18 → 2026-07-26)

Next sprint: Phase 2 Planning (TBD)

---

## 9. Current Git Commit

`c4172b1` — `EPIC-002-005: Hermes Control Plane — Admin Bot Foundation`

---

## 10. Current Release

| Version | Tag | Date | Content |
|---|---|---|---|
| v1.0.0 | `v1.0.0` | 2026-07-26 | Phase 1 engineering baseline |

---

## 11. Current Deployment Status

### Production

| Component | URL | Status |
|---|---|---|
| Website | https://agsynergy.ca | ✅ **Live** — HTTP/2 200 |
| Website (www) | https://www.agsynergy.ca | ✅ **Live** |
| API (workers.dev) | https://agsynergy-api.kumarlogan.workers.dev | ✅ **Live** — Health 200 |
| API (custom domain) | https://api.agsynergy.ca | ✅ **Deployed** — DNS propagating (use workers.dev production URL) |
| Database | agsynergy-db (D1) | ✅ **Live** — 5 migrations, 24 tables |
| Operations Bot | Telegram | ⚠️ **Wire-ready** — Bot token not provisioned |
| Admin Bot | Telegram | ✅ **Live** — Token set, webhook active, user-restricted |

### Preview

| Component | URL | Status |
|---|---|---|
| API Preview | https://agsynergy-api.kumarlogan.workers.dev | ✅ **Live** — Currently used as de facto production |
| D1 Remote | agsynergy-db | ✅ **Live** — Migrations applied |

---

## 12. Current Blockers

| Blocker | Severity | Impact | Mitigation |
|---|---|---|---|---|
| Production Worker deployed to workers.dev | ✅ **Resolved** | Production env live at `agsynergy-api-production.kumarlogan.workers.dev` | Custom domain DNS still propagating |
| Operations Bot token missing | ⚠️ Blocking | Bot cannot respond in Telegram | Register bot with BotFather, set `TELEGRAM_BOT_TOKEN` secret |
| Admin Bot token missing | ✅ **Resolved** | Token set, webhook active, user-restricted |
| D1 API token scope | ⚠️ Risk | Current wrl wrapper worked for production deploy | Verify with `wrangler secret put` test |

---

## 13. Resume Point

The next action to take after interruption.

1. Run `PHASE_1_EXIT.md` closeout checklist — verify all 16 epics documented
2. Deploy production Worker: `cd workers && npx wrangler deploy --env production`
3. Set secrets for Operations Bot and Admin Bot tokens
4. Begin Phase 2 planning sprint (patient accounts, auth flows, data model)

---

## 14. Overall Engineering Progress

| Phase | Epics | Tasks | Tests | Status |
|---|---|---|---|---|
| Phase 0 | 1 | ~10 | — | ✅ Complete |
| Phase 1 | 16 | ~160+ | 465/465 | ✅ **Complete** |
| **Total** | **17** | **~170+** | **465/465** | 🎯 **MVP Foundation Complete** |

---

## 15. Overall Commercial Readiness

| Criterion | Status | Notes |
|---|---|---|
| Engineering complete | ✅ | Phase 1 MVP foundation delivered |
| Production infrastructure | ⚠️ **Partial** | Works on workers.dev; custom domain api.agsynergy.ca not deployed |
| Commercial launch | ❌ Not declared | Engineering milestone only — no marketing, sales, or public offer |
| Patient-facing features | ⚠️ Basic | Consultation form live; no patient accounts, portal, or PHI handling yet |

---

## 16. Next Milestone

**Phase 2 — Patient Workflow Platform Planning Sprint**

Target: 2026-Q3

Key deliverables:
- Patient authentication architecture
- Auth flows and session management design
- Patient data model and PHI protection design
- R2 document upload architecture
- Phase 2 epic breakdown and sprint plan

---

*This dashboard is authoritative and must be updated by every epic completion.*
*See Definition of Done in [PROJECT.md](../../PROJECT.md).*