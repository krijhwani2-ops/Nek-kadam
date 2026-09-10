import React, { useState, useRef } from 'react';
import { 
  Sliders, 
  RotateCw, 
  Check, 
  ArrowRight, 
  Search, 
  Plus, 
  Trash2, 
  Clock, 
  Activity, 
  Radio, 
  Terminal, 
  Volume2, 
  ShieldCheck,
  Disc,
  Lock
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

interface NothingGlyphVariantProps {
  onNotify?: (msg: string) => void;
}

// Mechanical click / tick sound generator (Teenage Engineering rotary click)
function playMechanicalTick() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.03);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  } catch {
    // Ignore audio restrictions
  }
}

// 7-Segment Digital Number Display Component
function SevenSegmentDigit({ digit }: { digit: number | string }) {
  const num = parseInt(digit.toString(), 10);
  
  // 7 segment definitions: [top, topRight, bottomRight, bottom, bottomLeft, topLeft, center]
  const segmentMap: Record<number, boolean[]> = {
    0: [true, true, true, true, true, true, false],
    1: [false, true, true, false, false, false, false],
    2: [true, true, false, true, true, false, true],
    3: [true, true, true, true, false, false, true],
    4: [false, true, true, false, false, true, true],
    5: [true, false, true, true, false, true, true],
    6: [true, false, true, true, true, true, true],
    7: [true, true, true, false, false, false, false],
    8: [true, true, true, true, true, true, true],
    9: [true, true, true, true, false, true, true],
  };

  const segs = segmentMap[num] || segmentMap[0];
  const activeColor = '#FF2A1B';
  const inactiveColor = '#240a0a';

  return (
    <svg width="22" height="34" viewBox="0 0 24 38" className="inline-block drop-shadow-[0_0_8px_rgba(255,42,27,0.4)]">
      {/* a: top */}
      <rect x="4" y="2" width="16" height="3.5" rx="1.5" fill={segs[0] ? activeColor : inactiveColor} />
      {/* b: top-right */}
      <rect x="18.5" y="4.5" width="3.5" height="13" rx="1.5" fill={segs[1] ? activeColor : inactiveColor} />
      {/* c: bottom-right */}
      <rect x="18.5" y="19.5" width="3.5" height="13" rx="1.5" fill={segs[2] ? activeColor : inactiveColor} />
      {/* d: bottom */}
      <rect x="4" y="32.5" width="16" height="3.5" rx="1.5" fill={segs[3] ? activeColor : inactiveColor} />
      {/* e: bottom-left */}
      <rect x="2" y="19.5" width="3.5" height="13" rx="1.5" fill={segs[4] ? activeColor : inactiveColor} />
      {/* f: top-left */}
      <rect x="2" y="4.5" width="3.5" height="13" rx="1.5" fill={segs[5] ? activeColor : inactiveColor} />
      {/* g: center */}
      <rect x="4" y="17.2" width="16" height="3.5" rx="1.5" fill={segs[6] ? activeColor : inactiveColor} />
    </svg>
  );
}

export function NothingGlyphVariant({ onNotify }: NothingGlyphVariantProps) {
  const [activeTab, setActiveTab] = useState<'console' | 'patients' | 'potency' | 'dispense'>('console');
  const [tokens, setTokens] = useState<DemoToken[]>(INITIAL_DEMO_TOKENS);
  const [patients, setPatients] = useState<DemoPatient[]>(INITIAL_DEMO_PATIENTS);
  const [pharmacyTasks, setPharmacyTasks] = useState<DemoPharmacyTask[]>(INITIAL_DEMO_PHARMACY_TASKS);
  const [currentToken, setCurrentToken] = useState<DemoToken | null>(INITIAL_DEMO_TOKENS[1]);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Hardware Rotary Potency Dial
  const POTENCY_STEPS = [
    { label: 'Q (MT)', angle: -72, value: 'Q' },
    { label: '30 CH', angle: -36, value: '30' },
    { label: '200 CH', angle: 0, value: '200' },
    { label: '1M', angle: 36, value: '1M' },
    { label: '10M', angle: 72, value: '10M' }
  ];
  const [selectedPotencyIndex, setSelectedPotencyIndex] = useState(2); // Default: 200 CH
  const [selectedDosage, setSelectedDosage] = useState('BD');
  const [activeRemedies, setActiveRemedies] = useState<string[]>(['BRYONIA ALBA', 'RHUS TOXICODENDRON']);
  const [targetPatient, setTargetPatient] = useState<DemoPatient>(INITIAL_DEMO_PATIENTS[0]);

  // Slide to Confirm Dispatch State
  const [slideProgress, setSlideProgress] = useState(0);
  const [isDispatched, setIsDispatched] = useState(false);

  const handleRotateDial = (index: number) => {
    setSelectedPotencyIndex(index);
    playMechanicalTick();
    onNotify?.(`Potency dial locked at: ${POTENCY_STEPS[index].label}`);
  };

  const handleCallNext = () => {
    const waiting = tokens.filter(t => t.status === 'WAITING');
    if (waiting.length === 0) {
      onNotify?.('Console queue empty.');
      return;
    }
    const next = waiting[0];
    setTokens(prev => prev.map(t => {
      if (t.id === next.id) return { ...t, status: 'IN_PROGRESS' };
      if (currentToken && t.id === currentToken.id) return { ...t, status: 'DONE' };
      return t;
    }));
    setCurrentToken(next);
    playMechanicalTick();
    onNotify?.(`[GLYPH] CALLED UNIT #${next.tokenNumber} -> CABIN 1`);
  };

  const handleAddRemedy = (med: string) => {
    if (activeRemedies.includes(med)) {
      onNotify?.(`${med} already loaded in cartridge.`);
      return;
    }
    if (activeRemedies.length >= 5) {
      onNotify?.('Formula cartridge capacity reached (max 5).');
      return;
    }
    setActiveRemedies(prev => [...prev, med]);
    playMechanicalTick();
    onNotify?.(`Loaded ${med} into cartridge.`);
  };

  const handleRemoveRemedy = (med: string) => {
    setActiveRemedies(prev => prev.filter(m => m !== med));
    playMechanicalTick();
  };

  const handleSlideComplete = () => {
    if (activeRemedies.length === 0) {
      onNotify?.('Cannot dispatch: Formula cartridge is empty!');
      return;
    }
    setIsDispatched(true);
    playMechanicalTick();
    
    const newTask: DemoPharmacyTask = {
      id: `task-${Date.now()}`,
      tokenNumber: currentToken?.tokenNumber || 77,
      patientName: targetPatient.name,
      cardNumber: targetPatient.cardNumber,
      doctorName: 'Dr. Rajdeep',
      status: 'PENDING',
      timeAgo: 'Just now',
      bottlesCount: 1,
      medicines: [
        {
          groupPower: POTENCY_STEPS[selectedPotencyIndex].value,
          dosage: selectedDosage,
          names: [...activeRemedies]
        }
      ]
    };

    setPharmacyTasks(prev => [newTask, ...prev]);
    onNotify?.(`[TRANSMITTED] Prescription committed to pharmacy stack.`);
    
    setTimeout(() => {
      setIsDispatched(false);
      setSlideProgress(0);
      setActiveTab('dispense');
    }, 1000);
  };

  const handleAdvanceTask = (taskId: string) => {
    setPharmacyTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task;
      if (task.status === 'PENDING') return { ...task, status: 'PREPARING', claimedBy: 'Dispensary Bay 1' };
      if (task.status === 'PREPARING') return { ...task, status: 'READY' };
      if (task.status === 'READY') return { ...task, status: 'DELIVERED' };
      return task;
    }));
    playMechanicalTick();
    onNotify?.('Dispensary stage updated.');
  };

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.cardNumber.includes(searchQuery)
  );

  return (
    <div className="min-h-screen w-full bg-[#0D0D0D] text-white font-mono pb-36 selection:bg-[#FF2A1B] selection:text-white">
      {/* Dot-matrix Grid Background Canvas */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.14] z-0"
        style={{
          backgroundImage: 'radial-gradient(#555 1px, transparent 1px)',
          backgroundSize: '16px 16px'
        }}
      />

      <div className="relative z-10 px-4 pt-4 max-w-md mx-auto space-y-4">
        
        {/* ── NOTHING HARDWARE CHASSIS HEADER ── */}
        <div className="bg-[#141414] border border-[#262626] rounded-3xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)] relative overflow-hidden">
          {/* Glyph Light Strip Simulation (Glowing edge bar) */}
          <div className="absolute top-0 inset-x-8 h-[2px] bg-gradient-to-r from-transparent via-[#FF2A1B] to-transparent shadow-[0_0_12px_#FF2A1B]" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF2A1B] animate-ping" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tracking-widest text-[#FF2A1B] uppercase font-bold">
                    (GLYPH) OS-01
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#222] text-slate-400 border border-[#333]">
                    TE-SYNTH
                  </span>
                </div>
                <h1 className="text-sm font-bold tracking-tight text-white mt-0.5">
                  CABIN 1 • DR. RAJDEEP
                </h1>
              </div>
            </div>

            {/* Authentic 7-Segment Digital Readout for Active Token */}
            <div className="flex items-center gap-1.5 bg-[#080808] px-3 py-1.5 rounded-2xl border border-[#222]">
              <span className="text-[9px] text-[#666] tracking-tighter uppercase mr-1">UNIT</span>
              {currentToken ? (
                currentToken.tokenNumber.toString().padStart(2, '0').split('').map((char, idx) => (
                  <SevenSegmentDigit key={idx} digit={char} />
                ))
              ) : (
                <>
                  <SevenSegmentDigit digit={0} />
                  <SevenSegmentDigit digit={0} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── MECHANICAL NAVIGATION MATRIX ── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: 'console', label: '01/CONSOLE', icon: Terminal },
            { id: 'patients', label: '02/REGISTRY', icon: Radio },
            { id: 'potency', label: '03/POTENCY', icon: Sliders },
            { id: 'dispense', label: '04/DISPENSE', icon: Disc },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as typeof activeTab);
                  playMechanicalTick();
                }}
                className={`py-2 px-1 rounded-2xl border text-[10px] font-bold tracking-wider flex flex-col items-center justify-center gap-1 transition-all ${
                  isActive
                    ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                    : 'bg-[#141414] text-[#888] border-[#262626] hover:text-white hover:border-[#444]'
                }`}
              >
                <Icon size={14} />
                <span className="text-[9px]">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── TAB 1: HARDWARE CONSOLE QUEUE ── */}
        {activeTab === 'console' && (
          <div className="space-y-4">
            {/* Active Channel Monolith */}
            {currentToken ? (
              <div className="bg-[#141414] border border-[#2a2a2a] rounded-3xl p-4 shadow-xl relative">
                <div className="flex items-center justify-between text-[10px] text-[#666] pb-2 border-b border-[#222]">
                  <span>CURRENT TRANSMISSION</span>
                  <span className="text-[#FF2A1B] flex items-center gap-1 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF2A1B] animate-pulse" />
                    LIVE
                  </span>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-wide uppercase">
                      {currentToken.patientName}
                    </h2>
                    <p className="text-xs text-[#888] mt-0.5">
                      CARD NO: {currentToken.cardNumber} • {currentToken.department}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#666] block">WAIT TIME</span>
                    <span className="text-xs font-bold text-[#FF2A1B]">~{currentToken.waitTimeMinutes}m</span>
                  </div>
                </div>

                <button
                  onClick={handleCallNext}
                  className="w-full py-3 bg-[#FF2A1B] hover:bg-[#e02417] text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,42,27,0.4)] active:scale-95 transition-all"
                >
                  <Volume2 size={14} />
                  <span>CALL NEXT IN QUEUE</span>
                </button>
              </div>
            ) : null}

            {/* Analog Stack List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-[#888] px-1 uppercase tracking-wider">
                <span>RESERVED QUEUE ({tokens.filter(t => t.status === 'WAITING').length})</span>
                <span>STATUS</span>
              </div>

              {tokens.filter(t => t.status === 'WAITING').map((token) => (
                <div
                  key={token.id}
                  className="bg-[#141414] hover:bg-[#1a1a1a] border border-[#222] hover:border-[#333] rounded-2xl p-3 flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-[#0a0a0a] px-2 py-1 rounded-xl border border-[#222]">
                      <span className="text-[9px] text-[#FF2A1B] font-bold">#</span>
                      <span className="text-xs font-bold text-white font-mono">{token.tokenNumber}</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white uppercase">{token.patientName}</div>
                      <div className="text-[10px] text-[#666]">CARD: #{token.cardNumber}</div>
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
                      playMechanicalTick();
                      onNotify?.(`SWITCHED TO UNIT #${token.tokenNumber}`);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-[#222] hover:bg-white hover:text-black text-xs text-white border border-[#333] transition-all"
                  >
                    ENGAGE
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 2: REGISTRY ARCHIVE ── */}
        {activeTab === 'patients' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#666]" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="QUERY PATIENT CARD / NAME..."
                className="w-full pl-9 pr-4 py-2.5 bg-[#141414] border border-[#262626] rounded-2xl text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#FF2A1B]"
              />
            </div>

            <div className="space-y-2.5">
              {filteredPatients.map(patient => (
                <div
                  key={patient.cardNumber}
                  className="bg-[#141414] border border-[#262626] rounded-3xl p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white uppercase">{patient.name}</span>
                        <span className="text-[10px] text-[#FF2A1B] border border-[#FF2A1B]/40 px-1.5 rounded">
                          #{patient.cardNumber}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#777] mt-0.5">
                        {patient.age}Y • {patient.gender} • {patient.address}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setTargetPatient(patient);
                        setActiveTab('potency');
                        playMechanicalTick();
                        onNotify?.(`TARGET SET: ${patient.name}`);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-white text-black font-bold text-[10px] uppercase hover:bg-slate-200 transition-all"
                    >
                      SYNTH RX
                    </button>
                  </div>

                  {patient.chronicCondition && (
                    <div className="text-[10px] text-emerald-400 bg-[#0a0a0a] p-2 rounded-xl border border-[#1f1f1f]">
                      DIAGNOSIS: {patient.chronicCondition}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: ROTARY POTENCY JOG-DIAL & SLIDE-TO-CONFIRM ── */}
        {activeTab === 'potency' && (
          <div className="space-y-4">
            {/* Hardware Module Header */}
            <div className="bg-[#141414] border border-[#262626] rounded-3xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[9px] text-[#666] tracking-widest uppercase">RECEIVER UNIT</span>
                <h3 className="font-bold text-sm text-white uppercase">{targetPatient.name}</h3>
                <span className="text-[10px] text-[#888]">CARD: #{targetPatient.cardNumber}</span>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            </div>

            {/* MECHANICAL ROTARY JOG DIAL CONTAINER */}
            <div className="bg-[#141414] border border-[#262626] rounded-3xl p-5 text-center relative overflow-hidden shadow-2xl">
              <div className="text-[10px] uppercase tracking-widest text-[#777] mb-2">
                MECHANICAL POTENCY JOG-DIAL
              </div>

              {/* Current Dial Readout */}
              <div className="text-2xl font-black text-white tracking-widest mb-4">
                {POTENCY_STEPS[selectedPotencyIndex].label}
              </div>

              {/* Rotary Wheel Visualization */}
              <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
                {/* Outer Calibration Ring */}
                <div className="absolute inset-0 rounded-full border border-[#2a2a2a] flex items-center justify-center">
                  <div className="w-full h-full rounded-full border border-dashed border-[#333]" />
                </div>

                {/* Rotating Knob with Knurled Texture */}
                <motion.div
                  animate={{ rotate: POTENCY_STEPS[selectedPotencyIndex].angle }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="w-32 h-32 rounded-full bg-gradient-to-b from-[#222] to-[#0f0f0f] border-2 border-[#3a3a3a] shadow-[0_8px_20px_rgba(0,0,0,0.9)] flex items-center justify-center relative cursor-pointer"
                >
                  {/* Red Pointer Line */}
                  <div className="absolute top-2 w-1.5 h-6 bg-[#FF2A1B] rounded-full shadow-[0_0_8px_#FF2A1B]" />
                  {/* Center Aluminum Cap */}
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#111] via-[#222] to-[#111] border border-[#444] flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-[#FF2A1B]" />
                  </div>
                </motion.div>
              </div>

              {/* Potency Tap Notch Buttons */}
              <div className="flex justify-between items-center gap-1 mt-4 pt-4 border-t border-[#222]">
                {POTENCY_STEPS.map((step, idx) => (
                  <button
                    key={step.value}
                    onClick={() => handleRotateDial(idx)}
                    className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                      selectedPotencyIndex === idx
                        ? 'bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.3)]'
                        : 'bg-[#0a0a0a] text-[#777] border border-[#222] hover:text-white'
                    }`}
                  >
                    {step.value}
                  </button>
                ))}
              </div>
            </div>

            {/* Dosage Selector & Active Formula Cartridge */}
            <div className="bg-[#141414] border border-[#262626] rounded-3xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-[#777] tracking-wider">CARTRIDGE REMEDIES ({activeRemedies.length}/5)</span>
                {/* Dosage Selector */}
                <div className="flex gap-1">
                  {['OD', 'BD', 'TDS', 'HS'].map(d => (
                    <button
                      key={d}
                      onClick={() => {
                        setSelectedDosage(d);
                        playMechanicalTick();
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        selectedDosage === d ? 'bg-[#FF2A1B] text-white' : 'bg-[#222] text-[#777]'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                {activeRemedies.map(med => (
                  <div
                    key={med}
                    className="flex items-center justify-between p-2 rounded-xl bg-[#0a0a0a] border border-[#222]"
                  >
                    <span className="text-xs font-bold text-white">{med}</span>
                    <button
                      onClick={() => handleRemoveRemedy(med)}
                      className="text-[#666] hover:text-red-400 p-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Quick Add Chips */}
              <div className="pt-2 border-t border-[#222] flex flex-wrap gap-1">
                {COMMON_HOMEO_MEDS.slice(0, 6).map(m => (
                  <button
                    key={m}
                    onClick={() => handleAddRemedy(m)}
                    className="text-[9px] px-2 py-1 rounded-lg bg-[#1c1c1c] hover:bg-[#2c2c2c] text-[#aaa] hover:text-white border border-[#2a2a2a]"
                  >
                    + {m}
                  </button>
                ))}
              </div>
            </div>

            {/* ── MECHANICAL SLIDE-TO-CONFIRM SAFETY SWITCH ── */}
            <div className="bg-[#141414] border border-[#262626] rounded-3xl p-4 shadow-xl">
              <div className="text-[10px] uppercase tracking-widest text-[#777] mb-2 flex items-center justify-between">
                <span>SAFETY DISPATCH INTERLOCK</span>
                <span className="text-[#FF2A1B] flex items-center gap-1"><Lock size={10} /> SLIDE TO FIRE</span>
              </div>

              {/* Slider Track */}
              <div className="relative h-14 bg-[#0a0a0a] rounded-2xl border border-[#333] flex items-center p-1 overflow-hidden">
                {/* Grooved industrial texture lines */}
                <div className="absolute inset-0 opacity-10 flex justify-around items-center pointer-events-none">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="w-[1px] h-6 bg-white" />
                  ))}
                </div>

                {/* Background Slider Label */}
                <div className="absolute inset-0 flex items-center justify-center text-xs tracking-widest text-[#555] pointer-events-none uppercase font-bold">
                  {isDispatched ? 'TRANSMITTING...' : '>>> DRAG TO DISPENSE >>>'}
                </div>

                {/* Draggable Red Slider Knob */}
                <motion.div
                  drag="x"
                  dragConstraints={{ left: 0, right: 280 }}
                  dragElastic={0.05}
                  onDrag={(_, info) => {
                    if (info.offset.x > 220 && !isDispatched) {
                      handleSlideComplete();
                    }
                  }}
                  className="w-16 h-12 rounded-xl bg-[#FF2A1B] text-white flex items-center justify-center font-black cursor-grab active:cursor-grabbing shadow-[0_0_15px_#FF2A1B] relative z-10"
                >
                  <ArrowRight size={18} />
                </motion.div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: DISPENSE PROTOCOL LOG ── */}
        {activeTab === 'dispense' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] text-[#888] px-1 uppercase tracking-wider">
              <span>ACTIVE BATCHES</span>
              <span className="text-[#FF2A1B]">
                {pharmacyTasks.filter(t => t.status === 'READY').length} UNITS READY
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
                    className={`rounded-3xl p-3.5 border transition-all ${
                      isReady
                        ? 'bg-[#181818] border-[#FF2A1B] shadow-[0_0_15px_rgba(255,42,27,0.2)]'
                        : isPreparing
                        ? 'bg-[#141414] border-white/20'
                        : isDelivered
                        ? 'bg-[#0a0a0a] border-[#222] opacity-40'
                        : 'bg-[#141414] border-[#222]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-[#0a0a0a] text-[#FF2A1B] font-bold text-xs border border-[#333]">
                            #{task.tokenNumber}
                          </span>
                          <span className="font-bold text-xs text-white uppercase">{task.patientName}</span>
                        </div>
                        <div className="text-[10px] text-[#666] mt-0.5">CARD: #{task.cardNumber} • {task.timeAgo}</div>
                      </div>

                      <button
                        onClick={() => handleAdvanceTask(task.id)}
                        disabled={isDelivered}
                        className={`px-3 py-1 rounded-xl text-[10px] font-bold uppercase transition-all ${
                          isReady
                            ? 'bg-[#FF2A1B] text-white shadow-[0_0_10px_#FF2A1B]'
                            : isPreparing
                            ? 'bg-white text-black'
                            : isDelivered
                            ? 'bg-[#222] text-[#555]'
                            : 'bg-[#262626] text-white hover:bg-[#333]'
                        }`}
                      >
                        {isReady ? 'RELEASE' : isPreparing ? 'FINALIZE' : isDelivered ? 'RESOLVED' : 'INITIALIZE'}
                      </button>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-[#222] space-y-1">
                      {task.medicines.map((m, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] text-[#888]">
                          <span className="truncate max-w-[200px] text-slate-300">{m.names.join(' + ')}</span>
                          <span className="font-mono text-[#FF2A1B]">{m.groupPower} ({m.dosage})</span>
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
