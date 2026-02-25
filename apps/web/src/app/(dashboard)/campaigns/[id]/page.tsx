'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Pause, TrendingUp, Users, DollarSign, Zap } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { KPICard } from '@/components/ui/KPICard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { trpc } from '@/lib/trpc';
import { formatINR, formatROAS, statusColor, platformColor } from '@/lib/utils';

const RANGE_OPTIONS = ['7d', '30d', '90d'] as const;

export default function CampaignDetailPage() {
  const { id } = useParams() as { id: string };
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');

  const { data: campaign, isLoading } = trpc.campaigns.getById.useQuery({ id });
  const { data: metricsRaw, isLoading: metricsLoading } = trpc.campaigns.getMetrics.useQuery({ id, range });
  const metrics = metricsRaw as any;

  const pauseMutation = trpc.campaigns.pause.useMutation();
  const resumeMutation = trpc.campaigns.resume.useMutation();
  const forecastMutationRaw = trpc.campaigns.launchForecast.useMutation();
  const forecastMutation = forecastMutationRaw as typeof forecastMutationRaw & { data: any };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-[1400px] mx-auto">
        <SkeletonCard />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-20 text-gray-400">
        Campaign not found.{' '}
        <Link href="/campaigns" className="text-neon-cyan hover:underline">Back to campaigns</Link>
      </div>
    );
  }

  const chartData = (metrics?.allocations ?? []).map((a: { date: string | Date; spend: number; roas: number; impressions: number; clicks: number }) => ({
    date: new Date(a.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    spend: Math.round(a.spend / 100),
    roas: a.roas,
    impressions: a.impressions,
    clicks: a.clicks,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-[1400px] mx-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/campaigns" className="p-2 glass rounded-lg text-gray-400 hover:text-white transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                campaign.platform === 'GOOGLE' ? 'badge-google' : 'badge-meta'
              }`}>
                {campaign.platform}
              </span>
              <span className={`text-xs font-medium ${statusColor(campaign.status)}`}>
                {campaign.status}
              </span>
            </div>
            <p className="text-gray-400 text-sm mt-1">
              Objective: {campaign.objective} · Created {new Date(campaign.createdAt).toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {campaign.status === 'ACTIVE' && (
            <button
              onClick={() => pauseMutation.mutate({ id })}
              disabled={pauseMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 glass border border-yellow-500/30 text-yellow-400 rounded-lg hover:bg-yellow-500/10 transition-all text-sm font-medium"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}
          {campaign.status === 'PAUSED' && (
            <button
              onClick={() => resumeMutation.mutate({ id })}
              disabled={resumeMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 glass border border-neon-green/30 text-neon-green rounded-lg hover:bg-neon-green/10 transition-all text-sm font-medium"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
          )}
          <button
            onClick={() => forecastMutation.mutate({ id })}
            disabled={forecastMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-neon-gold/20 border border-neon-gold/40 text-neon-gold rounded-lg hover:bg-neon-gold/30 transition-all text-sm font-medium"
          >
            <Zap className="w-4 h-4" />
            {forecastMutation.isPending ? 'Generating...' : 'AI Forecast'}
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Total Spend"
          value={metrics?.totals?.spend ?? 0}
          displayValue={formatINR(metrics?.totals?.spend ?? 0)}
          icon={<DollarSign className="w-4 h-4" />}
          color="gold"
          loading={metricsLoading}
        />
        <KPICard
          title="Avg ROAS"
          value={metrics?.totals?.avgRoas ?? 0}
          displayValue={formatROAS(metrics?.totals?.avgRoas ?? 0)}
          icon={<TrendingUp className="w-4 h-4" />}
          color="green"
          loading={metricsLoading}
        />
        <KPICard
          title="Total Clicks"
          value={metrics?.totals?.clicks ?? 0}
          icon={<Users className="w-4 h-4" />}
          color="cyan"
          loading={metricsLoading}
        />
        <KPICard
          title="Daily Budget"
          value={campaign.dailyBudget}
          displayValue={formatINR(campaign.dailyBudget)}
          icon={<DollarSign className="w-4 h-4" />}
          color="purple"
        />
      </div>

      {/* Range Selector + Chart */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Performance History</h3>
          <div className="flex gap-2">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  range === r
                    ? 'bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan'
                    : 'glass text-gray-400 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {metricsLoading ? (
          <div className="h-64 flex items-center justify-center text-gray-500 text-sm">Loading metrics...</div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
            No performance data yet. Metrics sync every 15 minutes.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="spend" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="roas" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0D2137', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar yAxisId="spend" dataKey="spend" fill="rgba(0,180,216,0.5)" name="Spend (₹)" radius={[2, 2, 0, 0]} />
              <Line yAxisId="roas" type="monotone" dataKey="roas" stroke="#D4A017" strokeWidth={2} dot={false} name="ROAS" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </GlassCard>

      {/* AI Forecast Result */}
      {forecastMutation.data && (
        <GlassCard glow="gold">
          <h3 className="font-semibold text-neon-gold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            7-Day AI Forecast
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Projected Leads', value: forecastMutation.data.forecast?.projectedLeads ?? '-' },
              { label: 'Projected Spend', value: forecastMutation.data.forecast?.projectedSpendPaisa ? formatINR(forecastMutation.data.forecast.projectedSpendPaisa as number) : '-' },
              { label: 'Projected ROAS', value: forecastMutation.data.forecast?.projectedRoas ? formatROAS(forecastMutation.data.forecast.projectedRoas as number) : '-' },
              { label: 'Confidence', value: (forecastMutation.data.forecast?.confidence as string) ?? '-' },
            ].map((item) => (
              <div key={item.label} className="glass rounded-lg p-3">
                <div className="text-xs text-gray-400">{item.label}</div>
                <div className="text-lg font-bold text-neon-gold mt-1">{String(item.value)}</div>
              </div>
            ))}
          </div>
          {(forecastMutation.data.forecast?.recommendations as string[] | undefined)?.map((rec: string, i: number) => (
            <p key={i} className="text-sm text-gray-300 flex items-start gap-2 mt-2">
              <span className="text-neon-gold mt-0.5">→</span>
              {rec}
            </p>
          ))}
        </GlassCard>
      )}
    </motion.div>
  );
}
