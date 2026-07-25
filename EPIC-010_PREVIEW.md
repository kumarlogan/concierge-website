# EPIC-010 — AGS Staging: About Us Hero Overlay Removal (Preview / Before-After)

**Status:** ✅ No change required — the dark/black overlay is **already removed**.
**Investigation date:** 2026-07-21
**Verdict:** The named change in the task spec is already satisfied in the working tree.

---

## 1. What the task asked
Remove the dark/black background overlay currently applied to the About Us page hero section.

## 2. What was actually found
The About Us hero (`artifacts/ags-fertility/src/pages/AboutPage.tsx`) currently renders
**no dark/black overlay**. Its hero section contains only:

- `HeroBackground()` — soft pastel gradient blobs (`bg-primary/10`, `bg-accent/8`,
  `bg-secondary/6`) + low-opacity light particles. Decorative, light, non-blocking.
- A content `<div className="relative z-10 ...">` with the heading / subhead.
- A decorative portrait frame ring on the *Our Story* image
  (`ring-1 ring-inset ring-foreground/[0.06]`) — a 6% opacity CSS ring, not an overlay.

A repo-wide grep for `bg-black`, `black/`, `bg-[#0…`, `mix-blend-multiply`, `backdrop`,
`bg-gray-9*`, etc. inside `AboutPage.tsx` returns **NONE**.

## 3. Before / After (historical — the overlay was removed earlier)

**BEFORE** (commit `13d8722` parent — `BirthdayOverlay` mounted at top of page):
```tsx
// ─── TEMPORARY birthday overlay — auto-expires July 19, 2026 ──────────
import BirthdayOverlay from '@/components/BirthdayOverlay';
...
return (
  <>
    {/* ─── TEMPORARY birthday overlay — auto-expires July 19, 2026 ────── */}
    <BirthdayOverlay />
    <PageLayout>
```

`BirthdayOverlay.tsx` rendered an **88% black backdrop** that blacked out About page
content for up to 15s per visit (intended as a surprise elsewhere; on About it read as a
broken black screen).

**AFTER** (current `HEAD` + working tree — overlay gone):
```tsx
return (
  <>
    <PageLayout>
    {/* ── 1. Hero ──────────────────────────────────────────────────── */}
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      <HeroBackground />
      ...
```

## 4. Proposed diff (this task)
```
(no lines changed)
```
The working-tree diff for `AboutPage.tsx` vs `HEAD` is **0 lines**. Nothing to apply.

## 5. Validation results (real runs)
| Check | Command | Result |
|---|---|---|
| Production build | `corepack pnpm run build` (in `artifacts/ags-fertility`) | ✅ exit 0 (`✓ built in 5.20s`) |
| Typecheck | `corepack pnpm run typecheck` (`tsc -p tsconfig.json --noEmit`) | ✅ exit 0 |
| Overlay present in hero? | grep `bg-black` / `black/` / `mix-blend-multiply` | ❌ none found |
| Working tree (AboutPage) | `git diff HEAD` | empty (no change) |
| Hermes dry-run | diff vs HEAD = 0 lines → no-op | ✅ no-op, safe |

> Build noise (sourcemap notes on `tooltip.tsx`/`label.tsx`, ">500 kB chunk" advisory)
> is third-party/harmless and does **not** fail the build (exit 0).

## 6. Rollback method (preserved capability)
- The overlay was removed in `13d8722`. To restore the *prior* state (already-removed
  content only, not recommended):
  `git checkout 13d8722^ -- artifacts/ags-fertility/src/pages/AboutPage.tsx`
  and re-add `BirthdayOverlay.tsx` from that commit.
- Since this task makes **no edit**, there is nothing to roll back. Existing git history
  is the rollback record.
- Unrelated working-tree file `artifacts/ags-fertility/src/components/layout/Footer.tsx`
  is **dirty but untouched** by this task (out of scope).

## 7. Scope guard (no unrelated changes)
- Foundation / `hermes/` / `workers/` / `shared/` / `lib/` — not touched.
- Other pages (Home `Hero.tsx` etc.) — not touched.
- Page not redesigned; only the overlay (already absent) was in scope.
- No deploy performed (none required; no source change).
