import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/db';
import { Link } from 'react-router-dom';
import { Users, Search, ChevronRight, Calendar, QrCode } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { safeFormatDate } from '../lib/dateUtils';
import BarcodeScannerModal from '../components/BarcodeScannerModal';

export default function PatientsList() {
  const { t } = useApp();
  const [patients, setPatients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [localQuery, setLocalQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [localQuery]);

  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery]);

  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => prev + 30);
      }
    }, { rootMargin: '400px' });
    
    observer.observe(target);
    return () => observer.disconnect();
  }, [patients.length, searchQuery, loading]);

  useEffect(() => {
    fetchPatients();
    
    const onLiveSync = () => {
      fetchPatients();
    };
    window.addEventListener('nk_live_sync_completed', onLiveSync);
    
    return () => {
      window.removeEventListener('nk_live_sync_completed', onLiveSync);
    };
  }, []);

  async function fetchPatients() {
    try {
      const { data } = await db
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });
      setPatients(data || []);
    } catch (e) {
      console.error('Failed to load patients:', e);
      setPatients([]);
    }
    setLoading(false);
  }

  const filteredPatients = patients.filter(
    (p) => {
      const q = searchQuery.toLowerCase();
      return (p.name || '').toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q)) ||
        (p.card_number && p.card_number.toString().toLowerCase().includes(q));
    }
  );

  return (
    <div className="max-w-5xl mx-auto space-y-3 pb-6 px-3.5 pt-1">
      {/* 1. STITCH DIRECTORY HEADING */}
      <section className="pt-1 flex items-center justify-between" data-purpose="directory-heading">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-800">
            <Users size={16} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block leading-none">All Records</span>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">{t('patients')}</h1>
          </div>
        </div>
      </section>

      {/* 2. STITCH ACTION BUTTONS (BALANCED 50/50 ROW) */}
      <section className="grid grid-cols-2 gap-2.5" data-purpose="quick-actions">
        <button 
          type="button"
          onClick={() => setIsScannerOpen(true)}
          className="flex items-center justify-center space-x-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 active:scale-[0.98] text-white py-2.5 px-3 rounded-xl font-semibold text-xs shadow-sm transition-all"
        >
          <QrCode size={16} className="text-emerald-400 shrink-0" />
          <span className="truncate">Scan OPD Card</span>
        </button>
        <Link 
          to="/patients/new" 
          className="flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white py-2.5 px-3 rounded-xl font-semibold text-xs shadow-sm transition-all"
        >
          <span className="text-base leading-none font-bold">+</span>
          <span className="truncate">{t('registerPatient')}</span>
        </Link>
      </section>

      {/* 3. STITCH SEARCH & STATUS ROW */}
      <section className="space-y-1.5" data-purpose="search-and-counts">
        <div className="relative flex items-center">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={16} />
          </div>
          <input 
            type="text"
            className="w-full pl-9 pr-10 py-2.5 text-xs bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 shadow-sm transition-all outline-none"
            placeholder={t('searchPatientPlaceholder')}
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
          />
          {localQuery && (
            <button
              onClick={() => { setLocalQuery(''); setSearchQuery(''); }}
              className="absolute right-9 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
          <button 
            type="button"
            onClick={() => setIsScannerOpen(true)}
            aria-label="Scan QR Code into search" 
            className="absolute right-1 p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
          >
            <QrCode size={16} />
          </button>
        </div>

        {/* Count Indicator and Sort */}
        <div className="flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span className="text-xs">
            Showing <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{filteredPatients.length}</strong> patient{filteredPatients.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center space-x-1 text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
            <span>SORTED BY LATEST</span>
          </div>
        </div>
      </section>

      {/* 4. STITCH COMPACT PATIENT CARDS LIST */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-emerald-600 font-semibold">
          <div className="spinner" />
          Loading patient records…
        </div>
      ) : (
        <div className="space-y-2">
          <section className="space-y-2" data-purpose="patient-directory-list">
            {filteredPatients.slice(0, visibleCount).map((p) => (
              <Link
                key={p.id}
                to={`/patients/${p.card_number}`}
                className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-800/80 shadow-sm flex items-center justify-between active:bg-slate-50 dark:active:bg-slate-800/60 hover:border-emerald-300 dark:hover:border-slate-700 transition-colors cursor-pointer group"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm">
                    {(p.name || 'P').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {p.name || 'Unnamed Patient'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide mt-0.5 truncate">
                      {p.phone || <span className="italic text-slate-400">No phone</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0 pl-2">
                  <span className="bg-amber-500 text-white font-bold text-xs px-2.5 py-0.5 rounded-full shadow-sm leading-normal">
                    {p.card_number && p.card_number.toString().startsWith('TEMP-') ? 'No ID' : `#${p.card_number}`}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </Link>
            ))}
          </section>

          {visibleCount < filteredPatients.length && (
            <div ref={observerTarget} className="h-10 flex items-center justify-center opacity-50">
              <div className="spinner w-6 h-6 border-emerald-500" />
            </div>
          )}

          {filteredPatients.length === 0 && (
            <div className="text-center py-20 glass-card rounded-3xl border border-dashed border-emerald-200 dark:border-slate-800">
              <Search className="w-14 h-14 text-emerald-100 dark:text-slate-800 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400 font-semibold text-lg">{searchQuery ? 'No results found' : 'Database is Empty'}</p>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-1 mb-6">
                {searchQuery ? `No results for "${searchQuery}"` : 'You may need to synchronize with the server to see patient records.'}
              </p>
              {!searchQuery && (
                <button 
                  disabled={isSyncing}
                  onClick={async () => {
                    setIsSyncing(true);
                    try {
                      const { fullDataSync } = await import('../lib/db');
                      const result = await fullDataSync();
                      if (result.success) {
                        window.location.reload();
                      } else {
                        alert("Sync Failed: " + result.message);
                      }
                    } catch (e: any) {
                      alert("Error: " + e.message);
                    } finally {
                      setIsSyncing(false);
                    }
                  }} 
                  className={`px-6 py-3 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-200 dark:shadow-none transition-all ${isSyncing ? 'bg-slate-400' : 'bg-emerald-600 active:scale-95'}`}
                >
                  {isSyncing ? 'Syncing...' : 'Refresh / Sync Now'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Live QR & Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />
    </div>
  );
}


