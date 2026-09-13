-- Migration 004: Patient Biometrics Schema for Face ID Sync
CREATE TABLE IF NOT EXISTS patient_biometrics (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  card_number TEXT NOT NULL,
  patient_name TEXT,
  embedding_vector TEXT NOT NULL,
  quality_score NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biometrics_patient_id ON patient_biometrics(patient_id);
CREATE INDEX IF NOT EXISTS idx_biometrics_card_number ON patient_biometrics(card_number);
CREATE INDEX IF NOT EXISTS idx_biometrics_updated_at ON patient_biometrics(updated_at);
