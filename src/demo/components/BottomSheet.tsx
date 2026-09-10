import React, { useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxHeight = 'max-h-[88vh]',
}) => {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    // If dragged down fast or more than 100px, dismiss
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm"
          />

          {/* Drawer Sheet */}
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className={`relative z-10 w-full bg-white dark:bg-slate-900 rounded-t-[2rem] shadow-2xl border-t border-slate-200 dark:border-slate-800 flex flex-col ${maxHeight} overflow-hidden`}
          >
            {/* Drag Pill Handle */}
            <div className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Sheet Header */}
            {(title || subtitle) && (
              <div className="px-5 pb-3 pt-1 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between shrink-0">
                <div>
                  {title && (
                    <h2 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {subtitle}
                    </p>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  aria-label="Close Drawer"
                >
                  <X size={16} />
                </motion.button>
              </div>
            )}

            {/* Scrollable Content Container */}
            <div className="overflow-y-auto flex-1 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
