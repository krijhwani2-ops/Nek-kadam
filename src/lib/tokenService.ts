// ─── Nek Kadam: Token System Service ───
// All token operations go through here. Direct API calls to the server.
// No caching for tokens — always fresh data for queue accuracy.

import { apiFetch } from './session';

async function apiCall(path: string, options?: RequestInit): Promise<any> {
  try {
    const res = await apiFetch(path, {
      ...options,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || `Server Error: ${res.status}` };
    }
    return await res.json();
  } catch (e: any) {
    return { error: e.name === 'TimeoutError' ? 'Request timed out. Please try again.' : e.message || 'Network error' };
  }
}

// ─── Types ───
export interface Token {
  id: string;
  tokenNumber: number;
  dateKey: string;
  personId: string;
  personName: string | null;
  personCard: string | null;
  currentDepartmentId: string;
  departmentName?: string;
  departmentCode?: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED' | 'CANCELLED';
  priority: 'NORMAL' | 'URGENT';
  sourceDepartmentId: string;
  sequenceIndex: number;
  created_at: string;
  updated_at: string;
}

export interface DeptCounter {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  waiting: number;
  inProgress: number;
  done: number;
  skipped: number;
  nextToken: { tokenNumber: number; personName: string; personCard: string; priority: string } | null;
  currentToken: { tokenNumber: number; personName: string; personCard: string; priority: string } | null;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  isActive: number;
}

export interface TokenEvent {
  id: string;
  tokenId: string;
  userId: string | null;
  departmentId: string | null;
  event: string;
  metadata: string | null;
  timestamp: string;
}

export interface PatientResult {
  card_number: string;
  name: string;
  phone: string | null;
}

// ─── API Functions ───

export async function createToken(params: {
  personId: string;
  personName?: string;
  personCard?: string;
  priority?: 'NORMAL' | 'URGENT';
  userId?: string;
  departmentId?: string;
}): Promise<{ data?: Token; error?: string }> {
  return apiCall('/api/tokens/create', { method: 'POST', body: JSON.stringify(params) });
}

export async function startToken(params: {
  tokenId?: string;
  departmentId: string;
  userId?: string;
}): Promise<{ data?: Token; error?: string }> {
  return apiCall('/api/tokens/start', { method: 'POST', body: JSON.stringify(params) });
}

export async function moveToken(params: {
  tokenId: string;
  userId?: string;
}): Promise<{ data?: Token; error?: string; message?: string }> {
  return apiCall('/api/tokens/move', { method: 'POST', body: JSON.stringify(params) });
}

export async function skipToken(params: {
  tokenId: string;
  userId?: string;
}): Promise<{ data?: Token; error?: string }> {
  return apiCall('/api/tokens/skip', { method: 'POST', body: JSON.stringify(params) });
}

export async function requeueToken(params: {
  tokenId: string;
  userId?: string;
}): Promise<{ data?: Token; error?: string }> {
  return apiCall('/api/tokens/requeue', { method: 'POST', body: JSON.stringify(params) });
}

export async function cancelToken(params: {
  tokenId: string;
  userId?: string;
}): Promise<{ data?: Token; error?: string }> {
  return apiCall('/api/tokens/cancel', { method: 'POST', body: JSON.stringify(params) });
}

export async function setTokenPriority(params: {
  tokenId: string;
  priority: 'NORMAL' | 'URGENT';
  userId?: string;
}): Promise<{ data?: Token; error?: string }> {
  return apiCall('/api/tokens/priority', { method: 'POST', body: JSON.stringify(params) });
}

export async function fetchTokens(params?: {
  departmentId?: string;
  status?: string;
  dateKey?: string;
}): Promise<{ data: Token[]; error?: string }> {
  const query = new URLSearchParams();
  if (params?.departmentId) query.set('departmentId', params.departmentId);
  if (params?.status) query.set('status', params.status);
  if (params?.dateKey) query.set('dateKey', params.dateKey);
  return apiCall(`/api/tokens?${query.toString()}`);
}

export async function fetchTokenDashboard(): Promise<{ data: DeptCounter[]; totals: { totalToday: number; totalDone: number; dateKey: string }; error?: string }> {
  return apiCall('/api/tokens/dashboard');
}

export async function fetchTokenEvents(tokenId: string): Promise<{ data: TokenEvent[]; error?: string }> {
  return apiCall(`/api/tokens/${tokenId}/events`);
}

export async function fetchDepartments(): Promise<{ data: Department[]; error?: string }> {
  return apiCall('/api/departments');
}

export async function searchPatients(q: string): Promise<{ data: PatientResult[]; error?: string }> {
  return apiCall(`/api/patients/search?q=${encodeURIComponent(q)}`);
}
