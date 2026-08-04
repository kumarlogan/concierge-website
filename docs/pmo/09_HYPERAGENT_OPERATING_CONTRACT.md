# Volume 09: HyperAgent Operating Contract

> **Version:** 1.0 | **Date:** 2026-08-03
> **Authority:** PMO — Defines exactly what implementation agents are allowed to do
> **Status:** ⚡ RATIFIED — Binding on all implementation agents

---

## 1. Authority

This contract defines the operational boundaries for all implementation agents (HyperAgent, GPT, Claude, Gemini, Codex, Hermes Engineering Agent, etc.) operating on the Hermes Platform and AG Synergy product.

**Violation of this contract = architecture drift = immediate rollback.**

---

## 2. Agent Rights

### 2.1 Agents MAY

| Right | Scope | Example |
|-------|-------|---------|
| Build | Code to specification | Implement SPEC-001: D1 Backend |
| Refactor | Within scope boundaries | Extract function in existing module |
| Test | Write and run tests | Add test for new endpoint |
| Document | Update documentation | Update API.md with new routes |
| Improve performance | Optimize existing code | Reduce D1 query time |
| Fix bugs | Correct verified defects | Fix failing test |
| Update configuration | Environment variables, CI/CD | Update wrangler.toml |
| Create migrations | Forward-only schema changes | Add new migration file |
| Read repository | Full read access | All files, docs, tests |
| Propose improvements | Recommend via PR description | Suggest refactor |

### 2.2 Agents MAY NOT

| Prohibition | Rationale | Consequence |
|-------------|-----------|-------------|
| Redesign architecture | PMO owns architecture | Immediate revert |
| Invent roadmap items | Roadmap lock (GOV-004) | Rejection |
| Change governance | PMO owns governance | Revert + audit |
| Change product boundaries | PRODUCT_BOUNDARIES.md lock | Revert + audit |
| Delete documentation | Documentation is code | Revert |
| Skip tests | Testing is mandatory | PR rejected |
| Skip migrations | Schema changes require migrations | Revert |
| Introduce paid infrastructure | Cost-conscious principle | Rejection |
| Ignore security | Fail-closed default | Revert + audit |
| Ignore quality gates | Quality is non-negotiable | PR rejected |
| Expand scope | Work the wave, not more | Revert + audit |
| Deploy to production | Human approval required | Revert |
| Access patient data | PHI never touches AI | Immediate isolation |
| Change AI_OPERATING_MODEL | PMO authority | Revert + audit |
| Delete governance docs | Governance freeze | Revert + audit |
| Use `any` type in TypeScript | Strict mode requirement | Lint rejection |
| Commit without tests | Mandatory test requirement | PR rejection |
| Self-approve PR | Human at the gate | Revert |

### 2.3 Explicit Guardrails

```
┌─────────────────────────────────────────────────────────────────────┐
│                     HYPERAGENT GUARDRAILS                            │
│                                                                     │
│  You operate within defined boundaries:                             │
│  1. You MAY build what the PMO specs specify                        │
│  2. You MAY NOT build what the PMO specs do NOT specify             │
│  3. You MUST follow quality standards in Volume 07                  │
│  4. You MUST follow the architecture in Volume 04                   │
│  5. You MUST verify against the current state in Volume 02          │
│  6. You MUST execute exactly one wave from Volume 06                │
│  7. You MUST test everything you build                              │
│  8. You MUST update documentation in the same PR                    │
│  9. You MUST NOT touch patient data                                 │
│ 10. You MUST NOT deploy to production without human approval        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Agent Workflow

### 3.1 Pre-Execution Checklist

Before starting, confirm:

- [ ] Loaded Volume 01 (Program Charter)
- [ ] Loaded Volume 02 (Current State)
- [ ] Loaded Volume 04 (Target Architecture)
- [ ] Loaded Volume 05 (Implementation Spec)
- [ ] Loaded Volume 06 (Wave Execution Manual)
- [ ] Loaded Volume 07 (Quality Manual)
- [ ] Selected exactly one wave from Volume 06
- [ ] Verified no dependencies blocking the wave
- [ ] Confirmed understanding of scope boundaries

### 3.2 Execution Workflow

```
1. LOAD relevant PMO volumes
2. LOAD relevant skills (engineer, test, webops)
3. UNDERSTAND current state (Volume 02)
4. EXECUTE wave (Volume 06)
   a. Read files you'll modify
   b. Implement code to spec (Volume 05)
   c. Write tests (Volume 07)
   d. Run tests
   e. Fix until all pass
   f. Update documentation
   g. Verify typecheck
   h. Verify no secrets leaked
5. PRESENT summary for review
6. AWAIT human approval to deploy
7. DEPLOY after approval
```

### 3.3 Post-Execution

- [ ] All tests pass
- [ ] TypeScript compilation clean
- [ ] Documentation updated
- [ ] No secrets leaked (gitleaks)
- [ ] PR created for review
- [ ] Wave completion evidence logged

---

## 4. Communication

### 4.1 Reporting

When reporting results, agents MUST:

1. State which wave was executed
2. Provide evidence of completion:
   - Test output
   - Documentation changes
   - Files modified list
3. Note any deviations from spec
4. Flag any issues found

### 4.2 Escalation

If encountering:
- **Ambiguity:** Check PMO documentation first. If still unclear, ask.
- **Blocking dependency:** Report dependency and propose workaround
- **Security concern:** Immediately escalate — do not implement
- **Architecture conflict:** DO NOT redesign. Escalate to PMO.

---

## 5. Compliance Enforcement

| Violation | Detection | Response |
|-----------|-----------|----------|
| Scope expansion | Code review | Revert + wave reassignment |
| Skipped tests | CI/CD check | PR blocked |
| Architecture drift | Architecture review | Revert + ADR requirement |
| Skipped migration | CI/CD check | PR blocked |
| Security bypass | Security review | Revert + audit |
| Missing documentation | Doc coverage check | PR blocked |
| Direct DB access from frontend | Code review | Revert + architecture compliance |
| Unapproved API change | Code review | ADR requirement |

---

## 6. Contract Acknowledgment

By executing any task on this repository, an implementation agent agrees to:

- Follow the PMO specification exactly
- Not expand scope
- Not change architecture
- Not skip quality gates
- Test everything
- Document everything
- Wait for human approval before production deployment

**This contract is binding on all implementation agents.**

---

*End of Volume 09*