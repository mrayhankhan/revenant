'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';

import { useProfile } from '../../lib/profile';

const SAMPLE_CV = `Senior Backend Engineer with 8 years of experience.

Built distributed services in Python and Go, running on Kubernetes across AWS.
Owned the data platform: PostgreSQL, Kafka and Airflow, with dbt for modelling.
Strong on testing and CI/CD; mentored two engineers.
Prefer remote roles.`;

const SENIORITY = ['junior', 'mid', 'senior', 'staff', 'principal', 'director'];

const STEPS = ['You', 'Your CV', 'Preferences'] as const;

export default function StartPage(): React.ReactElement {
  const router = useRouter();
  const { save } = useProfile();

  const [step, setStep] = useState(0);
  const [back, setBack] = useState(false);
  const [name, setName] = useState('');
  const [resume, setResume] = useState('');
  const [seniority, setSeniority] = useState<string | null>(null);
  const [wantsRemote, setWantsRemote] = useState(false);

  function go(next: number): void {
    setBack(next < step);
    setStep(next);
  }

  function finish(): void {
    save({ name: name.trim(), resume: resume.trim(), seniority, wantsRemote });
    router.push('/feed');
  }

  const canAdvance = step === 0 ? true : step === 1 ? resume.trim().length >= 40 : true;

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6">
      <div className="space-y-3">
        <div className="progress">
          <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="flex justify-between text-[11px] uppercase tracking-wide">
          {STEPS.map((label, index) => (
            <span
              key={label}
              className={clsx(
                'transition-colors duration-300',
                index <= step ? 'text-[var(--text)]' : 'text-[var(--text-faint)]',
              )}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div key={step} className={back ? 'step-back' : 'step'}>
        {step === 0 && (
          <section className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Let&rsquo;s find roles that are actually open.
              </h1>
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                Revenant scores every listing on whether it is still real, then ranks what is left
                against your experience. Three short steps, and nothing leaves your browser.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                What should we call you? <span className="normal-case">(optional)</span>
              </label>
              <input
                className="field"
                placeholder="Your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="panel p-4">
              <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                <span className="text-[var(--text)]">No account, and no data collection.</span> Your
                CV is kept in this browser and scored in memory. It is never stored on a server, and
                you can clear it at any time.
              </p>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Paste your CV</h1>
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                Enough to see your skills and level. We name every skill we recognise, so you can
                check what we read.
              </p>
            </div>

            <textarea
              className="field min-h-[220px] font-mono text-[13px] leading-relaxed"
              placeholder="Paste your CV here…"
              value={resume}
              onChange={(event) => setResume(event.target.value)}
            />

            <div className="flex items-center justify-between text-[12px]">
              <button className="btn btn-quiet" onClick={() => setResume(SAMPLE_CV)}>
                Use a sample CV
              </button>
              <span
                className={clsx(
                  'tabular transition-colors',
                  resume.trim().length >= 40 ? 'text-[var(--live)]' : 'text-[var(--text-faint)]',
                )}
              >
                {resume.trim().length} characters
              </span>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">A couple of preferences</h1>
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                Optional. These only adjust ranking — nothing is hidden from you.
              </p>
            </div>

            <div>
              <p className="mb-2 text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                Level you are targeting
              </p>
              <div className="flex flex-wrap gap-2">
                {SENIORITY.map((level) => (
                  <button
                    key={level}
                    className="chip capitalize"
                    data-selected={seniority === level}
                    onClick={() => setSeniority(seniority === level ? null : level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                Working arrangement
              </p>
              <button
                className="chip"
                data-selected={wantsRemote}
                onClick={() => setWantsRemote(!wantsRemote)}
              >
                I prefer remote
              </button>
            </div>
          </section>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border)] pt-5">
        <button
          className="btn btn-quiet"
          onClick={() => (step === 0 ? router.push('/feed') : go(step - 1))}
        >
          {step === 0 ? 'Skip, just show me the jobs' : 'Back'}
        </button>

        <button
          className="btn"
          disabled={!canAdvance}
          onClick={() => (step === STEPS.length - 1 ? finish() : go(step + 1))}
        >
          {step === STEPS.length - 1 ? 'See my matches' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
