import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Batch, Student, fetchBatches, fetchBatchStudents, markAttendanceBulk, 
  fetchAttendanceSummary, AttendanceSummary, enrollExistingStudent, createStudent, removeStudent, createBatch
} from '../lib/educationService';
import { searchPatients as searchPatientsApi } from '../lib/tokenService';
import { 
  Search,
  RefreshCw, ListChecks, TrendingUp, UserPlus, X, Plus
} from 'lucide-react';
import { EnrollmentModal } from './attendance/components/EnrollmentModal';
import { StudentList } from './attendance/components/StudentList';
import { safeFormatDate } from '../lib/dateUtils';

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
      <EnrollmentModal
        isOpen={showEnroll}
        onClose={() => setShowEnroll(false)}
        enrollMode={enrollMode}
        setEnrollMode={(mode) => {
          setEnrollMode(mode);
          if (mode === 'create') setRegForm(prev => ({ ...prev, batchId: selectedBatchId }));
        }}
        patientSearch={patientSearch}
        setPatientSearch={setPatientSearch}
        searchingPatients={searchingPatients}
        patientResults={patientResults}
        handleEnroll={handleEnroll}
        regForm={regForm}
        setRegForm={setRegForm}
        batches={batches}
        handleCreateAndEnroll={handleCreateAndEnroll}
        marking={marking}
      />

      {/* Student List */}
      <StudentList
        loading={loading}
        filteredStudents={filteredStudents}
        marking={marking}
        toggleStatus={toggleStatus}
        handleRemoveStudent={handleRemoveStudent}
      />

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
