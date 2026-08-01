# Wave 4 Knowledge Capture — Care Companion

## Key Learnings

### What Worked
- Preview deployment pipeline works end-to-end
- PO review package generation is automated and reliable
- Release gates provide clear governance structure
- Single-command Preview execution is operational
- Production promotion (same commit, no rebuild) is clean

### What to Improve
- Accessibility gaps should be addressed before next production release
- CF API token needs rotation (53-char token is stale, 401 errors)
- Import integrity check has test file false positives (documented, non-blocking)

### Patterns Established
- PO Review Package auto-generation after Preview deploy
- 8-gate release workflow with formal entry/exit criteria
- Single-command Preview execution with PO approval gate
- Same-commit promotion from Preview to Production

### Decisions
- Preview R2 bucket override removed (uses top-level preview_bucket_name)
- Preview deploy step added to CI/CD as step 11
- PO approval required before Production promotion
- No rebuild on Production promotion (same commit)

### Risks
- Accessibility gaps in Preview (non-blocking but should be addressed)
- Stale CF API token (affects CI/CD from local, not from GitHub Actions)
