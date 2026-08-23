'use client';

import { usePathname } from 'next/navigation';

import { useProfile } from '../lib/profile';

/** Nav item that marks itself active from the current route. */
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.ReactElement {
  const pathname = usePathname();

  return (
    <a href={href} className="nav-link" data-active={pathname.startsWith(href)}>
      {children}
    </a>
  );
}

/**
 * Shows who the session belongs to and offers to forget them.
 *
 * There is no account to sign out of — the profile lives in this browser — so
 * the control says what it actually does rather than borrowing the language of
 * authentication.
 */
export function ProfileBadge(): React.ReactElement | null {
  const { profile, ready, clear } = useProfile();

  if (!ready || !profile) return null;

  return (
    <span className="flex items-center gap-2 text-[12px] text-[var(--text-faint)]">
      <span className="hidden sm:inline">{profile.name || 'CV loaded'}</span>
      <button
        className="text-[var(--text-muted)] transition-colors hover:text-[var(--ghost)]"
        onClick={clear}
        title="Remove your CV from this browser"
      >
        Clear
      </button>
    </span>
  );
}
