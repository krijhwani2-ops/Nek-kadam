/**
 * Pick server.cjs (SQLite) vs server_pg.cjs (PostgreSQL) for local dev / Electron / Cloud.
 *
 * Priority:
 *  1. NEK_KADAM_BACKEND=sqlite|pg (explicit override)
 *  2. USE_POSTGRES=1 → PostgreSQL
 *  3. nekkadam.db present in project root → SQLite (Local offline & Wi-Fi default)
 *  4. Default → PostgreSQL
 */
const fs = require('fs');
const path = require('path');

function resolveBackend() {
  const cwd = process.cwd();
  const sqliteDb = path.join(cwd, 'nekkadam.db');
  const backendEnv = (process.env.NEK_KADAM_BACKEND || '').trim().toLowerCase();
  const usePostgresFlag = process.env.USE_POSTGRES === '1' || process.env.USE_POSTGRES === 'true';

  if (backendEnv === 'sqlite') {
    return { script: 'server.cjs', mode: 'sqlite', reason: 'NEK_KADAM_BACKEND=sqlite' };
  }
  if (backendEnv === 'pg' || backendEnv === 'postgres' || usePostgresFlag) {
    return { script: 'server_pg.cjs', mode: 'postgres', reason: 'PostgreSQL explicitly configured' };
  }
  if (fs.existsSync(sqliteDb)) {
    return {
      script: 'server.cjs',
      mode: 'sqlite',
      reason: 'nekkadam.db found (Local SQLite preferred for offline & Wi-Fi)',
    };
  }
  return {
    script: 'server_pg.cjs',
    mode: 'postgres',
    reason: 'no nekkadam.db; defaulting to PostgreSQL',
  };
}

module.exports = { resolveBackend };
