// Centralized Mock Test Fixtures for Nek Kadam OS Regression Test Suites

export interface MockPatient {
  id: string;
  card_number: string;
  name: string;
  phone: string | null;
  last_visit_date: string | null;
  created_at: string;
}

export interface MockTaskItem {
  id: string;
  taskId: string;
  medicineCode: string;
  medicineName: string;
  dosage?: string;
  duration?: string;
  instructions?: string;
}

export interface MockMedicineTask {
  id: string;
  visitId: string;
  patientId: string;
  patientName: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELIVERED';
  claimedBy?: string;
  completedBy?: string;
  deliveredBy?: string;
  claimedAt?: string;
  completedAt?: string;
  deliveredAt?: string;
  startedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items?: MockTaskItem[];
}

export interface MockToken {
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

export interface MockDeptCounter {
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

export interface MockDepartment {
  id: string;
  name: string;
  code: string;
  isActive: number;
}

export interface MockMedicine {
  code: string;
  name: string;
  stock_level?: number;
}

// ─── PATIENTS FIXTURES ───
export const mockPatients: MockPatient[] = [
  {
    id: 'p1',
    card_number: '1001',
    name: 'John Doe',
    phone: '9876543210',
    last_visit_date: '2026-08-01',
    created_at: '2026-08-01T10:00:00Z',
  },
  {
    id: 'p2',
    card_number: '1002',
    name: 'Jane Smith',
    phone: '9123456789',
    last_visit_date: '2026-08-02',
    created_at: '2026-08-02T10:00:00Z',
  },
  {
    id: 'p3',
    card_number: '1003',
    name: 'Alice Johnson',
    phone: '9988776655',
    last_visit_date: null,
    created_at: '2026-08-03T10:00:00Z',
  },
  {
    id: 'p4',
    card_number: 'TEMP-9999',
    name: 'Unknown Temporary Patient',
    phone: null,
    last_visit_date: null,
    created_at: '2026-08-04T10:00:00Z',
  },
];

// ─── QUEUE TASKS FIXTURES ───
export const mockQueueTasks: MockMedicineTask[] = [
  {
    id: 'task-1',
    visitId: 'v1',
    patientId: '1001',
    patientName: 'John Doe',
    status: 'PENDING',
    createdBy: 'Doctor A',
    createdAt: '2026-08-13T00:00:00Z',
    updatedAt: '2026-08-13T00:00:00Z',
    items: [
      {
        id: 'i1',
        taskId: 'task-1',
        medicineCode: 'A1',
        medicineName: 'Aconitum Napellus',
        dosage: 'BD',
        duration: '5 days',
      },
    ],
  },
  {
    id: 'task-2',
    visitId: 'v2',
    patientId: '1002',
    patientName: 'Jane Smith',
    status: 'IN_PROGRESS',
    claimedBy: 'Test Volunteer',
    claimedAt: '2026-08-13T00:05:00Z',
    startedAt: '2026-08-13T00:05:00Z',
    createdBy: 'Doctor B',
    createdAt: '2026-08-13T00:02:00Z',
    updatedAt: '2026-08-13T00:05:00Z',
    items: [
      {
        id: 'i2',
        taskId: 'task-2',
        medicineCode: 'B12',
        medicineName: 'Belladonna',
        dosage: 'TDS',
        duration: '3 days',
      },
    ],
  },
  {
    id: 'task-3',
    visitId: 'v3',
    patientId: '1003',
    patientName: 'Alice Johnson',
    status: 'READY',
    completedBy: 'Test Volunteer',
    completedAt: '2026-08-13T00:10:00Z',
    createdBy: 'Doctor A',
    createdAt: '2026-08-13T00:01:00Z',
    updatedAt: '2026-08-13T00:10:00Z',
    items: [
      {
        id: 'i3',
        taskId: 'task-3',
        medicineCode: 'C3',
        medicineName: 'Chamomilla',
      },
    ],
  },
];

// ─── TOKEN SYSTEM FIXTURES ───
export const mockDepartments: MockDepartment[] = [
  { id: 'dept-rec', name: 'Reception', code: 'REC', isActive: 1 },
  { id: 'dept-med', name: 'Medical', code: 'MED', isActive: 1 },
  { id: 'dept-medi', name: 'Medicine Room', code: 'MEDI', isActive: 1 },
];

export const mockTokens: MockToken[] = [
  {
    id: 'tok-1',
    tokenNumber: 1,
    dateKey: '2026-08-13',
    personId: 'p1',
    personName: 'John Doe',
    personCard: '1001',
    currentDepartmentId: 'dept-rec',
    departmentName: 'Reception',
    departmentCode: 'REC',
    status: 'WAITING',
    priority: 'NORMAL',
    sourceDepartmentId: 'dept-rec',
    sequenceIndex: 1,
    created_at: '2026-08-13T00:00:00Z',
    updated_at: '2026-08-13T00:00:00Z',
  },
  {
    id: 'tok-2',
    tokenNumber: 2,
    dateKey: '2026-08-13',
    personId: 'p2',
    personName: 'Jane Smith',
    personCard: '1002',
    currentDepartmentId: 'dept-med',
    departmentName: 'Medical',
    departmentCode: 'MED',
    status: 'IN_PROGRESS',
    priority: 'URGENT',
    sourceDepartmentId: 'dept-rec',
    sequenceIndex: 2,
    created_at: '2026-08-13T00:01:00Z',
    updated_at: '2026-08-13T00:05:00Z',
  },
  {
    id: 'tok-3',
    tokenNumber: 3,
    dateKey: '2026-08-13',
    personId: 'p3',
    personName: 'Alice Johnson',
    personCard: '1003',
    currentDepartmentId: 'dept-med',
    departmentName: 'Medical',
    departmentCode: 'MED',
    status: 'DONE',
    priority: 'NORMAL',
    sourceDepartmentId: 'dept-rec',
    sequenceIndex: 3,
    created_at: '2026-08-13T00:02:00Z',
    updated_at: '2026-08-13T00:15:00Z',
  },
  {
    id: 'tok-4',
    tokenNumber: 4,
    dateKey: '2026-08-13',
    personId: 'p4',
    personName: 'Unknown Temporary Patient',
    personCard: 'TEMP-9999',
    currentDepartmentId: 'dept-med',
    departmentName: 'Medical',
    departmentCode: 'MED',
    status: 'SKIPPED',
    priority: 'NORMAL',
    sourceDepartmentId: 'dept-rec',
    sequenceIndex: 4,
    created_at: '2026-08-13T00:03:00Z',
    updated_at: '2026-08-13T00:10:00Z',
  },
  {
    id: 'tok-5',
    tokenNumber: 5,
    dateKey: '2026-08-13',
    personId: 'p5',
    personName: 'Bob Vance',
    personCard: '1005',
    currentDepartmentId: 'dept-rec',
    departmentName: 'Reception',
    departmentCode: 'REC',
    status: 'CANCELLED',
    priority: 'NORMAL',
    sourceDepartmentId: 'dept-rec',
    sequenceIndex: 5,
    created_at: '2026-08-13T00:04:00Z',
    updated_at: '2026-08-13T00:06:00Z',
  },
];

export const mockDeptCounters: MockDeptCounter[] = [
  {
    departmentId: 'dept-rec',
    departmentName: 'Reception',
    departmentCode: 'REC',
    waiting: 1,
    inProgress: 0,
    done: 0,
    skipped: 0,
    nextToken: { tokenNumber: 1, personName: 'John Doe', personCard: '1001', priority: 'NORMAL' },
    currentToken: null,
  },
  {
    departmentId: 'dept-med',
    departmentName: 'Medical',
    departmentCode: 'MED',
    waiting: 0,
    inProgress: 1,
    done: 1,
    skipped: 1,
    nextToken: null,
    currentToken: { tokenNumber: 2, personName: 'Jane Smith', personCard: '1002', priority: 'URGENT' },
  },
  {
    departmentId: 'dept-medi',
    departmentName: 'Medicine Room',
    departmentCode: 'MEDI',
    waiting: 0,
    inProgress: 0,
    done: 0,
    skipped: 0,
    nextToken: null,
    currentToken: null,
  },
];

// ─── MEDICINE FIXTURES ───
export const mockMedicines: MockMedicine[] = [
  { code: 'A1', name: 'Aconitum Napellus', stock_level: 50 },
  { code: 'B12', name: 'Belladonna', stock_level: 30 },
  { code: 'C3', name: 'Chamomilla', stock_level: 25 },
];
