# API Reference

> AG Synergy Platform — API endpoint reference and integration guide.
> **Status:** Phase 1 Live | **Deployed as:** Cloudflare Workers

## Base URLs

| Environment | URL |
|---|---|
| Production | `https://agsynergy-api.kumarlogan.workers.dev` |
| Planned custom domain | `https://api.agsynergy.ca` (routing configured, DNS pending) |

## API Versioning

All endpoints are versioned under `/api/v1/`. Future breaking changes will increment the version number. The current `v1` will remain stable and backwards-compatible throughout Phase 1 and 2.

## Common Patterns

### Request Format
- `Content-Type: application/json` required for POST endpoints
- All request bodies must be JSON objects (not arrays or primitives)

### Response Format

**Success:**
```json
{
  "success": true,
  "...resource fields..."
}
```

**Error:**
```json
{
  "success": false,
  "error": "error_code",
  "message": "Human-readable description"
}
```

### HTTP Status Codes

| Code | Meaning |
|---|---|
| `200 OK` | Request succeeded (GET) |
| `201 Created` | Resource created (POST) |
| `204 No Content` | Preflight/OPTIONS response |
| `400 Bad Request` | Validation error or malformed request |
| `404 Not Found` | Unknown endpoint or wrong HTTP method |
| `409 Conflict` | Duplicate resource (e.g., existing lead) |
| `500 Internal Server Error` | Unexpected server error |

## Implemented Endpoints

### GET /api/v1/health

Operational readiness check.

**Response `200 OK`:**
```json
{
  "status": "healthy",
  "service": "agsynergy-api",
  "version": "0.1.0",
  "environment": "production",
  "timestamp": "2026-07-18T12:00:00.000Z"
}
```

No errors.

---

### POST /api/v1/consultations

Submit a consultation request. Creates a new lead after validation, normalization, and duplicate detection.

**Request Body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | `string` | ✅ | Max 255 chars, non-empty after trim |
| `email` | `string` | ✅ | Max 255 chars, valid email format |
| `phone` | `string` | ✅ | Max 100 chars, non-empty after trim |
| `treatment_interest` | `string` | ✅ | Max 500 chars, non-empty after trim |
| `message` | `string` | ❌ | Max 2000 chars, optional |

**Success `201 Created`:**
```json
{
  "success": true,
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "new",
  "message": "Consultation request received."
}
```

**Error `400 Bad Request` — Missing field:**
```json
{
  "success": false,
  "error": "validation_error",
  "message": "\"name\" is required"
}
```

**Error `400 Bad Request` — Invalid email:**
```json
{
  "success": false,
  "error": "validation_error",
  "message": "Invalid email format"
}
```

**Error `400 Bad Request` — Not a JSON object:**
```json
{
  "success": false,
  "error": "validation_error",
  "message": "Request body must be a JSON object"
}
```

**Error `409 Conflict` — Duplicate lead:**
```json
{
  "success": false,
  "error": "duplicate_lead",
  "message": "An active consultation request already exists for this email address"
}
```

## CORS

### Allowed Origins
- `https://agsynergy.ca`
- `https://www.agsynergy.ca`
- `http://localhost:5173`
- `http://localhost:23815`

### Allowed Methods
- `GET`, `POST`, `OPTIONS`

### Allowed Headers
- `Content-Type`, `Authorization`

### Preflight
`OPTIONS` returns `204 No Content` with appropriate `Access-Control-Allow-*` headers.

## Rate Limiting

Prepared in the architecture but not yet activated (Phase 1 foundation). Phase 2 will implement per-endpoint rate limits via Cloudflare Workers middleware.

## Testing

Integration tests verify all endpoints against a Miniflare D1 instance. See [`TESTING.md`](../../docs/operations/TESTING.md).

## Related Documents
- [`API.md`](../../API.md) — Top-level API documentation
- [`ARCHITECTURE.md`](../../ARCHITECTURE.md) — System architecture
- [`DATABASE.md`](../../DATABASE.md) — Schema and data access
- [`SECURITY.md`](../../SECURITY.md) — Security posture