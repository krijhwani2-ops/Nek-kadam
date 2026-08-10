// ─── Nek Kadam: Education & Attendance Service ───
import { getStoredSession } from './session';

const SERVER_PORT = 3001;

function getBaseUrl(): string {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `http://${window.location.hostname}:${SERVER_PORT}`;
  }
  
  const savedIp = typeof window !== 'undefined' ? localStorage.getItem('NEK_KADAM_SERVER_IP') : null;
  const ip = savedIp || '192.168.29.180';

  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')) {
    return `${window.location.protocol}//${window.location.hostname}:${SERVER_PORT}`;
  }
  return `http://${ip}:${SERVER_PORT}`;
}

async function apiCall(path: string, options?: RequestInit): Promise<any> {
  try {
    const session = await getStoredSession();
    const headers: any = { 
      'Content-Type': 'application/json', 
      ...(options?.headers || {}) 
    };
    if (session?.sessionId) headers['Authorization'] = `Bearer ${session.sessionId}`;

    const res = await fetch(`${getBaseUrl()}${path}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(5000),
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || `Server Error: ${res.status}` };
    }
    
    return await res.json();
  } catch (e: any) {
    console.error('API Call Error:', e);
    return { error: e.name === 'TimeoutError' ? 'Request timed out. Please try again.' : e.message || 'Network error' };
  }
}

// ─── Types ───
export interface Batch {
  id: string;
  name: string;
  timing: string;
  isActive: number;
}

export interface Student {
  educationStudentId: string;
  patientId: string;
  name: string;
  card_number: string;
  tag: string;
  todayStatus: 'PRESENT' | 'ABSENT' | 'LATE' | null;
}

export interface AttendanceRecord {
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  note?: string;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
}

// ─── API Functions ───

export async function fetchBatches(): Promise<{ data: Batch[]; error?: string }> {
  return apiCall('/api/education/batches');
}

export async function createBatch(params: { name: string; timing?: string }): Promise<{ success?: boolean; error?: string }> {
  return apiCall('/api/education/batches/create', { method: 'POST', body: JSON.stringify(params) });
}

export async function fetchBatchStudents(batchId: string, date?: string): Promise<{ data: Student[]; error?: string }> {
  const query = date ? `?date=${date}` : '';
  return apiCall(`/api/education/batches/${batchId}/students${query}`);
}

export async function markAttendanceBulk(params: {
  date?: string;
  records: AttendanceRecord[];
  userId?: string;
}): Promise<{ success?: boolean; error?: string }> {
  return apiCall('/api/education/attendance/bulk', { method: 'POST', body: JSON.stringify(params) });
}

export async function fetchAttendanceSummary(params?: {
  date?: string;
  batchId?: string;
}): Promise<{ data: AttendanceSummary; error?: string }> {
  const query = new URLSearchParams();
  if (params?.date) query.set('date', params.date);
  if (params?.batchId) query.set('batchId', params.batchId);
  return apiCall(`/api/education/attendance/summary?${query.toString()}`);
}

export async function enrollExistingStudent(patientId: string, batchId: string): Promise<{ success?: boolean; error?: string }> {
  return apiCall('/api/education/enroll-existing', { 
    method: 'POST', 
    body: JSON.stringify({ patientId, batchId }) 
  });
}

export async function createStudent(params: {
  name: string;
  adhar_no: string;
  phone: string;
  age: string;
  batchId: string;
}): Promise<{ success?: boolean; error?: string }> {
  return apiCall('/api/education/students/create', { method: 'POST', body: JSON.stringify(params) });
}

export async function removeStudent(studentId: string): Promise<{ success?: boolean; error?: string }> {
  return apiCall(`/api/education/students/${studentId}/remove`, { method: 'POST' });
}
