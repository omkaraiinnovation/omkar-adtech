'use client';

import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { GlassCard } from '../ui/GlassCard';
import { SkeletonCard } from '../ui/Skeleton';
import { formatINR } from '@/lib/utils';

// TODO: Phase 4 — wire to real tRPC data
const MOCK_DATA = Array.from({ length: 14 }, (_, i) => {
  const date = new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000);
  return {
    date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    spend: Math.floor(Math.random() * 500000 + 100000),    // paisa
    roas: +(Math.random() * 3 + 1.5).toFixed(2),
    leads: Math.floor(Math.random() * 80 + 20),
  };
});

export function PerformanceChart() {
  return (
    <GlassCard className="h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">Performance Overview</h3>
          <p className="text-xs text-gray-500 mt-0.5">Spend vs ROAS — last 14 days</p>
        </div>
        <div className="flex gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-neon-cyan/60 inline-block" />
            Spend
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-1 rounded-full bg-neon-gold inline-block" />
            ROAS
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={MOCK_DATA} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6B7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="spend"
            orientation="left"
            tick={{ fill: '#6B7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatINR(v).replace('₹', '₹')}
          />
          <YAxis
            yAxisId="roas"
            orientation="right"
            tick={{ fill: '#6B7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}x`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(13,33,55,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              backdropFilter: 'blur(20px)',
            }}
            labelStyle={{ color: '#9CA3AF', fontSize: 12 }}
            formatter={(value: number, name: string) => {
              if (name === 'spend') return [formatINR(value), 'Spend'];
              if (name === 'roas') return [`${value}x`, 'ROAS'];
              return [value, name];
            }}
          />
          <Bar
            yAxisId="spend"
            dataKey="spend"
            fill="rgba(0,180,216,0.4)"
            radius={[4, 4, 0, 0]}
            name="spend"
          />
          <Line
            yAxisId="roas"
            type="monotone"
            dataKey="roas"
            stroke="#D4A017"
            strokeWidth={2}
            dot={{ fill: '#D4A017', strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, fill: '#D4A017' }}
            name="roas"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}
