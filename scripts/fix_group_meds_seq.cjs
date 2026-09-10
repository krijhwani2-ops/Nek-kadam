require('dotenv').config();
const { createPool } = require('../infra/postgres/create_pool.cjs');
const pool = createPool();

async function addSequence() {
  const client = await pool.connect();
  try {
    const maxRes = await client.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM group_medicines');
    const nextId = maxRes.rows[0].next_id;
    console.log('Setting group_medicines sequence starting at:', nextId);

    await client.query(`CREATE SEQUENCE IF NOT EXISTS group_medicines_id_seq START WITH ${nextId}`);
    await client.query(`ALTER TABLE group_medicines ALTER COLUMN id SET DEFAULT nextval('group_medicines_id_seq')`);
    console.log('Successfully set default nextval sequence on group_medicines.id!');
  } finally {
    client.release();
    await pool.end();
  }
}
addSequence().catch(console.error);
