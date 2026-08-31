/**
 * Nek Kadam — PostgreSQL backend (port 3001)
 * Parity target: server.cjs (SQLite) + extra routes used by TokenQueue / Login.
 *
 * Env: DATABASE_URL OR PGUSER/PGPASSWORD/PGHOST/PGDATABASE/PGPORT (see `.env.example`).
 * Schema is applied from infra/postgres/migrations (tracked in schema_migrations); see docs/POSTGRES_ARCHITECTURE.md.
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
require('dotenv').config();

const { createPool } = require('./infra/postgres/create_pool.cjs');
const { runPgMigrations } = require('./infra/postgres/run_migrations.cjs');

const app = express();
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('[SOCKET PG] Client connected:', socket.id);
  
  socket.on('send_chat_message', async (msg) => {
    try {
      const msgId = 'MSG-' + uuid();
      const timestamp = new Date().toISOString();
      const { senderId, senderName, senderDepartment, recipientId, message, fileName, fileData } = msg;
      
      await pool.query(`
        INSERT INTO chat_messages (id, "senderId", "senderName", "senderDepartment", "recipientId", message, timestamp, "fileName", "fileData")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [msgId, senderId, senderName, senderDepartment, recipientId || null, message, timestamp, fileName || null, fileData || null]);
      
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
      console.error('[SOCKET PG] Error saving chat message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('[SOCKET PG] Client disconnected:', socket.id);
  });
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

const port = Number(process.env.PORT || 3001);
const migrationsDir = path.join(__dirname, 'infra/postgres/migrations');

const pool = createPool();
pool.on('error', (err) => {
  console.error('[PG POOL]', err.message);
});

function attachGracefulShutdown() {
  async function bye() {
    try {
      await pool.end();
    } catch (_) {
      /* ignore */
    }
  }
  process.once('SIGINT', async () => {
    await bye();
    process.exit(0);
  });
  process.once('SIGTERM', async () => {
    await bye();
    process.exit(0);
  });
}

app.use(cors());
app.use(bodyParser.json({ limit: '4mb' }));

// CRITICAL FIX: Clean IndexedDB cache '.0' suffix from patient IDs globally
const cleanDotZeroId = (val) => {
  if (typeof val === 'string' && val.endsWith('.0')) {
    return val.substring(0, val.length - 2);
  }
  return val;
};

const sanitizeIds = (obj) => {
  if (Array.isArray(obj)) {
    obj.forEach(sanitizeIds);
  } else if (obj !== null && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (['patientId', 'patient_id', 'identifier', 'id'].includes(key)) {
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

app.use('/static', express.static('dist'));
app.use(express.static(path.join(__dirname, 'dist')));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const dur = Date.now() - start;
    const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    console.log(`${color}[${req.method}]\x1b[0m ${req.originalUrl || req.path} - ${res.statusCode} (${dur}ms)`);
  });
  next();
});

/** Convert SQLite-style `?` placeholders to $1, $2, … */
function pgSql(sql) {
  let i = 1;
  return sql.replace(/\?/g, () => `$${i++}`);
}

function uuid() {
  return crypto.randomUUID();
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

const activeSessions = new Map();

// ─── Schema: versioned SQL under infra/postgres/migrations (single source of truth) ───
async function ensureSchema() {
  await runPgMigrations(pool, migrationsDir);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      "senderId" TEXT NOT NULL,
      "senderName" TEXT NOT NULL,
      "senderDepartment" TEXT NOT NULL,
      "recipientId" TEXT,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      "fileName" TEXT,
      "fileData" TEXT
    );
  `);
}

async function q(sql, params = []) {
  return pool.query(sql, params);
}

async function qr(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function qr1(sql, params = []) {
  const r = await qr(sql, params);
  return r[0];
}

async function execSqliteStyle(sqlWithQ, params) {
  const { rows } = await pool.query(pgSql(sqlWithQ), params);
  return rows;
}

async function qr1lite(sqlWithQ, params) {
  const rows = await execSqliteStyle(sqlWithQ, params);
  return rows[0];
}

// ─── Auth ───
async function requireAuth(req, res, next) {
  try {
    if (!req.user) {
      const adminRow = await qr1(
        `SELECT u.id, u.name, u.role, u."departmentId", d.code AS deptcode
         FROM users u LEFT JOIN departments d ON u."departmentId" = d.id
         WHERE upper(u.role::text) = 'ADMIN' LIMIT 1`,
        []
      );
      if (adminRow) {
        req.user = {
          userId: adminRow.id,
          userName: adminRow.name,
          role: adminRow.role,
          deptCode: adminRow.deptcode,
          departmentId: adminRow.departmentId,
          lastActiveTime: Date.now(),
        };
      } else {
        req.user = { userId: 'admin', userName: 'Default Admin', role: 'ADMIN', deptCode: 'MED', departmentId: '1', lastActiveTime: Date.now() };
      }
    }
    next();
  } catch (_e) {
    req.user = { userId: 'admin', userName: 'Default Admin', role: 'ADMIN', deptCode: 'MED', departmentId: '1', lastActiveTime: Date.now() };
    next();
  }
}

async function hydrateUserFromBearer(req, res, next) {
  try {
    const h = req.headers.authorization;
    if (h?.startsWith('Bearer ')) {
      const sid = h.slice('Bearer '.length).trim();
      const s = activeSessions.get(sid);
      if (s) req.user = s;
    }
  } catch (_) { /* noop */ }
  next();
}

app.use('/rpc', hydrateUserFromBearer, requireAuth);
app.use('/api', hydrateUserFromBearer, requireAuth);

// ─── Users (login picker) ───
app.get('/api/users', async (_req, res) => {
  try {
    const rows = await qr(
      `SELECT u.id, u.name, d.name AS department, d.code AS deptcode
       FROM users u
       LEFT JOIN departments d ON u."departmentId" = d.id
       ORDER BY u.name`,
      []
    );
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        department: r.department || '',
        deptCode: r.deptcode || '',
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Simpler path for tokenService
app.get('/api/departments', async (_req, res) => {
  try {
    const rows = await qr('SELECT id, name, code FROM departments ORDER BY name', []);
    res.json({ data: rows, departments: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/pc-login', async (_req, res) => {
  try {
    const user = await qr1lite(
      `SELECT u.*, d.code as deptCode FROM users u LEFT JOIN departments d ON u."departmentId" = d.id WHERE upper(u.role::text) = 'ADMIN' LIMIT 1`,
      []
    );
    if (!user) return res.status(503).json({ error: 'No admin user' });
    const token = uuid();
    activeSessions.set(token, {
      userId: user.id,
      userName: user.name,
      departmentId: user.departmentId,
      deptCode: user.deptcode || user.deptCode,
      role: user.role,
      lastActiveTime: Date.now(),
    });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        departmentId: user.departmentId,
        deptCode: user.deptcode || user.deptCode,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { name, passcode } = req.body || {};
    const hash = crypto.createHash('sha256').update(passcode || '').digest('hex');
    const user = await qr1lite(
      `SELECT u.*, d.code as deptCode FROM users u JOIN departments d ON u.departmentId = d.id WHERE u.name = ? AND u.passcode = ?`,
      [name, hash]
    );
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = uuid();
    activeSessions.set(token, {
      userId: user.id,
      userName: user.name,
      departmentId: user.departmentId,
      deptCode: user.deptcode || user.deptCode,
      role: user.role,
      lastActiveTime: Date.now(),
    });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        departmentId: user.departmentId,
        deptCode: user.deptcode || user.deptCode,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/logout', async (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/heartbeat', async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    let session = sessionId ? activeSessions.get(sessionId) : null;
    if (!session) session = req.user;
    if (session?.lastActiveTime !== undefined) session.lastActiveTime = Date.now();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/heartbeat', async (_req, res) => {
  res.json({ ok: true, serverTime: new Date().toISOString() });
});

app.post('/api/log-activity', async (req, res) => {
  try {
    const { userId, action, entity, entityId } = req.body || {};
    const u = req.user;
    let deptId = u?.departmentId || null;
    if (!deptId) {
      const drow = await qr1('SELECT id FROM departments LIMIT 1', []);
      deptId = drow?.id;
    }
    await q(
      `INSERT INTO activity_logs (id, user_id, departmentId, action, entity, entity_id, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [uuid(), userId || u?.userId, deptId, action, entity || null, entityId || null]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[LOG]', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    const totPt = await qr1('SELECT COUNT(*)::int AS c FROM patients');
    const totVt = await qr1('SELECT COUNT(*)::int AS c FROM visits');
    res.json({
      ok: true,
      backend: 'postgres',
      patients: totPt?.c || 0,
      visits: totVt?.c || 0,
    });
  } catch (e) {
    res.status(500).json({ ok: false, backend: 'postgres', error: e.message });
  }
});

app.get('/api/dashboard', async (_req, res) => {
  try {
    const pts = await qr1(`SELECT COUNT(*)::int AS c FROM patients WHERE created_at::date >= CURRENT_DATE`);
    const totPt = await qr1('SELECT COUNT(*)::int AS c FROM patients');
    const totVt = await qr1('SELECT COUNT(*)::int AS c FROM visits');
    let logs = [];
    try {
      logs = await qr(`
        SELECT l.*, COALESCE(u.name, 'Staff') AS "userName", COALESCE(d.code, 'GEN') AS "deptCode"
        FROM activity_logs l
        LEFT JOIN users u ON (l.user_id = u.id OR l."userId" = u.id)
        LEFT JOIN departments d ON (l."departmentId" = d.id)
        ORDER BY l.timestamp DESC LIMIT 10
      `);
    } catch (_) {}
    res.json({
      stats: {
        patientsToday: pts?.c || 0,
        totalPatients: totPt?.c || 0,
        totalVisits: totVt?.c || 0,
      },
      recentLogs: logs,
      loads: {},
      users: [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/chat/history', async (req, res) => {
  try {
    const { recipientId } = req.query || {};
    let messages;
    if (recipientId && recipientId !== 'null' && recipientId !== 'undefined' && recipientId !== '') {
      const currentUserId = req.user?.userId || 'admin';
      messages = await qr(
        `SELECT id, "senderId", "senderName", "senderDepartment", "recipientId", message, timestamp 
         FROM chat_messages 
         WHERE ("senderId" = $1 AND "recipientId" = $2) OR ("senderId" = $2 AND "recipientId" = $1)
         ORDER BY timestamp ASC LIMIT 200`,
        [currentUserId, recipientId]
      );
    } else {
      messages = await qr(
        `SELECT id, "senderId", "senderName", "senderDepartment", "recipientId", message, timestamp 
         FROM chat_messages 
         WHERE "recipientId" IS NULL OR "recipientId" = ''
         ORDER BY timestamp ASC LIMIT 200`,
        []
      );
    }
    
    const mapped = messages.map(m => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.senderName,
      senderDepartment: m.senderDepartment,
      recipientId: m.recipientId,
      message: m.message,
      timestamp: m.timestamp
    }));
    
    res.json({ data: mapped });
  } catch (e) {
    console.error('CHAT HISTORY ERROR PG:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/patients/:identifier/visits', async (req, res) => {
  try {
    let { identifier } = req.params;
    if (identifier && identifier.endsWith('.0')) identifier = identifier.slice(0, -2);
    const patient = await qr1lite('SELECT id, card_number FROM patients WHERE id = ? OR card_number = ?', [identifier, identifier]);
    const cardNumber = patient ? patient.card_number : identifier;

    const visits = await execSqliteStyle('SELECT * FROM visits WHERE patient_id = ? ORDER BY date DESC', [cardNumber]);
    let allGroups = [];
    let allMeds = [];

    if (visits.length > 0) {
      const visitIds = visits.map(v => v.id);
      allGroups = await qr(`SELECT * FROM prescription_groups WHERE visit_id = ANY($1)`, [visitIds]);

      if (allGroups.length > 0) {
        const groupIds = allGroups.map(g => g.id);
        allMeds = await qr(`
          SELECT gm.*, COALESCE(m.name, gm.medicine_code) AS medicine_name
          FROM group_medicines gm
          LEFT JOIN medicines m ON gm.medicine_code = m.code
          WHERE gm.group_id = ANY($1)
        `, [groupIds]);
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
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/users', async (_req, res) => {
  try {
    const users = await qr(`
      SELECT u.id, u.name, u.role, u.departmentId, u.isActive, u.passcode, d.name AS department
      FROM users u
      LEFT JOIN departments d ON u.departmentId = d.id
      ORDER BY u.name
    `);
    res.json({ data: users });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/departments', async (_req, res) => {
  try {
    const depts = await qr('SELECT id, name, code FROM departments WHERE "isActive" = 1 ORDER BY name', []);
    res.json({ data: depts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/users/create', async (req, res) => {
  try {
    const { name, passcode, department, role } = req.body || {};
    if (!name || !passcode || !role) return res.status(400).json({ error: 'Missing required fields' });
    const hash = crypto.createHash('sha256').update(passcode).digest('hex');
    let deptId = null;
    if (department) {
      const dept = await qr1lite('SELECT id FROM departments WHERE name = ? OR code = ? OR id = ?', [department, department, department]);
      if (dept) deptId = dept.id;
    }
    if (!deptId) {
      const firstDept = await qr1('SELECT id FROM departments LIMIT 1', []);
      deptId = firstDept?.id || null;
    }
    await q(
      `INSERT INTO users (id, name, passcode, departmentId, role, isActive) VALUES ($1,$2,$3,$4,$5,1)`,
      [uuid(), name, hash, deptId, String(role).toUpperCase()]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/users/update', async (req, res) => {
  try {
    const { id, name, passcode, department, role, is_active } = req.body || {};
    const dept = await qr1lite('SELECT id FROM departments WHERE name = ? OR code = ?', [department, department]);
    const deptId = dept?.id || null;
    const params = [name, String(role).toUpperCase(), is_active ? 1 : 0];
    let sql = 'UPDATE users SET name = $1, role = $2, isActive = $3';
    let idx = 4;
    if (passcode && String(passcode).length > 0) {
      const hash = crypto.createHash('sha256').update(passcode).digest('hex');
      sql += `, passcode = $${idx++}`;
      params.push(hash);
    }
    if (deptId) {
      sql += `, departmentId = $${idx++}`;
      params.push(deptId);
    }
    sql += ` WHERE id = $${idx}`;
    params.push(id);
    await q(sql, params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Token helpers ───
function mapTokenRow(t) {
  if (!t) return null;
  const tokenNumber = t.tokenNumber ?? t.tokennumber;
  const dateKey = t.dateKey ?? t.datekey;
  const personId = t.personId ?? t.personid;
  const personName = t.personName ?? t.personname;
  const personCard = t.personCard ?? t.personcard;
  const currentDepartmentId = t.currentDepartmentId ?? t.currentdepartmentid;
  const sourceDepartmentId = t.sourceDepartmentId ?? t.sourcedepartmentid;
  const sequenceIndex = t.sequenceIndex ?? t.sequenceindex;
  const isDeleted = t.isDeleted ?? t.isdeleted;

  return {
    id: t.id,
    tokenNumber,
    dateKey,
    personId,
    personName,
    personCard,
    currentDepartmentId,
    sourceDepartmentId,
    status: t.status,
    priority: t.priority,
    sequenceIndex,
    created_at: t.created_at,
    updated_at: t.updated_at,
    departmentCode: t.departmentCode ?? t.departmentcode,
    isDeleted,
  };
}

async function loadTokenWithDept(id) {
  const t = await qr1(
    `
    SELECT t.*, d.code AS "departmentCode"
    FROM tokens t
    JOIN departments d ON t.currentDepartmentId = d.id
    WHERE t.id = $1
    `,
    [id]
  );
  return mapTokenRow(t);
}

app.get('/api/tokens/dashboard', async (_req, res) => {
  try {
    const dateKey = todayKey();
    const depts = await qr('SELECT id, name, code FROM departments WHERE "isActive" = 1');

    const statsRows = await qr(
      `
      SELECT
        currentDepartmentId AS "currentDepartmentId",
        COALESCE(SUM(CASE WHEN status = 'WAITING' THEN 1 ELSE 0 END),0)::int AS waiting,
        COALESCE(SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END),0)::int AS inprogress,
        COALESCE(SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END),0)::int AS done,
        COALESCE(SUM(CASE WHEN status = 'SKIPPED' THEN 1 ELSE 0 END),0)::int AS skipped
      FROM tokens
      WHERE dateKey = $1 AND isDeleted = 0
      GROUP BY currentDepartmentId
      `,
      [dateKey]
    );

    const currentRows = await qr(
      `
      SELECT DISTINCT ON (t.currentDepartmentId) t.*, d.code AS "departmentCode"
      FROM tokens t JOIN departments d ON t.currentDepartmentId = d.id
      WHERE t.dateKey = $1 AND t.status = 'IN_PROGRESS' AND t.isDeleted = 0
      ORDER BY t.currentDepartmentId, t.id
      `,
      [dateKey]
    );

    const nextRows = await qr(
      `
      SELECT DISTINCT ON (t.currentDepartmentId) t.*, d.code AS "departmentCode"
      FROM tokens t JOIN departments d ON t.currentDepartmentId = d.id
      WHERE t.dateKey = $1 AND t.status = 'WAITING' AND t.isDeleted = 0
      ORDER BY t.currentDepartmentId, t.priority DESC, t.sequenceIndex ASC
      `,
      [dateKey]
    );

    const statsMap = {};
    for (const r of statsRows) {
      statsMap[r.currentDepartmentId || r.currentdepartmentid] = r;
    }
    const currentMap = {};
    for (const r of currentRows) {
      currentMap[r.currentDepartmentId || r.currentdepartmentid] = r;
    }
    const nextMap = {};
    for (const r of nextRows) {
      nextMap[r.currentDepartmentId || r.currentdepartmentid] = r;
    }

    const data = [];
    for (const d of depts) {
      const stats = statsMap[d.id];
      const current = currentMap[d.id];
      const next = nextMap[d.id];

      data.push({
        departmentId: d.id,
        departmentName: d.name,
        departmentCode: d.code,
        waiting: stats?.waiting || 0,
        inProgress: stats?.inprogress || 0,
        done: stats?.done || 0,
        skipped: stats?.skipped || 0,
        nextToken: next
          ? {
              tokenNumber: next.tokenNumber,
              personName: next.personName,
              personCard: next.personCard,
              priority: next.priority,
            }
          : null,
        currentToken: current
          ? {
              tokenNumber: current.tokenNumber,
              personName: current.personName,
              personCard: current.personCard,
              priority: current.priority,
            }
          : null,
      });
    }
    const totalsRow = await qr1(
      `
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END),0)::int AS done
      FROM tokens
      WHERE dateKey = $1 AND isDeleted = 0
      `,
      [dateKey]
    );
    res.json({
      data,
      totals: {
        totalToday: totalsRow?.total || 0,
        totalDone: totalsRow?.done || 0,
        dateKey,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/tokens', async (req, res) => {
  try {
    const dateKey = req.query.dateKey || todayKey();
    const departmentId = req.query.departmentId;
    const status = req.query.status;
    const params = [dateKey];
    let sql = `
      SELECT t.*, d.code AS "departmentCode"
      FROM tokens t
      JOIN departments d ON t.currentDepartmentId = d.id
      WHERE t.dateKey = $1 AND t.isDeleted = 0
    `;
    if (departmentId) {
      sql += ` AND t.currentDepartmentId = $${params.length + 1}`;
      params.push(departmentId);
    }
    if (status) {
      sql += ` AND t.status = $${params.length + 1}`;
      params.push(status);
    }
    sql += ` ORDER BY t.priority DESC, t.sequenceIndex ASC`;
    const rows = await qr(sql, params);
    res.json({
      data: rows.map((r) => mapTokenRow(r)),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/tokens/:tokenId/events', async (req, res) => {
  try {
    const rows = await qr(
      `SELECT id, "tokenId", "userId", "departmentId", event, metadata, "timestamp" FROM token_events WHERE "tokenId" = $1 ORDER BY "timestamp" DESC`,
      [req.params.tokenId]
    );
    res.json({ data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tokens/create', async (req, res) => {
  try {
    const { personId, personName, personCard, priority } = req.body || {};
    const dateKey = todayKey();
    const exists = await qr1lite(
      'SELECT id, tokenNumber, status FROM tokens WHERE personId = ? AND dateKey = ? AND isDeleted = 0',
      [personId, dateKey]
    );
    if (exists) return res.json({ error: `Token #${exists.tokennumber || exists.tokenNumber} already exists today (Status: ${exists.status})` });

    let receptionRow = await qr1("SELECT id FROM departments WHERE code = $1 LIMIT 1", ['RECEPTION']);
    if (!receptionRow?.id) receptionRow = await qr1('SELECT id FROM departments ORDER BY code LIMIT 1', []);
    const receptionId = receptionRow?.id;
    if (!receptionId) return res.status(503).json({ error: 'No departments configured' });
    const maxNumRow = await qr1('SELECT MAX(tokenNumber) AS m FROM tokens WHERE dateKey = $1', [dateKey]);
    const nextNum = (maxNumRow?.m || 0) + 1;
    const maxSeqRow = await qr1(
      'SELECT MAX(sequenceIndex) AS m FROM tokens WHERE currentDepartmentId = $1 AND dateKey = $2',
      [receptionId, dateKey]
    );
    const nextSeq = (maxSeqRow?.m || 0) + 1;
    const tokenId = uuid();
    await q(
      `INSERT INTO tokens (id, tokenNumber, dateKey, personId, personName, personCard, currentDepartmentId, status, priority, sequenceIndex, isDeleted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'WAITING',$8,$9,0)`,
      [tokenId, nextNum, dateKey, personId, personName, personCard || personId, receptionId, priority || 'NORMAL', nextSeq]
    );
    const mapped = await loadTokenWithDept(tokenId);
    res.json({ data: mapped });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tokens/start', async (req, res) => {
  try {
    const { departmentId, tokenId } = req.body || {};
    const dateKey = todayKey();
    await q(
      `UPDATE tokens SET status = 'DONE'
       WHERE currentDepartmentId = $1 AND dateKey = $2 AND status = 'IN_PROGRESS'`,
      [departmentId, dateKey]
    );
    let targetId = tokenId;
    if (!targetId) {
      const next = await qr1(
        `SELECT id FROM tokens WHERE currentDepartmentId = $1 AND dateKey = $2 AND status = 'WAITING' AND isDeleted = 0
         ORDER BY priority DESC, sequenceIndex ASC LIMIT 1`,
        [departmentId, dateKey]
      );
      if (!next) return res.json({ error: 'No waiting tokens' });
      targetId = next.id;
    }
    await q(`UPDATE tokens SET status = 'IN_PROGRESS' WHERE id = $1`, [targetId]);
    const mapped = await loadTokenWithDept(targetId);
    res.json({ data: mapped });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function deptOrderIds() {
  const rows = await qr('SELECT id FROM departments WHERE "isActive" = 1 ORDER BY code ASC');
  return rows.map((r) => r.id);
}

app.post('/api/tokens/move', async (req, res) => {
  try {
    const { tokenId } = req.body || {};
    const t = await qr1('SELECT * FROM tokens WHERE id = $1', [tokenId]);
    if (!t) return res.json({ error: 'Token not found' });
    const curDept = t.currentDepartmentId || t.currentdepartmentid;
    const dk = t.dateKey || t.datekey;
    const order = await deptOrderIds();
    const ix = order.indexOf(curDept);
    if (ix >= 0 && ix < order.length - 1) {
      const nextDept = order[ix + 1];
      const maxSeqRow = await qr1(
        'SELECT MAX(sequenceIndex) AS m FROM tokens WHERE currentDepartmentId = $1 AND dateKey = $2',
        [nextDept, dk]
      );
      const nextSeq = (maxSeqRow?.m || 0) + 1;
      await q(
        `UPDATE tokens SET currentDepartmentId = $2, status = 'WAITING', priority = priority, sequenceIndex = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [tokenId, nextDept, nextSeq]
      );
    } else {
      await q(`UPDATE tokens SET status = 'DONE', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [tokenId]);
    }
    res.json({ data: await loadTokenWithDept(tokenId) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tokens/skip', async (req, res) => {
  try {
    await q(`UPDATE tokens SET status = 'SKIPPED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [req.body?.tokenId]);
    res.json({ data: await loadTokenWithDept(req.body?.tokenId) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tokens/requeue', async (req, res) => {
  try {
    const id = req.body?.tokenId;
    await q(`UPDATE tokens SET status = 'WAITING', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
    res.json({ data: await loadTokenWithDept(id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tokens/cancel', async (req, res) => {
  try {
    await q(`UPDATE tokens SET status = 'CANCELLED', isDeleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [req.body?.tokenId]);
    res.json({ data: await loadTokenWithDept(req.body?.tokenId) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tokens/priority', async (req, res) => {
  try {
    const { tokenId, priority } = req.body || {};
    await q(`UPDATE tokens SET priority = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [tokenId, priority]);
    res.json({ data: await loadTokenWithDept(tokenId) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Education ───
app.get('/api/education/batches', async (_req, res) => {
  try {
    const data = await qr('SELECT * FROM batches WHERE "isActive" = 1');
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/education/batches/create', async (req, res) => {
  try {
    const { name, timing } = req.body || {};
    await q('INSERT INTO batches (id, name, timing, "isActive") VALUES ($1, $2, $3, 1)', [uuid(), name, timing || null]);
    res.json({ success: true });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.get('/api/education/batches/:batchId/students', async (req, res) => {
  try {
    const targetDate = req.query.date || new Date().toLocaleDateString('en-CA');
    const students = await qr(
      `
      SELECT es.id AS "educationStudentId", p.name, p.card_number, p.id AS "patientId",
        (SELECT status FROM attendance WHERE "studentId" = es.id AND date = $2) AS "todayStatus"
      FROM education_students es
      JOIN patients p ON (es."patientId" = p.card_number OR es."patientId" = p.id)
      WHERE es."batchId" = $1 AND es."isActive" = 1
      `,
      [req.params.batchId, targetDate]
    );
    res.json({ data: students.map((s) => ({ ...s, tag: s.tag || 'Regular' })) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/education/attendance/bulk', async (req, res) => {
  try {
    const { date, records, userId } = req.body || {};
    const targetDate = date || new Date().toLocaleDateString('en-CA');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of records || []) {
        await client.query(
          `
          INSERT INTO attendance (id, "studentId", date, status, note, "markedBy")
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT ("studentId", date) DO UPDATE SET
            status = EXCLUDED.status,
            note = EXCLUDED.note,
            "markedBy" = EXCLUDED."markedBy",
            updated_at = CURRENT_TIMESTAMP
          `,
          [uuid(), r.studentId, targetDate, r.status, r.note || null, userId || null]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json({ success: true });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.post('/api/education/enroll-existing', async (req, res) => {
  try {
    const { patientId, batchId } = req.body || {};
    const patient = await qr1lite('SELECT id, card_number FROM patients WHERE card_number = ? OR id = ?', [patientId, patientId]);
    if (!patient) return res.json({ error: 'Patient not found' });
    const cardUse = patient.card_number;
    const dup = await qr1('SELECT id FROM education_students WHERE "patientId" = $1 AND "batchId" = $2', [cardUse, batchId]);
    if (dup) return res.json({ error: 'Already enrolled in this batch' });

    await q(`INSERT INTO education_students (id, "patientId", "batchId", "isActive") VALUES ($1,$2,$3,1)`, [uuid(), cardUse, batchId]);
    res.json({ success: true });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.get('/api/education/attendance/summary', async (req, res) => {
  try {
    const targetDate = (req.query.date || new Date().toLocaleDateString('en-CA')).toString();
    const batchId = req.query.batchId;
    const params = [targetDate];
    let sql = `
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END),0)::int AS present,
        COALESCE(SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END),0)::int AS absent,
        COALESCE(SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END),0)::int AS late
      FROM attendance a
      JOIN education_students es ON a."studentId" = es.id
      WHERE a.date = $1
    `;
    if (batchId) {
      sql += ` AND es."batchId" = $2`;
      params.push(batchId);
    }
    const row = await qr1(sql, params);
    res.json({ data: row || { total: 0, present: 0, absent: 0, late: 0 } });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.post('/api/education/students/create', async (req, res) => {
  try {
    const { name, adhar_no, phone, age, batchId } = req.body || {};
    let patient = null;
    if (adhar_no) patient = await qr1lite('SELECT id, card_number FROM patients WHERE adhar_no = ?', [adhar_no]);
    if (!patient && phone) patient = await qr1lite('SELECT id, card_number FROM patients WHERE name = ? AND phone = ?', [name, phone]);
    let patientUUID;
    let cardNumber;
    if (!patient) {
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      cardNumber = adhar_no || `NK${randomSuffix}`;
      patientUUID = uuid();
      await q(
        `INSERT INTO patients (card_number, id, name, adhar_no, phone, age)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          cardNumber,
          patientUUID,
          name,
          adhar_no || null,
          phone || null,
          age !== undefined && age !== null && age !== '' ? Number.parseInt(String(age), 10) || null : null,
        ]
      );
    } else {
      cardNumber = patient.card_number;
      patientUUID = patient.id;
    }
    const exists = await qr1(`SELECT id FROM education_students WHERE "patientId" = $1 AND "batchId" = $2`, [cardNumber, batchId]);
    if (exists) return res.json({ error: 'Student already exists in this batch' });

    await q(`INSERT INTO education_students (id, "patientId", "batchId", "isActive") VALUES ($1,$2,$3,1)`, [uuid(), cardNumber, batchId]);
    res.json({ success: true });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.post('/api/education/students/:id/remove', async (req, res) => {
  try {
    const studentId = req.params.id;
    await q(`DELETE FROM attendance WHERE "studentId" = $1`, [studentId]);
    await q(`DELETE FROM education_students WHERE id = $1`, [studentId]);
    res.json({ success: true });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// ─── Search ───
app.get('/api/patients/search', async (req, res) => {
  try {
    const qRaw = ((req.query.q || '') + '').trim();
    const qPat = `%${qRaw}%`;
    const data = await qr(
      `
      SELECT * FROM patients
      WHERE UPPER(card_number) LIKE UPPER($1) OR UPPER(name) LIKE UPPER($1)
      LIMIT 10
      `,
      [qPat]
    );
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function filterPrimitive(v) {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    if (v.eq !== undefined) return { op: '=', val: v.eq };
    if (v.neq !== undefined) return { op: '<>', val: v.neq };
    if (v.gte !== undefined) return { op: '>=', val: v.gte };
    if (v.lte !== undefined) return { op: '<=', val: v.lte };
    if (v.ilike !== undefined) return { op: 'ILIKE', val: String(v.ilike).replace(/%/g, '') };
    if (v.in !== undefined && Array.isArray(v.in)) return { op: 'IN', val: v.in };
  }
  return { op: '=', val: v };
}

function extendWhere(filters, params, clauses) {
  if (!filters) return;
  for (const [col, raw] of Object.entries(filters)) {
    const meta = filterPrimitive(raw);
    if (meta.op === 'IN') {
      const arr = meta.val || [];
      if (!arr.length) continue;
      const ph = [];
      for (const el of arr) {
        params.push(el);
        ph.push(`$${params.length}`);
      }
      clauses.push(`"${col}" IN (${ph.join(', ')})`);
      continue;
    }
    if (meta.op === 'ILIKE') {
      params.push(`%${meta.val}%`);
      clauses.push(`"${col}"::text ILIKE $${params.length}`);
      continue;
    }
    if (meta.op === '<>') {
      params.push(meta.val);
      clauses.push(`"${col}" <> $${params.length}`);
      continue;
    }
    if (meta.op === '>=') {
      params.push(meta.val);
      clauses.push(`"${col}" >= $${params.length}`);
      continue;
    }
    if (meta.op === '<=') {
      params.push(meta.val);
      clauses.push(`"${col}" <= $${params.length}`);
      continue;
    }
    params.push(meta.val);
    clauses.push(`"${col}" = $${params.length}`);
  }
}

// ─── RPC (mobile sync subset) ───
app.post('/rpc/query', async (req, res) => {
  const { table, select, filters, order, single, limit, head, count, or: orClause } = req.body || {};
  try {
    if (orClause && typeof orClause === 'string') {
      return res.status(400).json({ error: 'OR filters not supported on PG RPC endpoint.' });
    }
    const params = [];
    const clauses = [];
    extendWhere(filters, params, clauses);
    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    if (head || count) {
      const csql = `SELECT COUNT(*)::int AS c FROM "${table}" ${whereSql}`;
      const crow = await qr1(csql, [...params]);
      return res.json({ data: null, count: crow?.c ?? 0 });
    }

    let sql = `SELECT ${select || '*'} FROM "${table}"`;
    if (whereSql) sql += ` ${whereSql}`;
    if (order) sql += ` ORDER BY "${order.column}" ${order.ascending !== false ? 'ASC' : 'DESC'}`;
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
    const { rows } = await pool.query(sql, params);
    res.json({ data: single ? rows[0] ?? null : rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/rpc/insert', async (req, res) => {
  const { table, data: bodyData, single } = req.body || {};
  try {
    const items = Array.isArray(bodyData) ? bodyData : [bodyData];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of items) {
        if (!item.id) item.id = uuid();
        const cols = Object.keys(item);
        const params = Object.values(item);
        const ph = cols.map((_, i) => `$${i + 1}`).join(',');
        await client.query(
          `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${ph})`,
          params
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.json({ data: single ? items[0] : items });
    if (req.io) req.io.emit('db_changed', { table, action: req.path.includes('upsert') ? 'upsert' : 'insert', data: items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/rpc/upsert', async (req, res) => {
  const { table, data: bodyData, single, onConflict } = req.body || {};
  try {
    const items = Array.isArray(bodyData) ? bodyData : [bodyData];
    const conflict = onConflict || 'id';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of items) {
        if (!item.id) item.id = uuid();
        const cols = Object.keys(item);
        const params = Object.values(item);
        const ph = cols.map((_, i) => `$${i + 1}`).join(',');
        const upd = cols
          .filter((c) => c !== conflict)
          .map((c) => `"${c}"=EXCLUDED."${c}"`)
          .join(',');
        const sql = `
          INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')})
          VALUES (${ph})
          ON CONFLICT ("${conflict}") DO UPDATE SET ${upd}`;
        await client.query(sql, params);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.json({ data: single ? items[0] : items });
    if (req.io) req.io.emit('db_changed', { table, action: req.path.includes('upsert') ? 'upsert' : 'insert', data: items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/rpc/update', async (req, res) => {
  const { table, data: bodyData, filters } = req.body || {};
  try {
    const cols = Object.keys(bodyData || {});
    const params = [...Object.values(bodyData || {})];
    const whereParts = [];
    extendWhere(filters, params, whereParts);
    if (!whereParts.length) return res.status(400).json({ error: 'Update requires filters' });
    const setClause = cols.map((c, i) => `"${c}" = $${i + 1}`).join(',');
    const sql = `UPDATE "${table}" SET ${setClause} WHERE ${whereParts.join(' AND ')}`;
    await pool.query(sql, params);
    res.json({ data: true });
    if (req.io) req.io.emit('db_changed', { table, action: 'update', filters });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/rpc/delete', async (req, res) => {
  const { table, filters } = req.body || {};
  try {
    const params = [];
    const whereParts = [];
    extendWhere(filters, params, whereParts);
    if (!whereParts.length) return res.status(400).json({ error: 'Delete requires filters' });
    const sql = `DELETE FROM "${table}" WHERE ${whereParts.join(' AND ')}`;
    await pool.query(sql, params);
    res.json({ data: true });
    if (req.io) req.io.emit('db_changed', { table, action: 'delete', filters });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── MEDICINE TRAFFIC CONTROL QUEUE ───

app.post('/api/visits/save-full', async (req, res) => {
  const { patientId, doctorName, date, notes, medicineGroups } = req.body || {};
  
  if (!patientId) return res.status(400).json({ error: 'Missing patientId' });
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Get Patient Name
    const ptRes = await client.query('SELECT name FROM patients WHERE card_number = $1 OR id::text = $1', [patientId]);
    const patientName = ptRes.rows[0]?.name || 'Unknown';
    
    const visitId = uuid();
    // 3. create visit
    await client.query(
      `INSERT INTO visits (id, patient_id, date, doctor_name, notes) VALUES ($1, $2, $3, $4, $5)`,
      [visitId, patientId, date || new Date().toISOString(), doctorName, notes]
    );
    
    let hasMeds = false;
    let allMedsForTask = [];
    
    // 4. create prescriptions
    for (let i = 0; i < medicineGroups.length; i++) {
      const group = medicineGroups[i];
      if (!group.meds || group.meds.length === 0) continue;
      hasMeds = true;
      
      const groupId = uuid();
      await client.query(
        `INSERT INTO prescription_groups (id, visit_id, power, dosage_code) VALUES ($1, $2, $3, $4)`,
        [groupId, visitId, group.power || null, group.dosage || 'BD']
      );
      
      for (const med of group.meds) {
        await client.query(
          `INSERT INTO group_medicines (group_id, medicine_code) VALUES ($1, $2)`,
          [groupId, med.code]
        );
        allMedsForTask.push({
          code: med.code,
          name: med.name,
          dosage: group.dosage || 'BD',
          duration: group.duration || '',
          instructions: group.instructions || ''
        });
      }
    }
    
    // 5. create medicine task if meds exist
    if (hasMeds) {
      const taskId = uuid();
      await client.query(
        `INSERT INTO medicine_tasks (id, "visitId", "patientId", "patientName", status, "createdBy")
         VALUES ($1, $2, $3, $4, 'PENDING', $5)`,
        [taskId, visitId, patientId, patientName, req.user?.userName || 'System']
      );
      
      // 6. create medicine task items
      for (const m of allMedsForTask) {
        await client.query(
          `INSERT INTO medicine_task_items (id, "taskId", "medicineCode", "medicineName", dosage, duration, instructions)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [uuid(), taskId, m.code, m.name || m.code, m.dosage, m.duration, m.instructions]
        );
      }
      
      // 7. create activity log
      await client.query(
        `INSERT INTO activity_logs (id, user_id, action, entity, entity_id, timestamp)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [uuid(), req.user?.userId || null, 'MEDICINE_TASK_CREATED', 'visits', visitId]
      );
    }
    
    await client.query('COMMIT');
    res.json({ success: true, visitId });
    if (req.io) req.io.emit('db_changed', { table: 'visits' });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[VISIT SAVE]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/queue/tasks', async (req, res) => {
  try {
    const updatedAfter = req.query.updatedAfter;
    let params = [];
    let sql = `SELECT * FROM medicine_tasks`;
    if (updatedAfter) {
      sql += ` WHERE "updatedAt" > $1`;
      params.push(updatedAfter);
    }
    sql += ` ORDER BY "createdAt" DESC LIMIT 100`;
    
    const tasks = await qr(sql, params);
    
    // fetch items for these tasks
    if (tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);
      const items = await qr(`SELECT * FROM medicine_task_items WHERE "taskId" = ANY($1)`, [taskIds]);
      
      for (const t of tasks) {
        t.items = items.filter(i => i.taskId === t.id);
      }
    }
    
    res.json({ data: tasks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/queue/claim', async (req, res) => {
  const { taskId, volunteerName } = req.body || {};
  try {
    const { rowCount } = await pool.query(
      `UPDATE medicine_tasks 
       SET status='IN_PROGRESS', "claimedBy"=$1, "claimedAt"=CURRENT_TIMESTAMP, "startedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP
       WHERE id=$2 AND status='PENDING'`,
      [volunteerName || req.user?.userName || 'Unknown', taskId]
    );
    
    if (rowCount === 1) {
       res.json({ success: true });
       if (req.io) req.io.emit('db_changed', { table: 'medicine_tasks' });
    } else {
       res.status(409).json({ error: 'Task already claimed or not found' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/queue/finish', async (req, res) => {
  const { taskId } = req.body || {};
  try {
    await pool.query(
      `UPDATE medicine_tasks 
       SET status='READY', "completedBy"=$1, "completedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP
       WHERE id=$2 AND status='IN_PROGRESS'`,
      [req.user?.userName || 'Unknown', taskId]
    );
    res.json({ success: true });
    if (req.io) req.io.emit('db_changed', { table: 'medicine_tasks' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/queue/deliver', async (req, res) => {
  const { taskId } = req.body || {};
  try {
    await pool.query(
      `UPDATE medicine_tasks 
       SET status='DELIVERED', "deliveredBy"=$1, "deliveredAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP
       WHERE id=$2 AND status='READY'`,
      [req.user?.userName || 'Unknown', taskId]
    );
    res.json({ success: true });
    if (req.io) req.io.emit('db_changed', { table: 'medicine_tasks' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

setInterval(async () => {
  try {
    await pool.query(`
      UPDATE medicine_tasks 
      SET status = 'PENDING', "claimedBy" = null, "updatedAt" = CURRENT_TIMESTAMP
      WHERE status = 'IN_PROGRESS' 
      AND "claimedAt" < NOW() - INTERVAL '5 minutes'
    `);
  } catch(e) {
    console.error('Timeout check error', e);
  }
}, 60000);

// ─── USER PROFILE AND PRESENCE ENDPOINTS (POSTGRES) ───

app.post('/api/users/create-profile', async (req, res) => {
  const { name, department, role, deviceId } = req.body || {};
  if (!name || !department) return res.status(400).json({ error: 'Missing name or department' });

  try {
    const { rows: existingRows } = await pool.query(
      `SELECT u.id, u.name, u.role, u."departmentId", d.name AS department
       FROM users u
       LEFT JOIN departments d ON u."departmentId" = d.id
       WHERE LOWER(u.name) = LOWER($1) LIMIT 1`,
      [name]
    );

    let userObj;
    if (existingRows.length > 0) {
      userObj = existingRows[0];
    } else {
      const id = uuid();
      const { rows: deptRows } = await pool.query(
        'SELECT id FROM departments WHERE LOWER(code) = LOWER($1) OR LOWER(name) = LOWER($1) LIMIT 1',
        [department]
      );
      const departmentId = deptRows[0]?.id || null;

      await pool.query(
        `INSERT INTO users (id, name, passcode, "departmentId", role, "deviceId", created_at, "updatedAt")
         VALUES ($1, $2, '', $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, name, departmentId, role || 'Volunteer', deviceId || null]
      );
      userObj = { id, name, department, departmentId, role: role || 'Volunteer' };
    }

    const token = uuid();
    activeSessions.set(token, {
      userId: userObj.id,
      userName: userObj.name,
      departmentId: userObj.departmentId || '1',
      deptCode: userObj.department || 'Medical',
      role: userObj.role || 'Volunteer',
      lastActiveTime: Date.now()
    });

    res.json({ success: true, user: userObj, token });
    if (req.io) req.io.emit('db_changed', { table: 'users' });
  } catch (e) {
    console.error('[CREATE PROFILE ERROR]', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/presence', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT *, 
      CASE WHEN "lastHeartbeatAt" >= NOW() - INTERVAL '120 seconds' THEN 1 ELSE 0 END as "isOnlineCalc"
      FROM user_presence
      ORDER BY "lastActivityAt" DESC
    `);
    
    const presenceList = rows.map(r => ({
      ...r,
      isOnline: r.isOnlineCalc === 1
    }));
    
    res.json({ data: presenceList });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/presence/heartbeat', async (req, res) => {
  const { userId, userName, department, currentScreen, currentTaskId, currentPatientName, currentStatus, deviceId } = req.body || {};
  if (!userId || !userName) return res.status(400).json({ error: 'Missing userId or userName' });

  try {
    const presenceId = uuid();
    await pool.query(`
      INSERT INTO user_presence (
        id, "userId", "userName", department, "currentStatus", "currentScreen", 
        "currentTaskId", "currentPatientName", "lastActivityAt", "lastHeartbeatAt", "isOnline", "deviceId", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, $9, CURRENT_TIMESTAMP
      ) ON CONFLICT ("userId") DO UPDATE SET
        "userName" = EXCLUDED."userName",
        department = EXCLUDED.department,
        "currentStatus" = EXCLUDED."currentStatus",
        "currentScreen" = EXCLUDED."currentScreen",
        "currentTaskId" = EXCLUDED."currentTaskId",
        "currentPatientName" = EXCLUDED."currentPatientName",
        "lastHeartbeatAt" = CURRENT_TIMESTAMP,
        "lastActivityAt" = CASE WHEN EXCLUDED."currentStatus" != 'IDLE' THEN CURRENT_TIMESTAMP ELSE user_presence."lastActivityAt" END,
        "isOnline" = 1,
        "deviceId" = EXCLUDED."deviceId",
        "updatedAt" = CURRENT_TIMESTAMP
    `, [
      presenceId, userId, userName, department || 'Medical', currentStatus || 'ONLINE', 
      currentScreen || 'Dashboard', currentTaskId || null, currentPatientName || null, deviceId || null
    ]);

    res.json({ success: true });
    if (req.io) req.io.emit('db_changed', { table: 'user_presence' });
  } catch (e) {
    console.error('[HEARTBEAT ERROR]', e);
    res.status(500).json({ error: e.message });
  }
});

// Catch-all route for React SPA routing
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/rpc') || req.path.startsWith('/static')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

async function bootstrap() {
  attachGracefulShutdown();
  try {
    await ensureSchema();
  } catch (schemaErr) {
    console.warn('[SCHEMA WARNING] Schema check deferred/warned:', schemaErr.message);
  }
  server.listen(port, '0.0.0.0', () => {
    const dbg = process.env.DATABASE_URL ? 'DATABASE_URL' : process.env.PGDATABASE || 'nekkadam';
    console.log(`\x1b[32m[POSTGRES ONLINE]\x1b[0m :${port} bind=0.0.0.0 | DB=${dbg}`);
  });
}

bootstrap().catch((err) => {
  console.error('[BOOT FAIL]', err);
  process.exit(1);
});
