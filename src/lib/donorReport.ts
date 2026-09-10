import * as XLSX from 'xlsx';
import { db } from './db';

/**
 * Generates and downloads a 3-sheet donor-ready Excel workbook:
 * 1. Camp Summary (Executive stats, demographics)
 * 2. Diagnosis & Symptoms (Condition frequency)
 * 3. Pharmacy Stock Consumption (Medicines & quantities dispensed)
 */
export async function generateDonorReport(): Promise<void> {
  try {
    const { data: patientsData } = await db.from('patients').select('*');
    const { data: visitsData } = await db.from('visits').select('*');
    const { data: medicinesData } = await db.from('medicines').select('*');
    const { data: groupMedsData } = await db.from('group_medicines').select('*');

    const patients = patientsData || [];
    const visits = visitsData || [];
    const medicines = medicinesData || [];
    const groupMeds = groupMedsData || [];

    const medsMap = new Map<string, string>();
    medicines.forEach((m: any) => medsMap.set(m.code, m.name));

    const wb = XLSX.utils.book_new();

    // ─── Sheet 1: Camp Summary ───
    const totalPatients = patients.length;
    const maleCount = patients.filter((p: any) => {
      const g = String(p.gender || '').toLowerCase();
      return g === 'm' || g === 'male';
    }).length;
    const femaleCount = patients.filter((p: any) => {
      const g = String(p.gender || '').toLowerCase();
      return g === 'f' || g === 'female';
    }).length;
    const pediatricCount = patients.filter((p: any) => Number(p.age || 0) > 0 && Number(p.age || 0) < 18).length;
    const adultCount = patients.filter((p: any) => Number(p.age || 0) >= 18 && Number(p.age || 0) < 60).length;
    const geriatricCount = patients.filter((p: any) => Number(p.age || 0) >= 60).length;
    const totalVisits = visits.length;

    const summaryRows = [
      ['NEK KADAM MEDICAL CAMP - EXECUTIVE DONOR REPORT'],
      ['Generated At', new Date().toISOString()],
      ['System', 'Nek Kadam Clinical Management System'],
      [''],
      ['Metric', 'Count', 'Percentage'],
      ['Total Patients Registered', totalPatients, '100%'],
      ['Total Consultations / Visits Recorded', totalVisits, '—'],
      [''],
      ['Demographics Breakdown', 'Count', 'Percentage'],
      ['Male Patients', maleCount, totalPatients ? `${Math.round((maleCount / totalPatients) * 100)}%` : '0%'],
      ['Female Patients', femaleCount, totalPatients ? `${Math.round((femaleCount / totalPatients) * 100)}%` : '0%'],
      ['Pediatric (<18 yrs)', pediatricCount, totalPatients ? `${Math.round((pediatricCount / totalPatients) * 100)}%` : '0%'],
      ['Adults (18-59 yrs)', adultCount, totalPatients ? `${Math.round((adultCount / totalPatients) * 100)}%` : '0%'],
      ['Geriatric (60+ yrs)', geriatricCount, totalPatients ? `${Math.round((geriatricCount / totalPatients) * 100)}%` : '0%'],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Camp Summary');

    // ─── Sheet 2: Diagnosis & Symptoms ───
    const diagnosisCounts = new Map<string, number>();
    visits.forEach((v: any) => {
      const condition = v.notes ? v.notes.trim() : 'Routine Consultation';
      diagnosisCounts.set(condition, (diagnosisCounts.get(condition) || 0) + 1);
    });

    const diagnosisRows: any[][] = [
      ['Diagnosis / Symptom Category', 'Patient Count', 'Percentage of Total Visits'],
    ];
    const visitDivisor = totalVisits || 1;
    Array.from(diagnosisCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([diag, count]) => {
        diagnosisRows.push([diag, count, `${Math.round((count / visitDivisor) * 100)}%`]);
      });
    const wsDiagnosis = XLSX.utils.aoa_to_sheet(diagnosisRows);
    XLSX.utils.book_append_sheet(wb, wsDiagnosis, 'Diagnosis & Symptoms');

    // ─── Sheet 3: Pharmacy Stock Consumption ───
    const consumptionMap = new Map<string, { name: string; qty: number }>();
    groupMeds.forEach((gm: any) => {
      const code = gm.medicine_code || gm.medicineCode || '';
      if (!code) return;
      const name = medsMap.get(code) || gm.medicine_name || gm.medicineName || code;
      const existing = consumptionMap.get(code) || { name, qty: 0 };
      existing.qty += 1;
      consumptionMap.set(code, existing);
    });

    const pharmacyRows: any[][] = [
      ['Medicine Code', 'Medicine Description', 'Total Quantity Dispensed'],
    ];
    Array.from(consumptionMap.entries())
      .sort((a, b) => b[1].qty - a[1].qty)
      .forEach(([code, { name, qty }]) => {
        pharmacyRows.push([code, name, qty]);
      });
    const wsPharmacy = XLSX.utils.aoa_to_sheet(pharmacyRows);
    XLSX.utils.book_append_sheet(wb, wsPharmacy, 'Pharmacy Stock Consumption');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Nek_Kadam_Donor_Report_${dateStr}.xlsx`);
  } catch (err: any) {
    console.error('[DONOR REPORT EXPORT ERROR]', err);
    throw err;
  }
}
