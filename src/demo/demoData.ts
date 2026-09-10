export interface DemoPatient {
  cardNumber: string;
  name: string;
  age: number | string;
  gender: string;
  phone: string;
  address: string;
  doctorName: string;
  lastVisitDate: string;
  chronicCondition?: string;
  lastPrescription?: string;
  recentVisitsCount: number;
}

export interface DemoToken {
  id: string;
  tokenNumber: number;
  patientName: string;
  cardNumber: string;
  department: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED';
  priority: 'NORMAL' | 'URGENT';
  waitTimeMinutes: number;
  doctorAssigned: string;
}

export interface DemoPharmacyTask {
  id: string;
  tokenNumber: number;
  patientName: string;
  cardNumber: string;
  doctorName: string;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED';
  claimedBy?: string;
  timeAgo: string;
  bottlesCount: number;
  medicines: {
    groupPower: string;
    dosage: string;
    names: string[];
  }[];
}

export const INITIAL_DEMO_PATIENTS: DemoPatient[] = [
  {
    cardNumber: '10674',
    name: 'JEEVIKA BODHWANI',
    age: 9,
    gender: 'Female',
    phone: '9827400000',
    address: 'MES Colony, Jabalpur',
    doctorName: 'Dr. Rajdeep',
    lastVisitDate: '2026-08-23',
    chronicCondition: 'Pediatric Asthma & Allergies',
    lastPrescription: 'BRYONIA+ HEPAR SULPH+ ACONITE 200(BD) / RT+ DULCO+ PULSA 200(BD)',
    recentVisitsCount: 3,
  },
  {
    cardNumber: '10668',
    name: 'SANGEETA GANGWANI',
    age: 40,
    gender: 'Female',
    phone: '8234097780',
    address: 'Hospital Line',
    doctorName: 'Dr. Rajdeep',
    lastVisitDate: '2026-08-23',
    chronicCondition: 'Seasonal viral & cephalalgia',
    lastPrescription: 'EUP PERF+ IPECOC+ RT 200(BD) / BRYONIA+ GEL+ CHINA OFF 200(BD)',
    recentVisitsCount: 4,
  },
  {
    cardNumber: '10667',
    name: 'BASHANT VALECHA',
    age: 53,
    gender: 'Male',
    phone: '9827432175',
    address: 'Madhav Nagar',
    doctorName: 'Dr. Rajdeep',
    lastVisitDate: '2026-08-23',
    chronicCondition: 'Urticaria & Acid Reflux',
    lastPrescription: 'APIS+ MERSOL+ DOLICHUS 200(BD) / ACID SULPH+ CV+ LYCO 200(BD) / CANTHERIS +NV 200(HS)',
    recentVisitsCount: 6,
  },
  {
    cardNumber: '8739',
    name: 'KAJAL SACHDEV',
    age: 53,
    gender: 'Female',
    phone: '9981693116',
    address: 'Vedic Colony',
    doctorName: 'Dr. Vibhuti',
    lastVisitDate: '2026-08-16',
    chronicCondition: 'Cervical Spondylosis',
    lastPrescription: 'ARNICA 200(BD) / BELLA+COLO 30(TDS)',
    recentVisitsCount: 8,
  },
  {
    cardNumber: '5896',
    name: 'REETA HOTWANI',
    age: 48,
    gender: 'Female',
    phone: '9425167890',
    address: 'Sindhi Camp',
    doctorName: 'Dr. Rajdeep',
    lastVisitDate: '2026-08-09',
    chronicCondition: 'Severe Arthralgia & Rhinitis',
    lastPrescription: 'HYPERICUM+RT +MP 200(BD)/BACILINUM 1M(HS) / ALLIUM CEPA+HEPAR SULPH+HISTA 200(BD)',
    recentVisitsCount: 14,
  },
  {
    cardNumber: '8699',
    name: 'KRISHNA LALWANI',
    age: 18,
    gender: 'Male',
    phone: '9926759401',
    address: 'Samdariya Colony',
    doctorName: 'Dr. Vibhuti',
    lastVisitDate: '2026-08-02',
    chronicCondition: 'Alopecia & Immunity',
    lastPrescription: 'WIESBERDEN 200(BD) / HS 30(OD) / ECHINACEA Q(TDS)',
    recentVisitsCount: 2,
  },
];

export const INITIAL_DEMO_TOKENS: DemoToken[] = [
  {
    id: 'TOK-101',
    tokenNumber: 42,
    patientName: 'JEEVIKA BODHWANI',
    cardNumber: '10674',
    department: 'Homeo OP Room 1',
    status: 'IN_PROGRESS',
    priority: 'URGENT',
    waitTimeMinutes: 4,
    doctorAssigned: 'Dr. Rajdeep',
  },
  {
    id: 'TOK-102',
    tokenNumber: 43,
    patientName: 'SANGEETA GANGWANI',
    cardNumber: '10668',
    department: 'Homeo OP Room 1',
    status: 'WAITING',
    priority: 'NORMAL',
    waitTimeMinutes: 12,
    doctorAssigned: 'Dr. Rajdeep',
  },
  {
    id: 'TOK-103',
    tokenNumber: 44,
    patientName: 'BASHANT VALECHA',
    cardNumber: '10667',
    department: 'Homeo OP Room 1',
    status: 'WAITING',
    priority: 'NORMAL',
    waitTimeMinutes: 18,
    doctorAssigned: 'Dr. Rajdeep',
  },
  {
    id: 'TOK-104',
    tokenNumber: 28,
    patientName: 'KAJAL SACHDEV',
    cardNumber: '8739',
    department: 'Homeo OP Room 2',
    status: 'WAITING',
    priority: 'NORMAL',
    waitTimeMinutes: 9,
    doctorAssigned: 'Dr. Vibhuti',
  },
  {
    id: 'TOK-105',
    tokenNumber: 27,
    patientName: 'REETA HOTWANI',
    cardNumber: '5896',
    department: 'Homeo OP Room 2',
    status: 'DONE',
    priority: 'NORMAL',
    waitTimeMinutes: 24,
    doctorAssigned: 'Dr. Vibhuti',
  },
];

export const INITIAL_DEMO_TASKS: DemoPharmacyTask[] = [
  {
    id: 'TASK-501',
    tokenNumber: 42,
    patientName: 'JEEVIKA BODHWANI',
    cardNumber: '10674',
    doctorName: 'Dr. Rajdeep',
    status: 'PREPARING',
    claimedBy: 'Rahul V. (Pharmacist)',
    timeAgo: '3 min ago',
    bottlesCount: 2,
    medicines: [
      {
        groupPower: '200',
        dosage: 'BD (Twice daily)',
        names: ['BRYONIA', 'HEPAR SULPH', 'ACONITE'],
      },
      {
        groupPower: '200',
        dosage: 'BD (Twice daily)',
        names: ['RHUS TOX (RT)', 'DULCAMARA', 'PULSATILLA'],
      },
    ],
  },
  {
    id: 'TASK-502',
    tokenNumber: 40,
    patientName: 'BASHANT VALECHA',
    cardNumber: '10667',
    doctorName: 'Dr. Rajdeep',
    status: 'PENDING',
    timeAgo: '7 min ago',
    bottlesCount: 3,
    medicines: [
      {
        groupPower: '200',
        dosage: 'BD (Morning & Night)',
        names: ['APIS MELLIFICA', 'MERC SOL', 'DOLICHUS'],
      },
      {
        groupPower: '200',
        dosage: 'BD (Twice daily)',
        names: ['ACID SULPH', 'CARBO VEG (CV)', 'LYCOPODIUM'],
      },
      {
        groupPower: '200',
        dosage: 'HS (Bedtime only)',
        names: ['CANTHARIS', 'NUX VOMICA (NV)'],
      },
    ],
  },
  {
    id: 'TASK-503',
    tokenNumber: 38,
    patientName: 'REETA HOTWANI',
    cardNumber: '5896',
    doctorName: 'Dr. Vibhuti',
    status: 'READY',
    claimedBy: 'Pooja K. (Pharmacist)',
    timeAgo: '14 min ago',
    bottlesCount: 2,
    medicines: [
      {
        groupPower: '200',
        dosage: 'BD',
        names: ['HYPERICUM', 'RHUS TOX', 'MAG PHOS'],
      },
      {
        groupPower: '1M',
        dosage: 'HS (Bedtime Single Pill)',
        names: ['BACILLINUM 1M'],
      },
    ],
  },
];

export const DEMO_HOMEOPATHIC_MEDICINES = [
  'ACONITUM NAPELLUS',
  'ARNICA MONTANA',
  'ALLIUM CEPA',
  'APIS MELLIFICA',
  'ARSENICUM ALBUM',
  'BELLADONNA',
  'BRYONIA ALBA',
  'CALCAREA CARBONICA',
  'CARBO VEGETABILIS',
  'CAUSTICUM',
  'CHAMOMILLA',
  'CHINA OFFICINALIS',
  'DULCAMARA',
  'ECHINACEA ANGUSTIFOLIA',
  'EUPATORIUM PERFOLIATUM',
  'GELSEMIUM',
  'HEPAR SULPHURIS',
  'HYPERICUM PERFORATUM',
  'IGNATIA AMARA',
  'IPECACUANHA',
  'KALI BICHROMICUM',
  'LEDUM PALUSTRE',
  'LYCOPODIUM CLAVATUM',
  'MAGNESIA PHOSPHORICA',
  'MERCURIUS SOLUBILIS',
  'NATRUM MURIATICUM',
  'NUX VOMICA',
  'PHOSPHORUS',
  'PHYTOLACCA DECANDRA',
  'PULSATILLA NIGRICANS',
  'RHUS TOXICODENDRON',
  'RUTA GRAVEOLENS',
  'SEPIA OFFICINALIS',
  'SILICEA',
  'SULPHUR',
  'THUJA OCCIDENTALIS',
];

export const COMMON_HOMEO_MEDS = DEMO_HOMEOPATHIC_MEDICINES;
export const INITIAL_DEMO_PHARMACY_TASKS = INITIAL_DEMO_TASKS;

