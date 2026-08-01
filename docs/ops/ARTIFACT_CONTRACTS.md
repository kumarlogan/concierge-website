# ARTIFACT_CONTRACTS.md

**EPIC-010 — Organizational Runtime Activation**
**Phase F: Artifact Contracts**
**Date:** 2026-08-01
**Product:** Concierge — AGS Fertility AI Platform

---

## Research Outputs

### research.md

| Field | Value |
|-------|-------|
| **Producer** | Research Agent |
| **Consumer** | Architecture & Strategy, Experience & Design, Engineering |
| **Schema** | `{ title: string, date: ISO8601, source: string, findings: Array<{ claim: string, evidence: string, confidence: number }>, recommendations: Array<string> }` |
| **Lifecycle** | Created → Reviewed → Accepted → Archived |

### evidence.json

| Field | Value |
|-------|-------|
| **Producer** | Evidence Agent |
| **Consumer** | Research Agent, Architecture & Strategy |
| **Schema** | `{ id: string, timestamp: ISO8601, type: "market" | "competitive" | "user" | "technical", data: object, source: string, verified: boolean }` |
| **Lifecycle** | Created → Validated → Accepted → Archived |

### competitive-analysis.md

| Field | Value |
|-------|-------|
| **Producer** | Competitive Analysis Agent |
| **Consumer** | Product Strategy Agent, Architecture & Strategy |
| **Schema** | `{ title: string, date: ISO8601, competitors: Array<{ name: string, strengths: string[], weaknesses: string[], gap: string }>, recommendations: Array<string> }` |
| **Lifecycle** | Created → Reviewed → Accepted → Archived |

---

## UX Outputs

### ux-research.md

| Field | Value |
|-------|-------|
| **Producer** | UX Research Agent |
| **Consumer** | UX Designer, Experience & Design |
| **Schema** | `{ title: string, date: ISO8601, method: string, participants: number, findings: Array<{ theme: string, evidence: string, severity: "low" | "medium" | "high" }>, recommendations: Array<string> }` |
| **Lifecycle** | Created → Reviewed → Accepted → Archived |

### wireframes.md

| Field | Value |
|-------|-------|
| **Producer** | UX Designer |
| **Consumer** | Frontend Agent, Experience & Design |
| **Schema** | `{ title: string, date: ISO8601, screens: Array<{ name: string, layout: string, components: string[] }>, interactions: Array<string> }` |
| **Lifecycle** | Created → Reviewed → Accepted → Archived |

### design-spec.md

| Field | Value |
|-------|-------|
| **Producer** | UX Designer |
| **Consumer** | Frontend Agent, Backend Agent |
| **Schema** | `{ title: string, date: ISO8601, components: Array<{ name: string, props: object, states: string[] }>, tokens: object, interactions: Array<string> }` |
| **Lifecycle** | Created → Reviewed → Accepted → Archived |

### accessibility-report.md

| Field | Value |
|-------|-------|
| **Producer** | Accessibility Agent |
| **Consumer** | UX Designer, QA |
| **Schema** | `{ title: string, date: ISO8601, wcagLevel: string, issues: Array<{ id: string, description: string, severity: "critical" | "serious" | "moderate" | "minor", remediation: string }>, passRate: number }` |
| **Lifecycle** | Created → Reviewed → Accepted → Remediated → Archived |

---

## Engineering Outputs

### implementation-report.md

| Field | Value |
|-------|-------|
| **Producer** | Backend Agent / Frontend Agent / API Agent |
| **Consumer** | QA, Verification |
| **Schema** | `{ title: string, date: ISO8601, features: Array<{ name: string, status: "complete" | "partial" | "deferred", tests: number, buildStatus: "pass" | "fail" }>, summary: string }` |
| **Lifecycle** | Created → Reviewed → Accepted → Archived |

### architecture-update.md

| Field | Value |
|-------|-------|
| **Producer** | Architecture & Strategy |
| **Consumer** | Engineering, QA |
| **Schema** | `{ title: string, date: ISO8601, changes: Array<{ component: string, change: string, rationale: string }>, impact: string }` |
| **Lifecycle** | Created → Reviewed → Accepted → Archived |

### build-report.md

| Field | Value |
|-------|-------|
| **Producer** | Backend Agent / Frontend Agent / Deployment Agent |
| **Consumer** | QA, Verification |
| **Schema** | `{ title: string, date: ISO8601, modules: number, duration: string, errors: number, warnings: number, status: "pass" | "fail" }` |
| **Lifecycle** | Created → Reviewed → Accepted → Archived |

---

## QA Outputs

### functional-report.md

| Field | Value |
|-------|-------|
| **Producer** | Functional QA |
| **Consumer** | Verification |
| **Schema** | `{ title: string, date: ISO8601, tests: number, passed: number, failed: number, status: "pass" | "fail", details: Array<{ test: string, result: "pass" | "fail", evidence: string }> }` |
| **Lifecycle** | Created → Reviewed → Accepted → Archived |

### regression-report.md

| Field | Value |
|-------|-------|
| **Producer** | Regression QA |
| **Consumer** | Verification |
| **Schema** | `{ title: string, date: ISO8601, tests: number, passed: number, failed: number, status: "pass" | "fail", details: Array<{ test: string, result: "pass" | "fail", evidence: string }> }` |
| **Lifecycle** | Created → Reviewed → Accepted → Archived |

### browser-report.md

| Field | Value |
|-------|-------|
| **Producer** | Browser QA |
| **Consumer** | Verification |
| **Schema** | `{ title: string, date: ISO8601, browsers: Array<{ name: string, version: string, status: "pass" | "fail", issues: string[] }>, overallStatus: "pass" | "fail" }` |
| **Lifecycle** | Created → Reviewed → Accepted → Archived |

### performance-report.md

| Field | Value |
|-------|-------|
| **Producer** | Performance QA |
| **Consumer** | Verification |
| **Schema** | `{ title: string, date: ISO8601, metrics: object, thresholds: object, status: "pass" | "fail", details: Array<{ metric: string, value: number, threshold: number, status: "pass" | "fail" }> }` |
| **Lifecycle** | Created → Reviewed → Accepted → Archived |

---

## Verification Outputs

### verification-report.md

| Field | Value |
|-------|-------|
| **Producer** | Verification Agent |
| **Consumer** | Knowledge Management, Executive Office |
| **Schema** | `{ title: string, date: ISO8601, checks: Array<{ name: string, result: "pass" | "fail", evidence: string }>, overallStatus: "certified" | "failed", certificationId: string }` |
| **Lifecycle** | Created → Reviewed → Certified → Archived |

---

## Knowledge Outputs

### knowledge-capture.md

| Field | Value |
|-------|-------|
| **Producer** | Knowledge Capture Agent |
| **Consumer** | Executive Office, all departments |
| **Schema** | `{ title: string, date: ISO8601, lessons: Array<{ category: string, lesson: string, action: string }>, patterns: Array<{ name: string, description: string, applicableTo: string[] }>, recommendations: Array<string> }` |
| **Lifecycle** | Created → Reviewed → Accepted → Archived |

---

## Executive Outputs

### executive-summary.md

| Field | Value |
|-------|-------|
| **Producer** | Executive Office |
| **Consumer** | Product Owner, all departments |
| **Schema** | `{ title: string, date: ISO8601, wave: string, status: string, sections: Array<{ name: string, content: string }> }` |
| **Lifecycle** | Created → Reviewed → Accepted → Archived |

---

*End of Artifact Contracts*
