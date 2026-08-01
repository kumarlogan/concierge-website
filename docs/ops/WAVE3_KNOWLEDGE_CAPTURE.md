# Wave 3 Knowledge Capture

## What Went Wrong

### 1. Import Integrity Gate Bug — Wrangler Alias Resolution
**Severity**: Critical (blocked deployment)
**Root Cause**: The `import-integrity-check.py` script resolved wrangler alias targets relative to the project root instead of the `workers/` directory where `wrangler.jsonc` lives.

**Example**: `@hermes/identity/types.js` → alias target `../hermes/identity/types.ts`
- Bug: joined with project root → `/home/ubuntu/hermes/identity/types.ts` (wrong!)
- Fix: joined with `workers/` dir → `/home/ubuntu/concierge-website/hermes/identity/types.ts` (correct)

**Fix**: Added `wrangler_config_dir` parameter to `resolve_tsconfig_paths()` and resolve alias targets relative to the wrangler config directory.

### 2. Wrangler Alias Specificity Ordering
**Severity**: Critical (false positives on `@hermes/*` imports)
**Root Cause**: The script iterated wrangler aliases in insertion order. The wildcard `@hermes` alias (target `../hermes`) was checked before specific aliases like `@hermes/identity/types.js`. Since `../hermes` resolves to a directory, the script incorrectly returned the directory as the resolution.

**Fix**: Sort wrangler aliases by pattern length (longest first) so specific matches take priority over wildcards.

### 3. Import Path Depth Error
**Severity**: Medium (pre-existing bug in EPIC-012 code)
**Root Cause**: `discipline-router-integration.ts` in `hermes/services/execution/` used `../../planning/discipline-router` which resolves to `hermes/planning/` (wrong) instead of `hermes/services/planning/` (correct). The correct import is `../planning/discipline-router`.

**Fix**: Changed `../../planning/` to `../planning/`.

### 4. CI Gate Exclude List Incomplete
**Severity**: Low (test file false positives)
**Root Cause**: The `--exclude` list in `deploy.yml` excluded `workers/tests-epic0059/` but not `workers/tests/`. The test file `workers/tests/auth/engine.unit.test.ts` has `@hermes/identity/types.js` bare imports that trigger false positives in the integrity gate.

**Fix**: Added `workers/tests/` to the exclude list.

## Lessons Learned

1. **Wrangler alias targets are relative to the wrangler.jsonc location**, not the project root. Any tool that resolves these aliases must account for this.

2. **Alias specificity matters**: wildcard patterns (`@hermes`) must be checked after exact patterns (`@hermes/identity/types.js`). Sorting by pattern length (longest first) is the correct approach.

3. **The import integrity gate is a new addition** to the CI pipeline. It needs careful tuning before being enforced in production. Consider running it in report-only mode for one release cycle before making it a blocking gate.

4. **Pre-existing test files with bare `@hermes/*` imports** should be excluded from the integrity gate since they may not follow the same resolution rules as production code.

## Recommendations for Future Releases

1. Run the import integrity check in **report-only mode** for the first release after adding it to CI
2. Add a `--strict` flag that can be toggled to make the gate blocking or non-blocking
3. Consider adding the integrity check as a **pre-commit hook** rather than a CI gate, so developers get immediate feedback
4. Document the wrangler alias resolution rules in the project README

## Files Modified for Fixes

| File | Change |
|------|--------|
| `scripts/import-integrity-check.py` | Fixed wrangler alias base path + specificity ordering |
| `hermes/services/execution/discipline-router-integration.ts` | Fixed import path depth |
| `.github/workflows/deploy.yml` | Added `workers/tests/` to exclude list |
