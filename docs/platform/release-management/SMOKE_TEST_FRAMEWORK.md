# Release Management — Smoke Test Framework

> **AI Platform Capability — Smoke Test Framework Design**
> Reusable smoke tests for all AGS products.
>
> **Version:** 1.0.0 — Architecture
> **Status:** Architecture Complete
> **Last Updated:** 2026-07-27

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Capability:     Release Management Platform
Document:       Smoke Test Framework
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Purpose

Smoke tests validate that a deployment is functional before declaring it healthy. They are **not** comprehensive — they verify the critical path: Is the service up? Does it respond? Can a user authenticate? Does the API work?

### 1.1 Design Principles

| Principle | Description |
|-----------|-------------|
| **Fast** | Complete in under 30 seconds |
| **Deterministic** | Same input → same output |
| **Product-Agnostic** | Test the platform contract, not product features |
| **Environment-Aware** | Same tests run on Preview and Production |
| **Fail-Closed** | A failed smoke test blocks promotion |

---

## 2. Smoke Test Suite

### 2.1 Test Categories

| Category | Tests | Criticality |
|----------|-------|-------------|
| **Home** | Home page returns 200 | High |
| **API** | API health endpoint responds | Critical |
| **Identity** | Identity endpoints are reachable | Critical |
| **Authentication** | Auth endpoints respond correctly | Critical |
| **Health** | Health endpoint returns full metadata | Critical |
| **Protected Route** | Protected routes require auth | High |
| **Consent** | Consent endpoints are reachable | Medium |
| **Policy** | Policy endpoints are reachable | Medium |

### 2.2 Test Definitions

#### 2.2.1 Home Test

```typescript
// smoke-tests/home.test.ts
async function testHome(baseUrl: string): Promise<SmokeTestResult> {
  const response = await fetch(baseUrl);
  return {
    name: "home",
    passed: response.status === 200,
    status: response.status,
    duration_ms: 0, // measured
  };
}
```

#### 2.2.2 API Health Test

```typescript
// smoke-tests/health.test.ts
async function testHealth(
  baseUrl: string,
  expectedEnvironment: string
): Promise<SmokeTestResult> {
  const response = await fetch(`${baseUrl}/api/v1/health`);
  if (response.status !== 200) {
    return { name: "health", passed: false, status: response.status };
  }

  const body = await response.json();
  const checks = [
    body.status === "ok",
    body.version !== undefined,
    body.environment === expectedEnvironment,
    body.release?.version !== undefined,
    body.release?.environment === expectedEnvironment,
  ];

  return {
    name: "health",
    passed: checks.every(Boolean),
    status: response.status,
    details: {
      version: body.version,
      environment: body.environment,
      release: body.release,
    },
  };
}
```

#### 2.2.3 Identity Test

```typescript
// smoke-tests/identity.test.ts
async function testIdentity(
  baseUrl: string
): Promise<SmokeTestResult> {
  // Test that identity endpoints are reachable
  const endpoints = [
    `${baseUrl}/api/v1/identity/auth/login`,
    `${baseUrl}/api/v1/identity/auth/register`,
  ];

  const results = await Promise.all(
    endpoints.map(async (url) => {
      const response = await fetch(url, { method: "OPTIONS" });
      return response.status === 200 || response.status === 204 || response.status === 405;
    })
  );

  return {
    name: "identity",
    passed: results.every(Boolean),
    status: results.every(Boolean) ? 200 : 503,
    details: { endpoints: results },
  };
}
```

#### 2.2.4 Authentication Test

```typescript
// smoke-tests/auth.test.ts
async function testAuth(baseUrl: string): Promise<SmokeTestResult> {
  // Test that login endpoint returns proper response
  const response = await fetch(`${baseUrl}/api/v1/identity/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", password: "invalid" }),
  });

  // Should return 401 for invalid credentials (not 500 or 404)
  const passed = response.status === 401;

  return {
    name: "auth",
    passed,
    status: response.status,
    details: { expected: 401, received: response.status },
  };
}
```

#### 2.2.5 Protected Route Test

```typescript
// smoke-tests/protected-route.test.ts
async function testProtectedRoute(
  baseUrl: string
): Promise<SmokeTestResult> {
  // Access a protected route without auth token
  const response = await fetch(`${baseUrl}/api/v1/identity/profile`, {
    headers: { "Authorization": "Bearer invalid-token" },
  });

  // Should return 401 (not 200 or 500)
  const passed = response.status === 401;

  return {
    name: "protected_route",
    passed,
    status: response.status,
    details: { expected: 401, received: response.status },
  };
}
```

#### 2.2.6 Consent Test

```typescript
// smoke-tests/consent.test.ts
async function testConsent(baseUrl: string): Promise<SmokeTestResult> {
  const response = await fetch(`${baseUrl}/api/v1/identity/consent/types`, {
    method: "OPTIONS",
  });

  // Endpoint should be reachable (200, 204, or 405)
  const passed = [200, 204, 405].includes(response.status);

  return {
    name: "consent",
    passed,
    status: response.status,
  };
}
```

#### 2.2.7 Policy Test

```typescript
// smoke-tests/policy.test.ts
async function testPolicy(baseUrl: string): Promise<SmokeTestResult> {
  const response = await fetch(`${baseUrl}/api/v1/policy/health`, {
    method: "OPTIONS",
  });

  // Endpoint should be reachable (200, 204, or 405)
  const passed = [200, 204, 405].includes(response.status);

  return {
    name: "policy",
    passed,
    status: response.status,
  };
}
```

---

## 3. Smoke Test Runner

```typescript
// smoke-tests/runner.ts
interface SmokeTestResult {
  name: string;
  passed: boolean;
  status: number;
  duration_ms?: number;
  details?: Record<string, unknown>;
}

interface SmokeTestSuite {
  name: string;
  environment: string;
  results: SmokeTestResult[];
  passed: boolean;
  duration_ms: number;
  timestamp: string;
}

async function runSmokeTests(
  baseUrl: string,
  environment: string
): Promise<SmokeTestSuite> {
  const start = Date.now();

  const tests = [
    testHome(baseUrl),
    testHealth(baseUrl, environment),
    testIdentity(baseUrl),
    testAuth(baseUrl),
    testProtectedRoute(baseUrl),
    testConsent(baseUrl),
    testPolicy(baseUrl),
  ];

  const results = await Promise.all(tests);

  return {
    name: "release-smoke-tests",
    environment,
    results,
    passed: results.every((r) => r.passed),
    duration_ms: Date.now() - start,
    timestamp: new Date().toISOString(),
  };
}
```

---

## 4. Smoke Test Results

### 4.1 Pass Example

```json
{
  "name": "release-smoke-tests",
  "environment": "preview",
  "results": [
    { "name": "home", "passed": true, "status": 200 },
    { "name": "health", "passed": true, "status": 200,
      "details": { "version": "1.18.1", "environment": "preview" } },
    { "name": "identity", "passed": true, "status": 200 },
    { "name": "auth", "passed": true, "status": 401 },
    { "name": "protected_route", "passed": true, "status": 401 },
    { "name": "consent", "passed": true, "status": 200 },
    { "name": "policy", "passed": true, "status": 200 }
  ],
  "passed": true,
  "duration_ms": 1240,
  "timestamp": "2026-07-27T10:00:00Z"
}
```

### 4.2 Fail Example

```json
{
  "name": "release-smoke-tests",
  "environment": "production",
  "results": [
    { "name": "home", "passed": true, "status": 200 },
    { "name": "health", "passed": false, "status": 500,
      "details": { "error": "Internal Server Error" } },
    { "name": "identity", "passed": true, "status": 200 },
    { "name": "auth", "passed": true, "status": 401 },
    { "name": "protected_route", "passed": true, "status": 401 },
    { "name": "consent", "passed": true, "status": 200 },
    { "name": "policy", "passed": true, "status": 200 }
  ],
  "passed": false,
  "duration_ms": 980,
  "timestamp": "2026-07-27T10:00:00Z"
}
```

---

## 5. Smoke Test Lifecycle

| Phase | Action | Owner |
|-------|--------|-------|
| **Preview Deploy** | Run smoke tests against Preview URL | Pipeline |
| **Promotion Gate** | Run smoke tests against Preview URL | Pipeline (gate blocker) |
| **Production Deploy** | Run smoke tests against Production URL | Pipeline |
| **Post-Deploy** | Run smoke tests against Production URL | Pipeline (monitoring) |

---

## 6. Integration with PSER

Smoke test results are recorded in PSER:

| Event | Data |
|-------|------|
| `smoke_tests.started` | Environment, base URL, test count |
| `smoke_tests.completed` | Results, pass/fail, duration |
| `smoke_tests.failed` | Failure details, failing tests |

---

## 7. Reusability

The smoke test framework is product-agnostic:

- Tests verify the **platform contract**, not product features
- Base URL is injected at runtime (Preview or Production)
- Product-specific tests are added by extending the test suite, not replacing it
- New products inherit all existing smoke tests

---

*Release Management Platform — AI Platform Capability*
*Smoke Test Framework — v1.0.0*
*Last updated: 2026-07-27*