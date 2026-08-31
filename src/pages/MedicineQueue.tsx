import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getBaseUrl } from '../lib/session';
import { 
  Clock, Play, CheckCircle2, Clipboard, 
  User, RefreshCw, AlertCircle, Sparkles 
} from 'lucide-react';
import { MedicineTask } from '../types/medicine';

export default function MedicineQueue() {
  const { session, updatePresence } = useAuth();
  const [tasks, setTasks] = useState<MedicineTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const lastSyncRef = useRef<string>('');
  const lastPresenceRef = useRef<{ screen: string; status: string; taskId?: string; patientName?: string }>({
    screen: '',
    status: '',
    taskId: '',
    patientName: ''
  });

  // Synchronize presence with my active workbench
  useEffect(() => {
    if (!session) return;
    const myActive = tasks.find(t => t.status === 'IN_PROGRESS' && t.claimedBy === session.userName);
    
    const nextScreen = 'Medicine Queue';
    const nextStatus = myActive ? 'WORKING' : 'ONLINE';
    const nextTaskId = myActive?.id;
    const nextPatientName = myActive?.patientName;
    
    if (
      lastPresenceRef.current.screen !== nextScreen ||
      lastPresenceRef.current.status !== nextStatus ||
      lastPresenceRef.current.taskId !== nextTaskId ||
      lastPresenceRef.current.patientName !== nextPatientName
    ) {
      lastPresenceRef.current = {
        screen: nextScreen,
        status: nextStatus,
        taskId: nextTaskId,
        patientName: nextPatientName
      };
      updatePresence(nextScreen, nextStatus, nextTaskId, nextPatientName);
    }
  }, [tasks, session, updatePresence]);



  // Poll for delta updates every 4 seconds
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
        
        if (!res.ok) throw new Error('Failed to fetch tasks');
        const result = await res.json();
        const updatedTasks: MedicineTask[] = result.data || [];

        if (!active) return;

        if (updatedTasks.length > 0) {
          setTasks(prev => {
            const map = new Map(prev.map(t => [t.id, t]));
            // Apply delta updates
            updatedTasks.forEach(task => {
              map.set(task.id, task);
            });
            
            // Track the absolute latest updatedAt for next sync
            const latest = updatedTasks.reduce((latestStr, t) => {
              return (!latestStr || t.updatedAt > latestStr) ? t.updatedAt : latestStr;
            }, lastSyncRef.current);
            
            lastSyncRef.current = latest;
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        }
        setError(null);
      } catch (err: any) {
        console.error('[POLL ERROR]', err);
        if (active) setError('Connection lost. Reconnecting...');
      } finally {
        if (active) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    poll(); // Initial load
    const interval = setInterval(poll, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleClaim = async (taskId: string) => {
    try {
      const volunteerName = session?.userName || 'Volunteer';
      const res = await fetch(`${getBaseUrl()}/api/queue/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}`
        },
        body: JSON.stringify({ taskId, volunteerName })
      });

      const result = await res.json();
      if (!res.ok) {
        alert(result.error || 'Failed to claim task.');
        return;
      }
      
      // Update locally immediately for responsiveness
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            status: 'IN_PROGRESS',
            claimedBy: volunteerName,
            claimedAt: new Date().toISOString(),
            startedAt: new Date().toISOString()
          };
        }
        return t;
      }));
    } catch (e) {
      alert('Claim failed. Check network connectivity.');
    }
  };

  const handleFinish = async (taskId: string) => {
    try {
      const res = await fetch(`${getBaseUrl()}/api/queue/finish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}`
        },
        body: JSON.stringify({ taskId })
      });

      if (!res.ok) {
        const result = await res.json();
        alert(result.error || 'Failed to complete task.');
        return;
      }

      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            status: 'READY',
            completedBy: session?.userName || 'Volunteer',
            completedAt: new Date().toISOString()
          };
        }
        return t;
      }));
    } catch (e) {
      alert('Network error. Failed to finish preparation.');
    }
  };

  // Filter tasks into columns
  const pendingTasks = tasks.filter(t => t.status === 'PENDING');
  const myInProgressTasks = tasks.filter(
    t => t.status === 'IN_PROGRESS' && t.claimedBy === session?.userName
  );
  const otherInProgressTasks = tasks.filter(
    t => t.status === 'IN_PROGRESS' && t.claimedBy !== session?.userName
  );
  const finishedTasks = tasks.filter(t => t.status === 'READY' || t.status === 'DELIVERED').slice(0, 20);



  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-y-auto pb-8">
      
      {/* Header operations bar */}
      <div className="bg-slate-950 px-6 py-5 flex flex-col md:flex-row justify-between items-center border-b border-slate-800 gap-4 shrink-0 shadow-lg relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-emerald-500 to-indigo-500"></div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Sparkles className="text-amber-400 animate-pulse" size={24} /> 
              Medicine Room Dispatch
            </h1>
            {error && (
              <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-bold border border-red-500/30 animate-pulse flex items-center gap-1.5">
                <AlertCircle size={12} /> {error}
              </span>
            )}
          </div>
          <p className="text-slate-400 text-xs mt-1 uppercase tracking-wider font-semibold">
            {session?.userName} • {session?.role} Dispatch Engine
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setLoading(true);
              setIsRefreshing(true);
              lastSyncRef.current = '';
              setTasks([]);
            }} 
            className="p-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-all border border-slate-700/50 flex items-center gap-2"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">Hard Reset</span>
          </button>
        </div>
      </div>

      {loading && tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold uppercase tracking-wider text-sm">Initializing dispatch stream...</p>
        </div>
      ) : (
        <div className="px-6 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto w-full">
          
          {/* LEFT: MY ACTIVE CLAIMED WORKSPACE (4 Columns) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-950/80 rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none"></div>
              
              <h2 className="text-lg font-black tracking-tight text-white mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                My Active Workbench
                <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-0.5 rounded-full font-black ml-auto border border-indigo-500/30">
                  {myInProgressTasks.length}
                </span>
              </h2>

              <div className="space-y-4">
                {myInProgressTasks.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
                    <Clipboard className="mx-auto text-slate-700 w-10 h-10 mb-3" />
                    <p className="text-slate-500 text-sm font-bold">No tasks claimed.</p>
                    <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-wider font-semibold">Select a pending task on the right to start</p>
                  </div>
                ) : (
                  myInProgressTasks.map(task => {
                    return (
                      <div key={task.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md relative group transition-all hover:border-indigo-500/40">
                        {/* Countdown indicator */}
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                          <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Patient</p>
                            <h3 className="text-base font-black text-white">{task.patientName}</h3>
                          </div>
                          <CountdownBadge claimedAt={task.claimedAt} />
                        </div>

                        {/* List items to prepare */}
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Prescription Checklist</p>
                          <div className="space-y-2">
                            {task.items?.map(item => (
                              <div key={item.id} className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800 flex items-start gap-3">
                                <span className="bg-indigo-500/20 text-indigo-400 text-xs font-black px-2 py-0.5 rounded border border-indigo-500/30 uppercase tracking-tighter shrink-0 mt-0.5">
                                  {item.medicineCode}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-black text-slate-200 truncate">{item.medicineName}</p>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {item.dosage && <span className="bg-slate-800 text-slate-400 text-[9px] px-1.5 py-0.5 rounded font-black border border-slate-700">{item.dosage}</span>}
                                    {item.duration && <span className="bg-slate-800 text-slate-400 text-[9px] px-1.5 py-0.5 rounded font-black border border-slate-700">{item.duration}</span>}
                                    {item.instructions && <span className="bg-slate-800/40 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-bold">{item.instructions}</span>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <button 
                          onClick={() => handleFinish(task.id)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 text-xs uppercase tracking-wider transition-all"
                        >
                          <CheckCircle2 size={16} /> Complete & Mark Ready
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* MIDDLE: THE PENDING QUEUE (5 Columns) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-950/80 rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none"></div>

              <h2 className="text-lg font-black tracking-tight text-white mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                Self-Pick Pipeline
                <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full font-black ml-auto border border-amber-500/30">
                  {pendingTasks.length} Pending
                </span>
              </h2>

              <div className="space-y-4">
                {pendingTasks.length === 0 ? (
                  <div className="text-center py-20 border border-slate-850 rounded-2xl bg-slate-900/10 flex flex-col items-center justify-center">
                    <CheckCircle2 className="text-emerald-500 w-16 h-16 mb-4 animate-bounce-subtle" />
                    <p className="text-slate-300 font-black text-base">Queue Fully Cleared</p>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">Ready for new Doctor checkups</p>
                  </div>
                ) : (
                  pendingTasks.map(task => (
                    <div key={task.id} className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-sm hover:border-amber-500/30 hover:shadow-md transition-all relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-stretch gap-4">
                      
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                            <User size={14} className="text-amber-400" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-white">{task.patientName}</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Card: #{task.patientId}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {task.items?.map((item, idx) => (
                            <span key={idx} className="bg-slate-950 text-slate-400 text-[10px] px-2.5 py-1 rounded-lg border border-slate-800 font-black">
                              {item.medicineName}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-end justify-end shrink-0 w-full md:w-auto">
                        <button 
                          onClick={() => handleClaim(task.id)}
                          className="w-full md:w-auto bg-slate-800 hover:bg-slate-700 hover:text-white text-amber-400 border border-slate-700/60 font-black px-4 py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all"
                        >
                          <Play size={12} fill="currentColor" /> Claim Work
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: COMPLETED AND COLLABORATORS COLUMN (3 Columns) */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Other Active Volunteers */}
            {otherInProgressTasks.length > 0 && (
              <div className="bg-slate-950/80 rounded-3xl p-5 border border-slate-800">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <User size={14} className="text-indigo-400" /> Active Handlers
                </h3>
                <div className="space-y-2">
                  {otherInProgressTasks.map(task => (
                    <div key={task.id} className="bg-slate-900 border border-slate-850 p-3 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <p className="font-black text-slate-200">{task.patientName}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">Claimed by: {task.claimedBy}</p>
                      </div>
                      <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-black text-[9px] uppercase">
                        Preparing
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recently Ready / Delivered */}
            <div className="bg-slate-950/80 rounded-3xl p-5 border border-slate-800">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500" /> Dispatch History
              </h3>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {finishedTasks.length === 0 ? (
                  <p className="text-xs text-slate-600 font-bold italic text-center py-6">No recent dispatches</p>
                ) : (
                  finishedTasks.map(task => (
                    <div key={task.id} className="bg-slate-905/30 border border-slate-850 p-3 rounded-xl space-y-1 hover:border-slate-800 transition-all">
                      <div className="flex justify-between items-center">
                        <p className="font-black text-slate-300 text-xs truncate max-w-[120px]">{task.patientName}</p>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                          task.status === 'DELIVERED' 
                            ? 'bg-slate-800 text-slate-500 border-slate-700' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-500 font-bold">
                        {task.status === 'DELIVERED' 
                          ? `Handover by ${task.deliveredBy || 'System'}` 
                          : `Prepared by ${task.completedBy || 'Volunteer'}`
                        }
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

function CountdownBadge({ claimedAt }: { claimedAt?: string }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!claimedAt) return;
    const calculateSeconds = () => {
      const claimedTime = new Date(claimedAt).getTime();
      const expiryTime = claimedTime + 5 * 60 * 1000;
      const diff = Math.max(0, expiryTime - Date.now());
      return Math.floor(diff / 1000);
    };

    setSeconds(calculateSeconds());

    const timer = setInterval(() => {
      const remaining = calculateSeconds();
      setSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [claimedAt]);

  const isUrgent = seconds <= 60;

  return (
    <div className={`px-3 py-1.5 rounded-xl text-center border font-bold flex items-center gap-1.5 text-xs ${
      isUrgent ? 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse' : 'bg-slate-800 text-slate-300 border-slate-700'
    }`}>
      <Clock size={12} />
      {seconds > 0 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : 'Expired'}
    </div>
  );
}
