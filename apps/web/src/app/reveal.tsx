'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

/**
 * Reveals its children once they scroll into view.
 *
 * Content that animates in on page load is invisible to anyone who arrives
 * further down the page, so this waits for the element itself rather than for
 * the document. It unobserves after firing — a section that re-animates every
 * time it scrolls past is a distraction, not a flourish.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}): React.ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Anything already on screen at mount should not wait for a scroll that may
    // never come.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={clsx('transition-all duration-[720ms] ease-out', className)}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(18px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
