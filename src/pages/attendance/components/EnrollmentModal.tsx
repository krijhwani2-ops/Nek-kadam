import React from 'react';
import { Search, RefreshCw, X } from 'lucide-react';
import { Batch } from '../../../lib/educationService';

interface EnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  enrollMode: 'search' | 'create';
  setEnrollMode: (mode: 'search' | 'create') => void;
  patientSearch: string;
  setPatientSearch: (search: string) => void;
  searchingPatients: boolean;
  patientResults: any[];
  handleEnroll: (patientId: string) => void;
  regForm: any;
  setRegForm: (form: any) => void;
  batches: Batch[];
  handleCreateAndEnroll: (e: React.FormEvent) => void;
  marking: boolean;
}

export function EnrollmentModal({
  isOpen,
  onClose,
  enrollMode,
  setEnrollMode,
  patientSearch,
  setPatientSearch,
  searchingPatients,
  patientResults,
  handleEnroll,
  regForm,
  setRegForm,
  batches,
  handleCreateAndEnroll,
  marking
}: EnrollmentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Enroll Student
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex p-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setEnrollMode('search')}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${enrollMode === 'search' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
          >
            Search Existing
          </button>
          <button
            onClick={() => setEnrollMode('create')}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${enrollMode === 'create' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
          >
            New Profile
          </button>
        </div>

        {enrollMode === 'search' ? (
          <div className="flex flex-col h-full">
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  autoFocus
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search child name or card..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl pl-10 pr-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[300px]">
              {searchingPatients ? (
                <div className="flex justify-center p-8"><RefreshCw className="animate-spin text-slate-300" /></div>
              ) : patientResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Search size={32} className="text-slate-200 dark:text-slate-700 mb-2" />
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Type to search patients</p>
                </div>
              ) : (
                patientResults.map(p => (
                  <button
                    key={p.card_number}
                    onClick={() => handleEnroll(p.card_number)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">{p.name}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{p.card_number?.startsWith('TEMP-') ? 'No ID' : `#${p.card_number}`}</p>
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-600 text-white px-2 py-1 rounded text-[10px] font-black uppercase">
                      Enroll
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateAndEnroll} className="p-6 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Full Name *</label>
                <input
                  required
                  value={regForm.name}
                  onChange={e => setRegForm({...regForm, name: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm font-medium outline-none"
                  placeholder="e.g. Rahul Kumar"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Aadhar Card No.</label>
                <input
                  value={regForm.adhar_no}
                  onChange={e => setRegForm({...regForm, adhar_no: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm font-medium outline-none"
                  placeholder="12 digit number"
                  maxLength={12}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Phone No.</label>
                <input
                  value={regForm.phone}
                  onChange={e => setRegForm({...regForm, phone: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm font-medium outline-none"
                  placeholder="Phone"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Age</label>
                <input
                  type="number"
                  value={regForm.age}
                  onChange={e => setRegForm({...regForm, age: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm font-medium outline-none"
                  placeholder="Age"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Select Shift (Batch)</label>
                <select
                  required
                  value={regForm.batchId}
                  onChange={e => setRegForm({...regForm, batchId: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none appearance-none"
                >
                  <option value="">Choose Batch</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={marking}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50 mt-4"
            >
              {marking ? 'Creating...' : 'Register & Enroll'}
            </button>
          </form>
        )}

        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">
            Nek Kadam Clinical Management System
          </p>
        </div>
      </div>
    </div>
  );
}
