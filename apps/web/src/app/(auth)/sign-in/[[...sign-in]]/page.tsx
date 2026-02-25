import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-surface-deep flex items-center justify-center">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-gold/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-glow-gold">Omkar AdTech</h1>
          <p className="text-gray-400 mt-2">AI-Driven Marketing Command Center</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-surface-mid/80 backdrop-blur-glass border border-white/8 shadow-glass',
              headerTitle: 'text-white',
              headerSubtitle: 'text-gray-400',
              formButtonPrimary: 'bg-neon-cyan hover:bg-neon-cyan/90 text-surface-deep font-semibold',
              formFieldInput: 'bg-surface-raised border-white/10 text-white placeholder:text-gray-600',
              formFieldLabel: 'text-gray-400',
              footerActionLink: 'text-neon-cyan hover:text-neon-cyan/80',
            },
          }}
        />
      </div>
    </div>
  );
}
