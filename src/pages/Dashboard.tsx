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
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-950 overflow-y-auto pb-6">
      
      {loading && (
        <div className="mx-4 mt-2 shrink-0">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 flex items-center justify-center gap-2 text-emerald-800 text-xs font-black uppercase tracking-wide">
            <RefreshCw size={14} className="animate-spin" />
            Refreshing dashboard…
          </div>
        </div>
      )}
      
      {/* 1. FIXED SEARCH (TOP) */}
      <div className="bg-emerald-700 p-4 shrink-0 text-white shadow-md rounded-b-xl mb-3">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="font-bold text-2xl">{session.userName}</h1>
            <p className="text-emerald-200 text-xs uppercase tracking-wide font-bold">{session.department} • {session.role}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="p-2 bg-emerald-800 rounded-lg active:bg-emerald-900 border border-emerald-600"
            aria-label="Refresh dashboard"
            title="Refresh dashboard"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <button 
          onClick={() => navigate('/patients')}
          className="w-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 flex items-center p-3.5 rounded-xl shadow gap-3 text-left border-b-4 border-slate-200 dark:border-slate-800 active:border-b-0 active:translate-y-1 transition-all"
        >
          <Search size={20} className="text-emerald-600" />
          <span className="font-black text-base">{t('searchPatientPlaceholder')}</span>
        </button>
      </div>

      <div className="px-4 space-y-3">
        {/* 2. TODAY STATS */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-800 p-3 flex justify-between shadow-sm">
          <div className="text-center w-1/3">
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{data?.stats?.patientsToday || 0}</p>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Today</p>
          </div>
          <div className="w-px bg-slate-200 dark:bg-slate-800"></div>
          <div className="text-center w-1/3">
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{data?.stats?.totalVisits || 0}</p>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{t('activeVisits')}</p>
          </div>
          <div className="w-px bg-slate-200 dark:bg-slate-800"></div>
          <div className="text-center w-1/3">
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{data?.stats?.totalPatients || 0}</p>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{t('totalPatients')}</p>
          </div>
        </div>

        {/* 3. QUICK ACTIONS */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/patients/new')} className="bg-emerald-600 text-white p-3.5 rounded-xl shadow-sm flex flex-col items-center justify-center gap-1.5 border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 transition-all">
            <FilePlus size={24} />
            <span className="font-black text-sm">{t('registerPatient')}</span>
          </button>
          <button onClick={() => navigate('/medicines')} className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 p-3.5 rounded-xl shadow-sm flex flex-col items-center justify-center gap-1.5 border-b-4 active:border-b-2 active:translate-y-0.5 transition-all">
            <Activity size={24} className="text-purple-600" />
            <span className="font-black text-sm">{t('medicines')}</span>
          </button>
        </div>

        {/* LIVE OPERATIONS WIDGET */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-b-2 border-slate-100 dark:border-slate-850 font-black flex items-center justify-between text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-emerald-600" />
              <span>Live Operations</span>
            </div>
            <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-black border border-emerald-200 dark:border-emerald-800">
              {presenceList.filter(p => p.isOnline).length} Active
            </span>
          </div>
          
          <div className="divide-y-2 divide-slate-50 dark:divide-slate-800 max-h-[350px] overflow-y-auto">
            {presenceList.map(presence => {
              const statusInfo = getPresenceStatusInfo(presence.currentStatus, presence.isOnline);
              return (
                <div 
                  key={presence.userId} 
                  onClick={() => navigate(`/profile/${presence.userId}`)}
                  className="px-4 py-3 flex items-center justify-between gap-3 text-sm hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusInfo.dot} shrink-0 animate-pulse`}></div>
                    <div className="min-w-0">
                      <p className="font-black text-slate-800 dark:text-slate-100 truncate">
                        {presence.userName}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                        {presence.department}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${statusInfo.bg}`}>
                      {statusInfo.label}
                    </span>
                    
                    {presence.isOnline ? (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                        {presence.currentScreen}
                        {presence.currentPatientName && (
                          <span className="text-slate-400 dark:text-slate-500 font-medium"> ({presence.currentPatientName})</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                        Last seen {formatLastActive(presence.lastActivityAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {presenceList.length === 0 && (
              <div className="p-8 text-center text-sm font-bold text-slate-400 italic">
                No active operators tracked.
              </div>
            )}
          </div>
        </div>

        {/* 6. RECENT ACTIONS */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-b-2 border-slate-100 dark:border-slate-850 font-black flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">
            <Clock size={18} className="text-purple-500" /> Recent Actions
          </div>
          <div className="divide-y-2 divide-slate-50 dark:divide-slate-800">
            {data?.recentLogs?.map(log => (
              <div key={log.id} className="px-4 py-3 flex gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700 mt-1.5 shrink-0"></div>
                <div>
                  <p className="text-slate-700 dark:text-slate-300 font-medium"><span className="font-bold text-slate-900 dark:text-slate-100">{log.userName}</span> <span className="text-slate-400 text-xs font-bold mx-1">({log.deptCode})</span> {log.action}</p>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                    {new Date(log.timestamp + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {(!data?.recentLogs || data.recentLogs.length === 0) && (
              <div className="p-4 text-center text-sm font-bold text-slate-400">No recent activity</div>
            )}
          </div>
        </div>

        {/* 7. SYSTEM HEALTH & SYNC */}
        <div className={`p-4 rounded-xl border-2 font-bold ${isOnline ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-350' : 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-350'}`}>
          <div className="flex items-center gap-4">
            <ShieldCheck size={28} className={isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500'} />
            <div className="flex-1">
              <p className="text-sm font-black uppercase tracking-wider">Connection Status</p>
              <p className="text-xs font-bold opacity-80 mt-0.5">
                {isOnline ? 'Connected to Backend' : 'Offline: Check WiFi or Server IP'}
              </p>
            </div>
            {!isOnline && (
              <Link to="/settings" className="px-3 py-1.5 bg-orange-200 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-lg text-[10px] font-black uppercase tracking-widest">
                Fix Connection
              </Link>
            )}
          </div>
        </div>

        {data?.stats?.totalPatients === 0 && (
          <div className="bg-blue-600 text-white p-6 rounded-2xl shadow-xl shadow-blue-200 space-y-4 animate-bounce-subtle">
            <div className="flex items-center gap-3">
              <RefreshCw size={24} className="animate-spin-slow" />
              <p className="font-black text-lg">Data Required</p>
            </div>
            <p className="text-sm font-bold opacity-90 leading-relaxed">It looks like your local database is empty. Tap the Sync button at the top to download patient records.</p>
          </div>
        )}

      </div>
    </div>
  );
}
