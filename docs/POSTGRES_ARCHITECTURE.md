## Nek Kadam — PostgreSQL / LAN Architecture

This repository ships a **central Node.js API** (`server_pg.cjs`) and **offline-first React clients** (`src/lib/db.ts`: IndexedDB + manual sync/RPC over HTTP). An external prompt referenced **Flutter**; the deployed client equivalent is React + Capacitor/Electron — thin clients over HTTP rather than SQLite embedded in the UI.

---

### 1. Architecture (target)

```
[ Tablets / desktops / kiosk browsers ]
        │  HTTP (/rpc plus /api) over LAN (Wi‑Fi)
        ▼
[ Node — Express · connection pool · migrations ]
        │  parameterized SQL · transactions where needed
        ▼
[ PostgreSQL · LAN host · daily backup ]
```

**Why Node (not FastAPI) here:** Same language as Electron/Vite tooling, parity with legacy `server.cjs`, simpler single-runtime deployment on NGO mini-PC hosts. FastAPI remains a fine choice for Python-native shops; swapping stacks would split tooling without proportional gain until scale demands it.

**Concurrency:** Postgres row-level locking under default **READ COMMITTED** suits clinic token queues and batch writes.

**Future cloud sync:** Preserve stable text UUIDs across APIs; add only forward migrations (`003_*.sql`). Logical replication / CDC can attach later without client refactors.

---

### 2. Folder structure (relevant slice)

| Path | Role |
|------|------|
| `infra/postgres/migrations/` | Versioned DDL + indexes (**source of truth**) |
| `infra/postgres/create_pool.cjs` | `DATABASE_URL` / `PG*` + pool knobs |
| `infra/postgres/run_migrations.cjs` | Applies each `NNN_*.sql` once (`schema_migrations`) |
| `infra/postgres/migrate.cli.cjs` | `npm run db:migrate` |
| `infra/postgres/manual/` | Optional constraints after orphan cleanup |
| `server_pg.cjs` | Postgres API (parity target: `server.cjs`) |
| `server.cjs` | SQLite reference / fallback |
| `migrate_to_pg.cjs` | One-off SQLite file → Postgres copy |
| `setup_pg.cjs` | CREATE DATABASE + migrations |
| `src/lib/db.ts` | Offline cache + RPC + LAN server IP helpers |

Details: **`infra/postgres/README.md`**.

---

### 3. PostgreSQL schema snapshot

Baseline lives in **`001_baseline.sql`** (tables, FK skeleton). **`002_indexes_constraints.sql`** adds hot-path indexes aligned with kiosk queries (tokens by date/dept/person, visits by patient, etc.).

Manual: **`infra/postgres/manual/optional_token_events_fk.sql`** ties audit rows to tokens after validating **zero orphan `token_events."tokenId"`**.

---

### 4. Migration strategy

1. **Green field:** `npm run db:setup`.
2. **Schema bump only:** `npm run db:migrate`.
3. **From SQLite:** ensure `nekkadam.db` present → `npm run db:setup` → `node migrate_to_pg.cjs` (order-sensitive; rerun `db:migrate` if new migrations ship later).

Never edit landed `001_*`/`002_*` in-place on deployed sites—add successors.

---

### 5. Backend responsibilities (implemented + next hardening)

- **Pooling:** `PGPOOL_MAX`, idle/connect timeouts tuned for modest RAM.
- **Errors:** Failed routes return `{ error }` JSON with HTTP 5xx—correlate logs client-side timestamps.
- **Auth:** Bearer map + transitional admin hydrate—plan removal before any WAN routing.
- **Transactions:** Prefer explicit wraps for atomic token mutations (grow route-by-route).

---

### 6. Flutter note → this repo’s client

Maintain **`/rpc/*`** and **`/api/*`** contracts. Equivalent code: IndexedDB **`sync_queue`** + **`fullDataSync()`** retries in `src/lib/db.ts`.

---

### 7. API examples

```bash
curl -s -X POST http://CENTRAL_IP:3001/rpc/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SESSION_UUID" \
  -d '{"table":"patients","select":"*","limit":5}'
```

```bash
curl -s http://CENTRAL_IP:3001/api/departments \
  -H "Authorization: Bearer SESSION_UUID"
```

Production clients persist **`NEK_KADAM_SERVER_IP`** for non-localhost origins.

---

### 8. LAN deployment

1. Fix central host IPv4; open TCP **5432** (PG) + **3001** (API) scoped to LAN CIDR.
2. `postgresql.conf`: `listen_addresses` includes LAN IP or `*`.
3. `pg_hba.conf`: `scram-sha-256`; avoid `trust` outside lab subnets.
4. Run API as service user; Postgres as dedicated OS account.

---

### 9. Backup & recovery

```bash
pg_dump -Fc -h HOST -U nekkadam_app nekkadam > nekkadam_$(date +%F).dump
```

```bash
pg_restore -h HOST -U nekkadam_app -d nekkadam --clean --if-exists dumpfile
```

Add WAL archiving once storage budget allows Point-in-Time Recovery.

---

### 10. Performance (low-resource LAN server)

Tune `shared_buffers`, `effective_cache_size`, nightly `VACUUM (ANALYZE)` maintenance window.

Enable `pg_stat_statements` after stabilisation—trim unused indexes surfaced in dashboard.

---

### 11. Security checklist

Dedicated DB role minimal grants; salted password hashing at registration (upgrade algorithm if policy dictates); segmented VLAN for clinical devices; keep Electron/web builds off public Internet until hardened auth lands.

---

### 12. Scalability roadmap

- Reverse proxy TLS termination + auth hardening layer.
- Read replica feeding reporting.
- Narrow realtime channel (`SSE`/`websocket`) for token boards only—always idempotent server writes for reconnect storms.
- Optional logical replication subset to audited cloud warehouse.
