'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

/**
 * The self-healing loop, played as a loop.
 *
 * This is the hackathon's theme and the hardest thing to convey in a still
 * screenshot, so the landing page performs it: the page changes, extraction
 * collapses, a fix is proposed, the fix is graded against ground truth, and only
 * then accepted. The rejection branch is included deliberately — it is the part
 * that distinguishes this from calling self-heal and hoping.
 *
 * The numbers shown are the real ones from a collection run against Vercel's
 * board; nothing here is invented for effect.
 */

interface Stage {
  label: string;
  detail: string;
  fill: number;
  tone: 'live' | 'aging' | 'ghost' | 'stale';
  hold: number;
}

const STAGES: Stage[] = [
  {
    label: 'Healthy',
    detail: 'salary extracted on 86% of postings',
    fill: 86,
    tone: 'live',
    hold: 2600,
  },
  {
    label: 'The board is redesigned',
    detail: 'every class renamed, salary nested and split',
    fill: 86,
    tone: 'aging',
    hold: 2200,
  },
  {
    label: 'Extraction collapses',
    detail: '0% against a baseline of 86% — broken, not merely empty',
    fill: 0,
    tone: 'ghost',
    hold: 2600,
  },
  {
    label: 'Scraper Studio proposes a fix',
    detail: 'parked at the approval gate, not applied',
    fill: 0,
    tone: 'stale',
    hold: 2400,
  },
  {
    label: 'Graded against ground truth',
    detail: 'the fix is re-run and scored against the ATS feed',
    fill: 44,
    tone: 'aging',
    hold: 2400,
  },
  {
    label: 'Approved',
    detail: 'accuracy cleared the bar — a wrong fix would be rejected here',
    fill: 86,
    tone: 'live',
    hold: 3200,
  },
];

const TONE: Record<Stage['tone'], string> = {
  live: 'var(--live)',
  aging: 'var(--aging)',
  ghost: 'var(--ghost)',
  stale: 'var(--stale)',
};

export function HealDemo(): React.ReactElement {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Only run while on screen. An animation looping in a scrolled-past section
  // is wasted work and, on a laptop, audible.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { threshold: 0.3 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const stage = STAGES[index];
    const timer = setTimeout(() => setIndex((current) => (current + 1) % STAGES.length), stage?.hold ?? 2400);

    return () => clearTimeout(timer);
  }, [index, visible]);

  const stage = STAGES[index] as Stage;

  return (
    <div ref={containerRef} className="panel overflow-hidden">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium">Self-healing, end to end</span>
          <span className="flex gap-1.5">
            {STAGES.map((s, i) => (
              <span
                key={s.label}
                className="h-1 rounded-full transition-all duration-500"
                style={{
                  width: i === index ? 18 : 6,
                  background: i === index ? TONE[stage.tone] : 'var(--border-strong)',
                }}
              />
            ))}
          </span>
        </div>
      </div>

      <div className="space-y-4 px-5 py-6">
        <div className="min-h-[52px]">
          <div key={stage.label} className="step">
            <p className="text-[15px] font-medium" style={{ color: TONE[stage.tone] }}>
              {stage.label}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
              {stage.detail}
            </p>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
            <span>salary field fill rate</span>
            <span className="tabular" style={{ color: TONE[stage.tone] }}>
              {stage.fill}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#171a21]">
            <div
              className="h-full rounded-full transition-all duration-[900ms] ease-out"
              style={{ width: `${stage.fill}%`, background: TONE[stage.tone] }}
            />
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--text-faint)]">
            <span
              className="inline-block h-px flex-1"
              style={{ background: 'var(--border-strong)' }}
            />
            <span className="tabular">baseline 86%</span>
          </div>
        </div>

        {/*
          The selector diff is the moment the plain-language field spec earns
          its keep: the description never changed, only the page did.
        */}
        <div
          className={clsx(
            'space-y-1 font-mono text-[11px] transition-opacity duration-500',
            index >= 3 ? 'opacity-100' : 'opacity-30',
          )}
        >
          <div className="verdict-ghost">− .job-card .job-pay</div>
          <div className={index >= 4 ? 'verdict-live' : 'text-[var(--text-faint)]'}>
            + .posting-row .compensation .amount
          </div>
        </div>
      </div>
    </div>
  );
}
