import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'emerald' | 'indigo' | 'amber' | 'red' | 'blue' | 'slate' | 'orange';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'emerald',
  size = 'md',
  icon,
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center gap-1 font-black uppercase tracking-wider rounded-lg border shrink-0 min-w-0 truncate';

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[9px]',
    md: 'px-2.5 py-1 text-[10px]',
  };

  const variantStyles = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  };

  return (
    <span
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
};

export default Badge;
