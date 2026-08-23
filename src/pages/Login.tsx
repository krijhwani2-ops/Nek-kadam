import { useState, useEffect } from 'react';
import { HeartPulse, ChevronRight, UserPlus, Server } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getBaseUrl, getServerIp, setServerIp } from '../lib/session';
import { QRCodeSVG } from 'qrcode.react';

interface DBUser {
  id: string;
  name: string;
  department: string;
  role?: string;
  hasPasscode?: number;
}

const DEPARTMENTS = [
  'Reception',
  'Medical',
  'Medicine',
  'Education',
  'Service',
  'Computer Classes',
  'Summer Camp',
  'Other'
];

export default function Login() {
  const { login } = useAuth();
  const [users, setUsers] = useState<DBUser[]>([]);
  
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Medical');
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [showExisting, setShowExisting] = useState(false);
  
  const [showConfig, setShowConfig] = useState(false);
  const [localIp, setLocalIp] = useState(getServerIp());
  const [isServerOffline, setIsServerOffline] = useState(false);



  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRes = await fetch(`${getBaseUrl()}/api/users`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}` }
        });
        const usersJson = await usersRes.json();
        setUsers(usersJson.data || []);
        setIsServerOffline(false);
      } catch (e: any) {
        console.error('[LOAD ERROR]', e);
        setIsServerOffline(true);
      } finally {
        setFetching(false);
      }
    };
    fetchUsers();
  }, []);

  const handleContinue = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }



    setLoading(true);
    setError('');

    if (isServerOffline) {
      login({
        id: 'offline-' + Math.random().toString(36).substring(2, 11),
        name: name.trim(),
        department: department,
        role: 'Volunteer'
      });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${getBaseUrl()}/api/users/create-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}`
        },
        body: JSON.stringify({
          name: name.trim(),
          department: department,
          role: 'Volunteer',
          deviceId: 'local-device'
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to identify user');
      }

      console.log('[USER IDENTIFIED]:', result.user);
      login(result.user, result.token);
    } catch (err: any) {
      setError(err.message || 'Server error. Profile identification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExisting = async (u: DBUser) => {


    setLoading(true);
    setError('');
    
    if (isServerOffline) {
      login(u);
      setLoading(false);
      return;
    }
    
    try {
      const res = await fetch(`${getBaseUrl()}/api/users/create-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: u.name,
          department: u.department,
          role: u.role || 'Volunteer',
          deviceId: 'local-device'
        })
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to authenticate user profile');
      }
      login(result.user, result.token);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize session for existing profile.');
    } finally {
      setLoading(false);
    }
  };



  const handleSaveIp = () => {
    setServerIp(localIp);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="flex flex-col lg:flex-row gap-6 max-w-4xl w-full items-stretch justify-center relative z-10">
        <div className="flex-1 max-w-md bg-slate-950/80 backdrop-blur-md rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden relative p-8 md:p-10 space-y-8 animate-in fade-in duration-300">
          
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="absolute top-6 right-6 text-slate-500 hover:text-emerald-400 transition-colors"
            title="Server Configuration"
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

          {isServerOffline && (
            <div className="bg-amber-500/10 text-amber-400 p-4 rounded-2xl text-xs font-bold text-center border border-amber-500/20 animate-pulse">
              ⚠️ Offline Mode Active (Enter details manually)
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
          ) : fetching && users.length === 0 ? (
             <div className="flex justify-center py-4"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>
          ) : (
            <div className="space-y-6">
              
              {!showExisting ? (
                <form onSubmit={handleContinue} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Your Name</label>
                      {isServerOffline ? (
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Rohan"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          className="w-full px-5 py-4 bg-slate-900 border-2 border-slate-800 rounded-2xl outline-none font-bold text-white shadow-sm transition-all focus:border-emerald-500"
                        />
                      ) : (
                        <select 
                          required
                          value={name}
                          onChange={e => {
                            const val = e.target.value;
                            setName(val);
                            const user = users.find(u => u.name === val);
                            if (user && user.department) setDepartment(user.department);
                          }}
                          className="w-full px-5 py-4 bg-slate-900 border-2 border-slate-800 rounded-2xl outline-none font-bold text-white shadow-sm transition-all focus:border-emerald-500 appearance-none cursor-pointer"
                        >
                          <option value="" disabled>Select your name...</option>
                          {users.map(u => (
                            <option key={u.id} value={u.name}>{u.name} ({u.department})</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Department</label>
                      <select 
                        value={department}
                        onChange={e => setDepartment(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-900 border-2 border-slate-800 rounded-2xl outline-none font-bold text-white cursor-pointer transition-all focus:border-emerald-500 appearance-none"
                      >
                        {DEPARTMENTS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-2 text-sm uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-emerald-950/40"
                  >
                    {loading ? 'Connecting...' : 'Continue'} <ChevronRight size={18} />
                  </button>

                  {users.length > 0 && (
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
                    {users.slice(0, 10).map(u => (
                      <button
                        key={u.id}
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
  );
}
