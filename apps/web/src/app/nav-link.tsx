'use client';

import { usePathname } from 'next/navigation';

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
