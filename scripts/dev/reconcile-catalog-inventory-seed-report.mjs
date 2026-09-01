#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSeedReport, writeSeedReportPair} from '../test/seed-report.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const isApiPhase = (phase) => Number.isInteger(phase?.status) && typeof phase.requestId === 'string' && typeof phase.operationId === 'string';

function readJson(pathname) { return JSON.parse(readFileSync(pathname, 'utf8')); }
function readJsonLines(pathname) { return readFileSync(pathname, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)); }

/** Rebuilds a terminal catalog seed report from immutable stage and server completion evidence. */
export function reconcileCatalogSeedReport({catalogManifest, managedDevManifest}) {
  if (catalogManifest?.kind !== 'catalog-inventory-seed-run-manifest' || catalogManifest.business !== 'PASS') throw new Error('CATALOG_SEED_REPORT_RECONCILE_MANIFEST_INVALID');
  if (managedDevManifest?.kind !== 'r5-dev-run-manifest' || typeof managedDevManifest.seedEventsPath !== 'string') throw new Error('CATALOG_SEED_REPORT_RECONCILE_MANAGED_DEV_INVALID');
  if (catalogManifest.managedDevRunId !== managedDevManifest.runId) throw new Error('CATALOG_SEED_REPORT_RECONCILE_RUN_MISMATCH');
  const completions = readJsonLines(managedDevManifest.seedEventsPath).filter((event) => event.runId === managedDevManifest.runId);
  const byRequest = new Map();
  for (const event of completions) {
    if (!event?.requestId) continue;
    if (byRequest.has(event.requestId)) throw new Error('CATALOG_SEED_REPORT_RECONCILE_DUPLICATE_REQUEST');
    byRequest.set(event.requestId, event);
  }
  const calls = (catalogManifest.phases ?? []).filter(isApiPhase).map((phase) => {
    const event = byRequest.get(phase.requestId);
    if (!event || !event.correlationId || event.operationId !== phase.operationId) throw new Error(`CATALOG_SEED_REPORT_RECONCILE_EVENT_MISSING:${phase.operationId}`);
    return {
      stageId: phase.stage,
      managedDevRunId: managedDevManifest.runId,
      correlationId: event.correlationId,
      requestId: event.requestId,
      owner: event.owner,
      consumerFace: event.consumerFace,
      operationId: event.operationId,
      method: event.method,
      routeTemplate: event.routeTemplate,
      durationMs: event.durationMillis,
      status: event.status,
      outcome: event.outcome,
    };
  });
  const nonApiStages = (catalogManifest.phases ?? [])
    .filter((phase) => !isApiPhase(phase))
    .map((phase) => ({stageId: phase.stage, status: phase.status, durationMs: phase.durationMs}));
  return buildSeedReport({
    runId: catalogManifest.runId,
    managedDevRunId: managedDevManifest.runId,
    measurement: catalogManifest.measurement,
    seedProfile: catalogManifest.profile,
    startedAt: catalogManifest.startedAt,
    finishedAt: new Date().toISOString(),
    status: catalogManifest.business,
    businessStatus: catalogManifest.business,
    cleanupStatus: catalogManifest.cleanup,
    calls,
    events: completions,
    nonApiStages,
    firstFailure: catalogManifest.firstFailure,
  });
}

function main() {
  const catalogManifestPath = path.resolve(process.argv[2] ?? '');
  const managedDevManifestPath = path.resolve(process.argv[3] ?? '');
  if (!catalogManifestPath || !managedDevManifestPath) throw new Error('USAGE_CATALOG_MANIFEST_AND_MANAGED_DEV_MANIFEST_REQUIRED');
  const catalogManifest = readJson(catalogManifestPath);
  const report = reconcileCatalogSeedReport({catalogManifest, managedDevManifest: readJson(managedDevManifestPath)});
  const reportPath = path.join(path.dirname(catalogManifestPath), 'seed-report.json');
  writeSeedReportPair(reportPath, {...report, kind: 'catalog-inventory-seed-report', profile: catalogManifest.profile, planDigest: catalogManifest.planDigest, business: catalogManifest.business, cleanup: catalogManifest.cleanup, phases: catalogManifest.phases, noDirectDatabaseWrites: true});
  process.stdout.write(`CATALOG_SEED_REPORT_RECONCILE=${report.status}; REPORT=${reportPath}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
