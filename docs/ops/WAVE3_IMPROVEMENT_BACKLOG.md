# Wave 3 — Improvement Backlog

**Date:** 2026-08-01
**Product:** Concierge — AGS Fertility AI Platform
**Wave:** 3 — Timeline Engine

---

## Quick Wins (< 1 day)

1. **Add integration test for legacy → FullTimeline consumer migration** — prevents similar blockers in future waves
2. **Add automated doc update trigger** — when source files change, auto-update related docs

## Medium Improvements

3. **Add structured competitor analysis template** — Research Intelligence phase currently uses ad-hoc web search
4. **Add early integration test in Engineering phase** — catches legacy model mismatches before QA

## Strategic Improvements

5. **Build D1 backend for Timeline Engine** — in-memory engine is dev-only; production requires persistent storage
6. **Add automated Timeline-specific test suite** — 774 existing tests pass but none cover the new Timeline Engine specifically

## Foundation Changes

7. **Enhance EPCL to include integration risk assessment** — legacy model mismatches are predictable and should be flagged during planning
8. **Add consumer compatibility check to WAS activation** — verify all consumers are updated before marking Engineering complete

## Product Changes

9. **Add milestone alerting** — patients should be notified of upcoming milestones
10. **Add multi-role clinic dashboard** — clinic staff need timeline visibility (future milestone)

## Reusable Hermes Improvements

11. **Create integration test template** — reusable across all waves that involve domain model migrations
12. **Create doc update automation** — reduce manual doc editing across waves
13. **Create legacy-model-migration skill** — formalize the pattern of updating consumer files when a domain model changes

---

*End of Improvement Backlog*
