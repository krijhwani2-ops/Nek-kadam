import React, { useState } from 'react';
import { 
  Ticket, 
  Users, 
  Sparkles, 
  Plus, 
  Trash2, 
  Search, 
  ArrowRight, 
  Check, 
  Clock, 
  Flame, 
  Volume2, 
  Zap, 
  Package, 
  HeartHandshake,
  Send,
  CheckCircle2
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

interface NeoPopBrutalistVariantProps {
  onNotify?: (msg: string) => void;
}

// Playful retro arcade sound synthesizer using Web Audio API
function playPopSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Pitch pop sweep (200Hz to 600Hz)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.12);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } catch {
    // Ignore audio restrictions
  }
}

export function NeoPopBrutalistVariant({ onNotify }: NeoPopBrutalistVariantProps) {
  const [activeTab, setActiveTab] = useState<'tickets' | 'patients' | 'rx' | 'dispatch'>('tickets');
  const [tokens, setTokens] = useState<DemoToken[]>(INITIAL_DEMO_TOKENS);
  const [patients, setPatients] = useState<DemoPatient[]>(INITIAL_DEMO_PATIENTS);
  const [pharmacyTasks, setPharmacyTasks] = useState<DemoPharmacyTask[]>(INITIAL_DEMO_PHARMACY_TASKS);
  const [currentToken, setCurrentToken] = useState<DemoToken | null>(INITIAL_DEMO_TOKENS[1]);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  
  // Prescription builder
  const [targetPatient, setTargetPatient] = useState<DemoPatient>(INITIAL_DEMO_PATIENTS[0]);
  const [selectedRemedies, setSelectedRemedies] = useState<string[]>(['BRYONIA ALBA', 'ACONITUM NAPELLUS']);
  const [potency, setPotency] = useState('200');
  const [frequency, setFrequency] = useState('BD');
  const [medFilter, setMedFilter] = useState('');

  // Call Next Token with Arcade Buzzer
  const handleCallNextTicket = () => {
    const waiting = tokens.filter(t => t.status === 'WAITING');
    if (waiting.length === 0) {
      onNotify?.('All patients have been served!');
      return;
    }
    const next = waiting[0];
    setTokens(prev => prev.map(t => {
      if (t.id === next.id) return { ...t, status: 'IN_PROGRESS' };
      if (currentToken && t.id === currentToken.id) return { ...t, status: 'DONE' };
      return t;
    }));
    setCurrentToken(next);
    playPopSound();
    onNotify?.(`📢 TICKET #${next.tokenNumber} PUNCHED FOR CABIN 1!`);
  };

  const handleAddRemedy = (med: string) => {
    if (selectedRemedies.includes(med)) {
      onNotify?.(`${med} already added!`);
      return;
    }
    if (selectedRemedies.length >= 5) {
      onNotify?.('Formula is full (max 5 remedies)!');
      return;
    }
    setSelectedRemedies(prev => [...prev, med]);
    setMedFilter('');
    playPopSound();
    onNotify?.(`+ ${med} snapped onto prescription!`);
  };

  const handleRemoveRemedy = (med: string) => {
    setSelectedRemedies(prev => prev.filter(m => m !== med));
    playPopSound();
  };

  const handleSendToPharmacy = () => {
    if (selectedRemedies.length === 0) {
      onNotify?.('Add at least one remedy first!');
      return;
    }
    const newTask: DemoPharmacyTask = {
      id: `task-${Date.now()}`,
      tokenNumber: currentToken?.tokenNumber || 99,
      patientName: targetPatient.name,
      cardNumber: targetPatient.cardNumber,
      doctorName: 'Dr. Rajdeep',
      status: 'PENDING',
      timeAgo: 'Just now',
      bottlesCount: 1,
      medicines: [
        {
          groupPower: potency,
          dosage: frequency,
          names: [...selectedRemedies]
        }
      ]
    };
    setPharmacyTasks(prev => [newTask, ...prev]);
    playPopSound();
    onNotify?.(`🚀 Stamped & dispatched to pharmacy dispatch!`);
    setActiveTab('dispatch');
  };

  const handleAdvanceTask = (taskId: string) => {
    setPharmacyTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task;
      if (task.status === 'PENDING') return { ...task, status: 'PREPARING', claimedBy: 'Pooja K.' };
      if (task.status === 'PREPARING') return { ...task, status: 'READY' };
      if (task.status === 'READY') return { ...task, status: 'DELIVERED' };
      return task;
    }));
    playPopSound();
    onNotify?.('Bottle package updated!');
  };

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.cardNumber.includes(searchQuery)
  );

  return (
    <div className="min-h-screen w-full bg-[#FDFBF7] text-black font-sans pb-36 selection:bg-[#D4FF00] selection:text-black">
      {/* Background polka-dots */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.06] z-0"
        style={{
          backgroundImage: 'radial-gradient(#000 1.5px, transparent 1.5px)',
          backgroundSize: '20px 20px'
        }}
      />

      <div className="relative z-10 px-4 pt-4 max-w-md mx-auto space-y-4">
        
        {/* ── NEO-POP MARQUEE BANNER ── */}
        <div className="bg-[#D4FF00] border-[3px] border-black rounded-3xl p-4 shadow-[5px_5px_0px_#000] relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#FF70A6] border-[2.5px] border-black shadow-[2px_2px_0px_#000] flex items-center justify-center font-black text-xl text-white">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-black text-white px-2 py-0.5 rounded-md">
                    NEK KADAM ARCADE
                  </span>
                  <span className="text-[10px] font-black bg-white text-black px-1.5 py-0.5 rounded-md border border-black">
                    LIVE CLINIC
                  </span>
                </div>
                <h1 className="text-base font-black tracking-tight text-black mt-0.5">
                  Dr. Rajdeep’s Cabin
                </h1>
              </div>
            </div>

            {/* Token Badge */}
            {currentToken && (
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-700 block">CURRENT</span>
                <span className="inline-block px-2.5 py-0.5 rounded-xl bg-black text-[#D4FF00] font-mono font-black text-sm shadow-[2px_2px_0px_#FF70A6]">
                  #{currentToken.tokenNumber}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── TACTILE PUSH NAVIGATION TABS ── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: 'tickets', label: 'Tickets', icon: Ticket, bg: 'bg-[#FFE600]', activeText: 'text-black' },
            { id: 'patients', label: 'Patients', icon: Users, bg: 'bg-[#C4B5FD]', activeText: 'text-black' },
            { id: 'rx', label: 'Pill Lab', icon: Sparkles, bg: 'bg-[#FF70A6]', activeText: 'text-white' },
            { id: 'dispatch', label: 'Dispatch', icon: Package, bg: 'bg-[#6EE7B7]', activeText: 'text-black' },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as typeof activeTab);
                  playPopSound();
                }}
                className={`p-2.5 rounded-2xl border-[3px] border-black font-black text-xs flex flex-col items-center justify-center gap-1 transition-all ${
                  isActive
                    ? `${tab.bg} shadow-[4px_4px_0px_#000] -translate-y-0.5 ${tab.activeText}`
                    : 'bg-white text-slate-700 shadow-[2px_2px_0px_#000] hover:bg-slate-50'
                } active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#000]`}
              >
                <Icon size={16} strokeWidth={2.5} />
                <span className="text-[11px] uppercase tracking-wider">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── TAB 1: PERFORATED TICKET STUBS ── */}
        {activeTab === 'tickets' && (
          <div className="space-y-4">
            {/* Master Ticket Caller Arcade Box */}
            <div className="bg-[#FFE600] border-[3px] border-black rounded-3xl p-4 shadow-[6px_6px_0px_#000] relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black uppercase tracking-wider bg-black text-[#FFE600] px-2 py-0.5 rounded-lg">
                  CABIN STAGE #1
                </span>
                <span className="text-xs font-mono font-bold text-black flex items-center gap-1">
                  <Clock size={12} /> Live Queue: {tokens.filter(t => t.status === 'WAITING').length} left
                </span>
              </div>

              {currentToken ? (
                <div className="bg-white border-[2.5px] border-black rounded-2xl p-3 mb-3 shadow-[3px_3px_0px_#000]">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Patient in Cabin</div>
                      <div className="text-base font-black text-black">{currentToken.patientName}</div>
                      <div className="text-[11px] font-mono text-slate-600">Card #{currentToken.cardNumber} • {currentToken.department}</div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-[#D4FF00] border-[2px] border-black flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_#000]">
                      #{currentToken.tokenNumber}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 font-bold text-sm">Cabin is currently free</div>
              )}

              {/* Big Punch Call Next Button */}
              <button
                onClick={handleCallNextTicket}
                className="w-full py-3.5 bg-black hover:bg-slate-900 text-[#D4FF00] border-[3px] border-black rounded-2xl font-black text-sm uppercase tracking-wider shadow-[4px_4px_0px_#FF70A6] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"
              >
                <Volume2 size={18} />
                <span>Punch Next Ticket!</span>
              </button>
            </div>

            {/* Perforated Ticket Stubs List */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  WAITING TICKETS STACK
                </h2>
                <span className="text-[11px] font-bold bg-[#C4B5FD] px-2 py-0.5 rounded-lg border border-black">
                  {tokens.filter(t => t.status === 'WAITING').length} IN LINE
                </span>
              </div>

              {tokens.filter(t => t.status === 'WAITING').map((token) => (
                <motion.div
                  key={token.id}
                  whileHover={{ scale: 1.01 }}
                  className="relative bg-white border-[3px] border-black rounded-2xl p-3.5 shadow-[4px_4px_0px_#000] overflow-hidden"
                >
                  {/* Perforated ticket cutout circle left & right */}
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#FDFBF7] border-[2.5px] border-black" />
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#FDFBF7] border-[2.5px] border-black" />

                  <div className="flex items-center justify-between pl-2 pr-2">
                    <div className="flex items-center gap-3">
                      {/* Big Chunky Ticket Number */}
                      <div className="w-11 h-11 rounded-2xl bg-[#C4B5FD] border-[2px] border-black flex flex-col items-center justify-center font-black text-black shadow-[2px_2px_0px_#000]">
                        <span className="text-[8px] uppercase">NO.</span>
                        <span className="text-sm -mt-1 font-mono">#{token.tokenNumber}</span>
                      </div>

                      {/* Perforation vertical dashed divider */}
                      <div className="h-9 border-r-[2px] border-dashed border-slate-300" />

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-black">{token.patientName}</span>
                          {token.priority === 'URGENT' && (
                            <span className="text-[9px] font-black bg-[#FF70A6] text-white px-1.5 py-0.2 rounded border border-black">
                              URGENT
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          Card: #{token.cardNumber} • ~{token.waitTimeMinutes}m wait
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
                        playPopSound();
                        onNotify?.(`Punched Token #${token.tokenNumber}`);
                      }}
                      className="px-3 py-1.5 bg-[#D4FF00] hover:bg-[#bdeb00] text-black border-[2px] border-black rounded-xl font-black text-[11px] shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1"
                    >
                      <span>Call</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>

                  {/* Fake Barcode Graphic */}
                  <div className="mt-2.5 pt-2 border-t-[1.5px] border-dashed border-slate-200 flex items-center justify-between text-[9px] font-mono text-slate-400">
                    <span className="tracking-widest font-black text-slate-700">||| | || |||| | ||| ||</span>
                    <span>NEK KADAM CLINIC TICKET</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 2: PATIENTS RETRO CARDS ── */}
        {activeTab === 'patients' && (
          <div className="space-y-3">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search patient name or card #..."
                className="w-full pl-10 pr-4 py-3 bg-white border-[3px] border-black rounded-2xl font-bold text-xs shadow-[4px_4px_0px_#000] focus:outline-none focus:bg-amber-50"
              />
            </div>

            {/* Patient Cards */}
            <div className="space-y-3">
              {filteredPatients.map(patient => (
                <div
                  key={patient.cardNumber}
                  className="bg-white border-[3px] border-black rounded-3xl p-4 shadow-[4px_4px_0px_#000] space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-black">{patient.name}</h3>
                        <span className="text-[10px] font-mono font-black bg-[#D4FF00] px-2 py-0.5 rounded-lg border border-black">
                          #{patient.cardNumber}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                        {patient.age} Yrs • {patient.gender} • {patient.address}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setTargetPatient(patient);
                        setActiveTab('rx');
                        playPopSound();
                        onNotify?.(`Loaded ${patient.name} into Pill Lab!`);
                      }}
                      className="px-3 py-1.5 bg-[#FF70A6] hover:bg-[#ff5695] text-white border-[2px] border-black rounded-xl font-black text-xs shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1"
                    >
                      <Sparkles size={13} />
                      <span>Prescribe</span>
                    </button>
                  </div>

                  {patient.chronicCondition && (
                    <div className="p-2 rounded-xl bg-[#C4B5FD]/40 border-[2px] border-black text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>🩺</span>
                      <span>{patient.chronicCondition}</span>
                    </div>
                  )}

                  {patient.lastPrescription && (
                    <div className="text-[10px] font-mono font-medium text-slate-700 bg-slate-100 p-2 rounded-xl border border-slate-300 truncate">
                      Last: {patient.lastPrescription}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: PILL LAB (MAGNETIC MEDICINE BUILDER) ── */}
        {activeTab === 'rx' && (
          <div className="space-y-4">
            {/* Target Patient Badge */}
            <div className="bg-[#C4B5FD] border-[3px] border-black rounded-3xl p-3.5 shadow-[4px_4px_0px_#000] flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase bg-black text-[#C4B5FD] px-2 py-0.5 rounded-md">
                  PRESCRIPTION FOR
                </span>
                <h2 className="text-base font-black text-black mt-1">{targetPatient.name}</h2>
                <div className="text-[10px] font-mono text-slate-800">Card: #{targetPatient.cardNumber} • Dr. Rajdeep</div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white border-[2px] border-black flex items-center justify-center font-black text-lg">
                💊
              </div>
            </div>

            {/* Active Formula Board */}
            <div className="bg-white border-[3px] border-black rounded-3xl p-4 shadow-[5px_5px_0px_#000] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-black">
                  ACTIVE BOTTLE FORMULA ({selectedRemedies.length}/5)
                </span>
                <span className="text-[10px] font-bold bg-[#D4FF00] px-2 py-0.5 rounded-lg border border-black">
                  {potency} CH • {frequency}
                </span>
              </div>

              {/* Medicine Magnetic Stickers */}
              <div className="space-y-2">
                {selectedRemedies.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 font-bold text-xs">
                    Tap remedies below to add to bottle!
                  </div>
                ) : (
                  selectedRemedies.map((med, index) => {
                    const colors = ['bg-[#D4FF00]', 'bg-[#FF70A6] text-white', 'bg-[#C4B5FD]', 'bg-[#FFE600]', 'bg-[#6EE7B7]'];
                    const colorClass = colors[index % colors.length];
                    return (
                      <motion.div
                        key={med}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border-[2.5px] border-black shadow-[3px_3px_0px_#000] ${colorClass}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs">#{index + 1}</span>
                          <span className="font-black text-xs">{med}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveRemedy(med)}
                          className="p-1 rounded-lg bg-black text-white hover:bg-red-600 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Potency & Dosage Selector */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t-[2px] border-black">
                {/* Potency */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">POTENCY</label>
                  <div className="flex gap-1">
                    {['30', '200', '1M', '10M'].map(p => (
                      <button
                        key={p}
                        onClick={() => {
                          setPotency(p);
                          playPopSound();
                        }}
                        className={`flex-1 py-1 rounded-xl text-[11px] font-mono font-black border-[2px] border-black transition-all ${
                          potency === p 
                            ? 'bg-black text-[#D4FF00] shadow-[2px_2px_0px_#FF70A6]' 
                            : 'bg-white text-black hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dosage */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">DOSAGE (FREQ)</label>
                  <div className="flex gap-1">
                    {['OD', 'BD', 'TDS', 'HS'].map(d => (
                      <button
                        key={d}
                        onClick={() => {
                          setFrequency(d);
                          playPopSound();
                        }}
                        className={`flex-1 py-1 rounded-xl text-[11px] font-mono font-black border-[2px] border-black transition-all ${
                          frequency === d 
                            ? 'bg-[#FF70A6] text-white shadow-[2px_2px_0px_#000]' 
                            : 'bg-white text-black hover:bg-slate-100'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Remedy Catalog Chips */}
            <div className="bg-[#FFE600] border-[3px] border-black rounded-3xl p-3.5 shadow-[4px_4px_0px_#000]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-black">HOMOEO REMEDIES REEL</span>
                <input
                  type="text"
                  value={medFilter}
                  onChange={e => setMedFilter(e.target.value)}
                  placeholder="Filter remedy..."
                  className="w-28 px-2 py-0.5 rounded-lg bg-white border-[2px] border-black text-[10px] font-bold text-black focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {COMMON_HOMEO_MEDS.filter(m => m.toLowerCase().includes(medFilter.toLowerCase())).slice(0, 8).map(med => (
                  <button
                    key={med}
                    onClick={() => handleAddRemedy(med)}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#D4FF00] border-[2px] border-black text-[10px] font-black text-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1"
                  >
                    <Plus size={10} strokeWidth={3} />
                    <span>{med}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Stamp & Beam to Pharmacy */}
            <button
              onClick={handleSendToPharmacy}
              className="w-full py-4 bg-[#D4FF00] hover:bg-[#c2eb00] text-black border-[3px] border-black rounded-2xl font-black text-sm uppercase tracking-wider shadow-[6px_6px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-[1px_1px_0px_#000] transition-all flex items-center justify-center gap-2"
            >
              <Send size={18} strokeWidth={2.5} />
              <span>STAMP & TRANSMIT TO PHARMACY</span>
            </button>
          </div>
        )}

        {/* ── TAB 4: DISPATCH / PHARMACY QUEUE ── */}
        {activeTab === 'dispatch' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                PHARMACY PACKAGING ORDERS
              </span>
              <span className="text-[11px] font-black bg-[#D4FF00] px-2 py-0.5 rounded-lg border border-black">
                {pharmacyTasks.filter(t => t.status === 'READY').length} READY
              </span>
            </div>

            <div className="space-y-3">
              {pharmacyTasks.map(task => {
                const isReady = task.status === 'READY';
                const isDelivered = task.status === 'DELIVERED';
                const isPreparing = task.status === 'PREPARING';

                return (
                  <div
                    key={task.id}
                    className={`border-[3px] border-black rounded-3xl p-4 shadow-[4px_4px_0px_#000] transition-all ${
                      isReady 
                        ? 'bg-[#D4FF00]' 
                        : isPreparing
                        ? 'bg-[#C4B5FD]'
                        : isDelivered
                        ? 'bg-slate-100 opacity-60'
                        : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-xl bg-black text-white font-mono font-black text-xs flex items-center justify-center">
                            #{task.tokenNumber}
                          </span>
                          <div>
                            <div className="font-black text-sm text-black">{task.patientName}</div>
                            <div className="text-[10px] font-mono text-slate-700">Card: #{task.cardNumber} • {task.timeAgo}</div>
                          </div>
                        </div>
                      </div>

                      {/* Rubber Stamp Button */}
                      <button
                        onClick={() => handleAdvanceTask(task.id)}
                        disabled={isDelivered}
                        className={`px-3 py-1.5 rounded-xl border-[2px] border-black font-black text-[11px] uppercase tracking-wider shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all ${
                          isReady 
                            ? 'bg-black text-[#D4FF00]' 
                            : isPreparing
                            ? 'bg-black text-white'
                            : isDelivered
                            ? 'bg-slate-300 text-slate-600 cursor-default'
                            : 'bg-[#FF70A6] text-white'
                        }`}
                      >
                        {isReady ? 'Deliver ✓' : isPreparing ? 'Pack Ready' : isDelivered ? 'Handed Over' : 'Start Pack'}
                      </button>
                    </div>

                    {/* Prescription Details */}
                    <div className="mt-3 pt-2 border-t-[2px] border-dashed border-black/30 space-y-1">
                      {task.medicines.map((m, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px]">
                          <span className="font-black text-black truncate max-w-[200px]">
                            {m.names.join(' + ')}
                          </span>
                          <span className="font-mono font-black text-slate-800">
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
