import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, Save, Globe, PlusCircle, Key, Wifi, Cloud, Cpu, RefreshCw, CheckCircle2, AlertCircle, Download, FileSpreadsheet, Database, Smartphone } from 'lucide-react';
import { fetchAdminUsers, updateAdminUser, createAdminUser, fetchDepartments, getBaseUrl } from '../lib/session';
import { getServerIp, setServerIp, getNetworkMode, setNetworkMode, checkServerOnline, NetworkMode } from '../lib/db';
import { QRCodeSVG } from 'qrcode.react';
import { generateDonorReport } from '../lib/donorReport';

import { useApp } from '../contexts/AppContext';

export default function Settings() {
  const { session } = useAuth();
  const { t, language, setLanguage, theme, toggleTheme } = useApp();
  const isAdmin = session?.role?.toLowerCase() === 'admin';
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const [networkMode, setNetworkModeState] = useState<NetworkMode>(getNetworkMode());
  const [serverIp, setServerIpValue] = useState(getServerIp());
  const [ipSaving, setIpSaving] = useState(false);
  const [isCheckingConn, setIsCheckingConn] = useState(false);
  const [connStatus, setConnStatus] = useState<boolean | null>(null);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);

  const handleDownloadBackup = (format: 'sqlite' | 'json' = 'sqlite') => {
    setDownloadingBackup(true);
    const base = getBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : '');
    const url = format === 'json' ? `${base}/api/backup/download?format=json` : `${base}/api/backup/download`;
    window.open(url, '_blank');
    setTimeout(() => setDownloadingBackup(false), 1500);
  };

  const handleExportDonorReport = async () => {
    setExportingReport(true);
    try {
      await generateDonorReport();
    } catch (e: any) {
      alert('Failed to export donor report: ' + (e.message || String(e)));
    } finally {
      setExportingReport(false);
    }
  };

  const checkConnection = useCallback(async () => {
    setIsCheckingConn(true);
    try {
      const ok = await checkServerOnline();
      setConnStatus(ok);
    } catch {
      setConnStatus(false);
    }
    setIsCheckingConn(false);
  }, []);

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
    void checkConnection();
  }, [isAdmin, loadData, checkConnection]);

  useEffect(() => {
    const handleIpChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setServerIpValue(customEvent.detail);
      }
    };
    const handleModeChangeEv = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setNetworkModeState(customEvent.detail);
      }
    };
    window.addEventListener('nk_server_ip_changed', handleIpChange);
    window.addEventListener('nk_network_mode_changed', handleModeChangeEv);
    return () => {
      window.removeEventListener('nk_server_ip_changed', handleIpChange);
      window.removeEventListener('nk_network_mode_changed', handleModeChangeEv);
    };
  }, []);

  const handleModeChange = (mode: NetworkMode) => {
    setNetworkModeState(mode);
    setNetworkMode(mode);
    setTimeout(() => {
      void checkConnection();
    }, 200);
  };

  async function handleIpSave() {
    setIpSaving(true);
    setServerIp(serverIp);
    setTimeout(() => {
      setIpSaving(false);
      void checkConnection();
      alert("Server IP updated!");
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
          {/* Network & Server Connection Config */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe size={20} className="text-emerald-500" />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">{t('serverConfig') || 'Network & Server Mode'}</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Switch between LAN (Local Clinic Wi-Fi) and Internet (Cloud) mode</p>
                </div>
              </div>
              {/* Live Connection Badge */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void checkConnection()}
                  disabled={isCheckingConn}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-600 transition-colors"
                  title="Test Connection"
                >
                  <RefreshCw size={14} className={isCheckingConn ? 'animate-spin text-emerald-500' : ''} />
                </button>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  connStatus === true
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : connStatus === false
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    connStatus === true ? 'bg-emerald-500 animate-pulse' : connStatus === false ? 'bg-rose-500' : 'bg-slate-400'
                  }`} />
                  {isCheckingConn ? 'Testing...' : connStatus === true ? 'Connected' : connStatus === false ? 'Offline' : 'Checking'}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Network Mode Selector */}
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2.5">
                  Select Network Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Auto Mode */}
                  <button
                    type="button"
                    onClick={() => handleModeChange('auto')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      networkMode === 'auto'
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Cpu size={18} className={networkMode === 'auto' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
                        <span className={`font-bold text-sm ${networkMode === 'auto' ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-700 dark:text-slate-300'}`}>
                          Auto Mode
                        </span>
                      </div>
                      {networkMode === 'auto' && <CheckCircle2 size={16} className="text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Smart fallback: Tries local LAN first, then automatically switches to Cloud.
                    </p>
                  </button>

                  {/* LAN Mode */}
                  <button
                    type="button"
                    onClick={() => handleModeChange('lan')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      networkMode === 'lan'
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Wifi size={18} className={networkMode === 'lan' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
                        <span className={`font-bold text-sm ${networkMode === 'lan' ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-700 dark:text-slate-300'}`}>
                          LAN Mode (Wi-Fi)
                        </span>
                      </div>
                      {networkMode === 'lan' && <CheckCircle2 size={16} className="text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Connects directly to local clinic server machine on Wi-Fi without internet.
                    </p>
                  </button>

                  {/* Internet / Cloud Mode */}
                  <button
                    type="button"
                    onClick={() => handleModeChange('internet')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      networkMode === 'internet'
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Cloud size={18} className={networkMode === 'internet' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
                        <span className={`font-bold text-sm ${networkMode === 'internet' ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-700 dark:text-slate-300'}`}>
                          Internet Mode (Cloud)
                        </span>
                      </div>
                      {networkMode === 'internet' && <CheckCircle2 size={16} className="text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Syncs directly with Render Cloud & Supabase over 4G/5G mobile internet.
                    </p>
                  </button>
                </div>
              </div>

              {/* Mode-specific configuration */}
              <div className="p-5 bg-slate-50/70 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-6 items-stretch">
                {networkMode !== 'internet' ? (
                  <div className="flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                          LAN Host Server IP
                        </label>
                        <span className="text-[10px] font-bold text-slate-400">Port: 3001</span>
                      </div>
                      <input 
                        type="text" 
                        className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" 
                        value={serverIp} 
                        onChange={e => setServerIpValue(e.target.value)} 
                        placeholder="e.g. 192.168.29.180"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={handleIpSave} disabled={ipSaving} className="btn-primary px-8 flex-1">
                        {ipSaving ? 'Saving...' : 'Save & Apply IP'}
                      </button>
                    </div>
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Local Wi-Fi Access Link</p>
                      <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 select-all">
                        http://{serverIp || '192.168.29.180'}:5173
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1">Cloud Backend Endpoint</h4>
                      <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 select-all">
                        https://nek-kadam.onrender.com
                      </p>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                      <p>✅ Works from any device, anywhere (Mobile 4G/5G, Tablet, Remote PC).</p>
                      <p>✅ All changes sync with Supabase PostgreSQL cloud database.</p>
                    </div>
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cloud Web App Link</p>
                      <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 select-all">
                        https://nek-kadam.onrender.com
                      </p>
                    </div>
                  </div>
                )}
                
                {/* QR Code */}
                <div className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 min-w-[190px]">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    {networkMode === 'internet' ? 'Scan to Open Cloud App' : 'Scan to Connect via LAN'}
                  </p>
                  <div className="p-2 bg-white rounded-xl border border-slate-100">
                    <QRCodeSVG 
                      value={networkMode === 'internet' ? 'https://nek-kadam.onrender.com' : `http://${serverIp || '192.168.29.180'}:5173`} 
                      size={120} 
                      level="H" 
                      includeMargin={true} 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── R3: 1-CLICK DATABASE BACKUP & FORMATTED DONOR EXCEL EXPORT ─── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <Database size={20} className="text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">
                    Database Backup & Donor Analytics
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    Camp Data Preservation & Executive Reports
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                1-Click Export
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: 1-Click SQLite DB Backup */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Database size={18} className="text-emerald-500" />
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      1-Click Database Backup
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Download an uncorrupted snapshot of your local clinical database (including 4,800+ patients, visits, prescriptions, and users) with zero password hassle for camp volunteers.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadBackup('sqlite')}
                    disabled={downloadingBackup}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/15 flex items-center justify-center gap-2 transition-all"
                  >
                    <Download size={15} />
                    {downloadingBackup ? 'Downloading...' : 'Download .sqlite'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadBackup('json')}
                    disabled={downloadingBackup}
                    className="py-3 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider transition-all"
                    title="Export JSON snapshot"
                  >
                    JSON
                  </button>
                </div>
              </div>

              {/* Card 2: Formatted 3-Sheet Donor Excel Report */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileSpreadsheet size={18} className="text-teal-500" />
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      Donor & Camp Excel Report
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Generates a clean 3-sheet Excel report (<span className="font-mono font-bold">.xlsx</span>) containing Executive Camp Footfall, Demographics breakdown, Diagnosis frequencies, and Pharmacy stock consumption totals.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportDonorReport}
                  disabled={exportingReport}
                  className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-teal-600/15 flex items-center justify-center gap-2 transition-all"
                >
                  <FileSpreadsheet size={15} />
                  {exportingReport ? 'Generating Report...' : 'Export Donor Report (.xlsx)'}
                </button>
              </div>
            </div>
          </div>

          {/* ─── DIRECT ANDROID APK DOWNLOAD & UPDATE CARD ─── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Smartphone size={20} className="text-blue-500" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">
                    Android Mobile App (Direct APK)
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    Install or Update Clinical Tablet & Mobile App
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Latest Build v1.2.0 (5.1 MB)
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Download the latest standalone Android APK package. Built with full camera QR/barcode scanner, offline delta sync, real-time pharmacy audio chime, and OPD slip printing.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={`${getBaseUrl()}/apk/nek-kadam.apk`}
                    download="nek-kadam-v1.2.0.apk"
                    className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-blue-600/15 flex items-center justify-center gap-2 transition-all"
                  >
                    <Download size={16} />
                    Direct Download APK (v1.2.0)
                  </a>
                  <a
                    href="https://nek-kadam.onrender.com/apk/nek-kadam.apk"
                    target="_blank"
                    rel="noreferrer"
                    className="py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                  >
                    Cloud Direct Link
                  </a>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
                <div className="p-2 bg-white rounded-lg shadow-sm shrink-0">
                  <QRCodeSVG value="https://nek-kadam.onrender.com/apk/nek-kadam.apk" size={80} level="M" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Scan to Install on Phone
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Point your phone camera to download & install directly on any Android device without PC cable.
                  </p>
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
