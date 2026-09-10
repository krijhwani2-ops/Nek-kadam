import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Users, 
  Stethoscope, 
  FlaskConical, 
  Volume2, 
  Search, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Sparkles, 
  Clock, 
  ArrowRight,
  Send,
  Zap,
  PhoneCall,
  Radio,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DemoPatient, 
  DemoToken, 
  DemoPharmacyTask, 
  INITIAL_DEMO_PATIENTS, 
  INITIAL_DEMO_TOKENS, 
  INITIAL_DEMO_PHARMACY_TASKS,
  COMMON_HOMEO_MEDS
} from '../demoData';

interface AuraGlassVariantProps {
  onNotify?: (msg: string) => void;
}

// Native Web Audio API soft clinic chime (pleasant 2-tone celestial ping)
function playClinicChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Tone 2: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0.09, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.85);
  } catch {
    // Audio Context not allowed or unsupported in current environment
  }
}

export function AuraGlassVariant({ onNotify }: AuraGlassVariantProps) {
  const [activeTab, setActiveTab] = useState<'tokens' | 'patients' | 'rx' | 'pharmacy'>('tokens');
  const [tokens, setTokens] = useState<DemoToken[]>(INITIAL_DEMO_TOKENS);
  const [patients, setPatients] = useState<DemoPatient[]>(INITIAL_DEMO_PATIENTS);
  const [pharmacyTasks, setPharmacyTasks] = useState<DemoPharmacyTask[]>(INITIAL_DEMO_PHARMACY_TASKS);
  const [currentToken, setCurrentToken] = useState<DemoToken | null>(INITIAL_DEMO_TOKENS[1]); // Token 12 (IN_PROGRESS)
  
  // Search & Filter
  const [patientSearch, setPatientSearch] = useState('');
  
  // Rx Builder State
  const [selectedPatientForRx, setSelectedPatientForRx] = useState<DemoPatient>(INITIAL_DEMO_PATIENTS[0]);
  const [activeRemedies, setActiveRemedies] = useState<string[]>(['BRYONIA ALBA', 'HEPAR SULPHURIS']);
  const [selectedPotency, setSelectedPotency] = useState<string>('200');
  const [selectedDosage, setSelectedDosage] = useState<string>('BD');
  const [medicineSearch, setMedicineSearch] = useState('');

  // Live ECG Waveform Phase
  const [ecgPhase, setEcgPhase] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setEcgPhase(prev => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Call Next Token
  const handleCallNext = () => {
    const waiting = tokens.filter(t => t.status === 'WAITING');
    if (waiting.length === 0) {
      onNotify?.('No more waiting patients in queue!');
      return;
    }
    const nextToken = waiting[0];
    setTokens(prev => prev.map(t => {
      if (t.id === nextToken.id) return { ...t, status: 'IN_PROGRESS' };
      if (currentToken && t.id === currentToken.id) return { ...t, status: 'DONE' };
      return t;
    }));
    setCurrentToken(nextToken);
    playClinicChime();
    onNotify?.(`🔔 Calling Token #${nextToken.tokenNumber}: ${nextToken.patientName}`);
  };

  const handlePrescribeQuick = (patient: DemoPatient) => {
    setSelectedPatientForRx(patient);
    setActiveTab('rx');
    onNotify?.(`Prescription pad ready for ${patient.name}`);
  };

  const handleAddRemedy = (med: string) => {
    if (activeRemedies.includes(med)) {
      onNotify?.(`${med} is already in the formula`);
      return;
    }
    if (activeRemedies.length >= 5) {
      onNotify?.('Maximum 5 medicines per bottle formula');
      return;
    }
    setActiveRemedies(prev => [...prev, med]);
    setMedicineSearch('');
    onNotify?.(`+ Added ${med} (${selectedPotency})`);
  };

  const handleRemoveRemedy = (med: string) => {
    setActiveRemedies(prev => prev.filter(m => m !== med));
  };

  const handleDispatchPrescription = () => {
    if (activeRemedies.length === 0) {
      onNotify?.('Please add at least one remedy before dispatching!');
      return;
    }

    const newTask: DemoPharmacyTask = {
      id: `task-${Date.now()}`,
      tokenNumber: currentToken?.tokenNumber || 88,
      patientName: selectedPatientForRx.name,
      cardNumber: selectedPatientForRx.cardNumber,
      doctorName: 'Dr. Rajdeep',
      status: 'PENDING',
      timeAgo: 'Just now',
      bottlesCount: 1,
      medicines: [
        {
          groupPower: selectedPotency,
          dosage: selectedDosage,
          names: [...activeRemedies]
        }
      ]
    };

    setPharmacyTasks(prev => [newTask, ...prev]);
    playClinicChime();
    onNotify?.(`✨ Prescription for ${selectedPatientForRx.name} beamed to Pharmacy!`);
    setActiveTab('pharmacy');
  };

  const handleAdvancePharmacyTask = (taskId: string) => {
    setPharmacyTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task;
      if (task.status === 'PENDING') return { ...task, status: 'PREPARING', claimedBy: 'Pooja K. (Pharmacist)' };
      if (task.status === 'PREPARING') return { ...task, status: 'READY' };
      if (task.status === 'READY') return { ...task, status: 'DELIVERED' };
      return task;
    }));
    playClinicChime();
    onNotify?.('Dispense order status updated');
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.cardNumber.includes(patientSearch) ||
    p.phone.includes(patientSearch)
  );

  const filteredMedicines = COMMON_HOMEO_MEDS.filter(m => 
    m.toLowerCase().includes(medicineSearch.toLowerCase()) && !activeRemedies.includes(m)
  ).slice(0, 5);

  return (
    <div className="relative min-h-screen w-full bg-[#050811] text-white font-sans overflow-x-hidden selection:bg-cyan-500 selection:text-black">
      {/* ── LIVING SPATIAL AURORA BACKGROUND ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Deep ocean cyan orb */}
        <motion.div 
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -40, 20, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 -left-20 w-96 h-96 rounded-full bg-cyan-600/25 blur-[120px]"
        />
        {/* Mystic violet orb */}
        <motion.div 
          animate={{
            x: [0, -40, 30, 0],
            y: [0, 50, -30, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-violet-600/20 blur-[130px]"
        />
        {/* Emerald bio glow */}
        <motion.div 
          animate={{
            x: [0, 25, -25, 0],
            y: [0, 30, -40, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
          className="absolute -bottom-20 left-1/4 w-80 h-80 rounded-full bg-emerald-500/15 blur-[110px]"
        />
        {/* Subtle grid mesh overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      {/* ── SPATIAL CONTENT WRAPPER ── */}
      <div className="relative z-10 px-4 pt-4 pb-36 max-w-md mx-auto">
        
        {/* ── TOP DYNAMIC ISLAND / CLINIC BEACON ── */}
        <div className="mb-4">
          <div className="backdrop-blur-2xl bg-white/[0.06] border border-white/[0.12] rounded-3xl p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.4)] relative overflow-hidden">
            {/* Top glass reflection gradient */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
                  <Radio size={14} className="animate-pulse text-cyan-300" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">Dr. Rajdeep Cabin</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">ONLINE</span>
                  </div>
                  <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
                    Nek Kadam Bio-OS
                    <span className="text-[10px] text-slate-400 font-normal">v4.0</span>
                  </h1>
                </div>
              </div>

              {/* Real-time Heartbeat ECG Waveform */}
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/40 border border-white/10">
                <svg width="44" height="18" viewBox="0 0 44 18" className="overflow-visible">
                  <path
                    d={`M 0 9 L 10 9 L 14 ${4 + Math.sin(ecgPhase * 0.2) * 2} L 18 15 L 22 2 L 26 13 L 29 9 L 44 9`}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-[0_0_6px_#06b6d4]"
                  />
                </svg>
                <div className="text-[10px] font-mono text-cyan-300 font-bold">72 BPM</div>
              </div>
            </div>

            {/* Now Serving Live Broadcast Strip */}
            {currentToken && (
              <div className="mt-3 pt-2.5 border-t border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-mono font-black text-[11px] text-black shadow-[0_0_12px_rgba(6,182,212,0.6)]">
                    #{currentToken.tokenNumber}
                  </div>
                  <div className="truncate max-w-[170px]">
                    <div className="text-[11px] font-medium text-white truncate">{currentToken.patientName}</div>
                    <div className="text-[9px] text-slate-400 font-mono">Card: {currentToken.cardNumber} • {currentToken.department}</div>
                  </div>
                </div>

                <button
                  onClick={handleCallNext}
                  className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-[11px] flex items-center gap-1.5 transition-all shadow-[0_0_16px_rgba(6,182,212,0.4)] active:scale-95"
                >
                  <Volume2 size={12} />
                  <span>Call Next</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── SPATIAL NAVIGATION CAPSULES ── */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { id: 'tokens', label: 'Queue', icon: Radio, count: tokens.filter(t => t.status === 'WAITING').length },
            { id: 'patients', label: 'Patients', icon: Users, count: patients.length },
            { id: 'rx', label: 'Smart Rx', icon: FlaskConical, count: activeRemedies.length },
            { id: 'pharmacy', label: 'Dispensary', icon: CheckCircle, count: pharmacyTasks.filter(t => t.status !== 'DELIVERED').length },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`relative p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
                  isActive 
                    ? 'backdrop-blur-xl bg-cyan-500/20 border border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.3)] text-white' 
                    : 'backdrop-blur-md bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeTabGlow"
                    className="absolute inset-0 rounded-2xl bg-gradient-to-t from-cyan-500/20 to-transparent pointer-events-none"
                  />
                )}
                <div className="relative">
                  <Icon size={16} className={isActive ? 'text-cyan-300' : 'text-slate-400'} />
                  {tab.count > 0 && (
                    <span className={`absolute -top-1 -right-2 text-[8px] font-bold px-1 rounded-full ${
                      isActive ? 'bg-cyan-400 text-black' : 'bg-slate-700 text-slate-200'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── TAB 1: TOKENS & QUEUE DESK ── */}
        {activeTab === 'tokens' && (
          <div className="space-y-3">
            {/* Current Active Halo Card */}
            {currentToken && (
              <div className="relative rounded-3xl p-4 backdrop-blur-2xl bg-gradient-to-b from-cyan-950/40 to-slate-950/60 border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span className="text-[10px] font-mono tracking-wider uppercase text-cyan-300 font-bold">INSIDE CONSULTING CABIN</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                    Token #{currentToken.tokenNumber}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">{currentToken.patientName}</h2>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">Card #{currentToken.cardNumber} • Dr. Rajdeep</p>
                  </div>
                  <button
                    onClick={() => {
                      const p = patients.find(pt => pt.cardNumber === currentToken.cardNumber) || patients[0];
                      handlePrescribeQuick(p);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95 transition-all"
                  >
                    <FlaskConical size={14} />
                    <span>Prescribe</span>
                  </button>
                </div>
              </div>
            )}

            {/* Waiting List Queue */}
            <div className="flex items-center justify-between px-1 pt-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">WAITING LOUNGE ({tokens.filter(t => t.status === 'WAITING').length})</span>
              <button
                onClick={handleCallNext}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
              >
                <span>Call Next In Line</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div className="space-y-2">
              {tokens.filter(t => t.status === 'WAITING').map((token, idx) => (
                <motion.div
                  key={token.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="backdrop-blur-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] rounded-2xl p-3 flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center font-mono font-bold text-sm text-cyan-300">
                      #{token.tokenNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-white">{token.patientName}</span>
                        {token.priority === 'URGENT' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/40">URGENT</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>Card: {token.cardNumber}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Clock size={9} /> ~{token.waitTimeMinutes}m wait</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setTokens(prev => prev.map(t => {
                        if (t.id === token.id) return { ...t, status: 'IN_PROGRESS' };
                        if (currentToken && t.id === currentToken.id) return { ...t, status: 'DONE' };
                        return t;
                      }));
                      setCurrentToken(token);
                      playClinicChime();
                      onNotify?.(`Called Token #${token.tokenNumber}`);
                    }}
                    className="p-2 rounded-xl bg-white/[0.06] hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-400/40 transition-all"
                    title="Call This Patient"
                  >
                    <Volume2 size={14} />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 2: PATIENTS BENTO ── */}
        {activeTab === 'patients' && (
          <div className="space-y-3">
            {/* Search Input with Specular Edge */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                placeholder="Search patient name, card #, mobile..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl backdrop-blur-xl bg-white/[0.05] border border-white/[0.12] text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/60 transition-all"
              />
            </div>

            {/* Patient Cards */}
            <div className="space-y-2.5">
              {filteredPatients.map(patient => (
                <div
                  key={patient.cardNumber}
                  className="backdrop-blur-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.09] rounded-3xl p-3.5 transition-all shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-xs text-white">{patient.name}</h3>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                          #{patient.cardNumber}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {patient.age}y • {patient.gender} • {patient.address}
                      </p>
                    </div>

                    <button
                      onClick={() => handlePrescribeQuick(patient)}
                      className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 font-semibold text-[11px] flex items-center gap-1 transition-all"
                    >
                      <FlaskConical size={12} />
                      <span>Prescribe</span>
                    </button>
                  </div>

                  {patient.chronicCondition && (
                    <div className="mt-2.5 px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/[0.06] text-[10px] text-emerald-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="truncate">{patient.chronicCondition}</span>
                    </div>
                  )}

                  {patient.lastPrescription && (
                    <div className="mt-1.5 text-[9px] text-slate-400 font-mono bg-white/[0.02] p-2 rounded-xl border border-white/[0.04] truncate">
                      Last: {patient.lastPrescription}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: SMART RX (3D BIO-CAPSULE FORMULATION) ── */}
        {activeTab === 'rx' && (
          <div className="space-y-3.5">
            {/* Target Patient Card */}
            <div className="backdrop-blur-xl bg-white/[0.06] border border-cyan-500/30 rounded-3xl p-3.5">
              <div className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 font-bold mb-1">Prescription Target</div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white">{selectedPatientForRx.name}</h3>
                  <p className="text-[10px] text-slate-400 font-mono">Card: #{selectedPatientForRx.cardNumber} • Age: {selectedPatientForRx.age}y</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Dr. Rajdeep</span>
                </div>
              </div>
            </div>

            {/* 3D Glass Medicine Formulation Rack */}
            <div className="backdrop-blur-2xl bg-white/[0.04] border border-white/[0.12] rounded-3xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">Bottle Formula #1</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">{activeRemedies.length}/5 Remedies</span>
              </div>

              {/* 3D Bio-Capsules Rack */}
              <div className="space-y-2 mb-4">
                {activeRemedies.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs italic">
                    Tap a remedy below to synthesize into bottle
                  </div>
                ) : (
                  activeRemedies.map((remedy) => (
                    <motion.div
                      key={remedy}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="group relative flex items-center justify-between p-2.5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-white/[0.03] to-slate-900/60 border border-cyan-500/30 shadow-md"
                    >
                      {/* Tangible 3D Capsule Graphic */}
                      <div className="flex items-center gap-2.5">
                        <div className="relative w-8 h-4 rounded-full bg-gradient-to-r from-cyan-400 via-cyan-200 to-white shadow-[0_0_10px_rgba(6,182,212,0.5)] flex items-center overflow-hidden">
                          <div className="w-1/2 h-full bg-gradient-to-br from-cyan-600 to-cyan-500" />
                          <div className="w-[1px] h-full bg-black/40" />
                          <div className="w-1/2 h-full bg-gradient-to-br from-white to-slate-200" />
                          <div className="absolute inset-x-0 top-0 h-[1.5px] bg-white/70" />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-white">{remedy}</span>
                          <div className="text-[9px] font-mono text-cyan-300">{selectedPotency} CH • Homoeopathic Dilution</div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveRemedy(remedy)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Potency & Dosage Selector */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.08]">
                {/* Potency */}
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400 mb-1 block">Potency Power</label>
                  <div className="flex gap-1">
                    {['30', '200', '1M', '10M'].map(pot => (
                      <button
                        key={pot}
                        onClick={() => setSelectedPotency(pot)}
                        className={`flex-1 py-1.5 rounded-xl text-[11px] font-mono font-bold transition-all ${
                          selectedPotency === pot 
                            ? 'bg-cyan-400 text-black shadow-[0_0_12px_rgba(6,182,212,0.5)]' 
                            : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]'
                        }`}
                      >
                        {pot}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dosage */}
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400 mb-1 block">Frequency (Dosage)</label>
                  <div className="flex gap-1">
                    {['OD', 'BD', 'TDS', 'HS'].map(dos => (
                      <button
                        key={dos}
                        onClick={() => setSelectedDosage(dos)}
                        className={`flex-1 py-1.5 rounded-xl text-[11px] font-mono font-bold transition-all ${
                          selectedDosage === dos 
                            ? 'bg-emerald-400 text-black shadow-[0_0_12px_rgba(16,185,129,0.5)]' 
                            : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]'
                        }`}
                      >
                        {dos}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Add Medicine Library Chips */}
            <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-3xl p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase text-slate-400">Quick Homoeo Remedies</span>
                <input
                  type="text"
                  value={medicineSearch}
                  onChange={e => setMedicineSearch(e.target.value)}
                  placeholder="Type to filter..."
                  className="w-28 px-2 py-0.5 rounded-lg bg-black/40 border border-white/10 text-[10px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(medicineSearch ? filteredMedicines : COMMON_HOMEO_MEDS.slice(0, 8)).map(med => (
                  <button
                    key={med}
                    onClick={() => handleAddRemedy(med)}
                    className="px-2.5 py-1.5 rounded-xl backdrop-blur-md bg-white/[0.05] hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/40 text-[10px] text-slate-200 hover:text-white font-medium flex items-center gap-1 transition-all active:scale-95"
                  >
                    <Plus size={10} className="text-cyan-400" />
                    <span>{med}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Transmit to Pharmacy Button */}
            <button
              onClick={handleDispatchPrescription}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:opacity-95 text-black font-black text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95 transition-all"
            >
              <Send size={15} />
              <span>Beam to Pharmacy Dispensary</span>
            </button>
          </div>
        )}

        {/* ── TAB 4: PHARMACY DISPENSARY QUEUE ── */}
        {activeTab === 'pharmacy' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">LIVE PHARMACY ORDERS</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {pharmacyTasks.filter(t => t.status === 'READY').length} Ready for Handover
              </span>
            </div>

            <div className="space-y-2.5">
              {pharmacyTasks.map(task => {
                const isReady = task.status === 'READY';
                const isDelivered = task.status === 'DELIVERED';
                const isPreparing = task.status === 'PREPARING';

                return (
                  <div
                    key={task.id}
                    className={`backdrop-blur-xl border rounded-3xl p-3.5 transition-all ${
                      isReady 
                        ? 'bg-emerald-950/25 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
                        : isPreparing
                        ? 'bg-cyan-950/20 border-cyan-500/30'
                        : isDelivered
                        ? 'bg-white/[0.02] border-white/[0.05] opacity-50'
                        : 'bg-white/[0.04] border-white/[0.09]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl font-mono font-bold text-xs flex items-center justify-center ${
                          isReady ? 'bg-emerald-400 text-black' : 'bg-white/10 text-cyan-300'
                        }`}>
                          #{task.tokenNumber}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-white">{task.patientName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Card: {task.cardNumber} • {task.timeAgo}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAdvancePharmacyTask(task.id)}
                        disabled={isDelivered}
                        className={`px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1 ${
                          isReady 
                            ? 'bg-emerald-400 hover:bg-emerald-300 text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]' 
                            : isPreparing
                            ? 'bg-cyan-400 hover:bg-cyan-300 text-black'
                            : isDelivered
                            ? 'bg-white/10 text-slate-400 cursor-default'
                            : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                      >
                        {isReady ? 'Deliver to Patient' : isPreparing ? 'Mark Ready' : isDelivered ? 'Delivered ✓' : 'Start Preparing'}
                      </button>
                    </div>

                    {/* Bottle formula readout */}
                    <div className="mt-2.5 pt-2 border-t border-white/[0.06] space-y-1">
                      {task.medicines.map((m, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px]">
                          <span className="text-cyan-300 font-mono font-medium truncate max-w-[200px]">
                            {m.names.join(' + ')}
                          </span>
                          <span className="text-slate-400 font-mono">
                            {m.groupPower} ({m.dosage})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
