import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FilePlus, Clock, RefreshCw,
  Search, ShieldCheck, Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchDashboardData, DashboardData, logActivity, getBaseUrl } from '../lib/session';
import { useApp } from '../contexts/AppContext';

function formatLogTime(ts?: string | number): string {
  if (!ts) return '';
  const str = String(ts);
  const d1 = new Date(str);
  if (!isNaN(d1.getTime())) {
    return d1.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const d2 = new Date(str + 'Z');
  if (!isNaN(d2.getTime())) {
    return d2.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return '';
}

export default function Dashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { t } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [presenceList, setPresenceList] = useState<any[]>([]);

  const loadPresence = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/api/presence`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        setPresenceList(json.data || []);
      }
    } catch (e) {
      console.warn('[PRESENCE LOAD ERROR]', e);
    }
  };

  useEffect(() => {
    if (!session) return;
    logActivity('Viewing Dashboard');
    async function load() {
      const res = await fetchDashboardData();
      if (res) {
        setData(res);
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }
      setLoading(false);
      await loadPresence();
    }
    load();
    const interval = setInterval(load, 15000);
    
    const onLiveSync = () => {
      load();
    };
    const onPresenceSync = () => {
      loadPresence();
    };
    window.addEventListener('nk_live_sync_completed', onLiveSync);
    window.addEventListener('nk_presence_changed', onPresenceSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('nk_live_sync_completed', onLiveSync);
      window.removeEventListener('nk_presence_changed', onPresenceSync);
    };
  }, [session]);

  const getPresenceStatusInfo = (status: string, online: boolean) => {
    if (!online) return { label: 'OFFLINE', bg: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' };
    if (status === 'IN_PROGRESS' || status === 'WORKING') return { label: 'WORKING', bg: 'bg-blue-50 text-blue-600 border-blue-100', dot: 'bg-blue-500' };
    if (status === 'READY') return { label: 'READY', bg: 'bg-purple-50 text-purple-600 border-purple-100', dot: 'bg-purple-500' };
    if (status === 'IDLE') return { label: 'IDLE', bg: 'bg-amber-50 text-amber-600 border-amber-100', dot: 'bg-amber-500' };
    return { label: 'ONLINE', bg: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-500' };
  };

  const formatLastActive = (lastActivityAtStr?: string) => {
    if (!lastActivityAtStr) return 'never';
    const lastActive = new Date(lastActivityAtStr).getTime();
    const diffSecs = Math.floor((Date.now() - lastActive) / 1000);
    if (diffSecs < 60) return 'Just now';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hrs ago`;
    return new Date(lastActivityAtStr).toLocaleDateString();
  };

  if (!session) return null;

  if (loading && !data) {
    return (
      <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-950 overflow-y-auto pb-6 space-y-4">
        {/* Fixed Header Skeleton */}
        <div className="bg-emerald-700 p-4 shrink-0 text-white shadow-md rounded-b-xl mb-3 animate-pulse">
          <div className="h-6 bg-emerald-600 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-emerald-600 rounded w-1/2 mb-4"></div>
          <div className="h-12 bg-white/20 rounded-xl"></div>
        </div>
        
        <div className="px-4 space-y-4">
          {/* Stats Skeleton */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-800 p-4 flex justify-between shadow-sm animate-pulse">
            <div className="w-1/3 flex flex-col items-center gap-2">
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
              <div className="h-3 bg-slate-100 dark:bg-slate-850 rounded w-2/3"></div>
            </div>
            <div className="w-px bg-slate-200 dark:bg-slate-800"></div>
            <div className="w-1/3 flex flex-col items-center gap-2">
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
              <div className="h-3 bg-slate-100 dark:bg-slate-850 rounded w-2/3"></div>
            </div>
            <div className="w-px bg-slate-200 dark:bg-slate-800"></div>
            <div className="w-1/3 flex flex-col items-center gap-2">
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
              <div className="h-3 bg-slate-100 dark:bg-slate-850 rounded w-2/3"></div>
            </div>
          </div>

          {/* Quick Actions Skeleton */}
          <div className="grid grid-cols-2 gap-3 animate-pulse">
            <div className="h-20 bg-slate-200 dark:bg-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-800"></div>
            <div className="h-20 bg-slate-200 dark:bg-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-800"></div>
          </div>

          {/* Live Operations Skeleton */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-4 space-y-4 animate-pulse">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 w-full">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-800"></div>
                  <div className="h-4 bg-slate-100 dark:bg-slate-850 rounded w-1/3"></div>
                </div>
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-20"></div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 w-full">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-800"></div>
                  <div className="h-4 bg-slate-100 dark:bg-slate-850 rounded w-1/4"></div>
                </div>
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-16"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-[#F4F7F6] dark:bg-slate-950 pb-10">
      
      {loading && (
        <div className="mx-3.5 mt-2 shrink-0">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-4 py-2 flex items-center justify-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-black uppercase tracking-wide">
            <RefreshCw size={14} className="animate-spin" />
            Refreshing dashboard…
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto w-full px-3.5 pt-2.5 space-y-3">
        {/* 1. STITCH PROFILE HEADER CARD WITH INTEGRATED SEARCH */}
        <section className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-900 rounded-2xl p-3 text-white shadow-sm" data-purpose="user-profile-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <h1 className="text-lg font-bold tracking-tight text-white">{session.userName}</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white/20 text-emerald-50 tracking-wider backdrop-blur-sm border border-white/20">
                {session.role}
              </span>
              <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-emerald-100 tracking-wider ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>{session.department} DEPARTMENT</span>
              </div>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              aria-label="Sync Profile" 
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all border border-white/15 shrink-0" 
              type="button"
              title="Refresh Dashboard"
            >
              <RefreshCw className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="mt-2.5">
            <div 
              onClick={() => navigate('/patients')}
              className="relative flex items-center cursor-pointer group"
            >
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <Search className="w-4 h-4 text-emerald-700" />
              </span>
              <input 
                readOnly 
                className="w-full pl-9 pr-3 py-2 bg-white text-gray-800 placeholder-gray-400 text-xs font-medium rounded-xl border-0 shadow-inner focus:ring-2 focus:ring-emerald-300 focus:outline-none cursor-pointer" 
                placeholder={t('searchPatientPlaceholder')} 
                type="search" 
              />
            </div>
          </div>
        </section>

        {/* 2. STITCH METRICS SUMMARY (3-COL DIVIDED) */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl py-2.5 px-3 shadow-sm border border-gray-100 dark:border-slate-800" data-purpose="metrics-summary">
          <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-slate-800 text-center">
            <div className="flex flex-col justify-center px-1">
              <span className="text-2xl font-black text-gray-900 dark:text-slate-100 leading-tight">{data?.stats?.patientsToday || 0}</span>
              <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider mt-0.5">Today Reg.</span>
            </div>
            <div className="flex flex-col justify-center px-1">
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400 leading-tight">{data?.stats?.totalVisits || 0}</span>
              <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400 tracking-wider mt-0.5 truncate">{t('activeVisits')}</span>
            </div>
            <div className="flex flex-col justify-center px-1">
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400 leading-tight">{data?.stats?.totalPatients || 0}</span>
              <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400 tracking-wider mt-0.5 truncate">{t('totalPatients')}</span>
            </div>
          </div>
        </section>

        {/* 3. STITCH QUICK ACTIONS (50/50 BALANCED GRID) */}
        <section className="grid grid-cols-2 gap-2.5" data-purpose="quick-actions">
          <button 
            onClick={() => navigate('/patients/new')} 
            className="flex items-center space-x-2.5 p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-[0.98] transition-transform text-left" 
            type="button"
          >
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <FilePlus className="w-5 h-5 text-white" />
            </div>
            <div className="overflow-hidden flex-1">
              <div className="text-xs font-bold leading-tight text-white whitespace-nowrap truncate">{t('registerPatient')}</div>
              <div className="text-[10px] font-medium text-emerald-100 uppercase tracking-wider mt-0.5 truncate">New Record</div>
            </div>
          </button>
          <button 
            onClick={() => navigate('/patients')} 
            className="flex items-center space-x-2.5 p-3 rounded-2xl bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-800 dark:text-slate-100 border border-gray-100 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-transform text-left" 
            type="button"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="overflow-hidden flex-1">
              <div className="text-xs font-bold text-gray-900 dark:text-slate-100 leading-tight truncate">{t('patients')}</div>
              <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mt-0.5 truncate">View All</div>
            </div>
          </button>
        </section>

        {/* 4. STITCH LIVE OPERATIONS DESK (COMPACT HORIZONTAL CARDS) */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-slate-800 space-y-2.5" data-purpose="live-operations">
          <div className="flex items-center justify-between pb-0.5">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-800">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xs font-extrabold tracking-tight text-gray-900 dark:text-slate-100 uppercase leading-none">Live Operations Desk</h2>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium mt-0.5">Real-time team presence &amp; workbench</p>
              </div>
            </div>
            <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold tracking-tight shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
              {presenceList.filter(p => p.isOnline).length} Active
            </div>
          </div>
          <div className="space-y-1.5 pt-1">
            {presenceList.map(presence => {
              const statusInfo = getPresenceStatusInfo(presence.currentStatus, presence.isOnline);
              const initials = presence.userName ? presence.userName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'OP';

              return (
                <article 
                  key={presence.userId}
                  onClick={() => navigate(`/profile/${presence.userId}`)}
                  className="bg-gray-50/70 dark:bg-slate-850/60 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-xl p-2.5 flex items-center justify-between transition-colors cursor-pointer" 
                  data-purpose="operator-card"
                >
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                        {initials}
                      </div>
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white dark:border-slate-900 rounded-full ${statusInfo.dot}`}></span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <h3 className="text-xs font-bold text-gray-900 dark:text-slate-100 leading-tight truncate">{presence.userName}</h3>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700 uppercase tracking-wider shrink-0">{presence.department || 'GEN'}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium leading-none mt-0.5">
                        {presence.isOnline ? 'Active now' : formatLastActive(presence.lastActivityAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <span className="text-[10px] text-gray-500 dark:text-slate-400 font-semibold bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-gray-100 dark:border-slate-700 max-w-[100px] truncate">
                      {presence.currentScreen || 'Dashboard'}
                    </span>
                    <span className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wide uppercase ${statusInfo.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} ${presence.isOnline ? 'animate-pulse' : ''}`}></span>
                      <span>{statusInfo.label}</span>
                    </span>
                  </div>
                </article>
              );
            })}

            {presenceList.length === 0 && (
              <div className="p-6 text-center text-xs font-bold text-slate-400 italic bg-slate-50/50 dark:bg-slate-950/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                No active operators currently tracked.
              </div>
            )}
          </div>
        </section>

        {/* 4. RECENT ACTIONS & SYSTEM HEALTH ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* RECENT ACTIONS FEED (7 COLS) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-900/50 px-5 py-4 border-b-2 border-slate-100 dark:border-slate-850 font-black flex items-center gap-2.5 text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">
              <Clock size={18} className="text-purple-500" /> 
              <span>Recent Activity Feed</span>
            </div>
            
            <div className="divide-y-2 divide-slate-50 dark:divide-slate-800 max-h-[300px] overflow-y-auto">
              {data?.recentLogs?.map(log => (
                <div key={log.id} className="px-5 py-3.5 flex items-center justify-between gap-3 text-sm hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-800 dark:text-slate-200 font-semibold truncate">
                        <span className="font-black text-slate-900 dark:text-slate-100">{log.userName}</span> 
                        <span className="text-slate-400 text-xs font-bold mx-1.5">({log.deptCode})</span> 
                        <span className="text-slate-600 dark:text-slate-300 font-medium">{log.action}</span>
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                    {formatLogTime(log.timestamp)}
                  </span>
                </div>
              ))}
              
              {(!data?.recentLogs || data.recentLogs.length === 0) && (
                <div className="p-6 text-center text-sm font-bold text-slate-400 italic">No recent activity logged</div>
              )}
            </div>
          </div>

          {/* SYSTEM HEALTH & CONNECTION STATUS (5 COLS) */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div className={`p-5 rounded-2xl border-2 font-bold flex flex-col justify-between flex-1 ${isOnline ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-orange-50/70 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300'}`}>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl shrink-0 ${isOnline ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400'}`}>
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">System Link</p>
                  <h3 className="text-lg font-black tracking-tight mt-0.5">
                    {isOnline ? 'Realtime Database Connected' : 'Offline / Server Disconnected'}
                  </h3>
                  <p className="text-xs font-bold opacity-80 mt-1 leading-relaxed">
                    {isOnline ? 'Local IndexedDB engine & backend server are synchronized.' : 'Check local WiFi network or configure laptop server IP.'}
                  </p>
                </div>
              </div>

              {!isOnline && (
                <div className="mt-4 pt-3 border-t border-orange-200 dark:border-orange-800/80 flex justify-end">
                  <Link to="/settings" className="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm">
                    Configure Server IP
                  </Link>
                </div>
              )}
            </div>

            {data?.stats?.totalPatients === 0 && (
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 rounded-2xl shadow-lg space-y-2">
                <div className="flex items-center gap-2">
                  <RefreshCw size={20} className="animate-spin" />
                  <p className="font-black text-base">Empty Database Detected</p>
                </div>
                <p className="text-xs font-bold opacity-90 leading-relaxed">Tap Sync at the top to download patient records from laptop database.</p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
