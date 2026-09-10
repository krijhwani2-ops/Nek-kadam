# Test Infrastructure & Architecture: Nek Kadam Clinical Management System

## Executive Overview
This document details the test architecture, execution harness, and coverage tiers for the Nek Kadam Clinical Management System enhancements. The testing infrastructure is designed around **Vitest** in a `jsdom` simulated browser environment, providing full compatibility with DOM events, Web Audio API synthesis, IndexedDB caching, QR SVG rendering, and binary SQLite/Excel payload parsing.

---

## 1. Test Harness & Framework Configuration

- **Test Runner**: Vitest v4.1.10
- **Test Environment**: `jsdom` (simulated browser DOM for React components and Web APIs)
- **Setup Scripts**: `src/test/setup.ts` (configures `@testing-library/jest-dom`, mocks `idb` / IndexedDB storage, and global environment polyfills)
- **Assertion Libraries**: Vitest `expect`, `@testing-library/react`
- **Execution Command**:
  ```bash
  npm run test
  # or directly
  npx vitest run
  ```

---

## 2. Test Suite Organization & Coverage Tiers

The test suite is structured into multi-tiered layers covering all 4 core clinical enhancements:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    NEK KADAM CLINICAL MANAGEMENT SYSTEM                      │
├──────────────────────┬──────────────────────┬────────────────────────────────┤
│ Coverage Tier        │ Target Requirement   │ Test Scenarios & Mechanics     │
├──────────────────────┼──────────────────────┼────────────────────────────────┤
│ Tier 1: Security &   │ R1: Delta Sync &     │ • Delta queries with           │
│ Synchronization      │ Endpoint Security    │   last_sync_time filtering     │
│                      │                      │ • HTTP 401/403 unauth rejected │
│                      │                      │ • Bidirectional LWW conflict   │
│                      │                      │ • Incremental cache retention  │
├──────────────────────┼──────────────────────┼────────────────────────────────┤
│ Tier 2: Real-Time &  │ R2: Pharmacy Traffic │ • Atomic CAS claiming lock     │
│ Concurrency          │ Control Queue        │ • HTTP 409 duplicate claim     │
│                      │                      │ • Traffic badges (Amber, Blue, │
│                      │                      │   Emerald Green)               │
│                      │                      │ • Web Audio API 3-tone chime   │
├──────────────────────┼──────────────────────┼────────────────────────────────┤
│ Tier 3: Storage &    │ R3: DB Backup &      │ • Password-free SQLite backup  │
│ Reporting            │ Donor Excel Export   │ • SQLite format 3 magic header │
│                      │                      │ • Restore validation & reject  │
│                      │                      │ • 3-Sheet Excel workbook (XLSX)│
├──────────────────────┼──────────────────────┼────────────────────────────────┤
│ Tier 4: Hardware &   │ R4: Patient QR Code  │ • QRCodeSVG component render   │
│ Peripherals          │ & OPD Token Slip     │ • cleanPatientId & float strip │
│                      │                      │ • Multi-format QR parse tests  │
│                      │                      │ • Pocket OPD token print CSS   │
└──────────────────────┴──────────────────────┴────────────────────────────────┘
```

---

## 3. Detailed Specification Breakdown

### Tier 1: Delta Synchronization & Endpoint Security (R1)
- **Delta Query Filtering**:
  - Validates `POST /api/sync/delta` using `last_sync_time` parameter.
  - Ensures only records with `updated_at > last_sync_time` are included in the network payload, preventing redundant transmission of the full 4,800+ record dataset.
  - Verifies initial sync fallback when `last_sync_time` is null.
- **Endpoint Security**:
  - Verifies that unauthenticated calls or requests with invalid tokens return HTTP 401 Unauthorized.
  - Ensures valid session tokens allow access with appropriate role context.
- **Bidirectional Reconciliation (Last-Write-Wins)**:
  - Evaluates timestamp comparison (`updated_at`) between local IndexedDB cache and incoming remote changes.
  - Protects offline clinical edits from being overwritten by older server records.
  - Preserves unmodified cached records during incremental updates.

### Tier 2: Pharmacy Traffic Control Queue (R2)
- **Atomic CAS Order Claiming**:
  - Emulates atomic database lock: `UPDATE medicine_tasks SET status='IN_PROGRESS', claimedBy=?, claimedAt=datetime('now'), updatedAt=datetime('now') WHERE id=? AND status='PENDING'`.
  - Confirms state transition from `PENDING` to `IN_PROGRESS` upon claim.
- **Duplicate Claim Prevention**:
  - Second volunteer attempting to claim an active or completed order receives HTTP 409 Conflict.
  - Original claim is preserved without race-condition overwriting.
- **Visual Traffic Badges**:
  - `PENDING`: Amber badge tokens (`bg-amber-500/15`, `text-amber-300`).
  - `IN_PROGRESS`: Blue badge tokens (`bg-blue-500/15`, `text-blue-300`) with operator name and workbench action.
  - `READY` / `DELIVERED`: Emerald Green badge tokens (`bg-emerald-500/15`, `text-emerald-300`).
- **Offline Audio Chime Synthesis**:
  - Native Web Audio API synthesis creating an ascending 3-tone chord (D5: 587.33Hz, F#5: 739.99Hz, A5: 880.00Hz) with exponential gain decay, eliminating dependencies on external audio files.

### Tier 3: Database Backup & Formatted Donor Export (R3)
- **1-Click SQLite Hot Backup**:
  - Endpoint `GET /api/backup/download` whitelisted in `PUBLIC_PATHS` for password-free volunteer access.
  - Header validation: `Content-Type: application/x-sqlite3` and `Content-Disposition: attachment; filename="nekkadam_backup_*.sqlite"`.
  - Content validation: First 16 bytes contain SQLite 3 magic header `SQLite format 3\0`.
- **Backup File Validation**:
  - Confirms corrupted or non-SQLite files are rejected during restore with HTTP 400.
- **3-Sheet Formatted Donor Excel Report**:
  - Generates valid `.xlsx` binary workbook using `xlsx` library with 3 dedicated worksheets:
    1. **Camp Summary**: Total registrations, new vs follow-up, gender distribution, pediatric/adult/geriatric age groups.
    2. **Diagnosis & Symptoms**: Condition frequencies, ranking, and percentages of total visits.
    3. **Pharmacy Stock Consumption**: Aggregated dispensed medicine codes, descriptions, and total quantities.
  - Zero-division safety checks for empty datasets.

### Tier 4: Patient QR Code & OPD Token Slip (R4)
- **QR Code Generation**:
  - Validates `QRCodeSVG` rendering with error correction level `H` and `M`.
  - Verifies encoding of `CARD-${patient.card_number}` or raw card number.
- **Scanner Parser Compatibility**:
  - Verifies `cleanPatientId()` sanitizes `.0` Excel float suffixes, whitespace, and null/undefined values.
  - Validates regex parsing of URLs (`/patients/4814`), prefixes (`CARD-`, `NK-`, `OPD-`, `PATIENT:`, `ID_`), query parameters, and hash fragments.
- **Pocket OPD Slip Layout**:
  - Validates `.printable-opd-token` container width (320px / 80mm receipt format).
  - Confirms visibility isolation under print styles (`body.printing-opd-token`).

---

## 4. Test File Locations

| File Path | Description |
|-----------|-------------|
| `tests/clinical_enhancements_e2e.test.ts` | Complete E2E & integration suite for all 4 clinical enhancements (R1–R4) |
| `src/__tests__/integration/queueTasks.test.tsx` | UI integration tests for medicine queue and token queue actions |
| `src/__tests__/integration/patientSearch.test.tsx` | Integration tests for patient lookup and search filtering |
| `src/__tests__/integration/addMedicines.test.tsx` | Integration tests for medicine creation and bulk import |
| `src/lib/dateUtils.test.ts` | Unit tests for clinical date manipulation |
| `src/lib/educationService.test.ts` | Unit tests for education module API service |
| `src/lib/tokenService.test.ts` | Unit tests for department token routing |

---

## 5. Verification & Continuous Validation

To execute the test suite across all tiers:
```bash
npm run test
```

Expected Output:
```
✓ tests/clinical_enhancements_e2e.test.ts
✓ src/__tests__/integration/addMedicines.test.tsx
✓ src/__tests__/integration/patientSearch.test.tsx
✓ src/__tests__/integration/queueTasks.test.tsx
✓ src/lib/dateUtils.test.ts
✓ src/lib/educationService.test.ts
✓ src/lib/__tests__/utils.test.ts
✓ src/lib/tokenService.test.ts

Test Files  8 passed (8)
Tests       66+ passed
```
