-- Migration 003: Delta Sync Schema Upgrade
-- Adds updated_at columns, auto-updating triggers, and indexes to support incremental delta sync.

-- 1. Add updated_at columns if missing
ALTER TABLE visits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE prescription_groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE group_medicines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE departments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE education_students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE medicine_task_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE medicine_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE patients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Backfill NULL values with existing timestamps or current time
UPDATE attendance SET updated_at = NOW() WHERE updated_at IS NULL;
UPDATE visits SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
UPDATE prescription_groups SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
UPDATE group_medicines SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
UPDATE medicines SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
UPDATE departments SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
UPDATE batches SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
UPDATE education_students SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
UPDATE medicine_task_items SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
UPDATE medicine_tasks SET updated_at = COALESCE("updatedAt", "createdAt", NOW()) WHERE updated_at IS NULL;
UPDATE tokens SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
UPDATE patients SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
UPDATE users SET updated_at = COALESCE("updatedAt", created_at, NOW()) WHERE updated_at IS NULL;

-- 3. Universal trigger function to keep updated_at current on updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach trigger to all synchronizable tables
DO $$
DECLARE
  t text;
  sync_tables text[] := ARRAY[
    'patients', 'visits', 'prescription_groups', 'group_medicines',
    'medicines', 'tokens', 'departments', 'batches', 'education_students',
    'attendance', 'medicine_tasks', 'medicine_task_items', 'users'
  ];
BEGIN
  FOREACH t IN ARRAY sync_tables
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;', t, t);
      EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();', t, t);
    END IF;
  END LOOP;
END $$;

-- 5. Performance indexes for delta sync range queries (WHERE updated_at > last_sync_time)
CREATE INDEX IF NOT EXISTS idx_patients_updated_at ON patients(updated_at);
CREATE INDEX IF NOT EXISTS idx_visits_updated_at ON visits(updated_at);
CREATE INDEX IF NOT EXISTS idx_medicines_updated_at ON medicines(updated_at);
CREATE INDEX IF NOT EXISTS idx_tokens_updated_at ON tokens(updated_at);
CREATE INDEX IF NOT EXISTS idx_attendance_updated_at ON attendance(updated_at);
CREATE INDEX IF NOT EXISTS idx_medicine_tasks_updated_at ON medicine_tasks(updated_at);
