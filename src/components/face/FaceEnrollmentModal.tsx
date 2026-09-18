import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Camera, 
  FlipHorizontal, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { 
  analyzeVideoFrame, 
  playBiometricMatchSound, 
  triggerBiometricHaptic 
} from '../../lib/face/faceEngine';
import { savePatientBiometric } from '../../lib/face/biometricStore';
import { consolidateBurstEmbeddings } from '../../lib/face/vectorMath';

interface FaceEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: {
    id: string;
    cardNumber: string;
    name: string;
    gender?: string;
    age?: number;
    phone?: string;
  };
  onEnrollmentComplete?: () => void;
}

export default function FaceEnrollmentModal({
  isOpen,
  onClose,
  patient,
  onEnrollmentComplete
}: FaceEnrollmentModalProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Multi-burst capture steps: 0 = Ready, 1 = Shot 1 (Neutral), 2 = Shot 2 (Smile), 3 = Shot 3 (Angle), 4 = Done
  const [enrollStep, setEnrollStep] = useState<number>(0);
  const [capturedEmbeddings, setCapturedEmbeddings] = useState<Float32Array[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qualityText, setQualityText] = useState('Position face inside frame');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
      setEnrollStep(0);
      setCapturedEmbeddings([]);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  async function startCamera() {
    try {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(e => console.warn('[ENROLLMENT] play error:', e));
            setCameraActive(true);
          }
        };
      }
    } catch (e: any) {
      console.error('[ENROLLMENT] Camera failed:', e);
      setCameraError('Camera access denied. Please grant camera permissions.');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  // Trigger 3-shot burst capture sequence
  async function handleStartBurstCapture() {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    setIsProcessing(true);

    const shots: Float32Array[] = [];
    const stepInstructions = [
      'Shot 1/3: Look straight with neutral expression...',
      'Shot 2/3: Smile naturally or open eyes wide...',
      'Shot 3/3: Turn head very slightly to the side...'
    ];

    for (let i = 0; i < 3; i++) {
      setEnrollStep(i + 1);
      setQualityText(stepInstructions[i]);
      triggerBiometricHaptic();

      // Wait 600ms between bursts to let user adjust pose
      await new Promise(r => setTimeout(r, 600));

      const analysis = analyzeVideoFrame(videoRef.current, canvasRef.current);
      if (analysis.detected && analysis.embedding) {
        shots.push(analysis.embedding);
        playBiometricMatchSound();
      } else {
        // Fallback retry
        const retry = analyzeVideoFrame(videoRef.current, canvasRef.current);
        if (retry.embedding) shots.push(retry.embedding);
      }
    }

    if (shots.length >= 2) {
      setQualityText('Consolidating 128D facial vectors...');
      // Average into high-accuracy master embedding
      const masterVector = consolidateBurstEmbeddings(shots);

      // Save locally to IndexedDB & queue sync
      await savePatientBiometric(patient, masterVector, 0.98);

      setEnrollStep(4);
      setQualityText('Biometric Face ID successfully enrolled!');
      playBiometricMatchSound();
      triggerBiometricHaptic();

      setTimeout(() => {
        if (onEnrollmentComplete) onEnrollmentComplete();
        stopCamera();
        onClose();
      }, 1500);
    } else {
      setQualityText('Capture failed due to poor lighting or motion. Please retry.');
      setEnrollStep(0);
    }

    setIsProcessing(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-1.5">
              <ShieldCheck size={18} className="text-emerald-400" />
              Enroll Face ID
            </h3>
            <p className="text-xs text-slate-400">
              #{patient.cardNumber} • {patient.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
            aria-label="Close enrollment"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative h-72 bg-black flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center space-y-2">
              <AlertCircle size={32} className="text-amber-400 mx-auto" />
              <p className="text-sm text-slate-300">{cameraError}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />

              {/* Biometric Oval Guide */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className={`w-44 h-60 rounded-[50%] border-2 transition-all duration-300 ${
                  enrollStep === 4 ? 'border-emerald-400 bg-emerald-500/20' : 'border-emerald-400/80 shadow-[0_0_15px_#10b981]'
                }`} />
                <div className="absolute bottom-3 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs font-bold text-slate-200">
                  {qualityText}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          {/* Progress Indicators */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map(step => (
              <div
                key={step}
                className={`h-2 rounded-full transition-all duration-300 ${
                  enrollStep >= step ? 'w-8 bg-emerald-500' : 'w-3 bg-slate-700'
                }`}
              />
            ))}
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            Zero raw photos stored. Face is converted into an encrypted 128D mathematical vector for 100% offline clinic matching.
          </p>

          <button
            type="button"
            disabled={isProcessing || enrollStep === 4}
            onClick={handleStartBurstCapture}
            className="w-full btn-primary !py-3 font-black text-sm flex items-center justify-center gap-2"
          >
            <Camera size={18} />
            {isProcessing ? 'Capturing 3-Shot Burst...' : enrollStep === 4 ? 'Enrolled Successfully' : 'Start 3-Shot Burst Capture'}
          </button>
        </div>

      </div>
    </div>
  );
}
