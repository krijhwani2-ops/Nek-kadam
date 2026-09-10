import React, { useState } from 'react';
import { Search, UserPlus, Phone, MapPin, Calendar, Stethoscope, ChevronRight, RefreshCw, Sparkles, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DemoPatient, INITIAL_DEMO_PATIENTS } from '../demoData';
import { BottomSheet } from '../components/BottomSheet';

interface DemoPatientsScreenProps {
  onSelectPatientToPrescribe: (patient: DemoPatient) => void;
}

export const DemoPatientsScreen: React.FC<DemoPatientsScreenProps> = ({
  onSelectPatientToPrescribe,
}) => {
  const [patients, setPatients] = useState<DemoPatient[]>(INITIAL_DEMO_PATIENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CHRONIC' | 'RECENT'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<DemoPatient | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 700);
  };

  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.cardNumber.includes(searchQuery) ||
      p.phone.includes(searchQuery);

    if (!matchesSearch) return false;
    if (activeFilter === 'CHRONIC') return Boolean(p.chronicCondition);
    if (activeFilter === 'RECENT') return p.recentVisitsCount >= 4;
    return true;
  });

  return (
    <div className="space-y-4 pb-20">
      {/* Search Bar & Register FAB */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Card #, Name, Phone..."
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Clear
            </button>
          )}
        </div>

        {/* Pull to refresh simulation */}
        <motion.button
          whileTap={{ scale: 0.9, rotate: 180 }}
          onClick={handleRefresh}
          className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-sm shrink-0 active:bg-slate-100 dark:active:bg-slate-800"
          title="Refresh List"
        >
          <RefreshCw size={18} className={isRefreshing ? 'animate-spin text-emerald-500' : ''} />
        </motion.button>
      </div>

      {/* Filter Chips (Thumb Friendly Horizontal Scroll) */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(['ALL', 'CHRONIC', 'RECENT'] as const).map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider uppercase transition-all shrink-0 border ${
                isActive
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
              }`}
            >
              {filter === 'ALL' ? `All Records (${patients.length})` : filter}
            </button>
          );
        })}
      </div>

      {/* Patients Card Stream with AnimatePresence */}
      <div className="space-y-2.5">
        <AnimatePresence mode="popLayout">
          {filteredPatients.map((patient) => {
            const isExpanded = expandedCard === patient.cardNumber;

            return (
              <motion.div
                key={patient.cardNumber}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-800 transition-all overflow-hidden"
              >
                {/* Top Row: Card # Badge, Name, Expand Toggle */}
                <div
                  onClick={() => setExpandedCard(isExpanded ? null : patient.cardNumber)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex flex-col items-center justify-center font-black shrink-0 border border-emerald-200/60 dark:border-emerald-800/40">
                      <span className="text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 leading-none">
                        CARD
                      </span>
                      <span className="text-sm font-black leading-tight">{patient.cardNumber}</span>
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                        {patient.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                        <span>{patient.age} yrs</span>
                        <span>•</span>
                        <span>{patient.gender}</span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {patient.doctorName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ChevronRight size={18} />
                  </motion.div>
                </div>

                {/* Collapsible Details Drawer */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3"
                    >
                      {patient.chronicCondition && (
                        <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30 text-xs">
                          <span className="font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider text-[10px] block mb-0.5">
                            Active Clinical Notes
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {patient.chronicCondition}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">{patient.address}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400 shrink-0" />
                          <span>Last: {patient.lastVisitDate}</span>
                        </div>
                      </div>

                      {/* Action Buttons with 48dp ergonomics */}
                      <div className="flex gap-2 pt-1">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPatient(patient);
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl font-black text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
                        >
                          View History ({patient.recentVisitsCount})
                        </motion.button>

                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPatientToPrescribe(patient);
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl font-black text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Stethoscope size={14} />
                          Prescribe
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Patient History Bottom Sheet */}
      <BottomSheet
        isOpen={Boolean(selectedPatient)}
        onClose={() => setSelectedPatient(null)}
        title={selectedPatient?.name}
        subtitle={`Card #${selectedPatient?.cardNumber} • ${selectedPatient?.recentVisitsCount} Lifetime Visits`}
      >
        {selectedPatient && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">
                Latest Prescribed Prescription ({selectedPatient.lastVisitDate})
              </span>
              <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                {selectedPatient.lastPrescription}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Patient Contact & Demographics
              </h4>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl space-y-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                <p><strong className="text-slate-900 dark:text-slate-100">Phone:</strong> {selectedPatient.phone || 'None'}</p>
                <p><strong className="text-slate-900 dark:text-slate-100">Address:</strong> {selectedPatient.address}</p>
                <p><strong className="text-slate-900 dark:text-slate-100">Consulting Doctor:</strong> {selectedPatient.doctorName}</p>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const p = selectedPatient;
                setSelectedPatient(null);
                onSelectPatientToPrescribe(p);
              }}
              className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
            >
              <Stethoscope size={16} />
              Open Consultation Desk For {selectedPatient.name.split(' ')[0]}
            </motion.button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
