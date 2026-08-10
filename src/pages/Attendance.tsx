import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Batch, Student, fetchBatches, fetchBatchStudents, markAttendanceBulk, 
  fetchAttendanceSummary, AttendanceSummary, enrollExistingStudent, createStudent, removeStudent, createBatch
} from '../lib/educationService';
import { searchPatients as searchPatientsApi } from '../lib/tokenService';
import { 
  Users, CheckCircle2, XCircle, Clock, Search, 
  RefreshCw, ChevronRight, ListChecks, TrendingUp, UserPlus, X, Trash2, Plus
} from 'lucide-react';
import { safeFormatDate } from '../lib/dateUtils';

const STATUS_CONFIG = {
  PRESENT: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800' },
  ABSENT: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200 dark:border-red-800' },
  LATE: { icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800' },
};

export default function Attendance() {
  const { session } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({ total: 0, present: 0, absent: 0, late: 0 });
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollMode, setEnrollMode] = useState<'search' | 'create'>('search');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  
  // Registration Form State
  const [regForm, setRegForm] = useState({
    name: '',
    adhar_no: '',
    phone: '',
    age: '',
    batchId: ''
  });

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchTiming, setNewBatchTiming] = useState('');

  // Initial Load
  useEffect(() => {
    fetchBatches().then(res => {
      if (res.data && res.data.length > 0) {
        setBatches(res.data);
        setSelectedBatchId(res.data[0].id);
      }
    });
  }, []);

  // Load Data for Batch
  const loadData = useCallback(async () => {
    setLoading(true);
    const [stuRes, sumRes] = await Promise.all([
      fetchBatchStudents(selectedBatchId, date),
      fetchAttendanceSummary({ batchId: selectedBatchId, date })
    ]);
    if (stuRes.data) setStudents(stuRes.data);
    if (sumRes.data) setSummary(sumRes.data);
    setLoading(false);
  }, [selectedBatchId, date]);

  useEffect(() => {
    if (!selectedBatchId) return;
    void loadData();

    const onLiveSync = () => {
      void loadData();
    };
    window.addEventListener('nk_live_sync_completed', onLiveSync);

    return () => {
      window.removeEventListener('nk_live_sync_completed', onLiveSync);
    };
  }, [selectedBatchId, loadData]);

  // Debounced Patient Search Effect with Cleanup
  useEffect(() => {
    if (patientSearch.trim().length < 2) {
      setPatientResults([]);
      setSearchingPatients(false);
      return;
    }
    setSearchingPatients(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchPatientsApi(patientSearch.trim());
        setPatientResults(res.data || []);
      } catch (e) {
        console.error('Search error:', e);
        setPatientResults([]);
      } finally {
        setSearchingPatients(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [patientSearch]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.name.toLowerCase().includes(search.toLowerCase()) || 
      s.card_number.includes(search)
    );
  }, [students, search]);

  // One-Tap: Mark All Present
  async function handleMarkAllPresent() {
    setConfirmDialog({
      isOpen: true,
      title: 'Mark All Present',
      message: 'Are you sure you want to mark all students in this batch as PRESENT?',
      onConfirm: async () => {
        setConfirmDialog(null);
        setMarking(true);
        const records = students.map(s => ({ studentId: s.educationStudentId, status: 'PRESENT' as const }));
        const res = await markAttendanceBulk({ date, records, userId: session?.userId });
        if (res.success) loadData();
        else alert(res.error || 'Failed to mark attendance');
        setMarking(false);
      }
    });
  }

  // Quick Toggle Status
  async function toggleStatus(studentId: string, currentStatus: string | null) {
    const nextStatusMap: any = { null: 'PRESENT', PRESENT: 'ABSENT', ABSENT: 'LATE', LATE: 'PRESENT' };
    const nextStatus = nextStatusMap[String(currentStatus)] || 'PRESENT';
    
    setMarking(true);
    const res = await markAttendanceBulk({ 
      date, 
      records: [{ studentId, status: nextStatus }], 
      userId: session?.userId 
    });
    if (res.success) loadData();
    setMarking(false);
  }

  async function handleEnroll(patientId: string) {
    if (!selectedBatchId) return;
    const res = await enrollExistingStudent(patientId, selectedBatchId);
    if (res.success) {
      setShowEnroll(false);
      setPatientSearch('');
      setPatientResults([]);
      loadData();
    } else {
      alert(res.error || 'Failed to enroll student');
    }
  }

  async function handleCreateAndEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!regForm.name || !regForm.batchId) return;
    
    setMarking(true);
    const res = await createStudent(regForm);
    if (res.success) {
      setShowEnroll(false);
      setRegForm({ name: '', adhar_no: '', phone: '', age: '', batchId: '' });
      loadData();
    } else {
      alert(res.error || 'Failed to create student profile');
    }
    setMarking(false);
  }

  async function handleRemoveStudent(studentId: string, name: string, e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Student',
      message: `Are you sure you want to remove ${name} from this batch? All their attendance records will be deleted permanently.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setMarking(true);
        const res = await removeStudent(studentId);
        if (res.success) {
          loadData();
        } else {
          alert(res.error || 'Failed to remove student');
        }
        setMarking(false);
      }
    });
  }

  async function handleCreateBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!newBatchName) return;
    setMarking(true);
    const res = await createBatch({ name: newBatchName, timing: newBatchTiming });
    if (res.success) {
      setShowBatchModal(false);
      setNewBatchName('');
      setNewBatchTiming('');
      fetchBatches().then(bRes => {
        if (bRes.data) {
          setBatches(bRes.data);
          const created = bRes.data[bRes.data.length - 1];
          if (created) setSelectedBatchId(created.id);
        }
      });
    } else {
      alert(res.error || 'Failed to create batch');
    }
    setMarking(false);
  }

  if (!session) return null;

  return (
    <div className="flex flex-col h-full space-y-4">
      
      {/* 1. Header & Batch Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Attendance</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">{safeFormatDate(date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 active:bg-slate-100 dark:active:bg-slate-700">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-none text-xs font-bold p-2 rounded-lg outline-none cursor-pointer"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar items-center">
          {batches.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBatchId(b.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                selectedBatchId === b.id 
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-100 dark:shadow-emerald-950' 
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
              }`}
            >
              {b.name}
            </button>
          ))}
          <button 
            onClick={() => setShowBatchModal(true)}
            className="p-2 rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-600 dark:hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors flex items-center justify-center shrink-0"
            title="Create New Batch"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* 2. Daily Summary Dashboard */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
          <p className="text-xl font-black text-slate-800 dark:text-slate-100">{summary.present}</p>
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Present</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
          <p className="text-xl font-black text-slate-800 dark:text-slate-100">{summary.absent}</p>
          <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">Absent</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
          <p className="text-xl font-black text-slate-800 dark:text-slate-100">{summary.late}</p>
          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Late</p>
        </div>
      </div>

      {/* 3. Search & Quick Actions */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student..." 
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none"
          />
        </div>
        <button 
          onClick={() => setShowEnroll(true)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <UserPlus size={16} /> Add Child
        </button>
        <button 
          onClick={handleMarkAllPresent}
          disabled={marking || students.length === 0}
          className="bg-emerald-600 active:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
        >
          <ListChecks size={16} /> Mark All
        </button>
      </div>

      {/* Create Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-slate-800 dark:text-slate-100">Create New Batch</h3>
              <button onClick={() => setShowBatchModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateBatch} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Batch Name *</label>
                <input 
                  required autoFocus
                  value={newBatchName}
                  onChange={e => setNewBatchName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm font-medium outline-none"
                  placeholder="e.g. Morning Shift"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Timing (Optional)</label>
                <input 
                  value={newBatchTiming}
                  onChange={e => setNewBatchTiming(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm font-medium outline-none"
                  placeholder="e.g. 09:00 AM - 12:00 PM"
                />
              </div>
              <button 
                type="submit"
                disabled={marking}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50 mt-4"
              >
                {marking ? 'Creating...' : 'Create Batch'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Enrollment Modal */}
      {showEnroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-slate-800 dark:text-slate-100">Add Child</h3>
              <button onClick={() => setShowEnroll(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
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
                onClick={() => {
                  setEnrollMode('create');
                  setRegForm(prev => ({ ...prev, batchId: selectedBatchId }));
                }}
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
      )}

      {/* 4. Student List */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        <div className="bg-slate-50/50 dark:bg-slate-950/50 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Student Name</span>
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</span>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="spinner border-slate-200 dark:border-slate-800 border-t-emerald-500" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <Users className="text-slate-200 dark:text-slate-700 mb-2" size={48} />
            <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">No students in this batch yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {filteredStudents.map(s => {
              const StatusIcon = s.todayStatus ? STATUS_CONFIG[s.todayStatus].icon : null;
              const config = s.todayStatus ? STATUS_CONFIG[s.todayStatus] : null;

              return (
                <div 
                  key={s.educationStudentId} 
                  className={`px-4 py-3.5 flex items-center justify-between transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${marking ? 'opacity-70 pointer-events-none' : ''}`}
                  onClick={() => toggleStatus(s.educationStudentId, s.todayStatus)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-300 font-bold text-sm">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">{s.name}</h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{s.card_number?.startsWith('TEMP-') ? 'No ID' : `#${s.card_number}`} • {s.tag}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {s.todayStatus ? (
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${config?.bg} ${config?.border} ${config?.color}`}>
                        {StatusIcon && <StatusIcon size={14} />}
                        <span className="text-[10px] font-bold uppercase tracking-wider">{s.todayStatus}</span>
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                        Mark
                      </div>
                    )}
                    <button 
                      onClick={(e) => handleRemoveStudent(s.educationStudentId, s.name, e)}
                      className="p-1.5 text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors ml-1"
                      title="Remove Student"
                    >
                      <Trash2 size={16} />
                    </button>
                    <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 ml-1" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Quick Analytics / Footer */}
      <div className="bg-emerald-900 text-emerald-100 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-emerald-900/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-800 rounded-lg">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Avg. Attendance</p>
            <p className="text-lg font-black leading-tight">
              {summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0}%
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex -space-x-2">
            {[1,2,3].map(i => (
              <div key={i} className="w-6 h-6 rounded-full border-2 border-emerald-900 bg-emerald-700 flex items-center justify-center text-[8px] font-black">
                {i}
              </div>
            ))}
          </div>
          <span className="text-[10px] font-bold mt-1 opacity-60">Active Students</span>
        </div>
      </div>

      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{confirmDialog.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
