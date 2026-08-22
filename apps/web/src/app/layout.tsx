import type { Metadata } from 'next';

import './globals.css';
import { NavLink } from './nav-link';

export const metadata: Metadata = {
  title: 'Revenant — the job feed that knows what is dead',
  description:
    'Ghost-job detection and self-healing collectors. Every listing carries a liveness score and the reason behind it.',
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en">
      <body>
        <nav className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgba(8,9,11,0.85)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
            <a href="/" className="flex items-baseline gap-2.5">
              <span className="text-[15px] font-semibold tracking-tight">Revenant</span>
              <span className="hidden text-xs text-[var(--text-faint)] sm:inline">
                the job feed that knows what is dead
              </span>
            </a>
            <div className="flex items-center gap-6">
              <NavLink href="/feed">Feed</NavLink>
              <NavLink href="/match">Match</NavLink>
              <NavLink href="/health">Health</NavLink>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
