'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Filter, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { CampaignTable } from '@/components/dashboard/CampaignTable';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { trpc } from '@/lib/trpc';

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'PAUSED', 'DRAFT', 'ARCHIVED'] as const;
const PLATFORM_FILTERS = ['ALL', 'GOOGLE', 'META'] as const;

export default function CampaignsPage() {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('ALL');
  const [platformFilter, setPlatformFilter] = useState<(typeof PLATFORM_FILTERS)[number]>('ALL');

  const { data: campaigns, isLoading, refetch } = trpc.campaigns.getAll.useQuery({
    ...(statusFilter !== 'ALL' && { status: statusFilter as 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'ARCHIVED' }),
    ...(platformFilter !== 'ALL' && { platform: platformFilter as 'GOOGLE' | 'META' }),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-[1400px] mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage Google Ads and Meta Ads campaigns
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 glass rounded-lg text-gray-400 hover:text-white transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/campaigns/new"
            className="flex items-center gap-2 px-4 py-2 bg-neon-gold/20 border border-neon-gold/40 text-neon-gold rounded-lg hover:bg-neon-gold/30 transition-all font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: campaigns?.length ?? 0, color: 'text-white' },
          { label: 'Active', value: campaigns?.filter((c: any) => c.status === 'ACTIVE').length ?? 0, color: 'text-neon-green' },
          { label: 'Paused', value: campaigns?.filter((c: any) => c.status === 'PAUSED').length ?? 0, color: 'text-yellow-400' },
          { label: 'Google / Meta', value: `${campaigns?.filter((c: any) => c.platform === 'GOOGLE').length ?? 0} / ${campaigns?.filter((c: any) => c.platform === 'META').length ?? 0}`, color: 'text-neon-cyan' },
        ].map((stat) => (
          <GlassCard key={stat.label} className="text-center py-3">
            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
          </GlassCard>
        ))}
      </div>

      {/* Filters */}
      <GlassCard>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Filter:</span>
          </div>

          {/* Status filter */}
          <div className="flex gap-2">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan'
                    : 'glass text-gray-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Platform filter */}
          <div className="flex gap-2">
            {PLATFORM_FILTERS.map((p) => (
              <button
                key={p}
                onClick={() => setPlatformFilter(p)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  platformFilter === p
                    ? 'bg-neon-purple/20 border border-neon-purple/40 text-neon-purple'
                    : 'glass text-gray-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Campaign Table */}
      {isLoading ? (
        <SkeletonCard />
      ) : (
        <CampaignTable campaigns={campaigns ?? []} loading={false} />
      )}
    </motion.div>
  );
}
