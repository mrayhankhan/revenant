/**
 * Skill extraction.
 *
 * Deliberately a curated vocabulary rather than an LLM. Three reasons:
 *
 *  1. It can show its work. "This posting asks for Kubernetes; your CV does not
 *     mention it" is checkable by the person reading it. An embedding score is
 *     not, and a job seeker is being asked to act on this.
 *  2. It is deterministic. The same résumé and posting always produce the same
 *     match, which means the score can be tested and cannot drift between runs.
 *  3. It costs nothing per posting. Matching one CV against 3,500 live postings
 *     through an API would be slow and expensive; this is a set intersection.
 *
 * The trade is recall: a skill outside the vocabulary is invisible. That is the
 * right way to fail here — a missed match is a smaller harm than a confident
 * wrong one, and unknown terms are surfaced rather than silently scored.
 */

/**
 * Canonical skill → the spellings that mean it.
 *
 * Aliases matter more than breadth: postings and CVs rarely use the same words
 * for the same thing, and "k8s" versus "Kubernetes" is the difference between a
 * match and a miss.
 */
const SKILLS: Record<string, string[]> = {
  // Languages
  typescript: ['typescript', 'ts'],
  javascript: ['javascript', 'js', 'ecmascript'],
  python: ['python', 'py'],
  java: ['java'],
  kotlin: ['kotlin'],
  swift: ['swift'],
  go: ['golang', 'go lang'],
  rust: ['rust'],
  ruby: ['ruby'],
  php: ['php'],
  csharp: ['c#', 'csharp', '.net', 'dotnet'],
  cpp: ['c++', 'cpp'],
  scala: ['scala'],
  elixir: ['elixir'],
  sql: ['sql'],

  // Frontend
  react: ['react', 'react.js', 'reactjs'],
  nextjs: ['next.js', 'nextjs'],
  vue: ['vue', 'vue.js', 'vuejs'],
  angular: ['angular'],
  svelte: ['svelte', 'sveltekit'],
  tailwind: ['tailwind', 'tailwindcss'],
  css: ['css', 'scss', 'sass'],
  html: ['html'],
  accessibility: ['accessibility', 'a11y', 'wcag'],

  // Backend and data
  nodejs: ['node.js', 'nodejs', 'node'],
  django: ['django'],
  rails: ['rails', 'ruby on rails'],
  spring: ['spring boot', 'spring'],
  graphql: ['graphql'],
  rest: ['rest api', 'restful', 'rest'],
  grpc: ['grpc'],
  postgres: ['postgres', 'postgresql'],
  mysql: ['mysql'],
  mongodb: ['mongodb', 'mongo'],
  redis: ['redis'],
  elasticsearch: ['elasticsearch', 'opensearch'],
  kafka: ['kafka'],
  spark: ['spark', 'pyspark'],
  airflow: ['airflow'],
  dbt: ['dbt'],
  snowflake: ['snowflake'],

  // Infrastructure
  aws: ['aws', 'amazon web services'],
  gcp: ['gcp', 'google cloud'],
  azure: ['azure'],
  kubernetes: ['kubernetes', 'k8s'],
  docker: ['docker', 'containeris', 'containeriz'],
  terraform: ['terraform'],
  ci: ['ci/cd', 'cicd', 'continuous integration', 'continuous delivery'],
  linux: ['linux', 'unix'],
  observability: ['observability', 'prometheus', 'grafana', 'datadog', 'opentelemetry'],

  // ML and data science
  ml: ['machine learning', 'ml', 'deep learning'],
  llm: ['llm', 'large language model', 'genai', 'generative ai'],
  pytorch: ['pytorch'],
  tensorflow: ['tensorflow'],
  nlp: ['nlp', 'natural language processing'],
  pandas: ['pandas', 'numpy'],

  // Practice
  testing: ['unit test', 'integration test', 'tdd', 'jest', 'pytest', 'vitest', 'cypress', 'playwright'],
  distributed: ['distributed systems', 'microservices', 'event-driven'],
  security: ['security', 'appsec', 'penetration testing', 'threat model'],
  scraping: ['web scraping', 'scraper', 'crawler'],
  design: ['figma', 'design system', 'ux research', 'prototyping'],
  product: ['roadmap', 'product strategy', 'stakeholder'],
  leadership: ['mentor', 'tech lead', 'line manage', 'team lead'],
};

export type Skill = keyof typeof SKILLS;

/** Alias → canonical, longest alias first so "react.js" wins over "react". */
const LOOKUP: [string, string][] = Object.entries(SKILLS)
  .flatMap(([canonical, aliases]) => aliases.map((alias): [string, string] => [alias, canonical]))
  .sort((a, b) => b[0].length - a[0].length);

function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9+#./ -]/g, ' ').replace(/\s+/g, ' ')} `;
}

/**
 * Whether an alias occurs as a whole token.
 *
 * Substring matching would find "go" inside "category" and "r" inside anything;
 * short language names are exactly where a naive `includes` produces nonsense.
 */
function mentions(haystack: string, alias: string): boolean {
  const index = haystack.indexOf(alias);
  if (index === -1) return false;

  const before = haystack[index - 1] ?? ' ';
  const after = haystack[index + alias.length] ?? ' ';

  // `+`, `#` and `.` are part of skill names (c++, c#, node.js), so a boundary
  // is anything that is not alphanumeric.
  return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
}

export function extractSkills(text: string | null | undefined): Set<string> {
  if (!text) return new Set();

  const haystack = normalise(text);
  const found = new Set<string>();

  for (const [alias, canonical] of LOOKUP) {
    if (mentions(haystack, alias)) found.add(canonical);
  }

  return found;
}

/** Human-readable name for a canonical skill, for use in explanations. */
export function skillLabel(skill: string): string {
  const labels: Record<string, string> = {
    csharp: 'C#',
    cpp: 'C++',
    nodejs: 'Node.js',
    nextjs: 'Next.js',
    ci: 'CI/CD',
    ml: 'machine learning',
    llm: 'LLMs',
    nlp: 'NLP',
    aws: 'AWS',
    gcp: 'GCP',
    sql: 'SQL',
    css: 'CSS',
    html: 'HTML',
    rest: 'REST APIs',
    graphql: 'GraphQL',
    grpc: 'gRPC',
    k8s: 'Kubernetes',
    kubernetes: 'Kubernetes',
    ux: 'UX',
  };

  return labels[skill] ?? skill.charAt(0).toUpperCase() + skill.slice(1);
}
