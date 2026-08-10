### PostgreSQL infrastructure (repo)

| Path | Purpose |
|------|---------|
| `infra/postgres/migrations/` | Versioned DDL + indexes (**source of truth** for PG schema after migration to this layout) |
| `infra/postgres/manual/` | Optional SQL applied by DBA after data validation |
| `infra/postgres/create_pool.cjs` | Connection + pool sizing from env |
| `infra/postgres/run_migrations.cjs` | `schema_migrations` tracker |
| `infra/postgres/migrate.cli.cjs` | `npm run db:migrate` |

Server boot (`server_pg.cjs`) applies the same migrations on startup.

Commands:

```bash
npm run db:setup    # CREATE DATABASE + migrate
npm run db:migrate  # migrations only
npm run server:pg   # API on 0.0.0.0:3001
```

See **`docs/POSTGRES_ARCHITECTURE.md`** for LAN deployment and operations.

**Sheet2 ledger CSV:** `docs/SHEET2_IMPORT.md` — `npm run sheet2:normalize` then `npm run import:sheet2`.
