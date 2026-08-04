# Concierge Website

> Digital fertility concierge platform connecting Canadian patients with carefully selected fertility clinics in India.

## Status
**Phase:** Phase 1 — Digital Concierge Platform ✅ Complete  
**Product:** Concierge  
**Public Brand:** AG Synergy  
**Last Deployed:** See [deployment history](./CHANGELOG.md)

## 🧭 AI Context Layer — start here

**New to this repository, or starting an AI engineering session? Read
[`docs/context/`](./docs/context/) first.**

This repository contains over 500 markdown files. The context layer is the
machine-readable index that tells you what is current, what is historical, and what
actually runs — so you do not have to explore to find out.

| Read first | Purpose |
|---|---|
| [`docs/context/README.md`](./docs/context/README.md) | Entry point and reading order |
| [`docs/context/PROJECT_STATE.yaml`](./docs/context/PROJECT_STATE.yaml) | What is deployed and what actually works |
| [`docs/context/KNOWN_GAPS.yaml`](./docs/context/KNOWN_GAPS.yaml) | Known defects — check before reporting one |
| [`docs/context/ENGINEERING_GUIDE.md`](./docs/context/ENGINEERING_GUIDE.md) | How to set up, build, test, and deploy |
| [`docs/context/DOCUMENT_INDEX.md`](./docs/context/DOCUMENT_INDEX.md) | Which document to trust, and which are historical records |

Supporting engineering reports: [`docs/engineering/reports/`](./docs/engineering/reports/).

If you change the repository, [`docs/context/CONTEXT_MAINTENANCE.md`](./docs/context/CONTEXT_MAINTENANCE.md)
describes what you are obliged to update alongside it.

## Quick Links
- [Project Constitution](./PROJECT.md)
- [Product Boundaries](./PRODUCT_BOUNDARIES.md)
- [AI Operating Model](./AI_OPERATING_MODEL.md)
- [Architecture](./ARCHITECTURE.md)
- [Roadmap](./ROADMAP.md)
- [Current Sprint](./CURRENT_SPRINT.md)
- [Tasks](./TASKS.md)
- [Decision Log](./DECISIONS.md)
- [API Documentation](./API.md)
- [Database Schema](./DATABASE.md)
- [Security](./SECURITY.md)
- [Style Guide](./STYLEGUIDE.md)
- [Changelog](./CHANGELOG.md)

## Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React + Vite (TypeScript) |
| Hosting | Cloudflare Pages |
| Backend | Cloudflare Workers |
| Database | Cloudflare D1 |
| Storage | Cloudflare R2 |
| Admin | Telegram + Hermes |
| LLM | DeepSeek |

## Getting Started
See [`docs/context/ENGINEERING_GUIDE.md`](./docs/context/ENGINEERING_GUIDE.md) for
environment setup, commands, conventions, and deployment.
