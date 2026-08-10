const Database = require('better-sqlite3');
const db = new Database('nekkadam.db');
const row = db.prepare('SELECT count(*) as count FROM patients').get();
console.log('Patients count:', row.count);
