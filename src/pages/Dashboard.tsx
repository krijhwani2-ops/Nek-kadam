import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FilePlus, Activity, Clock, RefreshCw,
  Search, ShieldCheck, Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchDashboardData, DashboardData, logActivity, getBaseUrl } from '../lib/session';
import { useApp } from '../contexts/AppContext';

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
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-y-auto pb-10">
      
      {loading && (
        <div className="mx-4 mt-2 shrink-0">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 flex items-center justify-center gap-2 text-emerald-800 text-xs font-black uppercase tracking-wide">
            <RefreshCw size={14} className="animate-spin" />
            Refreshing dashboard…
          </div>
        </div>
      )}
      
      {/* 1. TOP HEADER & SEARCH BANNER */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 p-5 sm:p-6 shrink-0 text-white shadow-lg rounded-b-2xl mb-5">
        <div className="max-w-7xl mx-auto w-full space-y-4">
          <div className="flex flex-row justify-between items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-2xl sm:text-3xl text-white tracking-tight">{session.userName}</h1>
                <span className="bg-white/20 backdrop-blur-md text-white text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider border border-white/20">
                  {session.role}
                </span>
              </div>
              <p className="text-emerald-200 text-xs font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                {session.department} Department
              </p>
            </div>
            
            <button 
              onClick={() => window.location.reload()} 
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md border border-white/20 active:scale-95 transition-all shadow-sm flex items-center gap-2"
              title="Refresh Dashboard"
            >
              <RefreshCw size={18} />
              <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Quick Search Bar */}
          <button 
            onClick={() => navigate('/patients')}
            className="w-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 flex items-center p-3.5 sm:p-4 rounded-2xl shadow-xl gap-3 text-left border-2 border-emerald-500/30 dark:border-slate-800 hover:border-emerald-400 transition-all group"
          >
            <Search size={22} className="text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-base text-slate-500 dark:text-slate-400 flex-1">{t('searchPatientPlaceholder')}</span>
            <kbd className="hidden sm:inline-block px-2.5 py-1 text-xs font-black text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">⌘K</kbd>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 space-y-6">
        
        {/* 2. STATS & QUICK ACTIONS ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* STATS BAR (7 COLS) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 flex items-center justify-around shadow-sm">
            <div className="text-center px-2">
              <p className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{data?.stats?.patientsToday || 0}</p>
              <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1">Today Registered</p>
            </div>
            <div className="h-10 w-px bg-slate-200 dark:bg-slate-800"></div>
            <div className="text-center px-2">
              <p className="text-3xl font-black text-purple-600 dark:text-purple-400 tracking-tight">{data?.stats?.totalVisits || 0}</p>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{t('activeVisits')}</p>
            </div>
            <div className="h-10 w-px bg-slate-200 dark:bg-slate-800"></div>
            <div className="text-center px-2">
              <p className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">{data?.stats?.totalPatients || 0}</p>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{t('totalPatients')}</p>
            </div>
          </div>

          {/* QUICK ACTIONS BAR (5 COLS - HORIZONTALLY ALIGNED BUTTONS) */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3">
            <button 
              onClick={() => navigate('/patients/new')} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl shadow-md flex items-center justify-start gap-3 border-b-4 border-emerald-800 active:translate-y-0.5 transition-all group"
            >
              <div className="p-2.5 bg-emerald-500/40 rounded-xl group-hover:scale-110 transition-transform">
                <FilePlus size={22} />
              </div>
              <div className="text-left">
                <span className="font-black text-sm block leading-tight">{t('registerPatient')}</span>
                <span className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider">New Record</span>
              </div>
            </button>

            <button 
              onClick={() => navigate('/medicines')} 
              className="bg-white dark:bg-slate-900 hover:bg-purple-50/50 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-100 p-4 rounded-2xl border-2 border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-start gap-3 border-b-4 border-slate-300 dark:border-slate-750 active:translate-y-0.5 transition-all group"
            >
              <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 rounded-xl text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                <Activity size={22} />
              </div>
              <div className="text-left">
                <span className="font-black text-sm block leading-tight">{t('medicines')}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pharmacy Queue</span>
              </div>
            </button>
          </div>
        </div>

        {/* 3. LIVE OPERATIONS WIDGET (HORIZONTALLY ALIGNED CARD GRID) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden p-5">
          <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-slate-100 dark:border-slate-850">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Users size={20} />
              </div>
              <div>
                <h2 className="font-black text-slate-800 dark:text-slate-100 text-base uppercase tracking-wider">Live Operations Desk</h2>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Real-time team presence & active workbench monitoring</p>
              </div>
            </div>
            
            <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs px-3 py-1 rounded-full font-black border border-emerald-200/80 dark:border-emerald-800 flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              {presenceList.filter(p => p.isOnline).length} Active Operators
            </span>
          </div>

          {/* HORIZONTAL MULTI-COLUMN CARD GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {presenceList.map(presence => {
              const statusInfo = getPresenceStatusInfo(presence.currentStatus, presence.isOnline);
              const initials = presence.userName ? presence.userName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'OP';

              return (
                <div 
                  key={presence.userId} 
                  onClick={() => navigate(`/profile/${presence.userId}`)}
                  className="bg-slate-50/70 dark:bg-slate-850/60 hover:bg-white dark:hover:bg-slate-800 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer transition-all hover:shadow-md group flex flex-col justify-between space-y-3"
                >
                  {/* Top row: Avatar + Name + Department */}
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black flex items-center justify-center text-xs shadow-sm">
                        {initials}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${statusInfo.dot}`}></span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-800 dark:text-slate-100 text-sm truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {presence.userName}
                      </p>
                      <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 truncate">
                        {presence.department}
                      </p>
                    </div>
                  </div>

                  {/* Bottom row: Status badge + Active location */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider shrink-0 ${statusInfo.bg}`}>
                      {statusInfo.label}
                    </span>

                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-bold truncate text-right">
                      {presence.isOnline ? (
                        <>
                          {presence.currentScreen || 'Dashboard'}
                          {presence.currentPatientName && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-black"> ({presence.currentPatientName})</span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-medium">
                          {formatLastActive(presence.lastActivityAt)}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}

            {presenceList.length === 0 && (
              <div className="col-span-full p-8 text-center text-sm font-bold text-slate-400 italic bg-slate-50/50 dark:bg-slate-950/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                No active operators currently tracked.
              </div>
            )}
          </div>
        </div>

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
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></div>
                    <div className="min-w-0">
                      <p className="text-slate-800 dark:text-slate-200 font-semibold truncate">
                        <span className="font-black text-slate-900 dark:text-slate-100">{log.userName}</span> 
                        <span className="text-slate-400 text-xs font-bold mx-1.5">({log.deptCode})</span> 
                        <span className="text-slate-600 dark:text-slate-300 font-medium">{log.action}</span>
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                    {new Date(log.timestamp + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
