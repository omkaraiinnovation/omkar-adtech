'use client';

import React, { useState } from 'react';
import { Bell, Calendar, ChevronDown } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const DATE_RANGES = ['7d', '30d', '90d'] as const;
type DateRange = typeof DATE_RANGES[number];

export function DashboardNav() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [alertCount] = useState(3); // TODO: fetch from real alert system

  return (
    <header className="glass border-b border-white/8 px-6 py-3 flex items-center justify-between flex-shrink-0">
      {/* Date range picker */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-400" />
        <div className="flex bg-surface-deep rounded-lg p-1 gap-1">
          {DATE_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all duration-200',
                dateRange === range
                  ? 'bg-neon-cyan/20 text-neon-cyan'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              Last {range}
            </button>
          ))}
        </div>
      </div>

      {/* Platform filter + alerts + user */}
      <div className="flex items-center gap-4">
        {/* Platform selector */}
        <button className="flex items-center gap-2 glass rounded-lg px-3 py-2 text-sm text-gray-300 hover:text-white transition-all">
          <span>All Platforms</span>
          <ChevronDown className="w-3 h-3" />
        </button>

        {/* Alert bell */}
        <button className="relative p-2 glass rounded-lg hover:bg-surface-raised transition-all">
          <Bell className="w-4 h-4 text-gray-400" />
          {alertCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-4 h-4 bg-neon-gold text-surface-deep text-xs font-bold rounded-full flex items-center justify-center"
            >
              {alertCount}
            </motion.span>
          )}
        </button>

        {/* Clerk user button */}
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8',
            },
          }}
        />
      </div>
    </header>
  );
}
