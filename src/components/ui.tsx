export function Spinner({ size = 'md', color = 'currentColor' }: { size?: string, color?: string }) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  return (
    <div className={`${sizeClass} border-2 border-t-transparent rounded-full animate-spin`} style={{ borderColor: color, borderTopColor: 'transparent' }} />
  );
}
