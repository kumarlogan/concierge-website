/**
 * @deprecated LEGACY PROTOTYPE — REFERENCE ONLY. Do not expand or modify.
 *
 * This Zod schema package is the Phase-1 prototype described in ADR-001
 * (Migration Strategy from Express/PostgreSQL Prototype to Cloudflare
 * Platform). Per ADR-001 it is preserved as historical/reference material only:
 *   - It is consumed solely by artifacts/api-server (the legacy Express server),
 *     which is NOT deployed (see deploy.yml).
 *   - The active production API validates request bodies inline in
 *     workers/src (Cloudflare Workers), not via this package.
 *
 * Do not add or change schemas here. Retirement is tracked separately and
 * intentional (see ADR-001).
 */
export * from "./generated/api";
export * from "./generated/types";
export * from './generated/api';
export * from './generated/types';
