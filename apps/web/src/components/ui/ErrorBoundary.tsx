'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback UI. If not provided, renders the default error card. */
  fallback?: React.ReactNode;
  /** Called when an error is caught. Use for Sentry reporting. */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React class-based error boundary for runtime errors in the dashboard.
 *
 * Catches errors thrown during render, in lifecycle methods, and in
 * constructors of descendant components. Does NOT catch:
 * - Async errors (use try/catch or React Query's error states)
 * - Event handler errors
 * - Server-side errors
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Report to Sentry / monitoring
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <DefaultErrorUI
        error={this.state.error}
        onReset={this.handleReset}
      />
    );
  }
}

// ============================================================
// Default error fallback UI — dark glassmorphism style
// ============================================================

interface DefaultErrorUIProps {
  error: Error | null;
  onReset: () => void;
}

function DefaultErrorUI({ error, onReset }: DefaultErrorUIProps) {
  return (
    <div className="flex items-center justify-center min-h-[300px] p-6">
      <GlassCard className="max-w-md w-full text-center" glow="gold">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-neon-red/20 rounded-full">
            <AlertTriangle className="w-8 h-8 text-neon-red" />
          </div>
        </div>

        <h2 className="text-lg font-semibold text-white mb-2">
          Something went wrong
        </h2>

        <p className="text-gray-400 text-sm mb-4 leading-relaxed">
          An unexpected error occurred in this section. The rest of the
          dashboard should continue working normally.
        </p>

        {process.env.NODE_ENV === 'development' && error && (
          <details className="mb-4 text-left">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400 mb-1">
              Error details
            </summary>
            <pre className="text-xs text-neon-red bg-surface-deep rounded p-3 overflow-auto max-h-32 leading-relaxed">
              {error.message}
              {'\n'}
              {error.stack}
            </pre>
          </details>
        )}

        <button
          onClick={onReset}
          className="flex items-center gap-2 mx-auto px-4 py-2 bg-neon-gold/20 border border-neon-gold/40 text-neon-gold rounded-lg hover:bg-neon-gold/30 transition-all text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </GlassCard>
    </div>
  );
}

/**
 * Lightweight wrapper component for use without needing a class component.
 * Usage: <ErrorBoundaryWrapper>...</ErrorBoundaryWrapper>
 */
export function ErrorBoundaryWrapper({
  children,
  fallback,
  onError,
}: ErrorBoundaryProps) {
  return (
    <ErrorBoundary
      {...(fallback !== undefined && { fallback })}
      {...(onError !== undefined && { onError })}
    >
      {children}
    </ErrorBoundary>
  );
}
