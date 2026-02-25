'use client';

/**
 * Next.js 14 App Router error boundary for the dashboard segment.
 *
 * This file activates automatically when a runtime error is thrown in any
 * dashboard page. It complements the class-based ErrorBoundary for
 * segment-level recovery with the built-in Next.js error boundary mechanism.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Report to Sentry in production
    if (process.env.NODE_ENV === 'production') {
      // Sentry.captureException(error);
      console.error('[Dashboard Error]', error.message, error.digest);
    }
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="bg-surface-mid/60 backdrop-blur-[20px] border border-white/8 shadow-glass rounded-xl p-8 max-w-md w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="p-4 bg-neon-red/15 rounded-full">
            <AlertTriangle className="w-10 h-10 text-neon-red" />
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-xl font-bold text-white mb-2">
          Dashboard Error
        </h2>
        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
          An unexpected error occurred while loading this page.
          Your data is safe — this is a display issue only.
        </p>

        {/* Error details in dev */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400 mb-2 select-none">
              Technical details
            </summary>
            <div className="bg-surface-deep rounded-lg p-3 text-xs text-neon-red font-mono overflow-auto max-h-40 space-y-1">
              <div>{error.message}</div>
              {error.digest && (
                <div className="text-gray-500">Digest: {error.digest}</div>
              )}
            </div>
          </details>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 bg-neon-gold/20 border border-neon-gold/40 text-neon-gold rounded-lg hover:bg-neon-gold/30 transition-all text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 glass text-gray-400 hover:text-white rounded-lg transition-all text-sm font-medium"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
