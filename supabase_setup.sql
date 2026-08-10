CREATE TABLE IF NOT EXISTS public.patients (
  card_number text PRIMARY KEY,
  id uuid UNIQUE DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  created_at timestamptz DEFAULT now()
);

-- 2. Create medicines table with inventory tracking
CREATE TABLE IF NOT EXISTS public.medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  stock_level integer DEFAULT 0,
  reorder_level integer DEFAULT 10,
  price numeric(10,2) DEFAULT 0.00,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL REFERENCES public.patients(card_number) ON DELETE CASCADE,
  doctor_name text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 4. Create medicine_logs junction table
CREATE TABLE IF NOT EXISTS public.medicine_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  medicine_code text NOT NULL,
  quantity integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- 5. Enable RLS on all tables
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_logs ENABLE ROW LEVEL SECURITY;

-- 6. Create basic policies (Allow all for anonymous/authenticated during dev)
DROP POLICY IF EXISTS "Enable all for anon" ON public.patients;
CREATE POLICY "Enable all for anon" ON public.patients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for anon" ON public.medicines;
CREATE POLICY "Enable all for anon" ON public.medicines FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for anon" ON public.visits;
CREATE POLICY "Enable all for anon" ON public.visits FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for anon" ON public.medicine_logs;
CREATE POLICY "Enable all for anon" ON public.medicine_logs FOR ALL USING (true) WITH CHECK (true);

-- 7. Automated Stock Update Trigger
CREATE OR REPLACE FUNCTION decrease_stock_on_visit()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.medicines
  SET stock_level = stock_level - NEW.quantity
  WHERE code = NEW.medicine_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_decrease_stock ON public.medicine_logs;
CREATE TRIGGER tr_decrease_stock
AFTER INSERT ON public.medicine_logs
FOR EACH ROW
EXECUTE FUNCTION decrease_stock_on_visit();

-- 8. Create indexes
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON public.visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_medicine_logs_visit_id ON public.medicine_logs(visit_id);
CREATE INDEX IF NOT EXISTS idx_medicines_code ON public.medicines(code);
CREATE INDEX IF NOT EXISTS idx_patients_card_number ON public.patients(card_number);

-- 9. Seed some data
INSERT INTO public.medicines (code, name, stock_level, reorder_level) VALUES 
('A1', 'Aconitum Napellus', 100, 10),
('A2', 'Allium Cepa', 150, 15),
('A3', 'Aloe Socotrina', 80, 10),
('B1', 'Belladonna', 120, 20),
('B2', 'Bryonia Alba', 90, 10),
('C1', 'Carbo Veg', 200, 25),
('R3', 'Rhus Tox', 75, 15),
('A13', 'Arsenicum Album', 60, 10),
('A20', 'Arnica Montana', 110, 15),
('G1', 'Gelsemium', 45, 10)
ON CONFLICT (code) DO NOTHING;
