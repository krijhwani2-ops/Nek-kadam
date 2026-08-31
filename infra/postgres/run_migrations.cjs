/**
 * Applies versioned *.sql migrations once (tracked in schema_migrations).
 * Each file runs in its own transaction; failures roll back that file only.
 */

const fs = require('fs');
const path = require('path');

async function runPgMigrations(pool, migrationsDir) {
  const abs = path.resolve(migrationsDir);
  try {
    await fs.promises.access(abs);
  } catch (err) {
    console.warn('[MIGRATE] migrations dir missing:', abs);
    return;
  }

  const dirents = await fs.promises.readdir(abs);
  const files = dirents
    .filter((f) => /^\d+_.+\.sql$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        checksum TEXT,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const filename of files) {
      const rec = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [filename]);
      if (rec.rowCount) continue;

      const fullPath = path.join(abs, filename);
      const sql = await fs.promises.readFile(fullPath, 'utf8');

      console.log('[MIGRATE] applying', filename);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[MIGRATE] FAILED:', filename, err.message);
        throw err;
      }
    }
    console.log('[MIGRATE] up to date');
  } finally {
    client.release();
  }
}

module.exports = { runPgMigrations };
