import { useState, useRef, useEffect } from 'react';
import { db } from '../lib/db';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';

export default function ImportPatients() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importType, setImportType] = useState<'patients' | 'medicines'>('patients');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState<any[]>([]);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (navTimerRef.current) {
        clearTimeout(navTimerRef.current);
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError('');
      setSuccess('');
      
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError('Error parsing CSV file. Please check the format.');
            return;
          }
          const validData = results.data.filter((row: any) => 
            Object.values(row).some(v => v && v.toString().trim().length > 0)
          );
          setPreview(validData.slice(0, 5));
        }
      });
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setSuccess('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          
          if (importType === 'patients') {
            const patients = [];
            for (const row of rows) {
              const keys = Object.keys(row);
              const getVal = (possibleNames: string[]) => {
                const key = keys.find(k => possibleNames.includes(k.toLowerCase().replace(/[\s_.]/g, '')));
                return key ? row[key]?.toString().trim() : null;
              };

              const card = getVal(['card', 'cardno', 'cardnumber', 'serialno', 'id']);
              const name = getVal(['name', 'fullname', 'patientname']);
              const phone = getVal(['phone', 'phonenumber', 'contact', 'contactno', 'mobile']);
              const address = getVal(['address', 'addr', 'location']);

              if (card && name && name !== 'Name') {
                patients.push({
                  card_number: card,
                  name: name,
                  phone: phone || null,
                  address: address || null
                });
              }
            }

            if (patients.length === 0) throw new Error('No valid patient data found.');
            const { error: insertError } = await db.from('patients').upsert(patients, { onConflict: 'card_number' });
            if (insertError) throw insertError;
            setSuccess(`Successfully imported ${patients.length} patients!`);
            if (navTimerRef.current) clearTimeout(navTimerRef.current);
            navTimerRef.current = setTimeout(() => navigate('/patients'), 2000);

          } else {
            // MEDICINES IMPORT
            const medicines = [];
            for (const row of rows) {
              const keys = Object.keys(row);
              const getVal = (possibleNames: string[]) => {
                const key = keys.find(k => possibleNames.includes(k.toLowerCase().replace(/[\s_.]/g, '')));
                return key ? row[key]?.toString().trim() : null;
              };

              const code = getVal(['code', 'medicinecode', 'id', 'sn']);
              const name = getVal(['name', 'medicinename', 'fullname']);

              if (code && name) {
                medicines.push({
                  code: code.toUpperCase(),
                  name: name
                });
              }
            }

            if (medicines.length === 0) throw new Error('No valid medicine data found (Need Code and Name).');
            const { error: insertError } = await db.from('medicines').upsert(medicines, { onConflict: 'code' });
            if (insertError) throw insertError;
            setSuccess(`Successfully synced ${medicines.length} medicines!`);
            if (navTimerRef.current) clearTimeout(navTimerRef.current);
            navTimerRef.current = setTimeout(() => navigate('/medicines'), 2000);
          }
        } catch (err: any) {
          setError(err.message || 'Failed to import data.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <div className="glass-card p-8 md:p-12 rounded-3xl mt-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-gradient-primary rounded-2xl text-white shadow-lg shadow-emerald-200">
              <Upload size={36} />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-slate-800">Advanced Data Importer</h2>
              <p className="text-slate-500 font-medium mt-1">Universal sync for Patients and Medicines</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button 
              onClick={() => { setImportType('patients'); setPreview([]); setFile(null); }}
              className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${importType === 'patients' ? 'bg-white text-brand-green shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Patients
            </button>
            <button 
              onClick={() => { setImportType('medicines'); setPreview([]); setFile(null); }}
              className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${importType === 'medicines' ? 'bg-white text-brand-green shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Medicines
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Step 1</p>
            <p className="text-sm font-bold text-slate-700">Export as CSV from Sheets</p>
          </div>
          <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
            <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Step 2</p>
            <p className="text-sm font-bold text-slate-700">Upload & Review Preview</p>
          </div>
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Step 3</p>
            <p className="text-sm font-bold text-slate-700">Patients are auto-synced</p>
          </div>
        </div>

        {error && (
          <div className="p-5 mb-8 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-2xl font-bold flex items-center gap-3">
            <AlertCircle size={24} /> {error}
          </div>
        )}

        {success && (
          <div className="p-5 mb-8 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 rounded-r-2xl font-bold flex items-center gap-3">
            <CheckCircle size={24} /> {success}
          </div>
        )}

        <div className="space-y-8">
          <div className="border-4 border-dashed border-slate-200 hover:border-brand-green bg-slate-50/50 rounded-3xl p-12 text-center transition-all cursor-pointer group">
            <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
              <div className="p-5 bg-white rounded-full mb-4 shadow-sm group-hover:bg-brand-green group-hover:text-white transition-all">
                <FileText size={40} className="text-slate-400 group-hover:text-white" />
              </div>
              <span className="text-slate-700 font-black text-xl">{file ? file.name : 'Select Patient CSV'}</span>
              <p className="text-slate-400 text-sm mt-2">Supports columns: Card, Name, Phone, Address</p>
              <p className="text-amber-800 text-xs mt-3 max-w-md mx-auto font-semibold bg-amber-50/90 border border-amber-100 rounded-xl px-3 py-2">
                <strong>Sheet2 grid</strong> (row 0 = dates, CATEGORY/MEDICINE pairs)? Not supported in-browser. On the{' '}
                <strong>server PC</strong>:&nbsp;
                <code className="text-[10px] bg-white px-1 rounded border border-amber-200">npm run sheet2:normalize</code>
                &nbsp;then&nbsp;
                <code className="text-[10px] bg-white px-1 rounded border border-amber-200">
                  npm run import:sheet2 -- --sqlite --medicines
                </code>
                . See <code className="text-[10px]">docs/SHEET2_IMPORT.md</code>.
              </p>
            </label>
          </div>

          {preview.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Previewing Data</h3>
                <span className="text-[10px] font-bold text-slate-400">First 5 rows detected</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 border-b border-slate-100">
                      {Object.keys(preview[0]).map((key) => (
                        <th key={key} className="px-6 py-3 font-black">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/30">
                        {Object.values(row).map((val: any, i) => (
                          <td key={i} className="px-6 py-3 font-medium text-slate-600">{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="w-full bg-gradient-primary text-white font-black py-5 px-6 rounded-2xl hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 text-lg"
          >
            {loading ? 'Importing Patients...' : 'Process CSV & Sync Records'}
          </button>
        </div>
      </div>
    </div>
  );
}


