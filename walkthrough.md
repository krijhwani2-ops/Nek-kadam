# Nek Kadam - NGO Medical System

Here is the complete implementation for the Nek Kadam NGO Medical System. Since we encountered issues writing directly to your local file system, I've compiled the necessary code and steps below so you can easily copy and paste them into your project.

## 1. Supabase Database Schema

First, run this SQL in your Supabase SQL Editor to create the required tables and security policies:

```sql
-- Patients Table
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  card_number INTEGER UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medicines Table
CREATE TABLE medicines (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- Visits Table
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Medicine Logs Table
CREATE TABLE medicine_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
  medicine_code TEXT REFERENCES medicines(code) ON DELETE CASCADE
);

-- Insert some dummy medicines for testing
INSERT INTO medicines (code, name) VALUES
('A20', 'Arnica Montana'),
('C1', 'Calendula'),
('R3', 'Rhus Tox');

-- Create a function to get the next auto-incrementing card number starting from 6000
CREATE OR REPLACE FUNCTION get_next_card_number()
RETURNS INTEGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(card_number), 5999) + 1 INTO next_num FROM patients;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- Set up Row Level Security (RLS)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated/anon users (Update to stricter policies later)
CREATE POLICY "Allow all on patients" ON patients FOR ALL USING (true);
CREATE POLICY "Allow all on medicines" ON medicines FOR ALL USING (true);
CREATE POLICY "Allow all on visits" ON visits FOR ALL USING (true);
CREATE POLICY "Allow all on medicine_logs" ON medicine_logs FOR ALL USING (true);
```

## 2. Environment Variables

Create a `.env` file in the root of your project:
```env
VITE_SUPABASE_URL=https://quzmtmvymlrwprewszkr.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_lavnB4en1LK8CEIm3rSVdg_KsoNcNyi
```

## 3. Project Files

You can create a Vite app by running `npx create-vite@latest . --template react-ts` when Node.js is installed. Then install the dependencies:
```bash
npm install @supabase/supabase-js lucide-react react-router-dom tailwind-merge clsx
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### `src/lib/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### `src/lib/utils.ts`
Utility to parse the medicine codes (e.g. "A20 + C1 + R3").
```typescript
import { supabase } from './supabase';

export async function parseMedicines(input: string) {
  if (!input) return [];
  
  // Split by '+' or ',' and trim
  const codes = input.split(/[+,]/).map(c => c.trim().toUpperCase()).filter(Boolean);
  
  if (codes.length === 0) return [];

  // Fetch from Supabase
  const { data, error } = await supabase
    .from('medicines')
    .select('*')
    .in('code', codes);

  if (error) {
    console.error("Error fetching medicines:", error);
    return [];
  }

  // Map to format
  return codes.map(code => {
    const med = data.find(m => m.code.toUpperCase() === code);
    return {
      code,
      name: med ? med.name : 'Unknown Medicine',
      found: !!med
    };
  });
}
```

### `src/App.tsx`
```tsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Activity, Users, FilePlus } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import PatientsList from './pages/PatientsList';
import PatientProfile from './pages/PatientProfile';
import NewPatient from './pages/NewPatient';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
        {/* Sidebar */}
        <nav className="w-full md:w-64 bg-white border-r shadow-sm p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-8 text-emerald-600">
            <Activity size={32} />
            <h1 className="text-2xl font-bold">Nek Kadam</h1>
          </div>
          <Link to="/" className="flex items-center gap-3 p-3 rounded-lg hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 transition">
            <Activity size={20} /> Dashboard
          </Link>
          <Link to="/patients" className="flex items-center gap-3 p-3 rounded-lg hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 transition">
            <Users size={20} /> Patients
          </Link>
          <Link to="/patients/new" className="flex items-center gap-3 p-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-md">
            <FilePlus size={20} /> New Patient
          </Link>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients" element={<PatientsList />} />
            <Route path="/patients/new" element={<NewPatient />} />
            <Route path="/patients/:id" element={<PatientProfile />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
```

### `src/pages/NewPatient.tsx`
Handles creating a new patient with the auto-incrementing card number.
```tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function NewPatient() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nextCard, setNextCard] = useState<number | null>(null);

  useEffect(() => {
    async function fetchNextCard() {
      const { data, error } = await supabase.rpc('get_next_card_number');
      if (!error && data) setNextCard(data);
    }
    fetchNextCard();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    const address = formData.get('address') as string;

    if (!nextCard) {
      setError("Failed to fetch next card number. Please try again.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('patients')
      .insert([{ name, phone, address, card_number: nextCard }])
      .select()
      .single();

    setLoading(false);

    if (error) {
      setError(error.message);
    } else if (data) {
      navigate(`/patients/${data.id}`);
    }
  }

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Register New Patient</h2>
      {error && <div className="p-4 mb-6 bg-red-50 text-red-600 rounded-lg">{error}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Card Number (Auto-assigned)</label>
          <input type="text" disabled value={nextCard || 'Loading...'} className="w-full p-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 font-mono" />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input required name="name" type="text" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. John Doe" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input name="phone" type="tel" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. +91 9876543210" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <textarea name="address" rows={3} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Full address details..."></textarea>
        </div>

        <button disabled={loading || !nextCard} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50">
          {loading ? 'Registering...' : 'Register Patient'}
        </button>
      </form>
    </div>
  );
}
```

### `src/pages/PatientProfile.tsx` (With Medicine Parsing)
```tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { parseMedicines } from '../lib/utils';
import { User, MapPin, Phone, CreditCard, Plus, Clock } from 'lucide-react';

export default function PatientProfile() {
  const { id } = useParams();
  const [patient, setPatient] = useState<any>(null);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Visit State
  const [medInput, setMedInput] = useState('');
  const [parsedMeds, setParsedMeds] = useState<any[]>([]);
  const [addingVisit, setAddingVisit] = useState(false);

  useEffect(() => {
    fetchPatientData();
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (medInput) {
        const meds = await parseMedicines(medInput);
        setParsedMeds(meds);
      } else {
        setParsedMeds([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [medInput]);

  async function fetchPatientData() {
    const { data: patientData } = await supabase.from('patients').select('*').eq('id', id).single();
    
    // Fetch visits with medicine logs
    const { data: visitsData } = await supabase
      .from('visits')
      .select('*, medicine_logs(medicine_code, medicines(name))')
      .eq('patient_id', id)
      .order('date', { ascending: false });

    setPatient(patientData);
    setVisits(visitsData || []);
    setLoading(false);
  }

  async function handleAddVisit() {
    if (!parsedMeds.length) return;
    setAddingVisit(true);

    // 1. Create Visit
    const { data: visitData, error: visitError } = await supabase
      .from('visits')
      .insert([{ patient_id: id }])
      .select().single();

    if (visitData) {
      // 2. Add Medicines
      const logs = parsedMeds.filter(m => m.found).map(m => ({
        visit_id: visitData.id,
        medicine_code: m.code
      }));
      
      if (logs.length > 0) {
        await supabase.from('medicine_logs').insert(logs);
      }
    }

    setMedInput('');
    setParsedMeds([]);
    setAddingVisit(false);
    fetchPatientData(); // Refresh list
  }

  if (loading) return <div>Loading profile...</div>;
  if (!patient) return <div>Patient not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">{patient.name}</h2>
          <div className="space-y-2 text-gray-600">
            <div className="flex items-center gap-2"><CreditCard size={18} /> Card No: <span className="font-semibold text-emerald-600">{patient.card_number}</span></div>
            <div className="flex items-center gap-2"><Phone size={18} /> {patient.phone || 'N/A'}</div>
            <div className="flex items-center gap-2"><MapPin size={18} /> {patient.address || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Add Visit Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100 bg-emerald-50/30">
        <h3 className="text-xl font-bold mb-4 text-emerald-800">Add New Visit</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Prescribe Medicines (Format: A20 + C1 + R3)</label>
          <div className="flex gap-4">
            <input 
              value={medInput}
              onChange={(e) => setMedInput(e.target.value)}
              type="text" 
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none uppercase" 
              placeholder="Enter codes..." 
            />
            <button 
              onClick={handleAddVisit}
              disabled={addingVisit || !parsedMeds.length}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-6 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              <Plus size={20} /> {addingVisit ? 'Saving...' : 'Save Visit'}
            </button>
          </div>
          
          {/* Live Preview */}
          {parsedMeds.length > 0 && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-500 mb-2">Preview:</h4>
              <ul className="space-y-1">
                {parsedMeds.map((med, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-bold text-emerald-700 w-12">{med.code}</span> 
                    <span className="text-gray-400">→</span>
                    <span className={med.found ? "text-gray-800" : "text-red-500"}>
                      {med.name} {med.found ? '' : '(Not Found)'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Visit History Timeline */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-4">Visit History</h3>
        <div className="space-y-6">
          {visits.length === 0 ? (
            <p className="text-gray-500 italic">No previous visits recorded.</p>
          ) : (
            visits.map((visit) => (
              <div key={visit.id} className="flex gap-4 relative pl-4">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-emerald-200" />
                <div className="absolute left-[-4px] top-2 w-2 h-2 rounded-full bg-emerald-500" />
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <Clock size={16} /> 
                    {new Date(visit.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Medicines Prescribed:</h4>
                    {visit.medicine_logs && visit.medicine_logs.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {visit.medicine_logs.map((log: any, i: number) => (
                          <span key={i} className="px-3 py-1 bg-emerald-100 text-emerald-800 text-sm rounded-full font-medium shadow-sm">
                            {log.medicine_code} - {log.medicines?.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">No medicines recorded for this visit.</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

### Next Steps:
1. Copy the code into your Vite project structure.
2. Run the SQL script in your Supabase SQL editor.
3. Start the Vite server using `npm run dev` and navigate to the local URL.
