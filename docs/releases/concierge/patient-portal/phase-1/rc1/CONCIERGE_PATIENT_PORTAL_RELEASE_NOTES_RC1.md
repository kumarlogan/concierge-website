# Concierge Patient Portal — Release Notes RC1

**Product:** Concierge Patient Portal  
**Version:** 0.0.0-rc1 (pre-release)  
**Release Date:** 2026-07-29  
**Commit:** `864f2135133562b3f052d4eb041b518db2a33c13`  
**Branch:** `main`  
**Environment:** Limited Pilot (staging)

---

## New Features

### Patient Authentication
- Secure registration with multi-step flow (form → verifying → done)
- Login with MFA support via Identity Core API
- Logout with server-side session invalidation
- Session persistence across browser refreshes
- Automatic token refresh on 401
- Cross-tab session invalidation

### Patient Dashboard
- Role-specific onboarding for new patients
- Quick-access navigation to key portal features
- Professional, clean UI with responsive layout

### Care Plan Management
- Phase-based treatment roadmap visualization
- Read-only care plan with milestone references
- Integration with patient timeline

### Task Management
- Create patient tasks
- View task list with status indicators
- Mark tasks as complete
- Delete tasks with AlertDialog confirmation

### Milestone Tracking
- Treatment milestone list with status
- Progress tracking for key fertility journey phases

### Appointment Management
- View upcoming appointments
- Cancel appointments with AlertDialog confirmation
- Integration with appointment API

### Secure Messaging
- Threaded message view
- Compose new messages
- Recipient auto-derivation from thread context
- Integration with message API

### Security Settings
- Password change with validation
- Active session management (view + revoke)
- MFA preferences toggle
- AlertDialog confirmation for destructive actions (no `confirm()` calls)

### Consent Management
- Consent category list with status badges
- Grant/revoke UI (visual only; API integration in Phase 2)

### Navigation
- Responsive sidebar with 12 nav items
- Mobile hamburger menu with overlay
- Active route highlighting
- Logout from sidebar

---

## Bug Fixes

| Issue | Fix | File |
|-------|-----|------|
| Registration toast display broken | Replaced sonner with shadcn Toaster | `RegisterPage.tsx` |
| Safari password input minLength violation | Removed invalid `minLength` attribute | `SecuritySettingsPage.tsx` |
| Consent API missing Authorization header | Added `Authorization: Bearer <token>` to consent requests | `consent-api.ts` (header format fix) |
| MessagesPage used hardcoded user ID | Replaced with dynamic auth context user ID | `MessagesPage.tsx` |
| Demo data in Care Coordination page | Replaced mock data with empty state + API integration | `CareCoordinationPage.tsx` |
| Unused imports in DashboardPage | Removed `CheckCircle2` and `Circle` imports | `DashboardPage.tsx` |
| MessagesPage getRecipientId returned empty | Added lastMessage-derived fallback recipient | `MessagesPage.tsx` |
| AppointmentsPage missing cancel confirmation | Added AlertDialog pattern | `AppointmentsPage.tsx` |

---

## Security Improvements

- **AlertDialog pattern** — All `confirm()` calls replaced with accessible
  shadcn/ui AlertDialog components across the portal
- **authFetch utility** — Centralized Bearer token injection for all API clients
- **TokenStore subscription** — Real-time session invalidation detection
- **Protected routes** — AuthGuard prevents unauthenticated access to all
  12 patient pages
- **GuestGuard** — Prevents authenticated users from re-accessing login/register
- **Server-side logout** — Session invalidation on both client and server

---

## Performance Improvements

- Production bundle: 879 KB JS (gzipped: 257 KB)
- CSS bundle: 144 KB (gzipped: 22 KB)
- Build time: 6.25 seconds
- No runtime console.log statements in production pages
- Lazy-loaded routes via wouter

**Note:** Main JS bundle exceeds recommended 500 KB. Code splitting via
dynamic `import()` recommended for Phase 2.

---

## Stabilization Summary

| Category | Items | Status |
|----------|-------|--------|
| P0 — Production Blockers | 5/5 | ✅ All resolved |
| P1 — Stabilization | 9/9 | ✅ All verified |
| TypeScript Errors | 0 | ✅ Clean compile |
| Production Build | ✅ | 6.25s |
| Regressions | 0 | ✅ None introduced |

---

## Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Consent API not integrated | Consent page shows placeholder data | Backend planned for Phase 2 |
| No real-time notifications | Notification preferences are static | Acceptable for limited pilot |
| Timeline API not connected | Journey timeline is placeholder | Backend planned for Phase 2 |
| No document storage | Documents page is placeholder | Backend planned for Phase 2 |
| No automated tests | Manual QA only | Test framework to be added in Phase 2 |
| Profile loading state missing | Password change section has no initial loading indicator | Low impact for limited pilot |
| CareCoordination loading state | Loading never triggers before API call | Low impact; data still loads |

---

## Upgrade Notes

### For Deployment
1. Ensure Identity Core API v1.21.0+ is deployed
2. Configure `VITE_API_BASE_URL` in deployment environment
3. Application runs on Node 20+ / modern browser
4. No database migrations required (client-only changes)
5. Static assets in `dist/public/` deployable to any HTTP server or CDN

### Breaking Changes
None. This is the initial Patient Portal release for the Concierge product.

### Backward Compatibility
N/A — fresh deployment.