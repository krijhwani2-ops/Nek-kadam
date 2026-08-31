import React from 'react';
import { Users, CheckCircle2, XCircle, Clock, Trash2, ChevronRight } from 'lucide-react';
import { Student } from '../../../lib/educationService';

const STATUS_CONFIG = {
  PRESENT: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800' },
  ABSENT: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200 dark:border-red-800' },
  LATE: { icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800' },
};

interface StudentListProps {
  loading: boolean;
  filteredStudents: Student[];
  marking: boolean;
  toggleStatus: (studentId: string, currentStatus: string | null) => void;
  handleRemoveStudent: (studentId: string, name: string, e: React.MouseEvent) => void;
}

export function StudentList({
  loading,
  filteredStudents,
  marking,
  toggleStatus,
  handleRemoveStudent
}: StudentListProps) {
  return (
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
            const StatusIcon = s.todayStatus ? STATUS_CONFIG[s.todayStatus as keyof typeof STATUS_CONFIG]?.icon : null;
            const config = s.todayStatus ? STATUS_CONFIG[s.todayStatus as keyof typeof STATUS_CONFIG] : null;

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
  );
}
