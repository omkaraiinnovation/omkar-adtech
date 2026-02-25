import React from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { TRPCProvider } from '@/lib/trpc-provider';
import { DashboardErrorBoundary } from '@/components/dashboard/DashboardErrorBoundary';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <TRPCProvider>
      <div className="flex h-screen bg-surface-deep overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <DashboardNav />
          <main className="flex-1 overflow-y-auto p-6">
            {/* Error boundary isolates page-level errors from the shell */}
            <DashboardErrorBoundary>
              {children}
            </DashboardErrorBoundary>
          </main>
        </div>
      </div>
    </TRPCProvider>
  );
}
