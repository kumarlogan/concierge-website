// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Security Automation — Review Store (in-memory ring)      │
// │ EPIC-003-003 · M7                                            │
// │ Keeps the most recent security review packages for admin       │
// │ visibility. No persistence, no external state — this mirrors    │
// │ the existing in-memory audit buffer pattern. Reads only flow    │
// │ out through the admin facade (no public endpoint).              │
// └─────────────────────────────────────────────────────────────┘

import type { SecurityReviewPackage } from "./security-work-model.js";

const MAX = 50;
const STORE: SecurityReviewPackage[] = [];

/** Record a completed review (called by the runtime after runSecurityReview). */
export function recordSecurityReview(pkg: SecurityReviewPackage): void {
  STORE.push(pkg);
  if (STORE.length > MAX) STORE.splice(0, STORE.length - MAX);
}

/** Return all recorded reviews (newest last). */
export function listSecurityReviews(): SecurityReviewPackage[] {
  return [...STORE];
}

/** Test/reset helper. */
export function _clearSecurityReviews(): void {
  STORE.length = 0;
}
