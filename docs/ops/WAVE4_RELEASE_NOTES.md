# Release Notes — AGS v1.4.0

## Wave 4: Care Companion — Production Release

### Summary
Production release of the AG Synergy Care Companion feature, promoted from Preview after Product Owner approval.

### Changes
- AG Synergy Care Companion feature branch promoted to production
- Preview R2 bucket override removed (uses top-level preview_bucket_name)
- Preview deployment pipeline step added to CI/CD
- All verification gates passed in Preview

### Deployment
- **Commit**: `c8558cf`
- **CI/CD Run**: Triggered via workflow_dispatch
- **Environment**: Production
- **Deployed At**: 2026-08-01

### Verification
- Smoke Tests: ✅ PASS (Preview verified, Production same commit)
- Browser Compatibility: ✅ PASS
- UX Certification: ✅ PASS
- Accessibility: ⚠️ Documented gaps (non-blocking for production)

### Rollback
If issues are detected, rollback by reverting to the previous production commit (cf908cf).

### Product Owner Approval
- PO reviewed Preview at https://agsynergy-api-preview.kumarlogan.workers.dev
- PO approved for Production promotion
- No rebuild required (same commit promoted)
