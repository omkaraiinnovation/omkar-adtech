/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: 'class',
  content: [],
  theme: {
    extend: {
      colors: {
        // Dark Glassmorphism Design System — Billionaire Aesthetic
        'surface-deep': '#0A1628',    // Deepest background canvas
        'surface-mid': '#0D2137',     // Card and panel backgrounds
        'surface-raised': '#1A3A5C', // Elevated/active panels
        'glass-border': 'rgba(255,255,255,0.08)',
        'neon-gold': '#D4A017',       // Primary CTA, critical alerts
        'neon-cyan': '#00B4D8',       // KPI values, secondary highlights
        'neon-green': '#00C896',      // Positive metrics, ROAS gains
        'neon-purple': '#8B5CF6',     // Meta platform metrics
        'neon-red': '#EF4444',        // Anomaly alerts, budget overruns
      },
      backdropBlur: {
        glass: '20px',
        'glass-lg': '40px',
      },
      boxShadow: {
        glass: '0 4px 24px -1px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glass-hover': '0 8px 40px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.10)',
        'glow-gold': '0 0 20px rgba(212,160,23,0.4), 0 0 60px rgba(212,160,23,0.15)',
        'glow-cyan': '0 0 20px rgba(0,180,216,0.4), 0 0 60px rgba(0,180,216,0.15)',
        'glow-green': '0 0 20px rgba(0,200,150,0.4)',
        'glow-red': '0 0 20px rgba(239,68,68,0.4)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      // Extend opacity scale so glass-style modifiers like /8, /12, /15 work
      opacity: {
        3: '0.03',
        5: '0.05',
        8: '0.08',
        12: '0.12',
        15: '0.15',
        18: '0.18',
        35: '0.35',
        45: '0.45',
        55: '0.55',
        65: '0.65',
        85: '0.85',
        95: '0.95',
      },
    },
  },
  plugins: [],
};

module.exports = config;
