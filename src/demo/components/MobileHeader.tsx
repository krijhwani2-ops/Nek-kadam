import React from 'react';
import { ChevronLeft, Wifi, WifiOff, Bell, Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  isOnline?: boolean;
  isDark?: boolean;
  onToggleTheme?: () => void;
  rightAction?: React.ReactNode;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  isOnline = true,
  isDark = false,
  onToggleTheme,
  rightAction,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 pt-3 pb-3 transition-colors">
      <div className="flex items-center justify-between gap-2 min-h-[44px]">
        {/* Left Section */}
        <div className="flex items-center gap-2.5 min-w-0">
          {showBack && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 transition-colors"
              aria-label="Go Back"
            >
              <ChevronLeft size={24} />
            </motion.button>
          )}

          <div className="min-w-0">
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50 truncate leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right Action Icons (48dp Touch Targets) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {rightAction}

          {/* Network Connection Status Pill */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-black tracking-wider uppercase border ${
              isOnline
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40'
            }`}
          >
            {isOnline ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <Wifi size={12} className="text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">LIVE</span>
              </>
            ) : (
              <>
                <WifiOff size={12} className="text-amber-600 dark:text-amber-400" />
                <span>OFFLINE</span>
              </>
            )}
          </div>

          {/* Theme Toggle */}
          {onToggleTheme && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onToggleTheme}
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
            </motion.button>
          )}
        </div>
      </div>
    </header>
  );
};
