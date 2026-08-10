/**
 * CLI: run all pending migrations (same as server boot, without starting Express).
 */

const path = require('path');
const { createPool } = require('./create_pool.cjs');
const { runPgMigrations } = require('./run_migrations.cjs');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

(async () => {
  const pool = createPool();
  try {
    await runPgMigrations(pool, MIGRATIONS_DIR);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
})();
