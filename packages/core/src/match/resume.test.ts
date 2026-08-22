import { describe, expect, it } from 'vitest';

import { extractSkills } from './skills.js';
import { detectSeniority, matchPosting, parseResume, tailoringSuggestions } from './resume.js';
import type { RawPosting } from '../schema/posting.js';

function posting(overrides: Partial<RawPosting> = {}): RawPosting {
  return {
    sourceKey: '1',
    sourceUrl: 'https://example.com/jobs/1',
    title: 'Senior Backend Engineer',
    company: 'Acme',
    location: 'Berlin',
    remotePolicy: 'hybrid',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    employmentType: 'full_time',
    postedAt: null,
    descriptionHtml: '<p>You will work with Python, PostgreSQL and Kubernetes.</p>',
    applyUrl: 'https://example.com/apply/1',
    ...overrides,
  };
}

describe('extractSkills', () => {
  it('finds skills regardless of the spelling used', () => {
    expect(extractSkills('Experience with k8s and TypeScript')).toEqual(
      new Set(['kubernetes', 'typescript']),
    );
  });

  it('handles names containing punctuation', () => {
    const skills = extractSkills('Strong C++, C# and Node.js background');

    expect(skills.has('cpp')).toBe(true);
    expect(skills.has('csharp')).toBe(true);
    expect(skills.has('nodejs')).toBe(true);
  });

  // A naive substring search finds "go" inside "category" and "ml" inside "html".
  it('does not match a skill name buried inside another word', () => {
    const skills = extractSkills('Worked across every category of the organisation');

    expect(skills.has('go')).toBe(false);
  });

  it('returns nothing for empty input', () => {
    expect(extractSkills(null).size).toBe(0);
    expect(extractSkills('').size).toBe(0);
  });
});

describe('detectSeniority', () => {
  it('reads the level from a job title', () => {
    expect(detectSeniority('Staff Software Engineer')).toBe('staff');
    expect(detectSeniority('Junior Developer')).toBe('junior');
    expect(detectSeniority('Principal Engineer')).toBe('principal');
  });

  // "Senior" appears in plenty of principal-level titles, so the stronger
  // signal has to win regardless of which word comes first.
  it('prefers the more senior signal when a title carries both', () => {
    expect(detectSeniority('Principal / Senior Engineer')).toBe('principal');
  });

  it('defaults to mid when the title says nothing', () => {
    expect(detectSeniority('Software Engineer')).toBe('mid');
  });
});

describe('parseResume', () => {
  it('pulls skills, level and years out of a CV', () => {
    const profile = parseResume(
      'Senior Engineer with 8 years of experience in Python, Django and AWS.',
    );

    expect(profile.seniority).toBe('senior');
    expect(profile.years).toBe(8);
    expect(profile.skills.has('python')).toBe(true);
    expect(profile.skills.has('aws')).toBe(true);
  });

  it('notices a stated remote preference', () => {
    expect(parseResume('I prefer remote roles.').wantsRemote).toBe(true);
    expect(parseResume('Based in Berlin.').wantsRemote).toBe(false);
  });
});

describe('matchPosting', () => {
  it('scores a strong overlap highly and names the matched skills', () => {
    const profile = parseResume('Senior engineer. Python, PostgreSQL, Kubernetes, Docker.');

    const match = matchPosting(profile, posting());

    expect(match.score).toBeGreaterThan(85);
    expect(match.missing).toHaveLength(0);
    expect(match.reasons[0]).toContain('Matches your');
  });

  // The output a job seeker can actually act on.
  it('names what is missing rather than only scoring it down', () => {
    const profile = parseResume('Senior engineer. Python only.');

    const match = matchPosting(profile, posting());

    expect(match.missing).toContain('kubernetes');
    expect(match.reasons.some((r) => r.includes('not mentioned on your CV'))).toBe(true);
  });

  it('penalises a large seniority gap in both directions', () => {
    const junior = parseResume('Junior developer. Python, PostgreSQL, Kubernetes.');
    const director = parseResume('Director of Engineering. Python, PostgreSQL, Kubernetes.');
    const senior = parseResume('Senior engineer. Python, PostgreSQL, Kubernetes.');

    const fit = matchPosting(senior, posting()).score;

    expect(matchPosting(junior, posting()).score).toBeLessThan(fit);
    expect(matchPosting(director, posting()).score).toBeLessThan(fit);
  });

  /*
   * A live run put "Sr. Engagement Manager" top of a backend engineer's results
   * because the posting mentioned AWS once and nothing else — 1/1 coverage
   * beating a posting that named eight requirements and matched all of them.
   */
  it('does not let one lucky keyword outrank a thoroughly matched posting', () => {
    const profile = parseResume(
      'Senior engineer. Python, Go, Kubernetes, AWS, PostgreSQL, Kafka, Airflow, dbt.',
    );

    const vague = matchPosting(
      profile,
      posting({
        title: 'Senior Engagement Manager',
        descriptionHtml: '<p>Work with customers. Some familiarity with AWS helps.</p>',
      }),
    );
    const thorough = matchPosting(
      profile,
      posting({
        title: 'Senior Backend Engineer',
        descriptionHtml:
          '<p>Python and Go services on Kubernetes and AWS, with PostgreSQL, Kafka and Airflow.</p>',
      }),
    );

    expect(thorough.score).toBeGreaterThan(vague.score);
  });

  it('pulls a posting naming very few skills toward the middle', () => {
    const profile = parseResume('Senior engineer. Python, Go, Kubernetes, AWS, PostgreSQL.');

    const vague = matchPosting(
      profile,
      posting({ title: 'Manager', descriptionHtml: '<p>Some AWS exposure.</p>' }),
    );

    expect(vague.score).toBeLessThan(85);
  });

  it('scores a posting naming no known skills as neutral, not zero', () => {
    const profile = parseResume('Senior engineer. Python.');

    const match = matchPosting(
      profile,
      posting({ title: 'Office Manager', descriptionHtml: '<p>Keep the office running.</p>' }),
    );

    expect(match.score).toBeGreaterThan(20);
    expect(match.score).toBeLessThan(80);
  });

  it('flags an on-site role for someone who wants remote', () => {
    const profile = parseResume('Senior engineer, prefers remote. Python.');

    const match = matchPosting(profile, posting({ remotePolicy: 'onsite' }));

    expect(match.reasons.some((r) => r.includes('prefer remote'))).toBe(true);
  });

  it('always produces at least one reason', () => {
    const match = matchPosting(parseResume('Engineer.'), posting({ descriptionHtml: null }));

    expect(match.reasons.length).toBeGreaterThan(0);
  });
});

describe('tailoringSuggestions', () => {
  // A change the user cannot trace back to the posting is one they must take
  // on faith, so each suggestion carries the sentence that motivates it.
  it('ties every suggestion to the sentence that asks for it', () => {
    const profile = parseResume('Engineer. Python.');

    const suggestions = tailoringSuggestions(
      profile,
      posting({
        descriptionHtml:
          '<p>You will build services in Python.</p><p>You will run them on Kubernetes at scale.</p>',
      }),
    );

    const kubernetes = suggestions.find((s) => s.skill === 'kubernetes');

    expect(kubernetes?.evidence).toContain('Kubernetes');
    expect(kubernetes?.label).toBe('Kubernetes');
  });

  it('suggests nothing when the CV already covers the posting', () => {
    const profile = parseResume('Python, PostgreSQL, Kubernetes engineer.');

    expect(tailoringSuggestions(profile, posting())).toHaveLength(0);
  });

  it('never suggests a skill the CV already has', () => {
    const profile = parseResume('Python and Kubernetes engineer.');

    const suggestions = tailoringSuggestions(profile, posting());

    expect(suggestions.map((s) => s.skill)).not.toContain('python');
  });
});
