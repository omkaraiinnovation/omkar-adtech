'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, CheckCircle, XCircle, Clock } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { trpc } from '@/lib/trpc';
import { relativeTime, cn } from '@/lib/utils';

const AGENT_COLORS: Record<string, string> = {
  CreativeAssemblyAgent: 'text-neon-cyan',
  ContextEvaluationAgent: 'text-neon-purple',
  GenerativeOutputAgent: 'text-neon-gold',
  ComplianceAuditorAgent: 'text-yellow-400',
  IdentityResolutionAgent: 'text-blue-400',
  PerformanceMonitorAgent: 'text-neon-green',
};

const STATUS_ICON = {
  SUCCESS: <CheckCircle className="w-3.5 h-3.5 text-neon-green" />,
  FAILED: <XCircle className="w-3.5 h-3.5 text-neon-red" />,
  RUNNING: <Clock className="w-3.5 h-3.5 text-yellow-400 animate-spin" />,
  SKIPPED: <Clock className="w-3.5 h-3.5 text-gray-500" />,
};

export function AgentActivityFeed() {
  const { data: logs, isLoading } = trpc.agents.getLogs.useQuery({ limit: 20 });

  return (
    <GlassCard className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="w-4 h-4 text-neon-cyan" />
        <h3 className="font-semibold text-white">AI Agent Activity</h3>
        <span className="ml-auto w-2 h-2 rounded-full bg-neon-green animate-pulse-slow" />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 max-h-[400px] pr-1">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-2 rounded-lg bg-surface-raised/40">
                <div className="skeleton w-3.5 h-3.5 rounded-full mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3 w-3/4 rounded" />
                  <div className="skeleton h-2.5 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && (!logs || logs.length === 0) && (
          <p className="text-center text-gray-500 text-sm py-8">No agent activity yet</p>
        )}

        <AnimatePresence>
          {logs?.map((log: any) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex gap-3 p-2.5 rounded-lg bg-surface-raised/30 hover:bg-surface-raised/50 transition-colors"
            >
              <div className="mt-0.5 flex-shrink-0">
                {STATUS_ICON[log.status as keyof typeof STATUS_ICON]}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-medium truncate', AGENT_COLORS[log.agentName] ?? 'text-gray-300')}>
                  {log.agentName.replace('Agent', '')}
                </p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{log.action}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {relativeTime(new Date(log.createdAt))} · {log.ms}ms
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}
