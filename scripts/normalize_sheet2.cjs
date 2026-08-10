/**
 * Normalize Sheet2 grid CSV into structured JSON + flat visit CSVs.
 *
 * Usage:
 *   node scripts/normalize_sheet2.cjs ["path\\to\\Sheet2.csv"] [--out-dir data] [--clean-visits]
 *
 * Outputs (default data/):
 *   sheet2_structured.json  — patients with nested visits/medicines
 *   sheet2_visits.csv       — one row per visit slot with medicine line
 *   clean_visits.csv        — optional, for import_normalized.cjs (--clean-visits)
 */

const fs = require('fs');
const path = require('path');
const {
  resolveCsvPath,
  structureAllFromFile,
  flatVisitsToCsvRows,
  flatVisitsToCleanVisitsCsv,
} = require('../lib/sheet2_parser.cjs');

function main() {
  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf('--out-dir');
  const outDir = outIdx >= 0 ? path.resolve(argv[outIdx + 1] || 'data') : path.resolve('data');
  const withClean = argv.includes('--clean-visits');
  let fileArg = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out-dir') {
      i++;
      continue;
    }
    if (a.startsWith('--')) continue;
    fileArg = a;
    break;
  }

  const csvAbs = resolveCsvPath(fileArg);
  if (!csvAbs || !fs.existsSync(csvAbs)) {
    console.error('[normalize] CSV not found. Pass path or place file in Downloads:', fileArg);
    process.exit(1);
  }

  console.log('[normalize] Reading', csvAbs);
  const { patients, flatVisits, stats } = structureAllFromFile(csvAbs);

  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, 'sheet2_structured.json');
  fs.writeFileSync(jsonPath, JSON.stringify(patients, null, 2), 'utf8');

  const visitsCsvPath = path.join(outDir, 'sheet2_visits.csv');
  fs.writeFileSync(visitsCsvPath, flatVisitsToCsvRows(flatVisits), 'utf8');

  let cleanPath = null;
  if (withClean) {
    const byCard = new Map(patients.map((p) => [p.card_number, p]));
    cleanPath = path.join(outDir, 'clean_visits.csv');
    fs.writeFileSync(cleanPath, flatVisitsToCleanVisitsCsv(flatVisits, byCard), 'utf8');
  }

  console.log('\n[normalize] Done');
  console.log('  patients:', stats.patients);
  console.log('  visits:', stats.visits);
  console.log('  skipped grid rows:', stats.skippedRows);
  console.log('  →', jsonPath);
  console.log('  →', visitsCsvPath);
  if (cleanPath) console.log('  →', cleanPath);
}

main();
