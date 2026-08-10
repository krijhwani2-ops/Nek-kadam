import { safeParseDate, safeFormatDate, safeFormatTime } from '../../src/lib/dateUtils';

console.log('--- EMPIRICAL DATE UTILS TEST SUITE ---');

const testInputs: { label: string; input: any }[] = [
  { label: 'null', input: null },
  { label: 'undefined', input: undefined },
  { label: 'empty string ""', input: "" },
  { label: 'whitespace string "   "', input: "   " },
  { label: 'invalid string "abc"', input: "abc" },
  { label: 'invalid date "2026-13-45"', input: "2026-13-45" },
  { label: 'number 0 (Epoch)', input: 0 },
  { label: 'string "0"', input: "0" },
  { label: 'number timestamp 1700000000000', input: 1700000000000 },
  { label: 'new Date(0)', input: new Date(0) },
  { label: 'new Date(NaN) (Invalid Date)', input: new Date(NaN) },
  { label: 'future date "2099-12-31"', input: "2099-12-31" },
  { label: 'far future date "9999-12-31"', input: "9999-12-31" },
  { label: 'space-separated ISO "2026-07-28 10:00:00"', input: "2026-07-28 10:00:00" },
  { label: 'ISO string "2026-07-28T10:00:00.000Z"', input: "2026-07-28T10:00:00.000Z" },
  { label: 'NaN', input: NaN },
  { label: 'Infinity', input: Infinity },
  { label: '-Infinity', input: -Infinity },
  { label: 'boolean true', input: true },
  { label: 'boolean false', input: false },
  { label: 'empty object {}', input: {} },
  { label: 'empty array []', input: [] },
  { label: 'array of numbers [1, 2, 3]', input: [1, 2, 3] },
];

let crashes = 0;
let results: any[] = [];

for (const item of testInputs) {
  try {
    const parsed = safeParseDate(item.input);
    const formattedDate = safeFormatDate(item.input);
    const formattedTime = safeFormatTime(item.input);

    // Also test invalid options/locales to ensure try-catch block inside safeFormat works
    const formattedBadOptions = safeFormatDate(item.input, { timeZone: 'INVALID_TZ' } as any);
    const formattedBadLocale = safeFormatDate(item.input, undefined, 'invalid-locale-xyz!!!');

    results.push({
      label: item.label,
      input: String(item.input),
      parsed: parsed ? parsed.toISOString() : null,
      isValidDate: parsed instanceof Date && !isNaN(parsed.getTime()),
      formattedDate,
      formattedTime,
      formattedBadOptions,
      formattedBadLocale,
    });
  } catch (err: any) {
    crashes++;
    console.error(`CRASH detected for input [${item.label}]:`, err);
  }
}

console.log(`Total tested: ${testInputs.length}`);
console.log(`Total crashes: ${crashes}`);
console.table(results);
