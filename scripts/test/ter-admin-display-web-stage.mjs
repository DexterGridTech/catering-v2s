#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {
  collectWebSourceFiles,
  hashWebSourceFiles,
  validateWebAStageManifests,
} from './ter-admin-display-web-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeRoot = path.join(root, '.runtime/ter-admin-display');
const runIds = process.argv.slice(2);
if (runIds.length === 0 || runIds.some(runId => !/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/u.test(runId))) {
  throw new Error('TER_ADMIN_DISPLAY_WEB_A_STAGE_RUN_IDS_INVALID');
}
const repositoryRealRoot = fs.realpathSync(root);
const runtimeRootStat = fs.lstatSync(runtimeRoot);
const runtimeRootReal = fs.realpathSync(runtimeRoot);
if (!runtimeRootStat.isDirectory() || runtimeRootStat.isSymbolicLink() ||
    !runtimeRootReal.startsWith(`${repositoryRealRoot}${path.sep}`)) {
  throw new Error('TER_ADMIN_DISPLAY_WEB_A_STAGE_RUNTIME_ROOT_INVALID');
}

const manifests = runIds.map(runId => {
  const runRoot = path.join(runtimeRoot, runId);
  const manifestPath = path.join(runRoot, 'run-manifest.json');
  const runRootStat = fs.lstatSync(runRoot);
  const manifestStat = fs.lstatSync(manifestPath);
  const runRootReal = fs.realpathSync(runRoot);
  const manifestReal = fs.realpathSync(manifestPath);
  if (!runRootStat.isDirectory() || runRootStat.isSymbolicLink() ||
      !manifestStat.isFile() || manifestStat.isSymbolicLink() ||
      !runRootReal.startsWith(`${runtimeRootReal}${path.sep}`) ||
      !manifestReal.startsWith(`${runRootReal}${path.sep}`)) {
    throw new Error('TER_ADMIN_DISPLAY_WEB_A_STAGE_MANIFEST_PATH_INVALID');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return {...manifest, requestedRunId: runId};
});

const sourceFiles = collectWebSourceFiles(root);
const sourceSha256 = hashWebSourceFiles(root, sourceFiles);
const result = validateWebAStageManifests(manifests, sourceSha256);
const stageManifest = {
  stageId: `web-a-${Date.now()}-${randomUUID()}`,
  createdAt: new Date().toISOString(),
  stage: 'EXPO_WEB_A',
  ...result,
  runIds,
  sourceFiles,
  rows: manifests.map(manifest => ({
    runId: manifest.runId,
    webScenario: manifest.webScenario,
    integrationName: manifest.integrationName,
    surfaceForm: manifest.surfaceForm,
    businessAssertionIds: manifest.businessAssertionIds,
    business: manifest.business,
    cleanup: manifest.cleanup,
    sourceSha256: manifest.sourceSha256,
    managedDevRunId: manifest.managedDevRunId,
    managedDevManifestSha256: manifest.managedDevManifestSha256,
    frontendLogRead: manifest.frontendLogRead,
    frontendRejectedCommandCount: manifest.frontendRejectedCommandCount,
    frontendCommandEvents: manifest.frontendCommandEvents,
    backendLogRead: manifest.backendLogRead ?? 'NOT_APPLICABLE',
    tdsLogRead: manifest.tdsLogRead ?? 'NOT_APPLICABLE',
    tdsNodeLogRead: manifest.tdsNodeLogRead ?? null,
    tdsServerLog: manifest.tdsServerLog ?? null,
    tdsServerLogEvents: manifest.tdsServerLogEvents ?? null,
    frontendBackendLogCorrelation: manifest.frontendBackendLogCorrelation ?? null,
    matchedHeartbeatRtt: manifest.matchedHeartbeatRtt ?? null,
    memberRegistration: manifest.memberRegistration ?? null,
    serverConfigUi: manifest.serverConfigUi ?? null,
  })),
};
const stageManifestPath = path.join(runtimeRoot, `${stageManifest.stageId}.json`);
fs.writeFileSync(stageManifestPath, `${JSON.stringify(stageManifest, null, 2)}\n`, {flag: 'wx', mode: 0o600});
process.stdout.write(`${JSON.stringify({...stageManifest, manifestPath: path.relative(root, stageManifestPath)}, null, 2)}\n`);
if (result.status !== 'PASS') process.exitCode = 1;
