'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  Users,
  TrendingUp,
  Target,
} from 'lucide-react';
import { KPICard } from '@/components/ui/KPICard';
import { CampaignTable } from '@/components/dashboard/CampaignTable';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { AgentActivityFeed } from '@/components/dashboard/AgentActivityFeed';
import { BudgetHeatmap } from '@/components/dashboard/BudgetHeatmap';
import { LeadPipeline } from '@/components/dashboard/LeadPipeline';
import { trpc } from '@/lib/trpc';
import { formatINR, formatROAS, formatIndianNumber } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export default function DashboardPage() {
  const { data: overviewRaw, isLoading } = trpc.dashboard.getOverview.useQuery({ range: '30d' });
  const overview = overviewRaw as any;
  const { data: campaigns, isLoading: campaignsLoading } = trpc.campaigns.getAll.useQuery();

  const kpis = overview?.kpis;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-[1600px] mx-auto"
    >
      {/* Page header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-white">Command Center</h1>
        <p className="text-gray-400 text-sm mt-1">
          AI-driven ad performance — last 30 days
        </p>
      </motion.div>

      {/* ===== KPI ROW ===== */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <KPICard
          title="Total Ad Spend"
          value={kpis?.totalSpendPaisa ?? 0}
          {...(kpis && { displayValue: formatINR(kpis.totalSpendPaisa) })}
          icon={<DollarSign className="w-4 h-4" />}
          color="gold"
          loading={isLoading}
        />
        <KPICard
          title="Total Leads"
          value={kpis?.totalLeads ?? 0}
          icon={<Users className="w-4 h-4" />}
          color="cyan"
          loading={isLoading}
        />
        <KPICard
          title="Avg ROAS"
          value={kpis?.avgRoas ?? 0}
          {...(kpis && { displayValue: formatROAS(kpis.avgRoas) })}
          icon={<TrendingUp className="w-4 h-4" />}
          color="green"
          loading={isLoading}
        />
        <KPICard
          title="Avg Cost Per Lead"
          value={kpis?.avgCplPaisa ?? 0}
          {...(kpis && { displayValue: formatINR(kpis.avgCplPaisa) })}
          icon={<Target className="w-4 h-4" />}
          color="purple"
          loading={isLoading}
        />
      </motion.div>

      {/* ===== MAIN GRID ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Performance chart — spans 2 cols */}
        <motion.div variants={itemVariants} className="xl:col-span-2">
          <PerformanceChart />
        </motion.div>

        {/* Agent activity feed */}
        <motion.div variants={itemVariants}>
          <AgentActivityFeed />
        </motion.div>
      </div>

      {/* ===== CAMPAIGN TABLE ===== */}
      <motion.div variants={itemVariants}>
        <CampaignTable campaigns={campaigns ?? []} loading={campaignsLoading} />
      </motion.div>

      {/* ===== BUDGET HEATMAP + LEAD PIPELINE ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <BudgetHeatmap />
        </motion.div>
        <motion.div variants={itemVariants}>
          <LeadPipeline />
        </motion.div>
      </div>
    </motion.div>
  );
}
