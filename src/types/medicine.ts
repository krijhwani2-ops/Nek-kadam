export interface Medicine {
  code: string;
  name: string;
  stock_level?: number;
  reorder_level?: number;
}

export interface TaskItem {
  id: string;
  taskId: string;
  medicineCode: string;
  medicineName: string;
  dosage?: string;
  duration?: string;
  instructions?: string;
}

export interface MedicineTask {
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
  items?: TaskItem[];
}
