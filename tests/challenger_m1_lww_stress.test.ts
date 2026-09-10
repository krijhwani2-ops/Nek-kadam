import { describe, it, expect } from 'vitest';
import {
  getTablePrimaryKey,
  getRecordKey,
  getRecordTimestamp,
  reconcileTableDeltas,
  DEFAULT_SYNC_TABLES
} from '../src/lib/sync';

describe('Challenger M1-2 Empirical Stress Suite: LWW & Client Reconciliation', () => {

  describe('1. Last-Write-Wins (LWW) Timestamp Resolution Matrix', () => {
    it('LWW-1: Remote is strictly newer (T2 > T1) -> Remote overwrites local', () => {
      const local = [{
        card_number: 'CARD-100',
        name: 'Local Version',
        phone: '1111111111',
        updated_at: '2026-09-10T12:00:00.000Z'
      }];
      const remote = [{
        card_number: 'CARD-100',
        name: 'Remote Version (Newer)',
        phone: '9999999999',
        updated_at: '2026-09-10T12:00:05.000Z'
      }];

      const { merged, count } = reconcileTableDeltas('patients', local, remote);
      expect(merged).toHaveLength(1);
      expect(count).toBe(1);
      expect(merged[0].name).toBe('Remote Version (Newer)');
      expect(merged[0].phone).toBe('9999999999');
      expect(merged[0].updated_at).toBe('2026-09-10T12:00:05.000Z');
    });

    it('LWW-2: Local is strictly newer (T1 > T2) -> Local offline edit preserved', () => {
      const local = [{
        card_number: 'CARD-100',
        name: 'Local Version (Offline Newer)',
        phone: '8888888888',
        updated_at: '2026-09-10T14:30:00.000Z'
      }];
      const remote = [{
        card_number: 'CARD-100',
        name: 'Remote Version (Stale)',
        phone: '2222222222',
        updated_at: '2026-09-10T12:00:00.000Z'
      }];

      const { merged, count } = reconcileTableDeltas('patients', local, remote);
      expect(merged).toHaveLength(1);
      expect(count).toBe(0); // Not counted as updated because local won
      expect(merged[0].name).toBe('Local Version (Offline Newer)');
      expect(merged[0].phone).toBe('8888888888');
      expect(merged[0].updated_at).toBe('2026-09-10T14:30:00.000Z');
    });

    it('LWW-3: Exact timestamp tie (T1 === T2) -> Remote wins deterministically', () => {
      const local = [{
        card_number: 'CARD-100',
        name: 'Local Version',
        notes: 'Local note',
        updated_at: '2026-09-10T12:00:00.000Z'
      }];
      const remote = [{
        card_number: 'CARD-100',
        name: 'Remote Server Version',
        updated_at: '2026-09-10T12:00:00.000Z'
      }];

      const { merged, count } = reconcileTableDeltas('patients', local, remote);
      expect(merged).toHaveLength(1);
      expect(count).toBe(1);
      expect(merged[0].name).toBe('Remote Server Version');
      // Local non-conflicting fields preserved via object spread:
      expect(merged[0].notes).toBe('Local note');
    });

    it('LWW-4: Sub-second / millisecond precision (1ms difference)', () => {
      const local = [{
        id: 'tok-001',
        status: 'WAITING',
        updated_at: '2026-09-10T12:00:00.500Z'
      }];
      const remote = [{
        id: 'tok-001',
        status: 'IN_PROGRESS',
        updated_at: '2026-09-10T12:00:00.501Z' // +1ms ahead
      }];

      const { merged, count } = reconcileTableDeltas('tokens', local, remote);
      expect(merged[0].status).toBe('IN_PROGRESS');
      expect(count).toBe(1);

      // Now reverse: local is 1ms ahead
      const localAhead = [{
        id: 'tok-001',
        status: 'DONE',
        updated_at: '2026-09-10T12:00:00.502Z'
      }];
      const { merged: merged2, count: count2 } = reconcileTableDeltas('tokens', localAhead, remote);
      expect(merged2[0].status).toBe('DONE');
      expect(count2).toBe(0);
    });

    it('LWW-5: Alternate timestamp columns (updatedAt vs updated_at vs createdAt)', () => {
      // medicine_tasks uses camelCase updatedAt
      const localTask = [{
        id: 'task-1',
        status: 'PENDING',
        updatedAt: '2026-09-10T10:00:00.000Z'
      }];
      const remoteTask = [{
        id: 'task-1',
        status: 'CLAIMED',
        claimedBy: 'Volunteer John',
        updatedAt: '2026-09-10T11:00:00.000Z'
      }];

      const { merged, count } = reconcileTableDeltas('medicine_tasks', localTask, remoteTask);
      expect(merged[0].status).toBe('CLAIMED');
      expect(merged[0].claimedBy).toBe('Volunteer John');
      expect(count).toBe(1);
    });

    it('LWW-6: Resilient handling of malformed, null, or empty timestamps', () => {
      const local = [{ card_number: 'NK-1', name: 'Local No Date' }];
      const remote = [{ card_number: 'NK-1', name: 'Remote With Date', updated_at: '2026-09-10T12:00:00.000Z' }];

      // Local has no date (0 ms), remote has valid date -> remote wins
      const res1 = reconcileTableDeltas('patients', local, remote);
      expect(res1.merged[0].name).toBe('Remote With Date');

      // Neither has date -> both 0 ms -> remote wins deterministically
      const res2 = reconcileTableDeltas('patients', local, [{ card_number: 'NK-1', name: 'Remote Also No Date' }]);
      expect(res2.merged[0].name).toBe('Remote Also No Date');

      // Invalid date string ('not-a-date') parsed as 0 ms
      expect(getRecordTimestamp({ updated_at: 'not-a-date' })).toBe(0);
      expect(getRecordTimestamp(undefined)).toBe(0);
      expect(getRecordTimestamp(null)).toBe(0);
      expect(getRecordTimestamp(123)).toBe(0);
    });

    it('LWW-7: Timezone offset compatibility (ISO with +05:30 vs UTC Z)', () => {
      // 15:30:00+05:30 is 10:00:00 UTC
      const local = [{
        id: 'v-1',
        notes: 'Indian Standard Time Note',
        updated_at: '2026-09-10T15:30:00+05:30'
      }];
      // 10:05:00Z is 5 minutes LATER in UTC
      const remote = [{
        id: 'v-1',
        notes: 'UTC Note (5 mins later)',
        updated_at: '2026-09-10T10:05:00.000Z'
      }];

      const { merged } = reconcileTableDeltas('visits', local, remote);
      expect(merged[0].notes).toBe('UTC Note (5 mins later)');
    });
  });

  describe('2. Delta Cache Merging at Scale (1,000 Local Cache vs 5 Deltas)', () => {
    it('preserves exactly 995 untouched records without corruption or deletion', () => {
      // Generate 1000 distinct patient records
      const localCache: any[] = [];
      for (let i = 1; i <= 1000; i++) {
        const numStr = String(i).padStart(4, '0');
        localCache.push({
          card_number: `CARD-${numStr}`,
          id: `uuid-${numStr}`,
          name: `Patient ${numStr}`,
          phone: `980000${numStr}`,
          age: 20 + (i % 50),
          gender: i % 2 === 0 ? 'M' : 'F',
          blood_group: 'O+',
          created_at: '2026-09-01T08:00:00.000Z',
          updated_at: '2026-09-01T08:00:00.000Z'
        });
      }

      expect(localCache).toHaveLength(1000);

      // Delta with 5 records: 3 updates to existing (CARD-0010, CARD-0050, CARD-0999) + 2 new (CARD-1001, CARD-1002)
      const remoteDeltas = [
        {
          card_number: 'CARD-0010',
          name: 'Patient 0010 (UPDATED BY SERVER)',
          phone: '9999990010',
          updated_at: '2026-09-10T16:00:00.000Z'
        },
        {
          card_number: 'CARD-0050',
          name: 'Patient 0050 (UPDATED BY SERVER)',
          phone: '9999990050',
          updated_at: '2026-09-10T16:00:00.000Z'
        },
        {
          card_number: 'CARD-0999',
          name: 'Patient 0999 (UPDATED BY SERVER)',
          phone: '9999990999',
          updated_at: '2026-09-10T16:00:00.000Z'
        },
        {
          card_number: 'CARD-1001',
          name: 'New Patient 1001',
          phone: '9800001001',
          updated_at: '2026-09-10T16:00:00.000Z'
        },
        {
          card_number: 'CARD-1002',
          name: 'New Patient 1002',
          phone: '9800001002',
          updated_at: '2026-09-10T16:00:00.000Z'
        }
      ];

      const start = performance.now();
      const { merged, count } = reconcileTableDeltas('patients', localCache, remoteDeltas);
      const elapsed = performance.now() - start;

      // Merged size must be exactly 1,002 (1,000 existing - 3 updated in-place + 2 new = 1,002)
      expect(merged).toHaveLength(1002);
      expect(count).toBe(5);
      expect(elapsed).toBeLessThan(150); // Performance benchmark: under 150ms for 1,000 items

      // Create indexed map of merged records for fast assertion
      const mergedMap = new Map<string, any>();
      for (const item of merged) {
        mergedMap.set(item.card_number, item);
      }

      // Verify the 3 updated records received updates
      expect(mergedMap.get('CARD-0010').name).toBe('Patient 0010 (UPDATED BY SERVER)');
      expect(mergedMap.get('CARD-0010').phone).toBe('9999990010');
      // Verify other fields of CARD-0010 were not wiped out:
      expect(mergedMap.get('CARD-0010').age).toBe(localCache[9].age);
      expect(mergedMap.get('CARD-0010').blood_group).toBe('O+');

      expect(mergedMap.get('CARD-0050').name).toBe('Patient 0050 (UPDATED BY SERVER)');
      expect(mergedMap.get('CARD-0999').name).toBe('Patient 0999 (UPDATED BY SERVER)');

      // Verify the 2 new records are present
      expect(mergedMap.get('CARD-1001').name).toBe('New Patient 1001');
      expect(mergedMap.get('CARD-1002').name).toBe('New Patient 1002');

      // Verify ALL 997 untouched records are preserved perfectly without corruption
      let untouchedVerified = 0;
      for (let i = 1; i <= 1000; i++) {
        const numStr = String(i).padStart(4, '0');
        const cardNo = `CARD-${numStr}`;
        if (cardNo === 'CARD-0010' || cardNo === 'CARD-0050' || cardNo === 'CARD-0999') {
          continue; // skip the 3 that were updated
        }
        const original = localCache[i - 1];
        const current = mergedMap.get(cardNo);

        expect(current).toBeDefined();
        expect(current.name).toBe(original.name);
        expect(current.phone).toBe(original.phone);
        expect(current.age).toBe(original.age);
        expect(current.gender).toBe(original.gender);
        expect(current.updated_at).toBe(original.updated_at);
        untouchedVerified++;
      }

      expect(untouchedVerified).toBe(997);
    });

    it('high volume stress test: 5,000 items cache with 100 incoming deltas', () => {
      const localCache: any[] = [];
      for (let i = 1; i <= 5000; i++) {
        localCache.push({
          id: `med-${i}`,
          code: `MED-${String(i).padStart(5, '0')}`,
          name: `Medicine ${i}`,
          stock_level: 100,
          updated_at: '2026-09-01T00:00:00.000Z'
        });
      }

      const remoteDeltas: any[] = [];
      for (let i = 1; i <= 50; i++) {
        // update first 50 items
        remoteDeltas.push({
          code: `MED-${String(i).padStart(5, '0')}`,
          stock_level: 50,
          updated_at: '2026-09-10T12:00:00.000Z'
        });
      }
      for (let i = 5001; i <= 5050; i++) {
        // add 50 new items
        remoteDeltas.push({
          id: `med-${i}`,
          code: `MED-${String(i).padStart(5, '0')}`,
          name: `New Medicine ${i}`,
          stock_level: 200,
          updated_at: '2026-09-10T12:00:00.000Z'
        });
      }

      const start = performance.now();
      const { merged, count } = reconcileTableDeltas('medicines', localCache, remoteDeltas);
      const duration = performance.now() - start;

      expect(merged).toHaveLength(5050);
      expect(count).toBe(100);
      expect(duration).toBeLessThan(300); // Fast Map lookup: under 300ms for 5,000 items
    });
  });

  describe('3. Offline Queue Preservation & Concurrency', () => {
    it('preserves pending client visits with client-generated temporary IDs (VISIT-, GRP-, MAP-)', () => {
      const localVisits = [
        { id: 'VISIT-temp-offline-1', patient_id: 'CARD-001', doctor_name: 'Dr. Offline', date: '2026-09-10' },
        { id: 'VISIT-temp-offline-2', patient_id: 'CARD-002', doctor_name: 'Dr. Offline', date: '2026-09-10' },
        { id: 'v-synced-1', patient_id: 'CARD-003', doctor_name: 'Dr. Online', date: '2026-09-09', updated_at: '2026-09-09T10:00:00.000Z' }
      ];

      // Remote returns new visits synced by another clinic PC
      const remoteVisits = [
        { id: 'v-remote-100', patient_id: 'CARD-050', doctor_name: 'Dr. Remote', date: '2026-09-10', updated_at: '2026-09-10T15:00:00.000Z' }
      ];

      const { merged } = reconcileTableDeltas('visits', localVisits, remoteVisits);
      expect(merged).toHaveLength(4);
      expect(merged.some(v => v.id === 'VISIT-temp-offline-1')).toBe(true);
      expect(merged.some(v => v.id === 'VISIT-temp-offline-2')).toBe(true);
      expect(merged.some(v => v.id === 'v-synced-1')).toBe(true);
      expect(merged.some(v => v.id === 'v-remote-100')).toBe(true);
    });

    it('preserves prescription groups with temporary GRP- and MAP- prefixes', () => {
      const localGroups = [
        { id: 'GRP-temp-999', visit_id: 'VISIT-temp-offline-1', dosage_code: '1-0-1' },
        { group_id: 'GRP-temp-888', visit_id: 'VISIT-temp-offline-2', dosage_code: '0-1-0' }
      ];
      const remoteGroups = [
        { id: 'grp-server-1', visit_id: 'v-synced-1', dosage_code: '1-1-1', updated_at: '2026-09-10T12:00:00.000Z' }
      ];

      const { merged } = reconcileTableDeltas('prescription_groups', localGroups, remoteGroups);
      expect(merged).toHaveLength(3);
      expect(merged.some(g => (g.id || g.group_id) === 'GRP-temp-999')).toBe(true);
      expect(merged.some(g => (g.id || g.group_id) === 'GRP-temp-888')).toBe(true);
      expect(merged.some(g => g.id === 'grp-server-1')).toBe(true);
    });

    it('preserves pending offline writes when incoming server delta is stale', () => {
      // Scenario: Volunteer at Camp edited patient phone offline at 14:00.
      // Server delta arrived with state from 11:00 (e.g. earlier edit by registration desk).
      const localCache = [{
        card_number: 'CARD-777',
        name: 'John Doe',
        phone: '9876543210', // edited offline
        updated_at: '2026-09-10T14:00:00.000Z'
      }];

      const staleServerDelta = [{
        card_number: 'CARD-777',
        name: 'John Doe',
        phone: '1234567890', // stale server value
        updated_at: '2026-09-10T11:00:00.000Z'
      }];

      const { merged, count } = reconcileTableDeltas('patients', localCache, staleServerDelta);
      expect(merged[0].phone).toBe('9876543210');
      expect(count).toBe(0);
    });

    it('handles empty local cache or empty remote deltas safely', () => {
      // Empty local cache + remote delta
      const res1 = reconcileTableDeltas('patients', [], [{ card_number: 'C-1', name: 'P1' }]);
      expect(res1.merged).toHaveLength(1);
      expect(res1.count).toBe(1);

      // Local cache + empty remote delta
      const res2 = reconcileTableDeltas('patients', [{ card_number: 'C-1', name: 'P1' }], []);
      expect(res2.merged).toHaveLength(1);
      expect(res2.count).toBe(0);

      // Non-array inputs handled safely
      const res3 = reconcileTableDeltas('patients', null as any, undefined as any);
      expect(res3.merged).toEqual([]);
      expect(res3.count).toBe(0);
    });
  });

  describe('4. Primary Key Extraction Across All 12 Tables', () => {
    it('extracts correct primary keys for all default sync tables', () => {
      expect(DEFAULT_SYNC_TABLES).toHaveLength(12);

      // Patients: card_number first, fallback to id
      expect(getRecordKey('patients', { card_number: 'NK-10' })).toBe('NK-10');
      expect(getRecordKey('patients', { id: 'p-uuid-1' })).toBe('p-uuid-1');

      // Medicines: code first, fallback to id
      expect(getRecordKey('medicines', { code: 'PARA500' })).toBe('PARA500');
      expect(getRecordKey('medicines', { id: 'm-uuid-2' })).toBe('m-uuid-2');

      // Prescription groups: id or group_id
      expect(getRecordKey('prescription_groups', { id: 'pg-1' })).toBe('pg-1');
      expect(getRecordKey('prescription_groups', { group_id: 'GRP-1' })).toBe('GRP-1');

      // Generic tables using id
      const genericTables = [
        'visits', 'group_medicines', 'tokens', 'departments',
        'batches', 'education_students', 'attendance',
        'medicine_tasks', 'medicine_task_items'
      ];
      for (const tbl of genericTables) {
        expect(getRecordKey(tbl, { id: `id-${tbl}` })).toBe(`id-${tbl}`);
      }
    });

    it('type normalizes numeric and string IDs to prevent duplicate Map keys', () => {
      const localToken = [{ id: 456, tokenNumber: 456, status: 'WAITING', updated_at: '2026-09-10T10:00:00.000Z' }];
      const remoteToken = [{ id: '456', tokenNumber: 456, status: 'DONE', updated_at: '2026-09-10T11:00:00.000Z' }];

      const { merged } = reconcileTableDeltas('tokens', localToken, remoteToken);
      // Because getRecordKey converts both to String('456'), they resolve to the same record
      expect(merged).toHaveLength(1);
      expect(merged[0].status).toBe('DONE');
    });

    it('preserves unkeyed fallback records without throwing errors', () => {
      const localWithoutKey = [{ notes: 'Anonymous note without ID' }];
      const remoteWithKey = [{ id: 'v-1', notes: 'Valid visit' }];

      const { merged } = reconcileTableDeltas('visits', localWithoutKey, remoteWithKey);
      expect(merged).toHaveLength(2);
      expect(merged.some(m => m.notes === 'Anonymous note without ID')).toBe(true);
      expect(merged.some(m => m.id === 'v-1')).toBe(true);
    });
  });

  describe('5. Commutativity, Idempotency & Out-of-Order Delta Sequence', () => {
    it('idempotency: applying identical delta multiple times produces identical state', () => {
      const initial = [
        { card_number: 'CARD-1', name: 'Name V1', updated_at: '2026-09-10T10:00:00.000Z' }
      ];
      const delta = [
        { card_number: 'CARD-1', name: 'Name V2', updated_at: '2026-09-10T11:00:00.000Z' }
      ];

      const pass1 = reconcileTableDeltas('patients', initial, delta);
      const pass2 = reconcileTableDeltas('patients', pass1.merged, delta);
      const pass3 = reconcileTableDeltas('patients', pass2.merged, delta);

      expect(pass1.merged).toEqual(pass2.merged);
      expect(pass2.merged).toEqual(pass3.merged);
      expect(pass1.count).toBe(1);
      expect(pass2.count).toBe(1); // Merged into itself
      expect(pass3.merged[0].name).toBe('Name V2');
    });

    it('out-of-order delta sequence: newest timestamp always survives regardless of merge order', () => {
      const base = [{ id: 'v-1', notes: 'Version 0', updated_at: '2026-09-10T10:00:00.000Z' }];

      const deltaNew = [{ id: 'v-1', notes: 'Version 2 (Newer)', updated_at: '2026-09-10T12:00:00.000Z' }];
      const deltaOld = [{ id: 'v-1', notes: 'Version 1 (Older)', updated_at: '2026-09-10T11:00:00.000Z' }];

      // Merge newer delta first, then delayed older delta arrives
      const step1 = reconcileTableDeltas('visits', base, deltaNew);
      expect(step1.merged[0].notes).toBe('Version 2 (Newer)');

      const step2 = reconcileTableDeltas('visits', step1.merged, deltaOld);
      // Older delta must NOT overwrite newer state!
      expect(step2.merged[0].notes).toBe('Version 2 (Newer)');
      expect(step2.count).toBe(0);
    });
  });

});
