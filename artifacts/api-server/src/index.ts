/**
 * @deprecated LEGACY PROTOTYPE — REFERENCE ONLY. Do not expand or modify.
 *
 * This Express 5 API server is the Phase-1 prototype described in
 * ADR-001 (Migration Strategy from Express/PostgreSQL Prototype to
 * Cloudflare Platform). Per ADR-001 it is preserved as historical/reference
 * material only:
 *   - It is NOT deployed by .github/workflows/deploy.yml (which builds and
 *     deploys only @workspace/ags-fertility to Cloudflare Workers).
 *   - The active production backend is Cloudflare Workers + D1
 *     (see workers/src/routes/consultations.ts), used by the live frontend.
 *   - "No new features will be added to the Express API server. No new tables
 *     or schema changes will be made to the PostgreSQL database."
 *
 * Retirement is intentional and tracked separately from active development.
 * The PostgreSQL prototype remains until the Workers/D1 equivalent is fully
 * built and verified, then deleted via a planned cleanup — not ad hoc edits.
 */
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
