# Product Boundaries

> Version 1.0 | 2026-07-18
>
> Defines the scope of the AG Synergy platform. This document establishes what the
> platform provides, what responsibilities remain with healthcare providers, and
> what boundaries must be maintained. When scope questions arise, this document
> provides the answer.

---

## 1. Purpose

AG Synergy is a **fertility concierge and healthcare journey coordination platform**.
It provides technology-enabled support, communication, organization, and connection
between patients and healthcare providers.

The platform is not a medical device. It is not a healthcare provider. It is not a
substitute for clinical judgment. It is an operational and informational layer that
sits between patients, concierge staff, and partner clinics — reducing friction,
increasing transparency, and ensuring that every journey is supported by clear
processes and reliable information.

The platform's value is in coordination, not in clinical decision-making. Every
boundary in this document reinforces that distinction.

---

## 2. Core Services

AG Synergy provides the following services. These define what the platform does.
Anything not listed here is out of scope unless explicitly added through a
documented decision process.

| Service | Description |
|---|---|
| Patient education | General fertility information, treatment option overviews, clinic comparison guides, cost frameworks, and journey planning resources |
| Clinic discovery and connection | Curated clinic profiles, capability matching, and facilitated introductions between patients and partner clinics |
| Communication coordination | Structured messaging, status updates, and information routing between patients, concierge staff, and clinic staff |
| Consultation scheduling support | Calendar coordination, appointment reminders, and pre-consultation preparation guidance |
| Document organization | Secure collection, storage, and sharing of medical records, consent forms, test results, and travel documents |
| Travel and logistics coordination | Visa guidance, accommodation recommendations, local transportation information, and stay-planning resources |
| Journey tracking | Status dashboards showing treatment phase, upcoming milestones, completed steps, and next actions |
| Administrative assistance | Form completion support, insurance guidance, payment coordination, and record-keeping |
| General fertility information | Educational content about IVF, surrogacy, egg donation, embryo transfer, and related topics — clearly labelled as informational, not medical advice |

These services may be delivered through a combination of automated platform features
and human concierge support. The platform automates what can be automated; the
concierge team handles what requires human judgment and empathy.

---

## 3. Healthcare Provider Responsibilities

Medical professionals — including doctors, nurses, embryologists, and clinic staff
at partner facilities — retain full and exclusive responsibility for the following:

| Responsibility | Description |
|---|---|
| Diagnosis | Determining medical conditions, fertility status, and treatment eligibility |
| Medical advice | Recommending specific treatments, procedures, or courses of action based on clinical assessment |
| Treatment plans | Designing and prescribing the sequence, dosage, and timing of medical interventions |
| Medication decisions | Prescribing drugs, determining dosages, and managing medication protocols |
| Clinical procedures | Performing IVF, embryo transfer, egg retrieval, surrogacy procedures, and all other medical interventions |
| Medical outcomes | The results of any treatment, procedure, or medical intervention |

AG Synergy does not influence, override, or second-guess medical decisions made by
qualified healthcare providers. The platform facilitates the journey around the
medical care — it does not deliver the medical care itself.

---

## 4. AI Responsibilities

AI agents operating within the AG Synergy platform may assist with the following:

| Permitted | Description |
|---|---|
| Information organization | Structuring, categorizing, and surfacing relevant information for patients and concierge staff |
| General education | Answering informational questions using approved content; all AI-generated educational content must be clearly labelled as such |
| Workflow assistance | Suggesting next steps, flagging incomplete tasks, and automating routine coordination activities |
| Communication drafting | Preparing message templates and draft communications for human review before sending |
| Administrative automation | Processing form data, updating status trackers, and handling repetitive data entry |
| Navigation support | Guiding users through the platform, explaining features, and helping locate information |

AI agents must **not** perform any of the following:

| Prohibited | Description |
|---|---|
| Diagnose | AI must not assess, suggest, or imply any medical diagnosis |
| Prescribe | AI must not recommend, suggest, or endorse any medication, dosage, or treatment protocol |
| Override medical professionals | AI must not contradict, question, or undermine the guidance provided by a qualified healthcare provider |
| Provide guaranteed outcomes | AI must not promise, predict, or guarantee any medical result, success rate, or treatment outcome |
| Make clinical decisions | AI must not make any determination that affects a patient's medical care |

These boundaries apply to all AI agents, regardless of model provider, capability,
or context. They are absolute and may not be relaxed through configuration or
prompt engineering.

---

## 5. Patient Data Principles

All patient data handled by the platform is governed by the following principles:

**Collect only required information.**

Every data field must have a clear and documented purpose. Do not collect data
"just in case." Regularly audit data collection practices and remove fields that
are no longer necessary.

**Protect sensitive information.**

Patient data must be protected with the highest available safeguards. This
includes encryption in transit and at rest, strict access controls, and
minimization of data exposure in logs, errors, and debugging output.

**Use secure storage.**

Patient data must be stored only in approved, secured data stores (Cloudflare D1
for structured data, Cloudflare R2 for documents). No patient data may be stored
in unsecured locations, local filesystems, or third-party services without
explicit review and approval.

**Provide transparency.**

Patients must be informed of what data is collected, why it is collected, how it
is used, and who has access to it. Data practices must be documented in a privacy
policy that is accessible and written in plain language.

**Maintain appropriate access controls.**

Access to patient data must be based on need and role. Concierge staff access what
they need to support patients. Clinic staff access what they need to deliver care.
No one accesses data without a documented purpose. Access must be revocable and
auditable.

---

## 6. Platform Evolution Boundaries

The platform evolves through defined phases. Each phase has a clear scope boundary.
Features from a future phase are not developed until that phase is active.

### Phase 1: Concierge Platform

The platform as a digital concierge tool. Core services (Section 2) are delivered
through a combination of static content, structured workflows, and human concierge
support. The platform organizes; humans coordinate.

**In scope:** Patient education content, clinic profiles, consultation scheduling,
document organization, journey tracking dashboards, concierge workflow tools.

**Out of scope:** Patient self-service portal, clinic-facing dashboards, automated
clinical workflows, AI-assisted clinical decision support.

### Phase 2: Patient Workflow Platform

Patients gain direct access to a personalized portal for journey management.

**In scope:** Patient accounts and authentication, personal journey dashboard,
secure document upload and download, direct messaging with concierge, status
tracking and notifications, appointment management.

**Out of scope:** Clinic-side workflow tools, AI-assisted clinical features,
integration with clinic EMR systems.

### Phase 3: Clinic Collaboration Platform

Partner clinics gain platform access for coordinated care delivery.

**In scope:** Clinic accounts and dashboards, shared patient journey views,
clinic-side document management, structured communication channels, treatment
milestone tracking, reporting and analytics for clinic operations.

**Out of scope:** Clinical decision support systems, EMR replacement, medical
device integration, telemedicine delivery.

### Phase 4: Healthcare Technology Ecosystem

The platform matures into an integrated ecosystem connecting patients, clinics,
and third-party services.

**In scope:** API ecosystem for third-party integration, advanced analytics and
reporting, AI-assisted operational intelligence, multi-clinic coordination,
expanded service offerings.

**Out of scope:** Direct medical service delivery, insurance underwriting,
pharmaceutical services, regulated medical device functionality.

### Phase Transition Rule

Movement from one phase to the next requires:
1. Completion of the current phase's defined scope
2. An ADR documenting the decision to advance
3. Updated PRODUCT_BOUNDARIES.md reflecting the new active phase

---

## 7. Success Definition

AG Synergy succeeds when it demonstrably achieves the following outcomes:

**Makes fertility journeys easier to navigate.**

Patients report reduced confusion, clearer expectations, and greater confidence
in their journey. Information is accessible, processes are transparent, and
support is available when needed.

**Improves communication.**

Messages reach the right person at the right time. Patients are not left guessing.
Clinics receive complete and organized information. The concierge team has full
visibility into every active journey.

**Reduces administrative burden.**

Repetitive tasks are automated. Forms are pre-filled where possible. Status
tracking is automatic. Both patients and staff spend less time on paperwork and
more time on the human elements of care.

**Creates trusted connections.**

Patients trust the platform to protect their data. Clinics trust the platform to
deliver prepared patients. The concierge team trusts the platform to surface what
needs attention. Trust is earned through reliability, transparency, and
consistency.

Success is measured by patient outcomes, not by features shipped. A platform with
fewer features that patients trust and use is more successful than a platform with
many features that patients avoid.

---

*End of Product Boundaries. Version 1.0, ratified 2026-07-18.*