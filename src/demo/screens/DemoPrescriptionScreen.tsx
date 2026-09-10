import React, { useState } from 'react';
import { Plus, Trash2, RotateCcw, Send, CheckCircle2, Search, Sparkles, X, Stethoscope } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DemoPatient, DEMO_HOMEOPATHIC_MEDICINES } from '../demoData';
import { BottomSheet } from '../components/BottomSheet';

interface PrescribedGroup {
  id: string;
  power: string;
  dosage: string;
  medicines: string[];
}

interface DemoPrescriptionScreenProps {
  selectedPatient: DemoPatient;
  onPrescriptionSaved: (summary: string) => void;
  onBackToPatients: () => void;
}

const COMMON_POTENCIES = ['Q', '30', '200', '1M', '10M'];
const COMMON_DOSAGES = [
  { code: 'OD', desc: 'Once daily' },
  { code: 'BD', desc: 'Twice daily' },
  { code: 'TDS', desc: 'Thrice daily' },
  { code: 'HS', desc: 'Bedtime' },
  { code: 'SOS', desc: 'Emergency' },
];

export const DemoPrescriptionScreen: React.FC<DemoPrescriptionScreenProps> = ({
  selectedPatient,
  onPrescriptionSaved,
  onBackToPatients,
}) => {
  const [groups, setGroups] = useState<PrescribedGroup[]>([
    {
      id: 'grp-1',
      power: '200',
      dosage: 'BD',
      medicines: ['BRYONIA ALBA', 'HEPAR SULPHURIS'],
    },
  ]);
  const [activeGroupId, setActiveGroupId] = useState<string>('grp-1');
  const [isMedSheetOpen, setIsMedSheetOpen] = useState(false);
  const [medSearchQuery, setMedSearchQuery] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Add new group
  const handleAddGroup = () => {
    const newId = `grp-${Date.now()}`;
    const newGroup: PrescribedGroup = {
      id: newId,
      power: '200',
      dosage: 'BD',
      medicines: [],
    };
    setGroups([...groups, newGroup]);
    setActiveGroupId(newId);
  };

  // Remove group
  const handleRemoveGroup = (id: string) => {
    if (groups.length <= 1) return;
    const filtered = groups.filter((g) => g.id !== id);
    setGroups(filtered);
    if (activeGroupId === id) {
      setActiveGroupId(filtered[0].id);
    }
  };

  // Select medicine from sheet
  const handleSelectMed = (medName: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === activeGroupId && !g.medicines.includes(medName)) {
          return { ...g, medicines: [...g.medicines, medName] };
        }
        return g;
      })
    );
    setIsMedSheetOpen(false);
    setMedSearchQuery('');
  };

  // Remove medicine from a group
  const handleRemoveMedFromGroup = (groupId: string, medName: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          return { ...g, medicines: g.medicines.filter((m) => m !== medName) };
        }
        return g;
      })
    );
  };

  // Repeat Last Rx
  const handleRepeatLastRx = () => {
    if (!selectedPatient.lastPrescription) return;
    setGroups([
      {
        id: `grp-${Date.now()}-1`,
        power: '200',
        dosage: 'BD',
        medicines: ['BRYONIA ALBA', 'HEPAR SULPHURIS', 'ACONITUM NAPELLUS'],
      },
      {
        id: `grp-${Date.now()}-2`,
        power: '200',
        dosage: 'BD',
        medicines: ['RHUS TOXICODENDRON', 'DULCAMARA', 'PULSATILLA NIGRICANS'],
      },
    ]);
  };

  // Save Prescription
  const handleSavePrescription = () => {
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onPrescriptionSaved(`Dispatched to Pharmacy Desk for ${selectedPatient.name}`);
      onBackToPatients();
    }, 1200);
  };

  const filteredMedicines = DEMO_HOMEOPATHIC_MEDICINES.filter((m) =>
    m.toLowerCase().includes(medSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-28">
      {/* Patient Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex flex-col items-center justify-center font-black shrink-0 shadow-md shadow-emerald-600/30">
            <span className="text-[9px] uppercase tracking-wider opacity-80">CARD</span>
            <span className="text-sm font-black">{selectedPatient.cardNumber}</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
              {selectedPatient.name}
            </h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {selectedPatient.age} yrs • {selectedPatient.gender} • Dr. Rajdeep
            </p>
          </div>
        </div>

        {/* Repeat Last Rx Fast Action */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleRepeatLastRx}
          className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-black flex items-center gap-1.5 shrink-0 shadow-sm"
          title="Repeat Previous Visit Prescription"
        >
          <RotateCcw size={13} />
          Repeat Last
        </motion.button>
      </div>

      {/* Prescription Groups Stream with Framer Motion Spring Layout */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Prescription Bottles ({groups.length})
          </span>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleAddGroup}
            className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
          >
            <Plus size={14} />
            + New Bottle Group
          </motion.button>
        </div>

        <AnimatePresence mode="popLayout">
          {groups.map((group, gIdx) => {
            const isActive = activeGroupId === group.id;

            return (
              <motion.div
                key={group.id}
                layout
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onClick={() => setActiveGroupId(group.id)}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all ${
                  isActive
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Group Header: Bottle Number & Remove */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-black flex items-center justify-center">
                      #{gIdx + 1}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      Bottle {gIdx + 1} Formulation
                    </span>
                  </div>

                  {groups.length > 1 && (
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveGroup(group.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      aria-label="Remove Bottle"
                    >
                      <Trash2 size={16} />
                    </motion.button>
                  )}
                </div>

                {/* Potency / Power Selector Chips */}
                <div className="mb-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                    Potency / Power
                  </span>
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                    {COMMON_POTENCIES.map((pot) => (
                      <button
                        key={pot}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGroups((prev) =>
                            prev.map((g) => (g.id === group.id ? { ...g, power: pot } : g))
                          );
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wider transition-all shrink-0 ${
                          group.power === pot
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {pot}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dosage Frequency Chips */}
                <div className="mb-3.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                    Frequency / Dosage
                  </span>
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                    {COMMON_DOSAGES.map((dos) => (
                      <button
                        key={dos.code}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGroups((prev) =>
                            prev.map((g) => (g.id === group.id ? { ...g, dosage: dos.code } : g))
                          );
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 ${
                          group.dosage === dos.code
                            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                        title={dos.desc}
                      >
                        {dos.code}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Medicines List in this Bottle */}
                <div className="space-y-1.5 mb-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Remedies Combined in this bottle ({group.medicines.length})
                  </span>

                  {group.medicines.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-1">
                      No medicines added yet. Tap "+ Add Medicine" below.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {group.medicines.map((med) => (
                        <span
                          key={med}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 text-xs font-black rounded-xl"
                        >
                          {med}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveMedFromGroup(group.id, med);
                            }}
                            className="text-emerald-700 hover:text-red-500 transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Medicine Trigger Button (48dp Touch Target) */}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveGroupId(group.id);
                    setIsMedSheetOpen(true);
                  }}
                  className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 rounded-xl text-xs font-black text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus size={15} className="text-emerald-500" />
                  Add Remedy to Bottle #{gIdx + 1}
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Clinical Notes */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
        <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1.5">
          Doctor Consultation Notes
        </label>
        <textarea
          value={clinicalNotes}
          onChange={(e) => setClinicalNotes(e.target.value)}
          placeholder="E.g., Follow-up in 2 weeks. Advised dietary restrictions for allergies..."
          rows={2}
          className="w-full p-3 text-xs font-semibold bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 dark:text-slate-200"
        />
      </div>

      {/* Floating Bottom Action Bar */}
      <div className="fixed bottom-16 inset-x-0 p-4 max-w-md mx-auto z-30 pointer-events-none">
        <div className="pointer-events-auto">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSavePrescription}
            disabled={savedSuccess}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all ${
              savedSuccess
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/40'
            }`}
          >
            {savedSuccess ? (
              <>
                <CheckCircle2 size={18} />
                Prescription Dispatched!
              </>
            ) : (
              <>
                <Send size={18} />
                Send to Pharmacy Desk
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Medicine Search Bottom Sheet Drawer */}
      <BottomSheet
        isOpen={isMedSheetOpen}
        onClose={() => setIsMedSheetOpen(false)}
        title="Search Homeopathic Medicines"
        subtitle="Tap any remedy to add to active bottle"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              autoFocus
              value={medSearchQuery}
              onChange={(e) => setMedSearchQuery(e.target.value)}
              placeholder="Search e.g. Arnica, Rhus Tox, Bryonia..."
              className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {filteredMedicines.map((med) => (
              <button
                key={med}
                type="button"
                onClick={() => handleSelectMed(med)}
                className="w-full text-left p-3 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 active:bg-emerald-100 flex items-center justify-between transition-colors group"
              >
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                  {med}
                </span>
                <Plus size={16} className="text-slate-400 group-hover:text-emerald-600" />
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
