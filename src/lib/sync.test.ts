import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getTablePrimaryKey,
  getRecordKey,
  getRecordTimestamp,
  reconcileTableDeltas,
  DEFAULT_SYNC_TABLES
} from './sync';
import { getLastSyncTime, setLastSyncTime } from './session';

describe('Sync Module', () => {
  describe('Schema & Key Helpers', () => {
    it('returns correct primary key for each table', () => {
      expect(getTablePrimaryKey('patients')).toBe('card_number');
      expect(getTablePrimaryKey('medicines')).toBe('code');
      expect(getTablePrimaryKey('visits')).toBe('id');
      expect(getTablePrimaryKey('tokens')).toBe('id');
      expect(getTablePrimaryKey('attendance')).toBe('id');
    });

    it('extracts record keys properly for patients', () => {
      expect(getRecordKey('patients', { card_number: 'NK-101', id: 'p-1' })).toBe('NK-101');
      expect(getRecordKey('patients', { id: 'p-1' })).toBe('p-1');
      expect(getRecordKey('patients', null)).toBeNull();
    });

    it('extracts record keys properly for medicines and generic tables', () => {
      expect(getRecordKey('medicines', { code: 'PARA500', name: 'Paracetamol' })).toBe('PARA500');
      expect(getRecordKey('medicines', { id: 'm-1' })).toBe('m-1');
      expect(getRecordKey('visits', { id: 'v-100', patient_id: 'NK-101' })).toBe('v-100');
      expect(getRecordKey('prescription_groups', { group_id: 'GRP-1' })).toBe('GRP-1');
    });

    it('parses timestamps from various field formats', () => {
      const iso = '2026-09-10T18:00:00.000Z';
      const expected = new Date(iso).getTime();
      expect(getRecordTimestamp({ updated_at: iso })).toBe(expected);
      expect(getRecordTimestamp({ updatedAt: iso })).toBe(expected);
      expect(getRecordTimestamp({ created_at: iso })).toBe(expected);
      expect(getRecordTimestamp({ timestamp: iso })).toBe(expected);
      expect(getRecordTimestamp(null)).toBe(0);
      expect(getRecordTimestamp({})).toBe(0);
    });

    it('includes all required sync tables in default list', () => {
      expect(DEFAULT_SYNC_TABLES).toContain('patients');
      expect(DEFAULT_SYNC_TABLES).toContain('visits');
      expect(DEFAULT_SYNC_TABLES).toContain('prescription_groups');
      expect(DEFAULT_SYNC_TABLES).toContain('group_medicines');
      expect(DEFAULT_SYNC_TABLES).toContain('medicines');
      expect(DEFAULT_SYNC_TABLES).toContain('tokens');
      expect(DEFAULT_SYNC_TABLES).toContain('departments');
      expect(DEFAULT_SYNC_TABLES).toContain('attendance');
      expect(DEFAULT_SYNC_TABLES).toContain('medicine_tasks');
    });
  });

  describe('reconcileTableDeltas (LWW Reconciliation)', () => {
    it('merges new remote records into empty local cache', () => {
      const remote = [
        { card_number: 'NK-001', name: 'Patient One', updated_at: '2026-09-10T10:00:00.000Z' },
        { card_number: 'NK-002', name: 'Patient Two', updated_at: '2026-09-10T11:00:00.000Z' }
      ];
      const { merged, count } = reconcileTableDeltas('patients', [], remote);
      expect(merged).toHaveLength(2);
      expect(count).toBe(2);
      expect(merged.find(p => p.card_number === 'NK-001')?.name).toBe('Patient One');
    });

    it('updates local records when remote record is newer', () => {
      const local = [
        { card_number: 'NK-001', name: 'Old Name', updated_at: '2026-09-10T10:00:00.000Z' }
      ];
      const remote = [
        { card_number: 'NK-001', name: 'Newer Name', phone: '9999999999', updated_at: '2026-09-10T12:00:00.000Z' }
      ];
      const { merged, count } = reconcileTableDeltas('patients', local, remote);
      expect(merged).toHaveLength(1);
      expect(count).toBe(1);
      expect(merged[0].name).toBe('Newer Name');
      expect(merged[0].phone).toBe('9999999999');
    });

    it('preserves local records when local edit is newer than server record', () => {
      const local = [
        { card_number: 'NK-001', name: 'Local Offline Edit', updated_at: '2026-09-10T14:00:00.000Z' }
      ];
      const remote = [
        { card_number: 'NK-001', name: 'Stale Remote Name', updated_at: '2026-09-10T10:00:00.000Z' }
      ];
      const { merged, count } = reconcileTableDeltas('patients', local, remote);
      expect(merged).toHaveLength(1);
      expect(count).toBe(0);
      expect(merged[0].name).toBe('Local Offline Edit');
    });

    it('preserves pending client visits with temporary IDs', () => {
      const local = [
        { id: 'VISIT-local-temp-123', patient_id: 'NK-001', doctor_name: 'Dr. Sharma' },
        { id: 'v-existing-1', patient_id: 'NK-002', doctor_name: 'Dr. Verma' }
      ];
      const remote = [
        { id: 'v-new-2', patient_id: 'NK-003', doctor_name: 'Dr. Patel' }
      ];
      const { merged } = reconcileTableDeltas('visits', local, remote);
      expect(merged.some(v => v.id === 'VISIT-local-temp-123')).toBe(true);
      expect(merged.some(v => v.id === 'v-existing-1')).toBe(true);
      expect(merged.some(v => v.id === 'v-new-2')).toBe(true);
      expect(merged).toHaveLength(3);
    });

    it('does not wipe unmodified local cache entries when receiving partial delta', () => {
      const local = [
        { id: 'tok-1', tokenNumber: 1, status: 'DONE', updated_at: '2026-09-10T08:00:00.000Z' },
        { id: 'tok-2', tokenNumber: 2, status: 'WAITING', updated_at: '2026-09-10T08:00:00.000Z' },
        { id: 'tok-3', tokenNumber: 3, status: 'WAITING', updated_at: '2026-09-10T08:00:00.000Z' }
      ];
      // Only tok-2 changed on the server:
      const remoteDelta = [
        { id: 'tok-2', tokenNumber: 2, status: 'IN_PROGRESS', updated_at: '2026-09-10T09:00:00.000Z' }
      ];
      const { merged, count } = reconcileTableDeltas('tokens', local, remoteDelta);
      expect(merged).toHaveLength(3);
      expect(count).toBe(1);
      expect(merged.find(t => t.id === 'tok-1')?.status).toBe('DONE');
      expect(merged.find(t => t.id === 'tok-2')?.status).toBe('IN_PROGRESS');
      expect(merged.find(t => t.id === 'tok-3')?.status).toBe('WAITING');
    });
  });

  describe('Session lastSyncTime tracking', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('updates and retrieves lastSyncTime correctly', async () => {
      expect(await getLastSyncTime()).toBeNull();
      const time = '2026-09-10T19:00:00.000Z';
      await setLastSyncTime(time);
      expect(await getLastSyncTime()).toBe(time);
    });
  });
});
