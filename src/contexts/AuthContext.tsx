import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { getBaseUrl, setStoredSession, NKSession as StoredNKSession } from '../lib/session';

export interface NKSession {
  userId: string;
  userName: string;
  department: string;
  role: string;
  loginTime: string;
}

interface AuthContextType {
  session: NKSession | null;
  loading: boolean;
  isLoggedIn: boolean;
  login: (user: { id: string; name: string; department: string; role?: string }, token?: string) => void;
  logout: () => void;
  updatePresence: (screen: string, status: string, taskId?: string, patientName?: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: false,
  isLoggedIn: false,
  login: () => {},
  logout: () => {},
  updatePresence: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<NKSession | null>(() => {
    try {
      const stored = localStorage.getItem('nk_current_user');
      const token = localStorage.getItem('nk_token');
      if (token && token !== 'null' && token !== 'undefined' && stored) {
        return JSON.parse(stored);
      }
    } catch (_) {}
    return null;
  });
  const [loading, setLoading] = useState(false);

  // Presence Tracking States
  const [currentScreen, setCurrentScreen] = useState('Dashboard');
  const [currentStatus, setCurrentStatus] = useState('ONLINE');
  const [currentTaskId, setCurrentTaskId] = useState<string | undefined>(undefined);
  const [currentPatientName, setCurrentPatientName] = useState<string | undefined>(undefined);

  // Refs for heartbeat loop to always send latest state values
  const screenRef = useRef(currentScreen);
  const statusRef = useRef(currentStatus);
  const taskIdRef = useRef(currentTaskId);
  const patientRef = useRef(currentPatientName);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    screenRef.current = currentScreen;
  }, [currentScreen]);

  useEffect(() => {
    statusRef.current = currentStatus;
  }, [currentStatus]);

  useEffect(() => {
    taskIdRef.current = currentTaskId;
  }, [currentTaskId]);

  useEffect(() => {
    patientRef.current = currentPatientName;
  }, [currentPatientName]);

  const updatePresence = useCallback((screen: string, status: string, taskId?: string, patientName?: string) => {
    setCurrentScreen(screen);
    setCurrentStatus(status);
    setCurrentTaskId(taskId);
    setCurrentPatientName(patientName);
    
    // Proactively send heartbeat on state transitions
    if (session) {
      void sendHeartbeat(session, screen, status, taskId, patientName);
    }
  }, [session]);

  const sendHeartbeat = async (
    currentSession: NKSession,
    scr: string,
    stat: string,
    tId?: string,
    pName?: string
  ) => {
    try {
      await fetch(`${getBaseUrl()}/api/presence/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}`
        },
        body: JSON.stringify({
          userId: currentSession.userId,
          userName: currentSession.userName,
          department: currentSession.department,
          currentScreen: scr,
          currentTaskId: tId || null,
          currentPatientName: pName || null,
          currentStatus: stat,
          deviceId: 'local-device'
        })
      });
    } catch (e) {
      console.warn('[HEARTBEAT] Connection failed:', e);
    }
  };

  // On mount: check for existing local profile and sync with IndexedDB
  useEffect(() => {
    const stored = localStorage.getItem('nk_current_user');
    const token = localStorage.getItem('nk_token');
    
    // Self-healing check for invalid stuck tokens
    if (token === 'null' || token === 'undefined' || !token) {
      localStorage.removeItem('nk_current_user');
      localStorage.removeItem('nk_token');
      setSession(null);
      void setStoredSession(null);
      setLoading(false);
      return;
    }

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSession(parsed);
        const storedSession: StoredNKSession = {
          sessionId: token,
          userId: parsed.userId,
          userName: parsed.userName,
          department: parsed.department || 'Medical',
          role: parsed.role || 'Volunteer',
          loginTime: parsed.loginTime || new Date().toISOString(),
          lastSyncTime: null
        };
        void setStoredSession(storedSession);
      } catch (e) {
        localStorage.removeItem('nk_current_user');
        localStorage.removeItem('nk_token');
        void setStoredSession(null);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback((user: { id: string; name: string; department: string; role?: string }, token?: string) => {
    const dept = user.department || (user as any).deptCode || 'Medical';
    const sessionData: NKSession = {
      userId: user.id,
      userName: user.name,
      department: dept,
      role: user.role || 'Volunteer',
      loginTime: new Date().toISOString()
    };
    localStorage.setItem('nk_current_user', JSON.stringify(sessionData));
    if (token) {
      localStorage.setItem('nk_token', token);
      const storedSession: StoredNKSession = {
        sessionId: token,
        userId: user.id,
        userName: user.name,
        department: dept,
        role: user.role || 'Volunteer',
        loginTime: sessionData.loginTime,
        lastSyncTime: null
      };
      void setStoredSession(storedSession);
    }
    setSession(sessionData);
    
    // Trigger immediate presence update
    void sendHeartbeat(sessionData, 'Dashboard', 'ONLINE');
  }, []);

  const logout = useCallback(() => {
    if (session) {
      // Send offline presence update before clearing
      void sendHeartbeat(session, 'Offline', 'OFFLINE');
    }
    localStorage.removeItem('nk_current_user');
    localStorage.removeItem('nk_token');
    setSession(null);
    void setStoredSession(null);
  }, [session]);

  // Activity interaction listeners and heartbeat loop
  useEffect(() => {
    if (!session) return;

    // 1. Interactions
    const resetActivity = () => {
      lastActivityRef.current = Date.now();
      if (statusRef.current === 'IDLE') {
        const prevScreen = screenRef.current;
        const prevTaskId = taskIdRef.current;
        const prevPatient = patientRef.current;
        
        // Return back to ONLINE or WORKING based on presence
        const nextStatus = (prevScreen.includes('Queue') || prevScreen.includes('Profile')) ? 'WORKING' : 'ONLINE';
        updatePresence(prevScreen, nextStatus, prevTaskId, prevPatient);
      }
    };

    window.addEventListener('mousemove', resetActivity);
    window.addEventListener('keydown', resetActivity);
    window.addEventListener('click', resetActivity);
    window.addEventListener('touchstart', resetActivity);

    // 2. Heartbeat interval — AUDIT FIX: Increased from 12s→30s, added online guard
    const heartbeatTimer = setInterval(() => {
      // Skip heartbeat if offline to avoid wasting battery on failed fetch calls
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      void sendHeartbeat(
        session,
        screenRef.current,
        statusRef.current,
        taskIdRef.current,
        patientRef.current
      );
    }, 30000);

    // 3. Idle timeout checker — AUDIT FIX: Reduced from 2s→30s (was excessive for idle detection)
    const idleCheckTimer = setInterval(() => {
      const inactiveMs = Date.now() - lastActivityRef.current;
      if (inactiveMs >= 180000 && statusRef.current !== 'IDLE') { // 3 minutes
        updatePresence(screenRef.current, 'IDLE', taskIdRef.current, patientRef.current);
      }
    }, 30000);

    return () => {
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      window.removeEventListener('click', resetActivity);
      window.removeEventListener('touchstart', resetActivity);
      clearInterval(heartbeatTimer);
      clearInterval(idleCheckTimer);
    };
  }, [session, updatePresence]);

  return (
    <AuthContext.Provider value={{ 
      session, 
      loading, 
      isLoggedIn: !!session,
      login, 
      logout,
      updatePresence
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
