import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'subtle';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className = '',
  ...props
}) => {
  const variantStyles = {
    default: 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm',
    glass: 'glass-card rounded-2xl dark:border-slate-800 shadow-lg shadow-emerald-950/5',
    subtle: 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl',
  };

  return (
    <div className={`${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`p-5 pb-3 border-b border-slate-100 dark:border-slate-800 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <h3 className={`text-base font-black text-slate-800 dark:text-slate-100 tracking-tight ${className}`} {...props}>
    {children}
  </h3>
);

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`p-5 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`p-5 pt-3 border-t border-slate-100 dark:border-slate-800 ${className}`} {...props}>
    {children}
  </div>
);

export default Card;
