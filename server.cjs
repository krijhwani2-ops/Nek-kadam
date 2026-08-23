const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const port = 3001;

const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('[SOCKET] Client connected:', socket.id);
  
  socket.on('send_chat_message', (msg) => {
    try {
      const msgId = 'MSG-' + uuid();
      const timestamp = new Date().toISOString();
      const { senderId, senderName, senderDepartment, recipientId, message, fileName, fileData } = msg;
      
      db.prepare(`
        INSERT INTO chat_messages (id, senderId, senderName, senderDepartment, recipientId, message, timestamp, fileName, fileData)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(msgId, senderId, senderName, senderDepartment, recipientId || null, message, timestamp, fileName || null, fileData || null);
      
      io.emit('receive_chat_message', {
        id: msgId,
        senderId,
        senderName,
        senderDepartment,
        recipientId: recipientId || null,
        message,
        timestamp,
        fileName: fileName || null,
        fileData: fileData || null
      });
    } catch (err) {
      console.error('[SOCKET] Error saving chat message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('[SOCKET] Client disconnected:', socket.id);
  });
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(cors());
app.use(bodyParser.json());

// CRITICAL FIX: Clean IndexedDB cache '.0' suffix from patient IDs globally
const cleanDotZeroId = (val) => {
  if (typeof val === 'string' && val.endsWith('.0')) {
    return val.substring(0, val.length - 2);
  }
  return val;
};

// AUDIT FIX: Only sanitize known patient-related ID fields, NOT generic 'id' (was corrupting UUIDs ending in .0)
const PATIENT_ID_FIELDS = new Set(['patientId', 'patient_id', 'identifier', 'personId', 'personCard']);
const sanitizeIds = (obj) => {
  if (Array.isArray(obj)) {
    obj.forEach(sanitizeIds);
  } else if (obj !== null && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (PATIENT_ID_FIELDS.has(key)) {
        obj[key] = cleanDotZeroId(obj[key]);
      } else if (typeof obj[key] === 'object') {
        sanitizeIds(obj[key]);
      }
    }
  }
};

app.use((req, res, next) => {
  if (req.body) sanitizeIds(req.body);
  if (req.query) sanitizeIds(req.query);
  next();
});

// AUDIT FIX: Serve only the dist folder, not the entire project root (was exposing nekkadam.db, source code, .env)
app.use('/static', express.static('dist'));
app.use('/apk', express.static(__dirname + '/apk'));
app.get('/api/version', (req, res) => res.json({ version: '1.0.8', apkUrl: '/apk/nek-kadam.apk' }));

// ─────────────────────────────────────
//  ECOSYSTEM: Request Logger
// ─────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    console.log(`${color}[${req.method}]\x1b[0m ${req.originalUrl || req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

const db = new Database('nekkadam.db');
db.pragma('journal_mode = WAL');

// ─── AUTOMATIC MIGRATIONS ───
try {
  const info = db.prepare('PRAGMA table_info(activity_logs)').all();
  if (!info.find(c => c.name === 'departmentId')) {
    db.prepare('ALTER TABLE activity_logs ADD COLUMN departmentId TEXT').run();
  }
  if (!info.find(c => c.name === 'user_id') && info.find(c => c.name === 'userId')) {
    db.prepare('ALTER TABLE activity_logs RENAME COLUMN userId TO user_id').run();
  }
  
  // Migration for patients: adhar_no
  const patientInfo = db.prepare('PRAGMA table_info(patients)').all();
  if (!patientInfo.find(c => c.name === 'adhar_no')) {
    db.prepare('ALTER TABLE patients ADD COLUMN adhar_no TEXT').run();
  }
  
  // Migration for users: department, deviceId, updatedAt
  const userInfo = db.prepare('PRAGMA table_info(users)').all();
  if (!userInfo.find(c => c.name === 'department')) {
    db.prepare('ALTER TABLE users ADD COLUMN department TEXT').run();
  }
  if (!userInfo.find(c => c.name === 'deviceId')) {
    db.prepare('ALTER TABLE users ADD COLUMN deviceId TEXT').run();
  }
  if (!userInfo.find(c => c.name === 'updatedAt')) {
    db.prepare('ALTER TABLE users ADD COLUMN updatedAt TEXT').run();
  }
} catch (e) {
  console.warn('[MIGRATION WARNING]', e.message);
}

function uuid() {
  return crypto.randomUUID();
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

// ─────────────────────────────────────
//  SCHEMA
// ─────────────────────────────────────
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

  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    timing TEXT,
    isActive INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS education_students (
    id TEXT PRIMARY KEY,
    patientId TEXT NOT NULL REFERENCES patients(card_number),
    batchId TEXT NOT NULL REFERENCES batches(id),
    isActive INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    studentId TEXT NOT NULL REFERENCES education_students(id),
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    markedBy TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  CREATE INDEX IF NOT EXISTS idx_medicine_tasks_status ON medicine_tasks(status);
  CREATE INDEX IF NOT EXISTS idx_medicine_tasks_updated_at ON medicine_tasks(updatedAt);
  CREATE INDEX IF NOT EXISTS idx_medicine_task_items_task_id ON medicine_task_items(taskId);

  CREATE INDEX IF NOT EXISTS idx_tokens_lookup ON tokens(dateKey, isDeleted, currentDepartmentId, status);
  CREATE INDEX IF NOT EXISTS idx_tokens_person ON tokens(dateKey, personId);
  CREATE INDEX IF NOT EXISTS idx_tokens_seq ON tokens(dateKey, currentDepartmentId, priority, sequenceIndex);
  CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
  CREATE INDEX IF NOT EXISTS idx_pgroups_visit ON prescription_groups(visit_id);
  CREATE INDEX IF NOT EXISTS idx_gmeds_group ON group_medicines(group_id);
  CREATE INDEX IF NOT EXISTS idx_actlogs_dept ON activity_logs(departmentId, timestamp);

  CREATE TABLE IF NOT EXISTS user_presence (
    id TEXT PRIMARY KEY,
    userId TEXT UNIQUE NOT NULL,
    userName TEXT NOT NULL,
    department TEXT NOT NULL,
    currentStatus TEXT NOT NULL,
    currentScreen TEXT,
    currentTaskId TEXT,
    currentPatientName TEXT,
    lastActivityAt TEXT,
    lastHeartbeatAt TEXT,
    isOnline INTEGER DEFAULT 1,
    deviceId TEXT,
    updatedAt TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_user_presence_userid ON user_presence(userId);
  CREATE INDEX IF NOT EXISTS idx_user_presence_online ON user_presence(isOnline);

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    senderId TEXT NOT NULL,
    senderName TEXT NOT NULL,
    senderDepartment TEXT NOT NULL,
    recipientId TEXT,
    message TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    fileName TEXT,
    fileData TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    departmentId TEXT,
    deptCode TEXT,
    role TEXT,
    lastActiveTime INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ─────────────────────────────────────
//  STATE & HELPERS
// ─────────────────────────────────────
const activeSessions = new Map();

// AUDIT FIX: Pre-compiled prepared statements for session ops (was recompiling SQL every request)
const stmtGetSession = db.prepare('SELECT * FROM sessions WHERE token = ?');
const stmtSetSession = db.prepare('INSERT OR REPLACE INTO sessions (token, userId, userName, departmentId, deptCode, role, lastActiveTime) VALUES (?, ?, ?, ?, ?, ?, ?)');

function getSession(token) {
  const cached = activeSessions.get(token);
  if (cached) return cached;
  const row = stmtGetSession.get(token);
  if (row) {
    const session = { userId: row.userId, userName: row.userName, departmentId: row.departmentId, deptCode: row.deptCode, role: row.role, lastActiveTime: row.lastActiveTime || Date.now() };
    activeSessions.set(token, session);
    return session;
  }
  return null;
}

function setSession(token, session) {
  activeSessions.set(token, session);
  try {
    stmtSetSession.run(token, session.userId, session.userName, session.departmentId || null, session.deptCode || null, session.role || null, session.lastActiveTime || Date.now());
  } catch(e) { console.error('Session persist error:', e.message); }
}

// AUDIT FIX: Session eviction — clean sessions older than 24h every 30 minutes
setInterval(() => {
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  for (const [token, session] of activeSessions) {
    if (session.lastActiveTime && session.lastActiveTime < cutoff) {
      activeSessions.delete(token);
    }
  }
}, 30 * 60 * 1000);
// AUDIT FIX: Removed dead 'activeLocks' Map (was never used)

function getDepartmentLoad() {
  const loads = {};
  db.prepare('SELECT code FROM departments WHERE isActive = 1').all().forEach(d => loads[d.code] = { code: d.code, count: 0 });
  const dateKey = todayKey();
  db.prepare(`
    SELECT d.code, COUNT(t.id) as c 
    FROM tokens t 
    JOIN departments d ON t.currentDepartmentId = d.id 
    WHERE t.dateKey = ? AND t.status = 'WAITING' AND t.isDeleted = 0
    GROUP BY d.code
  `).all(dateKey).forEach(tc => { if (loads[tc.code]) loads[tc.code].count = tc.c; });
  return loads;
}

// ─────────────────────────────────────
//  AUTH & MIDDLEWARE
// ─────────────────────────────────────
const PUBLIC_PATHS = [
  '/api/login',
  '/api/pc-login',
  '/api/users',
  '/api/users/create-profile',
  '/api/version',
  '/api/health'
];

function requireAuth(req, res, next) {
  // Exclude public paths from session checking
  if (PUBLIC_PATHS.some(path => req.originalUrl.startsWith(path))) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    const session = getSession(token);
    if (session) {
      req.user = session;
      return next();
    }
  }

  // Safe fallback for new/empty DB:
  try {
    const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
    if (userCount === 0) {
      req.user = { userId: 'admin', userName: 'Default Admin', role: 'ADMIN', deptCode: 'MED', departmentId: '1' };
      return next();
    }
  } catch (e) {
    console.error('Failed to count users in requireAuth:', e);
  }

  try {
    require('fs').appendFileSync('server_errors.log', `[${new Date().toISOString()}] AUTH FAILURE: Path "${req.originalUrl}", Token "${token || 'NONE'}"\n`);
  } catch(err) {}
  return res.status(401).json({ error: 'Unauthorized: Invalid or missing session token' });
}

app.use('/rpc', requireAuth);
app.use('/api', requireAuth);

// ─────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────
app.get('/api/pc-login', (req, res) => {
  // AUDIT FIX: Guard against missing admin user (was crashing with TypeError)
  const user = db.prepare("SELECT u.*, d.code as deptCode FROM users u JOIN departments d ON u.departmentId = d.id WHERE u.role = 'ADMIN' LIMIT 1").get();
  if (!user) return res.status(404).json({ error: 'No admin user found. Create one first.' });
  const token = uuid();
  setSession(token, { userId: user.id, userName: user.name, departmentId: user.departmentId, deptCode: user.deptCode, role: user.role, lastActiveTime: Date.now() });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, departmentId: user.departmentId, deptCode: user.deptCode } });
});

app.post('/api/login', (req, res) => {
  const { name, passcode } = req.body;
  const hash = crypto.createHash('sha256').update(passcode).digest('hex');
  // AUDIT FIX: Use LEFT JOIN so login works even if user has no department assigned
  const user = db.prepare('SELECT u.*, d.code as deptCode FROM users u LEFT JOIN departments d ON u.departmentId = d.id WHERE u.name = ? AND u.passcode = ?').get(name, hash);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = uuid();
  setSession(token, { userId: user.id, userName: user.name, departmentId: user.departmentId || null, deptCode: user.deptCode || 'GEN', role: user.role, lastActiveTime: Date.now() });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, departmentId: user.departmentId, deptCode: user.deptCode || 'GEN' } });
});

app.post('/api/heartbeat', (req, res) => {
  const { sessionId } = req.body;
  const session = activeSessions.get(sessionId) || req.user;
  if (session) session.lastActiveTime = Date.now();
  res.json({ ok: true });
});

app.post('/api/log-activity', (req, res) => {
  try {
    const { userId, action, entity, entityId } = req.body;
    const u = req.user;
    const deptId = u?.departmentId || db.prepare('SELECT id FROM departments LIMIT 1').get().id;
    db.prepare(`INSERT INTO activity_logs (id, user_id, departmentId, action, entity, entity_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`)
      .run(uuid(), userId || u?.userId, deptId, action, entity || null, entityId || null);
    res.json({ ok: true });
  } catch (e) {
    console.error('LOG ACTIVITY ERROR:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dashboard', (req, res) => {
  try {
    const stats = {
      patientsToday: db.prepare("SELECT COUNT(*) as c FROM patients WHERE created_at >= date('now', 'localtime')").get().c,
      totalPatients: db.prepare('SELECT COUNT(*) as c FROM patients').get().c,
      totalVisits: db.prepare('SELECT COUNT(*) as c FROM visits').get().c,
    };
    let recentLogs = [];
    try {
      recentLogs = db.prepare(`
        SELECT l.*, COALESCE(u.name, l.user_name, 'Staff') as userName, COALESCE(d.code, 'GEN') as deptCode 
        FROM activity_logs l 
        LEFT JOIN users u ON l.user_id = u.id 
        LEFT JOIN departments d ON l.departmentId = d.id 
        ORDER BY l.timestamp DESC LIMIT 10
      `).all();
    } catch (_) {}
    res.json({ stats, recentLogs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/chat/history', (req, res) => {
  try {
    const { recipientId } = req.query;
    let messages;
    const selectFields = 'id, senderId, senderName, senderDepartment, recipientId, message, timestamp, fileName, CASE WHEN fileData IS NOT NULL AND fileData != \'\' THEN 1 ELSE 0 END as hasFile';
    if (recipientId && recipientId !== 'null' && recipientId !== 'undefined' && recipientId !== '') {
      const currentUserId = req.user?.userId || 'admin';
      messages = db.prepare(`
        SELECT ${selectFields} FROM chat_messages 
        WHERE (senderId = ? AND recipientId = ?) OR (senderId = ? AND recipientId = ?)
        ORDER BY timestamp ASC LIMIT 200
      `).all(currentUserId, recipientId, recipientId, currentUserId);
    } else {
      messages = db.prepare(`
        SELECT ${selectFields} FROM chat_messages 
        WHERE recipientId IS NULL OR recipientId = ''
        ORDER BY timestamp ASC LIMIT 200
      `).all();
    }
    res.json({ data: messages });
  } catch (e) {
    console.error('CHAT HISTORY ERROR:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/chat/file/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT fileData, fileName FROM chat_messages WHERE id = ?').get(req.params.id);
    if (!row || !row.fileData) return res.status(404).json({ error: 'File not found' });
    res.json({ fileData: row.fileData, fileName: row.fileName });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────
//  API: Patient Visit History (ENRICHED — single query)
// ─────────────────────────────────────
app.get('/api/patients/:identifier/visits', (req, res) => {
  try {
    let { identifier } = req.params;
    
    // CRITICAL FIX: Mobile app IndexedDB cache might still have '.0' at the end of patient IDs
    if (identifier && identifier.endsWith('.0')) {
        identifier = identifier.substring(0, identifier.length - 2);
    }
    
    console.log(`[API] Fetching visits for identifier: "${identifier}"`);
    
    const patient = db.prepare('SELECT id, card_number FROM patients WHERE id = ? OR card_number = ? OR card_number = ?').get(identifier, identifier, cleanDotZeroId(identifier));
    const cardNumber = patient ? patient.card_number : identifier;
    const patientUUID = patient ? patient.id : identifier;
    const cleanId = cleanDotZeroId(identifier);
    console.log(`[API] Resolved identifier to card_number: "${cardNumber}", UUID: "${patientUUID}"`);

    const visits = db.prepare(
      'SELECT * FROM visits WHERE patient_id = ? OR patient_id = ? OR patient_id = ? ORDER BY date DESC'
    ).all(cardNumber, patientUUID, cleanId);
    console.log(`[API] Found ${visits.length} visits for card_number: "${cardNumber}"`);

    // 2. For each visit, get prescription_groups + group_medicines in bulk
    let allGroups = [];
    let allMeds = [];

    if (visits.length > 0) {
      const visitIds = visits.map(v => v.id);
      const placeholdersV = visitIds.map(() => '?').join(',');
      allGroups = db.prepare(`SELECT * FROM prescription_groups WHERE visit_id IN (${placeholdersV})`).all(...visitIds);

      if (allGroups.length > 0) {
        const groupIds = allGroups.map(g => g.id);
        const placeholdersG = groupIds.map(() => '?').join(',');
        allMeds = db.prepare(`
          SELECT gm.*, COALESCE(m.name, gm.medicine_code) as medicine_name 
          FROM group_medicines gm
          LEFT JOIN medicines m ON gm.medicine_code = m.code
          WHERE gm.group_id IN (${placeholdersG})
        `).all(...groupIds);
      }
    }

    const medsByGroup = {};
    for (const m of allMeds) {
      if (!medsByGroup[m.group_id]) medsByGroup[m.group_id] = [];
      medsByGroup[m.group_id].push(m);
    }

    const groupsByVisit = {};
    for (const g of allGroups) {
      if (!groupsByVisit[g.visit_id]) groupsByVisit[g.visit_id] = [];
      groupsByVisit[g.visit_id].push({ ...g, group_medicines: medsByGroup[g.id] || [] });
    }

    const enriched = visits.map(v => ({
      ...v,
      prescription_groups: groupsByVisit[v.id] || []
    }));

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ data: enriched });
  } catch (e) {
    console.error('[VISITS API] Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────
//  API: Admin (User Management)
// ─────────────────────────────────────
app.get('/api/admin/users', (req, res) => {
  console.log(`[ADMIN] Fetching users list... (User: ${req.user?.userName})`);
  try {
    const users = db.prepare(`
      SELECT u.id, u.name, u.role, u.departmentId, u.isActive, d.name as department 
      FROM users u 
      LEFT JOIN departments d ON u.departmentId = d.id 
      ORDER BY u.name
    `).all();
    console.log(`[ADMIN] Found ${users.length} users.`);
    res.json({ data: users });
  } catch (e) { 
    console.error('[ADMIN] Users Fetch Error:', e);
    res.status(500).json({ error: e.message }); 
  }
});

app.get('/api/admin/departments', (req, res) => {
  console.log(`[ADMIN] Fetching departments...`);
  try {
    const depts = db.prepare('SELECT id, name, code FROM departments WHERE isActive = 1 ORDER BY name').all();
    console.log(`[ADMIN] Found ${depts.length} departments.`);
    res.json({ data: depts });
  } catch (e) { 
    console.error('[ADMIN] Depts Fetch Error:', e);
    res.status(500).json({ error: e.message }); 
  }
});

app.post('/api/admin/users/create', (req, res) => {
  try {
    const { name, passcode, department, role } = req.body;
    if (!name || !passcode || !role) return res.status(400).json({ error: 'Missing required fields' });
    
    const hash = crypto.createHash('sha256').update(passcode).digest('hex');
    
    let deptId = null;
    if (department) {
       const dept = db.prepare('SELECT id FROM departments WHERE name = ? OR code = ? OR id = ?').get(department, department, department);
       if (dept) deptId = dept.id;
    }
    if (!deptId) {
       const firstDept = db.prepare('SELECT id FROM departments LIMIT 1').get();
       deptId = firstDept ? firstDept.id : null;
    }
    
    db.prepare('INSERT INTO users (id, name, passcode, departmentId, role, isActive) VALUES (?, ?, ?, ?, ?, 1)')
      .run(uuid(), name, hash, deptId, role.toUpperCase());
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/users/update', (req, res) => {
  try {
    const { id, name, passcode, department, role, is_active } = req.body;
    const dept = db.prepare('SELECT id FROM departments WHERE name = ? OR code = ?').get(department, department);
    const deptId = dept ? dept.id : null;
    
    let sql = 'UPDATE users SET name = ?, role = ?, isActive = ?';
    const params = [name, role.toUpperCase(), is_active ? 1 : 0];
    
    if (passcode && passcode.length > 0) {
      const hash = crypto.createHash('sha256').update(passcode).digest('hex');
      sql += ', passcode = ?';
      params.push(hash);
    }
    if (deptId) {
      sql += ', departmentId = ?';
      params.push(deptId);
    }
    
    sql += ' WHERE id = ?';
    params.push(id);
    
    db.prepare(sql).run(...params);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────
//  API: Token System
// ─────────────────────────────────────
app.get('/api/tokens/dashboard', (req, res) => {
  try {
    const depts = db.prepare('SELECT id, name, code FROM departments WHERE isActive = 1').all();
    const dateKey = todayKey();
    const statsRows = db.prepare(`
      SELECT
        currentDepartmentId,
        SUM(CASE WHEN status = 'WAITING' THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status = 'SKIPPED' THEN 1 ELSE 0 END) as skipped
      FROM tokens WHERE dateKey = ? AND isDeleted = 0
      GROUP BY currentDepartmentId
    `).all(dateKey);
    const statsMap = new Map();
    for (const row of statsRows) statsMap.set(row.currentDepartmentId, row);

    const currentTokens = db.prepare(`
      SELECT * FROM (
        SELECT *, ROW_NUMBER() OVER(PARTITION BY currentDepartmentId) as rn
        FROM tokens
        WHERE dateKey = ? AND status = 'IN_PROGRESS' AND isDeleted = 0
      ) WHERE rn = 1
    `).all(dateKey);
    const currentMap = new Map();
    for (const row of currentTokens) {
      delete row.rn;
      currentMap.set(row.currentDepartmentId, row);
    }

    const nextTokens = db.prepare(`
      SELECT * FROM (
        SELECT *, ROW_NUMBER() OVER(PARTITION BY currentDepartmentId ORDER BY priority DESC, sequenceIndex ASC) as rn
        FROM tokens
        WHERE dateKey = ? AND status = 'WAITING' AND isDeleted = 0
      ) WHERE rn = 1
    `).all(dateKey);
    const nextMap = new Map();
    for (const row of nextTokens) {
      delete row.rn;
      nextMap.set(row.currentDepartmentId, row);
    }

    const data = depts.map(d => {
      const stats = statsMap.get(d.id) || {};
      return { 
        departmentId: d.id, departmentName: d.name, departmentCode: d.code,
        waiting: stats.waiting || 0, inProgress: stats.inProgress || 0, done: stats.done || 0, skipped: stats.skipped || 0,
        nextToken: nextMap.get(d.id) || null, currentToken: currentMap.get(d.id) || null
      };
    });

    res.json({ data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tokens/create', (req, res) => {
  try {
    const result = db.transaction(() => {
      const { personId, personName, personCard, priority } = req.body;
      const dateKey = todayKey();
      
      // Check duplicate
      const exists = db.prepare('SELECT id, tokenNumber, status FROM tokens WHERE personId = ? AND dateKey = ? AND isDeleted = 0').get(personId, dateKey);
      if (exists) return { error: `Token #${exists.tokenNumber} already exists today (Status: ${exists.status})` };

      const reception = db.prepare("SELECT id FROM departments WHERE code = 'RECEPTION'").get() || db.prepare('SELECT id FROM departments LIMIT 1').get();
      const nextNum = (db.prepare('SELECT MAX(tokenNumber) as m FROM tokens WHERE dateKey = ?').get(dateKey).m || 0) + 1;
      const nextSeq = (db.prepare('SELECT MAX(sequenceIndex) as m FROM tokens WHERE currentDepartmentId = ? AND dateKey = ?').get(reception.id, dateKey).m || 0) + 1;
      
      const tokenId = uuid();
      db.prepare('INSERT INTO tokens (id, tokenNumber, dateKey, personId, personName, personCard, currentDepartmentId, status, priority, sequenceIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(tokenId, nextNum, dateKey, personId, personName, personCard || personId, reception.id, 'WAITING', priority || 'NORMAL', nextSeq);
      
      const token = db.prepare('SELECT * FROM tokens WHERE id = ?').get(tokenId);
      return { data: token };
    })();
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tokens/start', (req, res) => {
  try {
    const { departmentId, tokenId } = req.body;
    const dateKey = todayKey();
    
    // Auto-complete previous token in this dept
    db.prepare("UPDATE tokens SET status = 'DONE' WHERE currentDepartmentId = ? AND dateKey = ? AND status = 'IN_PROGRESS'").run(departmentId, dateKey);
    
    let targetId = tokenId;
    if (!targetId) {
      const next = db.prepare(`SELECT id FROM tokens WHERE currentDepartmentId = ? AND dateKey = ? AND status = 'WAITING' AND isDeleted = 0 ORDER BY priority DESC, sequenceIndex ASC LIMIT 1`).get(departmentId, dateKey);
      if (!next) return res.json({ error: 'No waiting tokens' });
      targetId = next.id;
    }
    
    db.prepare("UPDATE tokens SET status = 'IN_PROGRESS' WHERE id = ?").run(targetId);
    res.json({ data: db.prepare('SELECT * FROM tokens WHERE id = ?').get(targetId) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.name, u.role, d.name as department, u.isActive,
             CASE WHEN u.passcode IS NOT NULL AND u.passcode != '' AND u.passcode != 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' THEN 1 ELSE 0 END as hasPasscode
      FROM users u 
      LEFT JOIN departments d ON u.departmentId = d.id
      WHERE u.isActive = 1
      ORDER BY u.name
    `).all();
    res.json({ data: users });
  } catch (err) {
    console.error('[GET /api/users] error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ─────────────────────────────────────
//  Mobile Device Profile Creation (Auto-Login)
// ─────────────────────────────────────
// ─────────────────────────────────────
//  API: Education & Attendance
// ─────────────────────────────────────
app.get('/api/education/batches', (req, res) => {
  try { res.json({ data: db.prepare('SELECT * FROM batches WHERE isActive = 1').all() }); } catch (e) { res.json({ error: e.message }); }
});

app.post('/api/education/batches/create', (req, res) => {
  try {
    const { name, timing } = req.body;
    db.prepare('INSERT INTO batches (id, name, timing, isActive) VALUES (?, ?, ?, 1)')
      .run(uuid(), name, timing || null);
    res.json({ success: true });
  } catch (e) { res.json({ error: e.message }); }
});

app.get('/api/education/batches/:batchId/students', (req, res) => {
  try {
    const students = db.prepare(`
      SELECT es.id as educationStudentId, p.name, p.card_number, p.id as patientId,
      (SELECT status FROM attendance WHERE studentId = es.id AND date = date('now', 'localtime')) as todayStatus
      FROM education_students es JOIN patients p ON (es.patientId = p.card_number OR es.patientId = p.id)
      WHERE es.batchId = ? AND es.isActive = 1
    `).all(req.params.batchId);
    // Ensure tag has a fallback if undefined
    const enriched = students.map(s => ({ ...s, tag: s.tag || 'Regular' }));
    res.json({ data: enriched });
  } catch (e) { res.json({ error: e.message }); }
});

app.post('/api/education/attendance/bulk', (req, res) => {
  try {
    const { date, records, userId } = req.body;
    const targetDate = date || new Date().toLocaleDateString('en-CA');
    const upsert = db.prepare(`
      INSERT INTO attendance (id, studentId, date, status, note, markedBy) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(studentId, date) DO UPDATE SET status=excluded.status, note=excluded.note, markedBy=excluded.markedBy
    `);
    db.transaction(() => {
      for (const r of records) upsert.run(uuid(), r.studentId, targetDate, r.status, r.note || null, userId || null);
    })();
    res.json({ success: true });
  } catch (e) { res.json({ error: e.message }); }
});

app.post('/api/education/enroll-existing', (req, res) => {
  try {
    const { patientId, batchId } = req.body;
    
    // The UI sends card_number as patientId, so we need to get the actual UUID
    const patient = db.prepare('SELECT id FROM patients WHERE card_number = ? OR id = ?').get(patientId, patientId);
    if (!patient) return res.json({ error: 'Patient not found' });
    const realPatientId = patient.id;

    const exists = db.prepare('SELECT id FROM education_students WHERE patientId = ? AND batchId = ?').get(realPatientId, batchId);
    if (exists) return res.json({ error: 'Already enrolled in this batch' });
    
    db.prepare('INSERT INTO education_students (id, patientId, batchId, isActive) VALUES (?, ?, ?, 1)')
      .run(uuid(), realPatientId, batchId);
    res.json({ success: true });
  } catch (e) { res.json({ error: e.message }); }
});

app.get('/api/education/attendance/summary', (req, res) => {
  try {
    const { date, batchId } = req.query;
    const targetDate = date || new Date().toLocaleDateString('en-CA');
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as late
      FROM attendance a
      JOIN education_students es ON a.studentId = es.id
      WHERE a.date = ? ${batchId ? 'AND es.batchId = ?' : ''}
    `;
    const data = batchId ? db.prepare(sql).get(targetDate, batchId) : db.prepare(sql).get(targetDate);
    res.json({ data: data || { total: 0, present: 0, absent: 0, late: 0 } });
  } catch (e) { res.json({ error: e.message }); }
});

app.post('/api/education/students/create', (req, res) => {
  try {
    const { name, adhar_no, phone, age, batchId } = req.body;
    
    // 1. Check if patient exists by adhar_no or name+phone
    let patient = null;
    if (adhar_no) {
      patient = db.prepare('SELECT id, card_number FROM patients WHERE adhar_no = ?').get(adhar_no);
    }
    
    if (!patient && phone) {
      patient = db.prepare('SELECT id, card_number FROM patients WHERE name = ? AND phone = ?').get(name, phone);
    }

    let patientUUID;
    let cardNumber;
    if (!patient) {
      // Create new patient
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      cardNumber = adhar_no || `NK${randomSuffix}`;
      patientUUID = uuid();
      db.prepare(`
        INSERT INTO patients (card_number, id, name, adhar_no, phone, age) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(cardNumber, patientUUID, name, adhar_no || null, phone || null, age || null);
    } else {
      cardNumber = patient.card_number;
      patientUUID = patient.id;
    }

    // 2. Check if already in education_students for this batch
    const exists = db.prepare('SELECT id FROM education_students WHERE patientId = ? AND batchId = ?').get(patientUUID, batchId);
    if (exists) {
      return res.json({ error: 'Student already exists in this batch' });
    }

    // 3. Add to education_students
    db.prepare('INSERT INTO education_students (id, patientId, batchId, isActive) VALUES (?, ?, ?, 1)')
      .run(uuid(), patientUUID, batchId);

    res.json({ success: true });
  } catch (e) {
    console.error('CREATE STUDENT ERROR:', e);
    res.json({ error: e.message });
  }
});

app.post('/api/education/students/:studentId/remove', (req, res) => {
  try {
    const { studentId } = req.params;
    console.log(`[API] Removing student from education system: ${studentId}`);
    
    db.transaction(() => {
      // 1. Delete student attendance records
      db.prepare('DELETE FROM attendance WHERE studentId = ?').run(studentId);
      
      // 2. Delete student entry from batch
      db.prepare('DELETE FROM education_students WHERE id = ?').run(studentId);
    })();
    
    console.log(`[API] Successfully removed student: ${studentId}`);
    res.json({ success: true });
  } catch (e) {
    console.error('REMOVE STUDENT ERROR:', e);
    res.json({ error: e.message });
  }
});



// ─────────────────────────────────────
//  API: Search
// ─────────────────────────────────────
app.get('/api/patients/search', (req, res) => {
  try {
    const q = (req.query.q || '').toUpperCase();
    const data = db.prepare(`SELECT * FROM patients WHERE card_number LIKE ? OR name LIKE ? LIMIT 10`).all(`%${q}%`, `%${q}%`);
    res.json({ data });
  } catch (e) { res.json({ error: e.message }); }
});

// ─────────────────────────────────────
//  RPC
// ─────────────────────────────────────
const ALLOWED_TABLES = new Set([
  'patients',
  'visits',
  'medicines',
  'prescription_groups',
  'group_medicines',
  'departments',
  'users',
  'activity_logs',
  'tokens',
  'batches',
  'education_students',
  'attendance',
  'medicine_tasks',
  'medicine_task_items',
  'user_presence',
  'chat_messages'
]);

function validateTable(table) {
  if (!table || typeof table !== 'string' || !ALLOWED_TABLES.has(table)) {
    throw new Error(`Unauthorized or invalid table access: "${table}"`);
  }
}

const COLUMN_REGEX = /^[a-zA-Z0-9_-]+$/;
function validateColumn(col) {
  if (!col || typeof col !== 'string' || !COLUMN_REGEX.test(col)) {
    throw new Error(`Invalid column name: "${col}"`);
  }
}

app.post('/rpc/query', (req, res) => {
  const { table, select, filters, order, single, limit } = req.body;
  try {
    validateTable(table);
    
    let selectClause = '*';
    if (select && select !== '*') {
      const parts = select.split(',').map(s => s.trim());
      for (const p of parts) {
        validateColumn(p);
      }
      selectClause = parts.map(p => `"${p}"`).join(',');
    }
    
    let sql = `SELECT ${selectClause} FROM "${table}"`;
    const params = [];
    if (filters) {
      const clauses = Object.entries(filters).map(([col, val]) => {
        validateColumn(col);
        params.push(val.eq !== undefined ? val.eq : val);
        return `"${col}" = ?`;
      });
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }
    if (order) {
      validateColumn(order.column);
      sql += ` ORDER BY "${order.column}" ${order.ascending ? 'ASC' : 'DESC'}`;
    }
    if (limit) {
      const parsedLimit = parseInt(limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 0) {
        throw new Error('Invalid limit parameter');
      }
      sql += ` LIMIT ${parsedLimit}`;
    } else {
      // AUDIT FIX: Default LIMIT 50000 to prevent truncating large tables during full sync (11,700+ prescription_groups)
      sql += ' LIMIT 50000';
    }
    const data = single ? db.prepare(sql).get(...params) : db.prepare(sql).all(...params);
    res.json({ data });
  } catch (e) { res.json({ error: e.message }); }
});

// Helper function to auto-create medicine queue tasks for synced offline visits
function ensureMedicineTask(visitId) {
  try {
    const existingTask = db.prepare('SELECT id FROM medicine_tasks WHERE visitId = ?').get(visitId);
    if (existingTask) return; // Task already exists

    const visit = db.prepare('SELECT patient_id FROM visits WHERE id = ?').get(visitId);
    if (!visit) return; // Visit not fully synced yet

    const patient = db.prepare('SELECT name FROM patients WHERE card_number = ? OR id = ?').get(visit.patient_id, visit.patient_id);
    const patientName = patient ? patient.name : 'Unknown';

    const groups = db.prepare('SELECT id, power, dosage_code FROM prescription_groups WHERE visit_id = ?').all(visitId);
    if (groups.length === 0) return;

    const allMedsForTask = [];
    const groupIds = groups.map(g => g.id);
    const placeholders = groupIds.map(() => '?').join(',');
    const allMeds = db.prepare(`SELECT gm.group_id, gm.medicine_code, m.name FROM group_medicines gm LEFT JOIN medicines m ON gm.medicine_code = m.code WHERE gm.group_id IN (${placeholders})`).all(...groupIds);

    const medsByGroup = {};
    for (const med of allMeds) {
      if (!medsByGroup[med.group_id]) medsByGroup[med.group_id] = [];
      medsByGroup[med.group_id].push(med);
    }

    for (const group of groups) {
      const meds = medsByGroup[group.id] || [];
      for (const med of meds) {
        allMedsForTask.push({
          code: med.medicine_code,
          name: med.name || med.medicine_code,
          dosage: group.dosage_code || 'BD'
        });
      }
    }

    if (allMedsForTask.length === 0) return;

    const taskId = uuid();
    const insertItem = db.prepare(`
      INSERT INTO medicine_task_items (id, taskId, medicineCode, medicineName, dosage, duration, instructions)
      VALUES (?, ?, ?, ?, ?, '', '')
    `);

    // AUDIT FIX: Wrap task + items in single transaction (was split — task outside, items inside)
    db.transaction(() => {
      db.prepare(`
        INSERT INTO medicine_tasks (id, visitId, patientId, patientName, status, createdBy, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 'PENDING', 'System', datetime('now'), datetime('now'))
      `).run(taskId, visitId, visit.patient_id, patientName);

      for (const m of allMedsForTask) {
        insertItem.run(uuid(), taskId, m.code, m.name || m.code, m.dosage);
      }
    })();

    console.log('[TRIGGER] Auto-created medicine task for synced visit:', visitId);
  } catch (err) {
    console.error('[ensureMedicineTask error]', err);
  }
}

app.post('/rpc/insert', (req, res) => {
  const { table, data, single } = req.body;
  try {
    validateTable(table);
    const items = Array.isArray(data) ? data : [data];
    db.transaction(() => {
      for (const item of items) {
        if (table === 'group_medicines' && typeof item.id === 'string') {
          delete item.id;
        }
        if (!item.id && table !== 'group_medicines') item.id = uuid();
        const cols = Object.keys(item);
        for (const col of cols) {
          validateColumn(col);
        }
        db.prepare(`INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...Object.values(item));
      }
    })();

    // Post-insert hook: if table is group_medicines, ensure we trigger/auto-create pharmacy queue tasks
    if (table === 'group_medicines') {
      try {
        const groupIds = items.map(item => item.group_id).filter(Boolean);
        for (const gId of groupIds) {
          const pg = db.prepare('SELECT visit_id FROM prescription_groups WHERE id = ?').get(gId);
          if (pg && pg.visit_id) {
            ensureMedicineTask(pg.visit_id);
          }
        }
      } catch (err) {
        console.error('[RPC TRIGGER ERROR]', err);
      }
    }

    res.json({ data: single ? items[0] : items });
    if (req.io) req.io.emit('db_changed', { table, action: 'insert', data: items });
  } catch (e) {
    try {
      require('fs').appendFileSync('server_errors.log', `[${new Date().toISOString()}] RPC/INSERT ERROR for table ${table}: ${e.stack}\n`);
    } catch(err) {}
    res.json({ error: e.message });
  }
});

app.post('/rpc/upsert', (req, res) => {
  const { table, data, single, onConflict } = req.body;
  try {
    validateTable(table);
    const items = Array.isArray(data) ? data : [data];
    db.transaction(() => {
      for (const item of items) {
        if (table === 'group_medicines' && typeof item.id === 'string') {
          delete item.id;
        }
        if (!item.id && table !== 'group_medicines') item.id = uuid();
        const cols = Object.keys(item);
        for (const col of cols) {
          validateColumn(col);
        }
        const conflict = onConflict || 'id';
        validateColumn(conflict);
        const update = cols.filter(c => c !== 'id').map(c => `"${c}"=excluded."${c}"`).join(',');
        db.prepare(`INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')}) ON CONFLICT(${conflict}) DO UPDATE SET ${update}`).run(...Object.values(item));
      }
    })();

    // Post-upsert hook: if table is group_medicines, ensure we trigger/auto-create pharmacy queue tasks
    if (table === 'group_medicines') {
      try {
        const groupIds = items.map(item => item.group_id).filter(Boolean);
        for (const gId of groupIds) {
          const pg = db.prepare('SELECT visit_id FROM prescription_groups WHERE id = ?').get(gId);
          if (pg && pg.visit_id) {
            ensureMedicineTask(pg.visit_id);
          }
        }
      } catch (err) {
        console.error('[RPC TRIGGER ERROR]', err);
      }
    }

    res.json({ data: single ? items[0] : items });
    if (req.io) req.io.emit('db_changed', { table, action: 'upsert', data: items });
  } catch (e) {
    try {
      require('fs').appendFileSync('server_errors.log', `[${new Date().toISOString()}] RPC/UPSERT ERROR for table ${table}: ${e.stack}\n`);
    } catch(err) {}
    res.json({ error: e.message });
  }
});

app.post('/rpc/update', (req, res) => {
  const { table, data, filters } = req.body;
  try {
    validateTable(table);
    const cols = Object.keys(data);
    for (const col of cols) {
      validateColumn(col);
    }
    const params = Object.values(data);
    const where = Object.entries(filters).map(([c, v]) => {
      validateColumn(c);
      params.push(v.eq !== undefined ? v.eq : v);
      return `"${c}"=?`;
    }).join(' AND ');
    db.prepare(`UPDATE "${table}" SET ${cols.map(c => `"${c}"=?`).join(',')} WHERE ${where}`).run(...params);
    res.json({ data: true });
    if (req.io) req.io.emit('db_changed', { table, action: 'update', filters });
  } catch (e) {
    try {
      require('fs').appendFileSync('server_errors.log', `[${new Date().toISOString()}] RPC/UPDATE ERROR for table ${table}: ${e.stack}\n`);
    } catch(err) {}
    res.json({ error: e.message });
  }
});

app.post('/rpc/delete', (req, res) => {
  const { table, filters } = req.body;
  try {
    validateTable(table);
    const params = [];
    const where = Object.entries(filters).map(([c, v]) => {
      validateColumn(c);
      params.push(v.eq !== undefined ? v.eq : v);
      return `"${c}"=?`;
    }).join(' AND ');
    db.prepare(`DELETE FROM "${table}" WHERE ${where}`).run(...params);
    res.json({ data: true });
    if (req.io) req.io.emit('db_changed', { table, action: 'delete', filters });
  } catch (e) {
    try {
      require('fs').appendFileSync('server_errors.log', `[${new Date().toISOString()}] RPC/DELETE ERROR for table ${table}: ${e.stack}\n`);
    } catch(err) {}
    res.json({ error: e.message });
  }
});

// ─── MEDICINE TRAFFIC CONTROL QUEUE (SQLITE) ───

// Pre-compiled prepared statements for visit transaction operations
const stmtGetPatientName = db.prepare('SELECT name FROM patients WHERE card_number = ? OR id = ?');
const stmtInsertVisit = db.prepare('INSERT INTO visits (id, patient_id, date, doctor_name, notes) VALUES (?, ?, ?, ?, ?)');
const stmtInsertPrescriptionGroup = db.prepare('INSERT INTO prescription_groups (id, visit_id, power, dosage_code) VALUES (?, ?, ?, ?)');
const stmtInsertGroupMedicine = db.prepare('INSERT INTO group_medicines (group_id, medicine_code) VALUES (?, ?)');
const stmtInsertMedicineTask = db.prepare(`
  INSERT INTO medicine_tasks (id, visitId, patientId, patientName, status, createdBy, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, 'PENDING', ?, datetime('now'), datetime('now'))
`);
const stmtInsertMedicineTaskItem = db.prepare(`
  INSERT INTO medicine_task_items (id, taskId, medicineCode, medicineName, dosage, duration, instructions)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const stmtGetFirstDept = db.prepare('SELECT id FROM departments LIMIT 1');
const stmtInsertActivityLog = db.prepare(`
  INSERT INTO activity_logs (id, user_id, departmentId, action, entity, entity_id, timestamp)
  VALUES (?, ?, ?, 'MEDICINE_TASK_CREATED', 'visits', ?, datetime('now'))
`);
const stmtSelectGroupIdsByVisit = db.prepare('SELECT id FROM prescription_groups WHERE visit_id = ?');
const stmtDeletePrescriptionGroupsByVisit = db.prepare('DELETE FROM prescription_groups WHERE visit_id = ?');
const stmtUpdateVisit = db.prepare(`
  UPDATE visits 
  SET doctor_name = ?, date = ?, notes = ? 
  WHERE id = ?
`);
const stmtSelectTaskByVisit = db.prepare('SELECT id FROM medicine_tasks WHERE visitId = ?');
const stmtDeleteTaskItemsByTask = db.prepare('DELETE FROM medicine_task_items WHERE taskId = ?');
const stmtUpdateTaskUpdatedAt = db.prepare(`
  UPDATE medicine_tasks 
  SET updatedAt = datetime('now') 
  WHERE id = ?
`);

const saveFullTx = db.transaction((payload, userId, userName) => {
  const { patientId, doctorName, date, notes, medicineGroups } = payload;
  
  // 1. Get Patient Name
  const patient = stmtGetPatientName.get(patientId, patientId);
  const patientName = patient ? patient.name : 'Unknown';
  
  const visitId = uuid();
  
  // 2. Insert Visit
  stmtInsertVisit.run(visitId, patientId, date || new Date().toISOString(), doctorName, notes);
    
  let hasMeds = false;
  let allMedsForTask = [];
  
  // 3. Insert Prescription Groups & Medicines
  for (let i = 0; i < medicineGroups.length; i++) {
    const group = medicineGroups[i];
    if (!group.meds || group.meds.length === 0) continue;
    hasMeds = true;
    
    const groupId = uuid();
    stmtInsertPrescriptionGroup.run(groupId, visitId, group.power || null, group.dosage || 'BD');
      
    for (const med of group.meds) {
      stmtInsertGroupMedicine.run(groupId, med.code);
        
      allMedsForTask.push({
        code: med.code,
        name: med.name,
        dosage: group.dosage || 'BD',
        duration: group.duration || '',
        instructions: group.instructions || ''
      });
    }
  }
  
  // 4. Create Medicine Task
  if (hasMeds) {
    const taskId = uuid();
    stmtInsertMedicineTask.run(taskId, visitId, patientId, patientName, userName || 'System');
    
    // 5. Create Medicine Task Items
    for (const m of allMedsForTask) {
      stmtInsertMedicineTaskItem.run(uuid(), taskId, m.code, m.name || m.code, m.dosage, m.duration, m.instructions);
    }
    
    // 6. Log Activity
    const firstDept = stmtGetFirstDept.get();
    const deptId = firstDept ? firstDept.id : null;
    stmtInsertActivityLog.run(uuid(), userId || null, deptId, visitId);
  }
  
  return visitId;
});

app.post('/api/visits/save-full', (req, res) => {
  try {
    const u = req.user;
    const visitId = saveFullTx(req.body, u?.userId, u?.userName);
    res.json({ success: true, visitId });
    if (req.io) req.io.emit('db_changed', { table: 'visits' });
  } catch (e) {
    try {
      require('fs').appendFileSync('server_errors.log', `[${new Date().toISOString()}] SAVE-FULL ERROR: ${e.stack}\n`);
    } catch(err) {}
    console.error('[SQLITE VISIT SAVE ERROR]', e);
    res.status(500).json({ error: e.message });
  }
});

const editFullTx = db.transaction((payload) => {
  const { visitId, doctorName, date, notes, medicineGroups } = payload;
  
  // 1. Delete previous mapping data for this visit
  const groupIds = stmtSelectGroupIdsByVisit.all(visitId).map(g => g.id);
  if (groupIds.length > 0) {
    const placeholders = groupIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM group_medicines WHERE group_id IN (${placeholders})`).run(...groupIds);
  }
  stmtDeletePrescriptionGroupsByVisit.run(visitId);

  // 2. Update visits table info
  stmtUpdateVisit.run(doctorName, date, notes, visitId);

  let hasMeds = false;
  let allMedsForTask = [];

  // 3. Insert new groups & medicines
  for (let i = 0; i < medicineGroups.length; i++) {
    const group = medicineGroups[i];
    if (!group.meds || group.meds.length === 0) continue;
    hasMeds = true;
    const groupId = `GRP-${visitId}-${i}`;

    stmtInsertPrescriptionGroup.run(groupId, visitId, group.power || null, group.dosage || 'BD');

    for (const med of group.meds) {
      stmtInsertGroupMedicine.run(groupId, med.code);

      allMedsForTask.push({
        code: med.code,
        name: med.name,
        dosage: group.dosage || 'BD'
      });
    }
  }

  // 4. Update pharmacy tasks if exists
  const task = stmtSelectTaskByVisit.get(visitId);
  if (task) {
    stmtDeleteTaskItemsByTask.run(task.id);
    
    for (const m of allMedsForTask) {
      stmtInsertMedicineTaskItem.run(uuid(), task.id, m.code, m.name || m.code, m.dosage, '', '');
    }

    stmtUpdateTaskUpdatedAt.run(task.id);
  }
});

app.post('/api/visits/edit-full', (req, res) => {
  try {
    editFullTx(req.body);
    res.json({ success: true });
    if (req.io) req.io.emit('db_changed', { table: 'visits' });
  } catch (e) {
    try {
      require('fs').appendFileSync('server_errors.log', `[${new Date().toISOString()}] EDIT-FULL ERROR: ${e.stack}\n`);
    } catch(err) {}
    console.error('[SQLITE VISIT EDIT ERROR]', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/queue/tasks', (req, res) => {
  try {
    const { updatedAfter } = req.query;
    let tasks;
    if (updatedAfter) {
      tasks = db.prepare(`SELECT * FROM medicine_tasks WHERE updatedAt > ? ORDER BY createdAt DESC LIMIT 100`).all(updatedAfter);
    } else {
      tasks = db.prepare(`SELECT * FROM medicine_tasks ORDER BY createdAt DESC LIMIT 100`).all();
    }
    
    if (tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);
      const placeholders = taskIds.map(() => '?').join(',');
      const items = db.prepare(`SELECT * FROM medicine_task_items WHERE taskId IN (${placeholders})`).all(...taskIds);
      
      for (const t of tasks) {
        t.items = items.filter(i => i.taskId === t.id);
      }
    }
    res.json({ data: tasks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/queue/claim', (req, res) => {
  const { taskId, volunteerName } = req.body || {};
  try {
    const u = req.user;
    const name = volunteerName || u?.userName || 'Unknown';
    const info = db.prepare(`
      UPDATE medicine_tasks 
      SET status='IN_PROGRESS', claimedBy=?, claimedAt=datetime('now'), startedAt=datetime('now'), updatedAt=datetime('now')
      WHERE id=? AND status='PENDING'
    `).run(name, taskId);
    
    if (info.changes === 1) {
      res.json({ success: true });
      if (req.io) req.io.emit('db_changed', { table: 'medicine_tasks' });
    } else {
      res.status(409).json({ error: 'Task already claimed or not found' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/queue/finish', (req, res) => {
  const { taskId } = req.body || {};
  try {
    const u = req.user;
    const name = u?.userName || 'Unknown';
    const info = db.prepare(`
      UPDATE medicine_tasks 
      SET status='READY', completedBy=?, completedAt=datetime('now'), updatedAt=datetime('now')
      WHERE id=? AND status='IN_PROGRESS'
    `).run(name, taskId);
    
    if (info.changes === 1) {
      res.json({ success: true });
      if (req.io) req.io.emit('db_changed', { table: 'medicine_tasks' });
    } else {
      res.status(400).json({ error: 'Task not found or not in progress' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/queue/deliver', (req, res) => {
  const { taskId } = req.body || {};
  try {
    const u = req.user;
    const name = u?.userName || 'Unknown';
    const info = db.prepare(`
      UPDATE medicine_tasks 
      SET status='DELIVERED', deliveredBy=?, deliveredAt=datetime('now'), updatedAt=datetime('now')
      WHERE id=? AND status='READY'
    `).run(name, taskId);
    
    if (info.changes === 1) {
      res.json({ success: true });
      if (req.io) req.io.emit('db_changed', { table: 'medicine_tasks' });
    } else {
      res.status(400).json({ error: 'Task not found or not ready' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Timeout check every minute for SQLite tasks
setInterval(() => {
  try {
    db.prepare(`
      UPDATE medicine_tasks 
      SET status = 'PENDING', claimedBy = null, updatedAt = datetime('now')
      WHERE status = 'IN_PROGRESS' 
      AND claimedAt < datetime('now', '-5 minutes')
    `).run();
  } catch(e) {
    console.error('Timeout check error in SQLite', e);
  }
}, 60000);

// ─── USER PROFILE AND PRESENCE ENDPOINTS (SQLITE) ───

app.post('/api/users/create-profile', (req, res) => {
  const { name, department, role, deviceId } = req.body || {};
  if (!name || !department) return res.status(400).json({ error: 'Missing name or department' });

  try {
    let user = db.prepare('SELECT * FROM users WHERE LOWER(name) = LOWER(?) AND department = ?').get(name, department);
    if (!user) {
      const id = uuid();
      // Insert user without passcode
      db.prepare(`
        INSERT INTO users (id, name, passcode, department, role, deviceId, isActive, updatedAt)
        VALUES (?, ?, '', ?, ?, ?, 1, datetime('now'))
      `).run(id, name, department, role || 'Volunteer', deviceId || null);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }

    const token = uuid();
    setSession(token, {
      userId: user.id,
      userName: user.name,
      departmentId: user.departmentId || '1',
      deptCode: department.substring(0, 3).toUpperCase(),
      role: user.role || 'Volunteer',
      lastActiveTime: Date.now()
    });

    res.json({ success: true, token, user: { id: user.id, name: user.name, department: user.department, role: user.role || 'Volunteer' } });
    if (req.io) req.io.emit('db_changed', { table: 'users' });
  } catch (e) {
    console.error('[CREATE PROFILE ERROR SQLITE]', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/presence', (req, res) => {
  try {
    // Return all presence entries. Determine online dynamically: if lastHeartbeatAt is within 30 seconds.
    const rows = db.prepare(`
      SELECT *, 
      CASE WHEN lastHeartbeatAt >= datetime('now', '-30 seconds') THEN 1 ELSE 0 END as isOnlineCalc
      FROM user_presence
      ORDER BY lastActivityAt DESC
    `).all();
    
    const presenceList = rows.map(r => ({
      ...r,
      isOnline: r.isOnlineCalc === 1
    }));
    
    res.json({ data: presenceList });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/presence/heartbeat', (req, res) => {
  const { userId, userName, department, currentScreen, currentTaskId, currentPatientName, currentStatus, deviceId } = req.body || {};
  if (!userId || !userName) return res.status(400).json({ error: 'Missing userId or userName' });

  try {
    const presenceId = uuid();
    // SQLite upsert (INSERT ON CONFLICT(userId) DO UPDATE)
    db.prepare(`
      INSERT INTO user_presence (
        id, userId, userName, department, currentStatus, currentScreen, 
        currentTaskId, currentPatientName, lastActivityAt, lastHeartbeatAt, isOnline, deviceId, updatedAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 1, ?, datetime('now')
      ) ON CONFLICT (userId) DO UPDATE SET
        userName = excluded.userName,
        department = excluded.department,
        currentStatus = excluded.currentStatus,
        currentScreen = excluded.currentScreen,
        currentTaskId = excluded.currentTaskId,
        currentPatientName = excluded.currentPatientName,
        lastHeartbeatAt = datetime('now'),
        lastActivityAt = CASE WHEN excluded.currentStatus != 'IDLE' THEN datetime('now') ELSE user_presence.lastActivityAt END,
        isOnline = 1,
        deviceId = excluded.deviceId,
        updatedAt = datetime('now')
    `).run(
      presenceId, userId, userName, department || 'MED', currentStatus || 'ONLINE', 
      currentScreen || null, currentTaskId || null, currentPatientName || null, deviceId || null
    );

    res.json({ success: true });
    if (req.io) req.io.emit('db_changed', { table: 'user_presence' });
  } catch (e) {
    console.error('[HEARTBEAT ERROR SQLITE]', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/health', (_req, res) => {
  try {
    res.json({
      ok: true,
      backend: 'sqlite',
      dbFile: 'nekkadam.db',
      patients: db.prepare('SELECT COUNT(*) as c FROM patients').get().c,
      visits: db.prepare('SELECT COUNT(*) as c FROM visits').get().c,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─────────────────────────────────────
//  START
// ─────────────────────────────────────
server.listen(port, '0.0.0.0', () => {
  console.log(`\x1b[32m[SQLITE ONLINE]\x1b[0m Port ${port} | nekkadam.db (Realtime Active)`);
});

process.on('SIGTERM', () => { db.close(); process.exit(0); });
