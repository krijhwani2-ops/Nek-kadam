const db = require('better-sqlite3')('nekkadam.db');
const visits = db.prepare('SELECT id, patient_id, doctor_name, date, notes FROM visits WHERE patient_id = ? ORDER BY date DESC').all('5896');
console.log('Visits for 5896 (REETA HOTWANI):', visits.length);
const topVisits = visits.slice(0,5);

if (topVisits.length > 0) {
  const visitIds = topVisits.map(v => v.id);
  const placeholders = visitIds.map(() => '?').join(',');

  const medsByVisit = db.prepare(`
    SELECT pg.visit_id, gm.medicine_code
    FROM prescription_groups pg
    JOIN group_medicines gm ON gm.group_id = pg.id
    WHERE pg.visit_id IN (${placeholders})
  `).all(...visitIds);

  const medsMap = {};
  medsByVisit.forEach(row => {
    if (!medsMap[row.visit_id]) medsMap[row.visit_id] = [];
    medsMap[row.visit_id].push(row.medicine_code);
  });

  topVisits.forEach(v => {
    const meds = medsMap[v.id] || [];
    console.log('  ' + v.date + ' | ' + v.doctor_name + ' | ' + v.notes + ' | Meds: ' + meds.join(' / '));
  });
}
