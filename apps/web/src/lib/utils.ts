import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format INR paisa to display string: 150000 → "₹1,500"
export function formatINR(paisa: number): string {
  const rupees = paisa / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

// Format large numbers: 1200000 → "12L", 1000000000 → "1Cr"
export function formatIndianNumber(num: number): string {
  if (num >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Format ROAS: 3.5 → "3.5x"
export function formatROAS(roas: number): string {
  return `${roas.toFixed(2)}x`;
}

// Format percentage: 0.045 → "4.5%"
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// Relative time: "2 hours ago"
export function relativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-IN');
}

// Platform badge color
export function platformColor(platform: 'GOOGLE' | 'META'): string {
  return platform === 'GOOGLE' ? 'badge-google' : 'badge-meta';
}

// Status color mapping
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'text-neon-green',
    PAUSED: 'text-yellow-400',
    ARCHIVED: 'text-gray-500',
    DRAFT: 'text-gray-400',
    APPROVED: 'text-neon-green',
    REJECTED: 'text-neon-red',
    DEPLOYED: 'text-neon-cyan',
    NEW: 'text-neon-cyan',
    QUALIFYING: 'text-yellow-400',
    QUALIFIED: 'text-neon-green',
    ATTENDING: 'text-neon-purple',
    ENROLLED: 'text-neon-gold',
    LOST: 'text-neon-red',
  };
  return map[status] ?? 'text-gray-400';
}
