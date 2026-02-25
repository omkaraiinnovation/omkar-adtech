'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: 'gold' | 'cyan' | 'green' | 'red' | 'none';
  animate?: boolean;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({
  children,
  className,
  glow = 'none',
  animate = false,
  hover = false,
  onClick,
}: GlassCardProps) {
  const glowClass = {
    gold: 'shadow-glow-gold border-neon-gold/20',
    cyan: 'shadow-glow-cyan border-neon-cyan/20',
    green: 'shadow-glow-green border-neon-green/20',
    red: 'shadow-glow-red border-neon-red/20',
    none: '',
  }[glow];

  const card = (
    <div
      className={cn(
        'glass rounded-xl p-4',
        hover && 'cursor-pointer transition-all duration-200 hover:bg-surface-raised/60 hover:shadow-glass-hover',
        glowClass,
        className
      )}
      onClick={onClick}
    >
      {/* Inner top gradient highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-t-xl" />
      {children}
    </div>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {card}
      </motion.div>
    );
  }

  return card;
}
