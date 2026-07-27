# Monitoring & Alerting Setup

> **Concierge Launch Readiness — Workstream C**
> Documents monitoring configuration, health endpoints, observability, error tracking, performance monitoring, uptime monitoring, and alert thresholds.
>
> **Date:** 2026-07-27
> **Status:** 📋 Assessment Complete

---

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge
Public Brand:   AG Synergy
Framework:      WEF v1.0 (Workforce Execution Framework)
---

## 1. Health Endpoint Monitoring

### 1.1 Primary Health Endpoint

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /api/v1/health` |
| **Worker** | `agsynergy-api` |
| **URLs** | `https://api.agsynergy.ca/api/v1/health` (prod), `https://<preview-url>/api/v1/health` (preview) |
| **Expected Status** | `200` = healthy, `503` = degraded |
| **Content-Type** | `application/json` |

### 1.2 Health Response Contract

```json
{
  "status": "healthy" | "degraded",
  "service": "agsynergy-api",
  "version": "1.20.0",
  "environment": "production",
  "timestamp": "2026-07-27T12:00:00.000Z",
  "database": {
    "connected": true,
    "migrationVersion": 5,
    "migrationCount": 5
  }
}
```

### 1.3 Health Check Configuration

| Check | Frequency | Timeout | Status |
|-------|-----------|---------|--------|
| Liveness probe (DB connectivity) | Every request | 5s | ✅ Built into health handler |
| Migration version check | Every request | 5s | ✅ Built into health handler |
| External health monitor | Every 60s | 10s | ⚠️ Configure Uptime Robot / Better Uptime |
| Deployment health framework | Pre-deployment | 30s | ✅ Built into `DeploymentHealthFramework` |

---

## 2. Workers Observability Configuration

### 2.1 Observability Settings (wrangler.jsonc)

| Environment | Enabled | Automatic Telemetry |
|-------------|---------|---------------------|
| Default | ✅ `true` | Request count, duration, status codes, errors |
| Production | ✅ `true` | Request count, duration, status codes, errors |
| Preview | ✅ `true` | Request count, duration, status codes, errors |

### 2.2 Available Observability Data

| Metric | Source | Available? |
|--------|--------|------------|
| Request count | Workers dashboard | ✅ |
| Error rate | Workers dashboard | ✅ |
| P95 latency | Workers dashboard | ✅ |
| CPU time | Workers dashboard | ✅ |
| Memory usage | Workers dashboard | ✅ |
| Request duration | Workers dashboard | ✅ |
| Status code distribution | Workers dashboard | ✅ |
| R2 operations | Workers dashboard | ✅ |
| D1 queries | Workers dashboard | ✅ |
| Uncaught exceptions | Workers dashboard | ✅ |

---

## 3. Error Tracking Setup

### 3.1 Structured Logging

| Property | Value |
|----------|-------|
| Logger | `src/middleware/logger.ts` — structured JSON logging |
| Log events | `request.start`, `request.complete`, `rate_limit.exceeded`, `health: database check failed` |
| Log format | `{ event: string, properties: object, environment: string }` |
| No PII in logs | ✅ Confirmed — no bodies, no PII logged |
| Log destination | Cloudflare Workers logs dashboard |

### 3.2 Error Categories

| Category | Detection Source | Action |
|----------|-----------------|--------|
| Unhandled exceptions | Workers runtime | Logged automatically, appears in Workers dashboard |
| Rate limit exceeded | Rate limit middleware | Logged as `rate_limit.exceeded` with path and limit |
| Database unreachable | Health handler | Logged as `health: database check failed`, returns 503 |
| JWT verification failure | jwt-auth middleware | Returns 401 with structured error response |
| Validation errors | Route handlers | Returns 400 with `validation_error` code |
| 404 routes | Catch-all handler | Returns structured 404 JSON response |

### 3.3 Error Response Format

All API errors follow a consistent format:

```json
{
  "error": "error_code",
  "message": "Human-readable description"
}
```

| Error Code | HTTP Status | Example |
|------------|-------------|---------|
| `validation_error` | 400 | Missing or invalid fields |
| `duplicate_lead` | 409 | Duplicate consultation email |
| `Unauthorized` | 401 | Missing/invalid JWT |
| `Too Many Requests` | 429 | Rate limit exceeded |
| `Not Found` | 404 | Unknown route |
| (empty — internal error) | 500 | Unhandled exception |

---

## 4. Performance Monitoring

### 4.1 Key Performance Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Health endpoint latency | <200ms p95 | >500ms p95 |
| Consultation create latency | <500ms p95 | >1s p95 |
| API route latency (all) | <300ms p95 | >1s p95 |
| D1 query latency | <50ms p95 | >200ms p95 |
| R2 upload latency | <1s p95 | >5s p95 |
| Error rate | <0.1% | >1% |
| Request count (daily) | Monitor for growth | Sudden drop >50% or spike >200% |

### 4.2 Performance Monitoring Tools

| Tool | Purpose | Status |
|------|---------|--------|
| Cloudflare Workers Analytics | Built-in metrics dashboard | ✅ Available |
| Cloudflare Web Analytics | Frontend performance monitoring | ⚠️ Enable in dashboard |
| Custom health endpoint timing | Request duration tracking | ✅ Built into health handler |

---

## 5. Uptime Monitoring

### 5.1 External Uptime Monitor Configuration

| Property | Value |
|----------|-------|
| **Monitor URL** | `https://api.agsynergy.ca/api/v1/health` |
| **Check Frequency** | Every 60 seconds |
| **Expected Status** | `200` |
| **Expected Content** | `"status":"healthy"` |
| **Timeout** | 10 seconds |
| **Alert Type** | Email + Telegram (via Operations Bot) |

### 5.2 Recommended Uptime Monitoring Services

| Service | Free Tier | Recommendation |
|---------|-----------|----------------|
| Better Uptime | 3 monitors, 60s intervals | ✅ Recommended |
| UptimeRobot | 5 monitors, 5min intervals | ✅ Alternative |
| Checkly | 5 monitors, 5min intervals | ✅ Alternative (includes Playwright checks) |

### 5.3 Monitoring Endpoints

| Endpoint | Environment | Expected | Check |
|----------|-------------|----------|-------|
| `/api/v1/health` | Production | 200 + `healthy` | Primary health check |
| `/api/v1/health` | Preview | 200 + `healthy` | Preview health check |
| `https://agsynergy.ca` | Production | 200 | Website availability |
| `https://www.agsynergy.ca` | Production | 200 or redirect | www availability |

---

## 6. Alert Thresholds

### 6.1 Alert Severity Levels

| Level | Response Time | Contact Method | Example |
|-------|--------------|----------------|---------|
| **P0 — Critical** | Immediate (15 min) | Telegram + Email + SMS | All health endpoints down |
| **P1 — High** | 30 min | Telegram + Email | Error rate >1% for 5+ minutes |
| **P2 — Medium** | 2 hours | Email | Latency >1s for 15+ minutes |
| **P3 — Low** | Next business day | Dashboard only | Rate limit threshold nearing |

### 6.2 Alert Thresholds Table

| # | Metric | Threshold | Duration | Severity | Status |
|---|--------|-----------|----------|----------|--------|
| 1 | Health endpoint down | Non-200 response | Any | P0 | ⚠️ Configure external monitor |
| 2 | DB connectivity lost | `connected: false` | Any | P0 | ⚠️ Configure external monitor |
| 3 | Error rate spike | >5% error rate | 5 minutes | P1 | ⚠️ Configure Workers dashboard alert |
| 4 | Latency degradation | P95 >1s | 15 minutes | P2 | ⚠️ Configure Workers dashboard alert |
| 5 | Memory threshold | >100MB | 5 minutes | P2 | ⚠️ Configure Workers dashboard alert |
| 6 | D1 query errors | >10 errors/min | 5 minutes | P1 | ⚠️ Configure Workers dashboard alert |
| 7 | SSL cert expiry | <30 days remaining | Any | P1 | ⚠️ Configure Cloudflare notification |
| 8 | R2 upload failures | >5 failures/min | 5 minutes | P2 | ⚠️ Configure Workers dashboard alert |

### 6.3 Alert Routing

| Alert Type | Channel | Target |
|------------|---------|--------|
| P0 — Critical | Telegram (Operations Bot) | On-call operator |
| P1 — High | Telegram + Email | Engineering team |
| P2 — Medium | Email | Engineering team |
| P3 — Low | Dashboard | Engineering lead |

---

## 7. Deployment Health Framework

The codebase includes a `DeploymentHealthFramework` that runs pre-deployment health checks:

| Health Check | Status | Description |
|-------------|--------|-------------|
| Cloudflare API | ✅ Implemented | Verifies Cloudflare API token |
| GitHub API | ✅ Implemented | Verifies GitHub API accessibility |
| Telegram API | ✅ Implemented | Verifies Telegram Bot API |
| OpenRouter API | ✅ Implemented | Verifies OpenRouter API |
| Workers | ✅ Implemented | Stub check |
| Pages | ✅ Implemented | Stub check |
| D1 | ✅ Implemented | Stub check |
| KV | ✅ Implemented | Stub check |
| R2 | ✅ Implemented | Stub check |
| Identity Runtime | ✅ Implemented | Stub check |
| Trust Runtime | ✅ Implemented | Stub check |

---

## 8. Summary

| Category | Status | Action Items |
|----------|--------|--------------|
| Health Endpoint | ✅ Ready | Already built and tested |
| Workers Observability | ✅ Ready | Enabled in all environments |
| Error Tracking | ✅ Ready | Structured logging, consistent error responses |
| Performance Monitoring | ✅ Ready | Cloudflare Workers Analytics available |
| Uptime Monitoring | ⚠️ Needs setup | Configure external uptime monitoring service |
| Alert Thresholds | ⚠️ Needs setup | Define alerts in Cloudflare dashboard + monitoring service |
| Deployment Health Framework | ✅ Ready | Implemented and registered with 11 checks |

**Overall: ⚠️ CONDITIONAL PASS — Configure external uptime monitoring and Workers dashboard alerts before production launch.**

---

*Concierge Launch Readiness — Workstream C*
*Monitoring & Alerting Setup — v1.0.0*
*Last updated: 2026-07-27*