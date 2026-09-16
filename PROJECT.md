# Project: Nek Kadam Production Hardening & Live Audit (Follow-up 2026-09-15)

## Architecture
- **Backend (LAN / Local Mode)**: `server.cjs` (Node.js + Express + `better-sqlite3` on SQLite `nekkadam.db`).
- **Backend (Cloud / Internet Mode)**: `server_pg.cjs` (Node.js + Express + `pg` Pool on PostgreSQL / Supabase). Live at `https://nek-kadam.onrender.com`.
- **Frontend / Client**: React 18 + TypeScript + Vite + Tailwind CSS + Lucide icons.
- **Client Offline Storage**: IndexedDB (`src/lib/db.ts`) with delta sync and write queue.
- **Queue & Real-Time**: CAS claim locking on `medicine_tasks`, department token queues (`tokens` with `sequenceIndex`), Web Audio API alerts, BroadcastChannel, and Socket.IO telemetry.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | PostgreSQL Schema Drift Fix | Migration `005_token_queue_schema_fix.sql` & `server_pg.cjs` auto-migration adding missing columns to `tokens` and `departments` | M1 | Survey 1 & 3 |
| 2 | Education Batches Boolean Fix | Fix `batches."isActive" = 1` boolean comparison crash in `server_pg.cjs` | M1 | Survey 3 |
| 3 | SQLite Token Route Parity | Implement missing `/api/tokens`, `/move`, `/skip`, `/requeue`, `/cancel`, `/priority` in `server.cjs` | M1 | Survey 1 |
| 4 | Skipped Requeue End-of-Queue | Ensure `requeue` strictly assigns `sequenceIndex = MAX(sequenceIndex) + 1` in both backends | M1 | Survey 1 |
| 5 | Prescription Save Double-Click Guard | Add synchronous `useRef` lock in `PatientProfile.tsx:handleSaveVisit` to prevent duplicate visits/tasks | M1 | Survey 3 |
| 6 | TokenQueue Route & Navigation | Add `<Route path="/tokens" element={<TokenQueue />} />` in `App.tsx` and link in Sidebar, Drawer, Bottom Nav | M2 | Survey 2 |
| 7 | OPD QR Slip Print Visibility | Update `@media print` in `src/index.css` and container in `PatientProfile.tsx` to fix blank printouts | M2 | Survey 2 |
| 8 | Touch Target Ergonomics (>=44px) | Upgrade sub-44px touch targets in `TokenQueue`, `NewPatient`, `PatientProfile`, `App` TopBar to >= 44px | M2 | Survey 2 |
| 9 | Modal Backdrop & Escape Dismissal | Add backdrop click dismissal and `Escape` key handling to `BarcodeScannerModal`, `FaceScannerModal`, etc. | M2 | Survey 2 |
| 10 | 360px Mobile Overflow Fix | Add `shrink-0` and `truncate` to `Dashboard.tsx:370` activity log to prevent horizontal blowout | M2 | Survey 2 |
| 11 | Full Clinical Flow E2E Verification | Verify full patient cycle: Registration -> Token -> Visit -> Pharmacy CAS Claim -> Pack -> Handover | M3 | User Request R1 |
| 12 | Vitest Regression & Build Gate | Verify all 12 Vitest test suites (121 tests) pass and production build (`npm run build`) exits 0 | M3 | User Request R4 |
| 13 | Forensic Integrity Audit | Independent forensic audit ensuring authentic implementation without mocks or test cheats | M3 | User Request R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Schema, Token Parity & Concurrency Fixes | Features 1–5: PostgreSQL schema migration, batches query fix, `server.cjs` route parity, requeue sequenceIndex, double-click guard | none | PLANNED |
| M2 | Frontend Routing, Print & UI/UX Touch Ergonomics | Features 6–10: `TokenQueue` route/nav, OPD print CSS, >=44px touch targets, modal backdrop/escape, 360px overflow | M1 | PLANNED |
| M3 | E2E Clinical Verification, Regression & Audit Gate | Features 11–13: Full lifecycle verification, 12 vitest suites (121 tests), build passing, forensic audit | M1, M2 | PLANNED |

## Interface Contracts

### 1. Token Requeue Endpoint (`POST /api/tokens/requeue`)
- **Request Body**: `{ "tokenId": "..." }`
- **Behavior**: Retrieves `MAX("sequenceIndex")` for the token's current department and dateKey.
- **Contract**: Sets `status = 'WAITING'` and `"sequenceIndex" = MAX("sequenceIndex") + 1`.

### 2. Pharmacy Task Claiming Endpoint (`POST /api/queue/claim`)
- **Request Body**: `{ "taskId": "...", "operatorName": "..." }`
- **Atomic CAS Query**: `UPDATE medicine_tasks SET status='IN_PROGRESS', "claimedBy"=$1, "claimedAt"=CURRENT_TIMESTAMP WHERE id=$2 AND status='PENDING'`
- **Contract**: Returns HTTP 200 `{ success: true, taskId, claimedBy }` on success; HTTP 409 Conflict `{ error: 'Task already claimed or not pending', currentStatus, claimedBy }` if already claimed.

### 3. OPD Token Print Contract
- **Trigger**: Click "Print OPD QR Card / Slip" on `PatientProfile.tsx`.
- **DOM Container**: Must include class `.printable-opd-token` or `.printable-prescription`.
- **CSS Rule**: `@media print { .printable-opd-token, .printable-opd-token * { visibility: visible !important; } }`

## Code Layout
- `server_pg.cjs`: PostgreSQL backend, schema auto-migration, token queue endpoints, boolean query fixes.
- `server.cjs`: SQLite backend, token queue endpoints, delta sync, database backup/restore.
- `infra/postgres/migrations/005_token_queue_schema_fix.sql`: DDL migration for `tokens` and `departments`.
- `src/App.tsx`: Routing (`/tokens`), navigation menus, TopBar action buttons.
- `src/index.css`: Print media styles for prescriptions and OPD QR slips.
- `src/pages/TokenQueue.tsx`: Department token queue progression, action buttons touch targets.
- `src/pages/PatientProfile.tsx`: Double-click guard on `handleSaveVisit`, OPD print slip container, touch targets.
- `src/pages/NewPatient.tsx`: Combination remove touch targets.
- `src/pages/Dashboard.tsx`: Activity log 360px layout containment.
- `src/components/BarcodeScannerModal.tsx`: Backdrop click and Escape dismissal.
- `src/components/face/FaceScannerModal.tsx`: Backdrop click and Escape dismissal.
- `tests/`: Automated Vitest unit and integration suites.
