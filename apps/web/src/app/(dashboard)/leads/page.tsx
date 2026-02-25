'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, TrendingUp, MessageSquare, Phone } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LeadPipeline } from '@/components/dashboard/LeadPipeline';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = ['ALL', 'NEW', 'QUALIFYING', 'QUALIFIED', 'ATTENDING', 'ENROLLED', 'LOST'] as const;
const STATUS_COLORS: Record<string, string> = {
  NEW: 'text-neon-cyan',
  QUALIFYING: 'text-neon-purple',
  QUALIFIED: 'text-neon-gold',
  ATTENDING: 'text-neon-green',
  ENROLLED: 'text-neon-green',
  LOST: 'text-neon-red',
};

type ViewMode = 'kanban' | 'list';

export default function LeadsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');

  const { data: leads, isLoading } = trpc.leads.getAll.useQuery({
    ...(statusFilter !== 'ALL' && {
      status: statusFilter as 'NEW' | 'QUALIFYING' | 'QUALIFIED' | 'ATTENDING' | 'ENROLLED' | 'LOST',
    }),
    ...(search && { search }),
    limit: 200,
  });

  const { data: pipelineCounts } = trpc.leads.getPipelineCounts.useQuery({});

  const updateStatus = trpc.leads.updateStatus.useMutation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-[1600px] mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Pipeline</h1>
          <p className="text-gray-400 text-sm mt-1">
            Track and manage workshop leads across all campaigns
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex gap-1 glass rounded-lg p-1">
            {(['kanban', 'list'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize',
                  viewMode === mode ? 'bg-surface-raised text-white' : 'text-gray-400 hover:text-white'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline Counts */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
        {STATUS_FILTERS.slice(1).map((status) => (
          <GlassCard key={status} className="text-center py-2 cursor-pointer hover:bg-surface-raised/50 transition-all"
            onClick={() => setStatusFilter(status === statusFilter ? 'ALL' : status)}
          >
            <div className={`text-lg font-bold ${STATUS_COLORS[status] ?? 'text-white'}`}>
              {pipelineCounts?.[status] ?? 0}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{status}</div>
          </GlassCard>
        ))}
      </div>

      {/* Search + Filter */}
      <GlassCard>
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email..."
              className="bg-transparent text-white placeholder-gray-500 text-sm outline-none w-full"
            />
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Status filter pills */}
          <div className="flex flex-wrap gap-2">
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
        </div>
      </GlassCard>

      {/* Main View */}
      {isLoading ? (
        <SkeletonCard />
      ) : viewMode === 'kanban' ? (
        <LeadPipeline />
      ) : (
        /* List View */
        <GlassCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  {['Name', 'Phone', 'Status', 'Score', 'Source', 'Campaign', 'WhatsApp', 'Created'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {(leads ?? []).map((lead: any) => (
                    <motion.tr
                      key={lead.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-white/5 hover:bg-surface-raised/30 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="font-medium text-white">{lead.name}</div>
                        {lead.email && <div className="text-xs text-gray-400">{lead.email}</div>}
                      </td>
                      <td className="py-3 px-3">
                        <a href={`tel:${lead.phone}`} className="text-neon-cyan hover:underline flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {lead.phone}
                        </a>
                      </td>
                      <td className="py-3 px-3">
                        <span className={cn('text-xs font-medium', STATUS_COLORS[lead.status] ?? 'text-gray-300')}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-neon-green"
                              style={{ width: `${lead.score}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400">{lead.score}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={lead.source === 'META' ? 'badge-meta' : 'badge-google'}>
                          {lead.source}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 text-xs">
                        {(lead as { campaign?: { name: string } }).campaign?.name ?? '—'}
                      </td>
                      <td className="py-3 px-3">
                        {(lead as { conversation?: { state: string } }).conversation ? (
                          <span className="flex items-center gap-1 text-neon-green text-xs">
                            <MessageSquare className="w-3 h-3" />
                            {(lead as { conversation?: { state: string } }).conversation?.state}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-gray-400 text-xs">
                        {new Date(lead.createdAt).toLocaleDateString('en-IN')}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            {(leads ?? []).length === 0 && (
              <p className="text-center text-gray-500 text-sm py-8">No leads found.</p>
            )}
          </div>
        </GlassCard>
      )}
    </motion.div>
  );
}
