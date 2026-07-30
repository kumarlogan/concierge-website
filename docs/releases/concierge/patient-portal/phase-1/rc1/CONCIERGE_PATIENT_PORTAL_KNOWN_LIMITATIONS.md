# Concierge Patient Portal — Phase 1 Known Limitations

**Company:** AG Synergy  
**Product:** Concierge  
**Milestone:** Phase 1  
**Release:** RC1  
**Date:** 2026-07-29

---

This document records only approved deferred improvements and non-blocking
limitations. No new feature requests, roadmap items, or scope expansions are
included.

---

## Technical Debt

### TD-001: Consent API Integration
| Property | Value |
|----------|-------|
| **ID** | CP-101 |
| **Classification** | Technical Debt |
| **Target Phase** | Phase 2 |
| **Description** | ConsentManagementPage displays hardcoded consent categories. No backend API client exists for consent operations (grant, revoke, list). |
| **Impact** | Consent UI is informational only. Patients cannot actually grant or revoke consent through the portal. |
| **Mitigation** | Backend consent API to be implemented in Phase 2; UI is ready for integration. |

### TD-002: Notification Backend
| Property | Value |
|----------|-------|
| **ID** | CP-102 |
| **Classification** | Technical Debt |
| **Target Phase** | Phase 2 |
| **Description** | NotificationCenterPage is static — displays hardcoded notification categories rather than fetching real notifications from a backend service. |
| **Impact** | No real-time notification delivery. Patients see UI structure but no actual notifications. |
| **Mitigation** | Acceptable for limited pilot. Backend notification service planned for Phase 2. |

### TD-003: Timeline API Integration
| Property | Value |
|----------|-------|
| **ID** | CP-103 |
| **Classification** | Technical Debt |
| **Target Phase** | Phase 2 |
| **Description** | JourneyTimelinePage is a static placeholder. Backend timeline API exists but client integration pending. |
| **Impact** | Patients cannot view their treatment timeline through the portal. |
| **Mitigation** | timeline-api.ts client exists; full page integration in Phase 2. |

### TD-004: Document Storage & Upload
| Property | Value |
|----------|-------|
| **ID** | CP-104 |
| **Classification** | Technical Debt |
| **Target Phase** | Phase 2 |
| **Description** | Documents page is a placeholder. No document upload, storage, or retrieval functionality. |
| **Impact** | Patients cannot upload or view documents through the portal. |
| **Mitigation** | Backend document service planned for Phase 2. |

### TD-005: Automated Test Suite
| Property | Value |
|----------|-------|
| **ID** | CP-105 |
| **Classification** | Technical Debt |
| **Target Phase** | Phase 2 |
| **Description** | No test framework configured in the project. No unit, integration, or E2E tests exist. |
| **Impact** | No automated regression detection. Manual QA required for all changes. |
| **Mitigation** | Test framework (vitest recommended) to be configured in Phase 2 with targeted coverage for auth flows and critical patient journeys. |

### TD-006: ESLint Configuration
| Property | Value |
|----------|-------|
| **ID** | CP-106 |
| **Classification** | Technical Debt |
| **Target Phase** | Phase 2 |
| **Description** | ESLint v10 is installed globally but no project-level ESLint configuration exists. |
| **Impact** | Unused imports and code style inconsistencies can go undetected. |
| **Mitigation** | Flat config ESLint config to be added in Phase 2. |

### TD-007: Build Version Management
| Property | Value |
|----------|-------|
| **ID** | CP-110 |
| **Classification** | Technical Debt |
| **Target Phase** | Phase 2 |
| **Description** | `package.json` version is `0.0.0`. No automated version bump or release tagging workflow. |
| **Impact** | Releases cannot be uniquely identified from the build artifact metadata. |
| **Mitigation** | RC1 tag to be created manually post-validation; automation in Phase 2. |

---

## Deferred UX Improvements

### UX-001: Profile Loading State
| Property | Value |
|----------|-------|
| **ID** | CP-107 |
| **Classification** | Deferred UX Improvement |
| **Target Phase** | Phase 2 |
| **Description** | ProfilePage password change section has no loading indicator during initial data fetch. |
| **Impact** | Minor: user may briefly see an empty form before data loads. |
| **Mitigation** | Low priority; data loads quickly. Skip for limited pilot. |

### UX-002: Breadcrumb Navigation
| Property | Value |
|----------|-------|
| **ID** | CP-108 |
| **Classification** | Deferred UX Improvement |
| **Target Phase** | Phase 2 |
| **Description** | No breadcrumb navigation implemented in PatientLayout. |
| **Impact** | Users rely solely on sidebar for location context. Deeper pages may benefit from breadcrumbs. |
| **Mitigation** | Sidebar serves as primary navigation for Phase 1. Breadcrumbs added in Phase 2. |

### UX-003: CareCoordination Loading/Error States
| Property | Value |
|----------|-------|
| **ID** | CP-109 |
| **Classification** | Deferred UX Improvement |
| **Target Phase** | Phase 2 |
| **Description** | CareCoordinationPage initializes loading state as `false` and never sets it to `true`, so no loading indicator appears before API data resolves. No error state for fetch failures. |
| **Impact** | Brief flash of empty state before content loads; no feedback on network errors. |
| **Mitigation** | Low impact for pilot; data loads quickly. Proper loading/error state wiring in Phase 2. |

### UX-004: Missing Loading State — Static Pages
| Property | Value |
|----------|-------|
| **ID** | CP-111 |
| **Classification** | Deferred UX Improvement |
| **Target Phase** | Phase 2 |
| **Description** | NotificationCenterPage has no loading state (page is static with hardcoded categories). |
| **Impact** | Page loads instantly; once backend notifications are added, loading state will be needed. |
| **Mitigation** | Not currently needed; will be added alongside notification backend integration. |

---

## Summary

| Item | Classification | Phase |
|------|---------------|-------|
| Consent API integration | Technical Debt | Phase 2 |
| Notification backend | Technical Debt | Phase 2 |
| Timeline API integration | Technical Debt | Phase 2 |
| Document storage & upload | Technical Debt | Phase 2 |
| Automated test suite | Technical Debt | Phase 2 |
| ESLint configuration | Technical Debt | Phase 2 |
| Build version management | Technical Debt | Phase 2 |
| Profile loading state | Deferred UX | Phase 2 |
| Breadcrumb navigation | Deferred UX | Phase 2 |
| CareCoordination loading/error | Deferred UX | Phase 2 |
| Notification loading state | Deferred UX | Phase 2 |

**Total: 11 deferred items — 7 technical debt, 4 UX improvements.**
**None are release-blocking for the limited pilot.**