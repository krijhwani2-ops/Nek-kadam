import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  X, 
  Camera, 
  FlipHorizontal, 
  UploadCloud, 
  Zap, 
  ZapOff, 
  AlertCircle, 
  CheckCircle2, 
  UserPlus, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { db, cleanPatientId } from '../lib/db';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScannedPatient?: (patientId: string) => void;
}

// Play pleasant high-tech medical scanner beep via Web Audio API
function playScanBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12); // E6 chirp

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (_e) {
    // Audio context may be restricted before gesture
  }
}

// Trigger haptic vibration on mobile
function triggerHaptic() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 30, 60]);
    }
  } catch (_e) {}
}

export default function BarcodeScannerModal({ isOpen, onClose, onScannedPatient }: BarcodeScannerModalProps) {
  const navigate = useNavigate();
  const [scannerStarted, setScannerStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<any[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notFoundCard, setNotFoundCard] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract pure card number or ID from raw barcode/QR data
  function parseCodeData(rawText: string): string {
    if (!rawText) return '';
    const trimmed = rawText.trim();

    // 1. If scanned code is a full URL: e.g. https://nek-kadam.onrender.com/patients/4814
    if (trimmed.includes('/patients/')) {
      const parts = trimmed.split('/patients/');
      if (parts[1]) {
        const idPart = parts[1].split('?')[0].split('#')[0];
        return cleanPatientId(idPart);
      }
    }

    // 2. If scanned code has a prefix like CARD-4814, NK-4814, OPD-4814, PATIENT:4814
    const prefixMatch = trimmed.match(/(?:CARD|NK|OPD|PATIENT|ID)[-:\s_]+([a-zA-Z0-9_-]+)/i);
    if (prefixMatch && prefixMatch[1]) {
      return cleanPatientId(prefixMatch[1]);
    }

    // 3. Raw card number or uuid
    return cleanPatientId(trimmed);
  }

  // Handle successful scan match
  const handleDecodedCode = async (decodedText: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    playScanBeep();
    triggerHaptic();

    const targetId = parseCodeData(decodedText);
    console.log('[BARCODE SCANNER] Scanned:', decodedText, '-> Parsed ID:', targetId);

    if (!targetId) {
      setCameraError('Unrecognized barcode format. Please try again.');
      setIsProcessing(false);
      return;
    }

    try {
      // 1. Search for patient in local DB
      const { data: patient } = await db
        .from('patients')
        .select('*')
        .or(`id.eq.${targetId},card_number.eq.${targetId}`)
        .maybeSingle();

      if (patient) {
        // Patient exists! Stop scanner and navigate
        await stopScanner();
        if (onScannedPatient) {
          onScannedPatient(patient.card_number || patient.id);
        } else {
          navigate(`/patients/${patient.card_number || patient.id}`);
        }
        onClose();
      } else {
        // Patient not found: ask user to register or retry
        setNotFoundCard(targetId);
        setIsProcessing(false);
      }
    } catch (e) {
      console.error('[BARCODE SCANNER] Lookup failed:', e);
      // Fallback: navigate directly to targetId
      await stopScanner();
      navigate(`/patients/${targetId}`);
      onClose();
    }
  };

  // Start HTML5 QR / Barcode Scanner
  const startScanner = async (cameraId?: string) => {
    try {
      setCameraError(null);
      setNotFoundCard(null);

      // Stop existing instance if any
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (_e) {}
      }

      const scanner = new Html5Qrcode('nk-barcode-reader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false
      });
      scannerRef.current = scanner;

      // Get available cameras if not yet retrieved
      let devices = availableCameras;
      if (devices.length === 0) {
        try {
          devices = await Html5Qrcode.getCameras();
          setAvailableCameras(devices || []);
        } catch (_camListErr) {}
      }

      const cameraConfig = cameraId 
        ? { deviceId: { exact: cameraId } }
        : { facingMode: 'environment' };

      const config = {
        fps: 15,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1.0
      };

      await scanner.start(
        cameraConfig,
        config,
        (decodedText) => {
          handleDecodedCode(decodedText);
        },
        () => {} // Ignore frame-by-frame misses
      );

      setScannerStarted(true);

      // Check for torch capability
      try {
        const capabilities = scanner.getRunningTrackCapabilities();
        if ((capabilities as any)?.torch) {
          setHasTorch(true);
        }
      } catch (_e) {}

    } catch (err: any) {
      console.error('[BARCODE SCANNER] Start failed:', err);
      setScannerStarted(false);
      if (String(err).includes('NotAllowedError') || String(err).includes('Permission denied')) {
        setCameraError('Camera permission denied. Please allow camera access in browser or app settings.');
      } else if (String(err).includes('NotFoundError') || String(err).includes('Requested device not found')) {
        setCameraError('No camera found on this device. You can upload a photo of the barcode instead.');
      } else {
        setCameraError('Could not start camera feed. Please use image upload.');
      }
    }
  };

  // Stop camera feed safely
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (_e) {}
      scannerRef.current = null;
    }
    setScannerStarted(false);
    setTorchOn(false);
  };

  // Switch between front and back camera
  const switchCamera = async () => {
    if (availableCameras.length < 2) return;
    const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
    setCurrentCameraIndex(nextIndex);
    await startScanner(availableCameras[nextIndex].id);
  };

  // Toggle flashlight / torch
  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any]
      });
      setTorchOn(nextTorch);
    } catch (_e) {}
  };

  // Handle image upload scanning
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const scanner = scannerRef.current || new Html5Qrcode('nk-barcode-reader');
      const decodedText = await scanner.scanFile(file, true);
      handleDecodedCode(decodedText);
    } catch (err) {
      console.warn('[BARCODE SCANNER] File scan failed:', err);
      setCameraError('No clear barcode or QR code found in this image.');
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Delay slightly for modal DOM mount
      const timer = setTimeout(() => {
        startScanner();
      }, 150);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
              <Camera size={20} />
            </div>
            <div>
              <h3 className="font-black text-white text-base tracking-tight flex items-center gap-1.5">
                Scan OPD Card
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 uppercase tracking-widest">
                  Live
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Point camera at QR code or Barcode</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Close scanner"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scanner Viewport / HUD Area */}
        <div className="relative flex-1 bg-black min-h-[320px] sm:min-h-[340px] flex items-center justify-center overflow-hidden">
          
          {/* HTML5 QR Code Container (Must exist in DOM) */}
          <div id="nk-barcode-reader" className="w-full h-full overflow-hidden [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />

          {/* Scanner Optical HUD Overlay */}
          {scannerStarted && !cameraError && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              
              {/* Central Target Viewfinder Box */}
              <div className="relative w-64 h-64 border-2 border-dashed border-emerald-400/40 rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.15)]">
                
                {/* 4 Glowing Corner Brackets */}
                <div className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl shadow-[0_0_12px_rgba(52,211,153,0.8)]" />

                {/* Animated Laser Beam */}
                <div className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10B981] animate-[pulse_1.5s_ease-in-out_infinite]" />

                {/* Micro Aim Reticle */}
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
              </div>

              <p className="mt-5 text-xs font-bold text-slate-300 bg-slate-900/80 px-4 py-1.5 rounded-full border border-slate-700/60 backdrop-blur-md shadow-md">
                Align OPD barcode or QR code inside frame
              </p>
            </div>
          )}

          {/* Error State Fallback */}
          {cameraError && (
            <div className="absolute inset-0 p-6 bg-slate-900 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertCircle size={26} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Camera Notice</h4>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">{cameraError}</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => startScanner()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  Retry Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Upload Photo
                </button>
              </div>
            </div>
          )}

          {/* Patient Not Found Prompt */}
          {notFoundCard && (
            <div className="absolute inset-0 p-6 bg-slate-950/95 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 size={30} />
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Card Detected</span>
                <h4 className="text-xl font-black text-white mt-1">#{notFoundCard}</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  No existing patient record matches this card number in local clinic database.
                </p>
              </div>

              <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/patients/new?card=${encodeURIComponent(notFoundCard)}`);
                  }}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                >
                  <UserPlus size={16} />
                  <span>Register As New Patient</span>
                  <ArrowRight size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNotFoundCard(null);
                    startScanner();
                  }}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                >
                  Scan Another Card
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Quick Controls */}
        <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0">
          
          {/* Torch toggle if hardware supports */}
          {hasTorch ? (
            <button
              type="button"
              onClick={toggleTorch}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                torchOn ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {torchOn ? <ZapOff size={15} /> : <Zap size={15} />}
              <span>{torchOn ? 'Torch Off' : 'Torch On'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
              <Sparkles size={13} className="text-emerald-500" />
              <span>Auto-focus enabled</span>
            </div>
          )}

          {/* Action buttons: Switch Camera + Upload file fallback */}
          <div className="flex items-center gap-2">
            {availableCameras.length > 1 && (
              <button
                type="button"
                onClick={switchCamera}
                title="Switch Camera"
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors"
                aria-label="Switch camera"
              >
                <FlipHorizontal size={18} />
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload Barcode Image"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-all"
            >
              <UploadCloud size={15} className="text-emerald-400" />
              <span>Choose Image</span>
            </button>

            {/* Hidden file input for gallery upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileScan}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
