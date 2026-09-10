require('dotenv').config();
const { createPool } = require('../infra/postgres/create_pool.cjs');
const Database = require('better-sqlite3');

async function verify() {
  console.log('=== VERIFICATION REPORT ===');
  
  // 1. Postgres checks
  const pool = createPool();
  const pgDates = await pool.query(`
    SELECT date, count(id) as visit_count 
    FROM visits 
    WHERE date IN ('2026-08-23', '2026-08-16', '2026-08-09', '2026-08-02') 
    GROUP BY date 
    ORDER BY date DESC
  `);
  console.log('Postgres recent clinic visit counts:');
  console.table(pgDates.rows);

  const sampleCards = ['10674', '10668', '10667', '8739', '8699'];
  console.log('\nChecking sample new patients in Postgres:');
  for (const card of sampleCards) {
    const p = await pool.query('SELECT card_number, name, age, address, phone FROM patients WHERE card_number = $1', [card]);
    const v = await pool.query(`
      SELECT v.id, v.date, v.doctor_name, v.notes, count(pg.id) as groups
      FROM visits v
      LEFT JOIN prescription_groups pg ON pg.visit_id = v.id
      WHERE v.patient_id = $1
      GROUP BY v.id, v.date, v.doctor_name, v.notes
    `, [card]);
    console.log(`Patient ${card}:`, p.rows[0], 'Visits:', v.rows);
  }
  await pool.end();

  // 2. SQLite checks
  console.log('\nSQLite recent clinic visit counts:');
  const db = new Database('nekkadam.db');
  const sqDates = db.prepare(`
    SELECT date, count(id) as visit_count 
    FROM visits 
    WHERE date IN ('2026-08-23', '2026-08-16', '2026-08-09', '2026-08-02') 
    GROUP BY date 
    ORDER BY date DESC
  `).all();
  console.table(sqDates);

  console.log('\nChecking sample new patients in SQLite:');
  for (const card of sampleCards) {
    const p = db.prepare('SELECT card_number, name, age, address, phone FROM patients WHERE card_number = ?').get(card);
    const v = db.prepare(`
      SELECT v.id, v.date, v.doctor_name, v.notes, count(pg.id) as groups
      FROM visits v
      LEFT JOIN prescription_groups pg ON pg.visit_id = v.id
      WHERE v.patient_id = ?
      GROUP BY v.id, v.date, v.doctor_name, v.notes
    `).all(card);
    console.log(`SQLite Patient ${card}:`, p, 'Visits:', v);
  }
  db.close();
}

verify().catch(console.error);
