import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="space-y-1 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 text-slate-400 pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-bold text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-emerald-500 dark:focus:border-emerald-500 transition-all ${
            leftIcon ? 'pl-10' : ''
          } ${rightIcon ? 'pr-10' : ''} ${
            error ? 'border-red-500 focus:border-red-500' : ''
          } ${className}`}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3 text-slate-400 pointer-events-none">
            {rightIcon}
          </span>
        )}
      </div>
      {error && (
        <p className="text-xs font-bold text-red-500 ml-1">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
