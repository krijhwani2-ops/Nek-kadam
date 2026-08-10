import { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'hi';
type Theme = 'light' | 'dark';

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  toggleTheme: () => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    dashboard: "Dashboard",
    patients: "Patients",
    medicines: "Medicines",
    pharmacyQueue: "Pharmacy Queue",
    educationSystem: "Education System",
    chatDesk: "Chat Desk",
    settings: "Settings",
    logout: "Logout",
    welcome: "Welcome Back",
    attendance: "Attendance",
    registerPatient: "Register Patient",
    medicinesDb: "Medicines DB",
    handoverDesk: "Handover Desk",
    tools: "Tools",
    dataImport: "Data Import",
    offlineMode: "Offline Mode",
    serverOnline: "Server Online",
    switchUser: "Switch User",
    home: "Home",
    new: "New",
    pharmacy: "Pharmacy",
    chat: "Chat",
    
    // Dashboard / Global
    totalPatients: "Total Patients",
    activeVisits: "Active Visits",
    availableMeds: "Available Medicines",
    pendingTasks: "Pending Pharmacy Tasks",
    searchPatientPlaceholder: "Search patient by name or card number...",
    recentVisits: "Recent Visits",
    quickActions: "Quick Actions",
    
    // Patient Form & Profile
    fullName: "Full Name",
    phoneNumber: "Phone Number",
    age: "Age",
    gender: "Gender",
    address: "Residential Address",
    bloodGroup: "Blood Group",
    saveChanges: "Save Changes",
    cancel: "Cancel",
    editProfile: "Edit Profile",
    clinicalTimeline: "Clinical Timeline",
    attendingDoctor: "Attending Doctor",
    observations: "Observations",
    prescribedMeds: "Prescribed Medicines",
    power: "Power",
    dosage: "Dosage",
    printPrescription: "Print / Save as PDF",
    close: "Close",
    
    // Theme / Language settings
    languageSettings: "Language Settings",
    appLanguage: "Application Language",
    themeSettings: "Theme Settings",
    darkMode: "Dark Mode",
    lightMode: "Light Mode",
    serverConfig: "Server Configuration",
    userManagement: "User Management"
  },
  hi: {
    // Navigation
    dashboard: "डैशबोर्ड",
    patients: "मरीज़ सूची",
    medicines: "दवाइयाँ",
    pharmacyQueue: "दवा वितरण कतार",
    educationSystem: "शिक्षा प्रणाली",
    chatDesk: "चैट डेस्क",
    settings: "सेटिंग्स",
    logout: "लॉगआउट",
    welcome: "आपका स्वागत है",
    attendance: "उपस्थिति",
    registerPatient: "मरीज़ पंजीकरण",
    medicinesDb: "दवा सूची",
    handoverDesk: "दवा वितरण डेस्क",
    tools: "उपकरण",
    dataImport: "डेटा आयात",
    offlineMode: "ऑफलाइन मोड",
    serverOnline: "सर्वर ऑनलाइन",
    switchUser: "लॉगआउट",
    home: "मुख्य पृष्ठ",
    new: "नया",
    pharmacy: "फार्मेसी",
    chat: "चैट",
    
    // Dashboard / Global
    totalPatients: "कुल मरीज़",
    activeVisits: "कुल विज़िट",
    availableMeds: "उपलब्ध दवाइयाँ",
    pendingTasks: "लंबित दवा वितरण कार्य",
    searchPatientPlaceholder: "नाम या कार्ड नंबर से मरीज़ खोजें...",
    recentVisits: "हालिया विज़िट",
    quickActions: "त्वरित कार्रवाई",
    
    // Patient Form & Profile
    fullName: "पूरा नाम",
    phoneNumber: "फ़ोन नंबर",
    age: "उम्र",
    gender: "लिंग",
    address: "घर का पता",
    bloodGroup: "रक्त समूह",
    saveChanges: "बदलाव सहेजें",
    cancel: "रद्द करें",
    editProfile: "प्रोफ़ाइल संपादित करें",
    clinicalTimeline: "विज़िट इतिहास",
    attendingDoctor: "चिकित्सक",
    observations: "परीक्षण / नोट्स",
    prescribedMeds: "लिखी गई दवाइयाँ",
    power: "पोटेंसी (पावर)",
    dosage: "खुराक",
    printPrescription: "प्रिस्क्रिप्शन प्रिंट / PDF सहेजें",
    close: "बंद करें",
    
    // Theme / Language settings
    languageSettings: "भाषा सेटिंग्स",
    appLanguage: "एप्लिकेशन की भाषा",
    themeSettings: "थीम सेटिंग्स",
    darkMode: "डार्क मोड",
    lightMode: "लाइट मोड",
    serverConfig: "सर्वर कॉन्फ़िगरेशन",
    userManagement: "उपयोगकर्ता प्रबंधन"
  }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLangState] = useState<Language>(() => {
    return (localStorage.getItem('nk_lang') as Language) || 'en';
  });
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('nk_theme') as Theme) || 'light';
  });

  useEffect(() => {
    localStorage.setItem('nk_lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('nk_theme', theme);
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const setLanguage = (lang: Language) => setLangState(lang);
  const toggleTheme = () => setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  const t = (key: string): string => {
    return translations[language][key] || translations['en'][key] || key;
  };

  return (
    <AppContext.Provider value={{ language, setLanguage, theme, toggleTheme, t }}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
