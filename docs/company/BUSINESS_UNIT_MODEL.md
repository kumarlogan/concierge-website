# AGS Business Unit Model

> **Defines all AGS business units, their responsibilities, and their relationships.**
> Business units are the top-level organizational division within AGS.
>
> **Version:** 1.0.0
> **Last Updated:** 2026-07-27
> **Framework:** WEF v1.1

---

## Governance Header

```
Company:        AGS
Business Unit:  Executive Office
Document:       Business Unit Model
Framework:      WEF v1.1
```

---

## 1. Business Unit Hierarchy

```
AGS (Company)
  │
  ├── Executive Office
  ├── Engineering
  ├── Marketing
  ├── Sales
  ├── Operations
  ├── Customer Success
  ├── Finance
  ├── Legal
  ├── Partnerships
  ├── Analytics
  ├── HR / People
```

Business units are **independent divisions** of AGS. Each business unit:
- Has its own leader
- Owns its own platforms (or shares platforms under the Enterprise Platform Model)
- Has its own workforce with defined responsibilities
- Executes work through WEF v1.1
- Reports to the AGS Executive Office

---

## 2. Business Unit Definitions

### Executive Office

| Attribute | Value |
|-----------|-------|
| **Leader** | CEO / Executive Team |
| **Purpose** | Company-wide strategy, governance, compliance, culture |
| **Platforms** | None (spans all platforms) |
| **Workforce** | Executive Workforce |
| **WEF Compatible** | ✅ Yes — approval gates, audit trails |
| **PSER Compatible** | ✅ Yes — company-level tracking |

**Responsibilities:**
- Company strategy and vision
- Enterprise policy and compliance
- Cross-business-unit coordination
- Executive decision-making
- Stakeholder relations
- Corporate governance

### Engineering

| Attribute | Value |
|-----------|-------|
| **Leader** | CTO / VP Engineering |
| **Purpose** | Build, maintain, and operate AGS technology platforms and products |
| **Platforms** | AI Platform (primary) |
| **Workforce** | Engineering Workforce |
| **WEF Compatible** | ✅ Yes (first adopter) |
| **PSER Compatible** | ✅ Yes |

**Responsibilities:**
- Platform and product development
- Infrastructure and operations
- Quality assurance and testing
- Security and compliance implementation
- Technical architecture and design
- Developer experience and tooling

### Marketing

| Attribute | Value |
|-----------|-------|
| **Leader** | CMO / VP Marketing |
| **Purpose** | Brand, demand generation, content, and market positioning |
| **Platforms** | Marketing Platform (future) |
| **Workforce** | Marketing Workforce |
| **WEF Compatible** | ✅ Yes |
| **PSER Compatible** | ✅ Yes |

**Responsibilities:**
- Brand management and positioning
- Content marketing and SEO
- Digital advertising and campaigns
- Social media management
- Market research and analysis
- Public relations

### Sales

| Attribute | Value |
|-----------|-------|
| **Leader** | VP Sales |
| **Purpose** | Revenue generation, client acquisition, partnership sales |
| **Platforms** | Operations Platform (future) |
| **Workforce** | Sales Workforce |
| **WEF Compatible** | ✅ Yes |
| **PSER Compatible** | ✅ Yes |

**Responsibilities:**
- Client acquisition and onboarding
- Pipeline management
- Proposal and contract management
- Revenue forecasting
- Account management
- Sales enablement

### Operations

| Attribute | Value |
|-----------|-------|
| **Leader** | COO / VP Operations |
| **Purpose** | Day-to-day business operations, clinic coordination, patient journey management |
| **Platforms** | Operations Platform, Knowledge Platform |
| **Workforce** | Operations Workforce |
| **WEF Compatible** | ✅ Yes |
| **PSER Compatible** | ✅ Yes |

**Responsibilities:**
- Clinic coordination and management
- Patient journey orchestration
- Quality assurance (operational)
- Compliance monitoring
- Process improvement
- Incident management

### Customer Success

| Attribute | Value |
|-----------|-------|
| **Leader** | VP Customer Success |
| **Purpose** | Patient satisfaction, retention, and advocacy |
| **Platforms** | Knowledge Platform (future) |
| **Workforce** | Customer Success Workforce |
| **WEF Compatible** | ✅ Yes |
| **PSER Compatible** | ✅ Yes |

**Responsibilities:**
- Patient onboarding and education
- Support and issue resolution
- Satisfaction measurement (NPS, CSAT)
- Retention and advocacy programs
- Patient feedback collection
- Escalation management

### Finance

| Attribute | Value |
|-----------|-------|
| **Leader** | CFO / VP Finance |
| **Purpose** | Financial planning, budgeting, accounting, treasury |
| **Platforms** | Finance Platform (future) |
| **Workforce** | Finance Workforce |
| **WEF Compatible** | ✅ Yes |
| **PSER Compatible** | ✅ Yes |

**Responsibilities:**
- Budgeting and forecasting
- Financial reporting and analysis
- Accounting and payroll
- Treasury and cash management
- Audit and compliance (financial)
- Tax planning and filing

### Legal

| Attribute | Value |
|-----------|-------|
| **Leader** | General Counsel |
| **Purpose** | Legal compliance, contracts, risk management, privacy |
| **Platforms** | None (cross-platform) |
| **Workforce** | Legal Workforce |
| **WEF Compatible** | ✅ Yes |
| **PSER Compatible** | ✅ Yes |

**Responsibilities:**
- Contract review and management
- Regulatory compliance (PIPEDA, PHIPA, CASL)
- Privacy and data protection
- Intellectual property management
- Litigation and dispute resolution
- Policy development

### Partnerships

| Attribute | Value |
|-----------|-------|
| **Leader** | VP Partnerships |
| **Purpose** | Strategic partnerships, clinic networks, provider relationships |
| **Platforms** | Operations Platform (shared) |
| **Workforce** | Partnerships Workforce |
| **WEF Compatible** | ✅ Yes |
| **PSER Compatible** | ✅ Yes |

**Responsibilities:**
- Partner identification and vetting
- Partnership agreement management
- Partner onboarding and enablement
- Relationship management
- Joint business planning
- Partner performance monitoring

### Analytics

| Attribute | Value |
|-----------|-------|
| **Leader** | VP Analytics / Chief Data Officer |
| **Purpose** | Data-driven insights, reporting, business intelligence |
| **Platforms** | Analytics Platform (future) |
| **Workforce** | Analytics Workforce |
| **WEF Compatible** | ✅ Yes |
| **PSER Compatible** | ✅ Yes |

**Responsibilities:**
- Business intelligence and reporting
- Data analytics and modeling
- Performance measurement
- A/B testing and experimentation
- Data governance and quality
- Predictive analytics

### HR / People

| Attribute | Value |
|-----------|-------|
| **Leader** | CHRO / VP People |
| **Purpose** | Talent management, culture, organizational development |
| **Platforms** | None (cross-platform) |
| **Workforce** | HR Workforce |
| **WEF Compatible** | ✅ Yes |
| **PSER Compatible** | ✅ Yes |

**Responsibilities:**
- Talent acquisition and recruitment
- Performance management
- Learning and development
- Compensation and benefits
- Employee relations
- Culture and engagement

---

## 3. Business Unit Relationships

```
                        ┌──────────────────┐
                        │  Executive Office │
                        └────────┬─────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
     ┌────┴────┐          ┌─────┴─────┐          ┌─────┴─────┐
     │Engineering│        │ Marketing  │          │   Sales    │
     └────┬────┘          └─────┬─────┘          └─────┬─────┘
          │                      │                      │
     ┌────┴────┐          ┌─────┴─────┐          ┌─────┴─────┐
     │Operations│        │Customer    │          │ Partnerships│
     └────┬────┘          │ Success    │          └─────┬─────┘
          │               └─────┬─────┘                │
     ┌────┴────┐          ┌─────┴─────┐          ┌─────┴─────┐
     │ Finance  │        │   Legal    │          │ Analytics  │
     └─────────┘          └───────────┘          └─────┬─────┘
                                                      │
                                               ┌──────┴──────┐
                                               │  HR / People │
                                               └─────────────┘
```

---

## 4. Business Unit Lifecycle

Business units are created through an ADR approved by the AGS Executive Office.

| Stage | Criteria | Authority |
|-------|----------|-----------|
| **Proposed** | Business case, scope, expected outcomes | Business Unit Lead |
| **Approved** | Executive approval, budget allocated | Executive Office |
| **Active** | Leader appointed, workforce assigned, WEF-active | Executive Office |
| **Mature** | Stable operations, documented processes, PSER-integrated | Business Unit Lead |
| **Restructured** | Merged, split, or redefined | Executive Office |

---

## 5. Current State

| Business Unit | Status | Lead | Workforce | Platform |
|---------------|--------|------|-----------|----------|
| Engineering | ✅ **Active** | CTO (acting) | Engineering Workforce | AI Platform |
| Executive Office | ✅ **Active** | CEO | Executive Workforce | — |
| Marketing | 📋 Planned | TBD | Marketing Workforce | Marketing Platform |
| Sales | 📋 Planned | TBD | Sales Workforce | Operations Platform |
| Operations | 📋 Planned | TBD | Operations Workforce | Operations Platform |
| Customer Success | 📋 Planned | TBD | Customer Success Workforce | Knowledge Platform |
| Finance | 📋 Planned | TBD | Finance Workforce | Finance Platform |
| Legal | 📋 Planned | TBD | Legal Workforce | — |
| Partnerships | 📋 Planned | TBD | Partnerships Workforce | Operations Platform |
| Analytics | 📋 Planned | TBD | Analytics Workforce | Analytics Platform |
| HR / People | 📋 Planned | TBD | HR Workforce | — |

---

*AGS Business Unit Model — v1.0.0*
*Last updated: 2026-07-27*
*Framework: WEF v1.1*