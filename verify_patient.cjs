const db = require('better-sqlite3')('nekkadam.db');
const visits = db.prepare('SELECT id, patient_id, doctor_name, date, notes FROM visits WHERE patient_id = ? ORDER BY date DESC').all('5896');
console.log('Visits for 5896 (REETA HOTWANI):', visits.length);
visits.slice(0,5).forEach(v => {
  const groups = db.prepare('SELECT * FROM prescription_groups WHERE visit_id = ?').all(v.id);
  let meds = [];
  groups.forEach(g => {
    const gm = db.prepare('SELECT medicine_code FROM group_medicines WHERE group_id = ?').all(g.id);
    meds.push(...gm.map(m => m.medicine_code));
  });
  console.log('  ' + v.date + ' | ' + v.doctor_name + ' | ' + v.notes + ' | Meds: ' + meds.join(' / '));
});
