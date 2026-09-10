import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { Package, AlertTriangle, Search, Plus, X, Save } from 'lucide-react';

interface Medicine {
  code: string;
  name: string;
  stock_level: number;
  reorder_level: number;
}

export default function Inventory() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit State
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ stock_level: 0, reorder_level: 10 });
  
  // Add New State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMed, setNewMed] = useState({ code: '', name: '', stock_level: 0, reorder_level: 10 });

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

  async function handleUpdate(code: string) {
    const { error } = await db
      .from('medicines')
      .update({ 
        stock_level: editForm.stock_level, 
        reorder_level: editForm.reorder_level 
      })
      .eq('code', code);
    
    if (!error) {
      setMedicines(medicines.map(m => m.code === code ? { ...m, ...editForm } : m));
      setEditingCode(null);
    } else {
      alert("Error updating medicine: " + error.message);
    }
  }

  async function handleAddMed() {
    if (!newMed.code || !newMed.name) {
      alert("Code and Name are required");
      return;
    }

    const { error } = await db
      .from('medicines')
      .insert([{ 
        code: newMed.code.toUpperCase(), 
        name: newMed.name, 
        stock_level: newMed.stock_level, 
        reorder_level: newMed.reorder_level 
      }]);

    if (!error) {
      fetchMedicines();
      setShowAddForm(false);
      setNewMed({ code: '', name: '', stock_level: 0, reorder_level: 10 });
    } else {
      alert("Error adding medicine: " + error.message);
    }
  }

  const filteredMedicines = medicines.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-primary rounded-2xl text-white shadow-lg shadow-brand-green/20">
            <Package size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800">Inventory Management</h1>
            <p className="text-slate-500 font-medium text-sm">Monitor stock and reorder points</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by code or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-green outline-none font-medium transition-all"
            />
          </div>
          <button 
            onClick={() => setShowAddForm(true)}
            className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus size={20} /> Add Medicine
          </button>
        </div>
      </div>

      {/* Add New Form (Modal-like) */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-extrabold text-brand-darkGreen flex items-center gap-2">
              <Plus className="text-brand-green" /> Register New Medicine
            </h2>
            <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Code</label>
              <input 
                value={newMed.code}
                onChange={(e) => setNewMed({...newMed, code: e.target.value})}
                placeholder="e.g. A20"
                className="w-full p-3 bg-white/70 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-green outline-none uppercase font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
              <input 
                value={newMed.name}
                onChange={(e) => setNewMed({...newMed, name: e.target.value})}
                placeholder="Medicine Name"
                className="w-full p-3 bg-white/70 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-green outline-none font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Initial Stock</label>
              <input 
                type="number"
                value={newMed.stock_level}
                onChange={(e) => setNewMed({...newMed, stock_level: parseInt(e.target.value) || 0})}
                className="w-full p-3 bg-white/70 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-green outline-none font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Reorder Level</label>
              <input 
                type="number"
                value={newMed.reorder_level}
                onChange={(e) => setNewMed({...newMed, reorder_level: parseInt(e.target.value) || 0})}
                className="w-full p-3 bg-white/70 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-green outline-none font-bold text-brand-orange"
              />
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button onClick={handleAddMed} className="btn-primary px-10">
              Save Medicine
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      {loading ? (
        <div className="text-center py-20 font-bold text-brand-green animate-pulse">Loading Inventory Data...</div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 text-xs font-extrabold uppercase tracking-widest border-b border-slate-100">
                <th className="px-8 py-5">Medicine Info</th>
                <th className="px-8 py-5 text-center">Current Stock</th>
                <th className="px-8 py-5 text-center">Reorder Point</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredMedicines.map(med => {
                const isLowStock = med.stock_level <= med.reorder_level;
                const isEditing = editingCode === med.code;

                return (
                  <tr key={med.code} className={`hover:bg-brand-lightGreen/10 transition-colors ${isEditing ? 'bg-brand-lightGreen/20' : ''}`}>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-mono font-black text-brand-darkGreen text-lg">{med.code}</span>
                        <span className="font-bold text-slate-700">{med.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          className="w-24 p-2 bg-white border-2 border-brand-green rounded-xl focus:outline-none text-center font-bold"
                          value={editForm.stock_level}
                          onChange={(e) => setEditForm({ ...editForm, stock_level: parseInt(e.target.value) || 0 })}
                          autoFocus
                        />
                      ) : (
                        <span className={`text-xl font-black ${isLowStock ? 'text-red-600' : 'text-slate-800'}`}>
                          {med.stock_level ?? 0}
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-center font-bold text-slate-500">
                      {isEditing ? (
                        <input
                          type="number"
                          className="w-24 p-2 bg-white border-2 border-brand-orange rounded-xl focus:outline-none text-center font-bold"
                          value={editForm.reorder_level}
                          onChange={(e) => setEditForm({ ...editForm, reorder_level: parseInt(e.target.value) || 0 })}
                        />
                      ) : (
                        <span>{med.reorder_level}</span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      {isLowStock ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-red-100 text-red-700 uppercase tracking-tight">
                          <AlertTriangle size={14} /> Critical Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 uppercase tracking-tight">
                          Healthy Stock
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-right">
                      {isEditing ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleUpdate(med.code)}
                            className="p-2 bg-brand-green text-white rounded-xl hover:bg-brand-darkGreen transition-colors shadow-md shadow-brand-green/20"
                            title="Save"
                          >
                            <Save size={20} />
                          </button>
                          <button
                            onClick={() => setEditingCode(null)}
                            className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 transition-colors"
                            title="Cancel"
                          >
                            <X size={20} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingCode(med.code);
                            setEditForm({ stock_level: med.stock_level, reorder_level: med.reorder_level });
                          }}
                          className="px-5 py-2.5 bg-white border-2 border-slate-100 text-slate-700 hover:border-brand-green hover:text-brand-green rounded-xl font-bold text-sm transition-all hover:shadow-md"
                        >
                          Manage Stock
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredMedicines.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-slate-400 italic">
                    No medicines found in the system.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


