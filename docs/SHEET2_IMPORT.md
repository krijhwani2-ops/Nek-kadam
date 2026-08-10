# Sheet2 grid import (Nek Kadam Entries)

The clinic ledger CSV has a **grid layout**, not a flat header row:

| Row | Content |
|-----|---------|
| 0 | Visit dates (and optional doctor) in columns 6, 8, 10, … |
| 1 | `CARD`, `NAME`, `AGE`, `ADDRESS`, `PHONE`, `DOCTOR`, then `CATEGORY` / `MEDICINE` pairs |
| 2+ | One row per patient |

The in-app **Import Patients** page only accepts flat CSVs. Use the scripts below on the server PC.

## Default CSV locations

1. Repo root: `Nek kadam Entries  - Sheet2.csv`
2. `%USERPROFILE%\Downloads\Nek kadam Entries  - Sheet2.csv`

Or pass an explicit path as the last argument.

## 1. Normalize (structured files, no DB)

```bash
npm run sheet2:normalize
# or with Downloads path:
npm run sheet2:normalize -- "%USERPROFILE%\Downloads\Nek kadam Entries  - Sheet2.csv"
# also emit clean_visits.csv for import_normalized.cjs:
npm run sheet2:normalize -- --clean-visits
```

**Outputs** (under `data/`):

| File | Description |
|------|-------------|
| `data/sheet2_structured.json` | Patients with nested `visits[]` and parsed `medicines[]` |
| `data/sheet2_visits.csv` | Flat: card, name, visit_date, doctor, category, medicine_line, fragment count |
| `data/clean_visits.csv` | Optional; columns for `import_normalized.cjs` |

## 2. Import into database

```bash
# Parse only (no DB):
npm run import:sheet2 -- --dry-run

# SQLite (local nekkadam.db):
npm run import:sheet2 -- --sqlite --medicines

# PostgreSQL (when DATABASE_URL or PGHOST is set):
npm run import:sheet2 -- --medicines
```

`--medicines` creates `IMP_*` rows in `medicines` so the UI can resolve prescription names.

### better-sqlite3 ABI errors

If you see `NODE_MODULE_VERSION` mismatch after upgrading Node:

```bash
npm rebuild better-sqlite3
```

## 3. Legacy normalized CSV path

```bash
npm run sheet2:normalize -- --clean-visits
node import_normalized.cjs
```

(`import_normalized.cjs` expects `clean_visits.csv` in the repo root; copy from `data/` if needed.)

## PostgreSQL

Set `DATABASE_URL` or `PGHOST` + `PGDATABASE` in `.env`, then `npm run db:migrate` and `npm run server:pg`. If Postgres is unavailable, import falls back to SQLite automatically.

See also `infra/postgres/README.md` and `docs/POSTGRES_ARCHITECTURE.md`.
