'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Zap, RefreshCw } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { BudgetHeatmap } from '@/components/dashboard/BudgetHeatmap';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { trpc } from '@/lib/trpc';
import { formatINR, formatROAS } from '@/lib/utils';

export default function BudgetsPage() {
  const { data: summaryRaw, isLoading, refetch } = trpc.budget.getDashboardSummary.useQuery({ range: '30d' });
  const summary = summaryRaw as any;

  const triggerMAB = trpc.budget.triggerMAB.useMutation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-[1400px] mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Budget Intelligence</h1>
          <p className="text-gray-400 text-sm mt-1">
            UCB1 Multi-Armed Bandit automated budget allocation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 glass rounded-lg text-gray-400 hover:text-white transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => triggerMAB.mutate({ totalBudgetPaisa: (summary?.totalSpendPaisa ?? 0) || 100_000_00 })}
            disabled={triggerMAB.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-neon-gold/20 border border-neon-gold/40 text-neon-gold rounded-lg hover:bg-neon-gold/30 transition-all text-sm font-medium"
          >
            <Zap className="w-4 h-4" />
            {triggerMAB.isPending ? 'Running MAB...' : 'Run MAB Allocation'}
          </button>
        </div>
      </div>

      {/* KPI Row */}
      {isLoading ? (
        <SkeletonCard />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Spend (30d)', value: formatINR(summary?.totalSpendPaisa ?? 0), icon: <DollarSign className="w-4 h-4" />, color: 'text-neon-gold' },
            { label: 'Avg ROAS', value: formatROAS(summary?.avgRoas ?? 0), icon: <TrendingUp className="w-4 h-4" />, color: 'text-neon-green' },
            { label: 'Avg CPL', value: formatINR(summary?.avgCplPaisa ?? 0), icon: <DollarSign className="w-4 h-4" />, color: 'text-neon-cyan' },
            { label: 'Active Campaigns', value: String(summary?.activeCampaigns ?? 0), icon: <Zap className="w-4 h-4" />, color: 'text-neon-purple' },
          ].map((stat) => (
            <GlassCard key={stat.label} className="flex items-center gap-3">
              <div className={`${stat.color} p-2 glass rounded-lg`}>{stat.icon}</div>
              <div>
                <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-gray-400">{stat.label}</div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* MAB Result */}
      {triggerMAB.data && (
        <GlassCard glow="gold">
          <h3 className="font-semibold text-neon-gold mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            MAB Allocation Result
          </h3>
          {triggerMAB.data.decisions.length === 0 ? (
            <p className="text-gray-400 text-sm">No active campaigns with ad sets found.</p>
          ) : (
            <div className="space-y-2">
              {triggerMAB.data.decisions.map((d, i) => (
                <div key={i} className="flex items-center justify-between glass rounded-lg p-3">
                  <div>
                    <div className="text-sm text-white font-medium">{d.campaignId}</div>
                    <div className="text-xs text-gray-400">Reason: {d.reason}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-neon-gold font-bold">{formatINR(d.allocatedBudgetPaisa)}</div>
                    <div className="text-xs text-gray-400">UCB: {isFinite(d.ucbScore) ? d.ucbScore.toFixed(3) : '∞'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* Budget Heatmap */}
      <BudgetHeatmap />

      {/* Algorithm Info */}
      <GlassCard>
        <h3 className="font-semibold text-white mb-3">How It Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {[
            {
              title: 'UCB1 Algorithm',
              desc: 'After 30 pulls, uses Upper Confidence Bound to balance exploration vs exploitation. Higher UCB score = more budget allocation.',
            },
            {
              title: 'Thompson Sampling',
              desc: 'During cold-start (< 30 pulls), samples from Beta(α,β) distribution to explore new campaigns without wasting budget.',
            },
            {
              title: 'CUSUM Detection',
              desc: 'Continuously monitors for performance regime changes. When CUSUM exceeds threshold, arm state resets for fresh exploration.',
            },
          ].map((item) => (
            <div key={item.title} className="glass rounded-lg p-4">
              <div className="text-neon-gold font-medium mb-2">{item.title}</div>
              <div className="text-gray-400 text-xs leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}
