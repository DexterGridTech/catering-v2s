import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const DEFAULT_ROOT = '.runtime/r5/evidence/remote-testcontainers';
const SAFE_LABEL = /^[A-Za-z0-9_.:-]{1,160}$/;

function label(value, fallback) {
  return typeof value === 'string' && SAFE_LABEL.test(value) ? value : fallback;
}

function timestamp(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0 ? Math.round((ordered[middle - 1] + ordered[middle]) / 2) : ordered[middle];
}

function increment(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

function sortedCounts(map) {
  return Object.fromEntries(Object.entries(map).sort(([left], [right]) => left.localeCompare(right)));
}

function phaseOf(manifest) {
  const operation = manifest.backendAcceptance?.operation;
  const candidates = [manifest.phase, manifest.stage, operation, manifest.verificationMode, manifest.task];
  return candidates.find(value => typeof value === 'string' && value.trim() !== '') ?? 'UNCLASSIFIED';
}

function failureCategoryOf(manifest) {
  const candidates = [
    manifest.failureCategory,
    manifest.firstFailure?.failureCategory,
    manifest.productionMutation?.observed?.failureCategory,
  ];
  const value = candidates.find(candidate => typeof candidate === 'string' && candidate.trim() !== '');
  if (value) return label(value, 'UNSAFE_OR_UNCLASSIFIED');
  return manifest.firstFailure ? 'UNCLASSIFIED_FAILURE' : 'NONE';
}

function cleanupStatusOf(manifest) {
  return typeof manifest.cleanup === 'string' ? manifest.cleanup : manifest.cleanup?.status;
}

function normalizeManifest(manifest) {
  const startedAt = timestamp(manifest.startedAt);
  const completedAt = timestamp(manifest.finishedAt ?? manifest.completedAt);
  const durationMs =
    startedAt !== null && completedAt !== null && completedAt >= startedAt ? completedAt - startedAt : null;
  return {
    startedAt,
    completedAt,
    durationMs,
    phase: label(phaseOf(manifest), 'UNSAFE_OR_UNCLASSIFIED'),
    status: label(manifest.status, 'UNCLASSIFIED'),
    business: label(manifest.business, 'UNCLASSIFIED'),
    cleanup: label(cleanupStatusOf(manifest), 'UNCLASSIFIED'),
    failureCategory: failureCategoryOf(manifest),
  };
}

function phaseSummary(records) {
  const groups = new Map();
  for (const record of records) {
    const group = groups.get(record.phase) ?? {
      count: 0,
      recordedDurationCount: 0,
      durations: [],
      statuses: {},
      business: {},
      cleanup: {},
      failureCategories: {},
    };
    group.count += 1;
    if (record.durationMs !== null) {
      group.recordedDurationCount += 1;
      group.durations.push(record.durationMs);
    }
    increment(group.statuses, record.status);
    increment(group.business, record.business);
    increment(group.cleanup, record.cleanup);
    increment(group.failureCategories, record.failureCategory);
    groups.set(record.phase, group);
  }
  return Object.fromEntries(
    [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([phase, group]) => [
        phase,
        {
          count: group.count,
          recordedDurationCount: group.recordedDurationCount,
          totalDurationMs: group.durations.reduce((sum, value) => sum + value, 0),
          medianDurationMs: median(group.durations),
          maxDurationMs: group.durations.length ? Math.max(...group.durations) : null,
          statuses: sortedCounts(group.statuses),
          business: sortedCounts(group.business),
          cleanup: sortedCounts(group.cleanup),
          failureCategories: sortedCounts(group.failureCategories),
        },
      ]),
  );
}

export function summarizeManagedRuns(manifests) {
  const records = manifests.map(normalizeManifest);
  const timed = records
    .filter(record => record.durationMs !== null)
    .sort((left, right) => left.startedAt - right.startedAt);
  const firstStartedAt = timed.length ? timed[0].startedAt : null;
  const lastCompletedAt = timed.length ? Math.max(...timed.map(record => record.completedAt)) : null;
  let interRunGapMs = 0;
  for (let index = 1; index < timed.length; index += 1) {
    interRunGapMs += Math.max(0, timed[index].startedAt - timed[index - 1].completedAt);
  }
  const totalDurationMs = timed.reduce((sum, record) => sum + record.durationMs, 0);
  const wallClockSpanMs =
    firstStartedAt !== null && lastCompletedAt !== null ? Math.max(0, lastCompletedAt - firstStartedAt) : null;
  return {
    schemaVersion: 1,
    runCount: records.length,
    recordedDurationCount: timed.length,
    missingOrInvalidDurationCount: records.length - timed.length,
    firstStartedAt: firstStartedAt === null ? null : new Date(firstStartedAt).toISOString(),
    lastCompletedAt: lastCompletedAt === null ? null : new Date(lastCompletedAt).toISOString(),
    wallClockSpanMs,
    totalRunDurationMs: totalDurationMs,
    medianRunDurationMs: median(timed.map(record => record.durationMs)),
    maxRunDurationMs: timed.length ? Math.max(...timed.map(record => record.durationMs)) : null,
    interRunGapMs,
    recordedRunSharePercent: wallClockSpanMs ? Math.round((totalDurationMs / wallClockSpanMs) * 10000) / 100 : null,
    statuses: sortedCounts(
      records.reduce((counts, record) => {
        increment(counts, record.status);
        return counts;
      }, {}),
    ),
    business: sortedCounts(
      records.reduce((counts, record) => {
        increment(counts, record.business);
        return counts;
      }, {}),
    ),
    cleanup: sortedCounts(
      records.reduce((counts, record) => {
        increment(counts, record.cleanup);
        return counts;
      }, {}),
    ),
    failureCategories: sortedCounts(
      records.reduce((counts, record) => {
        increment(counts, record.failureCategory);
        return counts;
      }, {}),
    ),
    phaseStats: phaseSummary(records),
  };
}

export function readManagedRunSummary(root = DEFAULT_ROOT) {
  const absoluteRoot = path.resolve(root);
  const entries = readdirSync(absoluteRoot, {withFileTypes: true});
  const manifests = [];
  let invalidManifestCount = 0;
  for (const entry of entries
    .filter(candidate => candidate.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const manifestPath = path.join(absoluteRoot, entry.name, 'run-manifest.json');
    try {
      manifests.push(JSON.parse(readFileSync(manifestPath, 'utf8')));
    } catch {
      invalidManifestCount += 1;
    }
  }
  const summary = summarizeManagedRuns(manifests);
  return {
    ...summary,
    invalidManifestCount,
    status: invalidManifestCount === 0 && manifests.length > 0 ? 'PASS' : 'INCOMPLETE',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? DEFAULT_ROOT;
  console.log(JSON.stringify(readManagedRunSummary(root), null, 2));
}
