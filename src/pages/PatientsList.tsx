import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/db';
import { Link } from 'react-router-dom';
import { Users, Search, ChevronRight, Calendar } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { safeFormatDate } from '../lib/dateUtils';

export default function PatientsList() {
  const { t } = useApp();
  const [patients, setPatients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [localQuery, setLocalQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);
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
    <div className="max-w-5xl mx-auto space-y-4 pb-6 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-emerald-500 font-bold text-xs uppercase tracking-widest mb-1">All Records</p>
          <h2 className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-400 flex items-center gap-2">
            <span className="p-2 bg-gradient-primary rounded-xl text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/30">
              <Users size={18} />
            </span>
            {t('patients')}
          </h2>
        </div>
        <Link to="/patients/new" className="btn-primary text-xs flex items-center gap-1.5 w-fit px-4 py-2">
          + {t('registerPatient')}
        </Link>
      </div>

      {/* Search */}
      <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 group focus-within:border-emerald-300 dark:border-slate-800"
           style={{ border: '2px solid rgba(167,243,208,0.4)' }}>
        <Search
          size={18}
          className="text-slate-400 group-focus-within:text-emerald-500 transition-colors flex-shrink-0"
        />
        <input
          type="text"
          className="flex-1 bg-transparent outline-none text-slate-700 dark:text-slate-200 font-medium placeholder-slate-400 text-sm"
          placeholder={t('searchPatientPlaceholder')}
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
        />
        {localQuery && (
          <button
            onClick={() => { setLocalQuery(''); setSearchQuery(''); }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg leading-none font-bold"
          >
            ×
          </button>
        )}
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium px-1">
          Showing <span className="font-bold text-emerald-600">{filteredPatients.length}</span> patient{filteredPatients.length !== 1 ? 's' : ''}
          {searchQuery && ` for "${searchQuery}"`}
        </p>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-emerald-600 font-semibold">
          <div className="spinner" />
          Loading patient records…
        </div>
      ) : (
        <div className="space-y-2.5 stagger">
          {filteredPatients.slice(0, visibleCount).map((p) => (
            <Link
              key={p.id}
              to={`/patients/${p.card_number}`}
              className="flex flex-col md:flex-row justify-between items-start md:items-center p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:border-emerald-300 dark:hover:border-slate-700 hover:-translate-y-0.5 group gap-3 transition-all shadow-sm"
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-emerald-200 dark:shadow-emerald-950 group-hover:scale-105 transition-transform duration-300 flex-shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                    {p.name}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                    {p.phone || 'No phone'}
                  </p>
                </div>
              </div>

              {/* Visit Date Column */}
              <div className="hidden md:flex flex-col items-center">
                {p.last_visit_date ? (
                  <>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Last Visit</p>
                    <span className="flex items-center gap-1.5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 px-3 py-1 rounded-xl border border-slate-100 dark:border-slate-800">
                      <Calendar size={14} className="text-orange-500" /> {safeFormatDate(p.last_visit_date, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-bold text-slate-300 dark:text-slate-600 italic">No visits</span>
                )}
              </div>

              <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                {/* Mobile Visit Date */}
                <div className="md:hidden">
                  {p.last_visit_date && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-950 px-2 py-0.5 rounded-lg border border-orange-100 dark:border-orange-900">
                      <Calendar size={10} /> {safeFormatDate(p.last_visit_date)}
                    </span>
                  )}
                </div>
                
                <span
                  className="px-4 py-2 rounded-xl font-bold text-sm"
                  style={{
                    background: 'linear-gradient(135deg,#fb923c,#f97316)',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(251,146,60,0.3)',
                  }}
                >
                  {p.card_number && p.card_number.toString().startsWith('TEMP-') ? 'No ID' : `#${p.card_number}`}
                </span>
                <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all duration-250" />
              </div>
            </Link>
          ))}
          
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
    </div>
  );
}


