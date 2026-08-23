import { describe, expect, it } from 'vitest';

import { classifyDomain, classifyLevel, classifyWorkMode, isInternship } from './classify.js';

describe('classifyDomain', () => {
  it('places the plain cases', () => {
    expect(classifyDomain('Senior Backend Engineer')).toBe('engineering');
    expect(classifyDomain('Product Manager, Payments')).toBe('product');
    expect(classifyDomain('Account Executive, Enterprise')).toBe('sales');
    expect(classifyDomain('Financial Analyst')).toBe('finance');
    expect(classifyDomain('Technical Recruiter')).toBe('people');
    expect(classifyDomain('Corporate Counsel')).toBe('legal');
  });

  /*
   * The reason ordering matters. Each of these contains a word that a broader
   * rule further down would claim, and the compound meaning is the correct one.
   */
  it('resolves titles that belong to two functions at once', () => {
    expect(classifyDomain('Sales Engineer')).toBe('sales');
    expect(classifyDomain('Solutions Architect')).toBe('sales');
    expect(classifyDomain('Data Engineer')).toBe('data');
    expect(classifyDomain('Machine Learning Engineer')).toBe('data');
    expect(classifyDomain('Product Designer')).toBe('design');
    expect(classifyDomain('Support Engineer')).toBe('support');
  });

  it('keeps infrastructure and security inside engineering', () => {
    expect(classifyDomain('Site Reliability Engineer')).toBe('engineering');
    expect(classifyDomain('Security Engineer, AppSec')).toBe('engineering');
    expect(classifyDomain('Staff Platform Engineer')).toBe('engineering');
  });

  it('falls back to other rather than guessing', () => {
    expect(classifyDomain('Office Manager')).toBe('operations');
    expect(classifyDomain('Zookeeper')).toBe('other');
    expect(classifyDomain(null)).toBe('other');
  });
});

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

  /*
   * Treating "manager" as a level put 3,718 of 7,569 postings at lead, and gave
   * Product 448 lead roles against zero mid. It is a job word, not a level word.
   */
  it('does not treat every manager as a lead', () => {
    expect(classifyLevel('Account Manager')).toBe('mid');
    expect(classifyLevel('Product Manager')).toBe('mid');
    expect(classifyLevel('Program Manager, Trust')).toBe('mid');
  });

  it('still reads seniority from the manager compounds that carry it', () => {
    expect(classifyLevel('Engineering Manager')).toBe('lead');
    expect(classifyLevel('Senior Manager, Analytics')).toBe('lead');
  });

  it('does not treat architect as a level', () => {
    expect(classifyLevel('Solutions Architect')).toBe('mid');
    expect(classifyLevel('Principal Architect')).toBe('lead');
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
