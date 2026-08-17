import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Revenant – Job Feed That Knows What\'s Dead',
  description: 'Detect ghost jobs, track liveness, never apply to a role that was filled weeks ago.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <nav className="border-b bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight">
                <span className="text-live">◆</span> Revenant
              </h1>
              <div className="flex gap-6">
                <a href="/feed" className="text-sm font-medium hover:text-live">
                  Feed
                </a>
                <a href="/health" className="text-sm font-medium hover:text-live">
                  Health
                </a>
              </div>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
