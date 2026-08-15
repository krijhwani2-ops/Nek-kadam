import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { Pill, Search, Plus, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface Medicine {
  code: string;
  name: string;
  stock_level?: number;
}

export default function Medicines() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add New State
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [newMed, setNewMed] = useState({ code: '', name: '' });
  const [bulkText, setBulkText] = useState('');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchMedicines();
  }, []);

  async function fetchMedicines() {
    const { data, error } = await db
      .from('medicines')
      .select('*')
      .order('code');
    
    if (!error && data) {
      setMedicines(data);
    }
    setLoading(false);
  }

  async function handleAddMed() {
    if (!newMed.code || !newMed.name) {
      setMessage({ text: "Code and Name are required", type: 'error' });
      return;
    }

    const { error } = await db
      .from('medicines')
      .insert([{ 
        code: newMed.code.toUpperCase(), 
        name: newMed.name
      }]);

    if (!error) {
      fetchMedicines();
      setShowAddForm(false);
      setNewMed({ code: '', name: '' });
      setMessage({ text: "Medicine added successfully!", type: 'success' });
    } else {
      setMessage({ text: "Error adding medicine: " + error.message, type: 'error' });
    }
  }

  async function handleBulkImport() {
    if (!bulkText.trim()) return;
    setImporting(true);
    setMessage({ text: '', type: '' });

    try {
      // Expecting format: CODE, NAME (one per line)
      // Or CODE\tNAME
      const lines = bulkText.trim().split('\n');
      const medsToInsert = lines.map(line => {
        let code = '';
        let name = '';
        
        if (line.includes('\t')) {
          [code, name] = line.split('\t');
        } else if (line.includes(',')) {
          const parts = line.split(',');
          code = parts[0];
          name = parts.slice(1).join(',');
        } else {
          // Assume first word is code, rest is name
          const parts = line.trim().split(/\s+/);
          code = parts[0];
          name = parts.slice(1).join(' ');
        }

        return {
          code: code.trim().toUpperCase(),
          name: name.trim()
        };
      }).filter(m => m.code && m.name);

      if (medsToInsert.length === 0) {
        throw new Error("No valid medicines found. Format: CODE, NAME");
      }

      const { error } = await db
        .from('medicines')
        .upsert(medsToInsert, { onConflict: 'code' });

      if (error) throw error;

      setMessage({ text: `Successfully imported ${medsToInsert.length} medicines!`, type: 'success' });
      setBulkText('');
      setShowBulkForm(false);
      fetchMedicines();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setImporting(false);
    }
  }

  const filteredMedicines = medicines.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-xl text-white shadow-md shadow-emerald-200 dark:shadow-emerald-950">
            <Pill size={22} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Medicine Master</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-xs">Automate prescriptions by mapping codes to names</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search code or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-brand-green outline-none font-medium transition-all text-sm"
            />
          </div>
          <button 
            onClick={() => { setShowAddForm(true); setShowBulkForm(false); }}
            className="btn-primary flex items-center justify-center gap-1.5 whitespace-nowrap px-4 py-2 text-xs"
          >
            <Plus size={16} /> Add One
          </button>
          <button 
            onClick={() => { setShowBulkForm(true); setShowAddForm(false); }}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-brand-green hover:text-brand-green rounded-xl font-bold text-xs transition-all"
          >
            <FileText size={16} /> Bulk Add
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 font-bold animate-fade-in ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/30'}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {message.text}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-extrabold text-brand-darkGreen dark:text-emerald-400 flex items-center gap-2">
              <Plus className="text-brand-green" /> Register New Medicine
            </h2>
            <button onClick={() => setShowAddForm(false)} aria-label="Close form" className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <X size={18} className="text-slate-400" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Medicine Code</label>
              <input 
                value={newMed.code}
                onChange={(e) => setNewMed({...newMed, code: e.target.value})}
                placeholder="e.g. A1, B12"
                className="w-full p-2.5 bg-white/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-brand-green outline-none uppercase font-mono font-bold text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Full Medicine Name</label>
              <input 
                value={newMed.name}
                onChange={(e) => setNewMed({...newMed, name: e.target.value})}
                placeholder="e.g. Aconitum Napellus"
                className="w-full p-2.5 bg-white/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-brand-green outline-none font-medium text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={handleAddMed} className="btn-primary px-6 py-2 text-xs">
              Save Medicine
            </button>
          </div>
        </div>
      )}

      {/* Bulk Form */}
      {showBulkForm && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-extrabold text-brand-darkGreen dark:text-emerald-400 flex items-center gap-2">
              <FileText className="text-brand-green" /> Bulk Import Medicines
            </h2>
            <button onClick={() => setShowBulkForm(false)} aria-label="Close form" className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <X size={18} className="text-slate-400" />
            </button>
          </div>
          <div className="space-y-3.5">
            <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 font-medium">
              Paste your list below. Each line should be: <span className="font-bold text-brand-darkGreen dark:text-emerald-400">CODE, NAME</span> or <span className="font-bold text-brand-darkGreen dark:text-emerald-400">CODE NAME</span>. 
              Existing codes will be updated.
            </p>
            <textarea 
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"A1, Aconitum Napellus\nA2, Allium Cepa\n..."}
              className="w-full h-48 p-3 bg-white/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-brand-green outline-none font-mono text-xs"
            />
            <div className="flex justify-end">
              <button 
                onClick={handleBulkImport} 
                disabled={importing || !bulkText.trim()}
                className="btn-primary px-6 py-2 text-xs disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Start Bulk Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-20 font-bold text-brand-green animate-pulse">Loading Medicines...</div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-slate-50/80 dark:bg-slate-900/80 px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Total Catalog: {medicines.length} Medicines
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-y divide-x divide-slate-100 dark:divide-slate-800">
            {filteredMedicines.map(med => (
              <div key={med.code} className="p-3.5 hover:bg-brand-lightGreen/10 dark:hover:bg-slate-800/50 transition-all group flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 flex items-center justify-center text-brand-darkGreen dark:text-emerald-400 font-black text-xs group-hover:border-brand-green transition-colors">
                    {med.code}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{med.name}</p>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Automated Code: {med.code}</p>
                  </div>
                </div>
              </div>
            ))}
            {filteredMedicines.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-400 dark:text-slate-500 italic">
                No medicines found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
