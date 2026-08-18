/**
 * The chaos target's data.
 *
 * One dataset, rendered two ways. The facts never differ between layouts — only
 * the markup does — so any change in extracted values is the scraper's doing and
 * never the content's. That is what makes the accuracy audit meaningful: if a
 * heal returns a different salary after the redesign, the heal is wrong.
 */

export interface Role {
  id: string;
  title: string;
  location: string;
  workplace: 'Remote' | 'Hybrid' | 'On-site';
  type: 'Full-time' | 'Contract';
  posted: string;
  min: number | null;
  max: number | null;
  currency: string | null;
  blurb: string;
}

export const ROLES: Role[] = [
  {
    id: 'nr-4417',
    title: 'Senior Robotics Engineer',
    location: 'Berlin, Germany',
    workplace: 'Hybrid',
    type: 'Full-time',
    posted: '2026-08-04',
    min: 95000,
    max: 125000,
    currency: 'EUR',
    blurb:
      'Own motion planning for our warehouse fleet, from simulation through to on-robot deployment.',
  },
  {
    id: 'nr-4418',
    title: 'Embedded Systems Engineer',
    location: 'Remote, Netherlands',
    workplace: 'Remote',
    type: 'Full-time',
    posted: '2026-08-09',
    min: 80000,
    max: 105000,
    currency: 'EUR',
    blurb:
      'Firmware for our next-generation actuator control boards. C++ and a lot of oscilloscope time.',
  },
  {
    id: 'nr-4419',
    title: 'Computer Vision Researcher',
    location: 'Zurich, Switzerland',
    workplace: 'On-site',
    type: 'Full-time',
    posted: '2026-07-28',
    min: 130000,
    max: 165000,
    currency: 'CHF',
    blurb: 'Depth estimation and object tracking in cluttered industrial environments.',
  },
  {
    id: 'nr-4420',
    title: 'Technical Writer, Robotics',
    location: 'Remote, Europe',
    workplace: 'Remote',
    type: 'Contract',
    posted: '2026-08-11',
    min: 55000,
    max: 70000,
    currency: 'EUR',
    blurb: 'Turn our SDK into documentation an integrator can follow without calling support.',
  },
  {
    // Deliberately unadvertised. A legitimately absent salary must not read as
    // broken extraction — the exact distinction the baseline detector exists to
    // make, so the demo run has to contain one.
    id: 'nr-4421',
    title: 'Field Deployment Technician',
    location: 'Rotterdam, Netherlands',
    workplace: 'On-site',
    type: 'Full-time',
    posted: '2026-08-01',
    min: null,
    max: null,
    currency: null,
    blurb: 'Commission and maintain robot cells on customer sites across the Benelux.',
  },
  {
    id: 'nr-4422',
    title: 'Product Manager, Autonomy',
    location: 'Berlin, Germany',
    workplace: 'Hybrid',
    type: 'Full-time',
    posted: '2026-07-19',
    min: 100000,
    max: 130000,
    currency: 'EUR',
    blurb: 'Own the autonomy roadmap and decide what ships next to the fleet.',
  },
];
