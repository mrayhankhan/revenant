import { describe, expect, it } from 'vitest';

import { classifyLevel, classifyWorkMode, isInternship } from './classify.js';

describe('classifyLevel', () => {
  it('reads the obvious levels from a title', () => {
    expect(classifyLevel('Senior Backend Engineer')).toBe('senior');
    expect(classifyLevel('Junior Developer')).toBe('entry');
    expect(classifyLevel('Software Engineering Intern')).toBe('intern');
    expect(classifyLevel('Staff Engineer')).toBe('lead');
  });

  it('recognises the many words boards use for entry level', () => {
    for (const title of [
      'New Grad Software Engineer',
      'Graduate Analyst',
      'Fresher Developer',
      'Associate Product Manager',
      'Early Career Engineer',
    ]) {
      expect(classifyLevel(title)).toBe('entry');
    }
  });

  // Sending someone with no experience to a staff role is the expensive error,
  // so the more senior signal wins when a title carries both.
  it('prefers the more senior signal in a mixed title', () => {
    expect(classifyLevel('Senior Staff Engineer')).toBe('lead');
    expect(classifyLevel('Principal / Senior Architect')).toBe('lead');
  });

  it('treats an internship employment type as decisive', () => {
    expect(classifyLevel('Software Engineer', 'internship')).toBe('intern');
  });

  it('falls back to mid when nothing is stated', () => {
    expect(classifyLevel('Software Engineer')).toBe('mid');
    expect(classifyLevel(null)).toBe('mid');
  });
});

describe('classifyWorkMode', () => {
  it('uses the stated policy when there is one', () => {
    expect(classifyWorkMode('remote', 'Berlin')).toBe('remote');
    expect(classifyWorkMode('hybrid', 'Berlin')).toBe('hybrid');
  });

  // Boards very often put the arrangement only in the location field.
  it('reads the arrangement out of the location when the policy is empty', () => {
    expect(classifyWorkMode(null, 'Remote, Italy')).toBe('remote');
    expect(classifyWorkMode(null, 'Hybrid - San Francisco')).toBe('hybrid');
    expect(classifyWorkMode(null, 'In-office, London')).toBe('onsite');
    expect(classifyWorkMode('unstated', 'Distributed')).toBe('remote');
  });

  it('returns null when neither field says', () => {
    expect(classifyWorkMode(null, 'Berlin, Germany')).toBeNull();
    expect(classifyWorkMode(null, null)).toBeNull();
  });
});

describe('isInternship', () => {
  it('catches internships from either signal', () => {
    expect(isInternship('Data Science Intern', null)).toBe(true);
    expect(isInternship('Software Engineer', 'internship')).toBe(true);
    expect(isInternship('Summer Co-op Engineer', null)).toBe(true);
  });

  it('does not mistake ordinary roles for internships', () => {
    expect(isInternship('Senior Engineer', 'full_time')).toBe(false);
    // "International" contains "intern" and must not match.
    expect(isInternship('International Tax Manager', 'full_time')).toBe(false);
  });
});
