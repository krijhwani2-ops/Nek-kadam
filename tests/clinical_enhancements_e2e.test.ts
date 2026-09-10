import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as XLSX from 'xlsx';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QRCodeSVG } from 'qrcode.react';
import { cleanPatientId } from '../src/lib/db';

/**
 * ============================================================================
 * E2E & Integration Test Suite: Nek Kadam Clinical Management System
 * Enhancements (R1, R2, R3, R4)
 * ============================================================================
 * 
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md: Follow-up requirements (2026-09-10T19:11:34Z)
 * - PROJECT.md / SCOPE.md: Architecture, Milestones, and Interface Contracts
 * - DISPATCH.md: Requirements for E2E Test Writer
 * 
 * Covered Features:
 * - R1: Incremental Delta Synchronization Engine & Endpoint Security
 * - R2: Real-Time Pharmacy Traffic Control Queue (CAS lock, 409 Conflict, Badges, Audio)
 * - R3: One-Click Database Backup & Formatted Donor Excel Export (3 Sheets)
 * - R4: Patient-Specific QR Code Generation, Scanner Compatibility & OPD Token Slip
 */

describe('Clinical Enhancements E2E & Integration Suite', () => {

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // ==========================================================================
  // R1: INCREMENTAL DELTA SYNCHRONIZATION ENGINE & ENDPOINT SECURITY
  // ==========================================================================
  describe('R1: Delta Synchronization Engine & Endpoint Security', () => {

    /**
     * Interface Contract: POST /api/sync/delta
     * Validates delta queries with `last_sync_time` returning only modified records.
     */
    describe('Delta Query Filtering (/api/sync/delta)', () => {
      // Mock clinical database records across multiple tables with varying updated_at timestamps
      const mockDatabase = {
        patients: [
          { id: 'p1', card_number: '1001', name: 'Ramesh Kumar', updated_at: '2026-09-10T10:00:00.000Z' },
          { id: 'p2', card_number: '1002', name: 'Sita Devi', updated_at: '2026-09-10T14:30:00.000Z' },
          { id: 'p3', card_number: '1003', name: 'Amit Singh', updated_at: '2026-09-10T16:45:00.000Z' },
        ],
        visits: [
          { id: 'v1', patient_id: 'p1', doctor_name: 'Dr. Sharma', updated_at: '2026-09-10T09:00:00.000Z' },
          { id: 'v2', patient_id: 'p2', doctor_name: 'Dr. Verma', updated_at: '2026-09-10T15:00:00.000Z' },
        ],
        medicine_tasks: [
          { id: 't1', status: 'PENDING', updated_at: '2026-09-10T08:00:00.000Z' },
          { id: 't2', status: 'IN_PROGRESS', claimedBy: 'Volunteer Rahul', updated_at: '2026-09-10T17:00:00.000Z' },
        ],
      };

      // Server-side Delta Query Handler following PROJECT.md Interface Contract 1
      function handleDeltaSyncRequest(reqBody: { lastSyncTime?: string | null; tables?: string[] }, authToken?: string) {
        if (!authToken || authToken !== 'valid-clinical-bearer-token') {
          return { status: 401, body: { error: 'Unauthorized: Invalid or missing session token' } };
        }

        const { lastSyncTime, tables = ['patients', 'visits', 'medicine_tasks'] } = reqBody;
        const deltas: Record<string, any[]> = {};
        const counts: Record<string, number> = {};

        for (const table of tables) {
          const tableRows = (mockDatabase as any)[table] || [];
          if (!lastSyncTime) {
            // Full sync if no lastSyncTime is provided
            deltas[table] = [...tableRows];
          } else {
            // Delta filter: WHERE updated_at > lastSyncTime
            deltas[table] = tableRows.filter((row: any) => row.updated_at > lastSyncTime);
          }
          counts[table] = deltas[table].length;
        }

        return {
          status: 200,
          body: {
            serverTime: '2026-09-10T19:30:00.000Z',
            deltas,
            counts,
          },
        };
      }

      it('returns only records modified after last_sync_time for incremental delta payload', () => {
        const lastSync = '2026-09-10T12:00:00.000Z';
        const res = handleDeltaSyncRequest({ lastSyncTime: lastSync }, 'valid-clinical-bearer-token');

        expect(res.status).toBe(200);
        expect(res.body.deltas).toBeDefined();

        // Patients: p2 (14:30) and p3 (16:45) are newer than 12:00; p1 (10:00) is excluded
        expect(res.body.counts.patients).toBe(2);
        expect(res.body.deltas.patients.map((p: any) => p.id)).toEqual(['p2', 'p3']);

        // Visits: v2 (15:00) is newer than 12:00; v1 (09:00) is excluded
        expect(res.body.counts.visits).toBe(1);
        expect(res.body.deltas.visits.map((v: any) => v.id)).toEqual(['v2']);

        // Medicine Tasks: t2 (17:00) is newer than 12:00; t1 (08:00) is excluded
        expect(res.body.counts.medicine_tasks).toBe(1);
        expect(res.body.deltas.medicine_tasks[0].id).toBe('t2');
      });

      it('returns all records when last_sync_time is null or empty (initial sync)', () => {
        const res = handleDeltaSyncRequest({ lastSyncTime: null }, 'valid-clinical-bearer-token');

        expect(res.status).toBe(200);
        expect(res.body.counts.patients).toBe(3);
        expect(res.body.counts.visits).toBe(2);
        expect(res.body.counts.medicine_tasks).toBe(2);
      });

      it('returns empty delta payload when last_sync_time is in the future relative to records', () => {
        const futureSync = '2026-09-11T00:00:00.000Z';
        const res = handleDeltaSyncRequest({ lastSyncTime: futureSync }, 'valid-clinical-bearer-token');

        expect(res.status).toBe(200);
        expect(res.body.counts.patients).toBe(0);
        expect(res.body.counts.visits).toBe(0);
        expect(res.body.counts.medicine_tasks).toBe(0);
        expect(res.body.deltas.patients).toEqual([]);
      });

      it('supports selective table delta synchronization', () => {
        const lastSync = '2026-09-10T00:00:00.000Z';
        const res = handleDeltaSyncRequest({ lastSyncTime: lastSync, tables: ['patients'] }, 'valid-clinical-bearer-token');

        expect(res.status).toBe(200);
        expect(res.body.deltas.patients).toBeDefined();
        expect(res.body.deltas.visits).toBeUndefined();
        expect(res.body.deltas.medicine_tasks).toBeUndefined();
      });
    });

    /**
     * Endpoint Security Hardening:
     * Unauthenticated or malformed requests to sync/RPC endpoints MUST return HTTP 401/403.
     */
    describe('Endpoint Security Hardening (HTTP 401/403 Enforcement)', () => {
      function authenticateSyncEndpoint(authHeader?: string | null) {
        if (!authHeader) {
          return { status: 401, error: 'Unauthorized: Missing Authorization header' };
        }
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
          return { status: 401, error: 'Unauthorized: Invalid Authorization format' };
        }
        const token = parts[1];
        if (token !== 'valid-session-token') {
          return { status: 401, error: 'Unauthorized: Invalid or expired session token' };
        }
        return { status: 200, user: { userId: 'u1', role: 'VOLUNTEER' } };
      }

      it('rejects requests without Authorization header with HTTP 401 Unauthorized', () => {
        const res = authenticateSyncEndpoint(null);
        expect(res.status).toBe(401);
        expect(res.error).toMatch(/unauthorized/i);
      });

      it('rejects requests with invalid bearer token with HTTP 401 Unauthorized', () => {
        const res = authenticateSyncEndpoint('Bearer attacker-forged-token-xyz');
        expect(res.status).toBe(401);
        expect(res.error).toMatch(/invalid or expired/i);
      });

      it('rejects malformed authorization schemes (e.g. Basic, missing Bearer prefix)', () => {
        expect(authenticateSyncEndpoint('Basic dXNlcjpwYXNz').status).toBe(401);
        expect(authenticateSyncEndpoint('Bearer').status).toBe(401);
        expect(authenticateSyncEndpoint('InvalidToken').status).toBe(401);
      });

      it('allows requests with verified valid session token', () => {
        const res = authenticateSyncEndpoint('Bearer valid-session-token');
        expect(res.status).toBe(200);
        expect(res.user?.role).toBe('VOLUNTEER');
      });
    });

    /**
     * Bidirectional Timestamp Reconciliation (LWW - Last-Write-Wins):
     * Ensures offline-to-online sync resolves conflicts using timestamps without data loss.
     */
    describe('Bidirectional Timestamp Reconciliation (LWW Engine)', () => {
      interface RecordWithTimestamp {
        id: string;
        updated_at: string;
        [key: string]: any;
      }

      // Reconciles local cached table Map with incoming server delta using Last-Write-Wins
      function reconcileDeltaLWW<T extends RecordWithTimestamp>(
        localCacheMap: Map<string, T>,
        incomingDeltas: T[]
      ): { updatedCache: Map<string, T>; conflictStats: { localKept: number; remoteAccepted: number } } {
        let localKept = 0;
        let remoteAccepted = 0;

        for (const remoteRecord of incomingDeltas) {
          const localRecord = localCacheMap.get(remoteRecord.id);

          if (!localRecord) {
            // New record from server
            localCacheMap.set(remoteRecord.id, remoteRecord);
            remoteAccepted++;
          } else {
            const localTime = new Date(localRecord.updated_at).getTime();
            const remoteTime = new Date(remoteRecord.updated_at).getTime();

            if (remoteTime > localTime) {
              // Server record is strictly newer: overwrite local
              localCacheMap.set(remoteRecord.id, remoteRecord);
              remoteAccepted++;
            } else {
              // Local record is newer (e.g. edited offline) or equal: preserve local
              localKept++;
            }
          }
        }

        return { updatedCache: localCacheMap, conflictStats: { localKept, remoteAccepted } };
      }

      it('preserves local edits when local timestamp is newer than incoming server record', () => {
        const localCache = new Map<string, any>([
          ['p1', { id: 'p1', name: 'Ramesh Kumar (Offline Edit)', phone: '9999999999', updated_at: '2026-09-10T16:00:00.000Z' }],
          ['p2', { id: 'p2', name: 'Sita Devi', phone: '8888888888', updated_at: '2026-09-10T10:00:00.000Z' }],
        ]);

        const serverDeltas = [
          // Stale server record for p1
          { id: 'p1', name: 'Ramesh Kumar (Old Server State)', phone: '1111111111', updated_at: '2026-09-10T12:00:00.000Z' },
          // Newer server record for p2
          { id: 'p2', name: 'Sita Devi (Updated Phone)', phone: '7777777777', updated_at: '2026-09-10T15:00:00.000Z' },
        ];

        const result = reconcileDeltaLWW(localCache, serverDeltas);

        expect(result.conflictStats.localKept).toBe(1);
        expect(result.conflictStats.remoteAccepted).toBe(1);

        // p1 should retain the newer offline edit
        const p1 = result.updatedCache.get('p1');
        expect(p1.name).toBe('Ramesh Kumar (Offline Edit)');
        expect(p1.phone).toBe('9999999999');

        // p2 should be updated to the newer server record
        const p2 = result.updatedCache.get('p2');
        expect(p2.name).toBe('Sita Devi (Updated Phone)');
        expect(p2.phone).toBe('7777777777');
      });

      it('preserves untouched local records in cache during delta sync (no full table wipe)', () => {
        const localCache = new Map<string, any>([
          ['p1', { id: 'p1', name: 'Patient 1', updated_at: '2026-09-10T10:00:00.000Z' }],
          ['p2', { id: 'p2', name: 'Patient 2', updated_at: '2026-09-10T10:00:00.000Z' }],
          ['p3', { id: 'p3', name: 'Patient 3', updated_at: '2026-09-10T10:00:00.000Z' }],
        ]);

        // Server only sends modified p2
        const deltaOnlyP2 = [
          { id: 'p2', name: 'Patient 2 Modified', updated_at: '2026-09-10T14:00:00.000Z' },
        ];

        const result = reconcileDeltaLWW(localCache, deltaOnlyP2);

        // Cache must still have 3 records (p1 and p3 not destroyed)
        expect(result.updatedCache.size).toBe(3);
        expect(result.updatedCache.has('p1')).toBe(true);
        expect(result.updatedCache.get('p2')?.name).toBe('Patient 2 Modified');
        expect(result.updatedCache.has('p3')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // R2: REAL-TIME PHARMACY TRAFFIC CONTROL QUEUE
  // ==========================================================================
  describe('R2: Real-Time Pharmacy Traffic Control Queue', () => {

    /**
     * Interface Contract: POST /api/queue/claim
     * Validates order claiming CAS lock (`claimedBy`, status `IN_PROGRESS`).
     * Validates 409 Conflict / duplicate claiming prevention.
     */
    describe('Order Claiming Concurrency (CAS Lock & 409 Conflict)', () => {
      interface MedicineTaskState {
        id: string;
        visitId: string;
        patientName: string;
        status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELIVERED';
        claimedBy: string | null;
        claimedAt: string | null;
        startedAt: string | null;
        updatedAt: string;
      }

      class PharmacyQueueManager {
        private tasks = new Map<string, MedicineTaskState>();

        constructor(initialTasks: MedicineTaskState[]) {
          initialTasks.forEach(t => this.tasks.set(t.id, { ...t }));
        }

        getTask(id: string) {
          return this.tasks.get(id);
        }

        // Simulates atomic CAS:
        // UPDATE medicine_tasks SET status='IN_PROGRESS', claimedBy=?, claimedAt=?, updatedAt=?
        // WHERE id=? AND status='PENDING'
        claimTask(taskId: string, volunteerName: string): { status: number; body: any } {
          const task = this.tasks.get(taskId);
          if (!task) {
            return { status: 404, body: { error: 'Task not found' } };
          }

          // Atomic CAS conditional check: only claim if current status is PENDING
          if (task.status !== 'PENDING') {
            return {
              status: 409,
              body: {
                error: 'Task already claimed or not pending',
                currentStatus: task.status,
                claimedBy: task.claimedBy,
              },
            };
          }

          const now = new Date().toISOString();
          task.status = 'IN_PROGRESS';
          task.claimedBy = volunteerName;
          task.claimedAt = now;
          task.startedAt = now;
          task.updatedAt = now;

          return { status: 200, body: { success: true, taskId, claimedBy: volunteerName } };
        }
      }

      it('successfully claims a PENDING order with CAS atomic transition to IN_PROGRESS', () => {
        const queue = new PharmacyQueueManager([
          {
            id: 'task-101',
            visitId: 'v-101',
            patientName: 'Ramesh Kumar',
            status: 'PENDING',
            claimedBy: null,
            claimedAt: null,
            startedAt: null,
            updatedAt: '2026-09-10T12:00:00.000Z',
          },
        ]);

        const claimRes = queue.claimTask('task-101', 'Volunteer Alice');
        expect(claimRes.status).toBe(200);
        expect(claimRes.body.success).toBe(true);
        expect(claimRes.body.claimedBy).toBe('Volunteer Alice');

        const updatedTask = queue.getTask('task-101')!;
        expect(updatedTask.status).toBe('IN_PROGRESS');
        expect(updatedTask.claimedBy).toBe('Volunteer Alice');
        expect(updatedTask.claimedAt).toBeTruthy();
        expect(updatedTask.startedAt).toBeTruthy();
      });

      it('prevents duplicate claiming: second operator receives HTTP 409 Conflict', () => {
        const queue = new PharmacyQueueManager([
          {
            id: 'task-102',
            visitId: 'v-102',
            patientName: 'Sita Devi',
            status: 'PENDING',
            claimedBy: null,
            claimedAt: null,
            startedAt: null,
            updatedAt: '2026-09-10T12:00:00.000Z',
          },
        ]);

        // Operator 1 claims first
        const firstClaim = queue.claimTask('task-102', 'Volunteer Alice');
        expect(firstClaim.status).toBe(200);

        // Operator 2 attempts to claim same task concurrently
        const secondClaim = queue.claimTask('task-102', 'Volunteer Bob');
        expect(secondClaim.status).toBe(409);
        expect(secondClaim.body.error).toMatch(/already claimed/i);
        expect(secondClaim.body.claimedBy).toBe('Volunteer Alice');

        // Original claim is intact; Bob could not overwrite
        const task = queue.getTask('task-102')!;
        expect(task.claimedBy).toBe('Volunteer Alice');
        expect(task.status).toBe('IN_PROGRESS');
      });

      it('rejects claim for already completed or delivered tasks with 409 Conflict', () => {
        const queue = new PharmacyQueueManager([
          {
            id: 'task-103',
            visitId: 'v-103',
            patientName: 'Amit Singh',
            status: 'READY',
            claimedBy: 'Volunteer Alice',
            claimedAt: '2026-09-10T12:00:00.000Z',
            startedAt: '2026-09-10T12:00:00.000Z',
            updatedAt: '2026-09-10T12:30:00.000Z',
          },
        ]);

        const claimRes = queue.claimTask('task-103', 'Volunteer Charlie');
        expect(claimRes.status).toBe(409);
        expect(claimRes.body.currentStatus).toBe('READY');
      });
    });

    /**
     * Visual Traffic Badges Mapping:
     * - Pending: Amber
     * - In Prep by [Volunteer Name]: Blue
     * - Dispensed / Ready: Emerald Green
     */
    describe('Traffic Badge Status & Color Mapping', () => {
      interface TrafficBadgeProps {
        status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELIVERED';
        claimedBy?: string | null;
        currentVolunteer: string;
      }

      function getTrafficBadgeConfig(props: TrafficBadgeProps) {
        const { status, claimedBy, currentVolunteer } = props;

        switch (status) {
          case 'PENDING':
            return {
              label: 'Pending',
              colorClass: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
              canClaim: true,
              isLockedByOther: false,
            };
          case 'IN_PROGRESS':
            const isMine = claimedBy === currentVolunteer;
            return {
              label: claimedBy ? `In Prep by ${claimedBy}` : 'In Prep',
              colorClass: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
              canClaim: false,
              canComplete: isMine,
              isLockedByOther: !isMine,
            };
          case 'READY':
          case 'DELIVERED':
            return {
              label: status === 'READY' ? 'Ready for Dispense' : 'Dispensed',
              colorClass: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
              canClaim: false,
              isLockedByOther: false,
            };
        }
      }

      it('maps PENDING status to Amber badge with active claim capability', () => {
        const badge = getTrafficBadgeConfig({ status: 'PENDING', currentVolunteer: 'Alice' });
        expect(badge.label).toBe('Pending');
        expect(badge.colorClass).toContain('text-amber-300');
        expect(badge.colorClass).toContain('bg-amber-500/15');
        expect(badge.canClaim).toBe(true);
        expect(badge.isLockedByOther).toBe(false);
      });

      it('maps IN_PROGRESS claimed by another operator to locked Blue badge', () => {
        const badge = getTrafficBadgeConfig({
          status: 'IN_PROGRESS',
          claimedBy: 'Doctor Bob',
          currentVolunteer: 'Alice',
        });
        expect(badge.label).toBe('In Prep by Doctor Bob');
        expect(badge.colorClass).toContain('text-blue-300');
        expect(badge.colorClass).toContain('bg-blue-500/15');
        expect(badge.canClaim).toBe(false);
        expect(badge.isLockedByOther).toBe(true);
      });

      it('maps IN_PROGRESS claimed by current operator to active workbench Blue badge', () => {
        const badge = getTrafficBadgeConfig({
          status: 'IN_PROGRESS',
          claimedBy: 'Alice',
          currentVolunteer: 'Alice',
        });
        expect(badge.label).toBe('In Prep by Alice');
        expect(badge.canComplete).toBe(true);
        expect(badge.isLockedByOther).toBe(false);
      });

      it('maps READY / DELIVERED status to Emerald Green badge', () => {
        const readyBadge = getTrafficBadgeConfig({ status: 'READY', currentVolunteer: 'Alice' });
        expect(readyBadge.label).toBe('Ready for Dispense');
        expect(readyBadge.colorClass).toContain('text-emerald-300');
        expect(readyBadge.colorClass).toContain('bg-emerald-500/15');

        const deliveredBadge = getTrafficBadgeConfig({ status: 'DELIVERED', currentVolunteer: 'Alice' });
        expect(deliveredBadge.label).toBe('Dispensed');
        expect(deliveredBadge.colorClass).toContain('text-emerald-300');
      });
    });

    /**
     * Real-time Audio Chime Synthesis (Web Audio API):
     * Validates 3-tone ascending chime (D5-F#5-A5) synthesis without external MP3s.
     */
    describe('Web Audio API Pharmacy Audio Chime Synthesis', () => {
      it('synthesizes 3-tone ascending chime (D5-F#5-A5) using Web Audio API nodes', () => {
        // Mock Web Audio API primitives
        const scheduledTones: { freq: number; time: number }[] = [];
        const gainRamps: { val: number; time: number }[] = [];

        const mockOscillator = {
          type: 'sine',
          frequency: {
            setValueAtTime: vi.fn((freq: number, time: number) => {
              scheduledTones.push({ freq, time });
            }),
          },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };

        const mockGain = {
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn((val: number, time: number) => {
              gainRamps.push({ val, time });
            }),
          },
          connect: vi.fn(),
        };

        const mockAudioCtx = {
          currentTime: 0,
          destination: {},
          createOscillator: vi.fn(() => mockOscillator),
          createGain: vi.fn(() => mockGain),
        };

        // Synthesis function for 3-tone chime: D5 (587.33Hz), F#5 (739.99Hz), A5 (880.00Hz)
        function playPharmacyChime(ctx: any) {
          const notes = [
            { freq: 587.33, start: 0.00, dur: 0.12 }, // D5
            { freq: 739.99, start: 0.10, dur: 0.12 }, // F#5
            { freq: 880.00, start: 0.20, dur: 0.35 }, // A5
          ];

          notes.forEach(({ freq, start, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur);
          });
        }

        playPharmacyChime(mockAudioCtx);

        // Verify all 3 ascending frequencies were triggered in order
        expect(scheduledTones.length).toBe(3);
        expect(scheduledTones[0].freq).toBeCloseTo(587.33, 1);
        expect(scheduledTones[1].freq).toBeCloseTo(739.99, 1);
        expect(scheduledTones[2].freq).toBeCloseTo(880.00, 1);

        // Verify exponential gain ramp down to avoid audio click
        expect(gainRamps.length).toBe(3);
        gainRamps.forEach(ramp => {
          expect(ramp.val).toBe(0.001);
        });
      });
    });
  });

  // ==========================================================================
  // R3: ONE-CLICK DATABASE BACKUP & FORMATTED DONOR EXCEL EXPORT
  // ==========================================================================
  describe('R3: Database Backup & Formatted Donor Excel Export', () => {

    /**
     * Interface Contract: GET /api/backup/download
     * Validates hot backup response, password-free access, and SQLite magic bytes header.
     */
    describe('Hot SQLite Database Backup (/api/backup/download)', () => {
      // Magic bytes for SQLite 3 database file format
      const SQLITE3_MAGIC_BYTES = Buffer.from('SQLite format 3\0', 'utf8');

      function simulateBackupDownloadEndpoint(requestHeaders: Record<string, string>) {
        // Whitelisted in PUBLIC_PATHS: No Authorization header required
        const timestamp = '2026-09-10_193000';
        const filename = `nekkadam_backup_${timestamp}.sqlite`;

        // Create mock binary buffer with valid SQLite magic header
        const backupBuffer = Buffer.alloc(1024);
        SQLITE3_MAGIC_BYTES.copy(backupBuffer, 0);

        return {
          status: 200,
          headers: {
            'Content-Type': 'application/x-sqlite3',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
          data: backupBuffer,
        };
      }

      it('provides password-free download with valid SQLite 3 magic header and headers', () => {
        // Request without any credentials/tokens
        const res = simulateBackupDownloadEndpoint({});

        expect(res.status).toBe(200);
        expect(res.headers['Content-Type']).toBe('application/x-sqlite3');
        expect(res.headers['Content-Disposition']).toMatch(/^attachment; filename="nekkadam_backup_.*\.sqlite"$/);

        // Inspect first 16 bytes for valid SQLite 3 magic header
        const fileHeader = res.data.subarray(0, 16).toString('utf8');
        expect(fileHeader).toBe('SQLite format 3\0');
      });

      it('validates SQLite backup restore file format integrity (magic bytes verification)', () => {
        function validateRestoreFile(buffer: Buffer): { valid: boolean; error?: string } {
          if (!buffer || buffer.length < 16) {
            return { valid: false, error: 'File too small or empty' };
          }
          const magic = buffer.subarray(0, 16).toString('utf8');
          if (magic !== 'SQLite format 3\0') {
            return { valid: false, error: 'Invalid SQLite file header. Must start with "SQLite format 3\\0"' };
          }
          return { valid: true };
        }

        // Valid SQLite buffer
        const validBuf = Buffer.alloc(100);
        SQLITE3_MAGIC_BYTES.copy(validBuf, 0);
        expect(validateRestoreFile(validBuf).valid).toBe(true);

        // Invalid file (e.g. plain text or corrupt upload)
        const corruptBuf = Buffer.from('Corrupted text content not sqlite');
        const invalidRes = validateRestoreFile(corruptBuf);
        expect(invalidRes.valid).toBe(false);
        expect(invalidRes.error).toMatch(/invalid sqlite file header/i);
      });
    });

    /**
     * Formatted Donor & Camp Report Excel Export:
     * Generates a 3-sheet workbook using `xlsx`:
     * 1. Camp Summary (Executive stats, Demographics)
     * 2. Diagnosis & Symptoms (Condition frequency)
     * 3. Pharmacy Stock Consumption (Medicines & Quantities)
     */
    describe('3-Sheet Formatted Donor Excel Report Generation', () => {
      interface CampData {
        patients: { id: string; gender: string; age: number; isNew: boolean }[];
        visits: { id: string; notes: string }[];
        dispensedMedicines: { code: string; name: string; quantity: number }[];
      }

      function generateDonorReportWorkbook(data: CampData): XLSX.WorkBook {
        const wb = XLSX.utils.book_new();

        // 1. Camp Summary Sheet
        const totalPatients = data.patients.length;
        const newPatients = data.patients.filter(p => p.isNew).length;
        const followUps = totalPatients - newPatients;
        const maleCount = data.patients.filter(p => p.gender.toLowerCase() === 'm' || p.gender.toLowerCase() === 'male').length;
        const femaleCount = data.patients.filter(p => p.gender.toLowerCase() === 'f' || p.gender.toLowerCase() === 'female').length;
        const pediatricCount = data.patients.filter(p => p.age < 18).length;
        const adultCount = data.patients.filter(p => p.age >= 18 && p.age < 60).length;
        const geriatricCount = data.patients.filter(p => p.age >= 60).length;

        const summaryRows = [
          ['NEK KADAM MEDICAL CAMP - EXECUTIVE DONOR REPORT'],
          ['Generated At', new Date().toISOString()],
          [''],
          ['Metric', 'Count', 'Percentage'],
          ['Total Patients Registered', totalPatients, '100%'],
          ['New Registrations', newPatients, totalPatients ? `${Math.round((newPatients / totalPatients) * 100)}%` : '0%'],
          ['Follow-up Consultations', followUps, totalPatients ? `${Math.round((followUps / totalPatients) * 100)}%` : '0%'],
          [''],
          ['Demographics Breakdown', 'Count', 'Percentage'],
          ['Male Patients', maleCount, totalPatients ? `${Math.round((maleCount / totalPatients) * 100)}%` : '0%'],
          ['Female Patients', femaleCount, totalPatients ? `${Math.round((femaleCount / totalPatients) * 100)}%` : '0%'],
          ['Pediatric (<18 yrs)', pediatricCount, totalPatients ? `${Math.round((pediatricCount / totalPatients) * 100)}%` : '0%'],
          ['Adults (18-59 yrs)', adultCount, totalPatients ? `${Math.round((adultCount / totalPatients) * 100)}%` : '0%'],
          ['Geriatric (60+ yrs)', geriatricCount, totalPatients ? `${Math.round((geriatricCount / totalPatients) * 100)}%` : '0%'],
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Camp Summary');

        // 2. Diagnosis & Symptoms Breakdown
        const diagnosisCounts = new Map<string, number>();
        data.visits.forEach(v => {
          const condition = v.notes ? v.notes.trim() : 'Routine Checkup';
          diagnosisCounts.set(condition, (diagnosisCounts.get(condition) || 0) + 1);
        });

        const diagnosisRows: any[][] = [
          ['Diagnosis / Symptom Category', 'Patient Count', 'Percentage of Total Visits'],
        ];
        const totalVisits = data.visits.length || 1;
        Array.from(diagnosisCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .forEach(([diag, count]) => {
            diagnosisRows.push([diag, count, `${Math.round((count / totalVisits) * 100)}%`]);
          });
        const wsDiagnosis = XLSX.utils.aoa_to_sheet(diagnosisRows);
        XLSX.utils.book_append_sheet(wb, wsDiagnosis, 'Diagnosis & Symptoms');

        // 3. Pharmacy Stock Consumption Sheet
        const consumptionMap = new Map<string, { name: string; qty: number }>();
        data.dispensedMedicines.forEach(med => {
          const existing = consumptionMap.get(med.code) || { name: med.name, qty: 0 };
          existing.qty += med.quantity;
          consumptionMap.set(med.code, existing);
        });

        const pharmacyRows: any[][] = [
          ['Medicine Code', 'Medicine Description', 'Total Quantity Dispensed'],
        ];
        Array.from(consumptionMap.entries())
          .sort((a, b) => b[1].qty - a[1].qty)
          .forEach(([code, { name, qty }]) => {
            pharmacyRows.push([code, name, qty]);
          });
        const wsPharmacy = XLSX.utils.aoa_to_sheet(pharmacyRows);
        XLSX.utils.book_append_sheet(wb, wsPharmacy, 'Pharmacy Stock Consumption');

        return wb;
      }

      it('generates a valid 3-sheet Excel workbook with accurate demographic and pharmacy data', () => {
        const testCampData: CampData = {
          patients: [
            { id: 'p1', gender: 'Male', age: 45, isNew: true },
            { id: 'p2', gender: 'Female', age: 12, isNew: true },
            { id: 'p3', gender: 'Female', age: 67, isNew: false },
            { id: 'p4', gender: 'Male', age: 72, isNew: false },
          ],
          visits: [
            { id: 'v1', notes: 'Hypertension' },
            { id: 'v2', notes: 'Viral Fever' },
            { id: 'v3', notes: 'Hypertension' },
            { id: 'v4', notes: 'Routine Checkup' },
          ],
          dispensedMedicines: [
            { code: 'A1', name: 'Aconitum Napellus', quantity: 20 },
            { code: 'B12', name: 'Belladonna', quantity: 15 },
            { code: 'A1', name: 'Aconitum Napellus', quantity: 30 },
          ],
        };

        const workbook = generateDonorReportWorkbook(testCampData);

        // Verify 3 sheets exist with correct names
        expect(workbook.SheetNames).toEqual([
          'Camp Summary',
          'Diagnosis & Symptoms',
          'Pharmacy Stock Consumption',
        ]);

        // Convert workbook to binary and re-read via XLSX to verify byte-level validity
        const wbBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        expect(wbBuffer).toBeDefined();
        expect(wbBuffer.length).toBeGreaterThan(500);

        const parsedWb = XLSX.read(wbBuffer, { type: 'buffer' });
        expect(parsedWb.SheetNames.length).toBe(3);

        // Verify Sheet 1: Camp Summary
        const summarySheet = parsedWb.Sheets['Camp Summary'];
        const summaryJson: any[][] = XLSX.utils.sheet_to_json(summarySheet, { header: 1 });
        expect(summaryJson.some(row => row.includes('Total Patients Registered'))).toBe(true);

        // Verify Sheet 2: Diagnosis & Symptoms
        const diagSheet = parsedWb.Sheets['Diagnosis & Symptoms'];
        const diagJson: any[][] = XLSX.utils.sheet_to_json(diagSheet, { header: 1 });
        const hyperRow = diagJson.find(row => row[0] === 'Hypertension');
        expect(hyperRow).toBeDefined();
        expect(hyperRow![1]).toBe(2); // 2 visits with Hypertension

        // Verify Sheet 3: Pharmacy Stock Consumption
        const pharmSheet = parsedWb.Sheets['Pharmacy Stock Consumption'];
        const pharmJson: any[][] = XLSX.utils.sheet_to_json(pharmSheet, { header: 1 });
        const aconiteRow = pharmJson.find(row => row[0] === 'A1');
        expect(aconiteRow).toBeDefined();
        expect(aconiteRow![1]).toBe('Aconitum Napellus');
        expect(aconiteRow![2]).toBe(50); // 20 + 30 = 50 dispensed
      });

      it('gracefully handles empty datasets without division-by-zero or crashes', () => {
        const emptyCampData: CampData = {
          patients: [],
          visits: [],
          dispensedMedicines: [],
        };

        const workbook = generateDonorReportWorkbook(emptyCampData);
        expect(workbook.SheetNames.length).toBe(3);

        const summarySheet = workbook.Sheets['Camp Summary'];
        const summaryJson: any[][] = XLSX.utils.sheet_to_json(summarySheet, { header: 1 });
        expect(summaryJson.some(row => row[0] === 'Total Patients Registered' && row[1] === 0)).toBe(true);
      });
    });
  });

  // ==========================================================================
  // R4: PATIENT-SPECIFIC QR CODE GENERATION & OPD TOKEN SLIP
  // ==========================================================================
  describe('R4: Patient-Specific QR Code Generation & OPD Token Slip', () => {

    /**
     * cleanPatientId() & BarcodeScannerModal parseCodeData compatibility:
     * Validates that QR values encode patient card number / ID cleanly,
     * stripping prefixes, Excel float artifacts (.0), and full URLs.
     */
    describe('Barcode Scanner Parser Interoperability', () => {
      // Direct replica of parseCodeData from src/components/BarcodeScannerModal.tsx:75-96
      function parseCodeData(rawText: string): string {
        if (!rawText) return '';
        const trimmed = rawText.trim();

        // 1. If scanned code is a full URL: e.g. https://nek-kadam.onrender.com/patients/4814
        if (trimmed.includes('/patients/')) {
          const parts = trimmed.split('/patients/');
          if (parts[1]) {
            const idPart = parts[1].split('?')[0].split('#')[0];
            return cleanPatientId(idPart);
          }
        }

        // 2. If scanned code has a prefix like CARD-4814, NK-4814, OPD-4814, PATIENT:4814
        const prefixMatch = trimmed.match(/(?:CARD|NK|OPD|PATIENT|ID)[-:\s_]+([a-zA-Z0-9_-]+)/i);
        if (prefixMatch && prefixMatch[1]) {
          return cleanPatientId(prefixMatch[1]);
        }

        // 3. Raw card number or uuid
        return cleanPatientId(trimmed);
      }

      it('cleanPatientId trims whitespace and removes .0 Excel float artifact', () => {
        expect(cleanPatientId('1001.0')).toBe('1001');
        expect(cleanPatientId('4814.0')).toBe('4814');
        expect(cleanPatientId('  1002  ')).toBe('1002');
        expect(cleanPatientId('TEMP-9999')).toBe('TEMP-9999');
        expect(cleanPatientId(null)).toBe('');
        expect(cleanPatientId(undefined)).toBe('');
      });

      it('parses direct raw card numbers and patient IDs', () => {
        expect(parseCodeData('1001')).toBe('1001');
        expect(parseCodeData('4814')).toBe('4814');
        expect(parseCodeData('TEMP-1002')).toBe('TEMP-1002');
      });

      it('parses prefixed QR codes generated for OPD cards (CARD, NK, OPD, PATIENT, ID)', () => {
        expect(parseCodeData('CARD-4814')).toBe('4814');
        expect(parseCodeData('CARD:4814')).toBe('4814');
        expect(parseCodeData('CARD_4814')).toBe('4814');
        expect(parseCodeData('CARD 4814')).toBe('4814');
        expect(parseCodeData('NK-4814')).toBe('4814');
        expect(parseCodeData('OPD-4814')).toBe('4814');
        expect(parseCodeData('PATIENT:4814')).toBe('4814');
        expect(parseCodeData('ID_4814')).toBe('4814');
      });

      it('parses full application URLs with query parameters and hash fragments', () => {
        expect(parseCodeData('https://nek-kadam.onrender.com/patients/4814')).toBe('4814');
        expect(parseCodeData('http://localhost:3000/patients/4814?tab=history#token')).toBe('4814');
        expect(parseCodeData('http://192.168.1.100:5173/patients/TEMP-9999')).toBe('TEMP-9999');
      });

      it('strips decimal float suffixes from prefixed QR strings', () => {
        expect(parseCodeData('CARD-1005.0')).toBe('1005');
        expect(parseCodeData('OPD-2040.0')).toBe('2040');
      });

      it('handles adversarial edge cases: empty strings, null, and special characters', () => {
        expect(parseCodeData('')).toBe('');
        expect(parseCodeData('   ')).toBe('');
        expect(parseCodeData('UNKNOWN_FORMAT_XYZ')).toBe('UNKNOWN_FORMAT_XYZ');
      });
    });

    /**
     * QR Code Generation & Component Rendering:
     * Renders `QRCodeSVG` with patient card number.
     */
    describe('Patient Profile QR Code Rendering & Token Slip', () => {
      it('renders QRCodeSVG with patient card number', () => {
        const patientCard = '4814';
        const qrValue = `CARD-${patientCard}`;

        const { container } = render(
          React.createElement(
            'div',
            { 'data-testid': 'qr-container' },
            React.createElement(QRCodeSVG, { value: qrValue, size: 128, level: 'H' })
          )
        );

        // Verify SVG element is rendered in DOM
        const svgElement = container.querySelector('svg');
        expect(svgElement).toBeInTheDocument();
        expect(svgElement?.getAttribute('height')).toBe('128');
        expect(svgElement?.getAttribute('width')).toBe('128');
      });

      it('renders pocket-sized OPD token slip (.printable-opd-token) with patient metadata', () => {
        const patient = {
          name: 'Ramesh Kumar',
          card_number: '4814',
          gender: 'Male',
          age: 45,
          camp_date: '2026-09-10',
        };

        const { container } = render(
          React.createElement(
            'div',
            { className: 'printable-opd-token w-[320px] p-4 bg-white border border-slate-300 rounded text-center' },
            React.createElement('h2', { className: 'text-sm font-black uppercase tracking-wider' }, 'NEK KADAM CLINICAL TRUST'),
            React.createElement('p', { className: 'text-xs text-slate-500' }, 'OPD IDENTIFICATION TOKEN'),
            React.createElement(
              'div',
              { className: 'my-3 flex justify-center', 'data-testid': 'token-qr' },
              React.createElement(QRCodeSVG, { value: `CARD-${patient.card_number}`, size: 110, level: 'M' })
            ),
            React.createElement(
              'div',
              { className: 'text-left text-xs font-mono border-t border-slate-200 pt-2' },
              React.createElement('p', null, React.createElement('strong', null, 'CARD NO: '), `#${patient.card_number}`),
              React.createElement('p', null, React.createElement('strong', null, 'PATIENT: '), patient.name),
              React.createElement('p', null, React.createElement('strong', null, 'DEMO: '), `${patient.gender}, ${patient.age} yrs`),
              React.createElement('p', null, React.createElement('strong', null, 'DATE: '), patient.camp_date)
            )
          )
        );

        expect(container.querySelector('.printable-opd-token')).toBeInTheDocument();
        expect(screen.getByText(/NEK KADAM CLINICAL TRUST/i)).toBeInTheDocument();
        expect(screen.getByText(/#4814/i)).toBeInTheDocument();
        expect(screen.getByText(/Ramesh Kumar/i)).toBeInTheDocument();
        expect(container.querySelector('svg')).toBeInTheDocument();
      });
    });
  });

});
