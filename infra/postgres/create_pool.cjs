/**
 * Shared PostgreSQL pool factory for LAN / cloud deployments.
 * Auto-enables SSL for remote cloud databases (e.g. Supabase, Neon, Render).
 */

require('dotenv').config();
const { Pool } = require('pg');

function parsePositiveInt(raw, fallback) {
  const n = parseInt(String(raw ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getDirectClientOptions(override = {}) {
  const { connectionString: csOverride, database: dbOverride, ...rest } = override;
  const connStr = csOverride || rest.connectionString;
  const removedDup = { ...rest };
  delete removedDup.connectionString;

  const superUrl = process.env.POSTGRES_SUPER_URL;
  const targetUrl = connStr || superUrl || (process.env.DATABASE_URL && !dbOverride ? process.env.DATABASE_URL : null);

  const sslOption = (process.env.DATABASE_URL || connStr || superUrl || process.env.NODE_ENV === 'production')
    ? { rejectUnauthorized: false }
    : undefined;

  if (targetUrl) {
    return {
      connectionString: targetUrl,
      ssl: sslOption,
      ...removedDup
    };
  }

  let database = dbOverride ?? (process.env.PGDATABASE || 'nekkadam');
  if (process.env.DATABASE_URL && dbOverride) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      u.pathname = `/${dbOverride}`;
      return {
        connectionString: u.toString(),
        ssl: sslOption,
        ...removedDup
      };
    } catch {
      /* fallback below */
    }
  }

  const host = process.env.PGHOST || '127.0.0.1';
  const isLocalHost = host === '127.0.0.1' || host === 'localhost';

  return {
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD ?? '',
    host,
    port: parsePositiveInt(process.env.PGPORT, 5432),
    database,
    ssl: isLocalHost ? undefined : { rejectUnauthorized: false },
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
      ssl: dc.ssl,
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
    ssl: dc.ssl,
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
