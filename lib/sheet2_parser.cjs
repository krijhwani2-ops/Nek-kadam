/**
 * Shared parsing for Nek Kadam "Entries - Sheet2" grid CSV.
 * Row 0 = date headers per CATEGORY/MEDICINE column pair (from col 6+)
 * Row 1 = CARD, NAME, AGE, ...
 * Row 2+ = patient rows
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const DEFAULT_CANDIDATES = [
  'Nek kadam Entries  - Sheet2.csv',
  path.join(process.env.USERPROFILE || '', 'Downloads', 'Nek kadam Entries  - Sheet2.csv'),
];

function resolveCsvPath(cliPath) {
  if (cliPath && fs.existsSync(cliPath)) return path.resolve(cliPath);
  for (const p of DEFAULT_CANDIDATES) {
    if (p && fs.existsSync(p)) return path.resolve(p);
  }
  return cliPath ? path.resolve(cliPath) : null;
}

function parseDateDoctor(cell) {
  if (cell === undefined || cell === null) return null;
  const raw = String(cell).trim();
  if (!raw) return null;

  let datePart = raw;
  let doctor = '';
  const idx = raw.indexOf(',');
  if (idx >= 0) {
    datePart = raw.slice(0, idx).trim();
    doctor = raw.slice(idx + 1).trim().replace(/^Dr\.?\s*/i, '').trim();
  }

  let iso = null;
  let m =
    datePart.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/) ||
    datePart.match(/(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2})\b/);
  if (m) {
    let [, d, mo, y] = m;
    if (String(y).length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`;
    iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (!iso) {
    m = datePart.match(/(\d{1,2})[\/](\d{1,2})(\d{4})/);
    if (m) iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  if (!iso) return null;

  const [yy, mm, dd] = iso.split('-').map(Number);
  if (mm > 12 && dd <= 12) {
    iso = `${yy}-${String(dd).padStart(2, '0')}-${String(mm).padStart(2, '0')}`;
  }
  if (Number(mm) > 12 || Number(mm) < 1 || Number(dd) > 31) return null;
  return { iso, doctor: doctor || null };
}

function parseMedicineFragments(medicineStr) {
  if (!medicineStr || String(medicineStr).trim().length < 2) return [];
  return String(medicineStr)
    .split(/\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugMedCode(name) {
  const base =
    String(name)
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '')
      .trim()
      .slice(0, 160) || 'UNKNOWN';
  const safe = base.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_+.-]/g, '');
  return ('IMP_' + (safe.slice(0, 110) || 'X')).slice(0, 120);
}

function splitPowerDosage(fragment) {
  let dosage = 'BD';
  const parensAll = [...fragment.matchAll(/\(([^)]+)\)/g)];
  const lastParen = parensAll.length ? parensAll[parensAll.length - 1][1] : '';
  if (lastParen) dosage = lastParen.trim().toUpperCase().slice(0, 24);

  let text = fragment.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  let powerMatch = text.match(/\b(\d+[MCX])(?!\w)/i) || text.match(/\b(\d{1,4})\b(?!\d)/);
  let power = powerMatch ? powerMatch[1] : '';
  if (!power && /\bQ\b/i.test(fragment)) power = 'Q';

  let medName = text;
  if (power) {
    medName = text.replace(new RegExp(power.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim();
  }
  if (!medName || medName.length < 2) medName = fragment.trim();

  return { power: power.slice(0, 32), dosage: dosage.slice(0, 32), medName };
}

function processPatientRowCells(rowArr) {
  const card =
    rowArr[0] === undefined || rowArr[0] === null
      ? ''
      : String(rowArr[0]).replace(/\u00A0/g, ' ').trim();
  const name = rowArr[1]?.trim();
  const ageRaw = rowArr[2]?.trim();
  const address = rowArr[3]?.trim() || '';
  const phone = rowArr[4]?.trim() || '';
  const rowDoctor = rowArr[5]?.trim().replace(/^Dr\.?\s*/i, '').trim() || '';
  const age = ageRaw && ageRaw.length > 0 ? parseInt(ageRaw, 10) : null;
  return {
    card,
    name,
    ageRaw,
    age: Number.isFinite(age) ? age : null,
    address,
    phone,
    rowDoctor,
    default_doctor: rowDoctor || null,
  };
}

function isValidLedgerCard(card) {
  return Boolean(card && /^\d+$/.test(String(card)));
}

function loadSheet2Grid(csvAbs) {
  const content = fs.readFileSync(csvAbs, 'utf8');
  const { data } = Papa.parse(content, { header: false, skipEmptyLines: false });
  if (!data || data.length < 3) {
    throw new Error('Sheet2 CSV must have date row, header row, and at least one patient row');
  }
  const dateRowDates = data[0].map((x) => (x == null ? '' : String(x)));
  const patientRows = [];
  for (let i = 2; i < data.length; i++) {
    patientRows.push((data[i] || []).map((c) => (c == null ? '' : String(c))));
  }
  return { dateRowDates, patientRows, totalGridRows: data.length };
}

function medicinesFromLine(medicineStr) {
  const frags = parseMedicineFragments(medicineStr);
  if (frags.length === 0) {
    const code = slugMedCode(medicineStr);
    return [{ fragment: medicineStr, power: '', dosage: 'BD', code }];
  }
  return frags.map((fragment) => {
    const { power, dosage, medName } = splitPowerDosage(fragment);
    return { fragment, power, dosage, code: slugMedCode(medName) };
  });
}

/**
 * Extract visits from one patient row (no DB writes).
 */
function extractVisitsFromRow(rowArr, dateRowDates, dedupeVisit) {
  const meta = processPatientRowCells(rowArr);
  const { card, name, rowDoctor } = meta;
  if (!isValidLedgerCard(card)) return { meta: null, visits: [], flatRows: [] };
  if (!name || /^name$/i.test(name)) return { meta: null, visits: [], flatRows: [] };

  const visits = [];
  const flatRows = [];
  const maxCol = Math.max(rowArr.length, dateRowDates.length);

  for (let c = 6; c + 1 < maxCol; c += 2) {
    const parsed = parseDateDoctor(dateRowDates[c]);
    if (!parsed?.iso) continue;

    const category = (rowArr[c] || '').trim();
    const medicineStr = (rowArr[c + 1] || '').trim();
    if (!medicineStr || medicineStr.length < 2) continue;

    const doctorPick = parsed.doctor || rowDoctor || 'Unknown';
    const dk = `${card}|${parsed.iso}|${doctorPick}|${c}|${medicineStr.slice(0, 160)}`;
    if (dedupeVisit && dedupeVisit.has(dk)) continue;
    if (dedupeVisit) dedupeVisit.add(dk);

    const medicines = medicinesFromLine(medicineStr);
    visits.push({
      date: parsed.iso,
      doctor: doctorPick,
      category: category || '',
      medicines,
    });

    flatRows.push({
      card_number: card,
      name,
      visit_date: parsed.iso,
      doctor: doctorPick,
      category: category || '',
      medicine_line: medicineStr,
      parsed_fragments_count: medicines.length,
    });
  }

  return { meta, visits, flatRows };
}

function structurePatientRecord(rowArr, dateRowDates, dedupeVisit) {
  const { meta, visits, flatRows } = extractVisitsFromRow(rowArr, dateRowDates, dedupeVisit);
  if (!meta) return { patient: null, flatRows };

  const patient = {
    card_number: meta.card,
    name: meta.name,
    age: meta.age,
    address: meta.address,
    phone: meta.phone,
    default_doctor: meta.default_doctor,
    visits,
  };
  return { patient, flatRows };
}

function structureAllFromFile(csvAbs) {
  const { dateRowDates, patientRows } = loadSheet2Grid(csvAbs);
  const dedupeVisit = new Set();
  const patients = [];
  const flatVisits = [];
  const stats = {
    gridPatientRows: patientRows.length,
    patients: 0,
    visits: 0,
    skippedRows: 0,
  };

  for (const rowArr of patientRows) {
    const { patient, flatRows } = structurePatientRecord(rowArr, dateRowDates, dedupeVisit);
    if (!patient) {
      stats.skippedRows++;
      continue;
    }
    patients.push(patient);
    stats.patients++;
    stats.visits += patient.visits.length;
    flatVisits.push(...flatRows);
  }

  return { patients, flatVisits, stats, dateRowDates };
}

function escapeCsvField(val) {
  const s = val == null ? '' : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function flatVisitsToCsvRows(flatVisits) {
  const header = [
    'card_number',
    'name',
    'visit_date',
    'doctor',
    'category',
    'medicine_line',
    'parsed_fragments_count',
  ];
  const lines = [header.join(',')];
  for (const r of flatVisits) {
    lines.push(
      [
        r.card_number,
        r.name,
        r.visit_date,
        r.doctor,
        r.category,
        r.medicine_line,
        r.parsed_fragments_count,
      ]
        .map(escapeCsvField)
        .join(',')
    );
  }
  return lines.join('\n') + '\n';
}

/** clean_visits.csv format for import_normalized.cjs */
function flatVisitsToCleanVisitsCsv(flatVisits, patientsByCard) {
  const header = 'card,name,age,address,contact,date,doctor,category,medicine';
  const lines = [header];
  for (const r of flatVisits) {
    const p = patientsByCard.get(r.card_number) || {};
    lines.push(
      [
        r.card_number,
        r.name,
        p.age ?? '',
        p.address ?? '',
        p.phone ?? '',
        r.visit_date,
        r.doctor,
        r.category,
        r.medicine_line,
      ]
        .map(escapeCsvField)
        .join(',')
    );
  }
  return lines.join('\n') + '\n';
}

module.exports = {
  DEFAULT_CANDIDATES,
  resolveCsvPath,
  parseDateDoctor,
  parseMedicineFragments,
  splitPowerDosage,
  slugMedCode,
  processPatientRowCells,
  isValidLedgerCard,
  loadSheet2Grid,
  medicinesFromLine,
  extractVisitsFromRow,
  structurePatientRecord,
  structureAllFromFile,
  flatVisitsToCsvRows,
  flatVisitsToCleanVisitsCsv,
  escapeCsvField,
};
