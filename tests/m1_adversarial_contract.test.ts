import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reconcileTableDeltas, getRecordKey, getRecordTimestamp, DEFAULT_SYNC_TABLES } from '../src/lib/sync';

/**
 * ============================================================================
 * Adversarial Contract & Edge Case Suite: Milestone 1
 * ============================================================================
 */
describe('M1 Adversarial Contract: Delta Sync & Security', () => {

  describe('Delta Sync Boundary & Stress Conditions', () => {
    it('handles null, undefined, empty, and non-array local and remote caches safely', () => {
      const resNull = reconcileTableDeltas('patients', null as any, null as any);
      expect(resNull.merged).toEqual([]);
      expect(resNull.count).toBe(0);

      const resUndefined = reconcileTableDeltas('patients', undefined as any, undefined as any);
      expect(resUndefined.merged).toEqual([]);
      expect(resUndefined.count).toBe(0);
    });

    it('handles extreme timestamps correctly without NaN comparisons', () => {
      const tsInf = getRecordTimestamp({ updated_at: 'invalid-date' });
      expect(tsInf).toBe(0);

      const tsEmpty = getRecordTimestamp({});
      expect(tsEmpty).toBe(0);

      const tsNull = getRecordTimestamp(null);
      expect(tsNull).toBe(0);

      const validIso = '2026-09-10T19:30:00.000Z';
      expect(getRecordTimestamp({ updated_at: validIso })).toBe(new Date(validIso).getTime());
    });

    it('preserves offline temp IDs (VISIT-, GRP-, MAP-) across sync passes', () => {
      const localCache = [
        { id: 'VISIT-offline-temp-001', patient_id: '1001', doctor_name: 'Dr. Rao' },
        { id: 'GRP-prescription-temp-002', visit_id: 'VISIT-offline-temp-001' },
        { id: 'MAP-medicine-temp-003', group_id: 'GRP-prescription-temp-002' },
        { id: 'v-server-synced-100', patient_id: '1002' }
      ];

      const remoteDeltas = [
        { id: 'v-server-synced-101', patient_id: '1003', updated_at: '2026-09-10T20:00:00.000Z' }
      ];

      const resVisits = reconcileTableDeltas('visits', localCache, remoteDeltas);
      expect(resVisits.merged.some(v => v.id === 'VISIT-offline-temp-001')).toBe(true);
      expect(resVisits.merged.some(v => v.id === 'v-server-synced-101')).toBe(true);

      const resGroups = reconcileTableDeltas('prescription_groups', localCache, remoteDeltas);
      expect(resGroups.merged.some(g => g.id === 'GRP-prescription-temp-002')).toBe(true);

      const resMeds = reconcileTableDeltas('group_medicines', localCache, remoteDeltas);
      expect(resMeds.merged.some(m => m.id === 'MAP-medicine-temp-003')).toBe(true);
    });

    it('enforces Last-Write-Wins: newer local edit defeats older remote update', () => {
      const localRecord = {
        card_number: '1001',
        name: 'Patient Offline Updated',
        updated_at: '2026-09-10T21:00:00.000Z' // newer local edit
      };

      const remoteRecord = {
        card_number: '1001',
        name: 'Patient Server Stale',
        updated_at: '2026-09-10T19:00:00.000Z' // older server record
      };

      const result = reconcileTableDeltas('patients', [localRecord], [remoteRecord]);
      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].name).toBe('Patient Offline Updated');
      expect(result.count).toBe(0); // 0 remote overwrites
    });

    it('enforces Last-Write-Wins: newer remote record updates local cache', () => {
      const localRecord = {
        card_number: '1001',
        name: 'Old Local Name',
        phone: '1111111111',
        updated_at: '2026-09-10T18:00:00.000Z'
      };

      const remoteRecord = {
        card_number: '1001',
        name: 'Newer Server Name',
        phone: '9999999999',
        updated_at: '2026-09-10T20:00:00.000Z'
      };

      const result = reconcileTableDeltas('patients', [localRecord], [remoteRecord]);
      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].name).toBe('Newer Server Name');
      expect(result.merged[0].phone).toBe('9999999999');
      expect(result.count).toBe(1);
    });
  });

  describe('Sync Table Registry Verification', () => {
    it('covers all critical clinical and administrative sync tables', () => {
      const required = [
        'patients',
        'visits',
        'prescription_groups',
        'group_medicines',
        'medicines',
        'tokens',
        'departments',
        'batches',
        'education_students',
        'attendance',
        'medicine_tasks',
        'medicine_task_items'
      ];
      for (const tbl of required) {
        expect(DEFAULT_SYNC_TABLES).toContain(tbl);
      }
    });
  });
});
