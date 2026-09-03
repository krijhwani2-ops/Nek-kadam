import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { getBaseUrl } from './lib/session';
import { App as CapApp } from '@capacitor/app';
import { io } from 'socket.io-client';
import { 
  Users, Settings, LogOut,
  Database, RefreshCw, Wifi, WifiOff,
  UserPlus, HeartPulse, FileDown,
  LayoutDashboard, ChevronLeft, ListChecks,
  ClipboardList, Monitor, Menu, X, MessageSquare
} from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useApp } from './contexts/AppContext';
import { QRCodeSVG } from 'qrcode.react';

// Pages
import Dashboard from './pages/Dashboard';
import PatientsList from './pages/PatientsList';
import PatientProfile from './pages/PatientProfile';
import NewPatient from './pages/NewPatient';
import Medicines from './pages/Medicines';
import ImportPatients from './pages/ImportPatients';
import Login from './pages/Login';
import SplashScreen from './components/SplashScreen';
import SettingsPage from './pages/Settings';
import Attendance from './pages/Attendance';
import MedicineQueue from './pages/MedicineQueue';
import MedicineDashboard from './pages/MedicineDashboard';
import UserProfile from './pages/UserProfile';
import Chat from './pages/Chat';

// ─── BACK BUTTON HANDLER (Android Hardware Back) ───
function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const cap = (window as any)?.Capacitor;
    const isNative = cap && (cap.isNativePlatform === true || cap.getPlatform?.() === 'android' || cap.getPlatform?.() === 'ios');
    if (!isNative) return;

    let removeListener: (() => void) | null = null;
    try {
      CapApp.addListener('backButton', () => {
        if (location.pathname === '/' || location.pathname === '/dashboard') {
          CapApp.minimizeApp().catch(() => {});
        } else {
          if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
          } else {
            navigate('/', { replace: true });
          }
        }
      }).then(h => {
        removeListener = () => h.remove();
      }).catch(err => {
        console.warn('[BACK BUTTON] Not supported on this platform:', err);
      });
    } catch (_e) {
      // Ignored on non-native platforms
    }

    return () => {
      if (removeListener) removeListener();
    };
  }, [navigate, location.pathname]);

  return null;
}

const APP_VERSION = "1.0.8"; // Increment this in future builds

function OTAUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState<{version: string, apkUrl: string} | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/api/version`);
        const data = await res.json();
        if (data && data.version && data.version !== APP_VERSION) {
          setUpdateAvailable(data);
        }
      } catch (e) {
        // Silent fail if server offline
      }
    };
    checkUpdate();
    const interval = setInterval(checkUpdate, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const startDownload = async (apkUrl: string) => {
    const cap = (window as any)?.Capacitor;
    const isNative = cap && (cap.isNativePlatform === true || cap.getPlatform?.() === 'android' || cap.getPlatform?.() === 'ios');
    if (!isNative) {
      window.open(`${getBaseUrl()}${apkUrl}`, '_blank');
      setUpdateAvailable(null);
      return;
    }

    setIsDownloading(true);
    setProgress(0);
    setDownloadError(null);
    
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { FileOpener } = await import('@capacitor-community/file-opener');
      
      const url = `${getBaseUrl()}${apkUrl}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Server returned " + response.status);
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      if (!response.body) throw new Error("ReadableStream not supported");
      
      const reader = response.body.getReader();
      let loaded = 0;
      const chunks: Uint8Array[] = [];
      
      // eslint-disable-next-line no-constant-condition
      while(true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.length;
          if (total > 0) {
            setProgress(Math.round((loaded / total) * 100));
          }
        }
      }
      
      const allChunks = new Uint8Array(loaded);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }
      
      const base64Data = await new Promise<string>((resolve, reject) => {
        const blob = new Blob([allChunks], { type: 'application/vnd.android.package-archive' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const fileName = 'nek-kadam-update.apk';
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.External
      });
      
      await FileOpener.open({
        filePath: writeResult.uri,
        contentType: 'application/vnd.android.package-archive'
      });
      
      setIsDownloading(false);
      setProgress(null);
      setUpdateAvailable(null);
    } catch (err: any) {
      console.error("Download failed:", err);
      setDownloadError(err.message || "Failed to download update. Redirecting to browser download...");
      setIsDownloading(false);
      setProgress(null);
      
      // Safe fallback: open in browser after showing the error
      setTimeout(() => {
        window.open(`${getBaseUrl()}${apkUrl}`, '_blank');
        setUpdateAvailable(null);
      }, 2000);
    }
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-in zoom-in-95 duration-300">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileDown size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2">Update Available!</h2>
        <p className="text-sm text-slate-500 mb-6 font-medium">
          {isDownloading ? 'Downloading update package...' : `A new version (${updateAvailable.version}) is available. Please update to continue.`}
        </p>

        {isDownloading ? (
          <div className="space-y-3">
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300 rounded-full" 
                style={{ width: `${progress || 0}%` }}
              ></div>
            </div>
            <div className="text-xs font-bold text-slate-400">
              {progress !== null ? `${progress}% Completed` : 'Connecting...'}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {downloadError && (
              <p className="text-xs font-black text-red-500 mb-2">Error: {downloadError}</p>
            )}
            <div className="flex gap-3">
              <button 
                onClick={() => setUpdateAvailable(null)}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Later
              </button>
              <button 
                onClick={() => startDownload(updateAvailable.apkUrl)}
                className="flex-1 px-4 py-3 rounded-xl font-black text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all"
              >
                Update Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Sidebar() {
  const { logout } = useAuth();
  const { t } = useApp();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [mobileUrl, setMobileUrl] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const { checkServerOnline, getPendingOps, getServerIp } = await import('./lib/db');
        const online = await checkServerOnline();
        setIsOnline(online);
        const ops = await getPendingOps();
        setPendingCount(ops.length);
        
        const ip = getServerIp();
        setMobileUrl(`http://${ip}:5173`);

        const { getBaseUrl } = await import('./lib/session');
        const presenceRes = await fetch(`${getBaseUrl()}/api/presence`);
        const pJson = await presenceRes.json();
        if (pJson.data) {
           setOnlineUsers(pJson.data.filter((u: any) => u.isOnline));
        }
      } catch { /* safe */ }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="hidden md:flex w-72 glass-panel p-6 flex-col gap-3 z-20 relative min-h-screen">
      <div className="flex items-center gap-3 px-2 mb-8">
        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <HeartPulse className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">Nek Kadam</h1>
          <p className="text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold">Clinical System</p>
        </div>
      </div>
      
      <div className="space-y-1">
        <NavLink to="/" icon={LayoutDashboard} label={t('dashboard')} />
        <NavLink to="/attendance" icon={ListChecks} label={t('attendance')} />
        <NavLink to="/patients" icon={Users} label={t('patients')} />
        <NavLink to="/patients/new" icon={UserPlus} label={t('registerPatient')} />
        <NavLink to="/medicines" icon={Database} label={t('medicinesDb')} />
        <NavLink to="/med-queue" icon={ClipboardList} label={t('pharmacyQueue')} />
        <NavLink to="/med-dashboard" icon={Monitor} label={t('handoverDesk')} />
        <NavLink to="/chat" icon={MessageSquare} label={t('chatDesk')} />
      </div>

      <div className="mt-8 space-y-1">
        <p className="px-4 text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">{t('tools')}</p>
        <NavLink to="/import" icon={FileDown} label={t('dataImport')} />
        <NavLink to="/settings" icon={Settings} label={t('settings')} />
      </div>

      <div className="mt-auto pt-8 flex flex-col gap-3">
        {pendingCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 dark:bg-orange-950/20 rounded-xl border border-orange-100 dark:border-orange-900/30">
            <RefreshCw size={18} className="text-orange-500 animate-spin" />
            <div className="flex-1">
              <p className="text-xs font-bold text-orange-800 dark:text-orange-400">Pending Sync</p>
              <p className="text-[10px] text-orange-600 dark:text-orange-300">{pendingCount} items waiting</p>
            </div>
          </div>
        )}

        {mobileUrl && (
          <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
             <div className="flex-1 min-w-0">
               <p className="text-[9px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 mb-1">Mobile Web Access</p>
               <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 select-all truncate">{mobileUrl}</p>
             </div>
             <button
               onClick={() => setShowQrModal(true)}
               className="p-2 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-600 hover:text-emerald-700 border border-slate-200 dark:border-slate-700 shadow-sm rounded-lg transition-all shrink-0 flex items-center justify-center"
               title="Show Access QR Code"
             >
               <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">QR</span>
             </button>
          </div>
        )}

        <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border ${
          isOnline
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30'
            : 'bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30'
        }`}>
          {isOnline ? (
            <><Wifi size={14} className="text-emerald-500" />
            <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">{t('serverOnline')}</p></>
          ) : (
            <><WifiOff size={14} className="text-orange-500" />
            <p className="text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest">{t('offlineMode')}</p></>
          )}
        </div>

        {onlineUsers.length > 0 && (
          <div className="px-4 pt-1 pb-2">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-2">Live Traffic ({onlineUsers.length})</p>
            <div className="space-y-2 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
              {onlineUsers.map(u => (
                <div key={u.id} className="flex items-center gap-2">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{u.userName}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <button onClick={logout} className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-colors mt-1">
          <LogOut size={20} />
          <span className="text-sm">{t('switchUser')}</span>
        </button>
      </div>

      {showQrModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 max-w-sm w-full rounded-[2.5rem] p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-450 rounded-2xl flex items-center justify-center mx-auto text-xl">
              📱
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Scan Mobile QR Code</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-1 uppercase tracking-wide">Connect Volunteers Instantly</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg max-w-[200px] mx-auto">
              <QRCodeSVG value={mobileUrl} size={160} level="H" includeMargin={true} />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Connect Link</p>
              <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 select-all">{mobileUrl}</p>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-normal">
              Make sure your mobile phone is connected to the same Wi-Fi network as this computer to access the clinic.
            </p>
            <button 
              onClick={() => setShowQrModal(false)}
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-black rounded-2xl transition-all text-sm uppercase tracking-wider"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

function TopBar({ onSync, syncing, onToggleMenu }: { onSync: () => void, syncing: boolean, onToggleMenu: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '/dashboard';
  const { t } = useApp();
  const { session, logout } = useAuth();
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const fetchPresence = async () => {
      try {
        const { getBaseUrl } = await import('./lib/session');
        const res = await fetch(`${getBaseUrl()}/api/presence`);
        const json = await res.json();
        if (json.data) {
           setOnlineCount(json.data.filter((u: any) => u.isOnline).length);
        }
      } catch (e) { }
    };
    fetchPresence();
    const interval = setInterval(fetchPresence, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 flex items-center justify-between px-3 bg-emerald-600 text-white shadow-sm shrink-0 min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 min-w-0 shrink">
        {session && (
          <button 
            onClick={onToggleMenu}
            className="md:hidden p-2 rounded-lg hover:bg-emerald-700 active:bg-emerald-800 shrink-0"
            aria-label="Toggle Menu"
          >
            <Menu size={22} />
          </button>
        )}
        {!isHome && (
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 rounded-full hover:bg-emerald-700 active:bg-emerald-800 shrink-0"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <h1 className="text-lg font-bold tracking-tight truncate shrink-0">Nek Kadam</h1>
        {session && (
          <span className="hidden sm:inline-block bg-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-500/40 ml-2 truncate max-w-[160px] min-w-0 shrink">
            Using as: {session.userName}
          </span>
        )}
        {onlineCount > 0 && (
          <span className="flex items-center gap-1.5 ml-1 sm:ml-2 bg-emerald-800/50 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/20 shrink-0">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="truncate">{onlineCount} Online</span>
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        {session && (
          <button 
            onClick={logout} 
            className="px-2.5 py-1.5 bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 font-bold text-xs active:bg-emerald-950 border border-emerald-500/30 shrink-0"
          >
            {t('switchUser')}
          </button>
        )}
        <button 
          onClick={onSync} 
          disabled={syncing}
          className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg flex items-center gap-2 font-bold text-xs active:bg-emerald-900 shrink-0"
        >
           <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
           {syncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  const location = useLocation();
  const { t } = useApp();
  
  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
    return (
      <Link to={to} className={`flex flex-col items-center justify-center w-full py-2 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
        <Icon size={22} />
        <span className="text-[10px] font-bold mt-0.5">{label}</span>
      </Link>
    );
  };

  return (
    <div className="md:hidden flex items-center justify-around bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 h-14 shrink-0 pb-safe">
      <NavItem to="/" icon={LayoutDashboard} label={t('home')} />
      <NavItem to="/patients" icon={Users} label={t('patients')} />
      <NavItem to="/patients/new" icon={UserPlus} label={t('new')} />
      <NavItem to="/med-queue" icon={ClipboardList} label={t('pharmacy')} />
      <NavItem to="/chat" icon={MessageSquare} label={t('chat')} />
    </div>
  );
}

function AppLayout() {
  const { isLoggedIn, loading, session, updatePresence, logout } = useAuth();
  const { t } = useApp();
  const [syncing, setSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Screen/module transition tracking
  useEffect(() => {
    if (isLoggedIn && session) {
      let screenName = 'Dashboard';
      const path = location.pathname;
      if (path === '/' || path === '/dashboard') {
        screenName = 'Dashboard';
      } else if (path === '/patients/new') {
        screenName = 'Add Visit';
      } else if (path.startsWith('/patients/')) {
        screenName = 'Patient Profile';
      } else if (path === '/patients') {
        screenName = 'Patient Directory';
      } else if (path === '/attendance') {
        screenName = 'Attendance';
      } else if (path === '/medicines') {
        screenName = 'Medicines Database';
      } else if (path === '/import') {
        screenName = 'Data Import';
      } else if (path === '/settings') {
        screenName = 'Settings';
      } else if (path === '/med-queue') {
        // Handled internally by MedicineQueue.tsx to preserve WORKING state
        return;
      } else if (path === '/med-dashboard') {
        screenName = 'Medicine Dashboard';
      } else if (path === '/chat') {
        screenName = 'Chat Desk';
      } else if (path.startsWith('/profile/')) {
        screenName = 'User Profile';
      }
      
      updatePresence(screenName, 'ONLINE');
    }
  }, [location.pathname, isLoggedIn, session, updatePresence]);

  // Reset scroll positions of parent layout containers on navigation
  useEffect(() => {
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTop = 0;
      if (mainElement.parentElement) {
        mainElement.parentElement.scrollTop = 0;
      }
    }
    window.scrollTo(0, 0);
  }, [location.pathname]);
  
  const handleSync = async () => {
    setSyncing(true);
    try {
      const { fullDataSync } = await import('./lib/db');
      const { logActivity } = await import('./lib/session');
      const result = await fullDataSync();
      if (!result.success) {
        alert("SYNC FAILED: " + result.message);
      } else {
        await logActivity('Full Sync');
        alert("SYNC OK: " + result.message);
        window.location.reload();
      }
    } catch (e: any) {
      alert("ERROR: " + e.message);
    }
    setSyncing(false);
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    let socket: any = null;
    let syncTimer: any = null;
    let flushInterval: any = null;

    // Run full sync once on app load
    import('./lib/db').then(async ({ fullDataSync }) => {
      try {
        console.log('[LIVE SYNC] Initial sync on app load...');
        setSyncing(true);
        await fullDataSync();
        window.dispatchEvent(new Event('nk_live_sync_completed'));
      } catch (e) {
        console.error('[LIVE SYNC] Initial sync failed:', e);
      } finally {
        setSyncing(false);
      }
    });

    import('./lib/db').then(({ fullDataSync }) => {
      const socketUrl = getBaseUrl();
      socket = io(socketUrl, { reconnection: true, transports: ['websocket', 'polling'] });
      
      socket.on('connect', () => {
        console.log('[LIVE SYNC] Connected to server socket. Catching up...');
        setSyncing(true);
        fullDataSync().then(() => {
          window.dispatchEvent(new Event('nk_live_sync_completed'));
        }).catch(err => console.error('[LIVE SYNC] Catchup failed:', err))
          .finally(() => setSyncing(false));
      });

      socket.on('db_changed', (msg: any) => {
        console.log('[LIVE SYNC] DB Changed', msg);
        if (msg && msg.table === 'user_presence') {
          window.dispatchEvent(new Event('nk_presence_changed'));
          return;
        }
        if (syncTimer) clearTimeout(syncTimer);
        
        syncTimer = setTimeout(async () => {
           try {
             setSyncing(true);
             await fullDataSync();
             window.dispatchEvent(new Event('nk_live_sync_completed'));
           } catch (e) {
             console.error('[LIVE SYNC] Error:', e);
           } finally {
             setSyncing(false);
           }
        }, 500);
      });
    });

    // Periodically flush pending operations to the server (every 10 seconds)
    flushInterval = setInterval(async () => {
      try {
        const { syncPendingOps, getPendingOps } = await import('./lib/db');
        const pending = await getPendingOps();
        if (pending.length > 0) {
          console.log('[AUTO-SYNC] Flushing pending operations...');
          const result = await syncPendingOps();
          if (result.synced > 0) {
            window.dispatchEvent(new Event('nk_live_sync_completed'));
          }
        }
      } catch (e) {
        console.error('[AUTO-SYNC] Periodic flush failed:', e);
      }
    }, 10000);

    return () => {
      if (socket) socket.disconnect();
      if (syncTimer) clearTimeout(syncTimer);
      if (flushInterval) clearInterval(flushInterval);
    };
  }, [isLoggedIn]);

  // Safety watchdog: ensure loading screen NEVER stays stuck for more than 2 seconds
  const [splashTimedOut, setSplashTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashTimedOut(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (loading && !splashTimedOut) {
    return <SplashScreen />;
  }

  // Protect routes
  if (!isLoggedIn && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <BackButtonHandler />
      <OTAUpdater />

      {isLoggedIn && <Sidebar />}
      
      {/* Mobile Drawer Overlay */}
      {isLoggedIn && mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Overlay backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Drawer content */}
          <div className="relative flex-grow flex flex-col max-w-xs w-full bg-white dark:bg-slate-900 p-6 shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Close button */}
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 rounded-lg active:bg-slate-100 dark:active:bg-slate-800"
              aria-label="Close menu"
            >
              <X size={22} />
            </button>
            
            {/* Header info */}
            <div className="flex items-center gap-3 px-2 mb-8 mt-2">
              <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <HeartPulse className="text-white w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">Nek Kadam</h2>
                <p className="text-[9px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold">Clinical System</p>
              </div>
            </div>
            
            {/* Nav links */}
            <div className="flex-grow overflow-y-auto space-y-1 pr-1 custom-scrollbar" onClick={() => setMobileMenuOpen(false)}>
              <NavLink to="/" icon={LayoutDashboard} label={t('dashboard')} />
              <NavLink to="/attendance" icon={ListChecks} label={t('attendance')} />
              <NavLink to="/patients" icon={Users} label={t('patients')} />
              <NavLink to="/patients/new" icon={UserPlus} label={t('registerPatient')} />
              <NavLink to="/medicines" icon={Database} label={t('medicinesDb')} />
              <NavLink to="/med-queue" icon={ClipboardList} label={t('pharmacyQueue')} />
              <NavLink to="/med-dashboard" icon={Monitor} label={t('handoverDesk')} />
              <NavLink to="/chat" icon={MessageSquare} label={t('chatDesk')} />
              
              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <p className="px-4 text-[9px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-2">{t('tools')}</p>
                <NavLink to="/import" icon={FileDown} label={t('dataImport')} />
                <NavLink to="/settings" icon={Settings} label={t('settings')} />
              </div>
            </div>
            
            {/* Switch user button at bottom */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button 
                onClick={() => { setMobileMenuOpen(false); logout(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <LogOut size={20} />
                <span className="text-sm">{t('switchUser')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        {isLoggedIn && <TopBar onSync={handleSync} syncing={syncing} onToggleMenu={() => setMobileMenuOpen(true)} />}
        
        <main className={`flex-1 min-h-0 relative ${location.pathname === '/chat' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
          <div className={`mx-auto pb-20 md:pb-0 ${location.pathname === '/chat' ? 'p-0 w-full h-full max-w-none flex-grow flex flex-col' : 'max-w-7xl p-4 md:p-6 lg:p-8'}`}>
            <Routes>
              <Route path="/login" element={!isLoggedIn ? <Login /> : <Navigate to="/" replace />} />
              
              {isLoggedIn && (
                <>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/attendance" element={<Attendance />} />
                  <Route path="/patients" element={<PatientsList />} />
                  <Route path="/patients/new" element={<NewPatient />} />
                  <Route path="/patients/:id" element={<PatientProfile />} />
                  <Route path="/medicines" element={<Medicines />} />
                  <Route path="/import" element={<ImportPatients />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/med-queue" element={<MedicineQueue />} />
                  <Route path="/med-dashboard" element={<MedicineDashboard />} />
                  <Route path="/profile/:userId" element={<UserProfile />} />
                  <Route path="/chat" element={<Chat />} />
                </>
              )}
              
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
        
        {isLoggedIn && <MobileBottomNav />}
      </div>
    </div>
  );
}

function NavLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold ${
        isActive 
          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
          : 'text-slate-500 hover:bg-slate-100/50 hover:text-slate-800'
      }`}
    >
      <Icon size={20} className={isActive ? 'text-emerald-100' : 'text-slate-400'} />
      <span className="text-sm">{label}</span>
    </Link>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppLayout />
      </Router>
    </AuthProvider>
  );
}

export default App;
