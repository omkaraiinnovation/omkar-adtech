'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Video, Plus, CheckCircle2, XCircle, Clock, Bot } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'text-gray-400 border-gray-400/30 bg-gray-400/10',
  APPROVED: 'text-neon-green border-neon-green/30 bg-neon-green/10',
  REJECTED: 'text-neon-red border-neon-red/30 bg-neon-red/10',
  DEPLOYED: 'text-neon-cyan border-neon-cyan/30 bg-neon-cyan/10',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  DRAFT: <Clock className="w-3 h-3" />,
  APPROVED: <CheckCircle2 className="w-3 h-3" />,
  REJECTED: <XCircle className="w-3 h-3" />,
  DEPLOYED: <CheckCircle2 className="w-3 h-3" />,
};

type FilterStatus = 'ALL' | 'DRAFT' | 'APPROVED' | 'REJECTED' | 'DEPLOYED';
const FILTERS: FilterStatus[] = ['ALL', 'DRAFT', 'APPROVED', 'REJECTED', 'DEPLOYED'];

export default function CreativesPage() {
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');

  const { data: creatives, isLoading } = trpc.creatives.getAll.useQuery({
    ...(statusFilter !== 'ALL' && { status: statusFilter as 'DRAFT' | 'APPROVED' | 'REJECTED' | 'DEPLOYED' }),
    limit: 100,
  });

  const { data: campaigns } = trpc.campaigns.getAll.useQuery();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-[1400px] mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Creative Library</h1>
          <p className="text-gray-400 text-sm mt-1">
            AI-generated ad creatives with compliance scores
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-neon-gold/20 border border-neon-gold/40 text-neon-gold rounded-lg hover:bg-neon-gold/30 transition-all text-sm font-medium"
          onClick={() => {/* TODO: open generate modal */}}
        >
          <Bot className="w-4 h-4" />
          Generate Creatives
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-all',
              statusFilter === f
                ? 'bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan'
                : 'glass text-gray-400 hover:text-white'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Creatives grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (creatives ?? []).length === 0 ? (
        <GlassCard className="text-center py-16">
          <Bot className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">No creatives yet.</p>
          <p className="text-gray-500 text-sm mt-2">
            Run the AI pipeline on a campaign to generate creatives automatically.
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {(creatives ?? []).map((creative: any) => (
              <motion.div
                key={creative.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <GlassCard className="h-full flex flex-col">
                  {/* Creative header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {creative.format?.includes('VIDEO') ? (
                        <Video className="w-4 h-4 text-neon-purple" />
                      ) : (
                        <Image className="w-4 h-4 text-neon-cyan" />
                      )}
                      <span className="text-xs text-gray-400">{creative.format}</span>
                    </div>
                    <span className={cn(
                      'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border',
                      STATUS_STYLES[creative.status] ?? 'text-gray-400'
                    )}>
                      {STATUS_ICONS[creative.status]}
                      {creative.status}
                    </span>
                  </div>

                  {/* Preview image */}
                  {creative.imageUrl ? (
                    <div className="aspect-video bg-surface-raised rounded-lg overflow-hidden mb-3">
                      <img
                        src={creative.imageUrl}
                        alt={creative.headline}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-surface-raised rounded-lg flex items-center justify-center mb-3">
                      <span className="text-gray-500 text-xs">No preview</span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-white text-sm leading-tight mb-1">
                      {creative.headline}
                    </h3>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      {creative.description}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                    <div className="text-xs text-gray-400">
                      {creative.generativeModel ?? 'Manual'}
                    </div>
                    {creative.complianceScore !== null && creative.complianceScore !== undefined && (
                      <div className={cn(
                        'text-xs font-medium',
                        creative.complianceScore >= 0.85 ? 'text-neon-green' :
                        creative.complianceScore >= 0.60 ? 'text-yellow-400' : 'text-neon-red'
                      )}>
                        Compliance: {Math.round(creative.complianceScore * 100)}%
                      </div>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
