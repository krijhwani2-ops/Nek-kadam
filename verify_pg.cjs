const { Client } = require('pg');
require('dotenv').config();
const { getDirectClientOptions } = require('./infra/postgres/create_pool.cjs');

async function verify() {
  const client = new Client(getDirectClientOptions());
  await client.connect();
  console.log('=== SUPABASE POSTGRESQL ROW COUNTS ===');
  
  const tables = [
    'departments', 'users', 'activity_logs', 'patients', 'medicines', 
    'visits', 'prescription_groups', 'group_medicines', 'tokens',
    'batches', 'education_students', 'attendance', 'dosage_frequency', 'medicine_logs', 'inventory', 'token_events'
  ];

  for (const table of tables) {
    try {
      const res = await client.query(`SELECT count(*) FROM ${table}`);
      console.log(`${table.padEnd(22)}: ${res.rows[0].count} rows`);
    } catch (err) {
      console.log(`${table.padEnd(22)}: Error (${err.message})`);
    }
  }

  await client.end();
}

verify();
