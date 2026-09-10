const { Client } = require('pg');
require('dotenv').config();
const { getDirectClientOptions } = require('./infra/postgres/create_pool.cjs');
const { runPgMigrations } = require('./infra/postgres/run_migrations.cjs');
const path = require('path');

async function resetSchema() {
  const client = new Client(getDirectClientOptions());
  await client.connect();
  console.log('[RESET] Dropping schema public CASCADE...');
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.end();
  console.log('[RESET] Public schema reset successfully.');

  const setupClient = new Client(getDirectClientOptions());
  await setupClient.connect();
  const migrationsDir = path.join(__dirname, 'infra/postgres/migrations');
  console.log('[RESET] Applying fresh 001_init.sql migration...');
  await runPgMigrations(setupClient, migrationsDir);
  await setupClient.end();
  console.log('[RESET] Fresh schema created!');
}

resetSchema().catch(err => {
  console.error('[RESET FAIL]', err);
  process.exit(1);
});
