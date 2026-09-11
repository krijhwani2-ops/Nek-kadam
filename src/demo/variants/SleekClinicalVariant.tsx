import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Stethoscope, 
  Pill, 
  Activity, 
  Search, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Printer, 
  FileText, 
  Phone, 
  CreditCard, 
  QrCode, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  Package, 
  Send, 
  Check, 
  UserPlus, 
  Calendar, 
  RefreshCw,
  X,
  Minus
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DemoPatient, 
  DemoPharmacyTask, 
  INITIAL_DEMO_PATIENTS, 
  INITIAL_DEMO_PHARMACY_TASKS,
  COMMON_HOMEO_MEDS
} from '../demoData';

interface SleekClinicalVariantProps {
  onNotify?: (msg: string) => void;
}

// Pleasant soft audio chime for clinic dispensary events
function playChime(type: 'success' | 'alert' = 'success') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    
    if (type === 'success') {
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } else {
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.setValueAtTime(587.33, now + 0.12); // D5
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  } catch {
    // Audio Context not allowed or unsupported
  }
}

export function SleekClinicalVariant({ onNotify }: SleekClinicalVariantProps) {
  // Navigation: 4 Core Mobile Modules
  const [activeTab, setActiveTab] = useState<'dashboard' | 'patients' | 'prescribe' | 'pharmacy'>('dashboard');

  // Clinical State
  const [patients, setPatients] = useState<DemoPatient[]>(INITIAL_DEMO_PATIENTS);
  const [selectedPatient, setSelectedPatient] = useState<DemoPatient>(INITIAL_DEMO_PATIENTS[0]);
  const [patientSearch, setPatientSearch] = useState('');
  const [pharmacyTasks, setPharmacyTasks] = useState<DemoPharmacyTask[]>(INITIAL_DEMO_PHARMACY_TASKS);
  
  // Pharmacy Segmented Stage Selector: Eliminates vertical stacking!
  const [pharmacyStage, setPharmacyStage] = useState<'PENDING' | 'PREPARING' | 'READY'>('PENDING');

  // Patient Profile Mode: 'history' vs 'prescription'
  const [patientTab, setPatientTab] = useState<'history' | 'prescription'>('prescription');

  // Prescription Builder State (Horizontal Flow)
  const [selectedPower, setSelectedPower] = useState('200C');
  const [selectedDosage, setSelectedDosage] = useState('BD');
  const [currentMedCode, setCurrentMedCode] = useState('');
  const [currentMedName, setCurrentMedName] = useState('');
  const [currentQty, setCurrentQty] = useState(1);
  const [activeCombinationIndex, setActiveCombinationIndex] = useState(0);
  const [combinations, setCombinations] = useState<Array<{ power: string; dosage: string; meds: Array<{ name: string; qty: number }> }>>([
    {
      power: '200C',
      dosage: 'BD',
      meds: [
        { name: 'BRYONIA ALBA', qty: 1 },
        { name: 'HEPAR SULPHURIS', qty: 1 }
      ]
    }
  ]);

  // Modals
  const [showOpdSlipModal, setShowOpdSlipModal] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  // New Patient Form state (2-column mobile layout)
  const [newPatientForm, setNewPatientForm] = useState({
    name: '',
    phone: '',
    age: '',
    gender: 'Female',
    bloodGroup: 'B+',
    address: 'Camp Sector 4'
  });

  const notify = (msg: string) => {
    if (onNotify) onNotify(msg);
  };

  // Filter patients
  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.cardNumber.includes(patientSearch) ||
    p.phone.includes(patientSearch)
  );

  // Filter pharmacy tasks by stage
  const pendingTasks = pharmacyTasks.filter(t => t.status === 'PENDING');
  const preparingTasks = pharmacyTasks.filter(t => t.status === 'PREPARING');
  const readyTasks = pharmacyTasks.filter(t => t.status === 'READY');

  // Handle Add Med to current combination
  const handleAddMedicine = () => {
    const name = currentMedName.trim() || currentMedCode.trim();
    if (!name) return;

    setCombinations(prev => {
      const updated = [...prev];
      const cur = updated[activeCombinationIndex];
      if (!cur.meds.some(m => m.name.toUpperCase() === name.toUpperCase())) {
        cur.meds.push({ name: name.toUpperCase(), qty: currentQty });
      }
      return updated;
    });

    setCurrentMedCode('');
    setCurrentMedName('');
    setCurrentQty(1);
    playChime('success');
    notify(`Added ${name} to Combination ${activeCombinationIndex + 1}`);
  };

  // Remove medicine from combination
  const handleRemoveMed = (medIdx: number) => {
    setCombinations(prev => {
      const updated = [...prev];
      updated[activeCombinationIndex].meds.splice(medIdx, 1);
      return updated;
    });
  };

  // Add new combination tab
  const handleAddCombination = () => {
    setCombinations(prev => [
      ...prev,
      { power: '30C', dosage: 'TDS', meds: [] }
    ]);
    setActiveCombinationIndex(combinations.length);
    notify(`Created Combination ${combinations.length + 1}`);
  };

  // Save prescription and dispatch to pharmacy
  const handleSavePrescription = () => {
    const totalMeds = combinations.reduce((sum, c) => sum + c.meds.length, 0);
    if (totalMeds === 0) {
      alert('Please add at least one remedy before submitting.');
      return;
    }

    const newTask: DemoPharmacyTask = {
      id: `task-${Date.now()}`,
      tokenNumber: Math.floor(Math.random() * 80) + 20,
      patientName: selectedPatient.name,
      cardNumber: selectedPatient.cardNumber,
      doctorName: 'Dr. Rajdeep Sonkar',
      status: 'PENDING',
      timeAgo: 'Just now',
      bottlesCount: combinations.length,
      medicines: combinations.map(c => ({
        groupPower: c.power,
        dosage: c.dosage,
        names: c.meds.map(m => m.name)
      }))
    };

    setPharmacyTasks(prev => [newTask, ...prev]);
    playChime('success');
    notify(`Prescription sent to Pharmacy for #${selectedPatient.cardNumber}!`);
    setPatientTab('history');
  };

  // Pharmacy Stage Actions
  const handleClaimTask = (taskId: string) => {
    setPharmacyTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'PREPARING', claimedBy: 'Dr. Rajdeep' } : t));
    playChime('alert');
    notify('Task claimed! Moved to Workbench.');
    setPharmacyStage('PREPARING');
  };

  const handleFinishPreparation = (taskId: string) => {
    setPharmacyTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'READY' } : t));
    playChime('success');
    notify('Order marked READY for patient handover!');
    setPharmacyStage('READY');
  };

  const handleDeliverHandover = (taskId: string) => {
    setPharmacyTasks(prev => prev.filter(t => t.id !== taskId));
    playChime('success');
    notify('Delivered to patient! File archived.');
  };

  // Quick Register Submit
  const handleRegisterPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientForm.name.trim()) return;

    const newCard = String(10675 + patients.length);
    const newEntry: DemoPatient = {
      cardNumber: newCard,
      name: newPatientForm.name.toUpperCase(),
      age: newPatientForm.age || '32',
      gender: newPatientForm.gender,
      phone: newPatientForm.phone || '9827100000',
      address: newPatientForm.address,
      doctorName: 'Dr. Rajdeep',
      lastVisitDate: new Date().toISOString().split('T')[0],
      chronicCondition: 'First OPD Registration',
      recentVisitsCount: 1
    };

    setPatients(prev => [newEntry, ...prev]);
    setSelectedPatient(newEntry);
    setShowNewPatientModal(false);
    playChime('success');
    notify(`Registered patient ${newEntry.name} (#${newCard})`);
    setActiveTab('prescribe');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans pb-20 select-none">
      
      {/* ─────────────────────────────────────────────────────────────
          1. SLEEK MOBILE TOPBAR (Never squishes on narrow screens)
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-emerald-600 text-white shadow-md border-b border-emerald-700/60 px-4 py-3 shrink-0 flex items-center justify-between gap-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center font-black text-sm border border-white/20 shrink-0 shadow-sm">
            NK
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-black text-base tracking-tight truncate leading-none">Nek Kadam</h1>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-emerald-800/80 text-emerald-200 rounded-full border border-emerald-500/30 shrink-0">
                v2.0 Mobile
              </span>
            </div>
            <p className="text-[10px] text-emerald-100/90 font-bold truncate mt-0.5">
              Camp OPD • Dr. Rajdeep
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Quick 1-Tap QR Scanner Trigger */}
          <button
            onClick={() => setShowScannerModal(true)}
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white transition-all border border-white/20 flex items-center gap-1.5 text-xs font-black shadow-sm"
            title="Scan Patient Barcode / QR Code"
          >
            <QrCode size={16} className="text-emerald-100" />
            <span className="hidden xs:inline">Scan</span>
          </button>

          {/* Quick Add Patient */}
          <button
            onClick={() => setShowNewPatientModal(true)}
            className="p-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:scale-95 text-white transition-all border border-emerald-500/40 flex items-center gap-1 text-xs font-black shadow-sm"
            title="Enroll New Patient"
          >
            <UserPlus size={16} />
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. ACTIVE MODULE ROUTER
      ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 w-full px-3 py-3 max-w-md mx-auto space-y-4">
        
        {/* ═══════════════════════════════════════════════════════════
            TAB 1: DASHBOARD (Horizontal Metrics & Fast Launchpads)
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            
            {/* Quick Greeting & Search Pill */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="text-xs text-emerald-100 font-bold uppercase tracking-wider">Welcome,</p>
                  <h2 className="text-xl font-black">Dr. Rajdeep Sonkar</h2>
                </div>
                <div className="px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-wider border border-white/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping"></span>
                  Live Clinic
                </div>
              </div>

              {/* Horizontal 1-Tap Search Bar */}
              <div 
                onClick={() => setActiveTab('patients')}
                className="bg-white text-slate-600 rounded-xl p-3 flex items-center justify-between shadow-inner cursor-pointer hover:bg-emerald-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Search size={18} className="text-emerald-600" />
                  <span className="text-xs font-bold text-slate-500">Search patient by name or #card...</span>
                </div>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                  Tap to search
                </span>
              </div>
            </div>

            {/* 3-METRIC HORIZONTAL ROW (No squishing, clean 3-box mobile grid) */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center shadow-xs">
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">14</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight mt-0.5">Today Reg</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center shadow-xs">
                <p className="text-xl font-black text-amber-500">48</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight mt-0.5">Active Visits</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center shadow-xs">
                <p className="text-xl font-black text-slate-700 dark:text-slate-200">1,147</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight mt-0.5">Total Files</p>
              </div>
            </div>

            {/* 2-COLUMN HORIZONTAL ACTION TILES */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setShowNewPatientModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white p-3.5 rounded-2xl shadow-sm flex items-center gap-3 text-left transition-all border-b-2 border-emerald-800"
              >
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <UserPlus size={20} />
                </div>
                <div>
                  <p className="font-black text-xs leading-tight">Register Patient</p>
                  <p className="text-[9px] text-emerald-100 font-bold uppercase tracking-wider mt-0.5">+ New ID Slip</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveTab('pharmacy');
                  setPharmacyStage('PENDING');
                }}
                className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 active:scale-95 text-slate-800 dark:text-slate-100 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3 text-left transition-all border-b-2 border-slate-300 dark:border-slate-700"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Pill size={20} />
                </div>
                <div>
                  <p className="font-black text-xs leading-tight">Pharmacy Queue</p>
                  <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider mt-0.5">
                    {pendingTasks.length} Awaiting Prep
                  </p>
                </div>
              </button>
            </div>

            {/* RECENT PATIENTS (Horizontal Compact Cards) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Recent Camp Footfall
                </h3>
                <button 
                  onClick={() => setActiveTab('patients')}
                  className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
                >
                  View All <ChevronRight size={14} />
                </button>
              </div>

              <div className="space-y-2">
                {patients.slice(0, 4).map(p => (
                  <div
                    key={p.cardNumber}
                    onClick={() => {
                      setSelectedPatient(p);
                      setActiveTab('prescribe');
                    }}
                    className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 bg-slate-50/70 dark:bg-slate-850 flex items-center justify-between gap-2.5 cursor-pointer active:scale-98 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                        {p.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-xs text-slate-800 dark:text-slate-100 truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold truncate">Age {p.age} • {p.phone}</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-orange-500 text-white text-[10px] font-black shrink-0 shadow-xs">
                      #{p.cardNumber}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* LIVE OPERATORS CHIPS */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">On Duty Operators</p>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { name: 'Dr. Rajdeep', dept: 'OPD Doctor', online: true },
                  { name: 'Dr. Vibhuti', dept: 'Medicine Spec', online: true },
                  { name: 'Sameer K.', dept: 'Pharmacy', online: true },
                  { name: 'Vol. Priya', dept: 'Registration', online: true }
                ].map((op, i) => (
                  <div key={i} className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center gap-2 shrink-0 border border-slate-200 dark:border-slate-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">{op.name}</span>
                    <span className="text-[9px] text-slate-400 font-semibold uppercase">{op.dept}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 2: PATIENTS DIRECTORY (Sticky Search & Compact Cards)
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'patients' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {/* Sticky Search with 1-Tap QR Scanner */}
            <div className="sticky top-14 z-20 bg-slate-50 dark:bg-slate-950 pb-2 space-y-2">
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border-2 border-emerald-500/30 shadow-xs">
                <Search size={18} className="text-slate-400 ml-1.5 shrink-0" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Search name, card #, mobile..."
                  className="flex-1 bg-transparent text-xs font-bold outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
                />
                {patientSearch && (
                  <button onClick={() => setPatientSearch('')} className="p-1 text-slate-400 hover:text-slate-600">
                    <X size={16} />
                  </button>
                )}
                <button
                  onClick={() => setShowScannerModal(true)}
                  className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-black flex items-center gap-1 border border-emerald-300/60 shrink-0"
                >
                  <QrCode size={14} />
                  <span>Scan</span>
                </button>
              </div>

              <div className="flex justify-between items-center px-1">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Showing {filteredPatients.length} Patients
                </p>
                <button
                  onClick={() => setShowNewPatientModal(true)}
                  className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
                >
                  <Plus size={14} /> Register New
                </button>
              </div>
            </div>

            {/* Patients List (Compact Horizontal Cards) */}
            <div className="space-y-2">
              {filteredPatients.map(p => (
                <div
                  key={p.cardNumber}
                  onClick={() => {
                    setSelectedPatient(p);
                    setActiveTab('prescribe');
                  }}
                  className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3 cursor-pointer hover:border-emerald-400 transition-all active:scale-98"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                      {p.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-xs text-slate-800 dark:text-slate-100 truncate">{p.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold mt-0.5">
                        <span>{p.phone}</span>
                        <span>•</span>
                        <span>Age {p.age}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-xl bg-orange-500 text-white text-xs font-black shadow-xs">
                      #{p.cardNumber}
                    </span>
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 3: PRESCRIBE (Compact Header + Horizontal Rx Builder)
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'prescribe' && selectedPatient && (
          <div className="space-y-3 animate-in fade-in duration-200">
            
            {/* ── COMPACT CLINICAL HEADER (~75px instead of 300px!) ── */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-xs">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">
                        {selectedPatient.name}
                      </h2>
                      <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded-md">
                        #{selectedPatient.cardNumber}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">
                      Age {selectedPatient.age} • {selectedPatient.gender} • 📱 {selectedPatient.phone}
                    </p>
                  </div>
                </div>

                {/* 1-Tap Quick Actions: QR Slip & Switch */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setShowOpdSlipModal(true)}
                    className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 text-[10px] font-black active:scale-95 shadow-xs"
                    title="View & Print Digital OPD Pass"
                  >
                    <QrCode size={16} />
                    <span className="hidden xs:inline">Pass</span>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('patients')}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black active:scale-95"
                    title="Change Patient"
                  >
                    Switch
                  </button>
                </div>
              </div>
            </div>

            {/* ── STICKY SEGMENTED SELECTOR: [History] vs [New Rx] ── */}
            <div className="flex bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-xl gap-1 shadow-inner">
              <button
                onClick={() => setPatientTab('prescription')}
                className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  patientTab === 'prescription'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Plus size={14} />
                <span>New Prescription</span>
              </button>
              <button
                onClick={() => setPatientTab('history')}
                className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  patientTab === 'history'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Clock size={14} />
                <span>Past History ({selectedPatient.recentVisitsCount})</span>
              </button>
            </div>

            {/* ── VIEW: NEW PRESCRIPTION (HORIZONTAL STREAMLINED CONTROLS) ── */}
            {patientTab === 'prescription' && (
              <div className="space-y-3">
                
                {/* Combination Tabs (Horizontal swipeable chips) */}
                <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar">
                  <div className="flex items-center gap-1.5">
                    {combinations.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveCombinationIndex(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all border ${
                          activeCombinationIndex === idx
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Combo {idx + 1} ({combinations[idx].meds.length})
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleAddCombination}
                    className="p-1.5 px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-black flex items-center gap-1 shrink-0 active:scale-95"
                  >
                    <Plus size={14} /> Combo
                  </button>
                </div>

                {/* COMBINATION BUILDER BOX (2-Column Grids + Stepper) */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  
                  {/* 2-COLUMN HORIZONTAL SELECTOR: [Power] + [Dosage] */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-1">
                        Power / Potency
                      </label>
                      <select
                        value={combinations[activeCombinationIndex].power}
                        onChange={e => {
                          const updated = [...combinations];
                          updated[activeCombinationIndex].power = e.target.value;
                          setCombinations(updated);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-black text-slate-800 dark:text-slate-100 outline-none"
                      >
                        {['Q', '3X', '6X', '30C', '200C', '1M', '10M'].map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-1">
                        Dosage Frequency
                      </label>
                      <select
                        value={combinations[activeCombinationIndex].dosage}
                        onChange={e => {
                          const updated = [...combinations];
                          updated[activeCombinationIndex].dosage = e.target.value;
                          setCombinations(updated);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-black text-slate-800 dark:text-slate-100 outline-none"
                      >
                        {['OD', 'BD', 'TDS', 'QID', 'HS', 'SOS'].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* HORIZONTAL MEDICINE ENTRY ROW: [Search/Code] + [- Qty +] + [+ Add] */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-1">
                      Add Medicine to Combo {activeCombinationIndex + 1}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={currentMedName}
                          onChange={e => setCurrentMedName(e.target.value)}
                          placeholder="Type remedy (e.g. ACONITE)..."
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-black text-slate-800 dark:text-slate-100 outline-none uppercase placeholder:normal-case placeholder:font-normal"
                        />
                      </div>

                      {/* Touch Stepper for Qty */}
                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCurrentQty(Math.max(1, currentQty - 1))}
                          className="w-7 h-7 flex items-center justify-center text-slate-500 font-bold active:scale-90"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-5 text-center text-xs font-black text-slate-700 dark:text-slate-200">
                          {currentQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCurrentQty(currentQty + 1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-500 font-bold active:scale-90"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* Add Button */}
                      <button
                        type="button"
                        onClick={handleAddMedicine}
                        className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs shrink-0 flex items-center gap-1"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  {/* QUICK MEDICINE SUGGESTIONS CHIPS */}
                  <div className="pt-1">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Quick Select Common Meds:</p>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {COMMON_HOMEO_MEDS.slice(0, 8).map(medName => (
                        <button
                          key={medName}
                          type="button"
                          onClick={() => setCurrentMedName(medName)}
                          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700 shrink-0 active:scale-95"
                        >
                          {medName}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SELECTED MEDICINES IN CURRENT COMBO */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Combo {activeCombinationIndex + 1} Contents ({combinations[activeCombinationIndex].meds.length}):
                    </p>

                    {combinations[activeCombinationIndex].meds.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No remedies added yet to this combination.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {combinations[activeCombinationIndex].meds.map((med, idx) => (
                          <span
                            key={idx}
                            className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                          >
                            <span>{med.name}</span>
                            <span className="text-[9px] font-black px-1 bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 rounded">
                              x{med.qty}
                            </span>
                            <button
                              onClick={() => handleRemoveMed(idx)}
                              className="text-slate-400 hover:text-red-500 ml-0.5"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* STICKY SUBMIT PRESCRIPTION BUTTON */}
                <button
                  onClick={handleSavePrescription}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md flex items-center justify-center gap-2 border-b-2 border-emerald-800"
                >
                  <Send size={16} />
                  <span>Save & Dispatch to Pharmacy</span>
                </button>
              </div>
            )}

            {/* ── VIEW: PAST CLINICAL HISTORY ── */}
            {patientTab === 'history' && (
              <div className="space-y-2.5">
                {[
                  {
                    date: '23 Aug 2026',
                    doctor: 'Dr. Rajdeep',
                    prescribed: 'BRYONIA ALBA 200 (BD) + HEPAR SULPH 200 (BD)',
                    notes: 'Follow-up for seasonal bronchospasm. Chest sounds clearer.'
                  },
                  {
                    date: '16 Aug 2026',
                    doctor: 'Dr. Vibhuti',
                    prescribed: 'ACONITUM NAP 30 (TDS) / PULSATILLA 30 (BD)',
                    notes: 'Initial acute presentation with dry cough and low fever.'
                  }
                ].map((item, i) => (
                  <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1">
                        <Calendar size={13} className="text-emerald-500" /> {item.date}
                      </span>
                      <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                        {item.doctor}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Rx: {item.prescribed}
                    </p>
                    <p className="text-[11px] text-slate-400 leading-tight italic">
                      "{item.notes}"
                    </p>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 4: PHARMACY QUEUE (Segmented Stage Selector - NO STACK)
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'pharmacy' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            
            {/* ── HORIZONTAL SEGMENTED STAGE CONTROLLER (Eliminates vertical stacking!) ── */}
            <div className="sticky top-14 z-20 bg-slate-50 dark:bg-slate-950 pb-1">
              <div className="flex bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-2xl gap-1 shadow-inner">
                
                {/* 1. Pending Stage */}
                <button
                  onClick={() => setPharmacyStage('PENDING')}
                  className={`flex-1 py-2 px-1 rounded-xl text-[11px] font-black uppercase tracking-tight flex items-center justify-center gap-1 transition-all ${
                    pharmacyStage === 'PENDING'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Clock size={13} />
                  <span>Pending ({pendingTasks.length})</span>
                </button>

                {/* 2. Preparing / Workbench Stage */}
                <button
                  onClick={() => setPharmacyStage('PREPARING')}
                  className={`flex-1 py-2 px-1 rounded-xl text-[11px] font-black uppercase tracking-tight flex items-center justify-center gap-1 transition-all ${
                    pharmacyStage === 'PREPARING'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Activity size={13} />
                  <span>Prep ({preparingTasks.length})</span>
                </button>

                {/* 3. Ready Stage */}
                <button
                  onClick={() => setPharmacyStage('READY')}
                  className={`flex-1 py-2 px-1 rounded-xl text-[11px] font-black uppercase tracking-tight flex items-center justify-center gap-1 transition-all ${
                    pharmacyStage === 'READY'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <CheckCircle2 size={13} />
                  <span>Ready ({readyTasks.length})</span>
                </button>
              </div>
            </div>

            {/* ── STAGE 1: PENDING ORDERS ── */}
            {pharmacyStage === 'PENDING' && (
              <div className="space-y-2.5">
                {pendingTasks.length === 0 ? (
                  <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
                    <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="font-bold text-xs text-slate-600 dark:text-slate-300">All pending orders are cleared!</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">New doctor prescriptions will arrive automatically.</p>
                  </div>
                ) : (
                  pendingTasks.map(task => (
                    <div
                      key={task.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-amber-200/80 dark:border-amber-900/40 shadow-xs space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">{task.patientName}</h3>
                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-black rounded">
                              #{task.cardNumber}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                            Rx by {task.doctorName} • {task.timeAgo}
                          </p>
                        </div>

                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-black rounded-lg">
                          {task.bottlesCount} Bottle{task.bottlesCount > 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Medicine Items to prepare */}
                      <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl space-y-1.5 border border-slate-100 dark:border-slate-800">
                        {task.medicines.map((mGroup, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
                              {mGroup.names.join(' + ')}
                            </span>
                            <span className="text-[10px] font-black px-1.5 py-0.2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                              {mGroup.groupPower} ({mGroup.dosage})
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* 1-Tap Claim Button */}
                      <button
                        onClick={() => handleClaimTask(task.id)}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center gap-2"
                      >
                        <Activity size={14} />
                        <span>Claim & Start Preparing</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── STAGE 2: PREPARING WORKBENCH ── */}
            {pharmacyStage === 'PREPARING' && (
              <div className="space-y-2.5">
                {preparingTasks.length === 0 ? (
                  <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
                    <Pill size={36} className="text-blue-500 mx-auto mb-2 opacity-80" />
                    <p className="font-bold text-xs text-slate-600 dark:text-slate-300">Workbench is empty.</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Claim an order from "Pending" to pack medicines.</p>
                  </div>
                ) : (
                  preparingTasks.map(task => (
                    <div
                      key={task.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-blue-200/80 dark:border-blue-900/40 shadow-xs space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">{task.patientName}</h3>
                            <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[9px] font-black rounded">
                              #{task.cardNumber}
                            </span>
                          </div>
                          <p className="text-[10px] text-blue-600 font-bold mt-0.5">
                            Under Preparation by You
                          </p>
                        </div>
                      </div>

                      {/* Preparation Checklist */}
                      <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl space-y-2 border border-slate-100 dark:border-slate-800">
                        {task.medicines.map((mGroup, idx) => (
                          <div key={idx} className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <div>
                              <p className="text-xs font-black text-slate-800 dark:text-slate-100">{mGroup.names.join(' + ')}</p>
                              <p className="text-[10px] text-emerald-600 font-bold">Potency: {mGroup.groupPower} • {mGroup.dosage}</p>
                            </div>
                            <span className="text-emerald-500 font-black text-xs">✓ Ready</span>
                          </div>
                        ))}
                      </div>

                      {/* 1-Tap Finish Prep */}
                      <button
                        onClick={() => handleFinishPreparation(task.id)}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 size={14} />
                        <span>Pack Box & Mark Ready</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── STAGE 3: READY FOR HANDOVER ── */}
            {pharmacyStage === 'READY' && (
              <div className="space-y-2.5">
                {readyTasks.length === 0 ? (
                  <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
                    <Package size={36} className="text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="font-bold text-xs text-slate-600 dark:text-slate-300">No ready boxes waiting.</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Completed medicine boxes will appear here for handover.</p>
                  </div>
                ) : (
                  readyTasks.map(task => (
                    <div
                      key={task.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-900/40 shadow-xs space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">{task.patientName}</h3>
                            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded">
                              #{task.cardNumber}
                            </span>
                          </div>
                          <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
                            ✓ Packed & Ready for Patient Dispatch
                          </p>
                        </div>
                      </div>

                      {/* 1-Tap Handover Button */}
                      <button
                        onClick={() => handleDeliverHandover(task.id)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center gap-2"
                      >
                        <Package size={14} />
                        <span>Handover Box to Patient</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        )}

      </main>

      {/* ─────────────────────────────────────────────────────────────
          3. MODERN MOBILE BOTTOM NAVIGATION DOCK (Thumb Friendly)
      ───────────────────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 px-2 pt-1 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-lg">
        <div className="flex items-center justify-around max-w-md mx-auto">
          
          {/* 1. Dashboard */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors ${
              activeTab === 'dashboard' ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400'
            }`}
          >
            <Activity size={20} />
            <span className="text-[10px] mt-0.5">Home</span>
          </button>

          {/* 2. Patients */}
          <button
            onClick={() => setActiveTab('patients')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors ${
              activeTab === 'patients' ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400'
            }`}
          >
            <Users size={20} />
            <span className="text-[10px] mt-0.5">Patients</span>
          </button>

          {/* 3. CENTER ELEVATED 1-TAP SCANNER / NEW VISIT ACTION */}
          <button
            onClick={() => setShowScannerModal(true)}
            className="flex flex-col items-center justify-center -mt-5 mx-1"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 border-2 border-white dark:border-slate-900 active:scale-90 transition-transform">
              <QrCode size={22} />
            </div>
            <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 mt-1">
              Scan
            </span>
          </button>

          {/* 4. Prescribe */}
          <button
            onClick={() => setActiveTab('prescribe')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors ${
              activeTab === 'prescribe' ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400'
            }`}
          >
            <Stethoscope size={20} />
            <span className="text-[10px] mt-0.5">Prescribe</span>
          </button>

          {/* 5. Pharmacy */}
          <button
            onClick={() => setActiveTab('pharmacy')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 relative transition-colors ${
              activeTab === 'pharmacy' ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400'
            }`}
          >
            <div className="relative">
              <Pill size={20} />
              {pendingTasks.length > 0 && (
                <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">
                  {pendingTasks.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5">Pharmacy</span>
          </button>

        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL: DIGITAL OPD QR SLIP (Zero links, pure token pass)
      ───────────────────────────────────────────────────────────── */}
      {showOpdSlipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-200 text-center">
            
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Nek Kadam System</p>
                <h3 className="font-black text-base text-slate-800 dark:text-slate-100">Digital OPD Pass</h3>
              </div>
              <button onClick={() => setShowOpdSlipModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {/* QR Card Mock */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div>
                <p className="font-black text-sm text-slate-800 dark:text-slate-100">{selectedPatient.name}</p>
                <span className="inline-block mt-1 px-3 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-xs rounded-full">
                  OPD CARD: #{selectedPatient.cardNumber}
                </span>
              </div>

              {/* QR Code */}
              <div className="p-3 bg-white rounded-2xl border-2 border-emerald-500/40 inline-block shadow-xs">
                <QRCodeSVG
                  value={`OPD-${selectedPatient.cardNumber}`}
                  size={150}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <p className="text-[10px] text-slate-500 font-bold leading-tight">
                Scan this QR at Reception / Doctor Desk.<br />
                (Encodes token <span className="font-mono text-emerald-600">OPD-{selectedPatient.cardNumber}</span> with zero links)
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center gap-1.5"
              >
                <Printer size={15} /> Print Slip
              </button>
              <button
                onClick={() => setShowOpdSlipModal(false)}
                className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider rounded-xl"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL: REGISTER PATIENT (2-COLUMN COMPACT MOBILE GRID)
      ───────────────────────────────────────────────────────────── */}
      {showNewPatientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Camp Enrollment</p>
                <h3 className="font-black text-base text-slate-800 dark:text-slate-100">Register New Patient</h3>
              </div>
              <button onClick={() => setShowNewPatientModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRegisterPatient} className="space-y-3">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Patient Full Name *</label>
                <input
                  required
                  type="text"
                  value={newPatientForm.name}
                  onChange={e => setNewPatientForm({ ...newPatientForm, name: e.target.value })}
                  placeholder="e.g. SUNITA SHARMA"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-800 dark:text-slate-100 outline-none uppercase"
                />
              </div>

              {/* 2-COLUMN GRID: [Phone] + [Age] */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Phone Number</label>
                  <input
                    type="tel"
                    value={newPatientForm.phone}
                    onChange={e => setNewPatientForm({ ...newPatientForm, phone: e.target.value })}
                    placeholder="9827XXXXXX"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Age</label>
                  <input
                    type="number"
                    value={newPatientForm.age}
                    onChange={e => setNewPatientForm({ ...newPatientForm, age: e.target.value })}
                    placeholder="45"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-800 dark:text-slate-100 outline-none text-center"
                  />
                </div>
              </div>

              {/* 2-COLUMN GRID: [Gender] + [Blood Group] */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Gender</label>
                  <select
                    value={newPatientForm.gender}
                    onChange={e => setNewPatientForm({ ...newPatientForm, gender: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Blood Group</label>
                  <select
                    value={newPatientForm.bloodGroup}
                    onChange={e => setNewPatientForm({ ...newPatientForm, bloodGroup: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Address / Colony</label>
                <input
                  type="text"
                  value={newPatientForm.address}
                  onChange={e => setNewPatientForm({ ...newPatientForm, address: e.target.value })}
                  placeholder="e.g. Sector 4, Madhav Nagar"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2"
              >
                <UserPlus size={16} />
                <span>Save & Create Prescription</span>
              </button>
            </form>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. MODAL: FAST CAMERA / QR SCANNER
      ───────────────────────────────────────────────────────────── */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-200 text-center">
            
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-black text-base text-slate-800 dark:text-slate-100">Camera OPD Scanner</h3>
              <button onClick={() => setShowScannerModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {/* Scanner Viewfinder Simulation */}
            <div className="relative w-full aspect-square bg-slate-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center p-4 border-2 border-emerald-500/50">
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_15px_red] animate-pulse"></div>
              <QrCode size={90} className="text-slate-700 mb-2" />
              <p className="text-white text-xs font-bold">Align OPD Card QR or Barcode</p>
              <p className="text-slate-400 text-[10px] mt-1">Reads #10674, OPD-7761 instantly</p>
            </div>

            {/* Quick Test Barcode Buttons */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Or simulate instant test scan:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const match = patients.find(p => p.cardNumber === '10674') || patients[0];
                    setSelectedPatient(match);
                    setShowScannerModal(false);
                    playChime('success');
                    notify(`Scanned: ${match.name} (#${match.cardNumber})`);
                    setActiveTab('prescribe');
                  }}
                  className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-black active:scale-95"
                >
                  Scan #10674
                </button>

                <button
                  onClick={() => {
                    const match = patients.find(p => p.cardNumber === '10668') || patients[1];
                    setSelectedPatient(match);
                    setShowScannerModal(false);
                    playChime('success');
                    notify(`Scanned: ${match.name} (#${match.cardNumber})`);
                    setActiveTab('prescribe');
                  }}
                  className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-black active:scale-95"
                >
                  Scan #10668
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowScannerModal(false)}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider rounded-xl"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
