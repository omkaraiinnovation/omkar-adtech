'use client';

import React from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { GlassCard } from '../ui/GlassCard';
import { formatINR } from '@/lib/utils';

// Mock data — Phase 4 will wire this to real MAB state from Redis
const MOCK_ARMS = [
  { name: 'Campaign A / Meta / Video', size: 450000, ucbScore: 0.92 },
  { name: 'Campaign A / Meta / Image', size: 220000, ucbScore: 0.74 },
  { name: 'Campaign B / Google / RSA', size: 380000, ucbScore: 0.88 },
  { name: 'Campaign C / Meta / Carousel', size: 150000, ucbScore: 0.45 },
  { name: 'Campaign B / Google / Display', size: 80000, ucbScore: 0.31 },
  { name: 'Campaign D / Meta / Video', size: 310000, ucbScore: 0.79 },
];

function ucbColor(score: number): string {
  if (score >= 0.8) return '#00C896';  // neon-green
  if (score >= 0.6) return '#00B4D8';  // neon-cyan
  if (score >= 0.4) return '#D4A017';  // neon-gold
  return '#EF4444';                    // neon-red
}

const CustomContent = (props: {
  x?: number; y?: number; width?: number; height?: number;
  name?: string; ucbScore?: number; size?: number;
}) => {
  const { x = 0, y = 0, width = 0, height = 0, name, ucbScore = 0, size = 0 } = props;
  if (width < 40 || height < 30) return null;

  return (
    <g>
      <rect
        x={x + 1} y={y + 1}
        width={width - 2} height={height - 2}
        rx={6}
        fill={ucbColor(ucbScore)}
        fillOpacity={0.15}
        stroke={ucbColor(ucbScore)}
        strokeOpacity={0.4}
        strokeWidth={1}
      />
      {width > 80 && height > 40 && (
        <>
          <text x={x + 8} y={y + 18} fill="white" fontSize={11} fontWeight={500} opacity={0.9}>
            {(name ?? '').split(' / ')[0]}
          </text>
          <text x={x + 8} y={y + 32} fill={ucbColor(ucbScore)} fontSize={10} fontWeight={600}>
            UCB: {ucbScore.toFixed(2)}
          </text>
        </>
      )}
    </g>
  );
};

export function BudgetHeatmap() {
  return (
    <GlassCard className="h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">MAB Budget Heatmap</h3>
          <p className="text-xs text-gray-500 mt-0.5">UCB scores — green = high exploration value</p>
        </div>
        <div className="flex gap-2 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neon-green inline-block" />High</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neon-gold inline-block" />Med</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neon-red inline-block" />Low</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <Treemap
          data={MOCK_ARMS}
          dataKey="size"
          content={<CustomContent />}
        >
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0]?.payload as typeof MOCK_ARMS[0] | undefined;
              if (!d) return null;
              return (
                <div className="glass rounded-lg p-3 text-xs">
                  <p className="font-medium text-white mb-1">{d.name}</p>
                  <p className="text-neon-cyan">Budget: {formatINR(d.size)}</p>
                  <p style={{ color: ucbColor(d.ucbScore) }}>UCB Score: {d.ucbScore.toFixed(3)}</p>
                </div>
              );
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </GlassCard>
  );
}
