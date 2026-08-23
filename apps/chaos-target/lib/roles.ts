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

/**
 * Additional roles, generated so the board is the size of a real one.
 *
 * Six listings is not enough to judge drift on: a baseline built from six
 * observations is thrown out as insufficient evidence, and correctly so — the
 * detector refuses to call a field broken on a handful of rows. A board of sixty
 * gives one collection run enough weight to be compared against.
 *
 * Roughly one in six advertises no salary, which keeps a legitimately empty
 * field in every run — the case that must never be read as breakage.
 */
function generated(): Role[] {
  const titles = [
    'Robotics Software Engineer',
    'Perception Engineer',
    'Controls Engineer',
    'Mechanical Design Engineer',
    'Electrical Engineer, Power Systems',
    'Simulation Engineer',
    'Fleet Operations Analyst',
    'Manufacturing Test Engineer',
    'Supply Chain Planner',
    'Technical Account Manager',
    'Field Service Engineer',
    'Data Engineer, Telemetry',
    'Safety Engineer',
    'Systems Integration Engineer',
    'Motion Planning Researcher',
    'Hardware Reliability Engineer',
    'Customer Success Manager',
    'Finance Analyst',
  ];

  const places: [string, Role['workplace'], string][] = [
    ['Berlin, Germany', 'Hybrid', 'EUR'],
    ['Rotterdam, Netherlands', 'On-site', 'EUR'],
    ['Zurich, Switzerland', 'On-site', 'CHF'],
    ['Remote, Europe', 'Remote', 'EUR'],
    ['Munich, Germany', 'Hybrid', 'EUR'],
    ['Copenhagen, Denmark', 'On-site', 'DKK'],
  ];

  return titles.flatMap((title, index) => {
    const place = places[index % places.length] as [string, Role['workplace'], string];
    const seniorities = ['', 'Senior ', 'Staff '];

    return seniorities.map((prefix, tier) => {
      const base = 70_000 + tier * 25_000 + (index % 5) * 4_000;
      // Every sixth role publishes nothing, so each run contains real absences.
      const unpaid = (index + tier) % 6 === 0;

      return {
        id: `nr-${5000 + index * 10 + tier}`,
        title: `${prefix}${title}`,
        location: place[0],
        workplace: place[1],
        type: index % 9 === 0 ? ('Contract' as const) : ('Full-time' as const),
        posted: `2026-0${(index % 3) + 6}-${String((index % 27) + 1).padStart(2, '0')}`,
        min: unpaid ? null : base,
        max: unpaid ? null : base + 30_000,
        currency: unpaid ? null : place[2],
        blurb: `Own ${title.toLowerCase()} work across our warehouse fleet, from design through to deployment on customer sites.`,
      };
    });
  });
}

const CURATED: Role[] = [
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

/** The hand-written roles first, so the demo always opens on the same listing. */
export const ROLES: Role[] = [...CURATED, ...generated()];
