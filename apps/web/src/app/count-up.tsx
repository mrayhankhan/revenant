'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts up to a value once it scrolls into view.
 *
 * The animation is decoration; the number is information. Browsers do not run
 * requestAnimationFrame in a hidden tab, so a timer guarantees the final value
 * lands regardless — a stat that reads zero because the page opened in a
 * background tab is worse than one that never animated.
 */
export function CountUp({ to, duration = 1100 }: { to: number; duration?: number }): React.ReactElement {
  const [value, setValue] = useState(to);
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || to === 0) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const run = (): void => {
      if (started.current) return;
      started.current = true;

      setValue(0);
      const start = performance.now();
      let frame = 0;

      const tick = (now: number): void => {
        const progress = Math.min(1, (now - start) / duration);
        setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };

      if (document.visibilityState === 'visible') frame = requestAnimationFrame(tick);
      const settle = setTimeout(() => setValue(to), duration + 150);

      cleanup = () => {
        cancelAnimationFrame(frame);
        clearTimeout(settle);
      };
    };

    let cleanup: (() => void) | undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      cleanup?.();
    };
  }, [to, duration]);

  return <span ref={ref}>{value.toLocaleString()}</span>;
}
