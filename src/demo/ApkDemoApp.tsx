import React, { useState, useEffect } from 'react';
import { SleekClinicalVariant } from './variants/SleekClinicalVariant';
import { AuraGlassVariant } from './variants/AuraGlassVariant';
import { NeoPopBrutalistVariant } from './variants/NeoPopBrutalistVariant';
import { NothingGlyphVariant } from './variants/NothingGlyphVariant';
import { 
  Smartphone, 
  Monitor, 
  CheckCircle2, 
  ArrowLeft, 
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type DesignVariant = 'clinical' | 'aura' | 'neopop' | 'nothing';

export default function ApkDemoApp() {
  const [selectedVariant, setSelectedVariant] = useState<DesignVariant>('clinical');
  const [isPhoneFrame, setIsPhoneFrame] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      setIsPhoneFrame(desktop);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const variantMeta: Record<DesignVariant, { name: string; emoji: string; bg: string; accent: string }> = {
    clinical: {
      name: 'Nek Kadam 2.0 (Mobile Sleek)',
      emoji: '🏥',
      bg: 'bg-slate-900',
      accent: 'border-emerald-500/50 text-emerald-400'
    },
    aura: { 
      name: 'Aura Glass', 
      emoji: '🌌', 
      bg: 'bg-[#050811]',
      accent: 'border-cyan-400/50 text-cyan-300'
    },
    neopop: { 
      name: 'Neo-Pop Arcade', 
      emoji: '⚡', 
      bg: 'bg-[#FDFBF7]',
      accent: 'border-black text-black'
    },
    nothing: { 
      name: 'Nothing OS Glyph', 
      emoji: '🕹️', 
      bg: 'bg-[#0D0D0D]',
      accent: 'border-[#FF2A1B] text-[#FF2A1B]'
    },
  };

  return (
    <div className={`min-h-screen w-full transition-colors duration-300 ${variantMeta[selectedVariant].bg} flex flex-col items-center justify-start`}>
      
      {/* ── DESKTOP CONTROL BAR (Only visible on wide desktop screens) ── */}
      {isDesktop && (
        <div className="w-full max-w-2xl mt-4 mb-2 px-4 py-2 bg-slate-900/90 backdrop-blur-md text-white rounded-2xl border border-slate-800 shadow-xl flex items-center justify-between text-xs z-50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-bold tracking-wide">Nek Kadam Next-Gen APK Demo</span>
            <span className="text-slate-400">| Active: {variantMeta[selectedVariant].name}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPhoneFrame(!isPhoneFrame)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors"
            >
              {isPhoneFrame ? <Monitor size={12} /> : <Smartphone size={12} />}
              <span>{isPhoneFrame ? 'Full Width' : 'Phone Simulator'}</span>
            </button>
            <a
              href="/"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
            >
              <ArrowLeft size={12} /> Main App
            </a>
          </div>
        </div>
      )}

      {/* ── PHONE FRAME SIMULATOR WRAPPER (Desktop only) / FULL MOBILE VIEW ── */}
      <div
        className={`w-full transition-all ${
          isPhoneFrame && isDesktop
            ? 'max-w-[420px] my-4 rounded-[3rem] shadow-[0_25px_70px_rgba(0,0,0,0.8)] border-[10px] border-slate-900 overflow-hidden'
            : 'max-w-md w-full min-h-screen'
        }`}
      >
        {/* Dynamic Island Notch (Only in desktop simulator mode) */}
        {isPhoneFrame && isDesktop && (
          <div className="bg-slate-900 py-1.5 flex justify-center items-center shrink-0">
            <div className="w-24 h-4 bg-slate-950 rounded-full flex items-center justify-center gap-1">
              <div className="w-2 h-2 rounded-full bg-slate-900 border border-slate-700" />
            </div>
          </div>
        )}

        {/* ── ACTIVE VARIANT ENGINE (Full Unhindered Mobile View) ── */}
        <div className="w-full">
          {selectedVariant === 'clinical' && <SleekClinicalVariant onNotify={triggerToast} />}
          {selectedVariant === 'aura' && <AuraGlassVariant onNotify={triggerToast} />}
          {selectedVariant === 'neopop' && <NeoPopBrutalistVariant onNotify={triggerToast} />}
          {selectedVariant === 'nothing' && <NothingGlyphVariant onNotify={triggerToast} />}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          FLOATING STYLE SWITCHER PILL (Floats above bottom nav)
          - Compact pill that doesn't block thumb navigation
          - 1-tap style switcher for testing all design paradigms
         ═══════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-[96%] sm:w-auto">
        <div className="bg-slate-950/90 backdrop-blur-2xl border border-slate-700/80 rounded-full p-1 shadow-[0_10px_40px_rgba(0,0,0,0.7)] flex items-center justify-center gap-1">
          
          {/* 0. Nek Kadam 2.0 (Clinical Sleek Mobile) */}
          <button
            onClick={() => {
              setSelectedVariant('clinical');
              triggerToast('Switched to: 🏥 Nek Kadam 2.0 (Mobile Optimized)');
            }}
            className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              selectedVariant === 'clinical'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-[1.02]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🏥</span>
            <span>Mobile 2.0</span>
          </button>

          {/* 1. Aura Glass */}
          <button
            onClick={() => {
              setSelectedVariant('aura');
              triggerToast('Switched to: 🌌 Aura Glass (Spatial Bio-OS)');
            }}
            className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              selectedVariant === 'aura'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)] scale-[1.02]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🌌</span>
            <span>Aura</span>
          </button>

          {/* 2. Neo-Pop */}
          <button
            onClick={() => {
              setSelectedVariant('neopop');
              triggerToast('Switched to: ⚡ Neo-Pop Arcade (Tactile Brutalism)');
            }}
            className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              selectedVariant === 'neopop'
                ? 'bg-[#D4FF00] text-black shadow-[0_0_15px_rgba(212,255,0,0.5)] scale-[1.02]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>⚡</span>
            <span>Neo-Pop</span>
          </button>

          {/* 3. Nothing OS */}
          <button
            onClick={() => {
              setSelectedVariant('nothing');
              triggerToast('Switched to: 🕹️ Nothing OS Glyph (Teenage Engineering)');
            }}
            className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              selectedVariant === 'nothing'
                ? 'bg-[#FF2A1B] text-white shadow-[0_0_15px_rgba(255,42,27,0.5)] scale-[1.02]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🕹️</span>
            <span>Nothing</span>
          </button>
        </div>
      </div>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            className="fixed top-4 z-50 px-4 py-2 rounded-full bg-slate-900/95 text-white font-bold text-xs shadow-2xl flex items-center gap-2 border border-slate-700 backdrop-blur-md"
          >
            <Sparkles size={14} className="text-cyan-400" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
