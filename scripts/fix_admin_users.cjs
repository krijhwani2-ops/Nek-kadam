const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'nekkadam.db');
const db = new Database(dbPath);

console.log('Fixing users table in SQLite...');
db.prepare("UPDATE users SET role = 'ADMIN' WHERE LOWER(name) IN ('rohan', 'admin')").run();

const users = db.prepare("SELECT id, name, role, department FROM users WHERE LOWER(name) IN ('rohan', 'admin')").all();
console.log('Updated users:', users);
