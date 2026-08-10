import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getBaseUrl } from '../lib/session';
import { 
  Users, Activity, CheckCircle, Package, 
  Send, RefreshCw, AlertCircle, Sparkles, Loader2 
} from 'lucide-react';
import { safeParseDate } from '../lib/dateUtils';

interface TaskItem {
  id: string;
  taskId: string;
  medicineCode: string;
  medicineName: string;
  dosage?: string;
  duration?: string;
  instructions?: string;
}

interface MedicineTask {
  id: string;
  visitId: string;
  patientId: string;
  patientName: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELIVERED';
  claimedBy?: string;
  completedBy?: string;
  deliveredBy?: string;
  claimedAt?: string;
  completedAt?: string;
  deliveredAt?: string;
  startedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items?: TaskItem[];
}

export default function MedicineDashboard() {
  const { session } = useAuth();
  const [tasks, setTasks] = useState<MedicineTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  const lastSyncRef = useRef<string>('');

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const url = new URL(`${getBaseUrl()}/api/queue/tasks`);
        if (lastSyncRef.current) {
          url.searchParams.append('updatedAfter', lastSyncRef.current);
        }

        const res = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}`
          }
        });
        
        if (!res.ok) throw new Error('Failed to load queue telemetry');
        const result = await res.json();
        const updatedTasks: MedicineTask[] = result.data || [];

        if (!active) return;

        if (updatedTasks.length > 0) {
          setTasks(prev => {
            const map = new Map(prev.map(t => [t.id, t]));
            updatedTasks.forEach(task => {
              map.set(task.id, task);
            });
            
            const latest = updatedTasks.reduce((latestStr, t) => {
              return (!latestStr || t.updatedAt > latestStr) ? t.updatedAt : latestStr;
            }, lastSyncRef.current);
            
            lastSyncRef.current = latest;
            return Array.from(map.values()).sort(
              (a, b) => (safeParseDate(b.createdAt)?.getTime() || 0) - (safeParseDate(a.createdAt)?.getTime() || 0)
            );
          });
        }
        setError(null);
      } catch (err: any) {
        console.error('[POLL ERROR]', err);
        if (active) setError('Reconnecting to live telemetry stream...');
      } finally {
        if (active) setLoading(false);
      }
    }

    poll();
    const interval = setInterval(poll, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleDeliver = async (taskId: string) => {
    setDeliveringId(taskId);
    try {
      const res = await fetch(`${getBaseUrl()}/api/queue/deliver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}`
        },
        body: JSON.stringify({ taskId })
      });

      if (!res.ok) {
        const result = await res.json();
        alert(result.error || 'Failed to register delivery.');
        return;
      }

      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            status: 'DELIVERED',
            deliveredBy: session?.userName || 'Reception',
            deliveredAt: new Date().toISOString()
          };
        }
        return t;
      }));
    } catch (e) {
      alert('Handover registration failed. Check network link.');
    } finally {
      setDeliveringId(null);
    }
  };

  // Status groupings
  const preparingList = tasks.filter(t => t.status === 'IN_PROGRESS');
  const pendingCount = tasks.filter(t => t.status === 'PENDING').length;
  const readyList = tasks.filter(t => t.status === 'READY');
  const deliveredList = tasks.filter(t => t.status === 'DELIVERED').slice(0, 10);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-y-auto pb-8">
      
      {/* Premium Dashboard Header */}
      <div className="bg-white dark:bg-slate-900 px-6 py-5 flex flex-col md:flex-row justify-between items-center border-b border-slate-200/80 dark:border-slate-800 gap-4 shrink-0 shadow-sm relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500"></div>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="text-emerald-500 animate-pulse" size={24} /> 
              Operations Center
            </h1>
            {error ? (
              <span className="bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full text-xs font-black border border-orange-100 dark:border-orange-900/30 flex items-center gap-1.5 animate-pulse">
                <AlertCircle size={12} /> {error}
              </span>
            ) : (
              <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-black border border-emerald-100 dark:border-emerald-900/30 uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Live Link Active
              </span>
            )}
          </div>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5 uppercase tracking-wider font-bold">
            Clinic Handover Desk • NGO Reception Dashboard
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setLoading(true);
              lastSyncRef.current = '';
              setTasks([]);
            }} 
            className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 flex items-center gap-2"
          >
            <RefreshCw size={18} className={loading && tasks.length === 0 ? 'animate-spin' : ''} />
            <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">Refresh Sync</span>
          </button>
        </div>
      </div>

      {loading && tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold uppercase tracking-wider text-sm">Synchronizing operational state...</p>
        </div>
      ) : (
        <div className="px-6 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto w-full">
          
          {/* TOP METRICS GRID */}
          <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <Activity size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Unclaimed Queue</p>
                <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{pendingCount} Patients</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Users size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Preparation Workbench</p>
                <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{preparingList.length} Active</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-[30px]"></div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Package size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ready for Handover</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{readyList.length} Boxed</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                <CheckCircle size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Delivered Today</p>
                <p className="text-2xl font-black text-slate-600 dark:text-slate-300">
                  {tasks.filter(t => t.status === 'DELIVERED').length} Done
                </p>
              </div>
            </div>
          </div>

          {/* MAIN DESK GRID */}
          
          {/* LEFT: THE HANDOVER DESK (READY FOR HANDOVER) - 7 Columns */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 dark:bg-emerald-950/20 rounded-full blur-[80px] pointer-events-none"></div>

              <h2 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Handover Desk (Ready Boxes)
                <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs px-2.5 py-1 rounded-full font-black ml-auto border border-emerald-100 dark:border-emerald-800 uppercase tracking-widest">
                  {readyList.length} Ready
                </span>
              </h2>

              <div className="space-y-4">
                {readyList.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-950/40">
                    <Package className="mx-auto text-slate-300 dark:text-slate-600 w-12 h-12 mb-3" />
                    <p className="text-slate-400 dark:text-slate-500 font-bold text-sm">Handover Desk is empty.</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1 uppercase tracking-wider font-semibold">Prepared medicine boxes will instantly appear here</p>
                  </div>
                ) : (
                  readyList.map(task => (
                    <div key={task.id} className="bg-white dark:bg-slate-950 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-stretch gap-4">
                      <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-emerald-500"></div>

                      <div className="flex-1 pl-2 space-y-3">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Attn Patient</p>
                          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{task.patientName}</h3>
                          <div className="flex gap-3 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            <span className="font-bold">ID: #{task.patientId}</span>
                            <span>•</span>
                            <span>Prepared by: <span className="text-slate-600 dark:text-slate-300 font-bold">{task.completedBy}</span></span>
                          </div>
                        </div>

                        {/* List items ready to check */}
                        <div className="bg-slate-50/60 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100/80 dark:border-slate-800 space-y-1.5">
                          <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Verify contents:</p>
                          <div className="flex flex-wrap gap-2">
                            {task.items?.map((item, idx) => (
                              <span key={idx} className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-black shadow-xs">
                                {item.medicineName}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-end justify-end shrink-0 w-full md:w-auto">
                        <button 
                          onClick={() => handleDeliver(task.id)}
                          disabled={deliveringId === task.id}
                          className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-4 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm"
                        >
                          {deliveringId === task.id ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> Handing Over...
                            </>
                          ) : (
                            <>
                              <Send size={12} /> Confirm Handover
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: TRACKING WORKBENCHES AND COMPLETED (5 Columns) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Preparers pipeline */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <h2 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Users size={16} className="text-blue-500" /> Workbench Telemetry
              </h2>

              <div className="space-y-3">
                {preparingList.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold italic text-center py-6">No medicine tasks currently in preparation</p>
                ) : (
                  preparingList.map(task => (
                    <div key={task.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl flex justify-between items-center text-xs">
                      <div>
                        <p className="font-black text-slate-800 dark:text-slate-100">{task.patientName}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                          Assigned: <span className="text-slate-600 dark:text-slate-300">{task.claimedBy}</span>
                        </p>
                      </div>
                      <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-wider animate-pulse">
                        Preparing
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Handover Logs */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <h2 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-500" /> Recent Handovers
              </h2>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {deliveredList.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold italic text-center py-6">No deliveries logged today</p>
                ) : (
                  deliveredList.map(task => (
                    <div key={task.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-3.5 rounded-2xl space-y-1">
                      <div className="flex justify-between items-center">
                        <p className="font-black text-slate-800 dark:text-slate-100 text-xs truncate">{task.patientName}</p>
                        <span className="bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Delivered
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                        Logged handover by <span className="text-slate-600 dark:text-slate-300">{task.deliveredBy}</span>
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
