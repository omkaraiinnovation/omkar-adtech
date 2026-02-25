'use client';

import React from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

/**
 * Client-side error boundary for the main dashboard content area.
 * Isolates runtime errors to individual page sections without
 * crashing the entire layout (sidebar + nav remain functional).
 */
export function DashboardErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // In production, send to Sentry
        if (process.env.NODE_ENV === 'production') {
          // Sentry.captureException(error, { extra: errorInfo });
          console.error('[Dashboard] Uncaught render error:', error.message);
        }
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
