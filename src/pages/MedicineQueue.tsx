import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getBaseUrl } from '../lib/session';
import { io } from 'socket.io-client';
import { 
  Clock, Play, CheckCircle2, Clipboard, 
  User, RefreshCw, AlertCircle, Sparkles,
  Volume2, VolumeX, Lock, PackageCheck, AlertTriangle
} from 'lucide-react';
import { 
  playPharmacyChime, 
  isAudioMuted, 
  toggleAudioMute, 
  unlockAudioContext 
} from '../lib/pharmacyAudio';

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

export default function MedicineQueue() {
  const { session, updatePresence } = useAuth();
  const [tasks, setTasks] = useState<MedicineTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [muted, setMuted] = useState<boolean>(isAudioMuted());
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'conflict' | 'success' } | null>(null);
  const [mobileTab, setMobileTab] = useState<'pending' | 'my-desk' | 'history'>('pending');
  
  const lastSyncRef = useRef<string>('');
  const seenTaskIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef<boolean>(false);
  const lastPresenceRef = useRef<{ screen: string; status: string; taskId?: string; patientName?: string }>({
    screen: '',
    status: '',
    taskId: '',
    patientName: ''
  });

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

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

  // Core polling function
  const pollQueue = useCallback(async () => {
    try {
      const base = getBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : '');
      const url = new URL(`${base}/api/queue/tasks`);
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

      if (updatedTasks.length > 0) {
        // Chime detection on polling fallback
        if (initialLoadDoneRef.current) {
          const now = Date.now();
          const hasRecentNewPending = updatedTasks.some(t => {
            if (!seenTaskIdsRef.current.has(t.id) && t.status === 'PENDING') {
              const createdTime = new Date(t.createdAt).getTime();
              return (now - createdTime) < 60000;
            }
            return false;
          });
          if (hasRecentNewPending) {
            playPharmacyChime();
          }
        }

        updatedTasks.forEach(t => seenTaskIdsRef.current.add(t.id));
        initialLoadDoneRef.current = true;

        setTasks(prev => {
          const map = new Map(prev.map(t => [t.id, t]));
          // Apply delta updates
          updatedTasks.forEach(task => {
            map.set(task.id, task);
          });
          
          // Track latest updatedAt for next delta poll
          const latest = updatedTasks.reduce((latestStr, t) => {
            return (!latestStr || t.updatedAt > latestStr) ? t.updatedAt : latestStr;
          }, lastSyncRef.current);
          
          lastSyncRef.current = latest;
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      } else {
        initialLoadDoneRef.current = true;
      }
      setError(null);
    } catch (err: any) {
      console.error('[POLL ERROR]', err);
      setError('Connection lost. Reconnecting...');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Set up 4-second polling loop
  useEffect(() => {
    let active = true;
    pollQueue();
    const interval = setInterval(() => {
      if (active) pollQueue();
    }, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [pollQueue]);

  // Real-time broadcast listeners (Tier 1 Socket.io, Tier 2 BroadcastChannel, Tier 3 CustomEvent)
  useEffect(() => {
    // 1. Inter-tab BroadcastChannel listener
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('nk_pharmacy_control');
        bc.onmessage = (event) => {
          if (event.data?.type === 'NEW_PRESCRIPTION') {
            playPharmacyChime();
            setToast({
              message: `New prescription arrived for ${event.data.patientName || 'Patient'}`,
              type: 'info'
            });
            pollQueue();
          }
        };
      } catch (err) {
        console.warn('[PHARMACY QUEUE] BroadcastChannel listener error:', err);
      }
    }

    // 2. Intra-window CustomEvent listener
    const handlePrescriptionEvent = (e: Event) => {
      const customEv = e as CustomEvent;
      playPharmacyChime();
      if (customEv.detail?.patientName) {
        setToast({
          message: `New prescription arrived for ${customEv.detail.patientName}`,
          type: 'info'
        });
      }
      pollQueue();
    };
    window.addEventListener('nk_prescription_created', handlePrescriptionEvent);

    // 3. Socket.IO connection for cross-device updates
    let socket: any = null;
    try {
      const base = getBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : '');
      if (base) {
        socket = io(base, { reconnection: true, transports: ['websocket', 'polling'] });
        socket.on('prescription_created', (data: any) => {
          playPharmacyChime();
          setToast({
            message: `New prescription arrived: ${data.patientName || 'Patient'}`,
            type: 'info'
          });
          pollQueue();
        });
        socket.on('task_claimed', (data: any) => {
          if (data?.taskId) {
            setTasks(prev => prev.map(t => {
              if (t.id === data.taskId) {
                return {
                  ...t,
                  status: data.status || 'IN_PROGRESS',
                  claimedBy: data.claimedBy
                };
              }
              return t;
            }));
          }
        });
        socket.on('db_changed', (msg: any) => {
          if (msg?.table === 'medicine_tasks') {
            pollQueue();
          }
        });
      }
    } catch (sockErr) {
      console.warn('[PHARMACY QUEUE] Socket.IO initialization note:', sockErr);
    }

    return () => {
      if (bc) {
        try { bc.close(); } catch {}
      }
      window.removeEventListener('nk_prescription_created', handlePrescriptionEvent);
      if (socket) {
        try { socket.disconnect(); } catch {}
      }
    };
  }, [pollQueue]);

  // Handle Order Claiming with CAS Concurrency Lock
  const handleClaim = async (taskId: string) => {
    const volunteerName = session?.userName || 'Volunteer';
    const previousTasks = [...tasks];

    // Optimistic local update: mark IN_PROGRESS and claimedBy volunteer
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

    try {
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
        if (res.status === 409) {
          // Concurrency lock conflict: another volunteer already claimed it
          const otherVolunteer = result.claimedBy || 'another volunteer';
          setTasks(prev => prev.map(t => {
            if (t.id === taskId) {
              return {
                ...t,
                status: result.currentStatus || 'IN_PROGRESS',
                claimedBy: otherVolunteer
              };
            }
            return t;
          }));
          alert(`Order already claimed by ${otherVolunteer}`);
          setToast({
            message: `Order already claimed by ${otherVolunteer}`,
            type: 'conflict'
          });
          return;
        }

        // Generic error: rollback
        setTasks(previousTasks);
        alert(result.error || 'Failed to claim task.');
        return;
      }

      setToast({
        message: `Order claimed successfully. Starting packing!`,
        type: 'success'
      });
    } catch (e) {
      setTasks(previousTasks);
      alert('Claim failed. Check network connectivity.');
    }
  };

  // Handle Finishing / Dispensing with Duplicate Dispensing Prevention
  const handleFinish = async (taskId: string) => {
    const targetTask = tasks.find(t => t.id === taskId);
    // Prevent duplicate packing / finishing if claimed by someone else
    if (targetTask && targetTask.claimedBy && session?.userName && targetTask.claimedBy !== session.userName) {
      alert(`Cannot complete task claimed by ${targetTask.claimedBy}.`);
      return;
    }

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

      setToast({
        message: `Order marked READY for dispatch!`,
        type: 'success'
      });
    } catch (e) {
      alert('Network error. Failed to finish preparation.');
    }
  };

  // Handle Handover / Delivery to Patient (Decoupled Handover Workflow)
  const handleDeliver = async (taskId: string) => {
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
        alert(result.error || 'Failed to record handover.');
        return;
      }

      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            status: 'DELIVERED',
            deliveredBy: session?.userName || 'Volunteer',
            deliveredAt: new Date().toISOString()
          };
        }
        return t;
      }));

      setToast({
        message: `Medicine handed over to patient!`,
        type: 'success'
      });
    } catch (e) {
      alert('Network error. Failed to record handover.');
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
    <div className="flex flex-col min-h-full bg-slate-900 text-slate-100 pb-8">
      
      {/* Header operations bar */}
      <div className="bg-slate-950 px-4 sm:px-6 py-4 sm:py-5 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 gap-3 sm:gap-4 shrink-0 shadow-lg relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-emerald-500 to-indigo-500"></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Sparkles className="text-amber-400 animate-pulse shrink-0" size={22} /> 
              Medicine Room Dispatch
            </h1>
            {error && (
              <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-bold border border-red-500/30 animate-pulse flex items-center gap-1.5 shrink-0">
                <AlertCircle size={12} /> {error}
              </span>
            )}
          </div>
          <p className="text-slate-400 text-xs mt-1 uppercase tracking-wider font-semibold truncate">
            {session?.userName} • {session?.role} Dispatch Engine
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Audio Chime Mute/Unmute Toggle */}
          <button 
            onClick={() => {
              const next = toggleAudioMute();
              setMuted(next);
            }}
            aria-label={muted ? 'Unmute Dispatch Chime' : 'Mute Dispatch Chime'} title={muted ? 'Unmute Dispatch Chime' : 'Mute Dispatch Chime'}
            className={`p-3 rounded-xl transition-all border flex items-center gap-2 text-xs font-black uppercase tracking-wider ${
              muted 
                ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            <span className="hidden sm:inline">{muted ? 'Chime: Muted' : 'Chime: Active'}</span>
          </button>

          {/* Test Chime Sound */}
          <button 
            onClick={() => {
              unlockAudioContext();
              playPharmacyChime();
            }}
            aria-label="Test Chime Sound" title="Test Chime Sound"
            className="p-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-all border border-slate-700/50 flex items-center gap-2 text-xs font-black uppercase tracking-wider"
          >
            <Volume2 size={18} className="text-amber-400" />
            <span className="hidden sm:inline">Test Chime</span>
          </button>

          {/* Hard Reset */}
          <button 
            onClick={() => {
              setLoading(true);
              setIsRefreshing(true);
              lastSyncRef.current = '';
              seenTaskIdsRef.current.clear();
              setTasks([]);
              pollQueue();
            }} 
            className="p-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-all border border-slate-700/50 flex items-center gap-2"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">Hard Reset</span>
          </button>
        </div>
      </div>

      {/* Real-time Toast Banner */}
      {toast && (
        <div className={`mx-6 mt-4 p-3.5 rounded-xl border flex items-center justify-between shadow-lg transition-all animate-fadeIn ${
          toast.type === 'conflict'
            ? 'bg-red-500/15 border-red-500/30 text-red-300'
            : toast.type === 'success'
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
        }`}>
          <div className="flex items-center gap-2.5 text-xs font-black">
            {toast.type === 'conflict' ? (
              <AlertTriangle size={16} className="text-red-400" />
            ) : toast.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-400" />
            ) : (
              <Sparkles size={16} className="text-amber-400" />
            )}
            <span>{toast.message}</span>
          </div>
          <button 
            onClick={() => setToast(null)}
            className="text-xs opacity-70 hover:opacity-100 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {loading && tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold uppercase tracking-wider text-sm">Initializing dispatch stream...</p>
        </div>
      ) : (
        <>
          {/* Mobile 3-Tab Segmented Switcher */}
          <div className="lg:hidden px-4 sm:px-6 pt-4 shrink-0">
            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 gap-1.5 shadow-inner">
              <button
                type="button"
                onClick={() => setMobileTab('pending')}
                className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  mobileTab === 'pending'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock size={14} className="shrink-0" />
                <span className="truncate">Pipeline ({pendingTasks.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('my-desk')}
                className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  mobileTab === 'my-desk'
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Play size={14} className="shrink-0" />
                <span className="truncate">My Desk ({myInProgressTasks.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('history')}
                className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  mobileTab === 'history'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 size={14} className="shrink-0" />
                <span className="truncate">History</span>
              </button>
            </div>
          </div>

          <div className="px-4 sm:px-6 mt-4 sm:mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 max-w-7xl mx-auto w-full">
            
            {/* LEFT: MY ACTIVE CLAIMED WORKSPACE (4 Columns) */}
            <div className={`lg:col-span-4 space-y-6 ${mobileTab === 'my-desk' ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-slate-950/80 rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none"></div>
              
              <h2 className="text-lg font-black tracking-tight text-white mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                My Active Workbench
                <span className="bg-blue-500/20 text-blue-300 text-xs px-2.5 py-0.5 rounded-full font-black ml-auto border border-blue-500/30">
                  {myInProgressTasks.length} Active
                </span>
              </h2>

              <div className="space-y-4">
                {myInProgressTasks.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
                    <Clipboard className="mx-auto text-slate-700 w-10 h-10 mb-3" />
                    <p className="text-slate-500 text-sm font-bold">No tasks claimed.</p>
                    <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-wider font-semibold">Select a pending task from the pipeline to start packing</p>
                  </div>
                ) : (
                  myInProgressTasks.map(task => {
                    return (
                      <div key={task.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md relative group transition-all hover:border-blue-500/40">
                        {/* Traffic Badge & Patient Header */}
                        <div className="flex justify-between items-start border-b border-slate-800 pb-3 gap-2">
                          <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Patient</p>
                            <h3 className="text-base font-black text-white">{task.patientName}</h3>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            {/* UI/UX Pro Max Electric Blue Traffic Badge */}
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1.5 shrink-0">
                              <PackageCheck size={12} className="text-blue-400" />
                              In Prep by {task.claimedBy || session?.userName || 'You'}
                            </span>
                            <CountdownBadge claimedAt={task.claimedAt} />
                          </div>
                        </div>

                        {/* List items to prepare */}
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Prescription Checklist</p>
                          <div className="space-y-2">
                            {task.items?.map(item => (
                              <div key={item.id} className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800 flex items-start gap-3">
                                <span className="bg-blue-500/20 text-blue-300 text-xs font-black px-2 py-0.5 rounded border border-blue-500/30 uppercase tracking-tighter shrink-0 mt-0.5">
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
          <div className={`lg:col-span-5 space-y-6 ${mobileTab === 'pending' ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-slate-950/80 rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none"></div>

              <h2 className="text-lg font-black tracking-tight text-white mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                Self-Pick Pipeline
                <span className="bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-black ml-auto border border-amber-500/30">
                  {pendingTasks.length} Pending
                </span>
              </h2>

              <div className="space-y-4">
                {pendingTasks.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
                    <CheckCircle2 className="mx-auto text-slate-700 w-10 h-10 mb-3" />
                    <p className="text-slate-500 text-sm font-bold">All prescriptions packed!</p>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">Ready for new Doctor prescriptions</p>
                  </div>
                ) : (
                  pendingTasks.map(task => (
                    <div key={task.id} className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-sm hover:border-amber-500/30 hover:shadow-md transition-all relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-stretch gap-4">
                      
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                              <User size={14} className="text-amber-400" />
                            </div>
                            <div>
                              <h3 className="text-sm font-black text-white">{task.patientName}</h3>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Card: #{task.patientId}</p>
                            </div>
                          </div>

                          {/* UI/UX Pro Max Warm Amber Traffic Badge */}
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shrink-0">
                            <Clock size={12} className="text-amber-400 animate-pulse" />
                            Pending
                          </span>
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
                          <Play size={12} fill="currentColor" />
                          <span className="sr-only">Claim Work</span>
                          <span>Claim Order / Start Packing</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: COMPLETED AND COLLABORATORS COLUMN (3 Columns) */}
          <div className={`lg:col-span-3 space-y-6 ${mobileTab === 'history' ? 'block' : 'hidden lg:block'}`}>
            
            {/* Other Active Volunteers: Locked Order Status for Duplicate Dispensing Prevention */}
            {otherInProgressTasks.length > 0 && (
              <div className="bg-slate-950/80 rounded-3xl p-5 border border-slate-800">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <User size={14} className="text-blue-400" /> Active Handlers
                </h3>
                <div className="space-y-3">
                  {otherInProgressTasks.map(task => (
                    <div key={task.id} className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black text-slate-200">{task.patientName}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">Claimed by: {task.claimedBy}</p>
                        </div>
                        {/* Locked Badge */}
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1 shrink-0">
                          <Lock size={10} className="text-blue-400" />
                          In Prep
                        </span>
                      </div>

                      {/* Locked state indicator preventing duplicate packing */}
                      <div className="w-full bg-slate-950/60 text-slate-500 border border-slate-800/80 text-[10px] font-bold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 cursor-not-allowed select-none">
                        <Lock size={10} className="text-blue-400/80" />
                        <span>Locked (In Prep by {task.claimedBy})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recently Ready / Delivered: Emerald Green Traffic Badges */}
            <div className="bg-slate-950/80 rounded-3xl p-5 border border-slate-800">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500" /> Dispatch History
              </h3>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {finishedTasks.length === 0 ? (
                  <p className="text-xs text-slate-600 font-bold italic text-center py-6">No recent dispatches</p>
                ) : (
                  finishedTasks.map(task => (
                    <div key={task.id} className="bg-slate-900/30 border border-slate-800 p-3 rounded-xl space-y-1 hover:border-slate-700 transition-all">
                      <div className="flex justify-between items-center">
                        <p className="font-black text-slate-300 text-xs truncate flex-1 min-w-0 pr-2">{task.patientName}</p>
                        {/* UI/UX Pro Max Emerald Green Badge for Dispensed/Ready */}
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase shrink-0 flex items-center gap-1 ${
                          task.status === 'DELIVERED' 
                            ? 'bg-slate-800 text-slate-400 border-slate-700' 
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }`}>
                          <CheckCircle2 size={10} className={task.status === 'DELIVERED' ? 'text-slate-400' : 'text-emerald-400'} />
                          {task.status}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-500 font-bold">
                        {task.status === 'DELIVERED' 
                          ? `Handover by ${task.deliveredBy || 'System'}` 
                          : `Prepared by ${task.completedBy || 'Volunteer'}`
                        }
                      </p>
                      {task.status === 'READY' && (
                        <button
                          onClick={() => handleDeliver(task.id)}
                          className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-1.5 px-3 rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
                        >
                          <PackageCheck size={12} />
                          <span>Handover to Patient</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </>
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
