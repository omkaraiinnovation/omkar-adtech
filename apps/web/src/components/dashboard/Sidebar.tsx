'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Megaphone,
  Users,
  ImagePlay,
  Wallet,
  Bot,
  Settings,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Command Center', icon: LayoutDashboard },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/leads', label: 'Lead Pipeline', icon: Users },
  { href: '/creatives', label: 'Creative Studio', icon: ImagePlay },
  { href: '/budgets', label: 'MAB Budget', icon: Wallet },
  { href: '/agents', label: 'AI Agents', icon: Bot },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col glass border-r border-white/8 h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-gold to-neon-cyan flex items-center justify-center">
            <Zap className="w-4 h-4 text-surface-deep" />
          </div>
          <div>
            <p className="text-sm font-bold text-glow-gold">Omkar AdTech</p>
            <p className="text-xs text-gray-500">AI Marketing Engine</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={href} href={href}>
              <motion.div
                whileHover={{ x: 4 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-neon-cyan"
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/8">
        <Link href="/settings">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200">
            <Settings className="w-4 h-4" />
            Settings
          </div>
        </Link>
      </div>
    </aside>
  );
}
