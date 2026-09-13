import React, { useState, useEffect } from 'react';
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

export type DesignVariant = 'aura' | 'neopop' | 'nothing';

export default function ApkDemoApp() {
  const [selectedVariant, setSelectedVariant] = useState<DesignVariant>('aura');
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
      
      {/* ── MOBILE TOP BAR (Always provides back navigation on mobile) ── */}
      {!isDesktop && (
        <div className="w-full px-4 pt-3 pb-2 flex items-center justify-between z-40 max-w-md">
          <a
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white font-bold text-xs shadow-lg active:scale-95 transition-all"
          >
            <ArrowLeft size={14} /> Back to App
          </a>
          <div className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/10 text-white/90 backdrop-blur-md border border-white/10">
            {variantMeta[selectedVariant].name}
          </div>
        </div>
      )}

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
          {selectedVariant === 'aura' && <AuraGlassVariant onNotify={triggerToast} />}
          {selectedVariant === 'neopop' && <NeoPopBrutalistVariant onNotify={triggerToast} />}
          {selectedVariant === 'nothing' && <NothingGlyphVariant onNotify={triggerToast} />}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          FLOATING BOTTOM PILL SWITCHER
          - Floating glass dock at the bottom of screen
          - Completely unblocks the top of the mobile screen
          - Instant 1-tap switching between the 3 creative universes
         ═══════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[94%] sm:w-auto">
        <div className="bg-black/90 backdrop-blur-2xl border border-white/20 rounded-full p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex items-center justify-between gap-1">
          
          {/* 1. Aura Glass */}
          <button
            onClick={() => {
              setSelectedVariant('aura');
              triggerToast('Switched to: 🌌 Aura Glass (Spatial Bio-OS)');
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all ${
              selectedVariant === 'aura'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.6)] scale-[1.03]'
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
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all ${
              selectedVariant === 'neopop'
                ? 'bg-[#D4FF00] text-black shadow-[0_0_15px_rgba(212,255,0,0.6)] scale-[1.03]'
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
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all ${
              selectedVariant === 'nothing'
                ? 'bg-[#FF2A1B] text-white shadow-[0_0_15px_rgba(255,42,27,0.6)] scale-[1.03]'
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
