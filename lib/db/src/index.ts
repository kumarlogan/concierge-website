/**
 * @deprecated LEGACY PROTOTYPE — REFERENCE ONLY. Do not expand or modify.
 *
 * This PostgreSQL/Drizzle schema package is the Phase-1 prototype described in
 * ADR-001 (Migration Strategy from Express/PostgreSQL Prototype to Cloudflare
 * Platform). Per ADR-001 it is preserved as historical/reference material only:
 *   - It is consumed solely by artifacts/api-server (the legacy Express server),
 *     which is NOT deployed (see deploy.yml).
 *   - The active production database is Cloudflare D1 (SQLite), accessed
 *     directly by workers/ — this package is not imported by the production path.
 *   - "No new tables or schema changes will be made to the PostgreSQL database."
 *
 * Do not add migrations, tables, or schema edits here. Retirement is tracked
 * separately and intentional (see ADR-001).
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
