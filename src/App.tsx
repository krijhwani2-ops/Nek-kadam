import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { getBaseUrl } from './lib/session';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { io } from 'socket.io-client';
import { 
  Users, Settings, LogOut,
  Database, RefreshCw, Wifi, WifiOff,
  UserPlus, HeartPulse, FileDown,
  LayoutDashboard, ChevronLeft, ListChecks,
  ClipboardList, Monitor, Menu, X, MessageSquare,
  Smartphone, QrCode, Download, ScanFace, Ticket, Sparkles
} from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useApp } from './contexts/AppContext';
import { QRCodeSVG } from 'qrcode.react';
import BarcodeScannerModal from './components/BarcodeScannerModal';
import FaceScannerModal from './components/face/FaceScannerModal';

// Pages
import Dashboard from './pages/Dashboard';
import PatientsList from './pages/PatientsList';
import PatientProfile from './pages/PatientProfile';
import FaceRecognitionDemo from './pages/FaceRecognitionDemo';
import NewPatient from './pages/NewPatient';
import Medicines from './pages/Medicines';
import ImportPatients from './pages/ImportPatients';
import Login from './pages/Login';
import SplashScreen from './components/SplashScreen';
import SettingsPage from './pages/Settings';
import Attendance from './pages/Attendance';
import TokenQueue from './pages/TokenQueue';
import MedicineQueue from './pages/MedicineQueue';
import MedicineDashboard from './pages/MedicineDashboard';
import UserProfile from './pages/UserProfile';
import Chat from './pages/Chat';
import ApkDemoApp from './demo/ApkDemoApp';

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
        // If mobile drawer, scanner, or modal is open, dismiss it first
        const modalCloseBtn = document.querySelector(
          '[role="dialog"] button[aria-label*="close" i], button[aria-label="Close menu"], button[aria-label="Close modal"], button[aria-label="Close"]'
        ) as HTMLButtonElement | null;
        if (modalCloseBtn && modalCloseBtn.offsetParent !== null) {
          modalCloseBtn.click();
          return;
        }

        const openModal = document.querySelector('.fixed.inset-0.z-50') as HTMLElement | null;
        if (openModal) {
          const dismissBtn = openModal.querySelector('button') as HTMLButtonElement | null;
          if (dismissBtn) {
            dismissBtn.click();
            return;
          }
        }

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

const APP_VERSION = "1.5.0"; // Current release version

interface UpdateInfo {
  version: string;
  bundleUrl?: string;
  bundleId?: string;
  apkUrl?: string;
}

function OTAUpdater() {
  const [updatingVersion, setUpdatingVersion] = useState<string | null>(null);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const checkAndApplyUpdateSilently = async () => {
      // Guard against concurrent downloads/updates
      if (isUpdatingRef.current) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${getBaseUrl()}/api/version`, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return;
        const data: UpdateInfo = await res.json();
        if (!isMounted || !data?.version) return;

        if (data.version !== APP_VERSION) {
          isUpdatingRef.current = true;
          console.log(`[SILENT OTA] Internet connected. New version detected (v${data.version} vs current v${APP_VERSION}). Downloading silently without asking...`);
          setUpdatingVersion(data.version);

          if (Capacitor.isNativePlatform()) {
            try {
              const { LiveUpdate } = await import('@capawesome/capacitor-live-update');
              const bundleId = (data.bundleId || data.version || '').replace(/[^a-zA-Z0-9._-]/g, '_');

              // Check if bundle already downloaded on device
              const downloaded = await LiveUpdate.getDownloadedBundles().catch(() => ({ bundleIds: [] }));
              if (downloaded.bundleIds && downloaded.bundleIds.includes(bundleId)) {
                console.log('[SILENT OTA] Bundle already on disk, applying immediately:', bundleId);
                await LiveUpdate.setNextBundle({ bundleId }).catch(() => {});
                setTimeout(async () => {
                  try {
                    await LiveUpdate.reload();
                  } catch (_e) {
                    window.location.reload();
                  }
                }, 300);
                return;
              }

              // Download new bundle in background with zero prompts or confirmation needed
              const rawBundleUrl = data.bundleUrl || '/bundle.zip';
              const bundleUrl = rawBundleUrl.startsWith('http://') || rawBundleUrl.startsWith('https://')
                ? rawBundleUrl
                : `${getBaseUrl()}${rawBundleUrl.startsWith('/') ? '' : '/'}${rawBundleUrl}`;

              await LiveUpdate.downloadBundle({
                url: bundleUrl,
                bundleId: bundleId,
                artifactType: 'zip'
              });

              // Set as active bundle and reload silently
              await LiveUpdate.setNextBundle({ bundleId });
              console.log('[SILENT OTA] Update downloaded and primed. Reloading app silently into v' + data.version);

              setTimeout(async () => {
                try {
                  await LiveUpdate.reload();
                } catch (_e) {
                  window.location.reload();
                }
              }, 400);
            } catch (err: any) {
              const msg = err?.message || String(err);
              if (msg.includes('already exists') || msg.includes('BUNDLE_EXISTS')) {
                const bundleId = (data.bundleId || data.version || '').replace(/[^a-zA-Z0-9._-]/g, '_');
                try {
                  const { LiveUpdate } = await import('@capawesome/capacitor-live-update');
                  await LiveUpdate.setNextBundle({ bundleId });
                  await LiveUpdate.reload();
                } catch (_e) {
                  window.location.reload();
                }
              } else {
                console.warn('[SILENT OTA] Download attempt notice:', msg);
                isUpdatingRef.current = false;
                if (isMounted) setUpdatingVersion(null);
              }
            }
          } else {
            // Web browser: silently reload into the new assets
            console.log('[SILENT OTA] Web version updated, refreshing silently...');
            setTimeout(() => {
              window.location.reload();
            }, 600);
          }
        }
      } catch (_e) {
        isUpdatingRef.current = false;
        if (isMounted) setUpdatingVersion(null);
      }
    };

    // 1. Check immediately on mount
    checkAndApplyUpdateSilently();

    // 2. As soon as phone connects to internet ("jese internet s phone connect ho")
    const handleOnline = () => {
      console.log('[SILENT OTA] Phone connected to internet! Checking for silent update immediately...');
      checkAndApplyUpdateSilently();
    };
    window.addEventListener('online', handleOnline);

    // 3. Periodic background check every 30 seconds
    const interval = setInterval(checkAndApplyUpdateSilently, 30 * 1000);

    // 4. Check whenever app comes to foreground
    let appStateListener: any = null;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          checkAndApplyUpdateSilently();
        }
      }).then(h => { appStateListener = h; }).catch(() => {});
    }

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
      if (appStateListener) appStateListener.remove();
    };
  }, []);

  if (!updatingVersion) return null;

  // Discreet, non-blocking silent indicator (never asks the owner)
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] px-4 py-1.5 bg-slate-900/90 text-white rounded-full text-xs font-semibold flex items-center gap-2 shadow-2xl border border-emerald-500/40 pointer-events-none backdrop-blur-md animate-in fade-in slide-in-from-top-2">
      <Sparkles size={14} className="text-emerald-400 animate-spin" />
      <span>Updating silently to v{updatingVersion}...</span>
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
        
        const { getBaseUrl, isPrivateNetwork } = await import('./lib/session');
        const isCloudHost = typeof window !== 'undefined' && window.location.hostname && !isPrivateNetwork(window.location.hostname);
        if (isCloudHost) {
          setMobileUrl(window.location.origin);
        } else {
          const ip = getServerIp() || '192.168.29.180';
          setMobileUrl(`http://${ip}:5173`);
        }
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
        <NavLink to="/tokens" icon={Ticket} label="Token Queue" />
        <NavLink to="/patients" icon={Users} label={t('patients')} />
        <NavLink to="/patients/new" icon={UserPlus} label={t('registerPatient')} />
        <NavLink to="/medicines" icon={Database} label={t('medicinesDb')} />
        <NavLink to="/med-queue" icon={ClipboardList} label={t('pharmacyQueue')} />
        <NavLink to="/med-dashboard" icon={Monitor} label={t('handoverDesk')} />
        <NavLink to="/chat" icon={MessageSquare} label={t('chatDesk')} />
      </div>

      <div className="mt-8 space-y-1">
        <p className="px-4 text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">{t('tools')}</p>
        <NavLink to="/face-id" icon={ScanFace} label="Face ID System" />
        <NavLink to="/import" icon={FileDown} label={t('dataImport')} />
        <NavLink to="/settings" icon={Settings} label={t('settings')} />
        <NavLink to="/demo" icon={Smartphone} label="APK Modern Demo" />
        <a 
          href={`${getBaseUrl()}/apk/nek-kadam.apk`}
          download={`nek-kadam-v${APP_VERSION}.apk`}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all shadow-sm group"
          title="Direct Download Latest Android APK"
        >
          <Download size={18} className="text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
          <span className="truncate">Download APK</span>
          <span className="ml-auto text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-600 text-white shrink-0">v{APP_VERSION}</span>
        </a>
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

function TopBar({ onSync, syncing, onToggleMenu, onOpenScanner, onOpenFaceScanner }: { onSync: () => void, syncing: boolean, onToggleMenu: () => void, onOpenScanner: () => void, onOpenFaceScanner?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '/dashboard';
  const { t } = useApp();
  const { session, logout } = useAuth();
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchPresence = async () => {
      try {
        const { getBaseUrl } = await import('./lib/session');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`${getBaseUrl()}/api/presence`, { signal: controller.signal });
        clearTimeout(timeoutId);
        const json = await res.json();
        if (isMounted && json.data) {
           setOnlineCount(json.data.filter((u: any) => u.isOnline).length);
        }
      } catch { /* silent when backend unreachable */ }
    };
    fetchPresence();
    const interval = setInterval(fetchPresence, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] flex items-center justify-between px-3 bg-emerald-700 text-white shadow-sm shrink-0 min-w-0 z-30">
      <div className="flex items-center gap-2 min-w-0">
        {session && (
          <button 
            onClick={onToggleMenu}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 shrink-0 transition-all text-white"
            aria-label="Toggle Menu"
          >
            <Menu size={20} />
          </button>
        )}
        {!isHome && (
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 shrink-0 transition-all text-white"
            aria-label="Go Back"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-base sm:text-lg font-black tracking-tight shrink-0 text-white">Nek Kadam</h1>
          <span 
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/20 text-emerald-100 border border-white/15 shrink-0"
            title={onlineCount > 0 ? "Connected to Render Cloud" : "Local Storage Mode Active"}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${onlineCount > 0 ? 'bg-emerald-300 animate-pulse' : 'bg-amber-300'}`}></span>
            <span>{onlineCount > 0 ? 'Online' : 'Local'}</span>
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 shrink-0">
        {session && (
          <button 
            onClick={logout} 
            className="hidden sm:flex h-9 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl items-center justify-center gap-1.5 font-bold text-xs active:scale-95 border border-white/15 shrink-0 transition-all"
            title="Switch User"
          >
            <LogOut size={15} />
            <span>{t('switchUser')}</span>
          </button>
        )}
        {onOpenFaceScanner && (
          <button 
            onClick={onOpenFaceScanner} 
            className="hidden md:flex h-9 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl items-center justify-center gap-1.5 font-bold text-xs active:scale-95 border border-white/15 shrink-0 transition-all"
            title="Scan Patient Face (Offline AI Recognition)"
          >
             <ScanFace size={16} className="text-emerald-200" />
             <span>Face ID</span>
          </button>
        )}
        <button 
          onClick={onOpenScanner} 
          className="w-10 h-10 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl flex items-center justify-center border border-white/20 shrink-0 transition-all"
          title="Scan OPD Card QR / Barcode"
          aria-label="Scan OPD Card"
        >
           <QrCode size={19} className="text-emerald-100" />
        </button>
        <button 
          onClick={onSync} 
          disabled={syncing}
          className="w-10 h-10 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl flex items-center justify-center border border-white/20 shrink-0 transition-all disabled:opacity-50"
          title="Sync Records"
          aria-label="Sync Records"
        >
           <RefreshCw size={17} className={`text-emerald-100 ${syncing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  const location = useLocation();
  const { t } = useApp();
  
  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const isActive = to === '/'
      ? location.pathname === '/' || location.pathname === '/dashboard'
      : to === '/patients'
      ? location.pathname === '/patients'
      : location.pathname.startsWith(to);

    return (
      <Link 
        to={to} 
        className={`flex flex-col items-center justify-center w-full min-h-[44px] py-1 transition-colors ${
          isActive 
            ? 'text-emerald-600 dark:text-emerald-400 font-bold' 
            : 'text-slate-500 dark:text-slate-400 font-medium'
        }`}
      >
        <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-emerald-50 dark:bg-emerald-950/40 scale-105' : ''}`}>
          <Icon size={20} />
        </div>
        <span className="text-[10px] tracking-tight">{label}</span>
      </Link>
    );
  };

  return (
    <div className="md:hidden flex items-center justify-around bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] z-30">
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
  const syncingRef = useRef(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isGlobalScannerOpen, setIsGlobalScannerOpen] = useState(false);
  const [isFaceScannerOpen, setIsFaceScannerOpen] = useState(false);
  const location = useLocation();

  // Mark LiveUpdate bundle ready on native app startup to prevent rollback
  useEffect(() => {
    const notifyLiveUpdateReady = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const { LiveUpdate } = await import('@capawesome/capacitor-live-update');
          const res = await LiveUpdate.ready();
          console.log('[LIVE UPDATE] AppContent ready():', res);
        }
      } catch (e) {
        console.warn('[LIVE UPDATE] ready() ignored:', e);
      }
    };
    notifyLiveUpdateReady();
  }, []);

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
      } else if (path === '/face-id') {
        screenName = 'Face ID Desk';
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
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        console.log('[LIVE SYNC] Initial sync on app load...');
        setSyncing(true);
        await fullDataSync();
        window.dispatchEvent(new Event('nk_live_sync_completed'));
      } catch (e) {
        console.error('[LIVE SYNC] Initial sync failed:', e);
      } finally {
        setSyncing(false);
        syncingRef.current = false;
      }
    });

    import('./lib/db').then(({ fullDataSync }) => {
      const base = getBaseUrl();
      const socketUrl = base || (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.startsWith('capacitor:') ? window.location.origin : 'https://nek-kadam.onrender.com');
      socket = io(socketUrl, { reconnection: true, transports: ['websocket', 'polling'] });
      
      socket.on('connect', () => {
        if (syncingRef.current) return;
        syncingRef.current = true;
        console.log('[LIVE SYNC] Connected to server socket. Catching up...');
        setSyncing(true);
        fullDataSync().then(() => {
          window.dispatchEvent(new Event('nk_live_sync_completed'));
        }).catch(err => console.error('[LIVE SYNC] Catchup failed:', err))
          .finally(() => {
            setSyncing(false);
            syncingRef.current = false;
          });
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

  if (location.pathname.startsWith('/demo')) {
    return <ApkDemoApp />;
  }

  // Protect routes
  if (!isLoggedIn && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
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
          <div className="relative flex-grow flex flex-col max-w-xs w-full bg-white dark:bg-slate-900 p-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Close button */}
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 rounded-xl active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
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
              <NavLink to="/tokens" icon={Ticket} label="Token Queue" />
              <NavLink to="/patients" icon={Users} label={t('patients')} />
              <NavLink to="/patients/new" icon={UserPlus} label={t('registerPatient')} />
              <NavLink to="/medicines" icon={Database} label={t('medicinesDb')} />
              <NavLink to="/med-queue" icon={ClipboardList} label={t('pharmacyQueue')} />
              <NavLink to="/med-dashboard" icon={Monitor} label={t('handoverDesk')} />
              <NavLink to="/chat" icon={MessageSquare} label={t('chatDesk')} />
              
              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <p className="px-4 text-[9px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-2">{t('tools')}</p>
                <NavLink to="/face-id" icon={ScanFace} label="Face ID System" />
                <NavLink to="/import" icon={FileDown} label={t('dataImport')} />
                <NavLink to="/settings" icon={Settings} label={t('settings')} />
                <NavLink to="/demo" icon={Smartphone} label="APK Modern Demo" />
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
        {isLoggedIn && (
          <TopBar 
            onSync={handleSync} 
            syncing={syncing} 
            onToggleMenu={() => setMobileMenuOpen(true)} 
            onOpenScanner={() => setIsGlobalScannerOpen(true)}
            onOpenFaceScanner={() => setIsFaceScannerOpen(true)}
          />
        )}
        
        <main className={`flex-1 min-h-0 relative ${location.pathname === '/chat' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto overscroll-contain'}`} style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className={`mx-auto pb-28 md:pb-8 ${location.pathname === '/chat' ? 'p-0 w-full h-full max-w-none flex-grow flex flex-col' : 'max-w-7xl px-2 py-2 sm:px-4 sm:py-4 md:p-6 lg:p-8'}`}>
            <Routes>
              <Route path="/login" element={!isLoggedIn ? <Login /> : <Navigate to="/" replace />} />
              
              {isLoggedIn && (
                <>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/attendance" element={<Attendance />} />
                  <Route path="/tokens" element={<TokenQueue />} />
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
                  <Route path="/face-id" element={<FaceRecognitionDemo />} />
                </>
              )}
              
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
        
        {isLoggedIn && <MobileBottomNav />}
      </div>

      {/* Universal 1-Tap Barcode & QR Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isGlobalScannerOpen}
        onClose={() => setIsGlobalScannerOpen(false)}
      />

      {/* Offline AI Patient Face Recognition Scanner Modal */}
      <FaceScannerModal
        isOpen={isFaceScannerOpen}
        onClose={() => setIsFaceScannerOpen(false)}
      />
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
