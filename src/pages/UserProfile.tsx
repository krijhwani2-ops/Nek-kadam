import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, ChevronLeft, 
  Activity, BarChart3 
} from 'lucide-react';
import { getBaseUrl } from '../lib/session';

interface TaskItem {
  id: string;
  taskId: string;
  medicineCode: string;
  medicineName: string;
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
  createdAt: string;
  updatedAt: string;
  items?: TaskItem[];
}

interface UserPresence {
  userId: string;
  userName: string;
  department: string;
  currentStatus: string;
  currentScreen?: string;
  currentTaskId?: string;
  currentPatientName?: string;
  lastActivityAt?: string;
  lastHeartbeatAt?: string;
  isOnline: boolean;
}

export default function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  
  const [presence, setPresence] = useState<UserPresence | null>(null);
  const [tasks, setTasks] = useState<MedicineTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        // 1. Fetch presence
        const presenceRes = await fetch(`${getBaseUrl()}/api/presence`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}` }
        });
        const presenceJson = await presenceRes.json();
        const userPresence = (presenceJson.data || []).find((p: any) => p.userId === userId);
        
        // 2. Fetch all medicine tasks to compute history/stats
        const tasksRes = await fetch(`${getBaseUrl()}/api/queue/tasks`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}` }
        });
        const tasksJson = await tasksRes.json();
        const allTasks: MedicineTask[] = tasksJson.data || [];

        if (!active) return;

        if (userPresence) {
          setPresence(userPresence);
        } else {
          // If no presence row found, try to look up user name from tasks
          const userNameFromTasks = allTasks.find(
            t => t.claimedBy === userId || t.completedBy === userId
          )?.claimedBy;
          
          setPresence({
            userId: userId || 'unknown',
            userName: userNameFromTasks || userId || 'Operator',
            department: 'MEDICINE',
            currentStatus: 'OFFLINE',
            isOnline: false
          });
        }

        // Filter tasks related to this user name
        const userName = userPresence ? userPresence.userName : userId;
        const userTasks = allTasks.filter(
          t => t.claimedBy === userId || t.claimedBy === userName || t.completedBy === userId || t.completedBy === userName || t.deliveredBy === userId || t.deliveredBy === userName
        );
        setTasks(userTasks);
      } catch (err: any) {
        console.error('[LOAD PROFILE ERROR]', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();
    const interval = setInterval(loadProfile, 8000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 flex-col gap-3">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Compiling profiles...</p>
      </div>
    );
  }

  if (!presence) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <p className="text-slate-400 font-bold">Operator profile not found.</p>
        <button onClick={() => navigate('/')} className="btn-primary">Back to Dashboard</button>
      </div>
    );
  }

  // Analytics calculations
  const totalClaimed = tasks.filter(t => t.claimedBy === presence.userName).length;
  const totalCompleted = tasks.filter(t => t.completedBy === presence.userName).length;
  
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const completedToday = tasks.filter(t => {
    if (t.completedBy !== presence.userName || !t.completedAt) return false;
    return new Date(t.completedAt).getTime() >= todayStart.getTime();
  }).length;

  // Average prep time calculation
  const completedTasksWithDuration = tasks.filter(
    t => t.completedBy === presence.userName && t.startedAt && t.completedAt
  );
  
  let averagePrepSecs = 0;
  if (completedTasksWithDuration.length > 0) {
    const totalDuration = completedTasksWithDuration.reduce((acc, t) => {
      const start = new Date(t.startedAt!).getTime();
      const end = new Date(t.completedAt!).getTime();
      return acc + (end - start);
    }, 0);
    averagePrepSecs = Math.floor(totalDuration / completedTasksWithDuration.length / 1000);
  }

  const formatDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  const getStatusColor = (status: string, online: boolean) => {
    if (!online) return 'bg-slate-100 text-slate-500 border-slate-200';
    if (status === 'IN_PROGRESS' || status === 'WORKING') return 'bg-blue-50 text-blue-600 border-blue-100';
    if (status === 'READY') return 'bg-purple-50 text-purple-600 border-purple-100';
    if (status === 'IDLE') return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-emerald-50 text-emerald-600 border-emerald-100';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      
      {/* Back link */}
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-black text-xs uppercase tracking-wider transition-colors"
      >
        <ChevronLeft size={16} /> Back to Desk
      </button>

      {/* Profile Header */}
      <div className="glass-card p-6 md:p-8 rounded-[2rem] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary text-white flex items-center justify-center font-black text-3xl shadow-lg shadow-emerald-100">
            {presence.userName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">{presence.userName}</h2>
              <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getStatusColor(presence.currentStatus, presence.isOnline)}`}>
                {presence.isOnline ? presence.currentStatus : 'OFFLINE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
              {presence.department} • {presence.userName === 'admin' ? 'SYSTEM ADMIN' : 'VOLUNTEER'}
            </p>
          </div>
        </div>

        {presence.isOnline && presence.currentScreen && (
          <div className="bg-slate-50 border border-slate-200/80 px-4 py-3 rounded-2xl flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Activity size={16} className="animate-pulse" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Workspace</p>
              <p className="text-xs font-black text-slate-700">{presence.currentScreen}</p>
            </div>
          </div>
        )}
      </div>

      {/* Analytics widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tasks Claimed</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{totalClaimed}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tasks Completed</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{totalCompleted}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed Today</p>
          <p className="text-3xl font-black text-emerald-600 mt-1">{completedToday}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Prep Speed</p>
          <p className="text-3xl font-black text-indigo-600 mt-1">
            {averagePrepSecs > 0 ? formatDuration(averagePrepSecs) : '—'}
          </p>
        </div>
      </div>

      {/* Main Grid: Screen tracking & task history */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Current Active state */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-3">
              <BarChart3 size={14} className="text-indigo-500" /> Operational Visibility
            </h3>
            
            <div className="space-y-3.5 text-xs font-semibold">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tracking Status</p>
                <p className="text-slate-800">{presence.isOnline ? 'Online & Active' : 'Offline'}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Current Action</p>
                <p className="text-slate-800">
                  {presence.currentStatus === 'IDLE' ? 'Idle' : presence.currentTaskId ? 'Preparing Medicines' : 'Browsing modules'}
                </p>
              </div>
              {presence.currentPatientName && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Patient Box</p>
                  <p className="text-slate-800">{presence.currentPatientName}</p>
                </div>
              )}
              {presence.lastHeartbeatAt && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Last Heartbeat Ping</p>
                  <p className="text-slate-500 font-medium">
                    {new Date(presence.lastHeartbeatAt).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: History table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
              <CheckCircle2 size={14} className="text-emerald-500" /> Dispatch & Preparation Logs
            </h3>

            <div className="space-y-3">
              {tasks.length === 0 ? (
                <div className="text-center py-12 text-slate-400 italic text-sm font-bold">
                  No medicine tasks logged for this operator.
                </div>
              ) : (
                tasks.map(task => {
                  let durationStr = '—';
                  if (task.startedAt && task.completedAt) {
                    const diff = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
                    durationStr = formatDuration(Math.floor(diff / 1000));
                  }

                  return (
                    <div key={task.id} className="bg-slate-50/60 border border-slate-100 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-800 text-sm">{task.patientName}</h4>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${
                            task.status === 'DELIVERED' 
                              ? 'bg-slate-200 text-slate-500 border-slate-300' 
                              : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                            {task.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold mt-1">
                          <span>ID: #{task.patientId}</span>
                          <span>•</span>
                          <span>Claimed: {task.claimedAt ? new Date(task.claimedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                        </div>
                      </div>

                      <div className="text-right sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-start w-full sm:w-auto shrink-0">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</span>
                        <span className="text-xs font-black text-slate-700">{durationStr}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
