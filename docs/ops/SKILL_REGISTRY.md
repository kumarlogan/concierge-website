# SKILL_REGISTRY.md

**EPIC-010 — Organizational Runtime Activation**
**Phase E: Skill Model**
**Date:** 2026-08-01
**Product:** Concierge — AGS Fertility AI Platform

---

## Skill-to-Agent Ownership Map

### Research Intelligence

| Skill | Agent | Purpose |
|-------|-------|---------|
| arxiv | research-agent | Search arXiv papers by keyword, author, category, or ID |
| blogwatcher | research-agent | Monitor blogs and RSS/Atom feeds |
| llm-wiki | research-agent | Build/query interlinked markdown KB |
| polymarket | research-agent | Query Polymarket markets, prices, orderbooks |
| web-search | research-agent, evidence-agent | Web search for research and evidence gathering |

### Experience & Design

| Skill | Agent | Purpose |
|-------|-------|---------|
| design-md | ux-designer, accessibility-agent | Author/validate/export Google's DESIGN.md token spec files |
| claude-design | ux-designer, design-system-agent | Design one-off HTML artifacts (landing, deck, prototype) |
| sketch | ux-designer | Throwaway HTML mockups: 2-3 design variants to compare |

### Engineering

| Skill | Agent | Purpose |
|-------|-------|---------|
| feature-milestone-execution | backend-agent, frontend-agent, api-agent | Implement groups of features as structured, verified milestones |
| hermes-platform-service | backend-agent | Build a Hermes AI Platform service from scratch |
| hermes-gateway-extension | backend-agent | Extend the Hermes Agent messaging gateway |
| python-debugpy | backend-agent | Debug Python via pdb REPL + debugpy remote |
| node-inspect-debugger | backend-agent | Debug Node.js via --inspect + Chrome DevTools Protocol CLI |
| requesting-code-review | backend-agent, frontend-agent, api-agent | Pre-commit review: security scan, quality gates, auto-fix |
| simplify-code | backend-agent, frontend-agent, api-agent | Parallel 3-agent cleanup of recent code changes |
| spike | backend-agent, frontend-agent, api-agent | Throwaway experiments to validate an idea before build |
| systematic-debugging | backend-agent, frontend-agent, api-agent | 4-phase root cause debugging: understand bugs before fixing |
| test-driven-development | backend-agent, frontend-agent, api-agent | TDD: enforce RED-GREEN-REFACTOR, tests before code |
| enforcement-guard-integration | backend-agent | Add a fail-closed security/runtime enforcement boundary |

### Quality Assurance

| Skill | Agent | Purpose |
|-------|-------|---------|
| acceptance-audit | functional-qa, regression-qa, browser-qa, performance-qa | Independent, READ-ONLY acceptance audit of a frozen/maturing codebase |
| architecture-freeze-review | functional-qa | Conduct a READ-ONLY architecture freeze review |
| autonomous-execution-certification | functional-qa | Multi-phase certification framework for autonomous AI execution |
| platform-baseline-freeze | functional-qa | Produce a comprehensive, READ-ONLY platform baseline snapshot |
| release-certification-audit | functional-qa, regression-qa | Perform a full release certification audit |
| secret-remediation | functional-qa | Remediate a repository that contains leaked credentials |
| trust-verification-audit | functional-qa | READ-ONLY verification of security/trust enforcement |

### Documentation

| Skill | Agent | Purpose |
|-------|-------|---------|
| governance-dashboard | technical-writer | Create and maintain multi-layered governance dashboards |
| post-wave-reporting | technical-writer | Produce structured executive reports after every completed roadmap wave |

### Release Operations

| Skill | Agent | Purpose |
|-------|-------|---------|
| deploy-website | deployment-agent | Deploy the AGS Fertility website to Cloudflare Pages |
| webops | deployment-agent | End-to-end website deployment pipeline from scratch |
| concierge-production-deployment | deployment-agent | Deploy Concierge Patient Portal (hermes-website + agsynergy-api) |
| openrouter-model-config | deployment-agent | Configure and verify OpenRouter models as the Hermes default |
| hermes-execution-gateway | deployment-agent | Migrate execution paths through the Hermes Platform single gateway |

### Knowledge Management

| Skill | Agent | Purpose |
|-------|-------|---------|
| phe-reflection-engine | knowledge-capture-agent | Post-task reflection that extracts lessons, creates backlinks, and saves skills |

---

## Orphan Skills (No Agent Owner)

| Skill | Category | Recommendation |
|-------|----------|---------------|
| autonomous-ai-agents (claude-code, codex, opencode, job-search-orchestrator) | autonomous-ai-agents | Assign to Engineering or a new Orchestration Agent |
| computer-use | computer-use | Assign to Engineering or a new Desktop Automation Agent |
| gif-search | media | Assign to Experience & Design or a new Media Agent |
| heartmula | media | Assign to Experience & Design or a new Media Agent |
| songsee | media | Assign to Experience & Design or a new Media Agent |
| youtube-content | media | Assign to Research Intelligence or a new Media Agent |
| xurl | social-media | Assign to Business & Growth or a new Social Media Agent |
| himalaya | email | Assign to Documentation or a new Communication Agent |
| openhue | smart-home | Assign to Engineering or a new IoT Agent |
| airtable | productivity | Assign to Documentation or a new Productivity Agent |
| google-workspace | productivity | Assign to Documentation or a new Productivity Agent |
| maps | productivity | Assign to Engineering or a new Productivity Agent |
| nano-pdf | productivity | Assign to Documentation or a new Productivity Agent |
| notion | productivity | Assign to Documentation or a new Productivity Agent |
| ocr-and-documents | productivity | Assign to Engineering or a new Productivity Agent |
| powerpoint | productivity | Assign to Documentation or a new Productivity Agent |
| teams-meeting-pipeline | productivity | Assign to Documentation or a new Productivity Agent |
| job-search-automation | productivity | Assign to Business & Growth or a new Productivity Agent |
| arcii-video | creative | Assign to Experience & Design or a new Creative Agent |
| manim-video | creative | Assign to Experience & Design or a new Creative Agent |
| p5js | creative | Assign to Experience & Design or a new Creative Agent |
| popular-web-designs | creative | Assign to Experience & Design or a new Creative Agent |
| pretext | creative | Assign to Experience & Design or a new Creative Agent |
| songwriting-and-ai-music | creative | Assign to Experience & Design or a new Creative Agent |
| dogfood | dogfood | Assign to QA or a new QA Agent |
| evaluating-llms-harness | mlops/evaluation | Assign to Engineering or a new ML Agent |
| weights-and-biases | mlops/evaluation | Assign to Engineering or a new ML Agent |
| llama-cpp | mlops/inference | Assign to Engineering or a new ML Agent |
| serving-llms-vllm | mlops/inference | Assign to Engineering or a new ML Agent |
| audiocraft-audio-generation | mlops/models | Assign to Engineering or a new ML Agent |
| segment-anything-model | mlops/models | Assign to Engineering or a new ML Agent |
| hermes-agent-skill-authoring | software-development | Assign to Engineering or a new Tooling Agent |
| hermes-gateway-extension | software-development | Assign to Engineering or a new Tooling Agent |
| hermes-platform-service | software-development | Assign to Engineering or a new Tooling Agent |
| plan | software-development | Assign to Engineering or a new Tooling Agent |
| platform-capability-design | software-development | Assign to Architecture & Strategy |
| enforcement-guard-integration | software-development | Assign to Engineering |
| recursive-job-improvement | recursive-job-improvement | Assign to Business & Growth or a new Productivity Agent |
| yuanbao | yuanbao | Assign to Business & Growth or a new Social Agent |

---

## Skill Consolidation Opportunities

| Current | Proposed Consolidation | Rationale |
|---------|----------------------|-----------|
| 4 QA skills (acceptance-audit, architecture-freeze-review, release-certification-audit, trust-verification-audit) | Consolidate under `qa-audit` umbrella skill | All are audit/verification skills with overlapping workflows |
| 3 deployment skills (deploy-website, webops, concierge-production-deployment) | Consolidate under `deployment` umbrella skill | All are deployment-related with overlapping workflows |
| 5 research skills (arxiv, blogwatcher, llm-wiki, polymarket, web-search) | Consolidate under `research` umbrella skill | All are research-related with overlapping workflows |

---

*End of Skill Registry*
