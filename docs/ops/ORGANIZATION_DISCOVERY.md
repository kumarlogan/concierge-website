# ORGANIZATION_DISCOVERY.md

**EPIC-010 — Organizational Runtime Activation**
**Phase A: Full Discovery**
**Date:** 2026-08-01
**Product:** Concierge — AGS Fertility AI Platform
**Hermes Runtime:** v1.0 (Foundation frozen)

---

## 1. Repository Structure

```
concierge-website/
├── .hermes/                    # Hermes runtime config (epic plans, reconciliation)
├── hermes/                     # Hermes platform services (frozen Foundation)
│   ├── services/
│   │   ├── activation/         # WAS — Workforce Activation Service
│   │   ├── agents/             # Agent lifecycle management
│   │   ├── application/        # Application-level services
│   │   ├── developer/          # Developer tooling
│   │   ├── discovery/          # Service discovery
│   │   ├── execution/          # WEF — Workforce Execution Framework
│   │   ├── lifecycle/          # Agent lifecycle states
│   │   ├── mcp/                # Model Context Protocol
│   │   ├── memory/             # Persistent memory
│   │   ├── notification/       # Telegram/Discord notification
│   │   ├── planning/           # EPCL — Execution Planning (8 services)
│   │   ├── providers/          # Provider framework (experimental, deferred)
│   │   ├── registry/           # Capability registry
│   │   ├── scheduler/          # Cron/scheduler
│   │   ├── security/           # Security services
│   │   ├── tools/              # Tool management
│   │   └── workforce/          # Workforce orchestration
│   ├── contracts/              # TypeScript contracts
│   ├── docs/                   # Platform documentation
│   └── workers/                # Cloudflare Workers (runtime)
├── workers/                    # Concierge Workers (API + routes)
│   ├── src/
│   │   ├── platform/           # Platform services (timeline, etc.)
│   │   ├── routes/             # API route handlers
│   │   └── index.ts            # Main worker entry
├── artifacts/                  # Frontend artifacts
│   └── ags-fertility/          # React frontend
│       ├── src/pages/patient/  # Patient-facing pages
│       └── src/lib/            # API clients
├── docs/                       # Documentation
│   ├── governance/             # Governance docs (GOVERNANCE_INDEX, PROGRAM_STATUS, etc.)
│   ├── platform/               # Platform docs (capability registry, identity, etc.)
│   ├── releases/               # Release notes
│   └── ops/                    # Operations docs (Wave 3 reports)
├── .github/workflows/          # CI/CD (deploy.yml, security.yml)
├── pnpm-workspace.yaml         # Workspace config
└── lib/                        # Shared libraries
```

---

## 2. Departments Inventory

### Current (Discipline-Based)
The current execution model uses a sequential discipline chain:
1. Research Intelligence
2. Architecture & Strategy
3. Experience & Design
4. Engineering
5. QA
6. Verification
7. Documentation
8. Knowledge Capture
9. Release Operations

### Target (Organization-Based)
The target model uses the canonical department registry:
1. Executive Office
2. Research Intelligence
3. Architecture & Strategy
4. Experience & Design
5. Engineering
6. Quality Assurance
7. Documentation
8. Release Operations
9. Verification
10. Knowledge Management
11. Business & Growth

### Gap Analysis
| Current Dept | Target Dept | Status |
|-------------|-------------|--------|
| Research Intelligence | Research Intelligence | ✅ Exists |
| Architecture & Strategy | Architecture & Strategy | ✅ Exists |
| Experience & Design | Experience & Design | ✅ Exists |
| Engineering | Engineering | ✅ Exists |
| QA | Quality Assurance | ✅ Exists (renamed) |
| Verification | Verification | ✅ Exists |
| Documentation | Documentation | ✅ Exists |
| Knowledge Capture | Knowledge Management | ✅ Exists (renamed) |
| Release Operations | Release Operations | ✅ Exists |
| — | Executive Office | ❌ Missing as explicit department |
| — | Business & Growth | ❌ Missing entirely |

---

## 3. Agents Inventory

### Active Agents (from Wave 3 execution traces)
| Agent | Role | Department | Status |
|-------|------|-----------|--------|
| Hermes Agent (orchestrator) | Main agent, all tool access | Executive Office | Active |
| Engineering subagent | Implementation, integration fixes | Engineering | Active |
| QA subagent | Build, typecheck, test verification | QA | Active |
| Verification subagent | Multi-check certification | Verification | Active |
| Documentation subagent | Doc updates | Documentation | Active |
| Knowledge Capture subagent | Reflection, lessons learned | Knowledge Management | Active |

### Dormant Agents
None — all required agents were activated during Wave 3.

### Duplicate Agents
None — each department had exactly one active agent.

### Missing Agents (per EPIC-010 target model)
| Target Agent | Department | Evidence Needed |
|-------------|-----------|----------------|
| Research Agent | Research Intelligence | Web search capability |
| Evidence Agent | Research Intelligence | Evidence gathering |
| Competitive Analysis Agent | Research Intelligence | Competitor analysis |
| UX Research Agent | Experience & Design | UX research capability |
| UX Designer | Experience & Design | Design output |
| Accessibility Agent | Experience & Design | A11y checks |
| Design System Agent | Experience & Design | Design system enforcement |
| Backend Agent | Engineering | Backend implementation |
| Frontend Agent | Engineering | Frontend implementation |
| API Agent | Engineering | API design/implementation |
| Cloudflare Agent | Engineering | CF Workers deployment |
| Functional QA | QA | Functional testing |
| Regression QA | QA | Regression testing |
| Browser QA | QA | Browser compatibility |
| Performance QA | QA | Performance testing |
| Technical Writer | Documentation | Doc generation |
| Deployment Agent | Release Operations | Deployment execution |
| Verification Agent | Verification | Verification execution |
| Product Strategy Agent | Business & Growth | Strategy analysis |
| SEO Agent | Business & Growth | SEO optimization |
| Analytics Agent | Business & Growth | Analytics tracking |

---

## 4. Skills Inventory

### Skills Available (from skills_list)
| Skill | Category | Used in Wave 3? |
|-------|----------|----------------|
| post-wave-reporting | governance | ✅ Yes |
| platform-baseline-freeze | governance | ✅ Yes |
| phe-reflection-engine | governance | ✅ Yes |
| hermes-agent | hermes-agent | ✅ Yes |
| governance-dashboard | governance | ✅ Yes |
| hermes-trust-lifecycle | governance | ✅ Yes |
| hermes-execution-gateway | hermes-execution-gateway | ✅ Yes |
| autonomous-ai-agents | autonomous-ai-agents | ✅ Yes |
| codebase-inspection | github | ✅ Yes |
| github-auth | github | ✅ Yes |
| github-code-review | github | ✅ Yes |
| github-issues | github | ✅ Yes |
| github-pr-workflow | github | ✅ Yes |
| github-repo-management | github | ✅ Yes |
| deploy-website | devops | ✅ Yes |
| webops | devops | ✅ Yes |
| concierge-production-deployment | devops | ✅ Yes |
| openrouter-model-config | devops | ✅ Yes |
| jupyter-live-kernel | data-science | ❌ No |
| evaluating-llms-harness | mlops/evaluation | ❌ No |
| weights-and-biases | mlops/evaluation | ❌ No |
| llama-cpp | mlops/inference | ❌ No |
| serving-llms-vllm | mlops/inference | ❌ No |
| audiocraft-audio-generation | mlops/models | ❌ No |
| segment-anything-model | mlops/models | ❌ No |
| arxiv | research | ❌ No |
| blogwatcher | research | ❌ No |
| llm-wiki | research | ❌ No |
| polymarket | research | ❌ No |
| himalaya | email | ❌ No |
| openhue | smart-home | ❌ No |
| gif-search | media | ❌ No |
| heartmula | media | ❌ No |
| songsee | media | ❌ No |
| youtube-content | media | ❌ No |
| xurl | social-media | ❌ No |
| obsidian | note-taking | ❌ No |
| airtable | productivity | ❌ No |
| google-workspace | productivity | ❌ No |
| maps | productivity | ❌ No |
| nano-pdf | productivity | ❌ No |
| notion | productivity | ❌ No |
| ocr-and-documents | productivity | ❌ No |
| powerpoint | productivity | ❌ No |
| teams-meeting-pipeline | productivity | ❌ No |
| job-search-automation | productivity | ❌ No |
| job-search-orchestrator | autonomous-ai-agents | ❌ No |
| claude-code | autonomous-ai-agents | ❌ No |
| codex | autonomous-ai-agents | ❌ No |
| opencode | autonomous-ai-agents | ❌ No |
| architecture-diagram | creative | ❌ No |
| ascii-art | creative | ❌ No |
| ascii-video | creative | ❌ No |
| baoyu-infographic | creative | ❌ No |
| claude-design | creative | ❌ No |
| comfyui | creative | ❌ No |
| design-md | creative | ❌ No |
| excalidraw | creative | ❌ No |
| humanizer | creative | ❌ No |
| manim-video | creative | ❌ No |
| p5js | creative | ❌ No |
| popular-web-designs | creative | ❌ No |
| pretext | creative | ❌ No |
| sketch | creative | ❌ No |
| songwriting-and-ai-music | creative | ❌ No |
| dogfood | dogfood | ❌ No |
| acceptance-audit | qa | ❌ No |
| architecture-freeze-review | qa | ❌ No |
| autonomous-execution-certification | qa | ❌ No |
| platform-baseline-freeze | qa | ✅ Yes |
| release-certification-audit | qa | ❌ No |
| secret-remediation | qa | ❌ No |
| trust-verification-audit | qa | ❌ No |
| hermes-agent-skill-authoring | software-development | ❌ No |
| hermes-gateway-extension | software-development | ❌ No |
| hermes-platform-service | software-development | ❌ No |
| node-inspect-debugger | software-development | ❌ No |
| plan | software-development | ❌ No |
| platform-capability-design | software-development | ❌ No |
| python-debugpy | software-development | ❌ No |
| requesting-code-review | software-development | ❌ No |
| simplify-code | software-development | ❌ No |
| spike | software-development | ❌ No |
| systematic-debugging | software-development | ❌ No |
| test-driven-development | software-development | ❌ No |
| feature-milestone-execution | software-development | ✅ Yes |
| enforcement-guard-integration | software-development | ❌ No |
| recursive-job-improvement | recursive-job-improvement | ❌ No |
| yuanbao | yuanbao | ❌ No |

### Skill Usage Summary
- **Frequently used (Wave 3):** post-wave-reporting, platform-baseline-freeze, phe-reflection-engine, hermes-agent, governance-dashboard, hermes-trust-lifecycle, hermes-execution-gateway, autonomous-ai-agents, codebase-inspection, github-auth, github-code-review, github-issues, github-pr-workflow, github-repo-management, deploy-website, webops, concierge-production-deployment, openrouter-model-config, feature-milestone-execution
- **Rarely used:** 0
- **Never used:** ~80 skills
- **Missing:** None critical for current runtime
- **Duplicate:** None identified

---

## 5. Capabilities Inventory

### Platform Capabilities (from docs/platform/capability-registry/)
| Capability | Status | Owner |
|-----------|--------|-------|
| Execution Platform | Live | Engineering |
| Authorization Engine | Live | Engineering |
| Provider Framework | Live | Engineering |
| Workforce Orchestration | Live | Engineering |
| Security Automation | Live | Engineering |
| Persistence Layer | Live | Engineering |
| Platform Hardening | Live | Engineering |
| Trust & Identity | Live (Wave 3) | Engineering |
| Policy Engine | Architecture Complete (Wave 2) | Engineering |
| Consent & Trust | Architecture Complete (Wave 2) | Engineering |
| Capability Registry | Complete (Wave 2) | Engineering |
| Engineering Standards | Complete (Wave 2) | Engineering |
| Release Management | Architecture Complete (Wave 1) | Engineering |
| Capability Maturity Model | Complete (Wave 2) | Engineering |

### Concierge-Specific Capabilities (from Wave 3)
| Capability | Status | Owner |
|-----------|--------|-------|
| Timeline Engine | Live | Engineering |
| FullTimeline model | Live | Engineering |
| Legacy CarePlan compat | Live | Engineering |
| In-memory engine | Live (dev-only) | Engineering |
| Milestone tracking | Live | Engineering |
| Event history | Live | Engineering |
| Progress tracking | Live | Engineering |
| Stage progression | Live | Engineering |

### Capability Gaps
- **Business & Growth capabilities** — no Product Strategy, SEO, or Analytics capabilities exist yet
- **Timeline-specific test capability** — no automated tests for the new Timeline Engine
- **D1 backend capability** — intentionally deferred

---

## 6. Feature Flags

From EPCL (Planning namespace), 10 flags defined:
- Flag 1–10: Timeline Engine feature flags (specific names not in current context)
- All flags under `hermes/services/planning/FeatureFlags`

---

## 7. Execution Paths

### Current (Discipline-Based)
```
Roadmap → EPCL → Research → Architecture → Experience → Engineering → QA → Verification → Knowledge → Report → WAIT
```

### Target (Organization-Based)
```
Roadmap → Executive Office → EPCL → Departments → Agents → Skills → Capabilities → Verification → Knowledge → Executive Reporting → WAIT
```

### Wave 3 Actual Path (Observed)
```
Roadmap → EPCL → Departments → Agents → Skills → Capabilities → WAS activation → WEF delegation → Research Intelligence → Architecture & Strategy → Experience & Design → Engineering → QA → Verification → Documentation → Knowledge Capture → Executive Reporting → WAIT
```

---

## 8. Verification

### Wave 3 Verification Checks
| Check | Result |
|-------|--------|
| Build (2321 modules) | ✅ Pass |
| Typecheck (4 workspace projects) | ✅ Pass |
| Tests (774/774) | ✅ Pass |
| Route integration | ✅ Pass |
| Import validation | ✅ Pass |
| Legacy compat | ✅ Pass |
| Governance violations | 0 |
| Architecture violations | 0 |

---

## 9. Knowledge Capture

### Wave 3 Knowledge Captured
- IVF timeline best practices (8-stage progression)
- Patient journey patterns (visual timeline, milestone tracking)
- Legacy model migration pattern (carePlan/tasks → FullTimeline)
- Integration fix pattern (update consumers when domain model changes)
- Backward-compat shim pattern in API client

---

## 10. Executive Reporting

### Wave 3 Reports Produced
- 15-section Product Owner Report
- 10-part Operational Review
- Runtime Scorecard
- Organizational Scorecard
- Agent Scorecard
- Capability Scorecard
- Skill Scorecard
- Improvement Backlog
- Wave 4 Readiness Report

---

## 11. Provider Integrations

| Provider | Status | Evidence |
|----------|--------|----------|
| OpenRouter (primary) | Active | tencent/hy3-preview model |
| OpenRouter (fallback) | Configured | fallback_providers in config.yaml |
| Telegram | Connected | Home channel (ID: 8117947039) |
| Photon | Connected | Home channel (ID: +16044013459) |
| Cloudflare Workers | Active | wrangler deploy |
| Cloudflare D1 | Configured | Migrations present |

---

## 12. Runtime Services

| Service | Path | Status |
|---------|------|--------|
| EPCL | hermes/services/planning/ | Active (8 services) |
| WAS | workers/src/platform/ | Active (8-state activation machine) |
| WEF | hermes/services/execution/ | Active |
| Capability Registry | docs/platform/capability-registry/ | Active (13 capabilities) |
| Memory | hermes/services/memory/ | Active |
| Scheduler | hermes/services/scheduler/ | Active |
| Notification | hermes/services/notification/ | Active |
| Agent Lifecycle | hermes/services/agents/ | Active |
| Discovery | hermes/services/discovery/ | Active |
| Registry | hermes/services/registry/ | Active |

---

## 13. Dormant Components

| Component | Reason | Evidence |
|-----------|--------|----------|
| Provider Marketplace (~20 files) | Deferred to future EPIC | `hermes/services/providers/` — experimental |
| Activation Provider (~8 files) | Deferred to AGS Activation EPIC | `hermes/services/activation/providers/` — experimental |
| Workforce Persistence (~8 files) | Deferred to Production Workflow EPIC | `hermes/services/workforce/` — experimental |
| Architecture Design Proposals (~34 files) | Deferred design docs | `docs/architecture/` — design-only |
| Operations Session Reports (~54 files) | Deferred session artifacts | `docs/operations/` — one-shot outputs |
| Per-EPIC configs (~5 files) | Baseline config sufficient | `hermes/tsconfig.epic*.json` |

---

## 14. Duplicate Components

None identified. Each component has a single owner.

---

## 15. Summary

| Category | Count |
|----------|-------|
| Departments (current) | 9 |
| Departments (target) | 11 |
| Missing departments | 2 (Executive Office as explicit dept, Business & Growth) |
| Active agents | 6 |
| Target agents | ~22 |
| Missing agents | ~16 |
| Skills available | ~90 |
| Skills used in Wave 3 | ~19 |
| Skills never used | ~71 |
| Capabilities (platform) | 14 |
| Capabilities (Concierge) | 9 |
| Feature flags | 10 |
| Execution paths | 2 (current + target) |
| Verification checks | 8 |
| Knowledge captures | 1 |
| Executive reports | 9 |
| Provider integrations | 6 |
| Runtime services | 10 |
| Dormant components | ~105 files |
| Duplicate components | 0 |

---

*End of Phase A — Full Discovery*
