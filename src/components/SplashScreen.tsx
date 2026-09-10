import React, { useEffect, useState } from 'react';
import { HeartPulse, GraduationCap, Users, HeartHandshake } from 'lucide-react';
// @ts-expect-error missing types
import logoUrl from '../assets/logo.jpg';

export default function SplashScreen() {
  const [show, setShow] = useState(true);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setCanSkip(true), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b from-emerald-50 via-white to-emerald-50 overflow-hidden">
      
      {/* Top Background Element */}
      <div className="absolute top-0 left-0 w-full h-64 bg-emerald-100/30 rounded-b-[100%] blur-3xl -translate-y-20"></div>

      {/* Main Center Content */}
      <div className={`flex flex-col items-center mt-[15vh] transition-all duration-1000 transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        
        {/* Logo */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-emerald-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
          <img 
            src={logoUrl} 
            alt="Nek Kadam Logo" 
            className="w-48 h-48 object-contain rounded-[2.5rem] shadow-2xl shadow-emerald-900/10 z-10 relative" 
          />
        </div>

        {/* Title */}
        <h1 className="text-4xl font-black text-slate-800 tracking-tight">
          <span className="text-emerald-700">Nek</span> Kadam
        </h1>
        
        {/* Divider & Subtitle */}
        <div className="flex items-center gap-3 mt-3">
          <div className="h-px w-8 bg-emerald-300"></div>
          <p className="text-[10px] font-black tracking-[0.3em] text-slate-500">NGO OPERATING SYSTEM</p>
          <div className="h-px w-8 bg-emerald-300"></div>
        </div>

        {/* 4 Feature Icons Box */}
        <div className="bg-white rounded-2xl shadow-lg shadow-emerald-900/5 border border-emerald-50 p-4 mt-8 flex gap-6 items-center">
          <FeatureIcon icon={HeartPulse} label="HEALTHCARE" />
          <div className="w-px h-10 bg-slate-100"></div>
          <FeatureIcon icon={GraduationCap} label="EDUCATION" />
          <div className="w-px h-10 bg-slate-100"></div>
          <FeatureIcon icon={Users} label="VOLUNTEER" />
          <div className="w-px h-10 bg-slate-100"></div>
          <FeatureIcon icon={HeartHandshake} label="HUMANITY" />
        </div>
      </div>

      {/* Bottom Footer Content */}
      <div className={`mb-12 flex flex-col items-center transition-all duration-1000 delay-300 transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        
        <div className="flex items-center gap-4 mb-2">
          <div className="h-[2px] w-12 bg-slate-200"></div>
          <p className="text-[11px] font-black tracking-[0.3em] text-emerald-800">CRAFTED BY</p>
          <div className="h-[2px] w-12 bg-slate-200"></div>
        </div>
        
        <h2 className="text-3xl md:text-4xl font-black text-emerald-900 uppercase tracking-tighter" style={{ fontFamily: 'Oswald, Impact, sans-serif' }}>
          ROHAN RIJHWANI
        </h2>
        
        <p className="text-[10px] font-bold text-slate-400 mt-2 mb-8 tracking-widest">NEK KADAM OPERATING SYSTEM</p>
        
        {/* Custom Spinner */}
        <div className="relative flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-100 border-t-emerald-500 animate-spin"></div>
          <p className="mt-3 text-[9px] font-black tracking-widest text-emerald-600">LOADING...</p>
          {canSkip && (
            <button 
              onClick={() => { localStorage.removeItem('nk_token'); window.location.href = '/login'; }}
              className="mt-6 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            >
              Continue to Login →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureIcon({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 w-16">
      <Icon size={24} className="text-emerald-600 mb-0.5" strokeWidth={2} />
      <span className="text-[8px] font-black tracking-wider text-slate-600">{label}</span>
    </div>
  );
}
