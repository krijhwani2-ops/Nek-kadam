import React, { useState } from 'react';
import { Ticket, Megaphone, SkipForward, Play, Plus, Clock, Users, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DemoToken, INITIAL_DEMO_TOKENS } from '../demoData';
import { BottomSheet } from '../components/BottomSheet';

export const DemoTokenDeskScreen: React.FC = () => {
  const [tokens, setTokens] = useState<DemoToken[]>(INITIAL_DEMO_TOKENS);
  const [activeDept, setActiveDept] = useState('Homeo OP Room 1');
  const [isChiming, setIsChiming] = useState(false);
  const [isIssueSheetOpen, setIsIssueSheetOpen] = useState(false);
  const [newCardInput, setNewCardInput] = useState('');
  const [newNameInput, setNewNameInput] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  // Active in progress token
  const currentToken = tokens.find(
    (t) => t.status === 'IN_PROGRESS' && t.department === activeDept
  );

  // Next waiting token
  const nextToken = tokens.find(
    (t) => t.status === 'WAITING' && t.department === activeDept
  );

  // Call Audio Chime simulation
  const handleTriggerChime = () => {
    setIsChiming(true);
    setTimeout(() => {
      setIsChiming(false);
    }, 1200);
  };

  // Next Token Call Action
  const handleCallNext = () => {
    handleTriggerChime();
    setTokens((prev) => {
      // Mark current as DONE if exists
      const updated = prev.map((t) => {
        if (t.department === activeDept && t.status === 'IN_PROGRESS') {
          return { ...t, status: 'DONE' as const };
        }
        return t;
      });

      // Advance first WAITING to IN_PROGRESS
      let foundFirst = false;
      return updated.map((t) => {
        if (!foundFirst && t.department === activeDept && t.status === 'WAITING') {
          foundFirst = true;
          return { ...t, status: 'IN_PROGRESS' as const };
        }
        return t;
      });
    });
  };

  // Skip token
  const handleSkipCurrent = () => {
    if (!currentToken) return;
    setTokens((prev) =>
      prev.map((t) => (t.id === currentToken.id ? { ...t, status: 'SKIPPED' as const } : t))
    );
  };

  // Issue new token
  const handleIssueToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNameInput.trim() || !newCardInput.trim()) return;

    const maxTokenNum = Math.max(...tokens.map((t) => t.tokenNumber), 40);
    const newToken: DemoToken = {
      id: `TOK-${Date.now()}`,
      tokenNumber: maxTokenNum + 1,
      patientName: newNameInput.toUpperCase(),
      cardNumber: newCardInput,
      department: activeDept,
      status: 'WAITING',
      priority: isUrgent ? 'URGENT' : 'NORMAL',
      waitTimeMinutes: 1,
      doctorAssigned: activeDept.includes('1') ? 'Dr. Rajdeep' : 'Dr. Vibhuti',
    };

    setTokens([...tokens, newToken]);
    setIsIssueSheetOpen(false);
    setNewCardInput('');
    setNewNameInput('');
    setIsUrgent(false);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Department Selector Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {['Homeo OP Room 1', 'Homeo OP Room 2'].map((dept) => {
          const isActive = activeDept === dept;
          return (
            <button
              key={dept}
              onClick={() => setActiveDept(dept)}
              className={`px-4 py-2 rounded-2xl text-xs font-black tracking-wider uppercase transition-all shrink-0 border ${
                isActive
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
              }`}
            >
              {dept}
            </button>
          );
        })}
      </div>

      {/* Main Active Caller Card (Hero Display) */}
      <div className="relative overflow-hidden bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Currently Consulting
          </span>
          <span className="text-xs font-semibold text-slate-400">{activeDept}</span>
        </div>

        {currentToken ? (
          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-6xl font-black tracking-tighter text-white">
                #{currentToken.tokenNumber}
              </span>
              <span className="text-sm font-bold text-slate-400">
                Card {currentToken.cardNumber}
              </span>
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-100 truncate">
                {currentToken.patientName}
              </h3>
              <p className="text-xs font-semibold text-emerald-400 mt-0.5">
                Consulting with {currentToken.doctorAssigned}
              </p>
            </div>

            {/* Chime Announcement Speaker */}
            <div className="pt-2 flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleTriggerChime}
                className={`flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                  isChiming
                    ? 'bg-emerald-500 text-white border-emerald-400 animate-bounce'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                <Megaphone size={16} />
                {isChiming ? 'Announcing in Hall...' : 'Re-Announce Token'}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSkipCurrent}
                className="py-3 px-4 rounded-xl font-black text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
                title="Skip if patient not present"
              >
                Skip
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center space-y-2">
            <p className="text-slate-400 text-sm font-bold">Desk is currently clear.</p>
            <p className="text-xs text-slate-500">Tap below to call next patient in line.</p>
          </div>
        )}
      </div>

      {/* Action Controls for Desk Volunteers (48dp Touch Targets) */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleCallNext}
          disabled={!nextToken}
          className={`py-4 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
            nextToken
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Play size={16} />
          {nextToken ? `Call Next (#${nextToken.tokenNumber})` : 'Queue Empty'}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setIsIssueSheetOpen(true)}
          className="py-4 px-4 rounded-2xl font-black text-xs uppercase tracking-wider bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Plus size={16} className="text-emerald-600" />
          Issue Token
        </motion.button>
      </div>

      {/* Up Next Queue Stream */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400">
            Waiting in Hall ({tokens.filter((t) => t.status === 'WAITING' && t.department === activeDept).length})
          </span>
          <span className="text-xs font-bold text-slate-400">Est. Wait: ~15m</span>
        </div>

        <div className="space-y-2">
          {tokens
            .filter((t) => t.status === 'WAITING' && t.department === activeDept)
            .map((token, idx) => (
              <div
                key={token.id}
                className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-black text-sm flex items-center justify-center">
                    #{token.tokenNumber}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                        {token.patientName}
                      </h4>
                      {token.priority === 'URGENT' && (
                        <span className="text-[9px] font-black uppercase bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded-md">
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-slate-400">
                      Card {token.cardNumber} • Line position #{idx + 1}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-bold text-slate-400">
                  <Clock size={12} />
                  <span>{token.waitTimeMinutes}m</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Issue Token Drawer */}
      <BottomSheet
        isOpen={isIssueSheetOpen}
        onClose={() => setIsIssueSheetOpen(false)}
        title="Issue New Queue Token"
        subtitle={`Assigning to ${activeDept}`}
      >
        <form onSubmit={handleIssueToken} className="space-y-4">
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">
              Patient Ledger Card #
            </label>
            <input
              type="text"
              required
              value={newCardInput}
              onChange={(e) => setNewCardInput(e.target.value)}
              placeholder="E.g. 10675"
              className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">
              Patient Full Name
            </label>
            <input
              type="text"
              required
              value={newNameInput}
              onChange={(e) => setNewNameInput(e.target.value)}
              placeholder="E.g. HARISH MOTWANI"
              className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                Urgent Priority
              </span>
              <span className="text-[11px] text-slate-400">
                Elderly, infants, or acute distress
              </span>
            </div>
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
              className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            type="submit"
            className="w-full py-3.5 bg-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30"
          >
            Generate Token Ticket
          </motion.button>
        </form>
      </BottomSheet>
    </div>
  );
};
