import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import '../styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Omkar AdTech — AI Marketing Command Center',
  description:
    'AI-driven marketing engine for Google Ads & Meta Ads — Omkar AI Innovation',
  keywords: ['AI Marketing', 'Google Ads', 'Meta Ads', 'Lead Generation', 'AI Workshop'],
  authors: [{ name: 'Omkar AI Innovation' }],
  themeColor: '#0A1628',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans bg-surface-deep text-white antialiased`}>
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
