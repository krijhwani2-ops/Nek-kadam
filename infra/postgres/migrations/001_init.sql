-- 001_init.sql: Complete PostgreSQL Schema for Nek Kadam

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  passcode TEXT,
  role TEXT NOT NULL DEFAULT 'Volunteer',
  "departmentId" TEXT,
  "deviceId" TEXT,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  "user_id" TEXT,
  "userId" TEXT,
  "departmentId" TEXT,
  action TEXT NOT NULL,
  details TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  identifier TEXT,
  name TEXT,
  age TEXT,
  gender TEXT,
  phone TEXT,
  city TEXT,
  village TEXT,
  "adhar_no" TEXT,
  photo TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  category TEXT,
  unit TEXT,
  stock INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  price NUMERIC(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  "patientId" TEXT,
  patient_id TEXT,
  date TEXT,
  "doctorName" TEXT,
  symptoms TEXT,
  diagnosis TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescription_groups (
  id TEXT PRIMARY KEY,
  "visitId" TEXT,
  "patientId" TEXT,
  "groupName" TEXT,
  date TEXT,
  doctor TEXT,
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_medicines (
  id SERIAL PRIMARY KEY,
  "groupId" TEXT,
  "medicineId" TEXT,
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  instructions TEXT,
  qty INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  "tokenNumber" INTEGER,
  "patientId" TEXT,
  "patientName" TEXT,
  department TEXT,
  status TEXT DEFAULT 'WAITING',
  date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS education_students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "patientId" TEXT,
  "batchId" TEXT,
  "isActive" BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  "studentId" TEXT,
  date TEXT,
  status TEXT,
  "markedBy" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dosage_frequency (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicine_logs (
  id TEXT PRIMARY KEY,
  "visitId" TEXT,
  "medicineId" TEXT,
  qty INTEGER DEFAULT 1,
  action TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  "medicineId" TEXT,
  quantity INTEGER DEFAULT 0,
  batch_number TEXT,
  expiry_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_events (
  id TEXT PRIMARY KEY,
  "tokenId" TEXT,
  "userId" TEXT,
  "departmentId" TEXT,
  event_type TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  "senderId" TEXT NOT NULL,
  "senderName" TEXT NOT NULL,
  "senderDepartment" TEXT NOT NULL,
  "recipientId" TEXT,
  message TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  "fileName" TEXT,
  "fileData" TEXT
);

CREATE TABLE IF NOT EXISTS user_presence (
  id TEXT PRIMARY KEY,
  "userId" TEXT UNIQUE NOT NULL,
  "userName" TEXT NOT NULL,
  department TEXT NOT NULL,
  status TEXT NOT NULL,
  "currentScreen" TEXT,
  "currentTaskId" TEXT,
  "currentPatientName" TEXT,
  "deviceId" TEXT,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
