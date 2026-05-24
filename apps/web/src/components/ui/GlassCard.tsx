'use client';

import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  className?: string;
  children: React.ReactNode;
  hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  className,
  children,
  hoverEffect = false,
  ...props
}) => {
  return (
    <motion.div
      className={cn(
        'glass-card relative overflow-hidden',
        hoverEffect && 'glass-card-hover',
        className
      )}
      {...props}
    >
      <div className="glow-border" />
      {children}
    </motion.div>
  );
};
