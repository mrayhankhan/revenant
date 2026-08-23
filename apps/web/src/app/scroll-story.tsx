'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

/**
 * A scroll-driven explanation of what the project does.
 *
 * The story is hard to tell in a paragraph because it is a sequence: a role gets
 * filled, the listing stays up, the board changes shape, extraction breaks, the
 * fix is checked. Scroll is the natural control for a sequence — the reader sets
 * the pace, and each step holds until they move on.
 *
 * A sticky stage with the panel pinned, and the copy scrolling past it. Progress
 * is derived from the container's position rather than from a scroll library, so
 * there is nothing to load and nothing to fall out of sync.
 */

interface Chapter {
  eyebrow: string;
  title: string;
  body: string;
}

const CHAPTERS: Chapter[] = [
  {
    eyebrow: '01 — The listing',
    title: 'A role is posted.',
    body: 'It appears on the company’s own board, then on three aggregators. Everything agrees, and for a while everything is true.',
  },
  {
    eyebrow: '02 — The hire',
    title: 'The role gets filled.',
    body: 'The company removes it from their board. The aggregators do not notice, because nobody tells them and nobody checks. The listing stays up.',
  },
  {
    eyebrow: '03 — The ghost',
    title: 'You apply to a job that no longer exists.',
    body: 'Revenant reads both sources. Gone from the company’s board but still listed elsewhere is not a guess — it is the company contradicting the listing.',
  },
  {
    eyebrow: '04 — The redesign',
    title: 'The board changes shape.',
    body: 'Every class is renamed. The salary moves and splits across three elements. Selectors written against the old markup return nothing at all.',
  },
  {
    eyebrow: '05 — The repair',
    title: 'Scraper Studio proposes a fix.',
    body: 'It is not applied. A heal that binds to the wrong element refills the field perfectly and returns the wrong value — so the fix is graded against the platform’s own feed before anything is accepted.',
  },
];

const STAGE_COLOR = ['var(--live)', 'var(--aging)', 'var(--ghost)', 'var(--aging)', 'var(--live)'];

export function ScrollStory(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;

    const update = (): void => {
      const rect = container.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;

      // 0 when the container's top reaches the viewport top, 1 when its bottom
      // reaches the viewport bottom.
      const progress = Math.min(1, Math.max(0, -rect.top / scrollable));
      const index = Math.min(CHAPTERS.length - 1, Math.floor(progress * CHAPTERS.length));

      setActive((current) => (current === index ? current : index));
    };

    const onScroll = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative" style={{ height: `${CHAPTERS.length * 90}vh` }}>
      <div className="sticky top-[64px] flex min-h-[calc(100vh-64px)] items-center">
        <div className="grid w-full gap-10 lg:grid-cols-2 lg:items-center">
          {/* ---- Copy ------------------------------------------------------ */}
          <div className="relative min-h-[220px]">
            {CHAPTERS.map((chapter, index) => (
              <div
                key={chapter.eyebrow}
                aria-hidden={index !== active}
                className={clsx(
                  'transition-all duration-500 ease-out',
                  index === active
                    ? 'relative opacity-100 blur-0'
                    : 'pointer-events-none absolute inset-0 opacity-0 blur-[2px]',
                )}
                style={{ transform: index === active ? 'none' : 'translateY(14px)' }}
              >
                <p
                  className="text-[11px] uppercase tracking-[0.14em]"
                  style={{ color: STAGE_COLOR[index] }}
                >
                  {chapter.eyebrow}
                </p>
                <h3 className="display mt-3 text-[2.25rem] sm:text-[3rem]">
                  {chapter.title}
                </h3>
                <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[var(--text-muted)]">
                  {chapter.body}
                </p>
              </div>
            ))}

            {/* Chapter rail, which doubles as the progress indicator. */}
            <div className="mt-8 flex gap-2">
              {CHAPTERS.map((chapter, index) => (
                <span
                  key={chapter.eyebrow}
                  className="h-0.5 rounded-full transition-all duration-500"
                  style={{
                    width: index === active ? 34 : 16,
                    background: index <= active ? STAGE_COLOR[index] : 'var(--border-strong)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* ---- Stage ----------------------------------------------------- */}
          <StoryStage active={active} />
        </div>
      </div>
    </div>
  );
}

/**
 * The visual half. A single job card that is acted on by each chapter, rather
 * than five separate illustrations — the point is that one listing goes through
 * all of this.
 */
function StoryStage({ active }: { active: number }): React.ReactElement {
  const removed = active >= 1;
  const ghost = active >= 2;
  const broken = active === 3;
  const healed = active >= 4;

  return (
    <div className="panel relative overflow-hidden p-5 sm:p-7">
      <div className="mb-4 flex items-center justify-between text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
        <span>Northwind Robotics</span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full transition-colors duration-500"
            style={{ background: STAGE_COLOR[active] }}
          />
          {ghost && !healed ? 'contradiction found' : healed ? 'verified' : 'tracking'}
        </span>
      </div>

      {/* Two sources, side by side. The whole ghost argument is that they can
          disagree, so both have to be on screen at once. */}
      <div className="grid grid-cols-2 gap-3">
        <Source
          label="Company board"
          present={!removed}
          tone={removed ? 'var(--ghost)' : 'var(--live)'}
        />
        <Source label="Aggregator" present tone={ghost ? 'var(--ghost)' : 'var(--live)'} />
      </div>

      {/* The field, which breaks and is repaired in the last two chapters. */}
      <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
            Salary extraction
          </span>
          <span
            className="tabular text-[13px] font-medium transition-colors duration-500"
            style={{ color: broken ? 'var(--ghost)' : healed ? 'var(--live)' : 'var(--text-muted)' }}
          >
            {broken ? '0%' : '86%'}
          </span>
        </div>

        <div className="meter mt-2">
          <span
            className="!animate-none transition-all duration-700 ease-out"
            style={{
              width: broken ? '0%' : '86%',
              background: broken ? 'var(--ghost)' : healed ? 'var(--live)' : 'var(--text-faint)',
            }}
          />
        </div>

        <div
          className={clsx(
            'mt-3 space-y-1 font-mono text-[10.5px] transition-opacity duration-500',
            active >= 3 ? 'opacity-100' : 'opacity-0',
          )}
        >
          <div className="verdict-ghost">− .job-card .job-pay</div>
          <div className={healed ? 'verdict-live' : 'text-[var(--text-faint)]'}>
            + .posting-row .compensation .amount
          </div>
        </div>
      </div>

      <p
        className={clsx(
          'mt-4 text-[12px] leading-relaxed transition-opacity duration-500',
          ghost && !healed ? 'opacity-100' : 'opacity-0',
        )}
      >
        <span className="verdict-ghost">
          ✕ Removed from the company’s own board, but still listed elsewhere.
        </span>
      </p>
    </div>
  );
}

function Source({
  label,
  present,
  tone,
}: {
  label: string;
  present: boolean;
  tone: string;
}): React.ReactElement {
  return (
    <div
      className="rounded-lg border p-3 transition-all duration-500"
      style={{
        borderColor: present ? 'var(--border)' : 'var(--border-strong)',
        opacity: present ? 1 : 0.45,
      }}
    >
      <p className="text-[10.5px] uppercase tracking-wide text-[var(--text-faint)]">{label}</p>
      <p className="mt-2 text-[12.5px] leading-snug">Senior Robotics Engineer</p>
      <p className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: tone }}>
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
        {present ? 'listed' : 'removed'}
      </p>
    </div>
  );
}
