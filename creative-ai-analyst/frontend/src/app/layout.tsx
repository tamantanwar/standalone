import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Creative AI Analyst',
  description: 'AI-powered ad creative generation and analysis.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-50 text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
