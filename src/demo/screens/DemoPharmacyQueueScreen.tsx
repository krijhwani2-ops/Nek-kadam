import React, { useState } from 'react';
import { Pill, CheckCircle2, Clock, Check, Sparkles, ChevronRight, User, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DemoPharmacyTask, INITIAL_DEMO_TASKS } from '../demoData';

export const DemoPharmacyQueueScreen: React.FC = () => {
  const [tasks, setTasks] = useState<DemoPharmacyTask[]>(INITIAL_DEMO_TASKS);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'PREPARING' | 'READY'>('ALL');

  // Advance task state
  const handleAdvanceTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          if (t.status === 'PENDING') {
            return { ...t, status: 'PREPARING', claimedBy: 'You (Pharmacist)' };
          }
          if (t.status === 'PREPARING') {
            return { ...t, status: 'READY' };
          }
          if (t.status === 'READY') {
            return { ...t, status: 'DELIVERED' };
          }
        }
        return t;
      })
    );
  };

  const filteredTasks = tasks.filter((t) => {
    if (activeFilter === 'ALL') return t.status !== 'DELIVERED';
    return t.status === activeFilter;
  });

  return (
    <div className="space-y-4 pb-24">
      {/* Pharmacy Status Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-600/20 flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-black tracking-widest text-emerald-200 block mb-1">
            Active Dispensary Desk
          </span>
          <h2 className="text-xl font-black tracking-tight">
            {tasks.filter((t) => t.status !== 'DELIVERED').length} Prescriptions in Queue
          </h2>
          <p className="text-xs text-emerald-100 font-semibold mt-0.5">
            Average preparation speed: 3.5 mins / order
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0">
          <Pill size={24} className="text-white" />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {(['ALL', 'PENDING', 'PREPARING', 'READY'] as const).map((filter) => {
          const isActive = activeFilter === filter;
          const count =
            filter === 'ALL'
              ? tasks.filter((t) => t.status !== 'DELIVERED').length
              : tasks.filter((t) => t.status === filter).length;

          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider uppercase transition-all shrink-0 border ${
                isActive
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
              }`}
            >
              {filter} ({count})
            </button>
          );
        })}
      </div>

      {/* Tasks Queue Cards with Spring Layout Animations */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredTasks.map((task) => {
            const isReady = task.status === 'READY';
            const isPreparing = task.status === 'PREPARING';
            const isPending = task.status === 'PENDING';

            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border shadow-sm transition-all ${
                  isReady
                    ? 'border-emerald-500 bg-emerald-50/20'
                    : isPreparing
                    ? 'border-amber-400 bg-amber-50/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Header: Token # & Status Badge */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black px-2.5 py-1 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-xl">
                      Token #{task.tokenNumber}
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      Card {task.cardNumber}
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      isReady
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                        : isPreparing
                        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300'
                    }`}
                  >
                    {task.status}
                  </span>
                </div>

                {/* Patient Name & Doctor */}
                <div className="mb-3">
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    {task.patientName}
                  </h3>
                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>Prescribed by {task.doctorName}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {task.timeAgo}
                    </span>
                  </div>
                </div>

                {/* Medicine Formulations Breakdown */}
                <div className="space-y-2 mb-4 p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-150 dark:border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Compounding Instructions ({task.bottlesCount} Bottles)
                  </span>

                  {task.medicines.map((mGroup, idx) => (
                    <div key={idx} className="space-y-0.5 text-xs">
                      <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-300">
                        <span className="text-emerald-700 dark:text-emerald-400 font-black">
                          Bottle #{idx + 1} ({mGroup.groupPower}):
                        </span>
                        <span className="text-[11px] text-slate-500">{mGroup.dosage}</span>
                      </div>
                      <p className="font-mono text-slate-800 dark:text-slate-200 text-xs pl-2 font-semibold">
                        {mGroup.names.join(' + ')}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Claim / Action Button (48dp Touch Target) */}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleAdvanceTask(task.id)}
                  className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all ${
                    isPending
                      ? 'bg-slate-900 hover:bg-slate-800 text-white'
                      : isPreparing
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                  }`}
                >
                  {isPending ? (
                    <>Claim & Start Compounding</>
                  ) : isPreparing ? (
                    <>
                      <Check size={16} /> Mark Formulation as Ready
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Hand Over & Complete
                    </>
                  )}
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredTasks.length === 0 && (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
              No Pending Prescriptions
            </h4>
            <p className="text-xs text-slate-400">All dispensary orders are up to date.</p>
          </div>
        )}
      </div>
    </div>
  );
};
