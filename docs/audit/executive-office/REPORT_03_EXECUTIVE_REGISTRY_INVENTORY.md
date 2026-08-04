# Executive Registry Inventory

> **Audit Date:** 2026-08-04T05:03:47Z
> **Scope:** All registries that track agents, skills, departments, organizations, releases, and capabilities
> **Auditor:** Hermes Agent — Executive Office Discovery
> **Methodology:** READ-ONLY document analysis + source code cross-reference
> **Status:** COMPLETE

---

## 1. Registry Inventory Summary

| # | Registry | Location | Entries | Status | Owner |
|---|---|---|---|---|---|
| 1 | Agent Registry | `docs/ops/AGENT_REGISTRY.md` | 14+ agents | Architecture | AI Platform |
| 2 | Skill Registry | `docs/ops/SKILL_REGISTRY.md` | 20+ skills | Architecture | AI Platform |
| 3 | Department Registry | `docs/ops/DEPARTMENT_REGISTRY.md` | 8 departments | Architecture | AI Platform |
| 4 | Organization Registry | `docs/ops/ORGANIZATION_DISCOVERY.md` | Full org structure | Discovery | AI Platform |
| 5 | Organization Certification | `docs/ops/ORGANIZATION_CERTIFICATION.md` | Certification checklist | Certification | AI Platform |
| 6 | Release Registry (ops) | `docs/ops/RELEASE_OPERATIONS.md` | Full release org | Architecture | AI Platform |
| 7 | Release Agent Registry | `docs/ops/RELEASE_AGENT_REGISTRY.md` | Release agents | Architecture | AI Platform |
| 8 | Release Backlog | `docs/ops/RELEASE_BACKLOG.md` | Release work items | Certification | AI Platform |
| 9 | Release Certification | `docs/ops/RELEASE_CERTIFICATION.md` | Dry run results | Dry Run | AI Platform |
| 10 | Release Certification (Final) | `docs/ops/RELEASE_CERTIFICATION_FINAL.md` | Final certification | Certified | AI Platform |
| 11 | Release Dashboard | `docs/ops/RELEASE_DASHBOARD.md` | Release panels | Architecture | AI Platform |
| 12 | Release Gates | `docs/ops/RELEASE_GATES.md` | 8 formal gates | Architecture | AI Platform |
| 13 | Release Orchestrator | `docs/ops/RELEASE_ORCHESTRATOR.md` | Orchestration layer | Architecture | AI Platform |
| 14 | Release Discovery | `docs/ops/RELEASE_DISCOVERY.md` | 27 components | Discovery | AI Platform |
| 15 | Release Reconciliation | `docs/ops/RELEASE_RECONCILIATION.md` | Phase A reconciliation | Reconciliation | AI Platform |
| 16 | Release Runtime Trace | `docs/ops/RELEASE_RUNTIME_TRACE.md` | Operational trace | Operational | AI Platform |
| 17 | Capability Registry | `docs/platform/capability-registry/CAPABILITY_REGISTRY.md` | 100+ capabilities | Architecture | AI Platform |
| 18 | Capability Model | `docs/architecture/CAPABILITY_MODEL.md` | Universal taxonomy | Architecture | AI Platform |
| 19 | Capability Maturity Model | `docs/platform/maturity-model/CAPABILITY_MATURITY_MODEL.md` | 9 maturity levels | Architecture | AI Platform |
| 20 | PSER | `docs/platform/project-state-registry/PSER_ARCHITECTURE.md` | Project state registry | Architecture | AI Platform |
| 21 | Policy Engine | `docs/platform/policy-engine/POLICY_ENGINE_ARCHITECTURE.md` | Policy evaluation | Architecture | AI Platform |

---

## 2. Agent Registry Detail

### 2.1 Agent Types (from AGENT_REGISTRY.md)
| Agent Type | Department | Purpose |
|---|---|---|
| Research Intelligence | Research | Research and analysis |
| Developer Agent | Engineering | Code implementation |
| QA Agent | Quality | Testing and validation |
| Security Agent | Security | Security scanning and audit |
| Operations Agent | Operations | Platform operations |
| Admin Bot | Administration | Administrative tasks |
| Operator Agent | Operations | Operator experience |
| Review Agent | Quality | Code review |
| Release Agent | Release | Release management |
| Deployment Agent | Release | Deployment execution |
| Monitoring Agent | Operations | Monitoring and alerting |
| Planning Agent | Planning | Strategic planning |
| Execution Agent | Execution | Work execution |
| Governance Agent | Governance | Compliance and governance |

### 2.2 Agent Lifecycle (from hermes/agents/)
| File | Purpose |
|---|---|
| `hermes/agents/registry.ts` | Agent registration and discovery |
| `hermes/agents/index.ts` | Agent exports |
| `hermes/agents/approval.ts` | Approval gate enforcement |
| `hermes/agents/assignment.ts` | Agent-to-task assignment |
| `hermes/agents/memory.ts` | Agent memory management |
| `hermes/agents/permissions.ts` | Agent permission checks |
| `hermes/agents/task.ts` | Task management for agents |
| `hermes/agents/seed.ts` | Agent seeding |
| `hermes/agents/tool-contracts.ts` | Tool contract definitions |

---

## 3. Skill Registry Detail

### 3.1 OCI Skills (from `skills/INDEX.md`)
| Skill | Description | Status |
|---|---|---|
| `phe-startup-shutdown-checklist` | Startup validation + shutdown archival | Active |
| `phe-reflection-engine` | Post-task reflection and improvement | Active |
| `phe-memory-manager` | Store/retrieve/merge/archive memories | Proposed (backlog) |

### 3.2 GitHub Skill Registry (from `docs/ops/SKILL_REGISTRY.md`)
| Skill | Agent | Purpose |
|---|---|---|
| *(Full mapping in SKILL_REGISTRY.md)* | — | — |

### 3.3 Hermes Agent Skills (from `~/.hermes/skills/`)
| Skill | Description |
|---|---|
| `autonomous-ai-agents` | Spawning and orchestrating autonomous AI agents |
| `claude-code` | Delegate coding to Claude Code CLI |
| `codex` | Delegate coding to OpenAI Codex CLI |
| `hermes-agent` | Configure, extend, or contribute to Hermes Agent |
| `job-search-orchestrator` | Multi-agent job search pipeline |
| `opencode` | Delegate coding to OpenCode CLI |
| `computer-use` | Drive the user's desktop |
| `architecture-diagram` | Dark-themed SVG architecture diagrams |
| `ascii-art` | ASCII art generation |
| `ascii-video` | ASCII video conversion |
| `baoyu-infographic` | Infographics generation |
| `claude-design` | One-off HTML artifacts |
| `comfyui` | Image/video/audio generation with ComfyUI |
| `design-md` | Google's DESIGN.md token spec |
| `excalidraw` | Hand-drawn JSON diagrams |
| `humanizer` | Strip AI-isms from text |
| `manim-video` | Manim CE animations |
| `p5js` | p5.js sketches |
| `popular-web-designs` | 54 real design systems |
| `pretext` | Creative browser demos |
| `sketch` | Throwaway HTML mockups |
| `songwriting-and-ai-music` | Songwriting craft and Suno AI |
| `jupyter-live-kernel` | Iterative Python via live Jupyter |
| `himalaya` | IMAP/SMTP email from terminal |
| `gif-search` | Search/download GIFs from Tenor |
| `heartmula` | Suno-like song generation |
| `songsee` | Audio spectrograms/features |
| `youtube-content` | YouTube transcripts to summaries |
| `airtable` | Airtable REST API |
| `google-workspace` | Gmail, Calendar, Drive, Docs, Sheets |
| `image-ocr-fallback` | OCR with tesseract |
| `ocr-and-documents` | Extract text from PDFs/scans |
| `powerpoint` | Create, read, edit .pptx |
| `nano-pdf` | Edit PDF text/typos/titles |
| `maps` | Geocode, POIs, routes, timezones |
| `notion` | Notion API + ntn CLI |
| `teams-meeting-pipeline` | Teams meeting summary |
| `xurl` | X/Twitter via xurl CLI |
| `yuanbao` | Yuanbao groups |
| `hermes-execution-gateway` | Migrate execution paths |
| `hermes-webui-setup` | Install Hermes Web UI |
| `ollama-lmstudio-fallback` | Configure local model fallback |
| `phe-reflection-engine` | Post-task reflection |
| `phe-startup-shutdown-checklist` | Startup validation |
| `codebase-inspection` | Inspect codebases w/ pygount |
| `github-auth` | GitHub auth setup |
| `github-code-review` | Review PRs |
| `github-issues` | Create, triage, label, assign |
| `github-pr-workflow` | GitHub PR lifecycle |
| `github-repo-management` | Clone/create/fork repos |
| `deploy-website` | Deploy AGS Fertility website |
| `concierge-production-deployment` | Deploy Concierge Patient Portal |
| `ag-synergy-platform` | Working on Concierge platform |
| `documentation-governance-sprint` | Docs-only sprint |
| `governance-dashboard` | Multi-layered governance dashboards |
| `hermes-foundation-hardening` | Operational trust hardening |
| `hermes-trust-lifecycle` | Provider trust lifecycle |
| `openrouter-model-config` | Configure OpenRouter models |
| `phase-2-completion-wave-9` | Complete Phase 2 Wave 9 |
| `runtime-certification` | Certify runtime execution pipeline |
| `was-documentation-workflow` | WAS documentation workflow |
| `wave-8-workflow-engine` | Wave 8 Workflow & Automation |
| `webops` | End-to-end website deployment |
| `dogfood` | Exploratory QA of web apps |
| `acceptance-audit` | READ-ONLY acceptance audit |
| `architecture-freeze-review` | READ-ONLY architecture freeze review |
| `autonomous-execution-certification` | Multi-phase certification |
| `platform-baseline-freeze` | Platform baseline snap |
| `release-certification-audit` | Full release certification audit |
| `secret-remediation` | Remediate leaked credentials |
| `trust-verification-audit` | READ-ONLY security/trust verification |
| `requesting-code-review` | Pre-commit review |
| `simplify-code` | Parallel 3-agent cleanup |
| `systematic-debugging` | 4-phase root cause debugging |
| `test-driven-development` | TDD: RED-GREEN-REFACTOR |
| `spike` | Throwaway experiments |
| `plan` | Write actionable markdown plan |
| `feature-milestone-execution` | Structured feature implementation |
| `communication-centre-wave` | Communication Centre build |
| `recursive-job-improvement` | Self-improving job search |

---

## 4. Department Registry Detail

### 4.1 Departments (from DEPARTMENT_REGISTRY.md)
| Department | Purpose | Agent Count |
|---|---|---|
| Executive Office | Oversight, observability, decision-making | — |
| Engineering | Code implementation and delivery | — |
| Quality | Testing, validation, certification | — |
| Security | Security scanning, audit, compliance | — |
| Operations | Platform operations, monitoring | — |
| Administration | Administrative tasks and governance | — |
| Release | Release management and deployment | — |
| Planning | Strategic planning and roadmap | — |
| Execution | Work execution and orchestration | — |
| Governance | Compliance and governance enforcement | — |

---

## 5. Registry Cross-Reference Matrix

| Registry | Agents | Skills | Departments | Orgs | Releases | Capabilities |
|---|---|---|---|---|---|---|
| Agent Registry | ✅ | — | — | — | — | — |
| Skill Registry | — | ✅ | — | — | — | — |
| Department Registry | ✅ | — | ✅ | — | — | — |
| Organization Registry | ✅ | ✅ | ✅ | ✅ | — | — |
| Release Registry | ✅ | — | — | — | ✅ | — |
| Capability Registry | — | — | — | — | — | ✅ |
| PSER | ✅ | — | — | ✅ | ✅ | ✅ |
| Policy Engine | — | — | — | — | — | ✅ |
| Maturity Model | — | — | — | — | — | ✅ |

---

*Report 3 of 9 — Executive Registry Inventory*
