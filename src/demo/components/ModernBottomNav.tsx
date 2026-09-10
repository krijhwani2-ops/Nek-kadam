import React from 'react';
import { Users, Stethoscope, Pill, Ticket } from 'lucide-react';
import { motion } from 'framer-motion';

export type DemoTabId = 'queue' | 'patients' | 'prescribe' | 'dispense';

interface ModernBottomNavProps {
  activeTab: DemoTabId;
  onChangeTab: (tab: DemoTabId) => void;
  queueBadge?: number;
  pharmacyBadge?: number;
}

interface NavItemConfig {
  id: DemoTabId;
  label: string;
  icon: any;
  badge?: number;
}

export const ModernBottomNav: React.FC<ModernBottomNavProps> = ({
  activeTab,
  onChangeTab,
  queueBadge,
  pharmacyBadge,
}) => {
  const items: NavItemConfig[] = [
    { id: 'queue', label: 'Tokens', icon: Ticket, badge: queueBadge },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'prescribe', label: 'Prescribe', icon: Stethoscope },
    { id: 'dispense', label: 'Pharmacy', icon: Pill, badge: pharmacyBadge },
  ];

  return (
    <nav className="sticky bottom-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] transition-colors">
      <div className="flex items-center justify-around gap-1 max-w-md mx-auto">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          const IconComponent = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className="relative flex flex-col items-center justify-center flex-1 py-1 px-1.5 min-h-[52px] rounded-2xl transition-colors focus:outline-none"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {/* Active Pill Indicator with spring physics */}
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-x-2 inset-y-1 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}

              <div className="relative">
                <motion.div
                  animate={{ scale: isActive ? 1.12 : 1, y: isActive ? -1 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className={`transition-colors ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <IconComponent size={22} />
                </motion.div>

                {/* Notification Badge */}
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 bg-emerald-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm">
                    {item.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[11px] mt-1 tracking-tight font-black transition-colors ${
                  isActive
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-500 dark:text-slate-400 font-semibold'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
