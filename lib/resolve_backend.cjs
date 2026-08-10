/**
 * Pick server.cjs (SQLite) vs server_pg.cjs (PostgreSQL) for local dev / Electron.
 *
 * Priority:
 *  1. NEK_KADAM_BACKEND=sqlite|pg (explicit override)
 *  2. USE_POSTGRES=1 or DATABASE_URL → PostgreSQL
 *  3. nekkadam.db present in project root → SQLite (Sheet2 import target)
 *  4. Default → PostgreSQL (fresh installs with npm run db:setup)
 */
const fs = require('fs');
const path = require('path');

function resolveBackend() {
  const cwd = process.cwd();
  const sqliteDb = path.join(cwd, 'nekkadam.db');
  const backendEnv = (process.env.NEK_KADAM_BACKEND || '').trim().toLowerCase();
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim());
  const usePostgresFlag = process.env.USE_POSTGRES === '1' || process.env.USE_POSTGRES === 'true';

  if (backendEnv === 'sqlite') {
    return { script: 'server.cjs', mode: 'sqlite', reason: 'NEK_KADAM_BACKEND=sqlite' };
  }
  if (backendEnv === 'pg' || backendEnv === 'postgres') {
    return { script: 'server_pg.cjs', mode: 'postgres', reason: 'NEK_KADAM_BACKEND=pg' };
  }
  if (hasDatabaseUrl || usePostgresFlag) {
    return {
      script: 'server_pg.cjs',
      mode: 'postgres',
      reason: hasDatabaseUrl ? 'DATABASE_URL is set' : 'USE_POSTGRES is set',
    };
  }
  if (fs.existsSync(sqliteDb)) {
    return {
      script: 'server.cjs',
      mode: 'sqlite',
      reason: 'nekkadam.db found and PostgreSQL is not configured',
    };
  }
  return {
    script: 'server_pg.cjs',
    mode: 'postgres',
    reason: 'no nekkadam.db; defaulting to PostgreSQL (run npm run db:setup)',
  };
}

module.exports = { resolveBackend };
