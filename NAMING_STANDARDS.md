# Organizational Naming Standards

> Permanent naming taxonomy for the AGS ecosystem.
> Adopted 2026-07-26 via GOV-001.
> This document is canonical — all future work MUST follow these rules.

---

## 1. Canonical Hierarchy

```
Company        AGS
Platform       AI Platform
Product        Concierge
Public Brand   AG Synergy

Roadmap        Concierge Roadmap
  └─ Phase
       └─ Epic
            └─ Sprint
                 └─ Story / Task
```

## 2. Naming Table

| Context | Internal Name | Public/Presentation Name | Rule |
|---|---|---|---|
| Company (legal entity) | AGS | AGS | Always use "AGS" |
| Organizational platform layer | AI Platform | AI Platform | Replaces "Hermes Platform" in governance hierarchy context |
| Internal product | Concierge | AG Synergy | Use "Concierge" in all engineering, planning, and governance documents |
| Customer-facing brand | — | AG Synergy | Never replace with Concierge on public surfaces |
| Public website domain | — | agsynergy.ca | No change |
| Repository | concierge-website | concierge-website | GitHub repo renamed from hermes-website |
| Roadmap | Concierge Roadmap | Concierge Roadmap | All roadmap naming |

## 3. When to Use Each Name

### Use "Concierge" (internal product name) when:

- Writing governance documents (PROJECT.md, ROADMAP.md, ARCHITECTURE.md, CHANGELOG.md)
- Naming epics, sprints, and phases
- Sprint planning and retrospectives
- Developer onboarding documentation
- Internal status reports
- Repository README and description
- CI/CD documentation
- Implementation plans

### Use "AG Synergy" (public brand) when:

- Website content and marketing copy
- Customer-facing communications
- Domain names (agsynergy.ca)
- Public API documentation
- Ops bot responses to users
- Any customer-visible surface

### Use "AI Platform" (organizational layer) when:

- Referring to the organizational hierarchy layer between AGS and Concierge
- Differentiating platform-owned assets from product-owned assets
- Post-MVP extraction planning
- Governance header in reports

### Use "AGS" (company) when:

- Legal, contractual, or entity context
- Top-level organizational identity
- Cross-company references

## 4. Prohibited Naming

| ❌ Deprecated | ✅ Replacement | Reason |
|---|---|---|
| hermes-website (repo name) | concierge-website | Repository identity migration |
| AG Synergy Product | Concierge | Internal product identity |
| AG Synergy Roadmap | Concierge Roadmap | Roadmap naming |
| Hermes Platform (as org layer) | AI Platform | Organizational hierarchy clarity |

## 5. Explicitly Preserved Names

The following retain their original names because they refer to the actual Hermes software platform, not the organizational layer:

- Hermes Agent (the AI assistant)
- hermes/ (source code directory)
- @hermes/* (TypeScript package namespaces)
- hermes-website (Cloudflare Worker name — until worker rename is planned)
- Hermes Execution Engine
- Hermes Platform (as software product name, distinct from org hierarchy)

## 6. Future Products

All future products shall follow the same hierarchy:

```
Company        AGS
Platform       AI Platform
Product        <New Product Name>
Public Brand   <Public Brand Name>

Roadmap        <Product Name> Roadmap
  └─ Phase
       └─ Epic
            └─ Sprint
                 └─ Story / Task
```

Every product gets its own roadmap.
Every phase belongs to exactly one product's roadmap.
Every epic belongs to exactly one phase.
Every sprint belongs to exactly one epic.