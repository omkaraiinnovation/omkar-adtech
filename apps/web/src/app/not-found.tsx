import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-deep flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-8xl font-bold text-neon-gold/20 mb-4 select-none">404</div>
        <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-gray-400 text-sm mb-8">
          The page you&apos;re looking for doesn&apos;t exist or was moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-neon-gold/20 border border-neon-gold/40 text-neon-gold rounded-lg hover:bg-neon-gold/30 transition-all text-sm font-medium"
        >
          <Home className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
