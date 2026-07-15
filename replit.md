# AGS Fertility Concierge

A premium fertility treatment coordination website for Canadian intended parents, connecting them with vetted IVF hospitals in Bangalore, India.

## Run & Operate

- `pnpm --filter @workspace/ags-fertility run dev` — run the frontend (port 23815)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite 7, Tailwind CSS v4, Framer Motion, Wouter (routing)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Fonts: Plus Jakarta Sans (headings), Inter (body) via Google Fonts
- Build: esbuild (server CJS bundle)

## Where things live

```
artifacts/ags-fertility/src/
  components/
    ui/              ← shadcn/radix primitives (keep as-is)
    layout/          ← Header, Footer, PageLayout, SectionWrapper
    sections/        ← Homepage section components
    forms/           ← ConsultationForm, ContactForm
  pages/             ← One file per route
  data/              ← Static content arrays (treatments, faq, hospitals, testimonials)
  lib/               ← Utils, cn, types, constants
  hooks/             ← Custom hooks

lib/
  api-spec/openapi.yaml   ← Source of truth for all API contracts
  api-client-react/       ← Generated React Query hooks (do not edit)
  api-zod/                ← Generated Zod schemas used by the server
  db/src/schema/          ← Drizzle ORM table definitions
```

## Architecture decisions

- **Presentation-first with real backend**: The site is primarily a marketing/information site, but the consultation form submits to a real PostgreSQL database via `/api/consultations`.
- **GitHub-ready structure**: Each major file has a `@extensionPoint` JSDoc comment noting how to extend it (e.g., add a CRM webhook, email confirmation, or Telegram notification).
- **Healthcare responsibility baked in**: All treatment pages include an educational disclaimer. The FAQ explicitly states that no outcome is guaranteed. All copy avoids guarantees.
- **Static content in `src/data/`**: Treatments, FAQs, hospitals, and testimonials live in typed TS arrays — easy to extend or migrate to a CMS later.
- **No secrets in code**: Consultation form submissions go to the AGS-controlled API server; no third-party keys are needed for Phase 1.

## Product

**Phase 1 (complete):**
- Full homepage: Hero, Why AGS, Why Bangalore, How It Works, Treatment Options, Partner Hospitals, Testimonials, FAQ, Consultation CTA
- All page shells: About, IVF in Bangalore, Treatments (overview + 6 individual pages), Partner Hospitals, Cost Guide, Success Stories, FAQ, Contact
- Working consultation form with PostgreSQL persistence
- Clean GitHub-ready codebase with extension point documentation

**Phase 2 (planned):**
- Full page content for inner pages (About, IVF in Bangalore, each Treatment page, Cost Guide, Success Stories)
- Hospital detail profiles with maps
- Blog/SEO content articles

## Extension Points

- **CRM integration**: `artifacts/api-server/src/routes/consultations.ts` — add a webhook call after `db.insert()` to post to HubSpot, Pipedrive, or a Telegram bot.
- **Email confirmation**: Same file — add a transactional email (Resend, SendGrid) on submission success.
- **Telegram notification**: Post to a Telegram Bot API in the consultation route for instant lead alerts.
- **Cloudflare**: Deploy the frontend as a static export (`pnpm --filter @workspace/ags-fertility run build`) to Cloudflare Pages; set API base URL to the deployed Express server URL.
- **CMS migration**: Static data in `src/data/` maps cleanly to a Contentful or Sanity schema for content team editing.

## User preferences

- Build in modular phases: design system first, homepage second, inner pages later
- GitHub-ready: clean folder organization, typed components, documented extension points
- Healthcare responsibility: no medical guarantees, no unsupported claims, always disclaim
- No emojis in UI

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change
- The `vite.config.ts` falls back to port 23815 if `PORT` env is not injected — this matches the artifact.toml localPort
- For type errors after DB schema changes, run `pnpm run typecheck:libs` to rebuild lib declarations
- LGBTQ+ family support copy should note "where supported by local regulations" per the blueprint

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- SEO targets: "IVF Bangalore for Canadians", "fertility treatment India", "fertility concierge Canada"
