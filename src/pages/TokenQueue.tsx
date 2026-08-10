import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Token, DeptCounter, Department, PatientResult,
  fetchTokenDashboard, fetchTokens, fetchDepartments, searchPatients,
  createToken, startToken, moveToken, skipToken, requeueToken, cancelToken, setTokenPriority
} from '../lib/tokenService';
import {
  Ticket, Play, SkipForward, ArrowRight, XCircle, Undo2, Zap,
  Search, Plus, Users, RefreshCw, CheckCircle,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  WAITING: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  DONE: 'bg-emerald-100 text-emerald-700',
  SKIPPED: 'bg-slate-100 text-slate-500',
  CANCELLED: 'bg-red-100 text-red-600',
};

export default function TokenQueue() {
  const { session } = useAuth();
  const [counters, setCounters] = useState<DeptCounter[]>([]);
  const [totals, setTotals] = useState({ totalToday: 0, totalDone: 0 });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  // Create token state
  const [showCreate, setShowCreate] = useState(false);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [newPriority, setNewPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [createError, setCreateError] = useState('');
  const searchTimer = useRef<any>(null);

  // Load departments once
  useEffect(() => {
    fetchDepartments().then(r => { if (r.data) setDepartments(r.data); });
  }, []);

  const loadAll = useCallback(async () => {
    const [dash, list] = await Promise.all([
      fetchTokenDashboard(),
      fetchTokens({ departmentId: selectedDept || undefined, status: statusFilter || undefined }),
    ]);
    if (dash.data) {
      setCounters(dash.data);
      setTotals(dash.totals);
    }
    if (list.data) setTokens(list.data);
    setLoading(false);
  }, [selectedDept, statusFilter]);

  useEffect(() => {
    void loadAll();
    const iv = setInterval(loadAll, 10000);
    return () => clearInterval(iv);
  }, [loadAll]);

  // Patient search debounce
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!patientQuery.trim()) { setPatientResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const r = await searchPatients(patientQuery);
      if (r.data) setPatientResults(r.data);
    }, 200);
  }, [patientQuery]);

  // Actions
  async function doAction(action: string, params: any) {
    setBusy(action);
    let res: any;
    if (action === 'start') res = await startToken(params);
    else if (action === 'move') res = await moveToken(params);
    else if (action === 'skip') res = await skipToken(params);
    else if (action === 'requeue') res = await requeueToken(params);
    else if (action === 'cancel') res = await cancelToken(params);
    else if (action === 'priority') res = await setTokenPriority(params);

    if (res?.error) alert(res.error);
    else if (res?.message) alert(res.message);
    await loadAll();
    setBusy('');
  }

  async function handleCreate() {
    if (!selectedPatient) { setCreateError('Select a patient first'); return; }
    setCreateError('');
    setBusy('create');
    const res = await createToken({
      personId: selectedPatient.card_number,
      personName: selectedPatient.name,
      personCard: selectedPatient.card_number,
      priority: newPriority,
      userId: session?.userId,
    });
    if (res.error) { setCreateError(res.error); setBusy(''); return; }
    setShowCreate(false);
    setSelectedPatient(null);
    setPatientQuery('');
    setNewPriority('NORMAL');
    await loadAll();
    setBusy('');
  }

  if (!session) return null;

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest">Queue Control</p>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Ticket size={24} className="text-emerald-500" /> Token System
          </h2>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="p-2 bg-white border border-slate-200 rounded-lg active:bg-slate-50">
            <RefreshCw size={18} className="text-slate-500" />
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm py-2">
            <Plus size={16} /> New Token
          </button>
        </div>
      </div>

      {/* Today Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex justify-around shadow-sm">
        <div className="text-center">
          <p className="text-2xl font-black text-slate-800">{totals.totalToday}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Tokens</p>
        </div>
        <div className="w-px bg-slate-100" />
        <div className="text-center">
          <p className="text-2xl font-black text-emerald-600">{totals.totalDone}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completed</p>
        </div>
        <div className="w-px bg-slate-100" />
        <div className="text-center">
          <p className="text-2xl font-black text-blue-600">{totals.totalToday - totals.totalDone}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active</p>
        </div>
      </div>

      {/* Department Counters */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {counters.filter(c => ['REC','MED','MEDI'].includes(c.departmentCode)).map(c => (
          <button key={c.departmentId}
            onClick={() => setSelectedDept(selectedDept === c.departmentId ? '' : c.departmentId)}
            className={`bg-white rounded-xl border p-3 text-left shadow-sm active:bg-slate-50 transition-all ${selectedDept === c.departmentId ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">{c.departmentName}</p>
            <div className="flex items-baseline gap-2 mb-1">
              {c.currentToken ? (
                <span className="text-lg font-black text-amber-600">#{c.currentToken.tokenNumber}</span>
              ) : (
                <span className="text-xs text-slate-400 italic">No active</span>
              )}
            </div>
            <div className="flex gap-2 text-[10px] font-bold">
              <span className="text-blue-600">{c.waiting} wait</span>
              <span className="text-amber-600">{c.inProgress} active</span>
              <span className="text-emerald-600">{c.done} done</span>
            </div>
          </button>
        ))}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['', 'WAITING', 'IN_PROGRESS', 'DONE', 'SKIPPED', 'CANCELLED'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border ${statusFilter === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Token List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
            <Users size={16} className="text-blue-500" /> Queue ({tokens.length})
          </h3>
          {selectedDept && <span className="text-xs font-bold text-emerald-600">{departments.find(d => d.id === selectedDept)?.name || ''}</span>}
        </div>

        {loading ? (
          <div className="p-8 text-center"><div className="spinner mx-auto" /></div>
        ) : tokens.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No tokens found</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {tokens.map(t => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg shrink-0 ${t.priority === 'URGENT' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {t.tokenNumber}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-800 truncate">{t.personName || (t.personCard?.startsWith('TEMP-') ? 'Unknown Patient' : `Card #${t.personCard}`)}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS_COLORS[t.status]}`}>{t.status.replace('_', ' ')}</span>
                      {t.priority === 'URGENT' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">URGENT</span>}
                      <span className="text-[10px] text-slate-400">{t.departmentCode}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  {t.status === 'WAITING' && (
                    <>
                      <button title="Start" disabled={!!busy} onClick={() => doAction('start', { tokenId: t.id, departmentId: t.currentDepartmentId, userId: session?.userId })}
                        className="p-1.5 rounded-lg bg-amber-50 text-amber-600 active:bg-amber-100"><Play size={14} /></button>
                      <button title="Skip" disabled={!!busy} onClick={() => doAction('skip', { tokenId: t.id, userId: session?.userId })}
                        className="p-1.5 rounded-lg bg-slate-50 text-slate-500 active:bg-slate-100"><SkipForward size={14} /></button>
                      {t.priority === 'NORMAL' && (
                        <button title="Urgent" disabled={!!busy} onClick={() => doAction('priority', { tokenId: t.id, priority: 'URGENT', userId: session?.userId })}
                          className="p-1.5 rounded-lg bg-red-50 text-red-500 active:bg-red-100"><Zap size={14} /></button>
                      )}
                    </>
                  )}
                  {t.status === 'IN_PROGRESS' && (
                    <>
                      <button title="Move/Complete" disabled={!!busy} onClick={() => doAction('move', { tokenId: t.id, userId: session?.userId })}
                        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 active:bg-emerald-100"><ArrowRight size={14} /></button>
                      <button title="Skip" disabled={!!busy} onClick={() => doAction('skip', { tokenId: t.id, userId: session?.userId })}
                        className="p-1.5 rounded-lg bg-slate-50 text-slate-500 active:bg-slate-100"><SkipForward size={14} /></button>
                    </>
                  )}
                  {t.status === 'SKIPPED' && (
                    <button title="Re-queue" disabled={!!busy} onClick={() => doAction('requeue', { tokenId: t.id, userId: session?.userId })}
                      className="p-1.5 rounded-lg bg-blue-50 text-blue-600 active:bg-blue-100"><Undo2 size={14} /></button>
                  )}
                  {!['DONE', 'CANCELLED'].includes(t.status) && (
                    <button title="Cancel" disabled={!!busy} onClick={() => { if (confirm('Cancel this token?')) doAction('cancel', { tokenId: t.id, userId: session?.userId }); }}
                      className="p-1.5 rounded-lg bg-red-50 text-red-500 active:bg-red-100"><XCircle size={14} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Token Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Plus size={20} className="text-emerald-500" /> Generate Token</h3>

            {createError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-100">{createError}</div>}

            {/* Patient Search */}
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Search Patient</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input value={patientQuery} onChange={e => { setPatientQuery(e.target.value); setSelectedPatient(null); }}
                  placeholder="Card number or name..."
                  className="input-field pl-10 py-3 text-sm" />
              </div>
              {patientResults.length > 0 && !selectedPatient && (
                <div className="mt-1 border border-slate-200 rounded-lg max-h-40 overflow-y-auto bg-white shadow-lg">
                  {patientResults.map(p => (
                    <button key={p.card_number} onClick={() => { setSelectedPatient(p); setPatientQuery(p.name); setPatientResults([]); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 text-sm border-b border-slate-50 last:border-0">
                      <span className="font-bold text-slate-800">{p.name}</span>
                      <span className="ml-2 text-xs text-slate-400">{p.card_number?.startsWith('TEMP-') ? 'No ID' : `#${p.card_number}`}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedPatient && (
                <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-emerald-800">{selectedPatient.name}</p>
                    <p className="text-xs text-emerald-600">{selectedPatient.card_number?.startsWith('TEMP-') ? 'No ID' : `Card #${selectedPatient.card_number}`}</p>
                  </div>
                  <CheckCircle size={20} className="text-emerald-500" />
                </div>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Priority</label>
              <div className="flex gap-2">
                <button onClick={() => setNewPriority('NORMAL')}
                  className={`flex-1 py-2.5 rounded-lg font-bold text-sm border ${newPriority === 'NORMAL' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                  Normal
                </button>
                <button onClick={() => setNewPriority('URGENT')}
                  className={`flex-1 py-2.5 rounded-lg font-bold text-sm border ${newPriority === 'URGENT' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                  ⚡ Urgent
                </button>
              </div>
            </div>

            <button onClick={handleCreate} disabled={!selectedPatient || busy === 'create'}
              className="w-full btn-primary py-3.5 text-base mt-2">
              {busy === 'create' ? 'Creating...' : 'Generate Token'}
            </button>
            <button onClick={() => setShowCreate(false)} className="w-full py-2.5 text-sm font-bold text-slate-500 active:text-slate-700">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
