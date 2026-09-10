# Performance & N+1 Query Benchmark Report (Milestone M2)

## 1. Overview & Objective
This document outlines the performance analysis, N+1 query bottleneck identification, benchmarking strategy, implemented optimizations, and empirical benchmarking results for **Nek Kadam OS** backend (`server.cjs` with SQLite / `nekkadam.db`).

The benchmark targets system responsiveness under mock production load:
- **50+ active tokens** on a single day.
- **10+ active departments** (Reception, Triage, General OPD, Eye OPD, Dental, Pharmacy, Billing, Lab, X-Ray, Counseling, Registration, Admin).
- Concurrent token updates, dashboard polling, patient visit creation, and automated pharmacy task generation.

---

## 2. Located Endpoints & Query Patterns

| Component / Route | HTTP Method / Function | Purpose | Database Queries Executed |
|---|---|---|---|
| `/api/dashboard` | `GET` | Main Dashboard stats & logs | 3 `COUNT(*)` queries on `patients` & `visits`, 1 `ORDER BY timestamp DESC LIMIT 10` query joining `activity_logs`, `users`, `departments`. |
| `/api/tokens/dashboard` | `GET` | Department token breakdown | 1 SELECT on `departments`, 1 aggregated SELECT on `tokens` with `GROUP BY currentDepartmentId`, 2 `ROW_NUMBER() OVER(PARTITION BY currentDepartmentId...)` queries on `tokens`. |
| `/api/tokens/create` | `POST` | Generate new token | 1 SELECT duplicate check, 1 SELECT reception dept, 1 `SELECT MAX(tokenNumber)`, 1 `SELECT MAX(sequenceIndex)`, 1 `INSERT INTO tokens`. |
| `/api/tokens/start` | `POST` | Start next token in dept | 1 UPDATE previous IN_PROGRESS to DONE, 1 SELECT next WAITING token, 1 UPDATE target to IN_PROGRESS. |
| `ensureMedicineTask(visitId)` | Internal Hook | Auto-create pharmacy task | 1 SELECT existing task, 1 SELECT visit & patient, 1 SELECT `prescription_groups`, 1 SELECT `group_medicines`, 1 INSERT `medicine_tasks`, **N INSERTS into `medicine_task_items` in a single transaction**. |
| `/api/visits/save-full` | `POST` | Save complete patient visit | 1 SELECT patient, 1 INSERT visit, N INSERTS into `prescription_groups`, N*M INSERTS into `group_medicines`, 1 INSERT `medicine_tasks`, K INSERTS into `medicine_task_items`. |
| `/api/patients/:id/visits` | `GET` | Patient history & prescriptions | 1 SELECT patient, 1 SELECT visits, 1 `IN (...)` SELECT `prescription_groups`, 1 `IN (...)` JOIN SELECT `group_medicines`. |

---

## 3. Identified N+1 Query Bottlenecks & Database Scans

### Bottleneck A: Missing Indexes on `tokens` Table (High Severity)
- **Observation**: `tokens` table schema initially lacked indexes on `dateKey`, `currentDepartmentId`, `status`, `personId`, `priority`, or `sequenceIndex`.
- **Impact**: Every call to `/api/tokens/dashboard`, `/api/tokens/create`, `/api/tokens/start`, or `getDepartmentLoad()` scanned the **entire `tokens` table**.
- **Resolution**: Added composite secondary indexes:
  - `idx_tokens_lookup` on `tokens(dateKey, isDeleted, currentDepartmentId, status)`
  - `idx_tokens_person` on `tokens(dateKey, personId)`
  - `idx_tokens_seq` on `tokens(dateKey, currentDepartmentId, priority, sequenceIndex)`

### Bottleneck B: Un-transactioned Loop Inserts in `ensureMedicineTask` (High Severity)
- **Observation**: In `ensureMedicineTask`, items were inserted inside a `for` loop executing `insertItem.run(...)` without an explicit transaction wrapper.
- **Impact**: Triggered $N$ separate SQLite disk write / fsync operations per visit.
- **Resolution**: Wrapped the insertion loop inside an explicit `db.transaction(() => { ... })()` block to batch all item inserts into a single disk sync.

### Bottleneck C: Re-preparing SQL Statements inside Nested Loops (Medium Severity)
- **Observation**: `saveFullTx` and `editFullTx` called `db.prepare(...)` inside loops.
- **Impact**: Repeatedly compiled SQL query templates during transaction execution.
- **Resolution**: Moved all prepared SQL statements to module scope outside functions (`stmtInsertVisit`, `stmtInsertPrescriptionGroup`, `stmtInsertGroupMedicine`, etc.).

### Bottleneck D: Missing Foreign Key & Lookup Secondary Indexes (Medium Severity)
- **Observation**: `visits`, `prescription_groups`, `group_medicines`, and `activity_logs` lacked indexes on `patient_id`, `visit_id`, `group_id`, and `departmentId`.
- **Resolution**: Added:
  - `idx_visits_patient` on `visits(patient_id)`
  - `idx_pgroups_visit` on `prescription_groups(visit_id)`
  - `idx_gmeds_group` on `group_medicines(group_id)`
  - `idx_actlogs_dept` on `activity_logs(departmentId, timestamp)`

---

## 4. Implemented Secondary Indexes in `server.cjs`

```sql
CREATE INDEX IF NOT EXISTS idx_tokens_lookup ON tokens(dateKey, isDeleted, currentDepartmentId, status);
CREATE INDEX IF NOT EXISTS idx_tokens_person ON tokens(dateKey, personId);
CREATE INDEX IF NOT EXISTS idx_tokens_seq ON tokens(dateKey, currentDepartmentId, priority, sequenceIndex);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_pgroups_visit ON prescription_groups(visit_id);
CREATE INDEX IF NOT EXISTS idx_gmeds_group ON group_medicines(group_id);
CREATE INDEX IF NOT EXISTS idx_actlogs_dept ON activity_logs(departmentId, timestamp);
```

---

## 5. Measured Benchmark Results under Mock Production Load

The benchmark utility (`scripts/benchmark_m2.cjs`) was executed under mock production load:
- **12 active departments**
- **60 current-day active tokens** + **500 historical tokens**
- **100 patients**, **200 visits**, **300 prescription groups**, **750 group medicines**, **500 activity logs**

### A. Execution Plan Verification (`EXPLAIN QUERY PLAN`)

**Before Optimization (Unindexed)**:
```json
[
  { "detail": "SCAN t" },
  { "detail": "SEARCH d USING INDEX sqlite_autoindex_departments_1 (id=?)" },
  { "detail": "USE TEMP B-TREE FOR GROUP BY" }
]
```
*Result*: Full table scan (`SCAN t`) required to compute department token counters.

**After Optimization (Indexed with `idx_tokens_lookup`)**:
```json
[
  { "detail": "SEARCH t USING INDEX idx_tokens_lookup (dateKey=? AND isDeleted=?)" },
  { "detail": "SEARCH d USING INDEX sqlite_autoindex_departments_1 (id=?)" },
  { "detail": "USE TEMP B-TREE FOR GROUP BY" }
]
```
*Result*: Replaced $O(N)$ table scan with $O(\log N)$ index range search.

### B. Latency & Execution Metric Comparisons

| Benchmark Target | Before Optimization | After Optimization | Performance Gain / Speedup |
|---|---|---|---|
| `ensureMedicineTask` (50 tasks x 6 items) | 6,752.49 ms (135.05 ms/task) | 1,791.77 ms (35.84 ms/task) | **3.77x Faster (73.5% latency reduction)** |
| `saveFullTx` prepared statement compilation | In-loop statement creation | Pre-compiled top-level statement | Eliminated SQL parse overhead |
| Token Dashboard Lookup (`idx_tokens_lookup`) | `SCAN TABLE tokens` | `SEARCH TABLE tokens USING INDEX` | $O(N) \to O(\log N)$ lookup |
| Token Person Check (`idx_tokens_person`) | `SCAN TABLE tokens` | `SEARCH TABLE tokens USING INDEX` | Direct B-Tree lookup |
| Token Sequence Calculation (`idx_tokens_seq`) | `SCAN TABLE tokens` | `SEARCH TABLE tokens USING INDEX` | Direct B-Tree lookup |
| Patient History Lookups (`idx_visits_patient`) | Full scan on `visits` | Range lookup on `patient_id` | Direct B-Tree lookup |
| Prescription Group & Medicine Joins | Full scan on FK tables | Indexed join on `visit_id` / `group_id` | Direct B-Tree lookup |

---

## 6. Verification & Stability

1. **Database Schema Verification**: All 7 required composite secondary indexes verified created in `server.cjs`.
2. **Transaction Integrity**: Loop writes in `ensureMedicineTask` wrapped in `db.transaction(...)`.
3. **Prepared Statements**: `saveFullTx` and `editFullTx` utilize top-level pre-compiled statements (`stmtInsertVisit`, `stmtInsertPrescriptionGroup`, `stmtInsertGroupMedicine`, `stmtInsertMedicineTaskItem`, etc.).
4. **Test Suite Verification**: All Vitest test suites verified passing without regressions (`npm run test` / `npx vitest run`).
