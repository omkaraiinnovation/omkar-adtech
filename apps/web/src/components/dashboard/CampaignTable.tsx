'use client';

import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, Play, Pause, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { GlassCard } from '../ui/GlassCard';
import { SkeletonTable } from '../ui/Skeleton';
import { cn, formatINR, statusColor } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

// Local campaign shape — mirrors the Prisma Campaign model.
// Avoids importing @prisma/client into the Next.js client bundle.
interface CampaignRow {
  id: string;
  name: string;
  platform: 'GOOGLE' | 'META';
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  dailyBudget: number;
  objective: string;
  createdAt: Date | string;
}

const columnHelper = createColumnHelper<CampaignRow>();

interface CampaignTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  campaigns: any[];
  loading?: boolean;
}

export function CampaignTable({ campaigns, loading = false }: CampaignTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const utils = trpc.useUtils();

  const pauseMutation = trpc.campaigns.pause.useMutation({
    onSuccess: () => utils.campaigns.getAll.invalidate(),
  });
  const resumeMutation = trpc.campaigns.resume.useMutation({
    onSuccess: () => utils.campaigns.getAll.invalidate(),
  });

  const columns = [
    columnHelper.accessor('name', {
      header: 'Campaign',
      cell: (info) => (
        <Link href={`/campaigns/${info.row.original.id}`} className="hover:text-neon-cyan transition-colors font-medium">
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor('platform', {
      header: 'Platform',
      cell: (info) => (
        <span className={info.getValue() === 'GOOGLE' ? 'badge-google' : 'badge-meta'}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span className={cn('text-sm font-medium', statusColor(info.getValue()))}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('dailyBudget', {
      header: 'Daily Budget',
      cell: (info) => <span className="tabular-nums">{formatINR(info.getValue())}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const campaign = info.row.original as CampaignRow;
        const isPaused = campaign.status === 'PAUSED';
        const isActive = campaign.status === 'ACTIVE';
        return (
          <div className="flex items-center gap-2">
            {isActive && (
              <button
                onClick={() => pauseMutation.mutate({ id: campaign.id })}
                className="p-1.5 glass rounded-md hover:bg-yellow-500/10 hover:text-yellow-400 transition-all"
                title="Pause campaign"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            )}
            {isPaused && (
              <button
                onClick={() => resumeMutation.mutate({ id: campaign.id })}
                className="p-1.5 glass rounded-md hover:bg-neon-green/10 hover:text-neon-green transition-all"
                title="Resume campaign"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
            <Link
              href={`/campaigns/${campaign.id}`}
              className="p-1.5 glass rounded-md hover:bg-neon-cyan/10 hover:text-neon-cyan transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: (campaigns as CampaignRow[]) ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) return <SkeletonTable rows={5} />;

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Active Campaigns</h3>
        <Link
          href="/campaigns/new"
          className="text-xs font-medium text-neon-cyan border border-neon-cyan/30 px-3 py-1.5 rounded-lg hover:bg-neon-cyan/10 transition-all"
        >
          + New Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-8">
          No campaigns yet.{' '}
          <Link href="/campaigns/new" className="text-neon-cyan hover:underline">
            Create your first campaign
          </Link>
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-white/8">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="text-left py-2 px-3 text-xs font-medium text-gray-400 cursor-pointer hover:text-white transition-colors"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-white/5 hover:bg-surface-raised/30 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-3 px-3 text-gray-300">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
