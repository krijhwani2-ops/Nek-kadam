import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  Camera, 
  FlipHorizontal, 
  CheckCircle2, 
  AlertTriangle, 
  QrCode, 
  Search, 
  UserCheck, 
  Ticket, 
  Sparkles,
  ShieldCheck,
  RefreshCw,
  UserPlus,
  ScanFace
} from 'lucide-react';
import { 
  analyzeVideoFrame, 
  loadFaceModels,
  playBiometricMatchSound, 
  playAmbiguityAlertSound, 
  triggerBiometricHaptic 
} from '../../lib/face/faceEngine';
import { 
  loadEnrolledBiometrics, 
  issueOfflineToken, 
  savePatientBiometric,
  PatientBiometricRecord 
} from '../../lib/face/biometricStore';
import { 
  evaluateBiometricMatch, 
  MatchEvaluationResult 
} from '../../lib/face/vectorMath';
import { db } from '../../lib/db';

interface FaceScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQRScanner?: () => void;
  onSelectPatient?: (patientId: string) => void;
  currentUserId?: string;
}

export default function FaceScannerModal({
  isOpen,
  onClose,
  onOpenQRScanner,
  onSelectPatient,
  currentUserId
}: FaceScannerModalProps) {
  const navigate = useNavigate();

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [enrolledList, setEnrolledList] = useState<PatientBiometricRecord[]>([]);
  const enrolledListRef = useRef<PatientBiometricRecord[]>([]);
  useEffect(() => {
    enrolledListRef.current = enrolledList;
  }, [enrolledList]);

  // Auto-open profile on match
  const [autoOpenProfile, setAutoOpenProfile] = useState(true);
  const autoOpenProfileRef = useRef(true);
  useEffect(() => {
    autoOpenProfileRef.current = autoOpenProfile;
  }, [autoOpenProfile]);

  // Quick enroll patient from camera
  const [showEnrollSearch, setShowEnrollSearch] = useState(false);
  const [enrollSearchQuery, setEnrollSearchQuery] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState<any[]>([]);
  const [isLinkingFace, setIsLinkingFace] = useState(false);

  // Recognition state
  const [scanStatus, setScanStatus] = useState<'IDLE' | 'SCANNING' | 'ANALYZING' | 'MATCHED' | 'AMBIGUOUS' | 'NO_MATCH'>('IDLE');
  const scanStatusRef = useRef<'IDLE' | 'SCANNING' | 'ANALYZING' | 'MATCHED' | 'AMBIGUOUS' | 'NO_MATCH'>('IDLE');
  const showEnrollSearchRef = useRef(false);
  useEffect(() => {
    scanStatusRef.current = scanStatus;
  }, [scanStatus]);
  useEffect(() => {
    showEnrollSearchRef.current = showEnrollSearch;
  }, [showEnrollSearch]);

  const [matchResult, setMatchResult] = useState<MatchEvaluationResult<PatientBiometricRecord> | null>(null);
  const [statusMessage, setStatusMessage] = useState('Position face inside the biometric oval');

  // Token issuance state
  const [isIssuingToken, setIsIssuingToken] = useState(false);
  const [issuedTokenInfo, setIssuedTokenInfo] = useState<{ tokenNumber: number; isOffline: boolean } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastInferenceTime = useRef<number>(0);
  const isAnalyzingRef = useRef<boolean>(false);
  const isCameraActiveRef = useRef<boolean>(false);

  // Initialize camera and load enrolled vector profiles
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showEnrollSearchRef.current) {
          setShowEnrollSearch(false);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      loadBiometrics();
      loadFaceModels().catch(err => console.warn('[FACE SCANNER] Failed to load models:', err));
      startCamera();
    } else {
      stopCamera();
      resetState();
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      stopCamera();
    };
  }, [isOpen, facingMode]);

  async function loadBiometrics() {
    const list = await loadEnrolledBiometrics(true);
    setEnrolledList(list);
    enrolledListRef.current = list;
  }

  function resetState() {
    setScanStatus('SCANNING');
    scanStatusRef.current = 'SCANNING';
    setMatchResult(null);
    setStatusMessage('Position face inside the biometric oval');
    setIssuedTokenInfo(null);
    setIsIssuingToken(false);
    isAnalyzingRef.current = false;
    lastInferenceTime.current = 0;
    if (!animationFrameRef.current && cameraActive) {
      startContinuousRecognitionLoop();
    }
  }

  async function startCamera() {
    try {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(e => console.warn('[FACE SCANNER] play error:', e));
            setCameraActive(true);
            isCameraActiveRef.current = true;
            setScanStatus('SCANNING');
            startContinuousRecognitionLoop();
          }
        };
      }
    } catch (err: any) {
      console.error('[FACE SCANNER] Camera error:', err);
      setCameraError('Unable to access camera. Please verify camera permissions.');
      setCameraActive(false);
      isCameraActiveRef.current = false;
    }
  }

  function stopCamera() {
    isCameraActiveRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    isAnalyzingRef.current = false;
    setCameraActive(false);
  }

  function toggleCameraFacing() {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }

  // Main high-speed offline recognition loop
  function startContinuousRecognitionLoop() {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const loop = async () => {
      if (!isCameraActiveRef.current) return;
      const now = Date.now();

      // Pause inference if already matched or if linking search overlay is visible
      if (scanStatusRef.current === 'MATCHED' || showEnrollSearchRef.current) {
        if (isCameraActiveRef.current) {
          animationFrameRef.current = requestAnimationFrame(loop);
        }
        return;
      }

      // Throttle inference to every 200ms (~5 inferences/second) to conserve mobile battery
      if (now - lastInferenceTime.current > 200 && videoRef.current && canvasRef.current) {
        if (isAnalyzingRef.current) {
          if (isCameraActiveRef.current) {
            animationFrameRef.current = requestAnimationFrame(loop);
          }
          return;
        }

        lastInferenceTime.current = now;
        isAnalyzingRef.current = true;

        try {
          const currentEnrolled = enrolledListRef.current;
          const analysis = await analyzeVideoFrame(videoRef.current, canvasRef.current);

          // Guard against camera stopped while analysis was in flight
          if (!isCameraActiveRef.current) return;

          if (analysis.detected && analysis.embedding) {
            if (!currentEnrolled || currentEnrolled.length === 0) {
              setStatusMessage('No enrolled patient faces found. Use Link Face below to register.');
            } else {
              setScanStatus('ANALYZING');
              scanStatusRef.current = 'ANALYZING';
              setStatusMessage('Face detected. Matching biometric embedding...');

              // Evaluate query embedding against in-memory enrolled biometrics
              const result = evaluateBiometricMatch(analysis.embedding, currentEnrolled);

              if (result.status === 'MATCH_CONFIRMED') {
                setMatchResult(result);
                setScanStatus('MATCHED');
                scanStatusRef.current = 'MATCHED';
                setStatusMessage(`✓ ${result.bestMatch!.item.patientName} Identified!`);
                playBiometricMatchSound();
                triggerBiometricHaptic();

                if (autoOpenProfileRef.current) {
                  setStatusMessage(`✓ ${result.bestMatch!.item.patientName} Identified! Opening profile...`);
                  setTimeout(() => {
                    if (isCameraActiveRef.current) {
                      handleOpenPatient(result.bestMatch!.item);
                    }
                  }, 400);
                }
              } else if (result.status === 'AMBIGUOUS_MATCH') {
                setMatchResult(result);
                setScanStatus('AMBIGUOUS');
                scanStatusRef.current = 'AMBIGUOUS';
                setStatusMessage(result.reason);
                // Continue scanning next frame smoothly
              } else {
                setMatchResult(null);
                setScanStatus('SCANNING');
                scanStatusRef.current = 'SCANNING';
                setStatusMessage(analysis.box?.isRealFace ? 'Face Locked • Matching registered patients...' : 'Scanning... Align face with good lighting');
              }
            }
          } else {
            setMatchResult(null);
            setStatusMessage(analysis.reason || 'Align face inside oval frame');
          }
        } catch (err) {
          console.error('[FACE SCANNER] Analysis error:', err);
        } finally {
          isAnalyzingRef.current = false;
        }
      }

      if (isCameraActiveRef.current) {
        animationFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  }

  // Search existing patients from IndexedDB to link with the face in camera
  async function searchPatientsForEnroll(query: string) {
    setEnrollSearchQuery(query);
    if (!query.trim()) {
      setPatientSearchResults([]);
      return;
    }
    try {
      const q = query.trim().toLowerCase();
      const { data } = await db.from('patients').select('*');
      if (data && Array.isArray(data)) {
        const matches = data.filter((p: any) => 
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.card_number || '').includes(q) ||
          String(p.phone || '').includes(q)
        ).slice(0, 8);
        setPatientSearchResults(matches);
      }
    } catch (e) {
      console.error('[FACE SCANNER] Patient search failed:', e);
    }
  }

  // Link the face currently in front of camera to the chosen patient
  async function handleLinkCurrentFaceToPatient(patient: any) {
    if (!videoRef.current || !canvasRef.current) {
      alert('Camera is not active.');
      return;
    }
    setIsLinkingFace(true);
    try {
      const analysis = await analyzeVideoFrame(videoRef.current, canvasRef.current);
      if (!analysis.detected || !analysis.embedding) {
        alert('Please align face inside the oval frame before linking.');
        setIsLinkingFace(false);
        return;
      }

      const cardNum = String(patient.card_number || patient.cardNumber || patient.id || '').trim();
      const patId = String(patient.id || patient.card_number || patient.cardNumber || '').trim();

      await savePatientBiometric({
        id: patId,
        cardNumber: cardNum,
        name: patient.name || 'Patient',
        gender: patient.gender,
        age: patient.age,
        phone: patient.phone
      }, analysis.embedding, 0.98);

      const fresh = await loadEnrolledBiometrics(true);
      setEnrolledList(fresh);
      enrolledListRef.current = fresh;
      playBiometricMatchSound();
      triggerBiometricHaptic();
      setShowEnrollSearch(false);
      alert(`✓ Face ID linked to ${patient.name} (#${cardNum})! Opening profile now...`);
      
      handleOpenPatient({
        id: `BIO-${cardNum}-${Date.now()}`,
        patientId: patId,
        cardNumber: cardNum,
        patientName: patient.name || 'Patient',
        gender: patient.gender,
        age: patient.age,
        phone: patient.phone,
        embedding: Array.from(analysis.embedding),
        version: 'facenet-128-v1',
        qualityScore: 0.98,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      alert('Failed to link face: ' + err.message);
    } finally {
      setIsLinkingFace(false);
    }
  }

  // Select ambiguous candidate manually to inspect profile or issue token
  function handleSelectAmbiguousCandidate(candidate: PatientBiometricRecord) {
    setScanStatus('MATCHED');
    scanStatusRef.current = 'MATCHED';
    setMatchResult({
      status: 'MATCH_CONFIRMED',
      bestMatch: {
        item: candidate,
        similarity: 1.0,
        distance: 0,
        confidencePercent: 99
      },
      secondBestMatch: null,
      marginGap: 1.0,
      reason: `Manually confirmed ${candidate.patientName}`
    });
    setStatusMessage(`✓ ${candidate.patientName} Selected`);
    playBiometricMatchSound();
    triggerBiometricHaptic();
  }

  // Handle Confirmed Token Creation
  async function handleConfirmAndIssueToken(patient: PatientBiometricRecord) {
    setIsIssuingToken(true);
    try {
      const tokenResult = await issueOfflineToken({
        patientId: patient.patientId,
        patientName: patient.patientName,
        cardNumber: patient.cardNumber,
        userId: currentUserId,
        priority: 'NORMAL'
      });

      if (tokenResult.success) {
        setScanStatus('MATCHED');
        scanStatusRef.current = 'MATCHED';
        setMatchResult(prev => ({
          status: 'MATCH_CONFIRMED',
          bestMatch: {
            item: patient,
            similarity: prev?.bestMatch?.item?.cardNumber === patient.cardNumber ? prev.bestMatch.similarity : 1.0,
            distance: 0,
            confidencePercent: prev?.bestMatch?.item?.cardNumber === patient.cardNumber ? prev.bestMatch.confidencePercent : 99
          },
          secondBestMatch: null,
          marginGap: 1.0,
          reason: `Confirmed ${patient.patientName}`
        }));
        setIssuedTokenInfo({
          tokenNumber: tokenResult.tokenNumber,
          isOffline: tokenResult.isOffline
        });
        playBiometricMatchSound();
        triggerBiometricHaptic();
      }
    } catch (e) {
      console.error('[FACE SCANNER] Failed to issue token:', e);
    } finally {
      setIsIssuingToken(false);
    }
  }

  // Navigate to full patient record after confirmation
  function handleOpenPatient(patient: PatientBiometricRecord) {
    stopCamera();
    onClose();
    if (onSelectPatient) {
      onSelectPatient(patient.cardNumber || patient.patientId);
    } else {
      navigate(`/patients/${patient.cardNumber || patient.patientId}`);
    }
  }

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-wide flex items-center gap-1.5">
                Offline Face ID
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  LOCAL 128D
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                {enrolledList.length} enrolled offline profiles
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setAutoOpenProfile(prev => !prev)}
              className={`min-h-[44px] px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border transition-all ${
                autoOpenProfile 
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-sm' 
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title="Automatically open patient profile as soon as face matches"
            >
              <Sparkles size={11} className={autoOpenProfile ? 'text-emerald-400' : 'text-slate-500'} />
              <span className="hidden xs:inline">Auto-Open:</span> {autoOpenProfile ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={toggleCameraFacing}
              className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition-all"
              title="Flip Camera"
              aria-label="Flip Camera"
            >
              <FlipHorizontal size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition-all"
              aria-label="Close Face ID"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Viewfinder Section */}
        <div className="relative flex-1 min-h-[300px] max-h-[400px] bg-black flex items-center justify-center overflow-hidden">
          
          {/* Quick Link Face Search Overlay */}
          {showEnrollSearch && (
            <div className="absolute inset-0 z-30 bg-slate-950/95 backdrop-blur-md p-4 flex flex-col justify-between animate-in fade-in duration-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus size={18} className="text-emerald-400" />
                    <h4 className="text-sm font-black text-white">Link Camera Face to Patient</h4>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowEnrollSearch(false)}
                    className="min-h-[44px] min-w-[44px] p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
                    aria-label="Close link search"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="text-[11px] text-slate-300">
                  Patient is in front of camera. Type their name (e.g. <b>Reena</b>) or Card # to link their face now:
                </p>
                
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search name (e.g. Reena) or Card #..."
                    value={enrollSearchQuery}
                    onChange={e => searchPatientsForEnroll(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-emerald-500/50 rounded-xl text-white font-bold text-xs outline-none focus:border-emerald-400"
                  />
                  <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
                </div>

                {/* Search Results */}
                <div className="max-h-44 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                  {patientSearchResults.length === 0 && enrollSearchQuery && (
                    <p className="text-xs text-slate-400 text-center py-4">No patient found matching "{enrollSearchQuery}"</p>
                  )}
                  {patientSearchResults.map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => handleLinkCurrentFaceToPatient(p)}
                      className="p-2.5 bg-slate-900 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 rounded-xl flex items-center justify-between cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                            #{p.card_number}
                          </span>
                          <h5 className="text-xs font-black text-white">{p.name}</h5>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {p.age ? `${p.age} yrs • ` : ''}{p.gender || 'Patient'} {p.phone ? `• 📞 ${p.phone}` : ''}
                        </p>
                      </div>
                      <button 
                        type="button"
                        disabled={isLinkingFace}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black flex items-center gap-1 shadow-sm shrink-0"
                      >
                        {isLinkingFace ? <RefreshCw size={11} className="animate-spin" /> : <ScanFace size={11} />}
                        Link Face
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 text-center border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEnrollSearch(false)}
                  className="text-xs text-slate-400 hover:text-white font-bold"
                >
                  Cancel & Return to Live Camera
                </button>
              </div>
            </div>
          )}

          {cameraError ? (
            <div className="p-6 text-center space-y-3">
              <AlertTriangle size={36} className="text-amber-400 mx-auto" />
              <p className="text-sm text-slate-300 font-medium">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="btn-primary !py-2 text-xs"
              >
                <RefreshCw size={14} /> Retry Camera
              </button>
            </div>
          ) : (
            <>
              {/* Raw Video Feed */}
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Off-screen Inference Canvas */}
              <canvas ref={canvasRef} className="hidden" />

              {/* High-Tech Biometric Oval HUD Overlay */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                {/* Outer darkened vignette */}
                <div className="absolute inset-0 bg-radial-vignette opacity-60" />

                {/* Scanning Oval Frame */}
                <div className={`relative w-48 h-64 sm:w-56 sm:h-72 rounded-[50%] border-2 transition-all duration-300 ${
                  scanStatus === 'MATCHED'
                    ? 'border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)] bg-emerald-500/10'
                    : scanStatus === 'AMBIGUOUS'
                    ? 'border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.5)] bg-amber-500/10'
                    : 'border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse'
                }`}>
                  {/* Corner Target Reticles */}
                  <div className="absolute -top-2 -left-2 w-5 h-5 border-t-2 border-l-2 border-cyan-300" />
                  <div className="absolute -top-2 -right-2 w-5 h-5 border-t-2 border-r-2 border-cyan-300" />
                  <div className="absolute -bottom-2 -left-2 w-5 h-5 border-b-2 border-l-2 border-cyan-300" />
                  <div className="absolute -bottom-2 -right-2 w-5 h-5 border-b-2 border-r-2 border-cyan-300" />

                  {/* Horizontal Laser Scanning Line */}
                  {scanStatus === 'SCANNING' && (
                    <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#22d3ee] animate-scan-laser" />
                  )}
                </div>

                {/* Status Pill on Camera */}
                <div className="absolute bottom-4 px-4 py-1.5 rounded-full bg-slate-900/85 border border-slate-700/80 backdrop-blur-md shadow-lg">
                  <p className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    {scanStatus === 'SCANNING' && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
                    {scanStatus === 'MATCHED' && <CheckCircle2 size={14} className="text-emerald-400" />}
                    {scanStatus === 'AMBIGUOUS' && <AlertTriangle size={14} className="text-amber-400" />}
                    {statusMessage}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Drawer / Confirmation Area */}
        <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 space-y-4">

          {/* STATE 1: MATCH CONFIRMED MODAL */}
          {scanStatus === 'MATCHED' && matchResult?.bestMatch && (
            <div className="space-y-3.5 animate-in slide-in-from-bottom-2 duration-200">
              
              {/* Patient Card & Confidence Header */}
              <div className="p-3.5 bg-slate-800/80 border border-emerald-500/40 rounded-2xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 text-xs font-black rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm">
                      #{matchResult.bestMatch.item.cardNumber}
                    </span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <Sparkles size={13} /> {matchResult.bestMatch.confidencePercent}% Match
                    </span>
                  </div>
                  <h4 className="text-lg font-black text-white">
                    {matchResult.bestMatch.item.patientName}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {matchResult.bestMatch.item.age ? `${matchResult.bestMatch.item.age} Yrs • ` : ''}
                    {matchResult.bestMatch.item.gender || 'Patient'}
                    {matchResult.bestMatch.item.phone ? ` • ${matchResult.bestMatch.item.phone}` : ''}
                  </p>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black text-xl">
                  {matchResult.bestMatch.item.patientName.charAt(0)}
                </div>
              </div>

              {/* Action Buttons */}
              {issuedTokenInfo ? (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-center space-y-1">
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    {issuedTokenInfo.isOffline ? 'Offline Token Created' : 'Token Issued Successfully'}
                  </p>
                  <p className="text-3xl font-black text-white tracking-tight">
                    Token #{issuedTokenInfo.tokenNumber}
                  </p>
                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPatient(matchResult.bestMatch!.item)}
                      className="flex-1 btn-primary text-xs !py-2.5"
                    >
                      Open Patient Profile
                    </button>
                    <button
                      type="button"
                      onClick={resetState}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl"
                    >
                      Scan Next
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPatient(matchResult.bestMatch!.item)}
                      className="flex-1 btn-primary !py-3 text-sm font-black tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95"
                    >
                      <UserCheck size={18} />
                      Open Patient Profile
                    </button>
                    <button
                      type="button"
                      disabled={isIssuingToken}
                      onClick={() => handleConfirmAndIssueToken(matchResult.bestMatch!.item)}
                      className="px-3.5 py-3 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 rounded-xl border border-emerald-500/40 text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all shrink-0"
                    >
                      <Ticket size={16} />
                      {isIssuingToken ? 'Issuing...' : '+ Token'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={resetState}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
                  >
                    Not {matchResult.bestMatch.item.patientName}? Rescan
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STATE 2: AMBIGUOUS MATCH GUARD */}
          {scanStatus === 'AMBIGUOUS' && matchResult?.bestMatch && matchResult?.secondBestMatch && (
            <div className="space-y-2.5 animate-in slide-in-from-bottom-2 duration-200">
              <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl space-y-1">
                <p className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Ambiguous Match Detected
                </p>
                <p className="text-[11px] text-slate-300">
                  Multiple patients share similar facial features. Select the correct patient manually:
                </p>
              </div>

              {/* Choice A */}
              <div className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl flex items-center justify-between gap-2">
                <div 
                  onClick={() => handleSelectAmbiguousCandidate(matchResult.bestMatch!.item)}
                  className="cursor-pointer flex-1 min-w-0"
                >
                  <span className="text-[10px] font-bold text-amber-400">#{matchResult.bestMatch.item.cardNumber}</span>
                  <p className="text-sm font-bold text-white truncate">{matchResult.bestMatch.item.patientName}</p>
                  <p className="text-[10px] text-slate-400">
                    {matchResult.bestMatch.item.age ? `${matchResult.bestMatch.item.age} yrs • ` : ''}{matchResult.bestMatch.item.gender || 'Patient'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectAmbiguousCandidate(matchResult.bestMatch!.item)}
                    className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-650 text-white rounded-lg text-xs font-bold active:scale-95"
                  >
                    Select
                  </button>
                  <button
                    type="button"
                    disabled={isIssuingToken}
                    onClick={() => handleConfirmAndIssueToken(matchResult.bestMatch!.item)}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95"
                  >
                    <Ticket size={12} /> + Token
                  </button>
                </div>
              </div>

              {/* Choice B */}
              <div className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl flex items-center justify-between gap-2">
                <div 
                  onClick={() => handleSelectAmbiguousCandidate(matchResult.secondBestMatch!.item)}
                  className="cursor-pointer flex-1 min-w-0"
                >
                  <span className="text-[10px] font-bold text-slate-400">#{matchResult.secondBestMatch.item.cardNumber}</span>
                  <p className="text-sm font-bold text-white truncate">{matchResult.secondBestMatch.item.patientName}</p>
                  <p className="text-[10px] text-slate-400">
                    {matchResult.secondBestMatch.item.age ? `${matchResult.secondBestMatch.item.age} yrs • ` : ''}{matchResult.secondBestMatch.item.gender || 'Patient'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectAmbiguousCandidate(matchResult.secondBestMatch!.item)}
                    className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-650 text-white rounded-lg text-xs font-bold active:scale-95"
                  >
                    Select
                  </button>
                  <button
                    type="button"
                    disabled={isIssuingToken}
                    onClick={() => handleConfirmAndIssueToken(matchResult.secondBestMatch!.item)}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95"
                  >
                    <Ticket size={12} /> + Token
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STATE 3: SCANNING / FALLBACK TOOLS */}
          {scanStatus !== 'MATCHED' && scanStatus !== 'AMBIGUOUS' && (
            <div className="space-y-3">
              {/* Quick Link Current Face */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 flex items-center justify-between gap-3 shadow-sm">
                <div className="min-w-0">
                  <p className="text-xs font-black text-white truncate">New / Unrecognized Face?</p>
                  <p className="text-[10px] text-slate-400 truncate">Link face to existing patient (e.g. Reena)</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowEnrollSearch(true);
                    searchPatientsForEnroll(enrollSearchQuery || 'Reena');
                  }}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/30 active:scale-95 transition-all shrink-0"
                >
                  <UserPlus size={14} />
                  <span>Link Face</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
                <span>Fast Fallbacks:</span>
                <span className="text-emerald-400 font-bold">100% Offline Active</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onClose();
                    if (onOpenQRScanner) onOpenQRScanner();
                  }}
                  className="p-3 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl border border-slate-700 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <QrCode size={16} className="text-cyan-400" />
                  QR / Barcode
                </button>

                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onClose();
                    navigate('/patients');
                  }}
                  className="p-3 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl border border-slate-700 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Search size={16} className="text-amber-400" />
                  Search by ID
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
