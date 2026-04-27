import type { Metadata } from 'next';
import Image from 'next/image';
import './globals.css';

export const metadata: Metadata = {
  title: 'Creative AI Analyst — kedet',
  description: 'AI-powered ad creative generation and analysis.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <header className="border-b border-[var(--color-cream-200)] bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 sm:px-10">
            <Image
              src="/kedet-logo.png"
              alt="kedet"
              width={144}
              height={56}
              priority
              className="h-12 w-auto"
            />
            <span className="text-xs font-medium text-[var(--color-ink-500)]">
              Creative AI Analyst
            </span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
