#!/usr/bin/env node
/**
 * Runs one focused Testcontainers task on a remote host while preserving
 * run-scoped diagnostics and a verifiable, reclaimable process identity.
 */
import {createHash, randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {resolveTrustedRemoteHost} from '../dev/r5-remote-host-trust.mjs';
import {buildDynamicReport, deriveScenarioResults, loadAuthoritativeContract} from './backend-performance-testcontainers-196.mjs';
import {warmTestcontainersImages} from './r5-testcontainers-daemon-lanes.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const gradleArguments = process.argv.slice(2);
const allTestcontainers = gradleArguments.length === 1 && gradleArguments[0] === '--all';
const discoverTestcontainers = gradleArguments.length === 1 && gradleArguments[0] === '--discover';
const task = gradleArguments[0] ?? null;
const extraGradleArguments = gradleArguments.slice(1);
const backendPerformance196Task = ':apps:backend:catering-business-server:test';
const backendPerformance196Selector = 'dynamic.BackendPerformanceTestcontainers196Test';
const isBackendPerformance196Run = task === backendPerformance196Task
  && extraGradleArguments.length === 2
  && extraGradleArguments[0] === '--tests'
  && extraGradleArguments[1] === backendPerformance196Selector;
const isBackendAcceptanceRun = process.env.V2S_BACKEND_ACCEPTANCE_EXECUTION === 'true'
  && task === ':apps:backend:catering-business-server:test'
  && extraGradleArguments.length === 2
  && extraGradleArguments[0] === '--tests'
  && extraGradleArguments[1] === 'com.catering.v2s.app.acceptance.BackendAcceptanceTest';
const isBackendAcceptanceSuiteCleanup = process.env.V2S_BACKEND_ACCEPTANCE_SUITE_CLEANUP === 'true'
  && task === '--cleanup-suite'
  && extraGradleArguments.length === 0;
const backendAcceptanceSourcePaths = Object.freeze([
  'apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java',
  'apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceDatabaseMetricsSink.java',
  'apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceMetricsConfiguration.java',
]);
const backendPerformance196ManagedReportName = 'backend-performance-testcontainers-196-managed-report.json';
const backendPerformance196ManagedManifestName = 'backend-performance-testcontainers-196-managed-run-manifest.json';
const backendPerformance196WorkloadResultName = 'backend-performance-196-workload-result.json';
const backendPerformance196WorkloadCleanupStatus = 'NOT_OWNED_BY_WORKLOAD';
const backendPerformance196WorkloadCleanupOwner = 'TESTCONTAINERS_AND_MANAGED_RUNNER';
const stableFailureCode = /^(?:[A-Z][A-Z0-9_]*|ENOENT)(?::[A-Za-z0-9_-]+)*$/;
export const backendPerformance196SourcePaths = Object.freeze([
  'scripts/test/backend-performance-testcontainers-196-remote-workload.mjs',
  'apps/backend/catering-business-server/src/test/java/dynamic/BackendPerformanceTestcontainers196Test.java',
]);
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? path.join(root, '.runtime/r5'));
const evidence = path.join(runtime, 'evidence', 'remote-testcontainers');
// A normal managed invocation may use an explicit immutable distribution, but
// must not fail merely because the caller did not re-export that path.  The
// only fallback resolves the actual PATH executable then walks its own
// <gradle-home>/bin/gradle structure; there is no machine-specific literal and
// an unavailable/ambiguous installation still fails closed below.
export const resolveGradleHome = ({environment = process.env, execute = spawnSync, resolvePath = realpathSync, exists = existsSync} = {}) => {
  if (typeof environment.V2S_GRADLE_HOME === 'string' && environment.V2S_GRADLE_HOME.trim() !== '') {
    return {path: environment.V2S_GRADLE_HOME, source: 'V2S_GRADLE_HOME'};
  }
  const result = execute('sh', ['-lc', 'command -v gradle'], {cwd: root, encoding: 'utf8'});
  const executable = result.status === 0 ? String(result.stdout ?? '').trim().split(/\r?\n/).at(-1) : undefined;
  if (!executable || !path.isAbsolute(executable)) return {path: undefined, source: 'UNRESOLVED'};
  try {
    const resolved = resolvePath(executable);
    const packageRoot = path.dirname(path.dirname(resolved));
    // Homebrew exposes the launcher at <cellar-version>/bin/gradle but keeps
    // the actual Gradle distribution at <cellar-version>/libexec. Other
    // installations use the package root directly.
    const home = exists(path.join(packageRoot, 'libexec', 'bin', 'gradle')) ? path.join(packageRoot, 'libexec') : packageRoot;
    return {path: home, source: 'PATH_GRADLE_EXECUTABLE'};
  } catch { return {path: undefined, source: 'UNRESOLVED'}; }
};
const gradleHomeResolution = resolveGradleHome();
const gradleHome = gradleHomeResolution.path;
const remoteHostTrust = resolveTrustedRemoteHost(process.env);
const remoteHost = remoteHostTrust.host;
const laneDockerHost = process.env.V2S_TESTCONTAINERS_DOCKER_HOST;
const laneWorkspace = process.env.V2S_TESTCONTAINERS_LANE_WORKSPACE;
if (laneDockerHost !== undefined && !/^unix:\/\/\/run\/catering-v2s-testcontainers\/daemon-[1-9][0-9]*\/docker\.sock$/.test(laneDockerHost)) {
  throw new Error('TESTCONTAINERS_LANE_DOCKER_HOST_INVALID');
}
if (laneWorkspace !== undefined && !/^\/tmp\/r5-tc-suite-[0-9]+-[0-9]+\/lane-[1-9][0-9]*\/workspace$/.test(laneWorkspace)) {
  throw new Error('TESTCONTAINERS_LANE_WORKSPACE_INVALID');
}
const finalAdapterParentRunId = process.env.V2S_FINAL_ADAPTER_PARENT_RUN_ID;
const finalAdapterRuntime = process.env.V2S_FINAL_ADAPTER_RUNTIME;
const runId = `r5-tc-${Date.now()}-${process.pid}`;
const finalPerformanceRunId = isBackendPerformance196Run ? `backend-performance-final-${Date.now()}-${randomUUID().slice(0, 8)}` : undefined;
const finalPerformanceNamespace = finalPerformanceRunId ? `v2s-backend-performance-${finalPerformanceRunId.slice(-8)}` : undefined;
const bootstrapLogin = finalPerformanceRunId ? `performance-admin-${finalPerformanceRunId.slice(-8)}` : undefined;
const backendAcceptanceRunId = isBackendAcceptanceRun
  ? `backend-acceptance-${runId}`
  : undefined;
const backendAcceptanceNamespace = isBackendAcceptanceRun
  ? `v2s-backend-acceptance-${randomUUID().slice(0, 8)}`
  : undefined;
const remoteRoot = `/tmp/${runId}`;
const remoteWorkspace = laneWorkspace ?? `${remoteRoot}/workspace`;
const remoteResults = `${remoteRoot}/results`;
const remoteDependencyCache = '/tmp/catering-v2s-r5-gradle-cache';
const remoteGradleDistributionPrefix = '/tmp/catering-v2s-r5-gradle-distribution-';
const requiredPhases = ['PREPARED', 'SOURCE_SYNCED', 'GRADLE_SYNCED', 'PROCESS_STARTED', 'RUNNING', 'COLLECTED', 'CLEANUP'];
const requiredLifecycleEvents = ['LAUNCHED', 'RECONNECTED_CONTROL', 'COLLECTED_ARTIFACTS'];
const resourceLimits = {maxPreviousLive: 0, maxPreviousRssMiB: 2048};
// Gradle can legitimately be quiet while it creates a single-use daemon or
// loads a warm image.  We diagnose after one minute of identical observable
// state and terminate only after three minutes; this is a bounded evidence
// window, not a test timeout or retry policy.
const stallDiagnosticSamples = 6;
const stallTerminationSamples = 18;
const now = () => new Date().toISOString();
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const workloadObservationKey = ({logBytes, testResultBytes, runtimeEvidenceSha256 = 'NONE', runtimeEvidenceBytes = 0}) => `${logBytes}:${testResultBytes}:${runtimeEvidenceSha256}:${runtimeEvidenceBytes}`;
export const backendAcceptanceObservationKey = ({logBytes, testResultBytes, progress}) => {
  const completed = Number(progress?.completed);
  const total = Number(progress?.total);
  const firstFailure = progress?.firstFailure ?? 'NONE';
  if (![logBytes, testResultBytes, completed, total].every((value) => Number.isSafeInteger(value) && value >= 0) || typeof firstFailure !== 'string') {
    throw new Error('BACKEND_ACCEPTANCE_PROGRESS_OBSERVATION_INVALID');
  }
  // Raw event-file growth is not semantic progress: framework diagnostics may
  // append while no declared operation has completed or failed.
  return `${logBytes}:${testResultBytes}:${completed}:${total}:${firstFailure}`;
};
export const managedProcessMembershipScript = (variable = 'workload') => `${variable}=${String.raw`$(ps -eo pgid=,pid=,comm= | awk -v expected_pgid="$pgid" '$1 == expected_pgid {print $1 "/" $2 "/" $3}' | sort | sha256sum | awk '{print $1}')`}`;
export const runtimeEvidencePathForRun = ({remoteResults, runType}) => {
  if (typeof remoteResults !== 'string' || !path.isAbsolute(remoteResults)) throw new Error('R5_RUNTIME_EVIDENCE_ROOT_INVALID');
  if (runType === 'backend-performance') return `${remoteResults}/backend-performance-196/catalog-runtime/results/catalog-inventory-api/events.jsonl`;
  if (runType === 'backend-acceptance') return `${remoteResults}/http-request-events.jsonl`;
  return null;
};
export function materializeBackendAcceptanceLaneContract({laneCount, laneId, databaseNamespace, objectStorageNamespace, dockerHost = null, workspace = null}) {
  if (!Number.isSafeInteger(laneCount) || laneCount < 1 || !Number.isSafeInteger(laneId) || laneId < 1 || laneId > laneCount) {
    throw new Error('BACKEND_ACCEPTANCE_LANE_CONTRACT_INVALID');
  }
  for (const [name, value] of [['databaseNamespace', databaseNamespace], ['objectStorageNamespace', objectStorageNamespace]]) {
    if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{2,63}$/.test(value)) throw new Error(`BACKEND_ACCEPTANCE_LANE_${name.toUpperCase()}_INVALID`);
  }
  if (dockerHost !== null && (typeof dockerHost !== 'string' || !/^unix:\/\/\/run\/catering-v2s-testcontainers\/daemon-[1-9][0-9]*\/docker\.sock$/.test(dockerHost))) {
    throw new Error('BACKEND_ACCEPTANCE_LANE_DOCKER_HOST_INVALID');
  }
  if (workspace !== null && (typeof workspace !== 'string' || !/^\/tmp\/r5-tc-suite-[0-9]+-[0-9]+\/lane-[1-9][0-9]*\/workspace$/.test(workspace))) {
    throw new Error('BACKEND_ACCEPTANCE_LANE_WORKSPACE_INVALID');
  }
  return Object.freeze({laneCount, laneId, databaseNamespace, objectStorageNamespace, dockerHost, workspace});
}
const backendAcceptanceLaneContract = null;
const BACKEND_ACCEPTANCE_SUITE_ROOT_PATTERN = /^\/tmp\/r5-tc-suite-[0-9]+-[0-9]+$/;
const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
const compact = (value, limit = 240) => String(value || 'FAILED').trim().replace(/\s+/g, '_').slice(0, limit);
const script = (...lines) => lines.join('\n');
const runnerEvent = (event, fields = {}) => process.stdout.write(`R5_TESTCONTAINERS_${event} ${Object.entries(fields).map(([key, value]) => `${key}=${value}`).join(' ')}\n`);

const testSourcePrefix = 'apps/backend/catering-business-server/';
const suiteTargetBindingEnvironment = 'V2S_TESTCONTAINERS_SUITE_TARGET';
const suiteTargetFields = ['sourcePath', 'task', 'selector', 'inputSha256'];
export function testcontainersTargetForSource(relativePath, source) {
  if (typeof relativePath !== 'string' || typeof source !== 'string' || !source.includes('@Testcontainers')) return null;
  const sourceMatch = relativePath.match(/^apps\/backend\/catering-business-server\/(?:modules\/([a-z0-9-]+)\/)?src\/test\/java\/.+\.java$/);
  const packageName = source.match(/^\s*package\s+([A-Za-z_][A-Za-z0-9_.]*);/m)?.[1];
  const className = source.match(/^\s*(?:public\s+)?(?:abstract\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)\b/m)?.[1];
  if (!sourceMatch || !packageName || !className) throw new Error(`TESTCONTAINERS_DISCOVERY_SOURCE_INVALID:${relativePath}`);
  const moduleName = sourceMatch[1];
  return Object.freeze({
    sourcePath: relativePath,
    task: moduleName ? `:apps:backend:catering-business-server:modules:${moduleName}:test` : ':apps:backend:catering-business-server:test',
    selector: `${packageName}.${className}`,
  });
}

const walkJavaSources = (directory, relative = '') => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const childRelative = path.posix.join(relative, entry.name);
  const child = path.join(directory, entry.name);
  if (entry.isDirectory()) return walkJavaSources(child, childRelative);
  return entry.isFile() && entry.name.endsWith('.java') ? [childRelative] : [];
});

export function discoverTestcontainersTargets(sourceRoot = root) {
  const backendRoot = path.join(sourceRoot, testSourcePrefix);
  const targets = walkJavaSources(backendRoot).map((suffix) => {
    const sourcePath = `${testSourcePrefix}${suffix}`;
    return testcontainersTargetForSource(sourcePath, readFileSync(path.join(backendRoot, suffix), 'utf8'));
  }).filter(Boolean).sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  if (targets.length === 0 || new Set(targets.map((entry) => `${entry.task}\u0000${entry.selector}`)).size !== targets.length) {
    throw new Error('TESTCONTAINERS_DISCOVERY_DENOMINATOR_INVALID');
  }
  return Object.freeze(targets);
}

const walkFiles = (directory, relative = '') => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const childRelative = path.posix.join(relative, entry.name);
  const child = path.join(directory, entry.name);
  if (entry.isDirectory()) return walkFiles(child, childRelative);
  return entry.isFile() ? [childRelative] : [];
});

const targetInputPaths = (target, sourceRoot = root) => {
  const appRoot = 'apps/backend/catering-business-server';
  const appPath = path.join(sourceRoot, appRoot);
  const contractsPath = path.join(sourceRoot, 'contracts');
  const moduleName = target.sourcePath.match(/^apps\/backend\/catering-business-server\/modules\/([a-z0-9-]+)\//)?.[1];
  const targetBuildPath = moduleName ? `modules/${moduleName}/build.gradle.kts` : 'build.gradle.kts';
  const requiredRoots = [appPath, contractsPath];
  for (const required of requiredRoots) if (!existsSync(required)) throw new Error(`TESTCONTAINERS_TARGET_INPUT_ROOT_MISSING:${path.relative(sourceRoot, required)}`);
  const appInputs = walkFiles(appPath).filter((relative) => relative === targetBuildPath
    || relative.startsWith('src/main/')
    || /^modules\/[^/]+\/src\/main\//.test(relative))
    .map((relative) => path.posix.join(appRoot, relative));
  const rootGradleInputs = ['settings.gradle.kts', 'build.gradle.kts', 'gradle.properties', 'gradle/libs.versions.toml']
    .filter((relativePath) => existsSync(path.join(sourceRoot, relativePath)));
  const staticInputs = [target.sourcePath, 'scripts/test/r5-remote-testcontainers.mjs', ...rootGradleInputs, ...appInputs, ...walkFiles(contractsPath).map((relative) => path.posix.join('contracts', relative))];
  if (target.task === backendPerformance196Task && target.selector === backendPerformance196Selector) staticInputs.push(...backendPerformance196SourcePaths);
  return [...new Set(staticInputs)].sort();
};

export function testcontainersTargetInputFingerprint(target, sourceRoot = root) {
  if (!target?.sourcePath || !target?.task || !target?.selector) throw new Error('TESTCONTAINERS_TARGET_IDENTITY_INVALID');
  const digest = createHash('sha256');
  for (const relativePath of targetInputPaths(target, sourceRoot)) {
    const file = path.join(sourceRoot, relativePath);
    if (!existsSync(file)) throw new Error(`TESTCONTAINERS_TARGET_INPUT_MISSING:${relativePath}`);
    digest.update(relativePath).update('\0').update(readFileSync(file)).update('\0');
  }
  return digest.digest('hex');
}

const suiteTargetFromEnvironment = () => {
  const encoded = process.env[suiteTargetBindingEnvironment];
  if (encoded === undefined) return null;
  try {
    const target = JSON.parse(encoded);
    if (!target || Object.keys(target).length !== suiteTargetFields.length || suiteTargetFields.some((field) => typeof target[field] !== 'string' || target[field].trim() === '') || !/^[a-f0-9]{64}$/.test(target.inputSha256)) {
      throw new Error();
    }
    return Object.freeze(Object.fromEntries(suiteTargetFields.map((field) => [field, target[field]])));
  } catch {
    fail('TESTCONTAINERS_SUITE_TARGET_BINDING_INVALID', 'ENVIRONMENT_BOUNDARY');
  }
};
export function isReusableSuiteTargetPass(manifest, target) {
  try { parseAndValidateRunManifest(manifest); } catch { return false; }
  const binding = manifest.suiteTarget;
  return manifest.business.status === 'PASS'
    && manifest.cleanup.status === 'PASS'
    && binding != null
    && suiteTargetFields.every((field) => binding[field] === target[field]);
}

/**
 * Testcontainers tasks observe external Docker/database state and must not be accepted
 * from Gradle's cached or up-to-date result. This is a second execution-time proof in
 * addition to the build-level cache opt-out, so a skipped task cannot silently become a
 * business PASS with no fresh workload evidence.
 */
export function classifyGradleTestExecution(log, expectedTask) {
  if (typeof log !== 'string' || typeof expectedTask !== 'string' || expectedTask.trim() === '') {
    return {status: 'FAIL', reason: 'TESTCONTAINERS_TARGET_EXECUTION_LOG_INVALID'};
  }
  const taskPrefix = `> Task ${expectedTask}`;
  const taskLine = log.split(/\r?\n/).map((line) => line.trim()).find((line) => line === taskPrefix || line.startsWith(`${taskPrefix} `));
  if (!taskLine) return {status: 'FAIL', reason: 'TESTCONTAINERS_TARGET_TASK_NOT_OBSERVED'};
  const skippedMarker = ['FROM-CACHE', 'UP-TO-DATE', 'NO-SOURCE', 'SKIPPED'].find((marker) => taskLine.endsWith(` ${marker}`));
  if (skippedMarker) return {status: 'FAIL', reason: `TESTCONTAINERS_TARGET_NOT_EXECUTED:${skippedMarker}`, taskLine};
  return {status: 'PASS', taskLine};
}

export function validateGradleHome(value, distributionAvailable) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error('ENV_GRADLE_HOME_REQUIRED');
  if (!path.isAbsolute(value)) throw new Error('ENV_GRADLE_HOME_INVALID');
  if (!distributionAvailable) throw new Error('ENV_GRADLE_DISTRIBUTION_UNAVAILABLE');
  return value;
}

export function remoteGradleDistributionPath(distributionSha256) {
  if (typeof distributionSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(distributionSha256)) throw new Error('GRADLE_DISTRIBUTION_SHA256_INVALID');
  return `${remoteGradleDistributionPrefix}${distributionSha256}`;
}

export function validateGradleDistribution(distribution) {
  if (!distribution || typeof distribution !== 'object' || typeof distribution.sha256 !== 'string' || !['PENDING', 'SYNCED', 'REUSED', 'REUSED_AFTER_RACE'].includes(distribution.status)) {
    throw new Error('GRADLE_DISTRIBUTION_RECORD_INVALID');
  }
  if (distribution.path !== remoteGradleDistributionPath(distribution.sha256)) throw new Error('GRADLE_DISTRIBUTION_PATH_INVALID');
  return distribution;
}

const gradleDistributionSha256 = (distributionHome) => {
  const digest = createHash('sha256');
  for (const relativePath of walkFiles(distributionHome).sort()) {
    const file = path.join(distributionHome, relativePath);
    const mode = statSync(file).mode & 0o777;
    digest.update(relativePath).update('\0').update(String(mode)).update('\0').update(readFileSync(file)).update('\0');
  }
  return digest.digest('hex');
};
const gradleDistributionSha = gradleHome && existsSync(gradleHome) ? gradleDistributionSha256(gradleHome) : null;
const remoteGradleDistribution = gradleDistributionSha ? remoteGradleDistributionPath(gradleDistributionSha) : null;

const validateInvocation = () => {
  if (!task) fail('TASK_REQUIRED', 'ENVIRONMENT_BOUNDARY');
  if (!/^:[a-z0-9:-]+:test$/.test(task)) fail('TASK_MUST_BE_A_SINGLE_TEST_TASK', 'ENVIRONMENT_BOUNDARY');
  if (extraGradleArguments.includes(backendPerformance196Selector) && !isBackendPerformance196Run) {
    fail('BP_U06_REMOTE_INVOCATION_INVALID', 'ENVIRONMENT_BOUNDARY');
  }
};

class RunnerFailure extends Error {
  constructor(reason, boundary = 'RUNNER') {
    super(reason);
    this.name = 'RunnerFailure';
    this.boundary = boundary;
  }
}

const fail = (reason, boundary) => { throw new RunnerFailure(reason, boundary); };
const suiteTarget = suiteTargetFromEnvironment();
export const validateBackendPerformance196SourcePaths = (presentPaths) => {
  if (!Array.isArray(presentPaths)) throw new Error('BP_U06_REMOTE_SOURCE_PATHS_INVALID');
  const present = new Set(presentPaths);
  const missing = backendPerformance196SourcePaths.filter((sourcePath) => !present.has(sourcePath));
  if (missing.length > 0) throw new Error(`BP_U06_REMOTE_SOURCE_MISSING:${missing.join(',')}`);
  return [...backendPerformance196SourcePaths];
};
const finalAdapterBinding = () => {
  if (finalAdapterParentRunId === undefined && finalAdapterRuntime === undefined) return undefined;
  if (!/^backend-performance-final-\d+-[a-f0-9]{8}$/.test(finalAdapterParentRunId ?? '') || path.resolve(finalAdapterRuntime ?? '') !== runtime || task !== ':apps:backend:catering-business-server:test') fail('FINAL_ADAPTER_CHILD_BINDING_INVALID', 'ENVIRONMENT_BOUNDARY');
  return {parentRunId: finalAdapterParentRunId, runtime, task, remoteHostFingerprint: remoteHostTrust.fingerprint};
};
const commandResult = (binary, args, options = {}) => spawnSync(binary, args, {cwd: root, encoding: 'utf8', ...options});
const waitForClose = (child) => new Promise((resolve) => {
  let settled = false;
  const settle = (code) => { if (!settled) { settled = true; resolve(code); } };
  child.once('error', () => settle(-1));
  child.once('close', settle);
});
const command = (binary, args, options = {}) => {
  const result = commandResult(binary, args, options);
  if (result.status !== 0) fail(`${binary}:${compact(result.stderr || result.stdout)}`, 'ENVIRONMENT_BOUNDARY');
  return result.stdout;
};
const remoteResult = (body) => commandResult('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', remoteHost, 'bash', '-s'], {
  input: laneDockerHost ? `export DOCKER_HOST=${quote(laneDockerHost)}\n${body}` : body,
});
const remote = (body) => {
  const result = remoteResult(body);
  if (result.status !== 0) fail(`SSH:${compact(result.stderr || result.stdout)}`, 'ENVIRONMENT_BOUNDARY');
  return result.stdout;
};
const atomicWrite = (target, value) => {
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, value);
  renameSync(temporary, target);
};
const previousControls = () => existsSync(evidence) ? readdirSync(evidence).flatMap((entry) => {
  try {
    const manifest = JSON.parse(readFileSync(path.join(evidence, entry, 'run-manifest.json'), 'utf8'));
    const value = manifest.controlRecord?.value;
    const sameExecutionPlane = laneDockerHost ? manifest.testcontainersLane?.dockerHost === laneDockerHost : !manifest.testcontainersLane;
    return manifest.remote?.hostAlias === remoteHost && sameExecutionPlane && value?.pid && value?.bootId && value?.processStartTicks ? [{runId: manifest.runId, ...value}] : [];
  } catch { return []; }
}) : [];
const preflightResources = () => {
  const candidates = previousControls();
  const probes = candidates.map((value) => `probe ${quote(value.runId)} ${quote(value.pid)} ${quote(value.bootId)} ${quote(value.processStartTicks)}`).join('\n');
  const result = remoteResult(script('set -euo pipefail', 'probe(){ local id="$1" pid="$2" boot="$3" start="$4"; if kill -0 "$pid" 2>/dev/null && test "$(cat /proc/sys/kernel/random/boot_id)" = "$boot" && test "$(awk \'{print $22}\' /proc/$pid/stat)" = "$start"; then printf "LIVE\\t%s\\t%s\\t%s\\n" "$id" "$pid" "$(ps -o rss= -p "$pid" | tr -d \' \')"; fi; }', probes, 'awk \'/MemAvailable:/ {print "MEM\\t" int($2/1024)}\' /proc/meminfo', 'docker ps -aq --filter label=org.testcontainers=true | sed "s/^/CONTAINER\\t/" || true', 'docker volume ls -q --filter label=org.testcontainers=true | sed "s/^/VOLUME\\t/" || true'));
  if (result.status !== 0) fail('REMOTE_RESOURCE_PREFLIGHT_UNAVAILABLE', 'ENVIRONMENT_BOUNDARY');
  const rows = result.stdout.trim().split('\n').filter(Boolean).map((line) => line.split('\t'));
  const live = rows.filter(([kind]) => kind === 'LIVE'); const rssMiB = Math.ceil(live.reduce((sum, row) => sum + Number(row[3] || 0), 0) / 1024);
  const containers = rows.filter(([kind]) => kind === 'CONTAINER').map((row) => row[1]); const volumes = rows.filter(([kind]) => kind === 'VOLUME').map((row) => row[1]);
  const snapshot = {limits: resourceLimits, observedAt: now(), previousLive: live.map((row) => ({runId: row[1], pid: Number(row[2]), rssKiB: Number(row[3])})), previousRssMiB: rssMiB, memoryAvailableMiB: Number(rows.find(([kind]) => kind === 'MEM')?.[1] ?? 0), staleTestcontainers: {containers, volumes}};
  if (live.length > resourceLimits.maxPreviousLive || rssMiB > resourceLimits.maxPreviousRssMiB) fail('REMOTE_RESOURCE_BUDGET_EXCEEDED', 'ENVIRONMENT_BOUNDARY');
  if (containers.length || volumes.length) fail('REMOTE_TESTCONTAINERS_STALE_RESOURCE', 'ENVIRONMENT_BOUNDARY');
  return snapshot;
};

const validateControlRecord = (control, expected) => {
  for (const key of ['runId', 'remoteRoot', 'pid', 'pgid', 'bootId', 'processStartTicks', 'commandSha256', 'phase', 'logPath', 'phasePath']) {
    if (!(key in control) || control[key] === '' || control[key] === null) throw new Error(`CONTROL_RECORD_FIELD_MISSING:${key}`);
  }
  if (control.runId !== expected.runId || control.remoteRoot !== expected.remoteRoot || control.commandSha256 !== expected.commandSha256 || control.logPath !== expected.logPath || control.phasePath !== expected.phasePath) throw new Error('CONTROL_RECORD_IDENTITY_MISMATCH');
  if (!/^\d+$/.test(String(control.pid)) || !/^\d+$/.test(String(control.pgid)) || !/^\d+$/.test(String(control.processStartTicks)) || !/^[a-f0-9]{64}$/.test(control.commandSha256)) throw new Error('CONTROL_RECORD_IDENTITY_INVALID');
  return control;
};

export const parseAndValidateRunManifest = (manifest) => {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.kind !== 'r5-managed-testcontainers-run') throw new Error('RUN_MANIFEST_INVALID');
  for (const key of ['runId', 'task', 'startedAt', 'remote', 'sourceSha256', 'sourceSync', 'logPath', 'phaseEvents', 'heartbeats', 'logInspection', 'controlRecord', 'business', 'cleanup', 'firstFailure', 'lastKnownGood', 'brokenBoundary']) {
    if (!(key in manifest)) throw new Error(`RUN_MANIFEST_FIELD_MISSING:${key}`);
  }
  if (!manifest.sourceSync || !['PENDING', 'PASS', 'FAIL'].includes(manifest.sourceSync.status) || !Array.isArray(manifest.sourceSync.requiredPaths)) throw new Error('RUN_MANIFEST_SOURCE_SYNC_INVALID');
  validateGradleDistribution(manifest.gradleDistribution);
  const phases = manifest.phaseEvents.map((event) => event.phase);
  for (const phase of requiredPhases) if (!phases.includes(phase)) throw new Error(`MISSING_PHASE:${phase}`);
  if (!Array.isArray(manifest.lifecycleEvents)) throw new Error('MISSING_LIFECYCLE_EVENTS');
  const lifecycle = manifest.lifecycleEvents.map((event) => event.event);
  for (const event of requiredLifecycleEvents) if (!lifecycle.includes(event)) throw new Error(`MISSING_LIFECYCLE_EVENT:${event}`);
  if (lifecycle.indexOf('LAUNCHED') > lifecycle.indexOf('RECONNECTED_CONTROL') || lifecycle.indexOf('RECONNECTED_CONTROL') > lifecycle.indexOf('COLLECTED_ARTIFACTS')) throw new Error('LIFECYCLE_EVENT_ORDER_INVALID');
  for (const event of manifest.lifecycleEvents) if (requiredLifecycleEvents.includes(event.event) && event.outcome !== 'PASS') throw new Error(`LIFECYCLE_EVENT_NOT_PASS:${event.event}`);
  if (!Array.isArray(manifest.heartbeats) || manifest.heartbeats.length === 0) throw new Error('MISSING_HEARTBEAT');
  if (!manifest.controlRecord.verified || manifest.controlRecord.reusedAfterReconnect !== true) throw new Error('CONTROL_RECORD_NOT_VERIFIED');
  validateControlRecord(manifest.controlRecord.value, manifest.controlRecord.expected);
  const identity = manifest.controlRecord.reconnect?.identityReadback;
  if (!manifest.controlRecord.reconnect?.readAt) throw new Error('CONTROL_RECORD_RECONNECT_NOT_RECORDED');
  if (!identity || ['pid', 'pgid', 'bootId', 'processStartTicks', 'commandSha256'].some((key) => String(identity[key]) !== String(manifest.controlRecord.value[key]))) throw new Error('CONTROL_RECORD_RECONNECT_IDENTITY_MISMATCH');
  if (manifest.logInspection.readCount < 1 || !manifest.logInspection.lastReadAt || manifest.logInspection.status === 'LOG_NOT_AVAILABLE') throw new Error('LOG_NOT_AVAILABLE');
  validateCleanupReceipt(manifest.cleanup);
  if (!['PASS', 'FAIL', 'NOT_APPLICABLE'].includes(manifest.business.status)) throw new Error('BUSINESS_STATUS_INVALID');
  return manifest;
};
export const validateCleanupReceipt = (cleanup) => {
  if (cleanup?.status !== 'PASS' || cleanup.reaped !== true) throw new Error('CLEANUP_NOT_PASS');
  for (const component of ['process', 'scratch', 'containers', 'volumes']) if (cleanup[component] !== 'PASS') throw new Error(`CLEANUP_RECEIPT_MISSING_OR_NOT_PASS:${component}`);
  return cleanup;
};
const reusableSuiteTargetManifest = (target) => {
  if (!existsSync(evidence)) return null;
  const candidates = readdirSync(evidence).flatMap((entry) => {
    try {
      const manifest = JSON.parse(readFileSync(path.join(evidence, entry, 'run-manifest.json'), 'utf8'));
      return isReusableSuiteTargetPass(manifest, target) ? [manifest] : [];
    } catch { return []; }
  }).sort((left, right) => String(right.completedAt ?? '').localeCompare(String(left.completedAt ?? '')));
  return candidates[0] ?? null;
};
export const validateBackendPerformance196WorkloadResult = (workloadResult) => {
  if (workloadResult?.kind !== 'backend-performance-testcontainers-196-workload-result'
      || workloadResult.status !== 'PASS'
      || workloadResult.businessStatus !== 'PASS'
      || workloadResult.completedOperations !== 196) throw new Error('BP_U06_WORKLOAD_RESULT_NOT_PASS');
  if (workloadResult.cleanupStatus !== backendPerformance196WorkloadCleanupStatus
      || workloadResult.cleanupOwner !== backendPerformance196WorkloadCleanupOwner) {
    throw new Error('BP_U06_WORKLOAD_CLEANUP_OWNER_INVALID');
  }
  return workloadResult;
};

export const validateBackendAcceptanceWorkloadResult = (workloadResult, expectedOperationCount) => {
  const reportedOperationCountIsSafe = Number.isSafeInteger(workloadResult?.expectedOperations) && workloadResult.expectedOperations >= 0;
  const expectedOperationCountIsSafe = Number.isSafeInteger(expectedOperationCount) && expectedOperationCount >= 0;
  if (workloadResult?.kind !== 'backend-acceptance-workload-result'
      || !['PASS', 'FAIL'].includes(workloadResult.status)
      || !['PASS', 'FAIL'].includes(workloadResult.contractStatus)
      || !['PASS', 'FAIL'].includes(workloadResult.businessStatus)
      || !['PASS', 'FAIL'].includes(workloadResult.performanceStatus)
      || !['PASS', 'FAIL'].includes(workloadResult.cleanupStatus)
      || !reportedOperationCountIsSafe
      || !Number.isSafeInteger(workloadResult.completedOperations)
      || workloadResult.completedOperations < 0
      || workloadResult.completedOperations > workloadResult.expectedOperations
      || (expectedOperationCountIsSafe && workloadResult.expectedOperations !== expectedOperationCount)) {
    throw new Error('BACKEND_ACCEPTANCE_WORKLOAD_RESULT_INVALID');
  }
  if (workloadResult.status === 'PASS' && workloadResult.completedOperations !== workloadResult.expectedOperations) {
    throw new Error('BACKEND_ACCEPTANCE_WORKLOAD_RESULT_INVALID');
  }
  if (workloadResult.status === 'PASS'
      && (workloadResult.contractStatus !== 'PASS' || workloadResult.businessStatus !== 'PASS' || workloadResult.performanceStatus !== 'PASS' || workloadResult.cleanupStatus !== 'PASS')) {
    throw new Error('BACKEND_ACCEPTANCE_WORKLOAD_RESULT_NOT_FOUR_DIMENSION_PASS');
  }
  return workloadResult;
};
export const deriveBackendPerformance196ChildFailure = ({workloadResult, gradleStatus}) => {
  if (workloadResult !== undefined && workloadResult !== null) {
    if (workloadResult.kind !== 'backend-performance-testcontainers-196-workload-result'
        || !['PASS', 'FAIL'].includes(workloadResult.status)
        || !['PASS', 'FAIL'].includes(workloadResult.businessStatus)) throw new Error('BP_U06_WORKLOAD_RESULT_INVALID');
    if (workloadResult.status === 'FAIL') {
      if (workloadResult.businessStatus !== 'FAIL' || !stableFailureCode.test(workloadResult.firstFailure ?? '')) throw new Error('BP_U06_WORKLOAD_RESULT_FIRST_FAILURE_INVALID');
      return workloadResult.firstFailure;
    }
  }
  return gradleStatus === 0 ? null : 'REMOTE_GRADLE_EXIT_NONZERO';
};
export const finalizeCleanupAfterCollection = (cleanup, artifactCollectionFailure) => ({
  ...cleanup,
  collection: artifactCollectionFailure
    ? {status: 'FAIL', reason: 'ARTIFACT_COLLECTION_FAILED'}
    : {status: 'PASS'},
});

/** The final adapter may consume this runner only as a parent-bound technical child. */
export function validateFinalAdapterChildManifest(manifest, {parentRunId, runtime, task: expectedTask, remoteHostFingerprint}) {
  parseAndValidateRunManifest(manifest);
  const binding = manifest.finalAdapterBinding;
  if (!binding || binding.parentRunId !== parentRunId || binding.runtime !== runtime || binding.task !== expectedTask || binding.remoteHostFingerprint !== remoteHostFingerprint) throw new Error('R5_FINAL_ADAPTER_CHILD_BINDING_INVALID');
  if (manifest.task !== expectedTask || manifest.business.status !== 'PASS' || manifest.cleanup.status !== 'PASS') throw new Error('R5_FINAL_ADAPTER_CHILD_EVIDENCE_INVALID');
  return manifest;
}

class ManagedRun {
  constructor(directory, expected) {
    this.directory = directory;
    this.manifestPath = path.join(directory, 'run-manifest.json');
    this.manifest = {
      schemaVersion: 1, kind: 'r5-managed-testcontainers-run', runId, task, startedAt: now(),
      remote: {hostAlias: remoteHost, hostTrust: remoteHostTrust, root: remoteRoot, dependencyCache: remoteDependencyCache},
      ...(laneDockerHost ? {testcontainersLane: {dockerHost: laneDockerHost, workspace: remoteWorkspace}} : {}),
      ...(backendAcceptanceLaneContract ? {backendAcceptanceLane: backendAcceptanceLaneContract} : {}),
      ...(finalAdapterBinding() ? {finalAdapterBinding: finalAdapterBinding()} : {}),
      ...(suiteTarget ? {suiteTarget} : {}),
      sourceSha256: sha256(readFileSync(process.argv[1], 'utf8')),
      sourceSync: {status: 'PENDING', workspace: remoteWorkspace, requiredPaths: isBackendPerformance196Run ? [...backendPerformance196SourcePaths] : isBackendAcceptanceRun ? [...backendAcceptanceSourcePaths] : []},
      gradleDistribution: {path: remoteGradleDistribution, sha256: gradleDistributionSha, localHome: gradleHome, localHomeSource: gradleHomeResolution.source, status: 'PENDING'},
      logPath: expected.logPath,
      phaseEvents: [], lifecycleEvents: [], heartbeats: [], childHeartbeatSequence: 0, stallDiagnostics: [], logInspection: {readCount: 0, observedBytes: 0, status: 'PENDING'},
      controlRecord: {expected, verified: false, reusedAfterReconnect: false},
      resourceBudget: {preflight: {status: 'PENDING'}, samples: []},
      firstFailure: null, lastKnownGood: 'PREPARED', brokenBoundary: null,
      business: {status: 'NOT_APPLICABLE'}, cleanup: {status: 'NOT_ATTEMPTED', reaped: false},
    };
    this.startedEpochMillis = Date.now();
    this.phase('PREPARED', 'PASS');
    runnerEvent('STARTED', {RUN_ID: runId, TASK: task, STARTED_AT: this.manifest.startedAt, MODE: isBackendPerformance196Run ? 'BACKEND_PERFORMANCE_196' : 'FOCUSED'});
  }
  persist() { atomicWrite(this.manifestPath, `${JSON.stringify(this.manifest, null, 2)}\n`); }
  phase(phase, outcome, detail) {
    this.manifest.phaseEvents.push({sequence: this.manifest.phaseEvents.length + 1, phase, outcome, timestamp: now(), ...(detail ? {detail} : {})});
    if (outcome === 'PASS') this.manifest.lastKnownGood = phase;
    this.persist();
    runnerEvent('PHASE', {RUN_ID: runId, PHASE: phase, OUTCOME: outcome, ELAPSED_MS: Date.now() - this.startedEpochMillis});
  }
  lifecycle(event, outcome = 'PASS', detail) {
    this.manifest.lifecycleEvents.push({sequence: this.manifest.lifecycleEvents.length + 1, event, outcome, timestamp: now(), ...(detail ? {detail} : {})});
    this.persist();
  }
  recordReconnect(control, identityReadback) {
    const reconnectVerified = ['pid', 'pgid', 'bootId', 'processStartTicks', 'commandSha256'].every((key) => String(identityReadback?.[key]) === String(control[key]));
    this.manifest.controlRecord.value = control;
    this.manifest.controlRecord.verified = reconnectVerified;
    this.manifest.controlRecord.reusedAfterReconnect = reconnectVerified;
    this.manifest.controlRecord.reconnect = {readAt: now(), identityReadback};
    this.persist();
  }
  heartbeat(event) { this.manifest.heartbeats.push({...event, observedAt: now()}); this.manifest.resourceBudget.samples.push({observedAt: now(), ...event.resource}); this.persist(); }
  failure(error) {
    if (!this.manifest.firstFailure) this.manifest.firstFailure = error instanceof Error ? error.message : String(error);
    this.manifest.brokenBoundary = error instanceof RunnerFailure ? error.boundary : 'RUNNER';
    this.persist();
  }
}

const backendPerformanceProgress = () => {
  if (!isBackendPerformance196Run) return undefined;
  const result = remoteResult(script(
    'set -euo pipefail',
    `events=${quote(`${remoteResults}/http-request-events.jsonl`)}`,
    `catalog_events=${quote(`${remoteResults}/backend-performance-196/catalog-runtime/results/catalog-inventory-api/events.jsonl`)}`,
    `run_id=${quote(finalPerformanceRunId)}`,
    'completed=0; if [ -f "$events" ]; then completed=$(awk -v run_id="$run_id" \'index($0, "\\\"runId\\\":\\\"" run_id "\\\"") && index($0, "\\\"performanceArea\\\":\\\"U07_ROUTE\\\"") { count++ } END { print count + 0 }\' "$events"); fi',
    'phase=CATALOG_NOT_STARTED; if [ -f "$catalog_events" ]; then phase=$(tail -n 1 "$catalog_events" | sed -n \'s/.*"phase":"\\([A-Z0-9_]*\\)".*/\\1/p\'); fi',
    'printf "%s\\t%s\\n" "$completed" "${phase:-CATALOG_EVENT_UNPARSEABLE}"',
  ));
  const [completedText, phase = 'CATALOG_PHASE_UNKNOWN'] = result.stdout.trim().split('\t');
  if (result.status !== 0 || !/^\d+$/.test(completedText || '')) fail('TESTCONTAINERS_PROGRESS_UNAVAILABLE', 'ENVIRONMENT_BOUNDARY');
  const completed = Number(completedText);
  if (!Number.isSafeInteger(completed) || completed < 0 || completed > 196) fail('TESTCONTAINERS_PROGRESS_INVALID', 'ENVIRONMENT_BOUNDARY');
  return {completed, total: 196, phase: phase || 'CATALOG_PHASE_UNKNOWN'};
};

const backendAcceptanceProgress = () => {
  if (!isBackendAcceptanceRun) return undefined;
  const total = Number(process.env.V2S_BACKEND_ACCEPTANCE_OPERATION_COUNT);
  if (!Number.isSafeInteger(total) || total < 1) fail('BACKEND_ACCEPTANCE_PROGRESS_TOTAL_INVALID', 'ENVIRONMENT_BOUNDARY');
  const runIdValue = process.env.V2S_BACKEND_ACCEPTANCE_RUN_ID;
  const result = remoteResult(backendAcceptanceProgressScript({
    eventsPath: `${remoteResults}/http-request-events.jsonl`,
    runId: runIdValue ?? '',
    operationIds: process.env.V2S_BACKEND_ACCEPTANCE_OPERATION_IDS ?? process.env.V2S_BACKEND_ACCEPTANCE_OPERATION_ID ?? '',
  }));
  if (result.status !== 0) fail('BACKEND_ACCEPTANCE_PROGRESS_UNAVAILABLE', 'ENVIRONMENT_BOUNDARY');
  const [completedText = '0', failedText = '0', firstFailure = 'NONE'] = result.stdout.trim().split('\t');
  const completed = Number(completedText); const failed = Number(failedText);
  if (!Number.isSafeInteger(completed) || completed < 0 || completed > total || !Number.isSafeInteger(failed) || failed < 0) fail('BACKEND_ACCEPTANCE_PROGRESS_INVALID', 'ENVIRONMENT_BOUNDARY');
  return {
    current: completed,
    completed,
    total,
    remaining: Math.max(0, total - completed),
    lane: Number(process.env.V2S_BACKEND_ACCEPTANCE_LANE_ID || 1),
    firstFailure: firstFailure === 'NONE' ? null : firstFailure,
    failed,
  };
};

export const backendAcceptanceProgressScript = ({eventsPath, runId, operationIds} = {}) => {
  const operationIdText = Array.isArray(operationIds) ? operationIds.join(',') : String(operationIds ?? '');
  const succeededAwk = String.raw`index($0, "\"runId\":\"" run_id "\"") && index($0, "\"operationId\":\"backendAcceptanceMeasurementSinkIntegrity\"") == 0 && index($0, "\"outcome\":\"SUCCEEDED\"") { op=$0; sub(/^.*"operationId":"/, "", op); sub(/".*$/, "", op); if (operation_ids == ",," || index(operation_ids, "," op ",") > 0) seen[op]=1 } END { count=0; for (op in seen) count++; print count + 0 }`;
  // A semantic Problem response is intentionally recorded as FAILED by the
  // server event stream, including an expected 5xx accepted by the route
  // oracle.  The progress probe can stop a lane only for an observation
  // failure emitted by the diagnostic interceptor; the workload aggregator
  // owns the expected-status decision and must remain the single semantic
  // authority.
  const failedAwk = String.raw`index($0, "\"runId\":\"" run_id "\"") && index($0, "\"outcome\":\"FAILED\"") && index($0, "\"observationError\":\"") { count++ } END { print count + 0 }`;
  const firstFailureAwk = String.raw`index($0, "\"runId\":\"" run_id "\"") && index($0, "\"outcome\":\"FAILED\"") && index($0, "\"observationError\":\"") { print "BACKEND_ACCEPTANCE_ROUTE_FAILED"; exit }`;
  return script(
    'set -euo pipefail',
    `events=${quote(eventsPath)}`,
    `run_id=${quote(runId ?? '')}`,
    `operation_ids=${quote(`,${operationIdText},`)}`,
    'completed=0; failed=0; first_failure=NONE',
    `if [ -f "$events" ]; then completed=$(awk -v run_id="$run_id" -v operation_ids="$operation_ids" '${succeededAwk}' "$events"); failed=$(awk -v run_id="$run_id" '${failedAwk}' "$events"); first_failure=$(awk -v run_id="$run_id" '${firstFailureAwk}' "$events"); fi`,
    'printf "%s\\t%s\\t%s\\n" "$completed" "$failed" "${first_failure:-NONE}"',
  );
};

const uploadSource = async () => {
  if (laneWorkspace) {
    const initialized = remoteResult(script(
      'set -euo pipefail',
      `workspace=${quote(remoteWorkspace)}`,
      'if [[ ! "$workspace" =~ ^/tmp/r5-tc-suite-[0-9]+-[0-9]+/lane-[1-9][0-9]*/workspace$ ]]; then exit 64; fi',
      'if test -f "$workspace/.v2s-suite-source-ready"; then printf "REUSED\\n"; else mkdir -p "$workspace"; printf "SYNC_REQUIRED\\n"; fi',
    ));
    if (initialized.status !== 0) fail('SUITE_LANE_WORKSPACE_CHECK_FAILED', 'SOURCE_SYNC');
    if (initialized.stdout.trim() === 'REUSED') return {status: 'PASS', workspace: remoteWorkspace, requiredPaths: [], reusedLaneInitialization: true};
    if (initialized.stdout.trim() !== 'SYNC_REQUIRED') fail('SUITE_LANE_WORKSPACE_CHECK_INVALID', 'SOURCE_SYNC');
  }
  const source = spawn('tar', ['--exclude=.git', '--exclude=.runtime', '--exclude=.gradle', '--exclude=.yarn', '--exclude=node_modules', '--exclude=build', '--exclude=*/build', '-C', root, '-czf', '-', '.'], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
  const upload = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', remoteHost, `tar -xzf - -C ${quote(remoteWorkspace)}`], {cwd: root, stdio: ['pipe', 'ignore', 'pipe']});
  // Register close observers before piping: a fast connection failure must not lose the close event
  // and leave the managed runner awaiting an orphaned promise with no child to diagnose or reap.
  const sourceExit = waitForClose(source);
  const uploadExit = waitForClose(upload);
  let sourceError = ''; let uploadError = '';
  source.stderr.setEncoding('utf8').on('data', (chunk) => { sourceError += chunk; });
  upload.stderr.setEncoding('utf8').on('data', (chunk) => { uploadError += chunk; });
  source.stdout.pipe(upload.stdin);
  const [sourceCode, uploadCode] = await Promise.all([sourceExit, uploadExit]);
  if (sourceCode !== 0 || uploadCode !== 0) fail(`SOURCE_UPLOAD_FAILED:${compact(sourceError || uploadError || 'UNKNOWN', 180)}`, 'SOURCE_SYNC');
  if (laneWorkspace) {
    const marked = remoteResult(script('set -euo pipefail', `workspace=${quote(remoteWorkspace)}`, 'touch "$workspace/.v2s-suite-source-ready"'));
    if (marked.status !== 0) fail('SUITE_LANE_WORKSPACE_MARK_FAILED', 'SOURCE_SYNC');
  }
  if (isBackendPerformance196Run || isBackendAcceptanceRun) {
    const requiredPaths = isBackendPerformance196Run ? backendPerformance196SourcePaths : backendAcceptanceSourcePaths;
    const sourceCheck = remoteResult(script(
      'set -euo pipefail',
      `workspace=${quote(remoteWorkspace)}`,
      ...requiredPaths.map((sourcePath) => `test -f "$workspace/${sourcePath}" || { printf '${isBackendPerformance196Run ? 'BP_U06_REMOTE_SOURCE_MISSING' : 'BACKEND_ACCEPTANCE_REMOTE_SOURCE_MISSING'}:${sourcePath}\\n' >&2; exit 73; }`),
      `printf 'SOURCE_SYNC_REQUIRED_PATHS=%s\\n' ${quote(requiredPaths.join(','))}`,
    ));
    if (sourceCheck.status !== 0) fail(`${isBackendPerformance196Run ? 'SOURCE_SYNC_REQUIRED_FILE_MISSING' : 'BACKEND_ACCEPTANCE_SOURCE_SYNC_REQUIRED_FILE_MISSING'}:${compact(sourceCheck.stderr || sourceCheck.stdout, 180)}`, 'SOURCE_SYNC');
  }
  return {status: 'PASS', workspace: remoteWorkspace, requiredPaths: isBackendPerformance196Run ? [...backendPerformance196SourcePaths] : isBackendAcceptanceRun ? [...backendAcceptanceSourcePaths] : []};
};

const readLaneEngineId = () => {
  if (!laneDockerHost) return null;
  const result = remoteResult(script(
    'set -euo pipefail',
    'engine_id=$(docker info --format "{{.ID}}")',
    'printf "%s\\n" "$engine_id"',
  ));
  const engineId = result.stdout.trim();
  if (result.status !== 0 || !/^[a-f0-9-]{32,128}$/i.test(engineId)) fail('BACKEND_ACCEPTANCE_LANE_ENGINE_ID_UNAVAILABLE', 'ENVIRONMENT_BOUNDARY');
  return engineId;
};

const syncGradle = async (run) => {
  const syncLog = path.join(run.directory, 'gradle-sync.log');
  const distribution = validateGradleDistribution(run.manifest.gradleDistribution);
  appendFileSync(syncLog, `${now()} event=GRADLE_DISTRIBUTION_CHECK_STARTED remote=${remoteHost} sha256=${distribution.sha256}\n`);
  const reusable = remoteResult(script(
    'set -euo pipefail',
    `distribution=${quote(distribution.path)}`,
    `expected=${quote(distribution.sha256)}`,
    'marker="$distribution/.v2s-gradle-distribution.sha256"',
    'if test -x "$distribution/bin/gradle" && test -f "$marker" && test "$(cat \"$marker\")" = "$expected"; then printf "REUSED\\n"; else printf "SYNC_REQUIRED\\n"; fi',
  ));
  if (reusable.status !== 0) fail('GRADLE_DISTRIBUTION_CHECK_FAILED', 'SOURCE_SYNC');
  if (reusable.stdout.trim() === 'REUSED') {
    run.manifest.gradleDistribution = {...distribution, status: 'REUSED'};
    run.persist();
    appendFileSync(syncLog, `${now()} event=GRADLE_DISTRIBUTION_REUSED remote=${remoteHost}\n`);
    return;
  }
  if (reusable.stdout.trim() !== 'SYNC_REQUIRED') fail('GRADLE_DISTRIBUTION_CHECK_INVALID', 'SOURCE_SYNC');
  const staging = `${remoteRoot}/gradle-distribution-staging`;
  appendFileSync(syncLog, `${now()} event=GRADLE_DISTRIBUTION_SYNC_STARTED remote=${remoteHost} staging=${staging}\n`);
  const sync = spawn('rsync', ['-a', '--delete', '--timeout=30', '--progress', `${gradleHome}/`, `${remoteHost}:${staging}/`], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
  let output = '';
  const capture = (chunk) => {
    const text = String(chunk);
    output += text;
    appendFileSync(syncLog, text);
  };
  sync.stdout.setEncoding('utf8').on('data', capture);
  sync.stderr.setEncoding('utf8').on('data', capture);
  const exitCode = await waitForClose(sync);
  if (exitCode !== 0) fail(`GRADLE_SYNC_FAILED:${compact(output || 'NO_TRANSFER_OUTPUT', 180)}`, 'SOURCE_SYNC');
  if (!existsSync(syncLog)) fail('GRADLE_SYNC_LOG_NOT_AVAILABLE', 'SOURCE_SYNC');
  const published = remoteResult(script(
    'set -euo pipefail',
    `distribution=${quote(distribution.path)}`,
    `staging=${quote(staging)}`,
    `expected=${quote(distribution.sha256)}`,
    'test -x "$staging/bin/gradle"',
    'if test -x "$distribution/bin/gradle" && test -f "$distribution/.v2s-gradle-distribution.sha256" && test "$(cat \"$distribution/.v2s-gradle-distribution.sha256\")" = "$expected"; then rm -rf "$staging"; printf "REUSED_AFTER_RACE\\n"; else test ! -e "$distribution"; printf "%s\\n" "$expected" > "$staging/.v2s-gradle-distribution.sha256"; mv "$staging" "$distribution"; printf "SYNCED\\n"; fi',
  ));
  if (published.status !== 0) fail('GRADLE_DISTRIBUTION_PUBLISH_FAILED', 'SOURCE_SYNC');
  const status = published.stdout.trim();
  if (!['SYNCED', 'REUSED_AFTER_RACE'].includes(status)) fail('GRADLE_DISTRIBUTION_PUBLISH_INVALID', 'SOURCE_SYNC');
  run.manifest.gradleDistribution = {...distribution, status};
  run.persist();
  appendFileSync(syncLog, `${now()} event=GRADLE_DISTRIBUTION_${status} remote=${remoteHost}\n`);
};

export const managedProcessCompletionScript = ({heartbeat = 'emit RUNNING HEARTBEAT', sleep = 'sleep 15'} = {}) => [
  // `kill -0` stays true for a zombie child. Read the process state so the wrapper reaches
  // `wait`, records the real exit code, and still emits its failure artifacts.
  'while [ -d "/proc/$gradle_pid" ]; do',
  'gradle_state=$(ps -o stat= -p "$gradle_pid" 2>/dev/null | tr -d " ")',
  'case "$gradle_state" in ""|Z*) break ;; esac',
  heartbeat,
  sleep,
  'done',
  'gradle_status=0',
  'wait "$gradle_pid" || gradle_status=$?',
].join('\n');

export const managedGradleHomeScript = () => 'export V2S_GRADLE_HOME="$gradle"';
export const backendAcceptanceFaultEnvironmentScript = () => ['export V2S_CATALOG_TEST_FAULTS=true'];

export const backendAcceptanceSignalTraceInstanceName = (candidateRunId) => {
  if (typeof candidateRunId !== 'string' || !/^r5-tc-[0-9]+-[0-9]+$/.test(candidateRunId)) {
    throw new Error('BACKEND_ACCEPTANCE_SIGNAL_TRACE_RUN_ID_INVALID');
  }
  return `v2s-ba-signal-${sha256(candidateRunId).slice(0, 24)}`;
};

export const validateBackendAcceptanceCatalogChildOutcome = (outcome) => {
  if (outcome?.kind !== 'backend-acceptance-catalog-child-outcome'
      || !['PASS', 'FAIL'].includes(outcome.status)
      || typeof outcome.runId !== 'string'
      || !Number.isInteger(outcome.childPid)
      || outcome.childPid < 1
      || (outcome.signal !== null && !/^SIG[A-Z0-9]+$/.test(outcome.signal ?? ''))
      || (outcome.terminalFailure !== null && !stableFailureCode.test(outcome.terminalFailure ?? ''))
      || typeof outcome.brokenBoundary !== 'string') {
    throw new Error('BACKEND_ACCEPTANCE_CATALOG_CHILD_OUTCOME_INVALID');
  }
  if (outcome.status === 'FAIL' && !stableFailureCode.test(outcome.terminalFailure ?? '')) {
    throw new Error('BACKEND_ACCEPTANCE_CATALOG_CHILD_OUTCOME_INVALID');
  }
  return outcome;
};

export const validateBackendAcceptanceSignalTraceReceipt = (receipt, expectedRunId) => {
  if (receipt?.kind !== 'backend-acceptance-signal-trace'
      || receipt.schemaVersion !== 1
      || receipt.runId !== expectedRunId
      || !['PASS', 'FAIL'].includes(receipt.status)
      || receipt.eventFilter !== 'signal_generate(sig == 15); sched_process_fork(child_comm == pkill|killall)'
      || !/^v2s-ba-signal-[a-f0-9]{24}$/.test(receipt.instanceName ?? '')
      || typeof receipt.tracePath !== 'string'
      || !receipt.tracePath.startsWith('results/')) {
    throw new Error('BACKEND_ACCEPTANCE_SIGNAL_TRACE_RECEIPT_INVALID');
  }
  return receipt;
};

export const deriveBackendAcceptanceSignalProvenance = ({catalogChildOutcome, signalTraceReceipt, signalTraceText}) => {
  const child = validateBackendAcceptanceCatalogChildOutcome(catalogChildOutcome);
  if (child.signal !== 'SIGTERM') return {status: 'NOT_APPLICABLE', signal: child.signal ?? null};
  if (signalTraceReceipt.status !== 'PASS') return {status: 'UNATTRIBUTED', signal: 'SIGTERM', targetPid: child.childPid, reason: 'SIGNAL_TRACE_CAPTURE_FAILED'};
  if (typeof signalTraceText !== 'string') return {status: 'UNATTRIBUTED', signal: 'SIGTERM', targetPid: child.childPid, reason: 'SIGNAL_TRACE_CONTENT_MISSING'};
  const target = String(child.childPid).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const event = signalTraceText.split(/\r?\n/).find((line) => new RegExp(`\\bsig=\\s*15\\b`).test(line) && new RegExp(`\\bpid=\\s*${target}\\b`).test(line));
  if (!event) return {status: 'UNATTRIBUTED', signal: 'SIGTERM', targetPid: child.childPid, reason: 'SIGNAL_TRACE_TARGET_EVENT_MISSING'};
  // signal_generate's `comm` field describes the receiver.  ftrace's task
  // prefix is the sender; treating the former as the latter made an external
  // pkill look like the catalog Node child that received SIGTERM.
  const sender = event.match(/^\s*([^\r\n]+)-(\d+)\s+\[/);
  const receiverComm = event.match(/\bcomm=([^\s]{1,64})\b/)?.[1] ?? null;
  const senderComm = sender?.[1]?.trim() ?? null;
  const senderPid = sender?.[2] ? Number(sender[2]) : null;
  if (!senderComm || !Number.isSafeInteger(senderPid) || senderPid < 1) {
    return {status: 'UNATTRIBUTED', signal: 'SIGTERM', targetPid: child.childPid, reason: 'SIGNAL_TRACE_SENDER_IDENTITY_MISSING', eventSha256: sha256(event)};
  }
  const forkEvent = signalTraceText.split(/\r?\n/).find((line) => line.includes('sched_process_fork:') && new RegExp(String.raw`\bchild_pid=${senderPid}\b`).test(line));
  const senderParent = forkEvent?.match(/^\s*([^\r\n]+)-(\d+)\s+\[/);
  return {
    status: 'ATTRIBUTED', signal: 'SIGTERM', targetPid: child.childPid,
    senderComm, senderPid, receiverComm,
    senderParentComm: senderParent?.[1]?.trim() ?? null,
    senderParentPid: senderParent?.[2] ? Number(senderParent[2]) : null,
    eventSha256: sha256(event),
  };
};

export const backendAcceptanceSignalTraceScript = ({instanceName}) => {
  if (!/^v2s-ba-signal-[a-f0-9]{24}$/.test(instanceName ?? '')) throw new Error('BACKEND_ACCEPTANCE_SIGNAL_TRACE_INSTANCE_INVALID');
  return [
    'signal_trace_status=NOT_STARTED', 'signal_trace_error=NONE', 'signal_trace_cleaned=false', 'signal_trace_instance_created=false', 'signal_trace_reader_pid=0', 'signal_trace_reader_start=0',
    `signal_trace_instance_name=${quote(instanceName)}`, 'signal_trace_file="$root/results/backend-acceptance-signal-generate.trace"', 'signal_trace_stderr="$root/results/backend-acceptance-signal-generate.stderr"', 'signal_trace_receipt="$root/results/backend-acceptance-signal-trace.json"',
    'signal_trace_setup() {',
    '  signal_trace_root=""; for candidate in /sys/kernel/tracing /sys/kernel/debug/tracing; do if test -d "$candidate/instances" && test -d "$candidate/events/signal/signal_generate" && test -d "$candidate/events/sched/sched_process_fork"; then signal_trace_root="$candidate"; break; fi; done',
    '  if test -z "$signal_trace_root"; then signal_trace_status=FAIL; signal_trace_error=TRACEFS_UNAVAILABLE; return 0; fi',
    '  signal_trace_instance="$signal_trace_root/instances/$signal_trace_instance_name"',
    '  if test -e "$signal_trace_instance"; then signal_trace_status=FAIL; signal_trace_error=TRACE_INSTANCE_ALREADY_EXISTS; return 0; fi',
    '  if ! mkdir "$signal_trace_instance"; then signal_trace_status=FAIL; signal_trace_error=TRACE_INSTANCE_CREATE_FAILED; return 0; fi',
    '  signal_trace_instance_created=true',
    '  if ! printf "sig == 15\\n" > "$signal_trace_instance/events/signal/signal_generate/filter"; then signal_trace_status=FAIL; signal_trace_error=TRACE_FILTER_CONFIG_FAILED; return 0; fi',
    '  if ! printf \'child_comm == "pkill" || child_comm == "killall"\\n\' > "$signal_trace_instance/events/sched/sched_process_fork/filter"; then signal_trace_status=FAIL; signal_trace_error=TRACE_FILTER_CONFIG_FAILED; return 0; fi',
    '  cp "$signal_trace_instance/events/signal/signal_generate/format" "$root/results/backend-acceptance-signal-generate.format" 2>/dev/null || { signal_trace_status=FAIL; signal_trace_error=TRACE_FORMAT_CAPTURE_FAILED; return 0; }',
    '  cp "$signal_trace_instance/events/sched/sched_process_fork/format" "$root/results/backend-acceptance-signal-fork.format" 2>/dev/null || { signal_trace_status=FAIL; signal_trace_error=TRACE_FORMAT_CAPTURE_FAILED; return 0; }',
    '  : > "$signal_trace_file"; : > "$signal_trace_stderr"',
    '  setsid sh -c \'ulimit -f 8192; exec cat "$1/trace_pipe"\' sh "$signal_trace_instance" > "$signal_trace_file" 2> "$signal_trace_stderr" &',
    '  signal_trace_reader_pid=$!; for _ in $(seq 1 20); do test -r "/proc/$signal_trace_reader_pid/stat" && break; sleep 0.05; done',
    '  signal_trace_reader_start=$(awk \'{print $22}\' "/proc/$signal_trace_reader_pid/stat" 2>/dev/null || printf 0)',
    '  case "$signal_trace_reader_start" in *[!0-9]*|\"\") signal_trace_status=FAIL; signal_trace_error=TRACE_READER_IDENTITY_UNAVAILABLE; return 0;; esac',
    '  if ! printf 1 > "$signal_trace_instance/events/signal/signal_generate/enable" || ! printf 1 > "$signal_trace_instance/events/sched/sched_process_fork/enable" || ! printf 1 > "$signal_trace_instance/tracing_on"; then signal_trace_status=FAIL; signal_trace_error=TRACE_ENABLE_FAILED; return 0; fi',
    '  signal_trace_status=PASS',
    '}',
    'signal_trace_cleanup() {',
    '  if test "$signal_trace_cleaned" = true; then return 0; fi; signal_trace_cleaned=true',
    '  if test "${signal_trace_instance_created:-false}" = true; then',
    '    printf 0 > "$signal_trace_instance/tracing_on" 2>/dev/null || signal_trace_status=FAIL',
    '    printf 0 > "$signal_trace_instance/events/signal/signal_generate/enable" 2>/dev/null || signal_trace_status=FAIL',
    '    printf 0 > "$signal_trace_instance/events/sched/sched_process_fork/enable" 2>/dev/null || signal_trace_status=FAIL',
    '    if test "$signal_trace_reader_pid" -gt 0 && test -r "/proc/$signal_trace_reader_pid/stat" && test "$(awk \'{print $22}\' "/proc/$signal_trace_reader_pid/stat" 2>/dev/null || printf 0)" = "$signal_trace_reader_start"; then kill -TERM -- "-$signal_trace_reader_pid" 2>/dev/null || true; fi',
    '    wait "$signal_trace_reader_pid" 2>/dev/null || true',
    '    rmdir "$signal_trace_instance" 2>/dev/null || signal_trace_status=FAIL',
    '  fi',
    '  signal_trace_bytes=$(wc -c < "$signal_trace_file" 2>/dev/null | tr -d " " || printf 0)',
    '  tmp="$signal_trace_receipt.$$.tmp"; printf \'{"schemaVersion":1,"kind":"backend-acceptance-signal-trace","runId":"%s","status":"%s","error":"%s","instanceName":"%s","eventFilter":"signal_generate(sig == 15); sched_process_fork(child_comm == pkill|killall)","tracePath":"results/backend-acceptance-signal-generate.trace","readerPid":%s,"readerStartTicks":%s,"traceBytes":%s}\\n\' ' + quote(runId) + ' "$signal_trace_status" "$signal_trace_error" "$signal_trace_instance_name" "$signal_trace_reader_pid" "$signal_trace_reader_start" "$signal_trace_bytes" > "$tmp"; mv "$tmp" "$signal_trace_receipt"',
    '}',
    'signal_trace_setup', 'trap signal_trace_cleanup EXIT',
  ].join('\n');
};

const remoteRunScript = (commandSha256) => script(
  '#!/usr/bin/env bash', 'set -uo pipefail', `root=${quote(remoteRoot)}`, `workspace=${quote(remoteWorkspace)}`, `task=${quote(task)}`,
  `command_sha=${quote(commandSha256)}`, 'phase_file="$root/results/phase.jsonl"', 'log_file="$root/results/gradle.log"',
  `emit() { printf '{"timestamp":"%s","phase":"%s","outcome":"%s","pid":%s,"pgid":%s,"bootId":"%s","processStartTicks":%s,"commandSha256":"%s","logBytes":%s}\\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "$$" "$(ps -o pgid= -p $$ | tr -d ' ')" "$(cat /proc/sys/kernel/random/boot_id)" "$(awk '{print $22}' /proc/$$/stat)" "$command_sha" "$(wc -c < "$log_file" 2>/dev/null || printf 0)" >> "$phase_file"; }`,
  'emit PROCESS_STARTED PASS', `export GRADLE_USER_HOME=${quote(remoteDependencyCache)}`,
  // The remote JVM must opt in before Gradle loads any Testcontainers class. This prevents the
  // repository build guard from falling back to the developer's local DockerClientProviderStrategy.
  'export V2S_TESTCONTAINERS_EXECUTION_PLANE=remote', `export V2S_TESTCONTAINERS_REMOTE_HOST=${quote(remoteHost)}`,
  'export TESTCONTAINERS_RYUK_DISABLED=true',
  ...(isBackendPerformance196Run ? [
    'export V2S_RUNTIME_ENVIRONMENT=non-production',
    'export V2S_DEV_PROFILE=backend-performance-final-acceptance',
    `export V2S_DEV_NAMESPACE=${quote(finalPerformanceNamespace)}`,
    `export V2S_BACKEND_PERFORMANCE_FINAL_RUN_ID=${quote(finalPerformanceRunId)}`,
    `export V2S_HTTP_DIAGNOSTIC_RUN_ID=${quote(finalPerformanceRunId)}`,
    `export V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN=${quote(bootstrapLogin)}`,
    'final_secret=$(od -An -N32 -tx1 /dev/urandom | tr -d " \\n")',
    'db_hmac_key=$(od -An -N32 -tx1 /dev/urandom | tr -d " \\n")',
    'bootstrap_credential=$(od -An -N32 -tx1 /dev/urandom | tr -d " \\n")',
    'export V2S_BACKEND_PERFORMANCE_FINAL_SECRET="$final_secret"',
    'export V2S_DB_OPERATIONS_HMAC_KEY="$db_hmac_key"',
    'export V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL="$bootstrap_credential"',
    'export V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_ENABLED=true',
    'export CATERING_OTP_DEBUG_CODE_EXPOSURE=true',
    'export V2S_BACKEND_PERFORMANCE_FINAL_EVENTS="$root/results/http-request-events.jsonl"',
    'export V2S_DB_OPERATIONS_EVENTS="$root/results/db-operations.jsonl"',
    'export V2S_DB_STATEMENT_DICTIONARY="$root/results/statement-dictionary.json"',
    'export V2S_RUNTIME_DIR="$root/results/backend-performance-196"',
    'export V2S_BPF_OWNER_FIXTURE_REQUEST="$root/results/backend-performance-owner-fixture-request.json"',
    'export V2S_BPF_OWNER_FIXTURE_RESPONSE="$root/results/backend-performance-owner-fixture-response.json"',
    `export V2S_BPF_WORKLOAD_RESULT="$root/results/${backendPerformance196WorkloadResultName}"`,
    `export V2S_BACKEND_PERFORMANCE_REPORT_PATH="$root/results/backend-performance-testcontainers-196-report.json"`,
    'export V2S_REMOTE_WORKSPACE="$workspace"',
  ] : isBackendAcceptanceRun ? [
    'export V2S_RUNTIME_ENVIRONMENT=non-production',
    'export V2S_DEV_PROFILE=backend-acceptance',
    `export V2S_DEV_NAMESPACE=${quote(backendAcceptanceNamespace)}`,
    `export V2S_BACKEND_ACCEPTANCE_RUN_ID=${quote(backendAcceptanceRunId)}`,
    'backend_acceptance_secret=$(od -An -N32 -tx1 /dev/urandom | tr -d " \\n")',
    'export V2S_BACKEND_ACCEPTANCE_SECRET="$backend_acceptance_secret"',
    'export CATERING_OTP_DEBUG_CODE_EXPOSURE=true',
    'export V2S_BACKEND_ACCEPTANCE_EVENTS="$root/results/http-request-events.jsonl"',
  ] : []),
  `gradle=${quote(remoteGradleDistribution)}`,
  'test -x "$gradle/bin/gradle"',
  managedGradleHomeScript(),
  'cd "$workspace"',
  `"$gradle/bin/gradle" "$task" ${extraGradleArguments.map(quote).join(' ')} --no-daemon > "$log_file" 2>&1 &`, 'gradle_pid=$!', 'emit RUNNING PASS',
  managedProcessCompletionScript(),
  `docker ps -aq --filter label=org.testcontainers=true | sort > "$root/after-container-ids"`,
  `docker volume ls -q --filter label=org.testcontainers=true | sort > "$root/after-volume-ids"`,
  'comm -13 "$root/before-container-ids" "$root/after-container-ids" > "$root/results/uncollected-container-ids"',
  'comm -13 "$root/before-volume-ids" "$root/after-volume-ids" > "$root/results/uncollected-volume-ids"',
  'container_status=PASS; if [ -s "$root/results/uncollected-container-ids" ]; then container_status=FAIL; fi',
  'volume_status=PASS; if [ -s "$root/results/uncollected-volume-ids" ]; then volume_status=FAIL; fi',
  `find "$workspace" -type f -path '*/build/test-results/test/TEST-*.xml' -exec cp {} "$root/results/" \\; 2>/dev/null || true`,
  `printf '{"gradleStatus":%s,"containerCleanup":"%s","volumeCleanup":"%s","commandSha256":"%s","signalTrace":"%s"}\\n' "$gradle_status" "$container_status" "$volume_status" ${quote(commandSha256)} "\${signal_trace_status:-NOT_APPLICABLE}" > "$root/results/remote-result.json"`,
  'collect_status=PASS; if [ "$container_status" != PASS ] || [ "$volume_status" != PASS ]; then collect_status=FAIL; fi',
  'emit COLLECTED "$collect_status"', 'exit "$gradle_status"',
);

const expectedControl = (commandSha256) => ({runId, remoteRoot, commandSha256, logPath: `${remoteResults}/gradle.log`, phasePath: `${remoteResults}/phase.jsonl`});
const launch = (remoteScript, expected) => {
  const encoded = Buffer.from(remoteScript).toString('base64');
  const result = remoteResult(script(
    'set -euo pipefail', `root=${quote(remoteRoot)}`, `encoded=${quote(encoded)}`, `command_sha=${quote(expected.commandSha256)}`,
    'mkdir -p "$root/results"', ': > "$root/results/gradle.log"', ': > "$root/results/phase.jsonl"', 'printf "%s" "$encoded" | base64 -d > "$root/results/managed-run.sh"',
    'setsid bash "$root/results/managed-run.sh" >/dev/null 2>&1 &', 'pid=$!', 'for _ in $(seq 1 20); do test -r "/proc/$pid/stat" && break; sleep 0.05; done',
    'boot_id=$(cat /proc/sys/kernel/random/boot_id)', "start_ticks=$(awk '{print $22}' \"/proc/$pid/stat\")", 'pgid=$(ps -o pgid= -p "$pid" | tr -d " ")',
    'tmp="$root/results/.control.$$.json"',
    `printf '{"runId":"%s","remoteRoot":"%s","pid":%s,"pgid":%s,"bootId":"%s","processStartTicks":%s,"commandSha256":"%s","phase":"PROCESS_STARTED","logPath":"%s","phasePath":"%s"}\\n' ${quote(runId)} "$root" "$pid" "$pgid" "$boot_id" "$start_ticks" "$command_sha" ${quote(expected.logPath)} ${quote(expected.phasePath)} > "$tmp"`,
    'mv "$tmp" "$root/results/control.json"', 'printf "LAUNCH_ACK=PASS\\n"',
  ));
  return {acknowledged: result.status === 0 && result.stdout.includes('LAUNCH_ACK=PASS'), output: compact(result.stdout || result.stderr, 500)};
};

const readControl = (expected) => {
  const result = remoteResult(script('set -euo pipefail', `root=${quote(remoteRoot)}`, 'test -f "$root/results/control.json"', 'cat "$root/results/control.json"'));
  if (result.status !== 0) fail('CONTROL_RECORD_NOT_AVAILABLE', 'ENVIRONMENT_BOUNDARY');
  try { return validateControlRecord(JSON.parse(result.stdout), expected); } catch (error) { fail(error.message || 'CONTROL_RECORD_INVALID', 'ENVIRONMENT_BOUNDARY'); }
};
const remoteIdentity = (control) => {
  const result = remoteResult(script(
    'set -euo pipefail', `root=${quote(control.remoteRoot)}`, `pid=${quote(control.pid)}`,
    'control="$root/results/control.json"', 'test -r "$control"',
    'if ! kill -0 "$pid" 2>/dev/null; then printf \'{"state":"REAPED"}\\n\'; exit 0; fi',
    "boot=$(cat /proc/sys/kernel/random/boot_id); start=$(awk '{print $22}' \"/proc/$pid/stat\"); pgid=$(ps -o pgid= -p \"$pid\" | tr -d \" \")",
    "record_pid=$(grep -o '\"pid\":[0-9]*' \"$control\" | head -n1 | cut -d: -f2); record_pgid=$(grep -o '\"pgid\":[0-9]*' \"$control\" | head -n1 | cut -d: -f2); record_boot=$(grep -o '\"bootId\":\"[^\"]*\"' \"$control\" | head -n1 | cut -d'\"' -f4); record_start=$(grep -o '\"processStartTicks\":[0-9]*' \"$control\" | head -n1 | cut -d: -f2); record_sha=$(grep -o '\"commandSha256\":\"[a-f0-9]*\"' \"$control\" | head -n1 | cut -d'\"' -f4)",
    'if [ "$record_pid" != "$pid" ] || [ "$record_pgid" != "$pgid" ] || [ "$record_boot" != "$boot" ] || [ "$record_start" != "$start" ] || ! printf "%s" "$record_sha" | grep -Eq "^[a-f0-9]{64}$"; then printf \'{"state":"MISMATCH"}\\n\'; exit 0; fi',
    managedProcessMembershipScript(),
    `workspace=${quote(remoteWorkspace)}`, "test_result_bytes=$(find \"$workspace\" -type f -path '*/build/test-results/test/TEST-*.xml' -printf '%s\\n' 2>/dev/null | awk '{total += $1} END {print total + 0}')",
    ...((() => {
      const runtimeEvidencePath = runtimeEvidencePathForRun({
        remoteResults,
        runType: isBackendPerformance196Run ? 'backend-performance' : isBackendAcceptanceRun ? 'backend-acceptance' : 'none',
      });
      return runtimeEvidencePath ? [
        `runtime_evidence=${quote(runtimeEvidencePath)}`,
        'runtime_evidence_bytes=0; runtime_evidence_sha256=NONE; if [ -f "$runtime_evidence" ]; then runtime_evidence_bytes=$(wc -c < "$runtime_evidence" | tr -d " "); runtime_evidence_sha256=$(sha256sum "$runtime_evidence" | awk \'{print $1}\'); fi',
      ] : ['runtime_evidence_bytes=0; runtime_evidence_sha256=NONE'];
    })()),
    'printf \'{"state":"MATCH","pid":%s,"pgid":%s,"bootId":"%s","processStartTicks":%s,"commandSha256":"%s","workloadSha256":"%s","testResultBytes":%s,"runtimeEvidenceSha256":"%s","runtimeEvidenceBytes":%s}\\n\' "$pid" "$pgid" "$boot" "$start" "$record_sha" "$workload" "$test_result_bytes" "$runtime_evidence_sha256" "$runtime_evidence_bytes"',
  ));
  if (result.status !== 0) fail('CONTROL_IDENTITY_READ_FAILED', 'ENVIRONMENT_BOUNDARY');
  let readback; try { readback = JSON.parse(result.stdout); } catch { fail('CONTROL_IDENTITY_INVALID_JSON', 'ENVIRONMENT_BOUNDARY'); }
  const state = readback.state;
  if (state === 'MISMATCH') fail('CONTROL_IDENTITY_MISMATCH', 'ENVIRONMENT_BOUNDARY');
  if (!['MATCH', 'REAPED'].includes(state)) fail('CONTROL_IDENTITY_UNKNOWN', 'ENVIRONMENT_BOUNDARY');
  const identityReadback = state === 'MATCH' ? Object.fromEntries(['pid', 'pgid', 'bootId', 'processStartTicks', 'commandSha256'].map((key) => [key, readback[key]])) : null;
  if (identityReadback && ['pid', 'pgid', 'bootId', 'processStartTicks', 'commandSha256'].some((key) => String(identityReadback[key]) !== String(control[key]))) fail('CONTROL_IDENTITY_MISMATCH', 'ENVIRONMENT_BOUNDARY');
  return {state, identityReadback, workloadSha256: readback.workloadSha256 ?? 'REAPED', testResultBytes: Number(readback.testResultBytes ?? 0), runtimeEvidenceSha256: readback.runtimeEvidenceSha256 ?? 'REAPED', runtimeEvidenceBytes: Number(readback.runtimeEvidenceBytes ?? 0)};
};

const reconnectControl = (expected) => {
  const control = readControl(expected);
  const identity = remoteIdentity(control);
  if (identity.state !== 'MATCH') fail('CONTROL_RECORD_RECONNECT_REAPED', 'ENVIRONMENT_BOUNDARY');
  return {control, identityReadback: identity.identityReadback};
};

const createLifecycleHarness = (run, operations) => ({
  launch: (...args) => {
    const result = operations.launch(...args);
    run.lifecycle('LAUNCHED', result.acknowledged ? 'PASS' : 'FAIL', {acknowledged: result.acknowledged});
    return result;
  },
  reconnect: (expected) => {
    const result = operations.reconnect(expected);
    run.recordReconnect(result.control, result.identityReadback);
    run.lifecycle('RECONNECTED_CONTROL');
    return result.control;
  },
  collect: () => {
    operations.collect();
    run.lifecycle('COLLECTED_ARTIFACTS');
  },
});

const incrementalRead = (run, remotePath, localName, offset, kind) => {
  const result = remoteResult(script('set -euo pipefail', `target=${quote(remotePath)}`, 'test -f "$target"', 'size=$(wc -c < "$target")', 'printf "SIZE=%s\\n" "$size"', `if [ "$size" -gt ${offset} ]; then tail -c +$(( ${offset} + 1 )) "$target"; fi`));
  if (result.status !== 0) fail(kind === 'log' ? 'LOG_NOT_AVAILABLE' : 'PHASE_STREAM_NOT_AVAILABLE', 'ENVIRONMENT_BOUNDARY');
  const newline = result.stdout.indexOf('\n');
  const size = Number(result.stdout.slice(5, newline));
  if (!Number.isSafeInteger(size) || size < offset) fail('INCREMENTAL_OFFSET_INVALID', 'ENVIRONMENT_BOUNDARY');
  const delta = result.stdout.slice(newline + 1);
  if (delta) appendFileSync(path.join(run.directory, localName), delta);
  return {size, delta};
};
const collectPhase = (run, offset) => {
  const result = incrementalRead(run, run.manifest.controlRecord.expected.phasePath, 'phase.jsonl', offset, 'phase');
  for (const line of result.delta.split('\n').filter(Boolean)) {
    let event; try { event = JSON.parse(line); } catch { fail('PHASE_STREAM_INVALID', 'ENVIRONMENT_BOUNDARY'); }
    if (event.outcome === 'HEARTBEAT') {
      const control = run.manifest.controlRecord.value;
      if (!control || ['pid', 'pgid', 'bootId', 'processStartTicks', 'commandSha256'].some((key) => String(event[key]) !== String(control[key]))) fail('PHASE_HEARTBEAT_IDENTITY_MISMATCH', 'ENVIRONMENT_BOUNDARY');
      run.manifest.childHeartbeatSequence += 1;
      run.heartbeat({...event, childHeartbeatSequence: run.manifest.childHeartbeatSequence});
    }
    else if (event.phase && !run.manifest.phaseEvents.some((phase) => phase.phase === event.phase)) run.phase(event.phase, event.outcome ?? 'PASS');
  }
  return result.size;
};
const parseStallDiagnostics = (output) => {
  const section = (start, end) => output.slice(output.indexOf(start) + start.length, output.indexOf(end)).trim();
  if (!output.includes('TAIL_BEGIN') || !output.includes('TAIL_END') || !output.includes('PROCESS_BEGIN') || !output.includes('PROCESS_END') || !output.includes('CONTAINERS_BEGIN') || !output.includes('CONTAINERS_END')) throw new Error('STALL_DIAGNOSTICS_INVALID');
  return {tail: section('TAIL_BEGIN', 'TAIL_END'), process: section('PROCESS_BEGIN', 'PROCESS_END'), containerLabels: section('CONTAINERS_BEGIN', 'CONTAINERS_END')};
};
const diagnoseStall = (run, control) => {
  const result = remoteResult(script(
    'set -euo pipefail', `root=${quote(control.remoteRoot)}`, `pid=${quote(control.pid)}`,
    'log="$root/results/gradle.log"', 'test -r "$log"',
    'printf "TAIL_BEGIN\\n"; tail -n 80 "$log"; printf "\\nTAIL_END\\n"',
    'pgid=$(ps -o pgid= -p "$pid" | tr -d " "); printf "PROCESS_BEGIN\\n"; ps -eo pid=,ppid=,pgid=,stat=,etime=,time=,command= | awk -v expected_pgid="$pgid" \'$3 == expected_pgid\'; printf "PROCESS_END\\n"',
    'printf "CONTAINERS_BEGIN\\n"; docker ps --filter label=org.testcontainers=true --format \'{{.ID}} {{.Label "org.testcontainers.ryuk"}}\'; printf "\\nCONTAINERS_END\\n"',
  ));
  if (result.status !== 0) fail('STALL_DIAGNOSTICS_NOT_AVAILABLE', 'ENVIRONMENT_BOUNDARY');
  let diagnostic; try { diagnostic = parseStallDiagnostics(result.stdout); } catch (error) { fail(error.message || 'STALL_DIAGNOSTICS_INVALID', 'ENVIRONMENT_BOUNDARY'); }
  appendFileSync(path.join(run.directory, 'stall-tail.log'), `${diagnostic.tail}\n`);
  run.manifest.stallDiagnostics.push({
    observedAt: now(), tail: {bytes: Buffer.byteLength(diagnostic.tail), sha256: sha256(diagnostic.tail)},
    process: compact(diagnostic.process, 240), containerLabels: compact(diagnostic.containerLabels, 500),
    lastKnownGood: run.manifest.lastKnownGood, firstFailure: run.manifest.firstFailure, brokenBoundary: run.manifest.brokenBoundary,
  });
  run.persist();
};
const collectArtifacts = (run) => {
  // The detached session can reap between its final write and rsync visibility. This is a bounded
  // artifact-readiness probe, not a liveness retry: no result file after two seconds is a hard boundary.
  const ready = remoteResult(script(
    'set -euo pipefail', `target=${quote(`${remoteResults}/remote-result.json`)}`,
    'for _ in $(seq 1 20); do test -f "$target" && exit 0; sleep 0.1; done', 'exit 72',
  ));
  if (ready.status !== 0) fail('REMOTE_RESULT_NOT_AVAILABLE', 'ENVIRONMENT_BOUNDARY');
  const result = commandResult('rsync', ['-a', `${remoteHost}:${remoteResults}/`, `${run.directory}/`]);
  if (result.status !== 0) fail(`ARTIFACT_COLLECTION_FAILED:${compact(result.stderr || result.stdout)}`, 'ENVIRONMENT_BOUNDARY');
  if (!existsSync(path.join(run.directory, 'gradle.log'))) fail('LOG_NOT_AVAILABLE', 'ENVIRONMENT_BOUNDARY');
  if (existsSync(path.join(run.directory, 'remote-result.json')) && !run.manifest.phaseEvents.some((phase) => phase.phase === 'COLLECTED')) run.phase('COLLECTED', 'PASS');
};
const reap = (run, control) => {
  const result = remoteResult(script(
    'set -euo pipefail', `root=${quote(remoteRoot)}`, `pid=${quote(control.pid)}`, `expected_boot=${quote(control.bootId)}`, `expected_start=${quote(control.processStartTicks)}`, `expected_pgid=${quote(control.pgid)}`,
    'test -f "$root/results/control.json"', 'if kill -0 "$pid" 2>/dev/null; then',
    "boot=$(cat /proc/sys/kernel/random/boot_id); start=$(awk '{print $22}' \"/proc/$pid/stat\"); pgid=$(ps -o pgid= -p \"$pid\" | tr -d \" \")",
    'test "$boot" = "$expected_boot" && test "$start" = "$expected_start" && test "$pgid" = "$expected_pgid" || exit 70',
    'kill -TERM -- "-$pgid" 2>/dev/null || true', 'for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done', 'if kill -0 "$pid" 2>/dev/null; then kill -KILL -- "-$pgid" 2>/dev/null || true; fi', 'fi',
    'if kill -0 "$pid" 2>/dev/null; then exit 71; fi',
    'container_status=PASS; volume_status=PASS; workspace_status=NOT_APPLICABLE',
    'docker ps -aq --filter label=org.testcontainers=true | sort > "$root/results/reap-container-ids"', 'docker volume ls -q --filter label=org.testcontainers=true | sort > "$root/results/reap-volume-ids"',
    'test ! -s "$root/results/reap-container-ids" || container_status=FAIL', 'test ! -s "$root/results/reap-volume-ids" || volume_status=FAIL',
    'rm -rf -- "$root"', 'scratch_status=PASS; test ! -e "$root" || scratch_status=FAIL',
    `workspace=${quote(remoteWorkspace)}`,
    'case "$workspace" in /tmp/r5-tc-suite-[0-9]*-[0-9]*/lane-[1-9][0-9]*/workspace) lane_root=$(dirname "$workspace"); rm -rf -- "$lane_root"; test ! -e "$lane_root" && workspace_status=PASS || workspace_status=FAIL ;; esac',
    'printf "PROCESS_CLEANUP=PASS\\nREMOTE_SCRATCH_CLEANUP=%s\\nTESTCONTAINERS_CONTAINER_CLEANUP=%s\\nTESTCONTAINERS_VOLUME_CLEANUP=%s\\nLANE_WORKSPACE_CLEANUP=%s\\n" "$scratch_status" "$container_status" "$volume_status" "$workspace_status"',
    'test "$scratch_status" = PASS && test "$container_status" = PASS && test "$volume_status" = PASS && test "$workspace_status" != FAIL', 'printf "REAPED=PASS\\n"',
  ));
  const receipt = {process: result.stdout.includes('PROCESS_CLEANUP=PASS') ? 'PASS' : 'FAIL', scratch: result.stdout.includes('REMOTE_SCRATCH_CLEANUP=PASS') ? 'PASS' : 'FAIL', containers: result.stdout.includes('TESTCONTAINERS_CONTAINER_CLEANUP=PASS') ? 'PASS' : 'FAIL', volumes: result.stdout.includes('TESTCONTAINERS_VOLUME_CLEANUP=PASS') ? 'PASS' : 'FAIL', workspace: result.stdout.match(/LANE_WORKSPACE_CLEANUP=(PASS|NOT_APPLICABLE|FAIL)/)?.[1] ?? 'FAIL'};
  const status = result.status === 0 && result.stdout.includes('REAPED=PASS') && Object.entries(receipt).filter(([key]) => key !== 'workspace').every(([, value]) => value === 'PASS') && receipt.workspace !== 'FAIL' ? 'PASS' : 'FAIL';
  run.manifest.cleanup = {status, reaped: status === 'PASS', ...receipt, completedAt: now(), output: compact(result.stdout || result.stderr, 500)};
  run.phase('CLEANUP', status);
  run.persist();
};
const reapUnlaunched = (run) => {
  const result = remoteResult(script(
    'set -euo pipefail', `root=${quote(remoteRoot)}`,
    'case "$root" in /tmp/r5-tc-[0-9]*-[0-9]*) ;; *) exit 64 ;; esac',
    'container_status=PASS; volume_status=PASS; workspace_status=NOT_APPLICABLE',
    'docker ps -aq --filter label=org.testcontainers=true | sort > "$root/reap-container-ids"', 'docker volume ls -q --filter label=org.testcontainers=true | sort > "$root/reap-volume-ids"',
    'test ! -s "$root/reap-container-ids" || container_status=FAIL', 'test ! -s "$root/reap-volume-ids" || volume_status=FAIL',
    'rm -rf -- "$root"', 'scratch_status=PASS; test ! -e "$root" || scratch_status=FAIL',
    `workspace=${quote(remoteWorkspace)}`,
    'case "$workspace" in /tmp/r5-tc-suite-[0-9]*-[0-9]*/lane-[1-9][0-9]*/workspace) lane_root=$(dirname "$workspace"); rm -rf -- "$lane_root"; test ! -e "$lane_root" && workspace_status=PASS || workspace_status=FAIL ;; esac',
    'printf "PROCESS_CLEANUP=PASS\\nREMOTE_SCRATCH_CLEANUP=%s\\nTESTCONTAINERS_CONTAINER_CLEANUP=%s\\nTESTCONTAINERS_VOLUME_CLEANUP=%s\\nLANE_WORKSPACE_CLEANUP=%s\\n" "$scratch_status" "$container_status" "$volume_status" "$workspace_status"',
    'test "$scratch_status" = PASS && test "$container_status" = PASS && test "$volume_status" = PASS && test "$workspace_status" != FAIL', 'printf "REAPED=PASS\\n"',
  ));
  const receipt = {process: result.stdout.includes('PROCESS_CLEANUP=PASS') ? 'PASS' : 'FAIL', scratch: result.stdout.includes('REMOTE_SCRATCH_CLEANUP=PASS') ? 'PASS' : 'FAIL', containers: result.stdout.includes('TESTCONTAINERS_CONTAINER_CLEANUP=PASS') ? 'PASS' : 'FAIL', volumes: result.stdout.includes('TESTCONTAINERS_VOLUME_CLEANUP=PASS') ? 'PASS' : 'FAIL', workspace: result.stdout.match(/LANE_WORKSPACE_CLEANUP=(PASS|NOT_APPLICABLE|FAIL)/)?.[1] ?? 'FAIL'};
  const status = result.status === 0 && result.stdout.includes('REAPED=PASS') && Object.entries(receipt).filter(([key]) => key !== 'workspace').every(([, value]) => value === 'PASS') && receipt.workspace !== 'FAIL' ? 'PASS' : 'FAIL';
  run.manifest.cleanup = {status, reaped: status === 'PASS', ...receipt, completedAt: now(), output: compact(result.stdout || result.stderr, 500)};
  run.phase('CLEANUP', status);
  run.persist();
};

const readJsonLines = (file) => {
  if (!existsSync(file)) fail('BP_U06_DYNAMIC_EVIDENCE_FILE_MISSING', 'REPORT');
  return readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch { fail('BP_U06_DYNAMIC_EVIDENCE_JSONL_INVALID', `${path.basename(file)}:${index + 1}`); }
  });
};

const buildBackendPerformance196Report = (directory, remoteResult) => {
  const contract = loadAuthoritativeContract(root);
  const managedReportPath = path.join(directory, backendPerformance196ManagedReportName);
  const managedManifestPath = path.join(directory, backendPerformance196ManagedManifestName);
  const workloadResultPath = path.join(directory, backendPerformance196WorkloadResultName);
  if (!existsSync(workloadResultPath)) fail('BP_U06_WORKLOAD_RESULT_MISSING', 'REPORT');
  const workloadResult = JSON.parse(readFileSync(workloadResultPath, 'utf8'));
  try { validateBackendPerformance196WorkloadResult(workloadResult); }
  catch (failure) { fail(failure.message, 'REPORT'); }
  const completionEvents = readJsonLines(path.join(directory, 'http-request-events.jsonl'))
    .filter((event) => event?.runId === finalPerformanceRunId && event?.performanceArea === 'U07_ROUTE');
  const databaseOperations = readJsonLines(path.join(directory, 'db-operations.jsonl'))
    .filter((row) => row?.runId === finalPerformanceRunId);
  const scenarioResults = deriveScenarioResults(contract, completionEvents);
  const cleanup = {
    status: remoteResult.containerCleanup === 'PASS' && remoteResult.volumeCleanup === 'PASS' ? 'PASS' : 'FAIL',
    ownedRemoteResources: remoteResult.containerCleanup === 'PASS' && remoteResult.volumeCleanup === 'PASS',
    terminalManifestVerified: true,
    runManifestPath: managedManifestPath,
  };
  const report = buildDynamicReport({
    contract,
    runId: finalPerformanceRunId,
    completionEvents,
    databaseOperations,
    scenarioResults,
    cleanup,
    runtime: {manifestPath: managedManifestPath},
  });
  atomicWrite(managedReportPath, `${JSON.stringify(report, null, 2)}\n`);
  return {report, managedReportPath, managedManifestPath};
};

const writeBackendAcceptanceChildResult = (run, directory) => {
  if (!isBackendAcceptanceRun) return;
  const parentRuntime = process.env.V2S_BACKEND_ACCEPTANCE_PARENT_RUNTIME;
  if (typeof parentRuntime !== 'string' || !path.isAbsolute(parentRuntime)) return;
  const workloadPath = path.join(directory, 'backend-acceptance-workload-result.json');
  let workloadResult = null;
  let workloadFailure = null;
  if (existsSync(workloadPath)) {
    try {
      workloadResult = JSON.parse(readFileSync(workloadPath, 'utf8'));
      validateBackendAcceptanceWorkloadResult(workloadResult, Number(process.env.V2S_BACKEND_ACCEPTANCE_OPERATION_COUNT));
    } catch (error) {
      workloadFailure = error instanceof Error ? error.message : 'BACKEND_ACCEPTANCE_WORKLOAD_RESULT_INVALID';
    }
  } else workloadFailure = 'BACKEND_ACCEPTANCE_WORKLOAD_RESULT_MISSING';
  const businessStatus = workloadResult?.businessStatus === 'PASS' && run.manifest.business.status === 'PASS' ? 'PASS' : 'FAIL';
  const performanceStatus = workloadResult?.performanceStatus === 'PASS' ? 'PASS' : 'FAIL';
  const contractStatus = workloadResult?.contractStatus === 'PASS' ? 'PASS' : 'FAIL';
  const cleanupStatus = run.manifest.cleanup.status === 'PASS' ? 'PASS' : 'FAIL';
  const status = businessStatus === 'PASS' && performanceStatus === 'PASS' && contractStatus === 'PASS' && cleanupStatus === 'PASS' ? 'PASS' : 'FAIL';
  const childResult = {
    schemaVersion: 1,
    kind: 'backend-acceptance-managed-child-result',
    runId: process.env.V2S_BACKEND_ACCEPTANCE_RUN_ID,
    status,
    contractStatus,
    businessStatus,
    performanceStatus,
    cleanupStatus,
    completedOperations: workloadResult?.completedOperations ?? 0,
    business: {status: businessStatus, workload: workloadResult ? 'PASS' : 'FAIL'},
    performance: {status: performanceStatus},
    cleanup: {status: cleanupStatus, process: run.manifest.cleanup.process ?? 'FAIL', scratch: run.manifest.cleanup.scratch ?? 'FAIL', containers: run.manifest.cleanup.containers ?? 'FAIL', volumes: run.manifest.cleanup.volumes ?? 'FAIL', workspace: run.manifest.cleanup.workspace ?? 'NOT_APPLICABLE'},
    firstFailure: workloadFailure || workloadResult?.firstFailure || run.manifest.firstFailure || null,
    evidence: path.relative(root, directory),
  };
  atomicWrite(path.join(parentRuntime, 'managed-child-result.json'), `${JSON.stringify(childResult, null, 2)}\n`);
};

const execute = async () => {
  validateInvocation();
  try { validateGradleHome(gradleHome, typeof gradleHome === 'string' && existsSync(path.join(gradleHome, 'bin', 'gradle'))); }
  catch (error) { fail(error.message, 'ENVIRONMENT_BOUNDARY'); }
  const commandSha256 = sha256(JSON.stringify({executable: 'gradle', task, args: [...extraGradleArguments, '--no-daemon'], mode: isBackendPerformance196Run ? 'BACKEND_PERFORMANCE_196' : 'GENERIC'}));
  const expected = expectedControl(commandSha256);
  const directory = path.join(evidence, runId);
  mkdirSync(directory, {recursive: true});
  const run = new ManagedRun(directory, expected);
  let control; let lifecycle; let artifactsCollected = false; let artifactCollectionFailure = false; let remotePrepared = false; let launchAttempted = false; let failure; let remoteResult;
  try {
    const localBudget = spawnSync(path.join(root, 'scripts/env/check-runtime-resource-budget'), [path.join(root, '.runtime')], {cwd: root, encoding: 'utf8'});
    if (localBudget.status !== 0) fail('LOCAL_MANAGED_RESOURCE_BUDGET_EXCEEDED', 'ENVIRONMENT_BOUNDARY');
    const preflight = preflightResources(); run.manifest.resourceBudget.preflight = {status: 'PASS', ...preflight}; run.manifest.resourceBudget.samples.push({observedAt: now(), memoryAvailableMiB: preflight.memoryAvailableMiB, previousRssMiB: preflight.previousRssMiB}); run.persist();
    remote(script('set -euo pipefail', `root=${quote(remoteRoot)}`, `cache=${quote(remoteDependencyCache)}`, 'case "$root" in /tmp/r5-tc-[0-9]*-[0-9]*) ;; *) exit 64 ;; esac', 'case "$cache" in /tmp/catering-v2s-r5-gradle-cache) ;; *) exit 64 ;; esac', 'mkdir -p "$root/workspace" "$root/results" "$cache"', `docker ps -aq --filter label=org.testcontainers=true | sort > "$root/before-container-ids"`, `docker volume ls -q --filter label=org.testcontainers=true | sort > "$root/before-volume-ids"`)); remotePrepared = true;
    run.manifest.sourceSync = await uploadSource();
    if (laneDockerHost) {
      const engineId = readLaneEngineId();
      run.manifest.testcontainersLane = {...run.manifest.testcontainersLane, engineId};
    }
    run.persist(); run.phase('SOURCE_SYNCED', 'PASS');
    await syncGradle(run); run.phase('GRADLE_SYNCED', 'PASS');
    lifecycle = createLifecycleHarness(run, {launch, reconnect: reconnectControl, collect: () => collectArtifacts(run)});
    launchAttempted = true;
    const launched = lifecycle.launch(remoteRunScript(commandSha256), expected);
    control = lifecycle.reconnect(expected);
    if (!launched.acknowledged) fail('REMOTE_LAUNCH_ACK_MISSING', 'ENVIRONMENT_BOUNDARY');
    run.phase('PROCESS_STARTED', 'PASS');
    let logOffset = 0; let phaseOffset = 0; let previousObservation; let stalls = 0;
    for (;;) {
      const log = incrementalRead(run, expected.logPath, 'gradle.log', logOffset, 'log'); logOffset = log.size;
      run.manifest.logInspection = {readCount: run.manifest.logInspection.readCount + 1, observedBytes: logOffset, lastReadAt: now(), status: 'READ'}; run.persist();
      phaseOffset = collectPhase(run, phaseOffset);
      const identity = remoteIdentity(control); run.heartbeat({phase: 'RUNNING', identity: identity.state, logBytes: logOffset, workloadSha256: identity.workloadSha256, testResultBytes: identity.testResultBytes, runtimeEvidenceSha256: identity.runtimeEvidenceSha256, runtimeEvidenceBytes: identity.runtimeEvidenceBytes, resource: {}});
      const progress = isBackendPerformance196Run ? backendPerformanceProgress() : undefined;
      if (progress) {
        run.manifest.progress = {...progress, observedAt: now()};
        run.persist();
      }
      runnerEvent('HEARTBEAT', {
        RUN_ID: runId,
        ELAPSED_MS: Date.now() - run.startedEpochMillis,
        LOG_BYTES: logOffset,
        ...(progress ? {
          LANE: progress.lane ?? 'ALL',
          CURRENT: progress.current ?? progress.completed,
          COMPLETED: progress.completed,
          TOTAL: progress.total,
          REMAINING: progress.remaining ?? Math.max(0, progress.total - progress.completed),
          FIRST_FAILURE: progress.firstFailure ?? 'NONE',
        } : {PROGRESS: 'TASK_RUNNING'}),
      });
      if (identity.state === 'REAPED') break;
      // A child heartbeat proves that the wrapper shell is alive, not that Gradle
      // or a Testcontainers pull is advancing.  Only observable workload output
      // may reset the no-progress diagnosis interval.
      const observation = workloadObservationKey({logBytes: logOffset, testResultBytes: identity.testResultBytes, runtimeEvidenceSha256: identity.runtimeEvidenceSha256, runtimeEvidenceBytes: identity.runtimeEvidenceBytes});
      stalls = observation === previousObservation ? stalls + 1 : 0; previousObservation = observation;
      if (stalls === stallDiagnosticSamples) { diagnoseStall(run, control); run.phase('STALL_DIAGNOSING', 'PASS'); }
      if (stalls >= stallTerminationSamples) { diagnoseStall(run, control); run.phase('TERMINATING', 'PASS'); break; }
      await sleep(10_000);
    }
    try { lifecycle.collect(); artifactsCollected = true; }
    catch (error) { artifactCollectionFailure = true; throw error; }
    remoteResult = JSON.parse(readFileSync(path.join(directory, 'remote-result.json'), 'utf8'));
    if (remoteResult.gradleStatus === 0) {
      const testExecution = classifyGradleTestExecution(readFileSync(path.join(directory, 'gradle.log'), 'utf8'), task);
      run.manifest.testExecution = testExecution;
      run.persist();
      if (testExecution.status !== 'PASS') fail(testExecution.reason, 'REMOTE_TEST');
    }
    if (isBackendPerformance196Run) {
      const workloadResultPath = path.join(directory, backendPerformance196WorkloadResultName);
      if (!existsSync(workloadResultPath)) fail('BP_U06_WORKLOAD_RESULT_MISSING', 'REMOTE_TEST');
      let workloadResult;
      try { workloadResult = JSON.parse(readFileSync(workloadResultPath, 'utf8')); }
      catch { fail('BP_U06_WORKLOAD_RESULT_INVALID', 'REMOTE_TEST'); }
      const childFailure = deriveBackendPerformance196ChildFailure({workloadResult, gradleStatus: remoteResult.gradleStatus});
      if (childFailure) {
        run.manifest.childWorkload = {status: 'FAIL', firstFailure: childFailure};
        run.persist();
        fail(childFailure, 'REMOTE_TEST');
      }
      run.manifest.childWorkload = {status: 'PASS', firstFailure: null};
      run.persist();
    }
    if (remoteResult.gradleStatus !== 0 || remoteResult.containerCleanup !== 'PASS' || remoteResult.volumeCleanup !== 'PASS') {
      run.manifest.residualTestcontainers = remoteResult.containerCleanup !== 'PASS' || remoteResult.volumeCleanup !== 'PASS'; run.persist();
      fail('REMOTE_TEST_OR_CONTAINER_CLEANUP_FAILED', 'REMOTE_TEST');
    }
    if (!isBackendPerformance196Run) run.manifest.business = {status: 'PASS', remoteGradleStatus: remoteResult.gradleStatus};
  } catch (error) {
    failure = error instanceof Error ? error : new RunnerFailure(String(error));
    run.failure(failure); run.manifest.business = {status: 'FAIL', reason: failure.message};
    try { if (control && !artifactsCollected) { lifecycle?.collect(); artifactsCollected = true; } } catch (collectionError) { artifactCollectionFailure = true; run.failure(collectionError); }
  } finally {
    if (control) reap(run, control); else if (remotePrepared && !launchAttempted) reapUnlaunched(run); else run.manifest.cleanup = {status: 'FAIL', reaped: false, process: 'FAIL', scratch: 'FAIL', containers: 'FAIL', volumes: 'FAIL', reason: remotePrepared ? 'CONTROL_RECORD_UNAVAILABLE_AFTER_LAUNCH' : 'REMOTE_SCRATCH_NOT_PREPARED'};
    run.manifest.cleanup = finalizeCleanupAfterCollection(run.manifest.cleanup, artifactCollectionFailure);
    if (run.manifest.residualTestcontainers === true) run.manifest.cleanup = {...run.manifest.cleanup, status: 'FAIL', reaped: false, reason: 'TESTCONTAINERS_RESIDUAL_RESOURCE'};
    run.manifest.completedAt = now();
    run.manifest.durationMillis = Date.now() - run.startedEpochMillis;
    run.persist();
  }
  let managedReportPath; let managedManifestPath;
  if (isBackendPerformance196Run && !failure && run.manifest.cleanup.status === 'PASS') {
    try {
      parseAndValidateRunManifest(run.manifest);
      const managedReport = buildBackendPerformance196Report(directory, remoteResult);
      managedReportPath = managedReport.managedReportPath;
      managedManifestPath = managedReport.managedManifestPath;
      const report = managedReport.report;
      run.manifest.business = {status: 'PASS', remoteGradleStatus: remoteResult.gradleStatus, reportStatus: report.status, reportPath: path.relative(root, managedReportPath), operations: report.business.completedOperations};
      run.manifest.dynamicReport = {status: 'PASS', reportKind: report.reportKind, testPlanId: report.testPlanId, operationCount: report.business.completedOperations, reportPath: path.relative(root, managedReportPath)};
      run.persist();
    } catch (error) {
      failure = error instanceof Error ? error : new RunnerFailure(String(error), 'REPORT');
      run.failure(failure);
      run.manifest.business = {status: 'FAIL', reason: failure.message};
      run.persist();
    }
  }
  try { parseAndValidateRunManifest(run.manifest); } catch (error) { if (!failure) failure = error; }
  if (isBackendPerformance196Run && managedManifestPath) atomicWrite(managedManifestPath, `${JSON.stringify(run.manifest, null, 2)}\n`);
  if (failure || run.manifest.business.status !== 'PASS' || run.manifest.cleanup.status !== 'PASS') {
    process.stderr.write(`R5_REMOTE_TESTCONTAINERS=FAIL; REASON=${compact(failure?.message || 'BUSINESS_OR_CLEANUP_NOT_PASS')}; EVIDENCE=${path.relative(root, directory)}; BUSINESS=${run.manifest.business.status}; CLEANUP=${run.manifest.cleanup.status}\n`);
    process.exitCode = 2;
  } else process.stdout.write(`R5_REMOTE_TESTCONTAINERS=PASS; TASK=${task}; EVIDENCE=${path.relative(root, directory)}; BUSINESS=PASS; CLEANUP=PASS\n`);
  runnerEvent('FINISHED', {RUN_ID: runId, TASK: task, DURATION_MS: run.manifest.durationMillis, BUSINESS: run.manifest.business.status, CLEANUP: run.manifest.cleanup.status, EVIDENCE: path.relative(root, directory)});
};

const suiteLaneSockets = Object.freeze([1, 2, 3].map((lane) => `unix:///run/catering-v2s-testcontainers/daemon-${lane}/docker.sock`));
export const initialLaneQueues = (targets, laneCount = 3) => {
  if (!Array.isArray(targets) || !Number.isInteger(laneCount) || laneCount !== 3) throw new Error('TESTCONTAINERS_LANE_PARTITION_INVALID');
  const base = Math.floor(targets.length / laneCount); const remainder = targets.length % laneCount;
  let offset = 0;
  return Object.freeze(Array.from({length: laneCount}, (_, index) => {
    const size = base + (index >= laneCount - remainder ? 1 : 0);
    const queue = targets.slice(offset, offset + size); offset += size;
    return queue;
  }));
};
export const createDynamicLaneScheduler = (targets) => {
  const queues = initialLaneQueues(targets).map((queue) => [...queue]);
  return Object.freeze({
    next(laneIndex) {
      if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= queues.length) throw new Error('TESTCONTAINERS_LANE_INDEX_INVALID');
      if (queues[laneIndex].length) return {target: queues[laneIndex].shift(), originLane: laneIndex};
      const donors = queues.map((queue, index) => ({index, size: queue.length})).filter(({size}) => size > 0)
        .sort((left, right) => right.size - left.size || right.index - left.index);
      if (!donors.length) return null;
      const donor = donors[0];
      return {target: queues[donor.index].shift(), originLane: donor.index};
    },
    remaining() { return queues.reduce((sum, queue) => sum + queue.length, 0); },
  });
};
const resolveSuiteLanes = () => {
  const output = remote(script(
    'set -euo pipefail',
    ...suiteLaneSockets.map((socket, index) => `printf 'LANE_${index + 1}_ENGINE_ID=%s\\n' "$(docker --host ${quote(socket)} info --format '{{.ID}}')"`),
  ));
  const facts = Object.fromEntries(output.trim().split('\n').filter(Boolean).map((line) => line.split('=')));
  const lanes = suiteLaneSockets.map((dockerHost, index) => ({lane: index + 1, dockerHost, engineId: facts[`LANE_${index + 1}_ENGINE_ID`]}));
  if (lanes.some(({engineId}) => !/^[a-f0-9-]{36}$/i.test(engineId ?? '')) || new Set(lanes.map(({engineId}) => engineId)).size !== lanes.length) fail('TESTCONTAINERS_LANE_ENGINE_ID_NOT_DISTINCT', 'ENVIRONMENT_BOUNDARY');
  return lanes;
};
const newestTargetManifest = (target) => {
  if (!existsSync(evidence)) return null;
  const matches = readdirSync(evidence).flatMap((entry) => {
    try { const manifest = JSON.parse(readFileSync(path.join(evidence, entry, 'run-manifest.json'), 'utf8')); return manifest.suiteTarget && suiteTargetFields.every((field) => manifest.suiteTarget[field] === target[field]) ? [manifest] : []; }
    catch { return []; }
  }).sort((left, right) => String(right.completedAt ?? '').localeCompare(String(left.completedAt ?? '')));
  return matches[0] ?? null;
};
const suiteWorkspaceCleanup = (suiteRoot) => remote(script(
  'set -euo pipefail', `suite_root=${quote(suiteRoot)}`,
  'case "$suite_root" in /tmp/r5-tc-suite-[0-9]*-[0-9]*) ;; *) exit 64 ;; esac',
  'rm -rf "$suite_root"', 'test ! -e "$suite_root"',
));
const executeBackendAcceptanceSuiteCleanup = () => {
  const suiteRoot = process.env.V2S_BACKEND_ACCEPTANCE_SUITE_ROOT;
  if (!BACKEND_ACCEPTANCE_SUITE_ROOT_PATTERN.test(suiteRoot ?? '')) throw new Error('BACKEND_ACCEPTANCE_SUITE_ROOT_INVALID');
  const result = remoteResult(script(
    'set -euo pipefail',
    `suite_root=${quote(suiteRoot)}`,
    'case "$suite_root" in /tmp/r5-tc-suite-[0-9]*-[0-9]*) ;; *) exit 64 ;; esac',
    'rm -rf -- "$suite_root"',
    'test ! -e "$suite_root"',
    'printf "SUITE_WORKSPACE_CLEANUP=PASS\\n"',
  ));
  const status = result.status === 0 && result.stdout.includes('SUITE_WORKSPACE_CLEANUP=PASS') ? 'PASS' : 'FAIL';
  process.stdout.write(`R5_TESTCONTAINERS_BACKEND_ACCEPTANCE_SUITE_CLEANUP STATUS=${status} SUITE_ROOT=${suiteRoot}\n`);
  if (status !== 'PASS') {
    process.stderr.write(`R5_TESTCONTAINERS_BACKEND_ACCEPTANCE_SUITE_CLEANUP=FAIL REASON=${compact(result.stderr || result.stdout || 'UNKNOWN')}\n`);
    process.exitCode = 2;
  }
};
const executeAll = async () => {
  const targets = discoverTestcontainersTargets().map((target) => Object.freeze({...target, inputSha256: testcontainersTargetInputFingerprint(target)}));
  const imageWarmup = warmTestcontainersImages();
  const lanes = resolveSuiteLanes(); const scheduler = createDynamicLaneScheduler(targets); const started = Date.now();
  const suiteRunId = `r5-tc-suite-${Date.now()}-${process.pid}`; const suiteRoot = `/tmp/${suiteRunId}`;
  const suiteDirectory = path.join(evidence, suiteRunId); mkdirSync(suiteDirectory, {recursive: true});
  const manifest = {schemaVersion: 1, kind: 'r5-managed-testcontainers-suite', runId: suiteRunId, startedAt: now(), total: targets.length, execution: 'THREE_ISOLATED_DAEMONS_DYNAMIC_WORK_STEALING', imageWarmup, lanes: lanes.map((lane) => ({...lane, initialized: false, firstFailure: null, targets: []})), business: {status: 'NOT_RUN'}, cleanup: {status: 'NOT_RUN'}};
  const persistSuite = () => atomicWrite(path.join(suiteDirectory, 'run-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  persistSuite();
  runnerEvent('ALL_STARTED', {RUN_ID: suiteRunId, TOTAL: targets.length, LANES: lanes.length, STARTED_AT: now()});
  const completed = {value: 0};
  const runLane = async (lane) => {
    const laneRecord = manifest.lanes[lane.lane - 1];
    for (;;) {
      const assignment = scheduler.next(lane.lane - 1); if (!assignment) return;
      const target = assignment.target; const ordinal = completed.value + 1;
      laneRecord.initialized = true; laneRecord.targets.push({target, originLane: assignment.originLane + 1, status: 'RUNNING', startedAt: now()}); persistSuite();
      runnerEvent('ALL_CURRENT', {RUN_ID: suiteRunId, LANE: lane.lane, ORIGIN_LANE: assignment.originLane + 1, CURRENT: ordinal, TOTAL: targets.length, TASK: target.task, SELECTOR: target.selector});
      const child = spawn(process.execPath, [new URL(import.meta.url).pathname, target.task, '--tests', target.selector], {
        cwd: root,
        env: {...process.env, [suiteTargetBindingEnvironment]: JSON.stringify(target), V2S_TESTCONTAINERS_DOCKER_HOST: lane.dockerHost, V2S_TESTCONTAINERS_LANE_WORKSPACE: `${suiteRoot}/lane-${lane.lane}/workspace`},
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
      const exitCode = await waitForClose(child); completed.value += 1;
      const outcome = laneRecord.targets.at(-1); const childManifest = newestTargetManifest(target);
      outcome.completedAt = now(); outcome.status = exitCode === 0 ? 'PASS' : 'FAIL'; outcome.evidence = childManifest ? path.relative(root, path.join(evidence, childManifest.runId)) : null;
      outcome.business = childManifest?.business?.status ?? 'FAIL'; outcome.cleanup = childManifest?.cleanup?.status ?? 'FAIL'; outcome.firstFailure = childManifest?.firstFailure ?? (exitCode === 0 ? null : 'CHILD_RUNNER_FAILURE');
      if (exitCode !== 0) { laneRecord.firstFailure = {target, reason: outcome.firstFailure, evidence: outcome.evidence}; persistSuite(); runnerEvent('ALL_LANE_FIRST_FAILURE', {RUN_ID: suiteRunId, LANE: lane.lane, CURRENT: completed.value, TOTAL: targets.length, FIRST_FAILURE: `${target.task}:${target.selector}`}); return; }
      persistSuite(); runnerEvent('ALL_COMPLETED', {RUN_ID: suiteRunId, LANE: lane.lane, CURRENT: completed.value, TOTAL: targets.length, TASK: target.task, SELECTOR: target.selector});
    }
  };
  try {
    await Promise.all(lanes.map(runLane));
    const failed = manifest.lanes.filter((lane) => lane.firstFailure);
    const completedTargets = manifest.lanes.flatMap((lane) => lane.targets);
    manifest.business = {status: failed.length ? 'FAIL' : (completedTargets.length === targets.length ? 'PASS' : 'FAIL'), firstFailures: failed.map((lane) => lane.firstFailure)};
    if (completedTargets.length !== targets.length) manifest.business = {...manifest.business, reason: 'TESTCONTAINERS_SUITE_TARGETS_NOT_ALL_EXECUTED'};
  } finally {
    try { suiteWorkspaceCleanup(suiteRoot); manifest.cleanup = {status: 'PASS', workspace: 'PASS'}; }
    catch (error) { manifest.cleanup = {status: 'FAIL', workspace: 'FAIL', reason: error instanceof Error ? error.message : String(error)}; }
    manifest.completedAt = now(); manifest.durationMillis = Date.now() - started; persistSuite();
  }
  const status = manifest.business.status === 'PASS' && manifest.cleanup.status === 'PASS' ? 'PASS' : 'FAIL';
  runnerEvent('ALL_FINISHED', {RUN_ID: suiteRunId, CURRENT: completed.value, TOTAL: targets.length, DURATION_MS: manifest.durationMillis, STATUS: status, FAILED_LANES: manifest.lanes.filter((lane) => lane.firstFailure).length, EVIDENCE: path.relative(root, suiteDirectory)});
  if (status !== 'PASS') process.exitCode = 2;
};

const selfTest = async () => {
  const immediateExit = spawn(process.execPath, ['-e', 'process.exit(0)'], {stdio: 'ignore'});
  const immediateExitCode = await waitForClose(immediateExit);
  if (immediateExitCode !== 0) throw new Error('FAST_CHILD_CLOSE_OBSERVER_INVALID');
  if (workloadObservationKey({logBytes: 10, workloadSha256: 'worker-a', testResultBytes: 0}) !== workloadObservationKey({logBytes: 10, workloadSha256: 'worker-b', testResultBytes: 0})) throw new Error('PROCESS_MEMBERSHIP_TREATED_AS_PROGRESS');
  if (workloadObservationKey({logBytes: 10, workloadSha256: 'worker-a', testResultBytes: 0, runtimeEvidenceSha256: 'evidence-a', runtimeEvidenceBytes: 10}) === workloadObservationKey({logBytes: 10, workloadSha256: 'worker-a', testResultBytes: 0, runtimeEvidenceSha256: 'evidence-b', runtimeEvidenceBytes: 20})) throw new Error('RUNTIME_EVIDENCE_PROGRESS_TREATED_AS_STALL');
  if (workloadObservationKey({logBytes: 10, workloadSha256: 'worker-a', testResultBytes: 0, childHeartbeatSequence: 1}) !== workloadObservationKey({logBytes: 10, workloadSha256: 'worker-a', testResultBytes: 0, childHeartbeatSequence: 2})) throw new Error('CHILD_HEARTBEAT_TREATED_AS_PROGRESS');
  const expected = {runId: 'r5-tc-12345678-123', remoteRoot: '/tmp/r5-tc-12345678-123', commandSha256: 'a'.repeat(64), logPath: '/tmp/r5-tc-12345678-123/results/gradle.log', phasePath: '/tmp/r5-tc-12345678-123/results/phase.jsonl'};
  const value = {...expected, pid: 1, pgid: 1, bootId: 'boot', processStartTicks: 1, phase: 'PROCESS_STARTED'};
  const lifecycleEvents = [];
  let reconnectRecord;
  const harness = createLifecycleHarness({
    lifecycle: (event, outcome = 'PASS') => lifecycleEvents.push({event, outcome}),
    recordReconnect: (control, identityReadback) => { reconnectRecord = {control, identityReadback}; },
  }, {
    launch: () => ({acknowledged: true}),
    reconnect: () => ({control: value, identityReadback: {pid: 1, pgid: 1, bootId: 'boot', processStartTicks: 1, commandSha256: expected.commandSha256}}),
    collect: () => undefined,
  });
  harness.launch();
  harness.reconnect(expected);
  harness.collect();
  if (lifecycleEvents.map((event) => event.event).join(',') !== requiredLifecycleEvents.join(',') || reconnectRecord?.control !== value) throw new Error('LIFECYCLE_HARNESS_TRANSITION_INVALID');
  if (parseStallDiagnostics('TAIL_BEGIN\nprogress\nTAIL_END\nPROCESS_BEGIN\n1 1 S 00:01\nPROCESS_END\nCONTAINERS_BEGIN\nabc false\nCONTAINERS_END').tail !== 'progress') throw new Error('STALL_DIAGNOSTICS_PARSE_INVALID');
  const valid = {schemaVersion: 1, kind: 'r5-managed-testcontainers-run', runId: expected.runId, task: ':apps:test', startedAt: now(), remote: {}, sourceSha256: 'b'.repeat(64), sourceSync: {status: 'PASS', workspace: '/tmp/r5-tc-12345678-123/workspace', requiredPaths: []}, gradleDistribution: {sha256: 'c'.repeat(64), path: remoteGradleDistributionPath('c'.repeat(64)), status: 'REUSED'}, logPath: expected.logPath, phaseEvents: requiredPhases.map((phase, index) => ({sequence: index + 1, phase, outcome: 'PASS'})), lifecycleEvents, heartbeats: [{phase: 'RUNNING'}], logInspection: {readCount: 1, observedBytes: 1, lastReadAt: now(), status: 'READ'}, controlRecord: {expected, value, reconnect: {readAt: now(), identityReadback: reconnectRecord.identityReadback}, verified: true, reusedAfterReconnect: true}, firstFailure: null, lastKnownGood: 'CLEANUP', brokenBoundary: null, business: {status: 'PASS'}, cleanup: {status: 'PASS', reaped: true, process: 'PASS', scratch: 'PASS', containers: 'PASS', volumes: 'PASS'}};
  parseAndValidateRunManifest(valid);
  const red = (mutate, reason) => {
    const fixture = structuredClone(valid); mutate(fixture);
    try { parseAndValidateRunManifest(fixture); throw new Error(`SELF_TEST_RED_NOT_DETECTED:${reason}`); }
    catch (error) { if (error.message === `SELF_TEST_RED_NOT_DETECTED:${reason}` || error.message !== reason) throw error; }
  };
  red((fixture) => { fixture.heartbeats = []; }, 'MISSING_HEARTBEAT');
  red((fixture) => { fixture.controlRecord.value.bootId = 'reused'; }, 'CONTROL_RECORD_RECONNECT_IDENTITY_MISMATCH');
  red((fixture) => { fixture.lifecycleEvents = fixture.lifecycleEvents.filter((event) => event.event !== 'RECONNECTED_CONTROL'); }, 'MISSING_LIFECYCLE_EVENT:RECONNECTED_CONTROL');
  red((fixture) => { fixture.lifecycleEvents[0].outcome = 'FAIL'; }, 'LIFECYCLE_EVENT_NOT_PASS:LAUNCHED');
  red((fixture) => { fixture.controlRecord.reusedAfterReconnect = false; }, 'CONTROL_RECORD_NOT_VERIFIED');
  red((fixture) => { fixture.logInspection.status = 'LOG_NOT_AVAILABLE'; }, 'LOG_NOT_AVAILABLE');
  red((fixture) => { fixture.cleanup.status = 'FAIL'; }, 'CLEANUP_NOT_PASS');
  red((fixture) => { delete fixture.cleanup.process; }, 'CLEANUP_RECEIPT_MISSING_OR_NOT_PASS:process');
  red((fixture) => { fixture.cleanup.scratch = 'FAIL'; }, 'CLEANUP_RECEIPT_MISSING_OR_NOT_PASS:scratch');
  red((fixture) => { fixture.cleanup.containers = 'FAIL'; }, 'CLEANUP_RECEIPT_MISSING_OR_NOT_PASS:containers');
  red((fixture) => { fixture.cleanup.volumes = 'FAIL'; }, 'CLEANUP_RECEIPT_MISSING_OR_NOT_PASS:volumes');
  const collectionFailure = finalizeCleanupAfterCollection(valid.cleanup, true);
  if (collectionFailure.status !== 'PASS' || collectionFailure.collection?.status !== 'FAIL') throw new Error('ARTIFACT_COLLECTION_FAILURE_NOT_SEPARATED');
  try { parseStallDiagnostics('TAIL_BEGIN\nTAIL_END'); throw new Error('SELF_TEST_RED_NOT_DETECTED:STALL_DIAGNOSTICS_INVALID'); }
  catch (error) { if (error.message === 'SELF_TEST_RED_NOT_DETECTED:STALL_DIAGNOSTICS_INVALID' || error.message !== 'STALL_DIAGNOSTICS_INVALID') throw error; }
  const cacheOutcome = classifyGradleTestExecution('> Task :apps:test FROM-CACHE\nBUILD SUCCESSFUL', ':apps:test');
  if (cacheOutcome.status !== 'FAIL' || cacheOutcome.reason !== 'TESTCONTAINERS_TARGET_NOT_EXECUTED:FROM-CACHE') throw new Error('GRADLE_CACHE_EXECUTION_RED_NOT_DETECTED');
  const similarlyNamedTask = classifyGradleTestExecution('> Task :apps:testClasses UP-TO-DATE\nBUILD SUCCESSFUL', ':apps:test');
  if (similarlyNamedTask.status !== 'FAIL' || similarlyNamedTask.reason !== 'TESTCONTAINERS_TARGET_TASK_NOT_OBSERVED') throw new Error('GRADLE_TASK_NAME_BOUNDARY_RED_NOT_DETECTED');
  const missingOutcome = classifyGradleTestExecution('BUILD SUCCESSFUL', ':apps:test');
  if (missingOutcome.status !== 'FAIL' || missingOutcome.reason !== 'TESTCONTAINERS_TARGET_TASK_NOT_OBSERVED') throw new Error('GRADLE_TASK_EXECUTION_RED_NOT_DETECTED');
  process.stdout.write('R5_REMOTE_RUNNER_SELF_TEST=PASS\nRED_MISSING_HEARTBEAT=PASS\nRED_CONTROL_RECORD_RECONNECT_IDENTITY_MISMATCH=PASS\nRED_MISSING_RECONNECT_LIFECYCLE=PASS\nRED_LAUNCH_ACK_FAILURE=PASS\nRED_CONTROL_RECORD_RECONNECT_FLAG=PASS\nRED_LOG_NOT_AVAILABLE=PASS\nRED_CLEANUP_FAILURE=PASS\nRED_CLEANUP_RECEIPT_FIELDS=PASS\nRED_ARTIFACT_COLLECTION_SEPARATION=PASS\nRED_STALL_DIAGNOSTICS_INVALID=PASS\nRED_WORKLOAD_PROGRESS_NOT_TREATED_AS_STALL=PASS\nRED_HEARTBEAT_PROGRESS_NOT_TREATED_AS_STALL=PASS\nRED_GRADLE_CACHE_EXECUTION=PASS\nRED_GRADLE_TASK_NAME_BOUNDARY=PASS\nRED_GRADLE_TASK_EXECUTION_MISSING=PASS\nFAST_CHILD_CLOSE_OBSERVER=PASS\nLIFECYCLE_HARNESS_PRODUCTION_PATH=PASS\nCLEANUP=PASS\n');
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain && isBackendAcceptanceSuiteCleanup) {
  try { executeBackendAcceptanceSuiteCleanup(); }
  catch (error) { process.stderr.write(`R5_TESTCONTAINERS_BACKEND_ACCEPTANCE_SUITE_CLEANUP=FAIL REASON=${compact(error?.message)}\n`); process.exitCode = 2; }
} else if (isMain && process.argv[2] === '--self-test') {
  selfTest().catch((error) => { process.stderr.write(`R5_REMOTE_RUNNER_SELF_TEST=FAIL; REASON=${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
} else if (isMain && discoverTestcontainers) {
  try { process.stdout.write(`${JSON.stringify({kind: 'r5-testcontainers-discovery', targets: discoverTestcontainersTargets()}, null, 2)}\n`); }
  catch (error) { process.stderr.write(`R5_TESTCONTAINERS_DISCOVERY=FAIL; REASON=${compact(error?.message)}\n`); process.exitCode = 2; }
} else if (isMain && allTestcontainers) {
  executeAll().catch((error) => { process.stderr.write(`R5_TESTCONTAINERS_ALL=FAIL; REASON=${compact(error?.message)}\n`); process.exitCode = 2; });
} else if (isMain) execute().catch((error) => { process.stderr.write(`R5_REMOTE_TESTCONTAINERS=FAIL; REASON=${compact(error?.message)}; CLEANUP=NOT_ATTEMPTED\n`); process.exitCode = 2; });
