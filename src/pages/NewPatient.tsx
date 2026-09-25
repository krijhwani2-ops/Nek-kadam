import { useState, useEffect, useRef } from 'react';
import { db, cleanPatientId } from '../lib/db';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, HeartPulse, Clock, Droplets, User2, QrCode, ChevronDown, ChevronUp, Zap, Sparkles } from 'lucide-react';
import BarcodeScannerModal from '../components/BarcodeScannerModal';

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
  const [searchParams] = useSearchParams();

  // Core Form State
  const [cardNumber, setCardNumber] = useState(searchParams.get('card') || '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');

  // UI & Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPrescriptionOpen, setIsPrescriptionOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Input Refs for Fast Keyboard Navigation
  const cardInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const ageInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Visit / Prescription Data (Optional Section)
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

  // Auto-focus on mount
  useEffect(() => {
    if (cardNumber.trim()) {
      nameInputRef.current?.focus();
    } else {
      cardInputRef.current?.focus();
    }
  }, []);

  // Update card if searchParams change
  useEffect(() => {
    const cardFromUrl = searchParams.get('card');
    if (cardFromUrl) {
      setCardNumber(cleanPatientId(cardFromUrl));
      nameInputRef.current?.focus();
    }
  }, [searchParams]);

  // Medicine Search & Dosage Fetching Logic
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
    const nameToSave = currentName.trim();
    if (!code || !nameToSave) return;

    if (isNewMedicine) {
      const { error: medErr } = await db.from('medicines').insert([{ code, name: nameToSave }]);
      if (medErr) {
        alert("Failed to add new medicine: " + medErr.message);
        return;
      }
    }

    const updatedGroups = [...medicineGroups];
    if (!updatedGroups[activeGroupIndex].meds.find(m => m.code === code)) {
      updatedGroups[activeGroupIndex].meds.push({ code, name: nameToSave, quantity: currentQuantity });
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

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    const cleanCard = cleanPatientId(cardNumber).trim();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim();

    if (!cleanCard) {
      setError("Booklet Card Number is required. Enter or scan it above.");
      setLoading(false);
      cardInputRef.current?.focus();
      return;
    }
    if (!cleanName) {
      setError("Patient full name is required.");
      setLoading(false);
      nameInputRef.current?.focus();
      return;
    }

    try {
      console.log('[NEW PATIENT] Starting rapid registration for card:', cleanCard);
      
      // 1. Create Patient Record
      const patientData = { 
        id: 'PAT-' + cleanCard,
        name: cleanName, 
        phone: cleanPhone || '', 
        address: cleanAddress || '', 
        card_number: cleanCard,
        blood_group: null,
        age: age ? parseInt(age, 10) : null,
        gender: gender || null,
        created_at: new Date().toISOString()
      };

      const { error: pError } = await db.from('patients').insert(patientData);

      if (pError) {
        console.error('[NEW PATIENT] Patient save error:', pError);
        if (pError.code === '23505' || pError.message?.includes('unique')) {
          setError(`A patient with Card #${cleanCard} already exists.`);
        } else {
          setError(pError.message || 'Failed to save patient.');
        }
        setLoading(false);
        return;
      }

      // 2. Create Visit & Prescription (if doctorName is chosen OR prescription section was filled)
      const hasMeds = medicineGroups.some(g => g.meds.length > 0);
      if (doctorName || (isPrescriptionOpen && (hasMeds || visitNotes.trim()))) {
        try {
          const visitId = 'VISIT-' + Date.now();
          console.log('[NEW PATIENT] Creating initial visit:', visitId, 'Doctor:', doctorName);
          
          const { error: vError } = await db.from('visits').insert({ 
            id: visitId,
            patient_id: cleanCard, 
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
          setError(visitErr?.message || 'Patient created, but visit creation had an error.');
          setLoading(false);
          return;
        }
      }

      console.log('[NEW PATIENT] Rapid registration complete. Navigating to:', cleanCard);
      setLoading(false);
      navigate(`/patients/${cleanCard}`);
    } catch (err: unknown) {
      console.error('[NEW PATIENT] Critical failure:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError('Registration failed: ' + msg);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3 pb-8 pt-0.5">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-[0.25em]">Fast Registration</p>
          </div>
          <h2 className="text-xl md:text-2xl font-[900] text-emerald-950 dark:text-emerald-400 tracking-tight leading-tight">
            Register New Patient
          </h2>
        </div>
        <Link 
          to="/patients" 
          className="flex items-center gap-1.5 text-slate-500 hover:text-emerald-600 dark:text-slate-400 font-bold transition-colors text-xs py-1.5 px-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={15} />
          <span>Back</span>
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-xl font-bold flex items-center gap-2 animate-fade-in text-xs shadow-sm">
          <div className="p-1 bg-red-100 dark:bg-red-900/50 rounded-lg text-red-600 dark:text-red-400 shrink-0">
            <HeartPulse size={15} />
          </div>
          <span>{error}</span>
        </div>
      )}

      {/* Main High-Speed Compact Form Card */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-sm border-t-4 border-t-emerald-500 space-y-3">
          
          {/* Row 1: Manual Card Assignment & QR Scanner */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ml-1">
                Card Assignment (Manual Booklet #) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">Scan or type from physical OPD card</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-inner">
                <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm tracking-tight mr-1.5 select-none">ID-</span>
                <input 
                  ref={cardInputRef}
                  name="card_number" 
                  type="text" 
                  required 
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      nameInputRef.current?.focus();
                    }
                  }}
                  placeholder="e.g. 10024" 
                  className="w-full bg-transparent text-slate-900 dark:text-slate-100 font-[900] text-lg sm:text-xl outline-none placeholder-slate-400 dark:placeholder-slate-500 tracking-wide" 
                />
              </div>
              <button 
                type="button" 
                onClick={() => setIsScannerOpen(true)}
                className="h-[46px] px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5 active:scale-95 transition-all font-bold text-xs shadow-sm shrink-0"
                title="Scan Physical Card Barcode / QR"
              >
                <QrCode size={16} />
                <span>Scan</span>
              </button>
            </div>
          </div>

          {/* Row 2: Patient Full Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ml-1">
              Patient Full Name <span className="text-rose-500">*</span>
            </label>
            <input 
              ref={nameInputRef}
              name="name" 
              type="text" 
              required 
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  ageInputRef.current?.focus();
                }
              }}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-slate-900 dark:text-slate-100 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 placeholder-slate-400 transition-all shadow-sm" 
              placeholder="Enter patient full legal name..." 
            />
          </div>

          {/* Row 3: Attending Doctor (Left) + Gender (Center) + Age (Right) */}
          <div className="grid grid-cols-12 gap-2 pt-0.5">
            {/* Attending Doctor Segmented Control (5 cols) */}
            <div className="col-span-5 space-y-1">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ml-1 flex items-center gap-1">
                <User2 size={11} className="text-emerald-500" />
                Doctor
              </label>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 h-[38px]">
                {[
                  { key: 'Dr. Vibhuti Kori', label: 'Dr. Vibhuti' },
                  { key: 'Dr. Rajdeep Sonkar', label: 'Dr. Rajdeep' }
                ].map((doc) => (
                  <button
                    key={doc.key}
                    type="button"
                    onClick={() => setDoctorName(doctorName === doc.key ? '' : doc.key)}
                    className={`flex-1 py-1 text-[11px] font-black rounded-lg transition-all truncate px-1 ${
                      doctorName === doc.key
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {doc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Gender Segmented Pills (4 cols) */}
            <div className="col-span-4 space-y-1">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ml-1">
                Gender
              </label>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 h-[38px]">
                {[
                  { key: 'Male', label: 'M' },
                  { key: 'Female', label: 'F' },
                  { key: 'Other', label: 'O' }
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setGender(gender === item.key ? '' : item.key)}
                    className={`flex-1 py-1 text-xs font-black rounded-lg transition-all ${
                      gender === item.key
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Age Clean Input without Preset Suggestions (3 cols) */}
            <div className="col-span-3 space-y-1">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ml-1">
                Age (Yrs)
              </label>
              <input 
                ref={ageInputRef}
                name="age" 
                type="number" 
                min="0" 
                max="125" 
                value={age} 
                onChange={(e) => setAge(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    phoneInputRef.current?.focus();
                  }
                }}
                placeholder="Yrs" 
                className="w-full px-2 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl outline-none font-black text-center text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all h-[38px] shadow-sm placeholder-slate-400" 
              />
            </div>
          </div>

          {/* Row 4: Phone & Address (2 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ml-1">
                Contact Number (+91)
              </label>
              <input 
                ref={phoneInputRef}
                name="phone" 
                type="tel" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addressInputRef.current?.focus();
                  }
                }}
                className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 placeholder-slate-400 transition-all shadow-sm h-[38px]" 
                placeholder="+91 10-digit number..." 
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ml-1">
                Residential Area / Colony
              </label>
              <input 
                ref={addressInputRef}
                name="address" 
                type="text" 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 placeholder-slate-400 transition-all shadow-sm h-[38px]" 
                placeholder="Village / Sector / Colony..." 
              />
            </div>
          </div>

          {/* Row 5: Collapsible Doctor Prescription Section (Optional) */}
          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <button 
              type="button" 
              onClick={() => setIsPrescriptionOpen(!isPrescriptionOpen)} 
              className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-left flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs">
                  {isPrescriptionOpen ? '−' : '+'}
                </span>
                <span>Add Doctor Prescription / Visit Observations</span>
                <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                  Optional
                </span>
              </span>
              <span className="text-slate-400">
                {isPrescriptionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </span>
            </button>

            {isPrescriptionOpen && (
              <div className="mt-3 p-3.5 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Attending Doctor</label>
                    <select 
                      value={doctorName} 
                      onChange={(e) => setDoctorName(e.target.value)} 
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs text-slate-800 dark:text-slate-100"
                    >
                      <option value="">(No specific doctor)</option>
                      <option value="Dr. Vibhuti Kori">Dr. Vibhuti Kori</option>
                      <option value="Dr. Rajdeep Sonkar">Dr. Rajdeep Sonkar</option>
                      <option value="Dr. Sameer Khan">Dr. Sameer Khan</option>
                      <option value="Dr. Ananya Pandey">Dr. Ananya Pandey</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Visit Date</label>
                    <input 
                      type="date" 
                      value={visitDate} 
                      onChange={(e) => setVisitDate(e.target.value)} 
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Clinical Observations / Notes</label>
                  <input 
                    type="text" 
                    value={visitNotes} 
                    onChange={(e) => setVisitNotes(e.target.value)} 
                    placeholder="Chief complaints, symptoms, observations..." 
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Prescription Groups Builder */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide flex-1">
                      {medicineGroups.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveGroupIndex(idx)}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 ${
                            activeGroupIndex === idx 
                              ? 'bg-emerald-600 text-white shadow-sm' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          Comb {idx + 1}
                          {medicineGroups.length > 1 && (
                            <span
                              onClick={(e) => { e.stopPropagation(); removeGroup(idx); }}
                              className="ml-1 w-4 h-4 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center text-[9px] font-black cursor-pointer"
                              title="Remove Combination"
                            >✕</span>
                          )}
                        </button>
                      ))}
                    </div>
                    <button 
                      type="button"
                      onClick={addGroup}
                      className="min-w-[34px] min-h-[34px] flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-600 hover:text-white transition-all border border-emerald-200 dark:border-emerald-800 text-xs font-black shrink-0"
                      title="Add Combination"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 dark:bg-slate-850 p-2 rounded-xl border border-slate-200 dark:border-slate-750 relative" ref={searchRef}>
                    <div className="grid grid-cols-2 sm:flex items-center gap-1.5 shrink-0">
                      <select 
                        value={medicineGroups[activeGroupIndex].power} 
                        onChange={e => {
                          const updated = [...medicineGroups];
                          updated[activeGroupIndex].power = e.target.value;
                          setMedicineGroups(updated);
                        }} 
                        className="px-2 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-800 dark:text-slate-100 outline-none"
                      >
                        <option value="">Power</option>
                        <option value="Q">Q</option>
                        <option value="3X">3X</option>
                        <option value="6X">6X</option>
                        <option value="30C">30C</option>
                        <option value="200C">200C</option>
                        <option value="1M">1M</option>
                        <option value="10M">10M</option>
                      </select>
                      <select 
                        value={medicineGroups[activeGroupIndex].dosage} 
                        onChange={e => {
                          const updated = [...medicineGroups];
                          updated[activeGroupIndex].dosage = e.target.value;
                          setMedicineGroups(updated);
                        }} 
                        className="px-2 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-800 dark:text-slate-100 outline-none"
                      >
                        {dosages.map(d => <option key={d.code} value={d.code}>{d.code}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <input 
                        value={currentCode}
                        onChange={(e) => setCurrentCode(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddMedicine();
                          }
                        }}
                        placeholder="CODE"
                        className="w-16 px-2 py-1.5 bg-white dark:bg-slate-900 rounded-lg outline-none uppercase font-black text-center text-xs text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                      <input 
                        value={currentName}
                        onChange={(e) => {
                          setCurrentName(e.target.value);
                          setSearchQuery(e.target.value);
                        }}
                        onFocus={() => setShowResults(true)}
                        placeholder={isNewMedicine ? "New med..." : "Search medicine..."}
                        className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 rounded-lg outline-none font-bold text-xs text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 min-w-0"
                      />
                      <input 
                        type="number" 
                        min="1" 
                        value={currentQuantity} 
                        onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)} 
                        className="w-12 px-1.5 py-1.5 bg-white dark:bg-slate-900 rounded-lg outline-none font-black text-center text-xs text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shrink-0" 
                      />
                      <button 
                        type="button" 
                        onClick={handleAddMedicine} 
                        disabled={!currentCode.trim() || !currentName.trim()} 
                        className="min-w-[34px] min-h-[34px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg font-black flex items-center justify-center shrink-0 active:scale-95"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {showResults && searchResults.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                        {searchResults.map((res, i) => (
                          <button 
                            key={i} 
                            type="button" 
                            onClick={() => selectMedicine(res)} 
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-left border-b border-slate-100 dark:border-slate-800 last:border-none"
                          >
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-100 text-xs">{res.name}</p>
                              <p className="text-[9px] font-black text-emerald-600 uppercase">{res.code}</p>
                            </div>
                            <Plus size={14} className="text-emerald-500" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Added Meds Pills in Active Group */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">
                      Meds in Comb {activeGroupIndex + 1} ({medicineGroups[activeGroupIndex].meds.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {medicineGroups[activeGroupIndex].meds.length > 0 ? (
                        medicineGroups[activeGroupIndex].meds.map(med => (
                          <div key={med.code} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs uppercase shrink-0">{med.code}</span>
                              <span className="text-slate-800 dark:text-slate-200 text-xs font-bold truncate">{med.name}</span>
                              <span className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[9px] font-black px-1.5 py-0.2 rounded shrink-0">x{med.quantity}</span>
                            </div>
                            <button type="button" onClick={() => removeMedicine(activeGroupIndex, med.code)} className="text-slate-400 hover:text-red-500 transition-colors ml-1">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-3 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-center">
                          <p className="text-[11px] text-slate-400 italic">No medicines in this combination yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Row 6: Primary Fast Submit Action Button */}
          <button 
            disabled={loading} 
            type="submit" 
            className="w-full h-12 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-500 hover:to-teal-600 active:scale-[0.99] text-white rounded-xl font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-900/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Registering Patient...</span>
              </div>
            ) : (
              <>
                <Zap size={17} className="text-emerald-200 fill-emerald-200" />
                <span>Finalize Registration (Instant)</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Embedded Barcode & QR Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScannedPatient={(scannedCardId) => {
          const clean = cleanPatientId(scannedCardId);
          setCardNumber(clean);
          setIsScannerOpen(false);
          nameInputRef.current?.focus();
        }}
      />
    </div>
  );
}
