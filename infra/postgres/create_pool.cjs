/**
 * Shared PostgreSQL pool factory for LAN / single-server deployments.
 * Tuning favors stability on modest hardware; override via PGPOOL_* env vars.
 */

require('dotenv').config();
const { Pool } = require('pg');

function parsePositiveInt(raw, fallback) {
  const n = parseInt(String(raw ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Low-level Client options (migrate scripts); uses DATABASE_URL or discrete PG* vars.
 * Optional overrides: `.database`, `.host`, `.connectionString` (e.g. POSTGRES_SUPER_URL for setup).
 */
function getDirectClientOptions(override = {}) {
  const { connectionString: csOverride, database: dbOverride, ...rest } = override;
  const connStr = csOverride || rest.connectionString;
  const removedDup = { ...rest };
  delete removedDup.connectionString;

  const superUrl = process.env.POSTGRES_SUPER_URL;
  if (connStr || superUrl) {
    return { connectionString: connStr || superUrl, ...removedDup };
  }
  if (process.env.DATABASE_URL && !dbOverride) {
    return { connectionString: process.env.DATABASE_URL, ...removedDup };
  }
  /* discrete */
  let database = dbOverride ?? (process.env.PGDATABASE || 'nekkadam');
  if (process.env.DATABASE_URL && dbOverride) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      u.pathname = `/${dbOverride}`;
      return { connectionString: u.toString(), ...removedDup };
    } catch {
      /* fallback below */
    }
  }
  return {
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD ?? '',
    host: process.env.PGHOST || '127.0.0.1',
    port: parsePositiveInt(process.env.PGPORT, 5432),
    database,
    ...removedDup,
  };
}

function getPoolOptions() {
  const max = parsePositiveInt(process.env.PGPOOL_MAX ?? process.env.PGPOOL_SIZE, 20);
  const idleTimeoutMillis = parsePositiveInt(process.env.PG_IDLE_TIMEOUT_MS, 30_000);
  const connectionTimeoutMillis = parsePositiveInt(process.env.PG_CONN_TIMEOUT_MS, 10_000);
  const dc = getDirectClientOptions();

  if (dc.connectionString) {
    return {
      connectionString: dc.connectionString,
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      allowExitOnIdle: true,
    };
  }
  return {
    user: dc.user,
    password: dc.password,
    host: dc.host,
    port: dc.port,
    database: dc.database,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    allowExitOnIdle: true,
  };
}

function createPool() {
  return new Pool(getPoolOptions());
}

module.exports = { createPool, getPoolOptions, getDirectClientOptions, parsePositiveInt };
