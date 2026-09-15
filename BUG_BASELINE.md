# Nek Kadam OS - Bug Baseline (Phase 0 Freeze)

**Audit Date**: 2026-09-15  
**Baseline Test Execution**: `npx vitest run` (12 Test Files, 121 Tests: 115 Passed, 6 Failed)  
**Baseline TypeScript Compilation**: `npx tsc --noEmit` (Clean, 0 errors)  
**Git Branch**: `main` (Up to date with origin/main)  

---

## Cataloged Baseline Bugs

### BUG-001: Missing `apiFetch` export in `src/lib/educationService.test.ts`
- **Severity**: HIGH
- **Affected Files**: `src/lib/educationService.test.ts`, `src/lib/educationService.ts`
- **Current Behavior**: Tests in `src/lib/educationService.test.ts` mock `./session` without providing `apiFetch`. Following the cloud URL unification, `educationService.ts` imports `apiFetch`. As a result, 5 unit tests fail with `[vitest] No "apiFetch" export is defined on the "./session" mock`.
- **Expected Behavior**: `./session` mock must export `apiFetch` so test suite executes successfully and handles network timeouts and errors properly.
- **Proposed Owner**: Agent 5 (Offline / Sync) & Agent 9 (QA / Testing)

### BUG-002: `AddMedicines.tsx` Modal Text Mismatch in Integration Test
- **Severity**: MEDIUM
- **Affected Files**: `src/pages/AddMedicines.tsx`, `src/__tests__/integration/addMedicines.test.tsx`
- **Current Behavior**: `src/__tests__/integration/addMedicines.test.tsx` expects clicking `Add One` to display `Register New Medicine`. The UI header text was modified or styled in a way that the query fails, causing 1 test failure.
- **Expected Behavior**: Text headers, aria labels, and modal opening behavior must align with test specifications and user expectations.
- **Proposed Owner**: Agent 3 (Medicine / Pharmacy)

### BUG-003: Token Absent Patient Queue Re-Entry / Reordering
- **Severity**: HIGH
- **Affected Files**: `src/pages/TokenQueue.tsx`, `src/services/tokenService.ts`, `src/services/queueService.ts`
- **Current Behavior**: When a token is marked absent/skipped, returning patients do not consistently reposition to the end of the active queue without race conditions or manual re-registration.
- **Expected Behavior**: Strict physical workflow: FIFO order. If marked absent/skipped, returning patient moves to the END of the current waiting queue. Never permanently deleted or lost.
- **Proposed Owner**: Agent 2 (Token / Queue)

### BUG-004: Pharmacy Task Preparation vs Handover Order Decoupling
- **Severity**: HIGH
- **Affected Files**: `src/pages/MedicineQueue.tsx`, `src/pages/MedicineDashboard.tsx`, `src/services/medicineService.ts`
- **Current Behavior**: Pharmacy workflow tightly couples preparation order to queue sequence. When multiple volunteers prepare prescriptions in parallel, out-of-order preparation risks race conditions or task collisions.
- **Expected Behavior**: Decouple PREPARATION ORDER from PATIENT HANDOVER ORDER. Support CAS/claim locking for concurrent preparation while strictly maintaining patient UUID, visit UUID, and token linkages.
- **Proposed Owner**: Agent 3 (Medicine / Pharmacy)

### BUG-005: Duplicate Token Creation on Double-Click / Race Condition
- **Severity**: HIGH
- **Affected Files**: `src/pages/TokenRegistration.tsx`, `src/services/tokenService.ts`
- **Current Behavior**: Rapid double-clicking on "Generate Token" or scanning patient QR twice in quick succession can generate duplicate active tokens for the same patient on the same day.
- **Expected Behavior**: Idempotent token generation per patient-visit per camp day with client-side submit lock and server-side conflict resolution.
- **Proposed Owner**: Agent 2 (Token / Queue)

### BUG-006: Android Hardware Back Button Exits App
- **Severity**: MEDIUM
- **Affected Files**: `src/App.tsx`
- **Current Behavior**: On Android devices running via Capacitor, pressing the hardware back button when a modal, patient profile, or search drawer is open closes the entire application instead of popping the navigation stack or closing the modal.
- **Expected Behavior**: Intercept Capacitor `backButton` event; if history exists or modal is open, go back / close modal; only exit if at root dashboard.
- **Proposed Owner**: Agent 6 (Android / Capacitor) & Agent 8 (UI / UX + Navigation)

### BUG-007: Mobile Responsive Touch Targets & Viewport Overflow
- **Severity**: MEDIUM
- **Affected Files**: `src/pages/Dashboard.tsx`, `src/pages/PatientsList.tsx`, `src/pages/PatientProfile.tsx`
- **Current Behavior**: Certain table columns and action buttons have touch targets smaller than 44px or fixed min-widths causing horizontal scrolling on small mobile screens.
- **Expected Behavior**: Touch targets >= 44px, safe area padding, overflow-x-auto on data tables with responsive column visibility.
- **Proposed Owner**: Agent 8 (UI / UX + Navigation)
