import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  STANDARD_FALLBACK_USERS,
  STANDARD_DEPARTMENTS,
  getCachedUsers,
  setCachedUsers,
  fetchLoginUsers,
  fetchAdminUsers,
  fetchDepartments,
  CACHED_USERS_KEY
} from '../src/lib/session';

describe('Login & Session Robust Fallback Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('STANDARD_FALLBACK_USERS contains all required default accounts', () => {
    const names = STANDARD_FALLBACK_USERS.map(u => u.name.toLowerCase());
    
    expect(names).toContain('admin');
    expect(names).toContain('rohan');
    expect(names).toContain('dr. vibhuti kori');
    expect(names).toContain('dr. rajdeep sonkar');
    expect(names).toContain('volunteers');
    expect(names).toContain('pharmacy');
    expect(names).toContain('triage');

    // Verify roles
    const adminUser = STANDARD_FALLBACK_USERS.find(u => u.name.toLowerCase() === 'admin');
    const rohanUser = STANDARD_FALLBACK_USERS.find(u => u.name.toLowerCase() === 'rohan');
    const vibhutiUser = STANDARD_FALLBACK_USERS.find(u => u.name.toLowerCase() === 'dr. vibhuti kori');
    const rajdeepUser = STANDARD_FALLBACK_USERS.find(u => u.name.toLowerCase() === 'dr. rajdeep sonkar');

    expect(adminUser?.role).toBe('ADMIN');
    expect(rohanUser?.role).toBe('ADMIN');
    expect(vibhutiUser?.role).toBe('ADMIN');
    expect(rajdeepUser?.role).toBe('ADMIN');
  });

  it('getCachedUsers returns STANDARD_FALLBACK_USERS when localStorage is empty', () => {
    const users = getCachedUsers();
    expect(users.length).toBeGreaterThanOrEqual(7);
    expect(users.some(u => u.name === 'Dr. Vibhuti Kori')).toBe(true);
    expect(users.some(u => u.name === 'Dr. Rajdeep Sonkar')).toBe(true);
    expect(users.some(u => u.name === 'Admin')).toBe(true);
  });

  it('getCachedUsers merges custom stored users with standard fallback accounts without duplicates', () => {
    const customUser = { id: 'custom-1', name: 'Sister Anita', department: 'Nursing', role: 'Volunteer' };
    setCachedUsers([customUser]);

    const users = getCachedUsers();
    expect(users.some(u => u.name === 'Sister Anita')).toBe(true);
    // Standard accounts must still be present
    expect(users.some(u => u.name === 'Dr. Vibhuti Kori')).toBe(true);
    expect(users.some(u => u.name === 'Admin')).toBe(true);
    expect(users.some(u => u.name === 'Rohan')).toBe(true);

    // No duplicate names
    const names = users.map(u => u.name.trim().toLowerCase());
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });

  it('fetchLoginUsers falls back gracefully on network error or timeout without throwing', async () => {
    // Mock fetch to simulate network down / timeout
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const result = await fetchLoginUsers(100);
    expect(result.isOffline).toBe(true);
    expect(result.users.length).toBeGreaterThanOrEqual(7);
    expect(result.users.some(u => u.name === 'Dr. Vibhuti Kori')).toBe(true);
    expect(result.users.some(u => u.name === 'Admin')).toBe(true);
  });

  it('fetchLoginUsers handles HTTP 500 server error and returns fallback list', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Database connection failed' }),
    });

    const result = await fetchLoginUsers(100);
    expect(result.isOffline).toBe(true);
    expect(result.users.length).toBeGreaterThanOrEqual(7);
    expect(result.users.some(u => u.name === 'Rohan')).toBe(true);
  });

  it('fetchLoginUsers merges live server users with standard fallbacks and caches them', async () => {
    const serverUser = { id: 'srv-1', name: 'Dr. Neha Verma', department: 'Pediatrics', role: 'Doctor' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [serverUser] }),
    });

    const result = await fetchLoginUsers(1000);
    expect(result.isOffline).toBe(false);
    expect(result.users.some(u => u.name === 'Dr. Neha Verma')).toBe(true);
    expect(result.users.some(u => u.name === 'Dr. Vibhuti Kori')).toBe(true);

    // Verify localStorage cache was populated
    const cachedRaw = localStorage.getItem(CACHED_USERS_KEY);
    expect(cachedRaw).not.toBeNull();
    const parsed = JSON.parse(cachedRaw!);
    expect(parsed.some((u: any) => u.name === 'Dr. Neha Verma')).toBe(true);
  });

  it('fetchAdminUsers falls back to cached users when all remote endpoints fail', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Server unavailable'));

    const adminUsers = await fetchAdminUsers();
    expect(adminUsers.length).toBeGreaterThanOrEqual(7);
    expect(adminUsers.some(u => u.name === 'Admin')).toBe(true);
    expect(adminUsers.some(u => u.name === 'Dr. Vibhuti Kori')).toBe(true);
  });

  it('fetchDepartments falls back to STANDARD_DEPARTMENTS when remote endpoints fail', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Server unavailable'));

    const depts = await fetchDepartments();
    expect(depts.length).toBeGreaterThanOrEqual(8);
    const codes = depts.map(d => d.code);
    expect(codes).toContain('REC');
    expect(codes).toContain('MED');
    expect(codes).toContain('PHARM');
  });

  it('fetchLoginUsers handles 200 OK with empty users list by returning fallback users and isOffline: false', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });

    const result = await fetchLoginUsers(500);
    expect(result.isOffline).toBe(false);
    expect(result.users.length).toBeGreaterThanOrEqual(7);
    expect(result.users.some(u => u.name === 'Admin')).toBe(true);
    expect(result.users.some(u => u.name === 'Dr. Vibhuti Kori')).toBe(true);
  });

  it('getCachedUsers safely handles corrupted JSON in localStorage', () => {
    localStorage.setItem(CACHED_USERS_KEY, 'invalid-json{{{');
    const users = getCachedUsers();
    expect(users.length).toBeGreaterThanOrEqual(7);
    expect(users.some(u => u.name === 'Dr. Vibhuti Kori')).toBe(true);
  });

  it('STANDARD_DEPARTMENTS contains all essential clinic departments', () => {
    expect(STANDARD_DEPARTMENTS.length).toBeGreaterThanOrEqual(8);
    const names = STANDARD_DEPARTMENTS.map(d => d.name);
    expect(names).toContain('Reception');
    expect(names).toContain('Medical');
    expect(names).toContain('Medicine');
    expect(names).toContain('Education');
    expect(names).toContain('Service');
  });
});
