import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export function Card({ children, className, hover = false, glow = false }: CardProps) {
  return (
    <div
      className={cn(
        'backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-2xl',
        hover && 'transition-all duration-300 hover:bg-white/[0.05] hover:border-white/[0.15] hover:shadow-[0_0_30px_rgba(10,132,255,0.1)]',
        glow && 'shadow-[0_0_20px_rgba(10,132,255,0.05)]',
        className
      )}
    >
      {children}
    </div>
  );
}
