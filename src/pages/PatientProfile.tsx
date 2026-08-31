import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, checkServerOnline, saveVisitOffline, getPendingVisitsForPatient, cleanPatientId } from '../lib/db';
import { getBaseUrl } from '../lib/session';
import { Phone, CreditCard, Plus, Clock, Trash2, X, Printer, FileText, Calendar, Stethoscope, RefreshCw } from 'lucide-react';
import { Spinner } from '../components/ui';

interface PrescribedMed {
  code: string;
  name: string;
  quantity: number;
}

interface MedGroup {
  power: string;
  dosage: string;
  meds: PrescribedMed[];
}

/** Load visit history from LOCAL IndexedDB cache only (no server call). */
async function loadVisitsFromIndexedDB(cardNumber: string, patientUUID?: string): Promise<any[]> {
  const cleanCard = cleanPatientId(cardNumber);

  // Query local IndexedDB cache tables to reconstruct full visit prescriptions
  const { data: visitsData } = await db
    .from('visits')
    .select('*');

  if (!visitsData || visitsData.length === 0) return [];

  // Filter in memory to handle potential '.0' suffix mismatches or UUID vs card_number in local DB
  const filteredVisits = visitsData.filter((v: any) => {
    const vPatientId = String(v.patient_id || v.patientId || '').trim();
    const cleanVId = cleanPatientId(vPatientId);
    return cleanVId === cleanCard || vPatientId === cardNumber || (patientUUID && vPatientId === patientUUID);
  });

  // Sort visits descending by date
  filteredVisits.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (filteredVisits.length === 0) return [];

  const visitIds = new Set(filteredVisits.map((v: any) => v.id));

  try {
    const { data: allGroups } = await db.from('prescription_groups').select('*');
    const filteredGroups = (allGroups || []).filter((g: any) => visitIds.has(g.visit_id || g.visitId));
    const groupIds = new Set(filteredGroups.map((g: any) => g.id));

    const { data: allGroupMeds } = await db.from('group_medicines').select('*');
    const filteredGroupMeds = (allGroupMeds || []).filter((gm: any) => groupIds.has(gm.group_id || gm.groupId));

    const { data: allMeds } = await db.from('medicines').select('*');
    const medsMap = new Map((allMeds || []).map((m: any) => [m.code, m.name]));

    return filteredVisits.map((v: any) => {
      const groups = filteredGroups.filter((g: any) => (g.visit_id || g.visitId) === v.id);
      const enrichedGroups = groups.map((g: any) => {
        const meds = filteredGroupMeds
          .filter((gm: any) => (gm.group_id || gm.groupId) === g.id)
          .map((gm: any) => ({
            ...gm,
            medicine_name: medsMap.get(gm.medicine_code || gm.medicineCode) || gm.medicine_code || gm.medicineCode
          }));
        return { ...g, group_medicines: meds };
      });
      return { ...v, prescription_groups: enrichedGroups };
    });
  } catch (enrichErr) {
    console.error('[OFFLINE VISIT ENRICHMENT] Failed:', enrichErr);
    return filteredVisits;
  }
}

export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [patient, setPatient] = useState<any>(null);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dosages, setDosages] = useState<any[]>([]);

  // New Visit State
  const [doctorName, setDoctorName] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [visitNotes, setVisitNotes] = useState('');
  const [medicineGroups, setMedicineGroups] = useState<MedGroup[]>([{ power: '', dosage: 'BD', meds: [] }]);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  
  // Search/Entry State
  const [currentCode, setCurrentCode] = useState('');
  const [currentName, setCurrentName] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [isNewMedicine, setIsNewMedicine] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [addingVisit, setAddingVisit] = useState(false);

  // Visit Details Modal State
  const [selectedVisit, setSelectedVisit] = useState<any>(null);

  // Edit Patient State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editBloodGroup, setEditBloodGroup] = useState('');
  const [editGender, setEditGender] = useState('');

  // Edit Visit State
  const [isEditingVisit, setIsEditingVisit] = useState(false);
  const [editVisitDoctor, setEditVisitDoctor] = useState('');
  const [editVisitDate, setEditVisitDate] = useState('');
  const [editVisitNotes, setEditVisitNotes] = useState('');
  const [editVisitMeds, setEditVisitMeds] = useState<MedGroup[]>([]);
  const [editActiveGroupIndex, setEditActiveGroupIndex] = useState(0);

  // Edit Visit Search autocomplete State
  const [editSearchQuery, setEditSearchQuery] = useState('');
  const [editSearchResults, setEditSearchResults] = useState<any[]>([]);
  const [showEditResults, setShowEditResults] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const editSearchRef = useRef<HTMLDivElement>(null);

  const fetchDosages = useCallback(async () => {
    const { data, error } = await db.from('dosage_frequency').select('*');
    if (error || !data || data.length === 0) {
      setDosages([
        { code: 'OD', meaning: 'Once a day' },
        { code: 'BD', meaning: 'Twice a day' },
        { code: 'TDS', meaning: 'Thrice a day' },
        { code: 'QID', meaning: 'Four times a day' },
        { code: 'HS', meaning: 'Bed time' },
        { code: 'SD', meaning: 'Single dose' },
        { code: 'SOS', 'meaning': 'Emergency' }
      ]);
    } else {
      setDosages(data);
    }
  }, []);

  const fetchPatientData = useCallback(async () => {
    try {
      const cleanId = cleanPatientId(id);
      const { data: patientData, error: pError } = await db.from('patients')
        .select('*')
        .or(`id.eq.${id},card_number.eq.${id},id.eq.${cleanId},card_number.eq.${cleanId}`)
        .maybeSingle();

      if (pError || !patientData) {
        console.error('[DEBUG] Patient lookup failed for ID:', id, pError);
        setLoading(false);
        return;
      }
      
      let enrichedVisits: any[] = [];
      try {
        const cardParam = patientData.card_number || patientData.id || cleanId;
        console.log('[API DEBUG] Fetching history for:', cardParam);
        const res = await fetch(`${getBaseUrl()}/api/patients/${cardParam}/visits`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}`
          }
        });
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const result = await res.json();
        console.log('[API DEBUG] Result received:', result);
        enrichedVisits = result.data || [];
      } catch (fetchErr: unknown) {
        console.error('[API DEBUG] Server fetch failed, using local data:', fetchErr);
      }
      
      // Always check local IndexedDB cache and merge
      if (enrichedVisits.length === 0) {
        const localVisits = await loadVisitsFromIndexedDB(patientData.card_number, patientData.id);
        if (localVisits.length > 0) enrichedVisits = localVisits;
      }
      
      // CRITICAL: Merge any unsynced pending visits from nk_pending_ops queue
      try {
        const pendingVisits = await getPendingVisitsForPatient(patientData.card_number);
        if (pendingVisits.length > 0) {
          console.log('[API DEBUG] Merging', pendingVisits.length, 'pending unsynced visits into display');
          // Add pending visits that aren't already in the list
          const existingVisits = new Set(enrichedVisits.map((v: any) => `${v.date}_${v.doctor_name}`));
          for (const pv of pendingVisits) {
            const key = `${pv.date}_${pv.doctor_name}`;
            if (!existingVisits.has(key)) {
              enrichedVisits.unshift(pv);
              existingVisits.add(key);
            }
          }
        }
      } catch (pendingErr) {
        console.warn('[API DEBUG] Failed to read pending visits:', pendingErr);
      }

      setPatient(patientData);
      setVisits(enrichedVisits);
    } catch (e) {
      console.error('Failed to fetch patient data:', e);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    let isMounted = true;

    if (id) {
      fetchPatientData();
      fetchDosages();
    }
    
    const onLiveSync = () => {
      if (!isMounted) return;
      fetchPatientData();
    };
    window.addEventListener('nk_live_sync_completed', onLiveSync);

    return () => {
      isMounted = false;
      window.removeEventListener('nk_live_sync_completed', onLiveSync);
    };
  }, [id, fetchPatientData, fetchDosages]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editSearchRef.current && !editSearchRef.current.contains(e.target as Node)) {
        setShowEditResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!editSearchQuery.trim() || editSearchQuery.includes('+')) {
        setEditSearchResults([]);
        return;
      }
      const q = editSearchQuery.toUpperCase().trim();
      const { data } = await db.from('medicines')
        .select('*')
        .ilike('name', `%${q}%`)
        .limit(6)
        .execute();
      setEditSearchResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [editSearchQuery]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (currentCode.trim()) {
        const { data } = await db.from('medicines').select('*').eq('code', currentCode.trim().toUpperCase()).maybeSingle();
        if (data) {
          setCurrentName(data.name);
          setIsNewMedicine(false);
        } else {
          setCurrentName('');
          setIsNewMedicine(true);
        }
      } else {
        setCurrentName('');
        setIsNewMedicine(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [currentCode]);

  // Universal Medicine Search for Turbo/Dropdown
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim() || searchQuery.includes('+')) {
        setSearchResults([]);
        return;
      }

      const q = searchQuery.toUpperCase().trim();
      
      // Search the new local medicines table
      const { data, error } = await db.from('medicines')
        .select('code, name')
        .or(`code.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(20);

      if (error) {
        console.error("Search Error:", error);
        return;
      }

      const results = (data || []).map(m => ({ code: m.code, name: m.name, type: 'Homeo' }));

      setSearchResults(results);
      setShowResults(true);
    }, 150); 
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectMedicine = (med: any) => {
    setCurrentCode(med.code);
    setCurrentName(med.name);
    setIsNewMedicine(false);
    setShowResults(false);
    setSearchQuery('');
  };

  const handleAddMedicine = async () => {
    const code = currentCode.trim().toUpperCase();
    let name = currentName.trim();
    
    if (!name && code) {
      const { data } = await db.from('medicines').select('*').eq('code', code).maybeSingle();
      if (data) {
        name = data.name;
      } else {
        name = code; // fallback
      }
    }

    if (!code || !name) return;

    if (isNewMedicine || name === code) {
      await db.from('medicines').insert([{ code, name }]);
    }

    const updatedGroups = [...medicineGroups];
    if (!updatedGroups[activeGroupIndex].meds.find(m => m.code === code)) {
      updatedGroups[activeGroupIndex].meds.push({ code, name, quantity: currentQuantity });
      setMedicineGroups(updatedGroups);
    }
    
    setCurrentCode('');
    setCurrentName('');
    setCurrentQuantity(1);
    setIsNewMedicine(false);
  };

  const addGroup = () => {
    setMedicineGroups([...medicineGroups, { power: '', dosage: 'BD', meds: [] }]);
    setActiveGroupIndex(medicineGroups.length);
  };

  const removeGroup = (index: number) => {
    if (medicineGroups.length === 1) return;
    const updated = medicineGroups.filter((_, i) => i !== index);
    setMedicineGroups(updated);
    setActiveGroupIndex(Math.max(0, index - 1));
  };

  const repeatLastPrescription = () => {
    if (visits.length === 0) {
      alert("No previous visits found.");
      return;
    }
    const lastVisit = visits[0];
    if (!lastVisit.prescription_groups || lastVisit.prescription_groups.length === 0) {
      alert("No medicines found in the last visit.");
      return;
    }

    const repeatedGroups = lastVisit.prescription_groups.map((group: any) => ({
      power: group.power || '',
      dosage: group.dosage_code || group.dosage || 'BD',
      meds: group.group_medicines?.map((med: any) => ({
        code: med.medicine_code || med.code || '',
        name: med.medicine_name || med.name || '',
        quantity: med.quantity || 1
      })) || []
    }));

    setMedicineGroups(repeatedGroups);
    setActiveGroupIndex(0);
  };

  async function handleSaveVisit() {
    console.log('[VISIT SAVE] Starting save process...');
    const hasMeds = medicineGroups.some(g => g.meds.length > 0);
    if (!hasMeds) {
      alert("Please add a medicine.");
      return;
    }
    
    setAddingVisit(true);

    const payload = {
      patientId: patient.card_number,
      date: new Date(visitDate).toISOString(),
      doctorName: doctorName || 'NGO Doctor',
      notes: visitNotes.trim() || null,
      medicineGroups
    };

    try {
      let isServerOnline = false;
      try {
        isServerOnline = await checkServerOnline();
      } catch (e) {
        isServerOnline = false;
      }

      if (!isServerOnline) {
        // OFFLINE: Use atomic compound save (writes to cache + queues single sync op)
        await saveVisitOffline(payload);
        
        // Reset states
        setMedicineGroups([{ power: '', dosage: 'BD', meds: [] }]);
        setActiveGroupIndex(0);
        setVisitNotes('');
        setAddingVisit(false);
        
        await fetchPatientData();
        alert('Saved offline successfully! It will sync automatically when online.');
        return;
      }

      const res = await fetch(`${getBaseUrl()}/api/visits/save-full`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}`
        },
        body: JSON.stringify(payload)
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || 'Failed to save visit');
      }

      console.log('[VISIT SAVE] Successfully saved via API:', result.visitId);
      
      setMedicineGroups([{ power: '', dosage: 'BD', meds: [] }]);
      setActiveGroupIndex(0);
      setVisitNotes('');
      setAddingVisit(false);
      
      await fetchPatientData();
      alert('Visit saved successfully');
    } catch (err: any) {
      console.error('[VISIT SAVE] API failed, attempting offline fallback:', err);
      
      // If API failed for ANY reason, save offline as fallback
      try {
        await saveVisitOffline(payload);
        
        setMedicineGroups([{ power: '', dosage: 'BD', meds: [] }]);
        setActiveGroupIndex(0);
        setVisitNotes('');
        setAddingVisit(false);
        
        await fetchPatientData();
        alert('Saved offline successfully (will sync when connection is stable)!');
        return;
      } catch (localErr: any) {
        console.error('[VISIT SAVE] Offline fallback failed:', localErr);
        alert('FAILED TO SAVE VISIT: ' + (localErr.message || 'Check logs'));
        setAddingVisit(false);
        return;
      }
    }
  }

  // Edit Patient Handlers
  const startEditingProfile = () => {
    setEditName(patient.name || '');
    setEditAge(patient.age ? String(patient.age) : '');
    setEditPhone(patient.phone || '');
    setEditAddress(patient.address || '');
    setEditBloodGroup(patient.blood_group || '');
    setEditGender(patient.gender || '');
    setIsEditingProfile(true);
  };

  const saveProfileChanges = async () => {
    try {
      setLoading(true);
      await db.from('patients')
        .update({
          name: editName.trim(),
          age: editAge.trim() ? parseInt(editAge.trim(), 10) : null,
          phone: editPhone.trim(),
          address: editAddress.trim(),
          blood_group: editBloodGroup.trim(),
          gender: editGender
        })
        .eq('id', patient.id)
        .execute();
        
      await fetchPatientData();
      setIsEditingProfile(false);
      alert('Patient profile updated successfully');
    } catch (err: any) {
      console.error('[PROFILE UPDATE] Error:', err);
      alert('Failed to update profile: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Edit Visit Handlers
  const startEditingVisit = () => {
    setEditVisitDoctor(selectedVisit.doctor_name || '');
    setEditVisitDate(selectedVisit.date ? selectedVisit.date.split('T')[0] : '');
    setEditVisitNotes(selectedVisit.notes || '');
    
    const groups = selectedVisit.prescription_groups || [];
    const mappedGroups: MedGroup[] = groups.map((g: any) => ({
      power: g.power || '',
      dosage: g.dosage_code || 'BD',
      meds: (g.group_medicines || []).map((m: any) => ({
        code: m.medicine_code,
        name: m.medicine_name || m.medicine_code,
        quantity: 1
      }))
    }));
    
    setEditVisitMeds(mappedGroups.length > 0 ? mappedGroups : [{ power: '', dosage: 'BD', meds: [] }]);
    setEditActiveGroupIndex(0);
    setIsEditingVisit(true);
  };

  const addMedToEditGroup = (med: any) => {
    const updated = [...editVisitMeds];
    const group = updated[editActiveGroupIndex];
    if (group.meds.some(m => m.code === med.code)) return;
    group.meds.push({
      code: med.code,
      name: med.name,
      quantity: 1
    });
    setEditVisitMeds(updated);
    setEditSearchQuery('');
    setEditSearchResults([]);
    setShowEditResults(false);
  };

  const removeMedFromEditGroup = (medCode: string) => {
    const updated = [...editVisitMeds];
    const group = updated[editActiveGroupIndex];
    group.meds = group.meds.filter(m => m.code !== medCode);
    setEditVisitMeds(updated);
  };

  const addEditGroup = () => {
    setEditVisitMeds([...editVisitMeds, { power: '', dosage: 'BD', meds: [] }]);
    setEditActiveGroupIndex(editVisitMeds.length);
  };

  const removeEditGroup = (index: number) => {
    const updated = editVisitMeds.filter((_, idx) => idx !== index);
    setEditVisitMeds(updated.length > 0 ? updated : [{ power: '', dosage: 'BD', meds: [] }]);
    setEditActiveGroupIndex(0);
  };

  const saveVisitChanges = async () => {
    const hasMeds = editVisitMeds.some(g => g.meds.length > 0);
    if (!hasMeds) {
      alert("Please add at least one medicine to save changes.");
      return;
    }

    try {
      setLoading(true);
      
      const payload = {
        visitId: selectedVisit.id,
        doctorName: editVisitDoctor,
        date: new Date(editVisitDate).toISOString(),
        notes: editVisitNotes.trim() || null,
        medicineGroups: editVisitMeds
      };

      const res = await fetch(`${getBaseUrl()}/api/visits/edit-full`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}`
        },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to update visit details');
      }

      alert('Visit details updated successfully!');
      setIsEditingVisit(false);
      setSelectedVisit(null);
      await fetchPatientData();
    } catch (err: any) {
      console.error('[VISIT UPDATE] Error:', err);
      alert('Failed to update visit: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="spinner border-brand-green border-t-transparent w-10 h-10 border-4"></div></div>;
  if (!patient) return <div className="flex flex-col items-center justify-center py-20 gap-4"><p className="text-slate-500 font-bold">Patient not found.</p><button onClick={() => navigate('/patients')} className="btn-primary">Back to Patients</button></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
      
      {/* Profile Header */}
      <div className="glass-card pt-10 pb-5 px-5 md:pt-12 md:pb-6 md:px-6 rounded-2xl relative overflow-hidden shadow-xl shadow-emerald-900/5 dark:border-slate-800">
        {/* Unique Card Number Ribbon (Top-Left corner) */}
        <div className="absolute top-0 left-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black tracking-wider uppercase px-5 py-2 rounded-br-2xl shadow-md border-r border-b border-emerald-500/20 z-20">
          Card: {patient.card_number?.startsWith('TEMP-') ? 'No ID' : patient.card_number}
        </div>

        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-100 dark:bg-emerald-950/20 rounded-full blur-[100px] opacity-40 -mr-40 -mt-40"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-emerald-200 border-4 border-white">
            {(patient?.name?.charAt(0) || '?')}
          </div>
          
          {!isEditingProfile ? (
            <div className="flex-grow text-center md:text-left">
              <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap mb-1.5">
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{patient.name}</h2>
                <button onClick={startEditingProfile} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 rounded-lg text-xs font-black transition-all">
                  Edit Profile
                </button>
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                <span className="bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-800">
                  <CreditCard size={14} className="text-emerald-500" /> {patient.card_number?.startsWith('TEMP-') ? 'No ID' : `#${patient.card_number}`}
                </span>
                <span className="bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-800">
                  <Phone size={14} className="text-emerald-500" /> {patient.phone || 'No Phone'}
                </span>
                {patient.address && (
                  <span className="bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-800">
                    <span className="text-emerald-500">📍</span> {patient.address}
                  </span>
                )}
                {patient.blood_group && (
                  <span className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 border border-red-100 dark:border-red-900/30">
                    <span className="text-red-500">🩸</span> {patient.blood_group}
                  </span>
                )}
                {patient.gender && (
                  <span className="bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 border border-blue-100 dark:border-blue-900/30">
                    <span>👤</span> {patient.gender}
                  </span>
                )}
                {visits.length > 0 && (
                  <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 border border-emerald-100 dark:border-emerald-900/30">
                    <Stethoscope size={14} className="text-emerald-500" /> {
                      (() => {
                         const counts: any = {};
                         visits.forEach((v: any) => {
                           const name = v.doctor_name || 'NGO Doctor';
                           counts[name] = (counts[name] || 0) + 1;
                         });
                         return Object.entries(counts).sort((a: any, b: any) => b[1] - a[1])[0][0];
                       })()
                    }
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 w-full space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label htmlFor="edit-name" className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input id="edit-name" type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs text-slate-800 dark:text-slate-100 focus:border-emerald-500 transition-all" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-phone" className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                  <input id="edit-phone" type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs text-slate-800 dark:text-slate-100 focus:border-emerald-500 transition-all" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-age" className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Age</label>
                  <input id="edit-age" type="number" value={editAge} onChange={e => setEditAge(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs text-slate-800 dark:text-slate-100 focus:border-emerald-500 transition-all" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor="edit-address" className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Residential Address</label>
                  <input id="edit-address" type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs text-slate-800 dark:text-slate-100 focus:border-emerald-500 transition-all" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-blood-group" className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Blood Group</label>
                  <select id="edit-blood-group" value={editBloodGroup} onChange={e => setEditBloodGroup(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs text-slate-800 dark:text-slate-100 focus:border-emerald-500 transition-all cursor-pointer">
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-gender" className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                  <select id="edit-gender" value={editGender} onChange={e => setEditGender(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs text-slate-800 dark:text-slate-100 focus:border-emerald-500 transition-all cursor-pointer">
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setIsEditingProfile(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black transition-all">
                  Cancel
                </button>
                <button onClick={saveProfileChanges} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm">
                  Save Changes
                </button>
              </div>
            </div>
          )}

 
          <div className="flex gap-3">
            <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-center min-w-[80px]">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Visits</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{visits.length}</p>
            </div>
            <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-center min-w-[80px] flex flex-col items-center justify-center">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Age</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{patient.age || '—'}</p>
            </div>
          </div>
        </div>
      </div>
 
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Logging Form */}
        <div className="lg:col-span-8 space-y-4">
          


          <div className="glass-card dark:border-slate-800 p-5 rounded-2xl space-y-4 border-t-4 border-t-orange-500 shadow-xl shadow-emerald-900/5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">Visit Logs</h3>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Medical Prescription & Notes</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <Clock size={13} className="text-slate-400" />
                <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className="bg-transparent font-black text-xs text-slate-600 dark:text-slate-300 outline-none" />
              </div>
            </div>

            {/* Visit Details */}
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Attending Practitioner</label>
                <select 
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none font-bold text-slate-800 dark:text-slate-100 shadow-sm transition-all focus:border-orange-400 cursor-pointer text-sm"
                >
                  <option value="">(No specific doctor)</option>
                  <option value="Dr. Vibhuti Kori">Dr. Vibhuti Kori</option>
                  <option value="Dr. Rajdeep Sonkar">Dr. Rajdeep Sonkar</option>
                  <option value="Dr. Sameer Khan">Dr. Sameer Khan</option>
                  <option value="Dr. Ananya Pandey">Dr. Ananya Pandey</option>
                </select>
              </div>
            </div>

            {/* Prescription Builder */}
            <div className="space-y-3">
              {visits.length > 0 && visits[0].prescription_groups?.length > 0 && (
                <div className="flex justify-end mb-2">
                  <button type="button" onClick={repeatLastPrescription} className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors flex items-center gap-1.5 shadow-sm">
                    <RefreshCw size={12} /> Repeat Last Prescription
                  </button>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {medicineGroups.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveGroupIndex(idx)}
                      className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeGroupIndex === idx ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105' : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-800 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                      Combination {idx + 1}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  {medicineGroups.length > 1 && (
                    <button type="button" onClick={() => removeGroup(activeGroupIndex)} className="p-2 bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 rounded-xl hover:bg-red-500 dark:hover:bg-red-600 hover:text-white transition-all border border-red-100 dark:border-red-900/30 shadow-sm">
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button type="button" onClick={addGroup} className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 dark:text-emerald-400 rounded-xl hover:bg-emerald-500 dark:hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-4">
                
                {/* Combination Input Bar */}
                <div className="flex flex-col sm:flex-row flex-wrap lg:flex-nowrap items-stretch sm:items-center gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-2 shadow-sm relative" ref={searchRef}>
                  
                  {/* Power & Dosage Controls */}
                  <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <select value={medicineGroups[activeGroupIndex].power} onChange={e => {
                          const updated = [...medicineGroups];
                          updated[activeGroupIndex].power = e.target.value;
                          setMedicineGroups(updated);
                    }} className="w-full sm:w-24 px-2.5 py-2 bg-slate-50 sm:bg-transparent dark:bg-slate-900 sm:dark:bg-transparent border border-slate-200 sm:border-0 dark:border-slate-700 rounded-lg sm:rounded-none outline-none font-black text-slate-700 dark:text-slate-300 text-xs cursor-pointer">
                      <option value="">Power</option>
                      <option value="Q">Q</option>
                      <option value="3X">3X</option>
                      <option value="6X">6X</option>
                      <option value="30C">30C</option>
                      <option value="200C">200C</option>
                      <option value="1M">1M</option>
                      <option value="10M">10M</option>
                    </select>
                    
                    <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700 mx-0.5"></div>

                    <select value={medicineGroups[activeGroupIndex].dosage} onChange={e => {
                          const updated = [...medicineGroups];
                          updated[activeGroupIndex].dosage = e.target.value;
                          setMedicineGroups(updated);
                    }} className="w-full sm:w-28 px-2.5 py-2 bg-slate-50 sm:bg-transparent dark:bg-slate-900 sm:dark:bg-transparent border border-slate-200 sm:border-0 dark:border-slate-700 rounded-lg sm:rounded-none outline-none font-black text-slate-700 dark:text-slate-300 text-xs cursor-pointer">
                      {dosages.map(d => <option key={d.code} value={d.code}>{d.code}</option>)}
                    </select>
                  </div>

                  <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700 mx-0.5"></div>

                  {/* Code & Search Inputs */}
                  <div className="flex items-center gap-2 flex-1 w-full sm:w-auto min-w-0">
                    <input 
                      value={currentCode}
                      onChange={(e) => setCurrentCode(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddMedicine();
                        } else if (e.key === '+') {
                          e.preventDefault();
                          if (!currentCode.trim()) {
                            addGroup();
                          } else {
                            handleAddMedicine();
                          }
                        }
                      }}
                      placeholder="CODE"
                      className="w-20 sm:w-20 px-2 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 sm:border-0 dark:border-slate-700 rounded-xl outline-none uppercase font-black text-center text-xs text-slate-800 dark:text-slate-100 shrink-0"
                    />

                    <div className="flex-1 min-w-0 relative">
                      <input 
                        value={currentName}
                        onChange={(e) => {
                          setCurrentName(e.target.value);
                          setSearchQuery(e.target.value);
                          if (!e.target.value.trim()) {
                            setShowResults(false);
                          } else {
                            setShowResults(true);
                          }
                        }}
                        onFocus={() => {
                          if (currentName.trim() && !currentCode.trim()) {
                            setSearchQuery(currentName);
                            setShowResults(true);
                          }
                        }}
                        readOnly={!isNewMedicine && !!currentCode.trim()}
                        placeholder={isNewMedicine ? "New medicine..." : "Search..."}
                        className={`w-full px-3 py-2 outline-none font-black text-sm rounded-xl transition-all ${(!isNewMedicine && currentCode.trim()) ? 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300' : 'bg-transparent text-slate-800 dark:text-slate-100'}`}
                      />
                    </div>
                  </div>

                  {/* Search Autocomplete Results Dropdown */}
                  {showResults && searchResults.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                      {searchResults.map((res, i) => (
                        <button type="button" key={i} onClick={() => selectMedicine(res)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-left border-b border-slate-50 dark:border-slate-800 last:border-none">
                          <div>
                            <p className="font-black text-slate-800 dark:text-slate-100 text-sm">{res.name}</p>
                            <p className="text-[10px] font-black text-emerald-500 uppercase">{res.code}</p>
                          </div>
                          <Plus size={16} className="text-emerald-400" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quantity & Add Action */}
                  <div className="flex items-center gap-2 shrink-0 justify-end w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700/50">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest sm:hidden">Qty:</span>
                    <input type="number" min="1" value={currentQuantity} onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)} className="w-16 px-2 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none font-black text-center text-sm border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100" />
                    
                    <button type="button" onClick={handleAddMedicine} disabled={!currentCode.trim() || !currentName.trim()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-50 font-black flex items-center justify-center shrink-0 transition-all">
                      <Plus size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Selected in Combination {activeGroupIndex + 1}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {medicineGroups[activeGroupIndex].meds.length > 0 ? (
                      medicineGroups[activeGroupIndex].meds.map(med => (
                        <div key={med.code} className="flex items-center justify-between bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/50 px-4 py-2.5 rounded-xl shadow-sm group">
                          <div className="flex items-center gap-3">
                            <span className="font-black text-emerald-600 text-sm uppercase">{med.code}</span>
                            <div>
                               <p className="text-slate-800 dark:text-slate-100 text-xs font-black">{med.name}</p>
                               <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[9px] font-black px-2 py-0.5 rounded-lg">x{med.quantity}</span>
                            </div>
                          </div>
                          <button type="button" onClick={() => {
                              const updated = [...medicineGroups];
                              updated[activeGroupIndex].meds = updated[activeGroupIndex].meds.filter(m => m.code !== med.code);
                              setMedicineGroups(updated);
                          }} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
                        <p className="text-xs text-slate-300 dark:text-slate-600 font-bold italic">No medicines added yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
 
            <button 
              onClick={handleSaveVisit} 
              disabled={addingVisit} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black py-3 px-4 rounded-xl disabled:opacity-50 text-base tracking-tight flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/10 transition-all"
            >
              {addingVisit ? (
                <>
                  <Spinner size="sm" color="currentColor" />
                  <span>SYNCHRONIZING...</span>
                </>
              ) : (
                'SAVE PRESCRIPTION'
              )}
            </button>
          </div>
        </div>
             {/* Right Column: History & Details */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm max-h-[750px] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
                <FileText size={16} className="text-emerald-500" /> Clinical History
              </h4>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                {visits.length} Visits
              </span>
            </div>
            <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-5">
              {visits.length === 0 ? (
                <p className="text-xs text-slate-400 italic pl-2">No clinical history found.</p>
              ) : (
                visits.map((visit) => (
                  <div 
                    key={visit.id} 
                    onClick={() => setSelectedVisit(visit)} 
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedVisit(visit);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="relative group bg-slate-50/50 dark:bg-slate-900/45 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-white dark:hover:bg-slate-900 hover:shadow-lg hover:shadow-emerald-950/5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 space-y-2 cursor-pointer"
                  >
                    {/* Bullet dot connector */}
                    <div className="absolute left-[-23px] top-[18px] w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700 group-hover:bg-emerald-500 border-2 border-white dark:border-slate-950 transition-colors shadow-sm"></div>
                    
                    <div className="flex justify-between items-start flex-col sm:flex-row sm:items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800/60 pb-1.5">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                        {new Date(visit.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider truncate max-w-[120px] border border-emerald-100/50 dark:border-emerald-900/20">
                        {visit.doctor_name || 'NGO Doctor'}
                      </span>
                    </div>
                    {visit.notes && <p className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-2 leading-relaxed">{visit.notes}</p>}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {visit.prescription_groups?.map((group: any, gIdx: number) => 
                        group.group_medicines?.map((med: any, mIdx: number) => (
                          <span key={`${gIdx}-${mIdx}`} className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-700 shadow-sm">
                            {med.medicine_name || med.medicine_code}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Visit Details Modal */}
      {selectedVisit && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl rounded-t-[2rem] sm:rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-none sm:zoom-in-95 duration-300 dark:border dark:border-slate-800 max-h-[85vh] sm:max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-6 md:px-10 md:py-8 text-white relative shrink-0">
              <button 
                onClick={() => { setIsEditingVisit(false); setSelectedVisit(null); }} 
                className="absolute top-5 right-5 p-2 bg-white/20 hover:bg-white/45 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl"><Calendar size={28} /></div>
                <div>
                   <h3 className="text-2xl md:text-3xl font-black tracking-tight">{new Date(selectedVisit.date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                   <p className="text-emerald-100 font-bold uppercase tracking-widest text-[10px] md:text-xs">{new Date(selectedVisit.date).toLocaleDateString('en-US', { weekday: 'long' })}</p>
                </div>
              </div>
            </div>

            {!isEditingVisit ? (
              <>
                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 custom-scrollbar dark:text-slate-100">
                  {/* Doctor & Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-950/40 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Attending Doctor</p>
                       <p className="text-base font-black text-slate-800 dark:text-slate-100">{selectedVisit.doctor_name || 'NGO Clinic Doctor'}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Observations</p>
                       <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed">{selectedVisit.notes || 'Routine follow-up visit.'}</p>
                    </div>
                  </div>

                  {/* Prescription Section */}
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Prescribed Medicines</h4>
                    <div className="space-y-4">
                      {selectedVisit.prescription_groups?.map((group: any, idx: number) => (
                        <div key={idx} className="bg-slate-50 dark:bg-slate-950/60 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 flex flex-col gap-4">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                               <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-400"></span>
                               <span className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Combination {idx + 1}</span>
                            </div>
                            <span className="bg-emerald-600 text-white text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest">{group.dosage_code}</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            {group.group_medicines?.map((med: any, mIdx: number) => (
                              <div key={mIdx} className="bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-700 dark:text-slate-300 shadow-sm">
                                {med.medicine_name || med.medicine_code}
                              </div>
                            ))}
                          </div>

                          {group.power && (
                            <div className="flex items-center gap-2 mt-1 border-t border-slate-100 dark:border-slate-900 pt-2">
                              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Potency:</span>
                              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{group.power}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sticky Footer */}
                <div className="p-6 md:p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0 flex flex-col sm:flex-row gap-3">
                   <button onClick={() => window.print()} className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-950/10">
                     <Printer size={18} /> PRINT / SAVE AS PDF
                   </button>
                   <div className="flex gap-2.5">
                     <button onClick={startEditingVisit} className="flex-1 sm:flex-none px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl transition-all shadow-sm">
                       EDIT
                     </button>
                     <button onClick={() => { setIsEditingVisit(false); setSelectedVisit(null); }} className="flex-1 sm:flex-none px-6 py-3.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white font-black rounded-xl transition-all">
                       CLOSE
                     </button>
                   </div>
                </div>
              </>
            ) : (
              <>
                {/* Edit Mode Body */}
                <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 custom-scrollbar dark:text-slate-100">
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2">Edit Visit Details</h3>
                  
                  {/* Date & Doctor Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Visit Date</label>
                      <input 
                        type="date" 
                        value={editVisitDate} 
                        onChange={e => setEditVisitDate(e.target.value)} 
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-bold text-sm focus:border-emerald-500 dark:focus:border-emerald-500 transition-all text-slate-800 dark:text-slate-100" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Attending Doctor</label>
                      <select 
                        value={editVisitDoctor}
                        onChange={(e) => setEditVisitDoctor(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-bold text-sm focus:border-emerald-500 dark:focus:border-emerald-500 transition-all cursor-pointer text-slate-800 dark:text-slate-100"
                      >
                        <option value="">(No specific doctor)</option>
                        <option value="Dr. Vibhuti Kori">Dr. Vibhuti Kori</option>
                        <option value="Dr. Rajdeep Sonkar">Dr. Rajdeep Sonkar</option>
                        <option value="Dr. Sameer Khan">Dr. Sameer Khan</option>
                        <option value="Dr. Ananya Pandey">Dr. Ananya Pandey</option>
                      </select>
                    </div>
                  </div>

                  {/* Observations Notes */}
                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Observations / Notes</label>
                    <textarea 
                      value={editVisitNotes} 
                      onChange={e => setEditVisitNotes(e.target.value)} 
                      rows={2}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-bold text-sm focus:border-emerald-500 dark:focus:border-emerald-500 transition-all resize-none text-slate-800 dark:text-slate-100"
                      placeholder="Add observations..."
                    />
                  </div>

                  {/* Edit Prescribed Medicines Combinations */}
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {editVisitMeds.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setEditActiveGroupIndex(idx)}
                            className={`px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${editActiveGroupIndex === idx ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
                          >
                            Combination {idx + 1}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        {editVisitMeds.length > 1 && (
                          <button type="button" onClick={() => removeEditGroup(editActiveGroupIndex)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-500 dark:hover:bg-red-600 hover:text-white transition-all">
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button type="button" onClick={addEditGroup} className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 dark:text-emerald-400 rounded-lg hover:bg-emerald-500 dark:hover:bg-emerald-600 hover:text-white transition-all">
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Active combination edits */}
                    {editVisitMeds[editActiveGroupIndex] && (
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase ml-1">Potency (Power)</label>
                            <input 
                              type="text" 
                              placeholder="e.g. 30, 200, Q"
                              value={editVisitMeds[editActiveGroupIndex].power} 
                              onChange={e => {
                                const updated = [...editVisitMeds];
                                updated[editActiveGroupIndex].power = e.target.value;
                                setEditVisitMeds(updated);
                              }}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none font-bold text-xs text-slate-800 dark:text-slate-100" 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase ml-1">Dosage Frequency</label>
                            <select 
                              value={editVisitMeds[editActiveGroupIndex].dosage} 
                              onChange={e => {
                                const updated = [...editVisitMeds];
                                updated[editActiveGroupIndex].dosage = e.target.value;
                                setEditVisitMeds(updated);
                              }}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none font-bold text-xs cursor-pointer text-slate-800 dark:text-slate-100"
                            >
                              {dosages.map((d: any) => (
                                <option key={d.code} value={d.code}>{d.code} ({d.meaning})</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Medicine Autocomplete search for edit mode */}
                        <div className="space-y-2 relative" ref={editSearchRef}>
                          <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase ml-1">Search & Add Medicines</label>
                          <input 
                            type="text" 
                            placeholder="Type medicine name to search..."
                            value={editSearchQuery}
                            onChange={e => {
                               setEditSearchQuery(e.target.value);
                               setShowEditResults(true);
                            }}
                            onFocus={() => setShowEditResults(true)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none font-bold text-xs text-slate-800 dark:text-slate-100"
                          />
                          {showEditResults && editSearchResults.length > 0 && (
                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                              {editSearchResults.map((med) => (
                                <button
                                  key={med.code}
                                  type="button"
                                  onClick={() => addMedToEditGroup(med)}
                                  className="w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 last:border-0 flex justify-between items-center"
                                >
                                  <span>{med.name}</span>
                                  <span className="text-xs text-emerald-500 uppercase font-black">{med.code}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Selected medicines list in editing group */}
                        <div className="space-y-2">
                          <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase ml-1">Selected Medicines</label>
                          {editVisitMeds[editActiveGroupIndex].meds.length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-slate-500 italic ml-1">No medicines added to this combination yet.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {editVisitMeds[editActiveGroupIndex].meds.map((med) => (
                                <span key={med.code} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-800 flex items-center gap-2 shadow-sm">
                                  {med.name || med.code}
                                  <button 
                                    type="button" 
                                    onClick={() => removeMedFromEditGroup(med.code)}
                                    className="text-red-500 hover:text-red-700 transition-all font-black text-base px-1 ml-1"
                                    aria-label={`Remove ${med.name || med.code}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sticky Edit Footer */}
                <div className="p-6 md:p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 shrink-0 flex justify-end gap-3">
                   <button onClick={() => setIsEditingVisit(false)} className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl transition-all text-sm">
                     CANCEL
                   </button>
                   <button onClick={saveVisitChanges} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all shadow-md text-sm">
                     SAVE CHANGES
                   </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Hidden Printable Prescription (Only visible during print) */}
      {selectedVisit && (
        <div className="printable-prescription hidden">
          {/* Letterhead */}
          <div className="text-center pb-6 border-b-2 border-emerald-800 mb-6">
            <h1 className="text-4xl font-black text-emerald-800 tracking-tighter uppercase">Nek Kadam</h1>
            <p className="text-lg font-bold text-slate-600 tracking-widest mt-1">A Free Homeopathic Clinic & NGO</p>
            <p className="text-xs font-bold text-slate-500 mt-2">Serve the humanity with love and care.</p>
          </div>

          {/* Patient Details */}
          <div className="flex justify-between items-end mb-8">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Patient Details</p>
              <h2 className="text-2xl font-black text-slate-800">{patient?.name}</h2>
              <p className="text-sm font-bold text-slate-600">Card No: {patient?.card_number?.startsWith('TEMP-') ? 'N/A' : patient?.card_number} | Age/Sex: {patient?.age || '-'} / {patient?.gender || 'Not specified'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-black uppercase text-slate-400">Visit Info</p>
              <p className="text-lg font-black text-slate-800">{new Date(selectedVisit.date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="text-sm font-bold text-slate-600">Dr. {selectedVisit.doctor_name || 'Nek Kadam NGO'}</p>
            </div>
          </div>

          {/* Vitals & Notes */}
          <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Clinical Observations</p>
            <p className="text-base font-bold text-slate-800 whitespace-pre-wrap">{selectedVisit.notes || 'Routine checkup.'}</p>
          </div>

          {/* Prescription */}
          <div className="space-y-6">
            <h3 className="text-lg font-black text-slate-800 uppercase border-b border-slate-200 pb-2 flex items-center gap-2">
              <span className="text-3xl font-black text-emerald-600">Rx</span> Prescribed Medicines
            </h3>
            
            <div className="space-y-4">
              {selectedVisit.prescription_groups?.map((group: any, idx: number) => (
                <div key={idx} className="flex gap-4 border border-slate-200 rounded-2xl p-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center font-black text-emerald-700 text-xl shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {group.group_medicines?.map((med: any, mIdx: number) => (
                        <div key={mIdx} className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-sm font-black text-slate-800">
                          {med.medicine_name || med.medicine_code}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-6 text-sm font-bold text-slate-600 border-t border-slate-100 pt-2">
                      <p><span className="text-xs font-black uppercase text-slate-400 mr-2">Power:</span> {group.power || 'N/A'}</p>
                      <p><span className="text-xs font-black uppercase text-slate-400 mr-2">Dosage:</span> {group.dosage_code}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-400">
            <p>Generated by Nek Kadam Clinic System</p>
            <p>Signature: _______________________</p>
          </div>
        </div>
      )}
    </div>
  );
}


