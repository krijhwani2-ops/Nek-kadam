import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/db';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, HeartPulse, Clock, Droplets, User2 } from 'lucide-react';

interface PrescribedMed {
  code: string;
  name: string;
  quantity: number;
}

interface MedGroup {
  power: string;
  dosage: string;
  meds: PrescribedMed[];
}

export default function NewPatient() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Medical History
  const [bloodGroup, setBloodGroup] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');

  // Visit Data
  const [doctorName, setDoctorName] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [visitNotes, setVisitNotes] = useState('');
  const [medicineGroups, setMedicineGroups] = useState<MedGroup[]>([{ power: '', dosage: 'BD', meds: [] }]);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [dosages, setDosages] = useState<any[]>([]);

  const [currentCode, setCurrentCode] = useState('');
  const [currentName, setCurrentName] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [isNewMedicine, setIsNewMedicine] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Medicine Search Logic
  useEffect(() => {
    fetchDosages();
    
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchDosages() {
    const { data } = await db.from('dosage_frequency').select('*');
    if (data && data.length > 0) setDosages(data);
    else setDosages([
      { code: 'OD', meaning: 'Once a day' },
      { code: 'BD', meaning: 'Twice a day' },
      { code: 'TDS', meaning: 'Thrice a day' },
      { code: 'HS', meaning: 'Bed time' },
      { code: 'SD', 'meaning': 'Single dose' }
    ]);
  }

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (currentCode.trim()) {
        const { data } = await db.from('medicines').select('*').eq('code', currentCode.trim().toUpperCase()).maybeSingle();
        if (data) {
          setCurrentName(data.name);
          setIsNewMedicine(false);
        } else {
          setCurrentName('');
          setIsNewMedicine(true);
        }
      } else {
        setCurrentName('');
        setIsNewMedicine(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [currentCode]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim() || searchQuery.includes('+')) {
        setSearchResults([]);
        return;
      }
      const q = searchQuery.toUpperCase().trim();
      const { data } = await db.from('medicines')
        .select('code, name')
        .or(`code.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(10);
      setSearchResults(data || []);
      setShowResults(true);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectMedicine = (med: any) => {
    setCurrentCode(med.code);
    setCurrentName(med.name);
    setIsNewMedicine(false);
    setShowResults(false);
    setSearchQuery('');
  };

  const handleAddMedicine = async () => {
    const code = currentCode.trim().toUpperCase();
    const name = currentName.trim();
    if (!code || !name) return;

    if (isNewMedicine) {
      const { error } = await db.from('medicines').insert([{ code, name }]);
      if (error) {
        alert("Failed to add new medicine: " + error.message);
        return;
      }
    }

    const updatedGroups = [...medicineGroups];
    if (!updatedGroups[activeGroupIndex].meds.find(m => m.code === code)) {
      updatedGroups[activeGroupIndex].meds.push({ code, name, quantity: currentQuantity });
      setMedicineGroups(updatedGroups);
    }
    
    setCurrentCode('');
    setCurrentName('');
    setCurrentQuantity(1);
    setIsNewMedicine(false);
  };

  const removeMedicine = (groupIndex: number, code: string) => {
    const updatedGroups = [...medicineGroups];
    updatedGroups[groupIndex].meds = updatedGroups[groupIndex].meds.filter(m => m.code !== code);
    setMedicineGroups(updatedGroups);
  };

  const addGroup = () => {
    setMedicineGroups([...medicineGroups, { power: '', dosage: 'BD', meds: [] }]);
    setActiveGroupIndex(medicineGroups.length);
  };

  const removeGroup = (index: number) => {
    if (medicineGroups.length === 1) return;
    const updated = medicineGroups.filter((_, i) => i !== index);
    setMedicineGroups(updated);
    setActiveGroupIndex(Math.max(0, index - 1));
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string || '').trim();
    const phone = (formData.get('phone') as string || '').trim();
    const address = (formData.get('address') as string || '').trim();
    const card_number = (formData.get('card_number') as string || '').trim();

    if (!card_number) {
      setError("Card Number is required.");
      setLoading(false);
      return;
    }
    if (!name) {
      setError("Patient name is required.");
      setLoading(false);
      return;
    }

    try {
      console.log('[NEW PATIENT] Starting registration for:', card_number);
      
      // 1. Create Patient
      const patientData = { 
        id: 'PAT-' + card_number, // Predictable local ID
        name, 
        phone, 
        address, 
        card_number,
        blood_group: bloodGroup || null,
        age: age ? parseInt(age, 10) : null,
        gender: gender || null,
        created_at: new Date().toISOString()
      };

      const { error: pError } = await db.from('patients').insert(patientData);

      if (pError) {
        console.error('[NEW PATIENT] Patient save error:', pError);
        if (pError.code === '23505' || pError.message?.includes('unique')) setError('A patient with this Card Number already exists.');
        else setError(pError.message || 'Failed to save patient.');
        setLoading(false);
        return;
      }

      // 2. Create Visit (optional but recommended if data exists)
      const hasMeds = medicineGroups.some(g => g.meds.length > 0);
      if (doctorName || hasMeds || visitNotes.trim()) {
        try {
          const visitId = 'VISIT-' + Date.now();
          console.log('[NEW PATIENT] Creating initial visit:', visitId);
          
          const { error: vError } = await db.from('visits').insert({ 
            id: visitId,
            patient_id: card_number, 
            date: new Date(visitDate).toISOString(), 
            doctor_name: doctorName || 'NGO Doctor',
            notes: visitNotes.trim() || null
          });

          if (vError) throw vError;

          if (hasMeds) {
            for (let i = 0; i < medicineGroups.length; i++) {
              const group = medicineGroups[i];
              if (group.meds.length === 0) continue;
              
              const groupId = `GRP-${visitId}-${i}`;
              await db.from('prescription_groups').insert({
                id: groupId,
                visit_id: visitId,
                power: group.power || null,
                dosage_code: group.dosage || 'BD'
              });
              
              const mappings = group.meds.map(m => ({ 
                id: `MAP-${groupId}-${m.code}`,
                group_id: groupId, 
                medicine_code: m.code 
              }));
              await db.from('group_medicines').insert(mappings);
            }
          }
        } catch (visitErr: any) {
          console.warn('[NEW PATIENT] Visit log failed but patient saved:', visitErr);
          setError(visitErr?.message || 'Failed to create visit.');
          setLoading(false);
          return;
        }
      }

      setLoading(false);
      navigate(`/patients/${card_number}`);
    } catch (err: unknown) {
      console.error('[NEW PATIENT] Critical failure:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError('Registration failed: ' + msg);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-8 h-1 bg-gradient-secondary rounded-full" />
            <p className="text-emerald-600 font-black text-[10px] uppercase tracking-[0.3em]">Patient Enrollment</p>
          </div>
          <h2 className="text-2xl md:text-3xl font-[900] text-emerald-900 tracking-tight">
            Register New
          </h2>
        </div>
        <Link to="/patients" className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-600 font-bold transition-colors text-sm">
          <ArrowLeft size={16} />
          <span>Back to Patients</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-12">
          {error && (
            <div className="p-3.5 mb-6 bg-red-50 border border-red-100 text-red-700 rounded-2xl font-bold flex items-center gap-2 animate-fade-in text-xs">
              <div className="p-1.5 bg-red-100 rounded-lg text-red-500">
                <HeartPulse size={16} />
              </div>
              {error}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Step 1: Identity */}
          <div className="lg:col-span-5 space-y-4">
            <div className="glass-card dark:border-slate-800 p-5 rounded-2xl space-y-5 border-t-4 border-t-emerald-500">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 rounded-xl flex items-center justify-center font-black text-lg">1</div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">Personal Profile</h3>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Identity & Contact Details</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100/50 dark:border-slate-800/80 shadow-inner group-focus-within:border-emerald-200 transition-colors">
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1">Card Assignment</label>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500 font-black text-xl tracking-tighter">ID-</span>
                    <input name="card_number" type="text" required placeholder="1001" className="w-full bg-transparent text-slate-800 dark:text-slate-100 font-[900] text-2xl outline-none placeholder-slate-200 dark:placeholder-slate-800" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] ml-2">Patient Full Name</label>
                  <input required name="name" type="text" className="input-field dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 !px-4 !py-3 text-sm rounded-xl" placeholder="Enter full legal name..." />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] ml-2">Contact Number</label>
                  <input name="phone" type="tel" className="input-field dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 !px-4 !py-3 text-sm rounded-xl" placeholder="+91 00000 00000" />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] ml-2">Residential Address</label>
                  <textarea name="address" rows={2} className="w-full px-4 py-3 bg-white/60 dark:bg-slate-900/60 border-2 border-emerald-50 dark:border-slate-800 rounded-xl outline-none font-medium text-slate-800 dark:text-slate-100 text-sm shadow-sm transition-all duration-300 backdrop-blur-sm focus:border-emerald-400 focus:bg-white dark:focus:bg-slate-900 resize-none" placeholder="Primary address details..."></textarea>
                </div>
              </div>
            </div>

          {/* Step 1.5: Medical History */}
          <div className="glass-card dark:border-slate-800 p-5 rounded-2xl space-y-4 border-t-4 border-t-red-400 mt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 rounded-xl flex items-center justify-center">
                <HeartPulse size={20} />
              </div>
              <div>
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">Medical History</h3>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Optional — can be filled later</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] ml-2 flex items-center gap-1"><Droplets size={11} className="text-red-400"/>Blood Group</label>
                <select value={bloodGroup} onChange={e => setBloodGroup(e.target.value)} className="w-full px-3 py-2 bg-white/60 dark:bg-slate-900/60 border border-red-50 dark:border-slate-800 rounded-xl outline-none font-bold text-slate-800 dark:text-slate-100 focus:border-red-300 focus:bg-white dark:focus:bg-slate-900 transition-all text-xs">
                  <option value="">Unknown</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] ml-2 flex items-center gap-1"><User2 size={11} className="text-blue-400"/>Age</label>
                <input type="number" min="0" max="120" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 35" className="w-full px-3 py-2 bg-white/60 dark:bg-slate-900/60 border border-blue-50 dark:border-slate-800 rounded-xl outline-none font-bold text-slate-800 dark:text-slate-100 focus:border-blue-300 focus:bg-white dark:focus:bg-slate-900 transition-all text-xs" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] ml-2">Gender</label>
              <div className="flex gap-2">
                {['Male','Female','Other'].map(g => (
                  <button key={g} type="button" onClick={() => setGender(gender === g ? '' : g)}
                    className={`flex-1 py-2 rounded-xl font-black text-xs border transition-all ${
                      gender === g ? 'bg-blue-500 text-white border-blue-500 shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-blue-300'
                    }`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

          {/* Step 2: Clinical */}
          <div className="lg:col-span-7 space-y-4">
            <div className="glass-card dark:border-slate-800 p-5 rounded-2xl space-y-4 border-t-4 border-t-orange-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center font-black text-lg">2</div>
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">Initial Visit Logs</h3>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Medical Prescription</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <Clock size={13} className="text-slate-400" />
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] ml-2">Visit Date</label>
                    <input 
                      type="date"
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white/60 dark:bg-slate-900/60 border border-emerald-50 dark:border-slate-800 rounded-xl outline-none font-bold text-slate-800 dark:text-slate-100 shadow-sm transition-all duration-300 backdrop-blur-sm focus:border-emerald-400 focus:bg-white dark:focus:bg-slate-900 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] ml-2">Attending Practitioner</label>
                    <select 
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      className="w-full px-4 py-3 bg-white/60 dark:bg-slate-900/60 border border-emerald-50 dark:border-slate-800 rounded-xl outline-none font-bold text-slate-800 dark:text-slate-100 shadow-sm transition-all duration-300 backdrop-blur-sm focus:border-emerald-400 focus:bg-white dark:focus:bg-slate-900 appearance-none cursor-pointer text-sm"
                    >
                      <option value="">(No specific doctor)</option>
                      <option value="Dr. Vibhuti Kori">Dr. Vibhuti Kori</option>
                      <option value="Dr. Rajdeep Sonkar">Dr. Rajdeep Sonkar</option>
                      <option value="Dr. Sameer Khan">Dr. Sameer Khan</option>
                      <option value="Dr. Ananya Pandey">Dr. Ananya Pandey</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] ml-2">Visit Notes / Observations</label>
                  <textarea
                    value={visitNotes}
                    onChange={(e) => setVisitNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-white/60 dark:bg-slate-900/60 border border-emerald-50 dark:border-slate-800 rounded-xl outline-none font-medium text-slate-800 dark:text-slate-100 text-sm shadow-sm transition-all duration-300 backdrop-blur-sm focus:border-emerald-400 focus:bg-white dark:focus:bg-slate-900 resize-none"
                    placeholder="Any observations or notes..."
                  ></textarea>
                </div>

                <div className="p-3.5 bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border-2 border-dashed border-slate-200/60 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {medicineGroups.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveGroupIndex(idx)}
                          className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-1.5 ${activeGroupIndex === idx ? 'bg-gradient-primary text-white shadow-lg shadow-emerald-200 scale-105' : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-800 hover:text-slate-600 dark:hover:text-slate-350'}`}
                        >
                          Combination {idx + 1}
                          {medicineGroups.length > 1 && (
                            <span
                              onClick={(e) => { e.stopPropagation(); removeGroup(idx); }}
                              className="ml-1 w-4 h-4 rounded-full bg-red-400/80 text-white flex items-center justify-center text-[8px] font-black hover:bg-red-600 transition-colors cursor-pointer"
                            >✕</span>
                          )}
                        </button>
                      ))}
                    </div>
                    <button 
                      type="button"
                      onClick={addGroup}
                      className="p-2 bg-white dark:bg-slate-800 text-emerald-500 dark:text-emerald-400 rounded-xl hover:bg-emerald-500 dark:hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 dark:border-emerald-900/50 shadow-sm"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="flex flex-col md:flex-row items-center gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1.5 shadow-sm relative" ref={searchRef}>
                    <select value={medicineGroups[activeGroupIndex].power} onChange={e => {
                          const updated = [...medicineGroups];
                          updated[activeGroupIndex].power = e.target.value;
                          setMedicineGroups(updated);
                    }} className="w-full md:w-24 px-2 py-2 bg-transparent outline-none font-black text-slate-700 dark:text-slate-300 text-xs">
                      <option value="">Power</option>
                      <option value="Q">Q</option>
                      <option value="3X">3X</option>
                      <option value="6X">6X</option>
                      <option value="30C">30C</option>
                      <option value="200C">200C</option>
                      <option value="1M">1M</option>
                      <option value="10M">10M</option>
                    </select>
                    <div className="hidden md:block w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <select value={medicineGroups[activeGroupIndex].dosage} onChange={e => {
                          const updated = [...medicineGroups];
                          updated[activeGroupIndex].dosage = e.target.value;
                          setMedicineGroups(updated);
                    }} className="w-full md:w-32 px-2 py-2 bg-transparent outline-none font-black text-slate-700 dark:text-slate-300 text-xs">
                      {dosages.map(d => <option key={d.code} value={d.code}>{d.code}</option>)}
                    </select>
                    <div className="hidden md:block w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <input 
                      value={currentCode}
                      onChange={(e) => setCurrentCode(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddMedicine();
                        } else if (e.key === '+') {
                          e.preventDefault();
                          if (!currentCode.trim()) addGroup();
                          else handleAddMedicine();
                        }
                      }}
                      placeholder="CODE"
                      className="w-full md:w-20 px-2 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none uppercase font-black text-center text-xs text-slate-800 dark:text-slate-100"
                    />
                    <input 
                      value={currentName}
                      onChange={(e) => {
                        setCurrentName(e.target.value);
                        setSearchQuery(e.target.value);
                      }}
                      onFocus={() => setShowResults(true)}
                      readOnly={!isNewMedicine && !!currentCode.trim()}
                      placeholder={isNewMedicine ? "New med..." : "Search..."}
                      className={`flex-1 px-3 py-2 outline-none font-black text-sm rounded-xl ${(!isNewMedicine && currentCode.trim()) ? 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300' : 'bg-transparent text-slate-800 dark:text-slate-100'}`}
                    />

                    {showResults && searchResults.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                        {searchResults.map((res, i) => (
                          <button key={i} type="button" onClick={() => selectMedicine(res)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-left border-b border-slate-50 dark:border-slate-800 last:border-none">
                            <div>
                              <p className="font-black text-slate-800 dark:text-slate-100 text-sm">{res.name}</p>
                              <p className="text-[10px] font-black text-emerald-500 uppercase">{res.code}</p>
                            </div>
                            <Plus size={16} className="text-emerald-400" />
                          </button>
                        ))}
                      </div>
                    )}

                    <input type="number" min="1" value={currentQuantity} onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)} className="w-16 px-2 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none font-black text-center text-sm text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800" />
                    <button type="button" onClick={handleAddMedicine} disabled={!currentCode.trim() || !currentName.trim()} className="px-4 py-2 bg-emerald-600 text-white rounded-xl disabled:opacity-50 font-black flex items-center justify-center shrink-0">
                      <Plus size={20} strokeWidth={3} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Selected in Combination {activeGroupIndex + 1}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {medicineGroups[activeGroupIndex].meds.length > 0 ? (
                        medicineGroups[activeGroupIndex].meds.map(med => (
                          <div key={med.code} className="flex items-center justify-between bg-white dark:bg-slate-850 border border-emerald-100 dark:border-emerald-900/50 px-4 py-2.5 rounded-xl shadow-sm group">
                            <div className="flex items-center gap-3">
                              <span className="font-black text-emerald-600 text-sm uppercase">{med.code}</span>
                              <div>
                                 <p className="text-slate-800 dark:text-slate-100 text-xs font-black">{med.name}</p>
                                 <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[9px] font-black px-2 py-0.5 rounded-lg">x{med.quantity}</span>
                              </div>
                            </div>
                            <button type="button" onClick={() => removeMedicine(activeGroupIndex, med.code)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
                          <p className="text-xs text-slate-300 dark:text-slate-650 font-bold italic">No medicines added yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button 
              disabled={loading} 
              type="submit" 
              className="w-full btn-primary !py-3 text-base tracking-widest uppercase font-black"
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="spinner w-5 h-5 border-2" />
                  <span>Synchronizing...</span>
                </div>
              ) : (
                'Finalize Registration'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


