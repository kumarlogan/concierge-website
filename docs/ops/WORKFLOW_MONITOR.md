# Workflow Monitor

## Purpose

Track GitHub Actions workflow runs for the release pipeline.

## Tracked States

| State | Description |
|-------|-------------|
| Queued | Workflow triggered, waiting for runner |
| Running | Workflow executing on a runner |
| Succeeded | Workflow completed successfully |
| Failed | Workflow completed with errors |
| Cancelled | Workflow was manually cancelled |

## Captured Data

| Field | Source |
|-------|--------|
| Workflow ID | GitHub Actions API |
| Run ID | GitHub Actions API |
| Commit | Git ref |
| Tag | Git tag |
| Duration | Start → End time |
| Logs | GitHub Actions log URL |
| Artifacts | GitHub Actions artifacts API |
| Deployment URL | Output from workflow |
| Failure Reason | Last error in log |
| Retries | Manual re-trigger count |

## Monitoring Commands

### Check Workflow Status
```bash
gh run list --repo kumarlogan/concierge-website --workflow deploy.yml --limit 5
```

### Get Workflow Details
```bash
gh run view <RUN_ID> --repo kumarlogan/concierge-website
```

### Get Workflow Logs
```bash
gh run view <RUN_ID> --repo kumarlogan/concierge-website --log
```

### Get Artifacts
```bash
gh artifact list <RUN_ID> --repo kumarlogan/concierge-website
```

### Trigger Preview Deployment
```bash
gh workflow run deploy.yml --ref main -f environment=preview -R
```

### Trigger Production Deployment
```bash
gh workflow run deploy.yml --ref main -f environment=production -R
```

## Reuses

- GitHub CLI (`gh`) for all workflow operations
- Existing deploy.yml workflow configuration
- Existing GitHub Secrets (CLOUDFLARE_API_TOKEN, etc.)
- No new monitoring infrastructure
