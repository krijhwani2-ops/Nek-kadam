const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const DB_PATH = path.join(__dirname, '../benchmark_test.db');

if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}

const db = new Database(DB_PATH);

// Helper for UUID
function uuid() {
  return 'idx-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now();
}

console.log('--- INITIALIZING BENCHMARK DATABASE ---');

// 1. Create Base Schema (Without Secondary Indexes)
db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    card_number TEXT PRIMARY KEY,
    id TEXT UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    adhar_no TEXT,
    address TEXT,
    blood_group TEXT,
    age INTEGER,
    gender TEXT,
    allergies TEXT,
    chronic_conditions TEXT,
    medical_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS medicines (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    stock_level INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 10,
    price REAL DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(card_number) ON DELETE CASCADE,
    doctor_name TEXT,
    date TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS prescription_groups (
    id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    power TEXT,
    dosage_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS group_medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL REFERENCES prescription_groups(id) ON DELETE CASCADE,
    medicine_code TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    isActive INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    passcode TEXT NOT NULL,
    departmentId TEXT REFERENCES departments(id),
    role TEXT NOT NULL,
    isActive INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    departmentId TEXT REFERENCES departments(id),
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    metadata TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY,
    tokenNumber INTEGER NOT NULL,
    dateKey TEXT NOT NULL,
    personId TEXT NOT NULL,
    personName TEXT,
    personCard TEXT,
    currentDepartmentId TEXT NOT NULL REFERENCES departments(id),
    status TEXT NOT NULL DEFAULT 'WAITING',
    priority TEXT NOT NULL DEFAULT 'NORMAL',
    sequenceIndex INTEGER NOT NULL DEFAULT 0,
    isDeleted INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS medicine_tasks (
    id TEXT PRIMARY KEY,
    visitId TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    patientId TEXT NOT NULL,
    patientName TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'READY', 'DELIVERED')),
    claimedBy TEXT,
    completedBy TEXT,
    deliveredBy TEXT,
    claimedAt TEXT,
    completedAt TEXT,
    deliveredAt TEXT,
    startedAt TEXT,
    createdBy TEXT NOT NULL DEFAULT 'System',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS medicine_task_items (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL REFERENCES medicine_tasks(id) ON DELETE CASCADE,
    medicineCode TEXT NOT NULL,
    medicineName TEXT NOT NULL,
    dosage TEXT,
    duration TEXT,
    instructions TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 2. Populate Mock Load (12 departments, 60 active tokens, 500 historical tokens, 100 patients, 200 visits, 300 pgroups, 750 gmeds, 500 activity_logs)
const depts = [
  'RECEPTION', 'TRIAGE', 'GEN_OPD', 'EYE_OPD', 'DENTAL', 'PHARMACY',
  'BILLING', 'LAB', 'XRAY', 'COUNSELING', 'REGISTRATION', 'ADMIN'
];

db.transaction(() => {
  depts.forEach(code => {
    db.prepare('INSERT INTO departments (id, name, code) VALUES (?, ?, ?)').run(`dept-${code}`, code.replace('_', ' '), code);
  });

  // Medicines
  for (let i = 1; i <= 50; i++) {
    db.prepare('INSERT INTO medicines (id, code, name, stock_level) VALUES (?, ?, ?, ?)').run(`med-${i}`, `MED${100 + i}`, `Medicine ${i}`, 100);
  }

  // Patients
  for (let i = 1; i <= 100; i++) {
    db.prepare('INSERT INTO patients (card_number, id, name) VALUES (?, ?, ?)').run(`CARD${1000 + i}`, `p-${i}`, `Patient ${i}`);
  }

  // Today DateKey
  const today = '20260813';
  // Tokens - today (60 tokens)
  for (let i = 1; i <= 60; i++) {
    const deptId = `dept-${depts[i % depts.length]}`;
    const status = i <= 35 ? 'WAITING' : (i <= 47 ? 'IN_PROGRESS' : 'DONE');
    db.prepare(`
      INSERT INTO tokens (id, tokenNumber, dateKey, personId, personName, personCard, currentDepartmentId, status, priority, sequenceIndex)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`tok-today-${i}`, i, today, `p-${(i % 100) + 1}`, `Patient ${(i % 100) + 1}`, `CARD${1000 + (i % 100) + 1}`, deptId, status, i % 5 === 0 ? 'HIGH' : 'NORMAL', i);
  }

  // Tokens - historical (500 tokens)
  for (let i = 1; i <= 500; i++) {
    const pastDate = `202608${String((i % 10) + 1).padStart(2, '0')}`;
    const deptId = `dept-${depts[i % depts.length]}`;
    db.prepare(`
      INSERT INTO tokens (id, tokenNumber, dateKey, personId, personName, personCard, currentDepartmentId, status, priority, sequenceIndex)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`tok-hist-${i}`, i, pastDate, `p-${(i % 100) + 1}`, `Patient ${(i % 100) + 1}`, `CARD${1000 + (i % 100) + 1}`, deptId, 'DONE', 'NORMAL', i);
  }

  // Visits, Prescription Groups, Group Medicines
  for (let i = 1; i <= 200; i++) {
    const vId = `visit-${i}`;
    const cardNo = `CARD${1000 + ((i % 100) + 1)}`;
    db.prepare('INSERT INTO visits (id, patient_id, doctor_name, date, notes) VALUES (?, ?, ?, ?, ?)')
      .run(vId, cardNo, 'Dr. Smith', '2026-08-13', 'Routine checkup');
    
    // 1-2 groups per visit
    const groupCount = (i % 2) + 1;
    for (let g = 1; g <= groupCount; g++) {
      const gId = `pg-${i}-${g}`;
      db.prepare('INSERT INTO prescription_groups (id, visit_id, power, dosage_code) VALUES (?, ?, ?, ?)').run(gId, vId, '1.0', '1-0-1');
      
      // 2-3 meds per group
      const medCount = (g % 2) + 2;
      for (let m = 1; m <= medCount; m++) {
        db.prepare('INSERT INTO group_medicines (group_id, medicine_code) VALUES (?, ?)').run(gId, `MED${100 + ((i + g + m) % 50) + 1}`);
      }
    }
  }

  // Activity logs
  for (let i = 1; i <= 500; i++) {
    const deptId = `dept-${depts[i % depts.length]}`;
    db.prepare('INSERT INTO activity_logs (id, departmentId, action, entity, entity_id, timestamp) VALUES (?, ?, ?, ?, ?, datetime(\'now\', \'-' + i + ' minutes\'))')
      .run(`act-${i}`, deptId, 'TOKEN_CREATED', 'tokens', `tok-hist-${i}`);
  }
})();

console.log('Mock Data Inserted Successfully.');

const results = {};

// Helper benchmark function
function timeFn(name, iterations, fn) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn(i);
  }
  const end = performance.now();
  const totalMs = end - start;
  const avgMs = totalMs / iterations;
  return { totalMs: Number(totalMs.toFixed(3)), avgMs: Number(avgMs.toFixed(4)) };
}

// Baseline query plan check
const planBefore = db.prepare(`
  SELECT d.code, COUNT(t.id) as c 
  FROM tokens t JOIN departments d ON t.currentDepartmentId = d.id 
  WHERE t.dateKey = ? AND t.status = 'WAITING' AND t.isDeleted = 0 
  GROUP BY d.code
`).bind('20260813');
console.log('Explain Query Plan (Before Index):', db.prepare(`EXPLAIN QUERY PLAN SELECT d.code, COUNT(t.id) as c FROM tokens t JOIN departments d ON t.currentDepartmentId = d.id WHERE t.dateKey = '20260813' AND t.status = 'WAITING' AND t.isDeleted = 0 GROUP BY d.code`).all());

// BENCHMARK 1: Dashboard Token Query Baseline (Before Index)
results.dashboardQuery_before = timeFn('Dashboard Query Baseline', 200, () => {
  db.prepare(`
    SELECT d.code, COUNT(t.id) as count 
    FROM tokens t JOIN departments d ON t.currentDepartmentId = d.id 
    WHERE t.dateKey = ? AND t.status = 'WAITING' AND t.isDeleted = 0 
    GROUP BY d.code
  `).all('20260813');
});

// BENCHMARK 2: Token Lookup Person Check Baseline (Before Index)
results.tokenPerson_before = timeFn('Token Person Check Baseline', 200, (i) => {
  db.prepare(`
    SELECT id, tokenNumber, status FROM tokens WHERE personId = ? AND dateKey = ? AND isDeleted = 0
  `).all(`p-${(i % 100) + 1}`, '20260813');
});

// BENCHMARK 3: Token Sequence Lookup Baseline (Before Index)
results.tokenSeq_before = timeFn('Token Sequence Baseline', 200, (i) => {
  db.prepare(`
    SELECT MAX(sequenceIndex) as m FROM tokens WHERE currentDepartmentId = ? AND dateKey = ?
  `).get(`dept-${depts[i % depts.length]}`, '20260813');
});

// BENCHMARK 4: Visits Patient History Baseline (Before Index)
results.visitsPatient_before = timeFn('Visits Patient History Baseline', 200, (i) => {
  db.prepare(`
    SELECT * FROM visits WHERE patient_id = ? ORDER BY created_at DESC
  `).all(`CARD${1000 + ((i % 100) + 1)}`);
});

// BENCHMARK 5: Prescription Groups & Medicines Baseline (Before Index)
results.pgroupsMed_before = timeFn('Prescription Groups Baseline', 200, (i) => {
  const visitId = `visit-${(i % 200) + 1}`;
  const groups = db.prepare('SELECT * FROM prescription_groups WHERE visit_id = ?').all(visitId);
  for (const g of groups) {
    db.prepare('SELECT * FROM group_medicines WHERE group_id = ?').all(g.id);
  }
});

// BENCHMARK 6: Activity Logs Dept Baseline (Before Index)
results.actLogs_before = timeFn('Activity Logs Dept Baseline', 200, (i) => {
  db.prepare('SELECT * FROM activity_logs WHERE departmentId = ? ORDER BY timestamp DESC LIMIT 20')
    .all(`dept-${depts[i % depts.length]}`);
});

// BENCHMARK 7: ensureMedicineTask Un-transactioned Inserts vs Transactioned Inserts
// Test Un-transactioned:
results.ensureMedicineTask_untransactioned = timeFn('ensureMedicineTask Un-transactioned', 50, (i) => {
  const taskId = uuid();
  db.prepare(`
    INSERT INTO medicine_tasks (id, visitId, patientId, patientName, status, createdBy)
    VALUES (?, ?, ?, ?, 'PENDING', 'System')
  `).run(taskId, `visit-${i + 1}`, `p-${i + 1}`, `Patient ${i + 1}`);

  const insertItem = db.prepare(`
    INSERT INTO medicine_task_items (id, taskId, medicineCode, medicineName, dosage)
    VALUES (?, ?, ?, ?, ?)
  `);
  // 6 items loop without wrapping transaction
  for (let m = 1; m <= 6; m++) {
    insertItem.run(uuid(), taskId, `MED10${m}`, `Med ${m}`, '1-0-1');
  }
});

// Test Transactioned:
const insertItemsTx = db.transaction((taskId, items) => {
  const insertItem = db.prepare(`
    INSERT INTO medicine_task_items (id, taskId, medicineCode, medicineName, dosage)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const m of items) {
    insertItem.run(uuid(), taskId, m.code, m.name, m.dosage);
  }
});

results.ensureMedicineTask_transactioned = timeFn('ensureMedicineTask Transactioned', 50, (i) => {
  const taskId = uuid();
  db.prepare(`
    INSERT INTO medicine_tasks (id, visitId, patientId, patientName, status, createdBy)
    VALUES (?, ?, ?, ?, 'PENDING', 'System')
  `).run(taskId, `visit-${i + 50}`, `p-${i + 50}`, `Patient ${i + 50}`);

  const items = [];
  for (let m = 1; m <= 6; m++) {
    items.push({ code: `MED10${m}`, name: `Med ${m}`, dosage: '1-0-1' });
  }
  insertItemsTx(taskId, items);
});

// BENCHMARK 8: saveFullTx prepare inside loop vs prepared outside
function saveFullUnprepared(payload) {
  return db.transaction(() => {
    const visitId = uuid();
    db.prepare('INSERT INTO visits (id, patient_id, date, doctor_name, notes) VALUES (?, ?, ?, ?, ?)')
      .run(visitId, payload.patientId, payload.date, payload.doctorName, payload.notes);
    for (const g of payload.medicineGroups) {
      const groupId = uuid();
      db.prepare('INSERT INTO prescription_groups (id, visit_id, power, dosage_code) VALUES (?, ?, ?, ?)')
        .run(groupId, visitId, g.power, g.dosage);
      for (const m of g.meds) {
        db.prepare('INSERT INTO group_medicines (group_id, medicine_code) VALUES (?, ?)').run(groupId, m.code);
      }
    }
    return visitId;
  })();
}

const stmtInsertVisit = db.prepare('INSERT INTO visits (id, patient_id, date, doctor_name, notes) VALUES (?, ?, ?, ?, ?)');
const stmtInsertGroup = db.prepare('INSERT INTO prescription_groups (id, visit_id, power, dosage_code) VALUES (?, ?, ?, ?)');
const stmtInsertGroupMed = db.prepare('INSERT INTO group_medicines (group_id, medicine_code) VALUES (?, ?)');

function saveFullPrepared(payload) {
  return db.transaction(() => {
    const visitId = uuid();
    stmtInsertVisit.run(visitId, payload.patientId, payload.date, payload.doctorName, payload.notes);
    for (const g of payload.medicineGroups) {
      const groupId = uuid();
      stmtInsertGroup.run(groupId, visitId, g.power, g.dosage);
      for (const m of g.meds) {
        stmtInsertGroupMed.run(groupId, m.code);
      }
    }
    return visitId;
  })();
}

const samplePayload = {
  patientId: 'CARD1001',
  doctorName: 'Dr. Test',
  date: '2026-08-13',
  notes: 'Test visit',
  medicineGroups: [
    { power: '1.0', dosage: '1-0-1', meds: [{ code: 'MED101' }, { code: 'MED102' }] },
    { power: '0.5', dosage: '0-0-1', meds: [{ code: 'MED103' }, { code: 'MED104' }] }
  ]
};

results.saveFull_unprepared = timeFn('saveFull Unprepared (Statement inside loop)', 50, () => {
  saveFullUnprepared(samplePayload);
});

results.saveFull_prepared = timeFn('saveFull Prepared (Statement outside loop)', 50, () => {
  saveFullPrepared(samplePayload);
});

// NOW APPLY INDEX OPTIMIZATIONS
console.log('\n--- APPLYING INDEX OPTIMIZATIONS ---');
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tokens_lookup ON tokens(dateKey, isDeleted, currentDepartmentId, status);
  CREATE INDEX IF NOT EXISTS idx_tokens_person ON tokens(dateKey, personId);
  CREATE INDEX IF NOT EXISTS idx_tokens_seq ON tokens(dateKey, currentDepartmentId, priority, sequenceIndex);
  CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
  CREATE INDEX IF NOT EXISTS idx_pgroups_visit ON prescription_groups(visit_id);
  CREATE INDEX IF NOT EXISTS idx_gmeds_group ON group_medicines(group_id);
  CREATE INDEX IF NOT EXISTS idx_actlogs_dept ON activity_logs(departmentId, timestamp);
`);

console.log('Explain Query Plan (After Index):', db.prepare(`EXPLAIN QUERY PLAN SELECT d.code, COUNT(t.id) as c FROM tokens t JOIN departments d ON t.currentDepartmentId = d.id WHERE t.dateKey = '20260813' AND t.status = 'WAITING' AND t.isDeleted = 0 GROUP BY d.code`).all());

// BENCHMARK POST-INDEX
results.dashboardQuery_after = timeFn('Dashboard Query Optimized', 200, () => {
  db.prepare(`
    SELECT d.code, COUNT(t.id) as count 
    FROM tokens t JOIN departments d ON t.currentDepartmentId = d.id 
    WHERE t.dateKey = ? AND t.status = 'WAITING' AND t.isDeleted = 0 
    GROUP BY d.code
  `).all('20260813');
});

results.tokenPerson_after = timeFn('Token Person Check Optimized', 200, (i) => {
  db.prepare(`
    SELECT id, tokenNumber, status FROM tokens WHERE personId = ? AND dateKey = ? AND isDeleted = 0
  `).all(`p-${(i % 100) + 1}`, '20260813');
});

results.tokenSeq_after = timeFn('Token Sequence Optimized', 200, (i) => {
  db.prepare(`
    SELECT MAX(sequenceIndex) as m FROM tokens WHERE currentDepartmentId = ? AND dateKey = ?
  `).get(`dept-${depts[i % depts.length]}`, '20260813');
});

results.visitsPatient_after = timeFn('Visits Patient History Optimized', 200, (i) => {
  db.prepare(`
    SELECT * FROM visits WHERE patient_id = ? ORDER BY created_at DESC
  `).all(`CARD${1000 + ((i % 100) + 1)}`);
});

results.pgroupsMed_after = timeFn('Prescription Groups Optimized', 200, (i) => {
  const visitId = `visit-${(i % 200) + 1}`;
  const groups = db.prepare('SELECT * FROM prescription_groups WHERE visit_id = ?').all(visitId);
  for (const g of groups) {
    db.prepare('SELECT * FROM group_medicines WHERE group_id = ?').all(g.id);
  }
});

results.actLogs_after = timeFn('Activity Logs Dept Optimized', 200, (i) => {
  db.prepare('SELECT * FROM activity_logs WHERE departmentId = ? ORDER BY timestamp DESC LIMIT 20')
    .all(`dept-${depts[i % depts.length]}`);
});

db.close();
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

console.log('\n--- BENCHMARK RESULTS ---');
console.log(JSON.stringify(results, null, 2));

fs.writeFileSync(path.join(__dirname, '../benchmark_results.json'), JSON.stringify(results, null, 2));
