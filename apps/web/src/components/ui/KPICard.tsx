'use client';

import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: number;
  displayValue?: string;      // Override display (e.g., "₹1.2L")
  previousValue?: number;
  unit?: string;
  icon?: React.ReactNode;
  color?: 'cyan' | 'gold' | 'green' | 'purple';
  sparkline?: number[];       // Last 7 data points for mini chart
  loading?: boolean;
  className?: string;
}

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => v.toFixed(decimals));
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 1.2,
      ease: 'easeOut',
    });
    return controls.stop;
  }, [motionValue, value]);

  return <motion.span ref={ref}>{rounded}</motion.span>;
}

export function KPICard({
  title,
  value,
  displayValue,
  previousValue,
  unit = '',
  icon,
  color = 'cyan',
  sparkline,
  loading = false,
  className,
}: KPICardProps) {
  const colorMap = {
    cyan: { text: 'text-neon-cyan', glow: 'cyan' as const, bg: 'from-neon-cyan/5' },
    gold: { text: 'text-neon-gold', glow: 'gold' as const, bg: 'from-neon-gold/5' },
    green: { text: 'text-neon-green', glow: 'green' as const, bg: 'from-neon-green/5' },
    purple: { text: 'text-neon-purple', glow: 'none' as const, bg: 'from-neon-purple/5' },
  }[color];

  const trendPct =
    previousValue && previousValue > 0
      ? ((value - previousValue) / previousValue) * 100
      : null;

  const isPositive = trendPct !== null && trendPct >= 0;

  if (loading) {
    return (
      <GlassCard className={cn('min-h-[120px]', className)}>
        <div className="space-y-3">
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-8 w-32 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      glow={colorMap.glow}
      className={cn(
        `bg-gradient-to-br ${colorMap.bg} to-transparent`,
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-gray-400 font-medium">{title}</p>
        {icon && (
          <div className={cn('p-2 rounded-lg bg-white/5', colorMap.text)}>
            {icon}
          </div>
        )}
      </div>

      {/* Main value */}
      <div className={cn('text-2xl font-bold tabular-nums kpi-value', colorMap.text)}>
        {displayValue ?? (
          <>
            {unit}
            <AnimatedNumber value={value} />
          </>
        )}
      </div>

      {/* Trend indicator */}
      {trendPct !== null && (
        <div
          className={cn(
            'flex items-center gap-1 mt-2 text-sm font-medium',
            isPositive ? 'text-neon-green' : 'text-neon-red'
          )}
        >
          {isPositive ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          <span>{Math.abs(trendPct).toFixed(1)}% vs prev period</span>
        </div>
      )}

      {trendPct === null && previousValue === undefined && (
        <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
          <Minus className="w-3 h-3" />
          <span>No comparison data</span>
        </div>
      )}

      {/* Sparkline */}
      {sparkline && sparkline.length > 1 && (
        <div className="mt-3 h-8 flex items-end gap-0.5">
          {sparkline.map((v, i) => {
            const max = Math.max(...sparkline);
            const height = max > 0 ? (v / max) * 100 : 0;
            return (
              <div
                key={i}
                className={cn(
                  'flex-1 rounded-sm opacity-60 transition-all duration-300',
                  i === sparkline.length - 1 ? `opacity-100 ${colorMap.text.replace('text-', 'bg-')}` : 'bg-white/20'
                )}
                style={{ height: `${Math.max(height, 8)}%` }}
              />
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
