# Milestone R3: Codebase, Build Setup, Date Logic & Architecture Analysis

## 1. Executive Summary
This document provides a comprehensive exploration of the **Nek Kadam OS** application for Milestone R3. The analysis covers the build system (`npm run build`), TypeScript configuration, test infrastructure, date parsing & formatting safety audit across all modules, and full project structure mapping.

---

## 2. Build Setup, Dependencies & Test Infrastructure

### 2.1 Package & Build Pipeline Inspection
- **Configuration File**: `package.json`
- **Build Command**: `npm run build` which runs `"tsc && vite build"`.
- **Bundler & Compiler**:
  - `typescript`: `^5.2.2`
  - `vite`: `^5.0.8` (`vite v5.4.21` runtime)
  - `@vitejs/plugin-react`: `^4.2.1`
- **Linting Script**: `"lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0"`
- **Main App Entry**: `index.html` -> `src/main.tsx` -> `src/App.tsx`
- **Electron Entry**: `electron-main.cjs`
- **Capacitor Mobile Config**: `capacitor.config.ts` (Android app ID `org.nekkadam.app`)

### 2.2 Key Dependencies Overview
- **UI Framework**: React 18.2.0, React DOM 18.2.0, React Router DOM 6.21.1
- **Styling**: Tailwind CSS 3.4.0, Autoprefixer 10.4.16, PostCSS 8.4.32, `clsx`, `tailwind-merge`
- **Icons**: `lucide-react` (0.303.0)
- **Database & Storage**: `idb` (8.0.3 IndexedDB wrapper), `better-sqlite3` (backend), `pg` (PostgreSQL server driver)
- **Real-Time Communications**: `socket.io` & `socket.io-client` (4.8.3)
- **State & Utilities**: `zustand` (4.4.7), `papaparse` (5.5.3), `xlsx` (0.18.5), `qrcode.react` (4.2.0), `pptxgenjs` (4.0.1)

### 2.3 TypeScript Configuration Audit (`tsconfig.json`)
- Target: `ES2020`
- Module: `ESNext`, `moduleResolution: "bundler"`
- Strictness: `strict: false`, `noImplicitAny: false`, `noUnusedLocals: false`, `noUnusedParameters: false`
- Includes: `["src"]`
- Node TS reference: `./tsconfig.node.json`

### 2.4 Test Suite & Quality Assurance Setup
- **Current State**:
  - **No automated test runner** (Vitest, Jest, React Testing Library, Cypress, or Playwright) is defined in `package.json`.
  - **No test scripts** exist under `scripts` in `package.json` (e.g., `"test"` script is missing).
  - Native Android test folder exists at `android/app/src/test` (JUnit placeholder).
  - Root directory contains standalone node verification/test scripts for DB/ping testing (`test_fetch.cjs`, `test_pg_pass.cjs`, `test_ping.cjs`, `verify_data.js`).
- **Recommendation**: For Milestone R3 validation, a Vitest or lightweight test runner setup can be added if automated unit test execution is desired, or validation can be performed via build verification and manual runtime testing.

---

## 3. Date Parsing & Formatting Safety Audit

### 3.1 Existing Date Utilities
An existing helper function `safeParseDate` is currently defined inline across two pages (`MedicineQueue.tsx` line 38-42 and `Dashboard.tsx` line 77-81):
```typescript
const safeParseDate = (s?: string) => {
  if (!s) return new Date(0);
  const formatted = s.includes('T') ? s : s.replace(' ', 'T');
  return new Date(formatted.includes('Z') || formatted.includes('+') ? formatted : formatted + 'Z');
};
```
**Issue**: This helper is duplicated locally inside page components rather than residing in a shared utility file (such as `src/lib/utils.ts` or `src/lib/dateUtils.ts`).

### 3.2 Audit of Vulnerable Date Operations
A systematic audit of all `new Date()`, `.toLocaleDateString()`, `.toISOString()`, `.toDateString()`, and `.toLocaleTimeString()` calls revealed multiple locations vulnerable to `RangeError: Invalid time value` crashes or rendering `"Invalid Date"` when handling missing, null, or non-ISO formatted database strings:

| File Path | Line No. | Code Snippet | Identified Risk / Failure Case |
| flex | --- | --- | --- |
| `src/pages/PatientProfile.tsx` | 668 | `{new Date(visit.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}` | Throws `RangeError: Invalid time value` or renders `"Invalid Date"` if `visit.date` is null, empty string `""`, or invalid date format from legacy DB imports. |
| `src/pages/PatientProfile.tsx` | 1217 | `{new Date(selectedVisit.date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}` | Uncaught crash during prescription printing if `selectedVisit.date` is invalid. |
| `src/pages/PatientProfile.tsx` | 351, 489 | `date: new Date(visitDate).toISOString()` | Throws `RangeError: Invalid time value` if `visitDate` input field is empty string or malformed. |
| `src/pages/Attendance.tsx` | 236 | `{new Date(date).toDateString()}` | Renders `"Invalid Date"` or crashes if `date` state is empty or invalid string. |
| `src/pages/Chat.tsx` | 251 | `{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` | Throws `RangeError` if `msg.timestamp` is undefined or malformed ISO string. |
| `src/pages/PatientsList.tsx` | 164, 177 | `{new Date(p.last_visit_date).toLocaleDateString(...)}` | Throws `RangeError` or renders invalid date text if `last_visit_date` is empty or invalid. |
| `src/pages/Dashboard.tsx` | 92 | `return new Date(lastActivityAtStr).toLocaleDateString();` | Direct un-sanitized `Date` construction on user presence activity timestamp string. |
| `src/lib/session.ts` | 307 | `const diff = Date.now() - new Date(lastActiveAt).getTime();` | Returns `NaN` if `lastActiveAt` is null/invalid string. |

### 3.3 Recommended Centralized Date Utility Strategy
Create a shared date helper module in `src/lib/dateUtils.ts` (or extend `src/lib/utils.ts`) with robust error handling:
```typescript
export function safeParseDate(input?: string | number | Date | null): Date {
  if (!input) return new Date(NaN);
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date(NaN) : input;
  if (typeof input === 'number') return new Date(input);
  
  const str = String(input).trim();
  if (!str) return new Date(NaN);
  
  const formatted = str.includes('T') ? str : str.replace(' ', 'T');
  const dateObj = new Date(formatted.includes('Z') || formatted.includes('+') ? formatted : formatted + 'Z');
  
  if (!isNaN(dateObj.getTime())) return dateObj;
  
  const fallback = new Date(str);
  return fallback;
}

export function safeFormatDate(
  input?: string | number | Date | null,
  options?: Intl.DateTimeFormatOptions,
  fallbackText: string = 'N/A'
): string {
  const d = safeParseDate(input);
  if (isNaN(d.getTime())) return fallbackText;
  try {
    return d.toLocaleDateString(undefined, options || { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return fallbackText;
  }
}
```

---

## 4. Codebase Structure & Component Hierarchy Mapping

### 4.1 Directory & File Layout
```
nekkadam (1)/
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript compiler config
├── vite.config.ts             # Vite bundler & API proxy config
├── tailwind.config.js         # Tailwind styling & dark mode config
├── index.html                 # Single page application entry point
├── electron-main.cjs          # Electron desktop main process
├── server.cjs                 # SQLite Express RPC backend server (Port 3001)
├── server_pg.cjs              # PostgreSQL Express RPC backend server (Port 3001)
├── capacitor.config.ts        # Capacitor mobile native app config
├── android/                   # Native Android studio project
└── src/                       # Application frontend source
    ├── main.tsx               # App root mounting
    ├── App.tsx                # Main router, layout, sidebar, topbar, OTA updater
    ├── index.css              # Global styles, Tailwind directives, glassmorphic UI rules
    ├── assets/                # Logos and app icons
    ├── components/            # Shared components & UI primitives
    │   ├── ProtectedRoute.tsx # Authentication gatekeeper
    │   ├── SplashScreen.tsx   # Loading screen animation
    │   └── ui/
    │       ├── Badge.tsx      # Status pill badges
    │       ├── Button.tsx     # Standard buttons (primary, outline, danger, loading state)
    │       ├── Card.tsx       # Standard & glassmorphic cards
    │       ├── Dialog.tsx     # Accessible modal dialog component
    │       └── Input.tsx      # Form text inputs & selects
    ├── contexts/
    │   ├── AuthContext.tsx    # User session state, login/logout, socket presence
    │   └── AppContext.tsx     # Theme state ('light'|'dark') & i18n translations ('en'|'hi')
    ├── lib/                   # Business logic, database client, API services
    │   ├── db.ts              # IndexedDB client, offline fallback engine, sync queue
    │   ├── session.ts         # User session, login RPCs, heartbeat, activity logging
    │   ├── tokenService.ts    # Queue token management API
    │   ├── educationService.ts# Attendance & student batch management API
    │   └── utils.ts           # Medicine code parsing utilities
    └── pages/                 # Top-level route pages (15 screens)
        ├── Dashboard.tsx        # Command center, live operations widget, quick stats
        ├── PatientsList.tsx     # Patient directory with virtual infinite scrolling
        ├── PatientProfile.tsx   # Patient detail, history timeline, prescription builder
        ├── NewPatient.tsx       # Patient enrollment & initial visit registration form
        ├── Attendance.tsx       # Student batch attendance tracker
        ├── MedicineQueue.tsx    # Volunteer medicine preparation queue & workbench
        ├── MedicineDashboard.tsx# Handover & dispatch monitoring screen
        ├── Medicines.tsx        # Medicine master database search & editor
        ├── Inventory.tsx        # Pharmacy stock inventory tracking
        ├── TokenQueue.tsx       # Token counter system management
        ├── Chat.tsx             # Socket.io real-time operator broadcast desk
        ├── ImportPatients.tsx   # CSV/Excel bulk patient data import
        ├── Login.tsx            # Operator passcode login screen
        ├── Settings.tsx         # System settings, IP config, theme & language options
        └── UserProfile.tsx      # Operator user profile page
```

### 4.2 Application Route Hierarchy & Data Flow
- Router setup in `src/App.tsx`:
  - `AuthProvider` -> `Router` -> `AppLayout`
  - Routes:
    - `/login` -> `<Login />`
    - `/` -> `<Dashboard />` (Protected)
    - `/patients` -> `<PatientsList />` (Protected)
    - `/patients/new` -> `<NewPatient />` (Protected)
    - `/patients/:id` -> `<PatientProfile />` (Protected)
    - `/attendance` -> `<Attendance />` (Protected)
    - `/med-queue` -> `<MedicineQueue />` (Protected)
    - `/med-dashboard` -> `<MedicineDashboard />` (Protected)
    - `/medicines` -> `<Medicines />` (Protected)
    - `/import` -> `<ImportPatients />` (Protected)
    - `/chat` -> `<Chat />` (Protected)
    - `/settings` -> `<SettingsPage />` (Protected)
    - `/profile/:userId` -> `<UserProfile />` (Protected)

### 4.3 Architecture & Data Flow Patterns
1. **Offline-First Storage (`src/lib/db.ts`)**:
   - Primary database is IndexedDB (`nk_store` v11) managed via `idb`.
   - All mutations write locally to `nk_pending_ops` queue before attempting remote RPC calls.
   - When online, `syncPendingOps()` pushes pending writes to the Express server (`/rpc` or `/api`).
2. **Real-time Socket Synchronization**:
   - `App.tsx` listens for `db_changed` events via `socket.io-client` to dispatch `nk_live_sync_completed`.
   - Pages register listeners for `nk_live_sync_completed` to refresh views automatically.
3. **Theme & Styling Contract**:
   - `AppContext.tsx` toggles `dark` class on `document.documentElement`.
   - Components use Tailwind's `dark:` modifier (e.g. `bg-slate-50 dark:bg-slate-950`).

---

## 5. Strategy & Implementation Recommendations for Milestone R1, R2, R3

### 5.1 Strategy for Milestone R1 (Patient Profile & History Timeline)
1. **Layout Priority**:
   - Ensure the clinical history column takes primary visual precedence or make the prescription builder collapsible with responsive input wrapping for mobile devices.
2. **Timeline Hero Date & Medicine Font Size**:
   - Refactor `PatientProfile.tsx` (lines 667-670) so the Date is styled with prominent hero typography (`text-2xl font-black text-slate-800 dark:text-slate-100`).
   - Ensure all medicine names rendered in history cards use font sizes of **at least 14px** (`text-sm sm:text-base font-black`, 14px-16px).
   - Wrap date formatting with `safeFormatDate` to prevent invalid date crashes.

### 5.2 Strategy for Milestone R2 (UI/UX & Bug Sweep)
1. **Medicine Queue Blank Screen Fix**:
   - Refactor `MedicineQueue.tsx` state management so that when hard reset occurs or `tasks` is cleared, proper loading states (`loading` or skeleton loaders) display continuously until polling resolves, avoiding any transient blank screen.
2. **Attendance Search Debounce**:
   - In `Attendance.tsx`, wrap the student list search input (`search` state, lines 295-301) with a 300ms debounce timer (similar to `patientSearch` in lines 133-152) to prevent excessive UI re-renders on fast typing.
3. **Chat Message State Cap**:
   - In `Chat.tsx`, enforce `.slice(-500)` cap both on socket reception (`receive_chat_message`, line 53) AND during initial history fetch in `loadHistory()` (line 74).
4. **Light / Dark Theme Sweep**:
   - Verify all cards, dialogs, badges, and background containers support dark mode styling (`dark:bg-...`, `dark:text-...`, `dark:border-...`).

### 5.3 Strategy for Milestone R3 (Build & Acceptance Verification)
1. **Compilation Verification**:
   - Ensure `npm run build` (`tsc && vite build`) executes cleanly with zero TypeScript errors or missing imports.
2. **Safe Date Parsing Verification**:
   - Verify that invalid/empty date strings do not throw uncaught JS errors in any component across the application.
