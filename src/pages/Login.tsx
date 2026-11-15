import { useState, useEffect } from 'react';
import { HeartPulse, ChevronRight, UserPlus, Server, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getBaseUrl, getServerIp, setServerIp, DBUser, STANDARD_FALLBACK_USERS, getCachedUsers, setCachedUsers, fetchLoginUsers } from '../lib/session';
import { QRCodeSVG } from 'qrcode.react';

const DEPARTMENTS = [
  'Reception',
  'Medical',
  'Medicine',
  'Education',
  'Service',
  'Computer Classes',
  'Summer Camp',
  'Campaign',
  'Other'
];

export default function Login() {
  const { login } = useAuth();
  const [users, setUsers] = useState<DBUser[]>(() => getCachedUsers());
  const displayUsers = users && users.length > 0 ? users : STANDARD_FALLBACK_USERS;
  
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Medical');
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [showExisting, setShowExisting] = useState(false);
  const [manualNameMode, setManualNameMode] = useState(false);
  
  const [showConfig, setShowConfig] = useState(false);
  const [localIp, setLocalIp] = useState(getServerIp());
  const [isServerOffline, setIsServerOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchUsers = async () => {
      // If browser is definitely offline, immediately switch to offline mode without waiting
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (isMounted) {
          setIsServerOffline(true);
          setIsCheckingConnection(false);
          setFetching(false);
        }
        return;
      }

      // 1. Immediately read from local user cache
      try {
        const cached = getCachedUsers();
        if (isMounted && cached && cached.length > 0) {
          setUsers(cached);
        }
      } catch (e) {
        console.warn('[LOGIN] Local user cache note:', e);
      }

      // 2. Fetch live users from server with timeout
      try {
        const { users: liveUsers, isOffline } = await fetchLoginUsers(2500);
        if (isMounted) {
          if (liveUsers && liveUsers.length > 0) {
            setUsers(liveUsers);
          }
          setIsServerOffline(isOffline);
        }
      } catch (e: any) {
        console.warn('[LOGIN FETCH NOTICE]', e?.message || e);
        if (isMounted) {
          setIsServerOffline(true);
        }
      } finally {
        if (isMounted) {
          setIsCheckingConnection(false);
          setFetching(false);
        }
      }
    };
    fetchUsers();
    return () => { isMounted = false; };
  }, []);

  const saveToLocalCache = (userToCache: DBUser) => {
    try {
      const current = getCachedUsers();
      const seen = new Set<string>();
      const updated: DBUser[] = [userToCache];
      seen.add(userToCache.name.trim().toLowerCase());
      for (const u of current) {
        const k = (u.name || '').trim().toLowerCase();
        if (k && !seen.has(k)) {
          seen.add(k);
          updated.push(u);
        }
      }
      setCachedUsers(updated);
    } catch (_) {}
  };

  const handleContinue = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);
    setError('');

    const matchingUser = displayUsers.find(u => u.name.trim().toLowerCase() === name.trim().toLowerCase());
    const isNamedAdmin = ['admin', 'rohan', 'dr. vibhuti kori', 'dr. rajdeep sonkar'].includes(name.trim().toLowerCase()) || matchingUser?.role?.toUpperCase() === 'ADMIN';
    const roleToSend = isNamedAdmin ? 'ADMIN' : (matchingUser?.role || 'Volunteer');

    if (isServerOffline) {
      const offlineUser: DBUser = {
        id: matchingUser?.id || ('offline-' + Math.random().toString(36).substring(2, 11)),
        name: name.trim(),
        department: department,
        role: roleToSend
      };
      saveToLocalCache(offlineUser);
      login(offlineUser);
      setLoading(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${getBaseUrl()}/api/users/create-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}`
        },
        body: JSON.stringify({
          name: name.trim(),
          department: department,
          role: roleToSend,
          deviceId: 'local-device'
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to identify user');
      }

      saveToLocalCache(result.user);
      login(result.user, result.token);
    } catch (err: any) {
      console.warn('[LOGIN NETWORK FALLBACK]', err);
      // Seamless offline fallback so staff can always work
      const fallbackUser: DBUser = {
        id: matchingUser?.id || ('local-' + Math.random().toString(36).substring(2, 11)),
        name: name.trim(),
        department: department,
        role: roleToSend
      };
      saveToLocalCache(fallbackUser);
      login(fallbackUser);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExisting = async (u: DBUser) => {
    setLoading(true);
    setError('');
    
    const isNamedAdmin = ['admin', 'rohan', 'dr. vibhuti kori', 'dr. rajdeep sonkar'].includes((u.name || '').trim().toLowerCase()) || (u.role || '').toUpperCase() === 'ADMIN';
    const existingRole = isNamedAdmin ? 'ADMIN' : (u.role || 'Volunteer');
    const userToLogin = { ...u, role: existingRole };
    saveToLocalCache(userToLogin);

    if (isServerOffline) {
      login(userToLogin);
      setLoading(false);
      return;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${getBaseUrl()}/api/users/create-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: u.name,
          department: u.department,
          role: existingRole,
          deviceId: 'local-device'
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to authenticate user profile');
      }
      saveToLocalCache(result.user);
      login(result.user, result.token);
    } catch (err: any) {
      console.warn('[LOGIN SELECT EXISTING FALLBACK]', err);
      login(userToLogin);
    } finally {
      setLoading(false);
    }
  };



  const handleSaveIp = () => {
    setServerIp(localIp);
    window.location.reload();
  };

  return (
    <div className="min-h-[100dvh] bg-slate-900 flex items-center justify-center p-3 sm:p-4 py-6 sm:py-8 relative overflow-y-auto pt-safe pb-safe">
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="flex flex-col gap-3 max-w-4xl w-full items-center justify-center relative z-10 my-auto">
        {/* Top Demo Quick-Launch Banner */}
        <div className="w-full max-w-md">
          <a
            href="/demo"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white shadow-xl border border-sky-400/40 transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🚀</span>
              <div className="text-left">
                <div className="text-xs font-black tracking-wide flex items-center gap-1.5">
                  APK UI/UX LABS (3 VARIANTS)
                  <span className="px-1.5 py-0.5 bg-white/20 rounded text-[9px] font-bold">DEMO</span>
                </div>
                <div className="text-[11px] text-sky-100">Tap here to test 🍏 Nordic, ⚡ Obsidian & 🎨 Pebble</div>
              </div>
            </div>
            <ChevronRight size={18} className="text-white/70 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 w-full items-stretch justify-center">
          <div className="flex-1 max-w-md bg-slate-950/80 backdrop-blur-md rounded-3xl sm:rounded-[2.5rem] shadow-2xl border border-slate-800 relative p-5 sm:p-8 md:p-10 space-y-5 sm:space-y-8 animate-in fade-in duration-300">
          
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-emerald-400 rounded-xl transition-colors"
            title="Server Configuration"
            aria-label="Server Configuration"
          >
            <Server size={20} />
          </button>

          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-600/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-inner shadow-emerald-500/20">
              <HeartPulse className="text-emerald-400 w-10 h-10 animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Who is using this device?</h1>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">Operational Identity Tracking</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 text-red-400 p-4 rounded-2xl text-xs font-black text-center border border-red-500/20 animate-shake">
              {error}
            </div>
          )}

          {isServerOffline ? (
            <div className="bg-amber-500/10 text-amber-300 p-3.5 rounded-2xl text-xs font-bold text-center border border-amber-500/20 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              ⚡ Standalone / Offline Mode Active — Instant Fallback Login Ready
            </div>
          ) : isCheckingConnection ? (
            <div className="bg-sky-500/10 text-sky-300 p-3 rounded-2xl text-xs font-bold text-center border border-sky-500/20 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
              🔄 Connecting to Server — Instant Fallback Ready
            </div>
          ) : (
            <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-2xl text-xs font-bold text-center border border-emerald-500/20 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              🟢 Server Online — Cloud Sync Connected
            </div>
          )}

          {showConfig ? (
            <div className="space-y-6">
               <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Server IP Address</label>
                  <input 
                    type="text" 
                    value={localIp}
                    onChange={e => setLocalIp(e.target.value)}
                    placeholder="e.g. 192.168.1.100"
                    className="w-full px-5 py-4 bg-slate-900 border-2 border-slate-800 rounded-2xl outline-none font-bold text-white shadow-sm transition-all focus:border-emerald-500"
                  />
                </div>
                <button
                  onClick={handleSaveIp}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-2 text-sm uppercase tracking-wider transition-all shadow-lg"
                >
                  Save & Restart
                </button>
            </div>
          ) : (
            <div className="space-y-6">
              
              {!showExisting ? (
                <form onSubmit={handleContinue} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Your Name</label>
                        <button
                          type="button"
                          onClick={() => setManualNameMode(!manualNameMode)}
                          className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                        >
                          {manualNameMode ? "← Select from staff list" : "+ Type custom name"}
                        </button>
                      </div>
                      {manualNameMode ? (
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Dr. Rohan / Volunteer"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          className="w-full px-5 py-4 bg-slate-900 border-2 border-slate-800 rounded-2xl outline-none font-bold text-white shadow-sm transition-all focus:border-emerald-500"
                        />
                      ) : (
                        <div className="relative">
                          <select 
                            required
                            value={name}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '__custom__') {
                                setManualNameMode(true);
                                setName('');
                                return;
                              }
                              setName(val);
                              const user = displayUsers.find(u => u.name === val);
                              if (user && user.department) setDepartment(user.department);
                            }}
                            className="w-full px-5 py-4 pr-12 bg-slate-900 border-2 border-slate-800 rounded-2xl outline-none font-bold text-white shadow-sm transition-all focus:border-emerald-500 appearance-none cursor-pointer"
                          >
                            <option value="" disabled className="bg-slate-900 text-slate-400" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>Select your name...</option>
                            {displayUsers.map(u => (
                              <option key={u.id || u.name} value={u.name} className="bg-slate-900 text-slate-100 py-2.5" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                                {u.name}{u.department ? ` (${u.department})` : ''}
                              </option>
                            ))}
                            <option value="__custom__" className="bg-slate-900 text-emerald-400 font-bold" style={{ backgroundColor: '#0f172a', color: '#34d399' }}>+ Enter custom name / Type name...</option>
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <ChevronDown size={20} />
                          </div>
                        </div>
                      )}
                    </div>

                    {!manualNameMode && displayUsers.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">
                          Quick 1-Tap Select
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {displayUsers.slice(0, 6).map(u => (
                            <button
                              key={'chip-' + (u.id || u.name)}
                              type="button"
                              onClick={() => {
                                setName(u.name);
                                if (u.department) setDepartment(u.department);
                              }}
                              className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all text-xs font-bold ${
                                name === u.name
                                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md ring-1 ring-emerald-500/50'
                                  : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                              }`}
                            >
                              <span className="w-6 h-6 rounded-lg bg-slate-800 text-emerald-400 font-black text-[11px] flex items-center justify-center shrink-0">
                                {u.name.charAt(0)}
                              </span>
                              <span className="truncate">{u.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Department</label>
                      <div className="relative">
                        <select 
                          value={department}
                          onChange={e => setDepartment(e.target.value)}
                          className="w-full px-5 py-4 pr-12 bg-slate-900 border-2 border-slate-800 rounded-2xl outline-none font-bold text-white cursor-pointer transition-all focus:border-emerald-500 appearance-none"
                        >
                          {DEPARTMENTS.map(d => (
                            <option key={d} value={d} className="bg-slate-900 text-slate-100 py-2.5" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>{d}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={20} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-2 text-sm uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-emerald-950/40"
                  >
                    {loading ? 'Connecting...' : 'Continue'} <ChevronRight size={18} />
                  </button>

                  {displayUsers.length > 0 && (
                    <button 
                      type="button"
                      onClick={() => setShowExisting(true)}
                      className="w-full text-center text-xs font-black text-slate-400 hover:text-white uppercase tracking-widest transition-colors py-2"
                    >
                      Or select a recent user
                    </button>
                  )}
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                    <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Recent Users</h2>
                    <button 
                      onClick={() => setShowExisting(false)} 
                      className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-black uppercase tracking-wider transition-colors"
                    >
                      <UserPlus size={14} strokeWidth={3} /> New User
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-1">
                    {displayUsers.slice(0, 10).map(u => (
                      <button
                        key={'recent-' + (u.id || u.name)}
                        onClick={() => handleSelectExisting(u)}
                        className="p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all group relative bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm uppercase shrink-0 transition-all bg-slate-800 text-slate-400 group-hover:bg-slate-700">
                          {u.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-white truncate">{u.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate mt-0.5">{u.department || 'General'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Access QR Code Panel */}
        <div className="hidden lg:flex w-80 bg-slate-950/80 backdrop-blur-md rounded-[2.5rem] shadow-2xl border border-slate-800 p-8 flex-col justify-center items-center text-center space-y-6 animate-in fade-in duration-300">
           <div className="w-12 h-12 bg-emerald-600/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-xl">
             📱
           </div>
           <div>
             <h2 className="text-xl font-black text-white">Mobile Access</h2>
             <p className="text-slate-400 text-xs mt-1">Scan this QR Code with your phone to connect to the clinic system.</p>
           </div>
           <div className="p-4 bg-white rounded-3xl shadow-lg shadow-emerald-950/20 border border-slate-200">
             <QRCodeSVG value={typeof window !== 'undefined' && window.location.hostname && !['localhost', '127.0.0.1'].includes(window.location.hostname) && !window.location.hostname.startsWith('192.168.') && !window.location.hostname.startsWith('10.') ? window.location.origin : `http://${localIp}:5173`} size={160} level="H" includeMargin={true} />
           </div>
           <div className="space-y-1">
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Access Link</p>
             <p className="text-xs font-mono font-bold text-emerald-400 select-all">{typeof window !== 'undefined' && window.location.hostname && !['localhost', '127.0.0.1'].includes(window.location.hostname) && !window.location.hostname.startsWith('192.168.') && !window.location.hostname.startsWith('10.') ? window.location.origin : `http://${localIp}:5173`}</p>
           </div>
        </div>
      </div>
    </div>
  </div>
);
}
