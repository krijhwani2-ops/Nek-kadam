import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, Save, Globe, PlusCircle, Key } from 'lucide-react';
import { fetchAdminUsers, updateAdminUser, createAdminUser, fetchDepartments } from '../lib/session';
import { getServerIp, setServerIp } from '../lib/db';
import { QRCodeSVG } from 'qrcode.react';

import { useApp } from '../contexts/AppContext';

export default function Settings() {
  const { session } = useAuth();
  const { t, language, setLanguage, theme, toggleTheme } = useApp();
  const isAdmin = session?.role?.toLowerCase() === 'admin';
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [userData, deptData] = await Promise.all([
        fetchAdminUsers(),
        fetchDepartments()
      ]);
      setUsers(userData);
      setDepartments(deptData);

      if (deptData.length === 0) {
        console.warn("No departments found or fetch failed.");
      }
    } catch (e: unknown) {
      console.error("Load Settings Error:", e);
      const msg = e instanceof Error ? e.message : String(e);
      alert("Failed to load Admin data: " + msg);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void loadData();
    }
  }, [isAdmin, loadData]);

  const [serverIp, setServerIpValue] = useState(getServerIp());
  const [ipSaving, setIpSaving] = useState(false);

  async function handleIpSave() {
    setIpSaving(true);
    setServerIp(serverIp);
    setTimeout(() => {
      setIpSaving(false);
      alert("Server IP updated. App will reload to apply changes.");
      window.location.reload();
    }, 500);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">{t('settings')}</h2>
          <p className="text-slate-500 dark:text-slate-400">Configure application preferences and server connection.</p>
        </div>
      </div>

      {/* App Customizations (Language & Theme Mode) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Language Selection Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <Globe size={24} className="text-emerald-500" />
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">{t('languageSettings')}</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t('appLanguage')}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setLanguage('en')}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-sm border transition-all ${language === 'en' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}
            >
              English
            </button>
            <button
              onClick={() => setLanguage('hi')}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-sm border transition-all ${language === 'hi' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}
            >
              हिंदी (Hindi)
            </button>
          </div>
        </div>

        {/* Theme (Dark Mode) Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl text-emerald-500">🌓</div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">{t('themeSettings')}</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Appearance</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => theme === 'dark' && toggleTheme()}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-sm border transition-all flex items-center justify-center gap-2 ${theme === 'light' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}
            >
              ☀️ {t('lightMode')}
            </button>
            <button
              onClick={() => theme === 'light' && toggleTheme()}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-sm border transition-all flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}
            >
              🌙 {t('darkMode')}
            </button>
          </div>
        </div>
      </div>

      {isAdmin && (
        <>
          {/* Server Config */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-3">
              <Globe size={20} className="text-emerald-500" />
              <h3 className="font-bold text-slate-800 dark:text-slate-100">{t('serverConfig')}</h3>
            </div>
            <div className="p-6 flex flex-col md:flex-row gap-6 items-stretch">
              <div className="flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1">Backend Server IP (Windows Host)</label>
                  <input 
                    type="text" 
                    className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" 
                    value={serverIp} 
                    onChange={e => setServerIpValue(e.target.value)} 
                    placeholder="e.g. 192.168.29.51"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleIpSave} disabled={ipSaving} className="btn-primary px-8 flex-1">
                    {ipSaving ? 'Updating...' : 'Apply IP'}
                  </button>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mobile Access Link</p>
                  <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 select-all">http://{serverIp}:5173</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 min-w-[200px]">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Scan to Access from Mobile</p>
                <div className="p-2 bg-white rounded-2xl border border-slate-200">
                  <QRCodeSVG value={`http://${serverIp}:5173`} size={120} level="H" includeMargin={true} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Users size={22} className="text-emerald-500" />
                {t('userManagement')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Manage passcodes and department assignment.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-black shadow-sm hover:bg-emerald-700 transition-colors"
            >
              <PlusCircle size={18} />
              Add user
            </button>
          </div>

          {showAdd && (
            <UserForm departments={departments} onClose={() => { setShowAdd(false); void loadData(); }} />
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mb-8">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <div className="p-16 text-center text-slate-400 font-bold animate-pulse">Loading users…</div>
              ) : users.length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-sm font-bold">No users loaded. Sync from server or seed the database.</div>
              ) : (
                users.map((u: { id?: string }) => (
                  <UserRow key={u.id ?? String(u)} user={u} departments={departments} onUpdate={() => void loadData()} />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UserRow({ user, departments, onUpdate }: { user: any, departments: any[], onUpdate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    passcode: '', // Clear passcode for security/editing
    department: user.departmentId || '',
    role: user.role,
    is_active: user.isActive === 1
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const success = await updateAdminUser({ ...user, ...form });
    if (success) {
      setEditing(false);
      onUpdate();
    } else {
      alert("Failed to update user.");
    }
    setSaving(false);
  }

  if (editing) {
    return (
      <div className="p-4 bg-slate-50 flex items-center gap-4 flex-wrap">
        <div className="w-48">
          <span className="font-bold text-slate-800 block mb-1">{user.name}</span>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} />
            Active Account
          </label>
        </div>
        <div className="w-32">
          <label className="text-xs font-bold text-slate-400 block mb-1">Passcode</label>
          <input type="text" className="input-field py-2 px-3 text-sm" value={form.passcode} onChange={e => setForm({...form, passcode: e.target.value})} maxLength={6} />
        </div>
        <div className="w-40">
          <label className="text-xs font-bold text-slate-400 block mb-1">Department</label>
          <select className="input-field py-2 px-3 text-sm" value={form.department} onChange={e => setForm({...form, department: e.target.value})}>
            <option value="">Select Dept</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <label className="text-xs font-bold text-slate-400 block mb-1">Role</label>
          <select className="input-field py-2 px-3 text-sm" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
            <option value="volunteer">Volunteer</option>
            <option value="doctor">Doctor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0 md:ml-auto">
          <button onClick={() => setEditing(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg flex items-center gap-2">
            <Save size={16} /> Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 flex items-center justify-between hover:bg-slate-50 ${user.is_active ? '' : 'opacity-50'}`}>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
          {user.name.charAt(0)}
        </div>
        <div>
          <h4 className="font-bold text-slate-800">{user.name} {user.is_active === 0 && '(Inactive)'}</h4>
          <p className="text-xs text-slate-500">{user.department} • <span className="uppercase text-[10px] font-black tracking-widest bg-slate-200 px-1.5 py-0.5 rounded">{user.role}</span></p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-1 text-slate-450 text-xs bg-slate-100 px-2 py-1 rounded font-mono">
          <Key size={14} /> ••••
        </div>
        <button onClick={() => setEditing(true)} className="px-4 py-1.5 border border-slate-200 text-slate-655 font-bold text-sm rounded hover:bg-slate-100">
          Edit
        </button>
      </div>
    </div>
  );
}

function UserForm({ departments, onClose }: { departments: any[], onClose: () => void }) {
  const [form, setForm] = useState({ 
    name: '', 
    passcode: '', 
    department: departments.length > 0 ? departments[0].id : '', 
    role: 'volunteer' 
  });
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.passcode) return;
    setSaving(true);
    const success = await createAdminUser(form);
    setSaving(false);
    if (success) {
      onClose();
    } else {
      alert("Failed to create user. Please check if department is valid.");
    }
  }

  return (
    <form onSubmit={handleSave} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
      <div>
        <label className="text-xs font-bold text-slate-400 block mb-1">Name</label>
        <input type="text" required className="input-field py-2" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
      </div>
      <div>
        <label className="text-xs font-bold text-slate-400 block mb-1">Passcode</label>
        <input type="password" required maxLength={6} className="input-field py-2" value={form.passcode} onChange={e => setForm({...form, passcode: e.target.value})} />
      </div>
      <div>
        <label className="text-xs font-bold text-slate-400 block mb-1">Department</label>
        <select className="input-field py-2" value={form.department} onChange={e => setForm({...form, department: e.target.value})}>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
        </select>
      </div>
      <div>
        <button type="submit" disabled={saving} className="w-full btn-primary py-2.5">
          {saving ? 'Saving...' : 'Add User'}
        </button>
      </div>
    </form>
  );
}
