/**
 * Public surface of @revenant/core.
 *
 * Consumers may also reach individual modules directly — `@revenant/core/decay/liveness`
 * and friends — which the package's wildcard export map allows. This barrel
 * exists for the common case and to give the package a single documented entry.
 */

export * from './schema/posting.js';
export * from './collectors/base.js';

export { detectDrift, sampleRun, updateBaseline, fieldsNeedingHeal } from './healing/baseline.js';
export type { Baseline, DriftVerdict, FieldSample, DriftOptions } from './healing/baseline.js';

export { auditAgainstOracle, healSucceeded, joinKey } from './healing/audit.js';
export type { AuditReport, FieldGrade, FieldOutcome } from './healing/audit.js';

export { scoreLiveness } from './decay/liveness.js';
export type { DecaySignals, LivenessScore, Verdict } from './decay/liveness.js';

export { deduplicate, dedupKey, contentHash, normaliseTitle, normaliseLocation } from './normalize/dedup.js';
export type { DedupGroup } from './normalize/dedup.js';

export { discoverCompany, discoverCompanies } from './discovery/discover.js';
export type { DiscoveredBoard, DiscoveryOptions } from './discovery/discover.js';

export { slugCandidates, boardUrl, ATS_PLATFORMS } from './discovery/slugs.js';
export type { AtsPlatform } from './discovery/slugs.js';

export { greenhouseOracle, leverOracle, boardExists, boardSize } from './oracle/ats.js';
