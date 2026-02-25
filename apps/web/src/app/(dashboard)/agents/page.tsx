'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Play, CheckCircle2, XCircle, Clock, Zap, RefreshCw } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  RUNNING: 'text-neon-cyan',
  SUCCESS: 'text-neon-green',
  FAILED: 'text-neon-red',
  SKIPPED: 'text-gray-400',
};

const STATUS_ICONS = {
  RUNNING: <Clock className="w-4 h-4 animate-pulse" />,
  SUCCESS: <CheckCircle2 className="w-4 h-4" />,
  FAILED: <XCircle className="w-4 h-4" />,
  SKIPPED: <Clock className="w-4 h-4" />,
};

const AGENT_COLORS: Record<string, string> = {
  'ContextEvaluationAgent': 'text-neon-cyan',
  'CreativeAssemblyAgent': 'text-neon-purple',
  'GenerativeOutputAgent': 'text-neon-gold',
  'ComplianceAuditorAgent': 'text-neon-green',
  'IdentityResolutionAgent': 'text-neon-cyan',
  'PerformanceMonitorAgent': 'text-neon-green',
  'AdTechPipeline': 'text-neon-gold',
  'WhatsAppFSM': 'text-neon-purple',
  'MABEngine': 'text-neon-gold',
};

export default function AgentsPage() {
  const [agentFilter, setAgentFilter] = useState<string>('ALL');

  const { data: logs, isLoading, refetch } = trpc.agents.getLogs.useQuery({
    ...(agentFilter !== 'ALL' && { agentName: agentFilter }),
    limit: 100,
  });

  const { data: stats } = trpc.agents.getStats.useQuery();

  const logsTyped = (logs ?? []) as Array<{ agentName: string; id: string; status: string; action: string; ms: number; createdAt: Date; errorMessage: string | null }>;
  const uniqueAgents: string[] = ['ALL', ...new Set(logsTyped.map((l) => l.agentName))];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-[1400px] mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Agents</h1>
          <p className="text-gray-400 text-sm mt-1">
            Monitor the 6-agent LangGraph pipeline activity
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 glass rounded-lg text-gray-400 hover:text-white transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Runs', value: stats.total, color: 'text-white' },
            { label: 'Success Rate', value: `${stats.successRate}%`, color: 'text-neon-green' },
            { label: 'Failed', value: stats.failed, color: 'text-neon-red' },
            { label: 'Avg Duration', value: `${stats.avgMs}ms`, color: 'text-neon-cyan' },
          ].map((stat) => (
            <GlassCard key={stat.label} className="text-center py-3">
              <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Agent breakdown */}
      {stats?.agentBreakdown && stats.agentBreakdown.length > 0 && (
        <GlassCard>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Agent Activity Breakdown</h3>
          <div className="flex flex-wrap gap-3">
            {stats.agentBreakdown.map((agent: any) => (
              <div
                key={`${agent.agentName}-${agent.status}`}
                className="flex items-center gap-2 glass rounded-lg px-3 py-2"
              >
                <Bot className={cn('w-3.5 h-3.5', AGENT_COLORS[agent.agentName] ?? 'text-gray-400')} />
                <span className="text-xs text-gray-300">{agent.agentName}</span>
                <span className={cn('text-xs font-medium', STATUS_COLORS[agent.status as keyof typeof STATUS_COLORS] ?? 'text-gray-400')}>
                  {agent.status}
                </span>
                <span className="text-xs text-gray-500">({agent._count.id})</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Agent filter */}
      <div className="flex flex-wrap gap-2">
        {uniqueAgents.map((agent) => (
          <button
            key={agent}
            onClick={() => setAgentFilter(agent)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-all',
              agentFilter === agent
                ? 'bg-neon-gold/20 border border-neon-gold/40 text-neon-gold'
                : 'glass text-gray-400 hover:text-white'
            )}
          >
            {agent}
          </button>
        ))}
      </div>

      {/* Log feed */}
      {isLoading ? (
        <SkeletonCard />
      ) : (
        <GlassCard>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            <AnimatePresence>
              {logsTyped.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-3 p-3 glass rounded-lg hover:bg-surface-raised/30 transition-colors"
                >
                  {/* Status icon */}
                  <div className={cn('mt-0.5 shrink-0', STATUS_COLORS[log.status as keyof typeof STATUS_COLORS] ?? 'text-gray-400')}>
                    {STATUS_ICONS[log.status as keyof typeof STATUS_ICONS] ?? <Bot className="w-4 h-4" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-xs font-semibold', AGENT_COLORS[log.agentName] ?? 'text-gray-300')}>
                        {log.agentName}
                      </span>
                      <span className="text-xs text-gray-500">→</span>
                      <span className="text-xs text-gray-300">{log.action}</span>
                      <span className="text-xs text-gray-500">{log.ms}ms</span>
                    </div>
                    {log.errorMessage && (
                      <p className="text-xs text-neon-red mt-1">{log.errorMessage}</p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-xs text-gray-500 shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString('en-IN')}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {logsTyped.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-8">
                No agent runs yet. Trigger a campaign pipeline to see activity.
              </p>
            )}
          </div>
        </GlassCard>
      )}
    </motion.div>
  );
}
