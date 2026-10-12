import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {
  appendFileSync,
  existsSync,
  closeSync,
  openSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  readdirSync,
  readFileSync,
  readSync,
  realpathSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createConnection} from 'node:net';
import {
  createManagedRun,
  persistManagedRun,
  type TerminalAutomationExecution,
  type TerminalAutomationManifest,
  type TerminalAutomationProcessIdentity,
  type TerminalAutomationRemoteTopology,
} from './managedRun.ts';
import {androidAutomationBuildIdentity} from './androidBuild.ts';
import {
  cleanupFailedAndroidRunReverses,
  cleanupFailedAndroidRunPackage,
  parseAndroidReverseList,
  resolveFailedAndroidRunCleanupTarget,
} from './androidCleanupRecovery.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const driverRoot = path.join(root, 'tools/terminal-automation');
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const androidDiagnosticLogTailBytes = 1_048_576;

export const readBoundedLogTail = (logPath: string, maximumBytes = androidDiagnosticLogTailBytes): string => {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1)
    throw new Error('TERMINAL_AUTOMATION_DIAGNOSTIC_LOG_LIMIT_INVALID');
  const descriptor = openSync(logPath, 'r');
  try {
    const fileSize = statSync(logPath).size;
    const byteLength = Math.min(fileSize, maximumBytes);
    const buffer = Buffer.allocUnsafe(byteLength);
    const bytesRead = readSync(descriptor, buffer, 0, byteLength, Math.max(0, fileSize - byteLength));
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    closeSync(descriptor);
  }
};
type AutomationPlatform = 'web' | 'android';
type AutomationPhase = 'feasibility' | 'capabilities' | 'journey' | 'skill' | 'f4' | 'update' | 'remote';
const remoteTopologies = new Set<TerminalAutomationRemoteTopology>([
  'mobile-single',
  'laptop-single',
  'laptop-dual',
  'laptop-paired',
]);
const updateCases = new Set([
  'update.artifacts',
  'update.baseline',
  'update.archive',
  'update.fixed',
  'update.full-hot',
  'update.compatibility',
  'update.install-result',
  'update.flush',
  'update.offline-assets',
  'update.interruption',
  'update.boot-guard',
  'update.rollback',
  'update.recent',
  'update.cleanup',
  // Stage C exposes only its two executable main journeys. More granular
  // acceptance rows live in the design matrix and are covered by the parent
  // journey or owner-focused tests; they are not CLI cases.
  'update.pair',
  'update.supply-chain',
]);
const updateCasesRequiringManagedDev = new Set([
  'update.supply-chain',
  'update.pair',
]);
const isSupportedSupplyChainRun = (execution: TerminalAutomationExecution): boolean =>
  execution.platform === 'android' &&
  ((execution.shape === 'dual' && (execution.sample === undefined || execution.sample === 'console')) ||
    (execution.shape === 'mobile' && execution.sample === 'wallpaper'));
const implementedUpdateCases: Readonly<Record<AutomationPlatform, ReadonlySet<string>>> = Object.freeze({
  web: new Set(['update.artifacts']),
  android: new Set(['update.supply-chain', 'update.pair']),
});
const phaseSuite: Readonly<Record<AutomationPlatform, Readonly<Partial<Record<AutomationPhase, string>>>>> =
  Object.freeze({
    web: Object.freeze({
      feasibility: 'journeys/geometry.test.ts',
      capabilities: 'journeys/agentCapabilities.test.ts',
      journey: 'journeys/sampleConsole.test.ts',
      skill: 'journeys/skill.test.ts',
      f4: 'journeys/f4Visual.test.ts',
      update: 'journeys/update.test.ts',
      remote: 'journeys/remote.web.test.ts',
    }),
    android: Object.freeze({
      feasibility: 'journeys/geometry.android.test.ts',
      capabilities: 'journeys/agentCapabilities.android.test.ts',
      journey: 'journeys/sampleConsole.android.test.ts',
      f4: 'journeys/f4Performance.android.test.ts',
      skill: 'journeys/skill.android.test.ts',
      update: 'journeys/update.android.test.ts',
      remote: 'journeys/remote.android.test.ts',
    }),
  });
const ageNames = new Set(['empty', '37']);
const ownProcessBudgetKiB = 2 * 1024 * 1024;
const updateArtifactApps = ['sample-terminal', 'sample-wallpaper-terminal'] as const;
const androidDeviceCleanupMarker = 'TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED';
const androidDeviceCleanupCompleteMarker = 'TERMINAL_AUTOMATION_DEVICE_CLEANUP_COMPLETE';
const require = createRequire(import.meta.url);
const managedProcessTree = require('../../../scripts/dev/managed-process-tree.mjs') as {
  readProcessTable: () => readonly {pid: number; ppid: number; pgid: number; startToken: string}[];
  snapshotProcessTree: (
    root: TerminalAutomationProcessIdentity,
    processTable?: readonly {pid: number; ppid: number; pgid: number; startToken: string}[],
  ) => readonly {
    pid: number;
    pgid: number;
    startToken: string;
    ownershipUnverified?: boolean;
  }[];
  terminateOwnedProcessTree: (
    root: TerminalAutomationProcessIdentity,
    options?: {waitMs?: number},
  ) => Promise<{
    status: 'PASS' | 'FAIL';
    treeReadback: readonly {pid: number; pgid: number; startToken: string; ownershipUnverified?: boolean}[];
  }>;
};
const readManagedDevDiagnosticEvents = async (input: Readonly<{manifestPath: string; runId: string}>) => {
  const {readManagedDevDiagnosticEvents: readEvents} = await import('../../../scripts/dev/r5-dev-runner.mjs');
  return readEvents(input);
};

export type TerminalAutomationRunOptions = TerminalAutomationExecution;

export const resolveAutomationSuite = (execution: TerminalAutomationRunOptions): string => {
  if (execution.phase === 'remote' && execution.case !== 'remote.main') {
    throw new Error('TERMINAL_AUTOMATION_REMOTE_CASE_INVALID');
  }
  if (execution.phase === 'update' && execution.case === 'update.pair') {
    return 'journeys/update.pair.android.test.ts';
  }
  const suite = phaseSuite[execution.platform as AutomationPlatform]?.[execution.phase as AutomationPhase];
  if (suite === undefined) throw new Error('TERMINAL_AUTOMATION_PHASE_PLATFORM_NOT_IMPLEMENTED');
  return suite;
};

export const assertManagedDevDiagnosticSourcesReadable = (
  sources: readonly Readonly<{readonly source: string; readonly status: string}>[],
): void => {
  const names = sources.map(source => source.source);
  if (
    sources.length < 2 ||
    new Set(names).size !== names.length ||
    !names.includes('cbs') ||
    !names.some(name => name.startsWith('tds-')) ||
    sources.some(source => source.status !== 'READ')
  ) {
    throw new Error('TERMINAL_AUTOMATION_MANAGED_DIAGNOSTICS_PREFLIGHT_INCOMPLETE');
  }
};

type ManagedDiagnosticEvent = Readonly<Record<string, string | number | boolean>>;
type ManagedDiagnosticSource = Readonly<{
  readonly source: string;
  readonly events?: readonly ManagedDiagnosticEvent[];
}>;

const remoteControlDiagnosticOperations = new Set([
  'startOperationsTerminalRemoteControl',
  'issueOperationsRemoteControlGrant',
  'endOperationsTerminalRemoteControl',
  'getOperationsTerminalRemoteControl',
  'registerTerminalRemoteControl',
  'reportTerminalRemoteControl',
]);

const remoteControlDiagnosticRequestEvents = new Set([
  'REQUEST_STARTED',
  'REQUEST_SUCCEEDED',
  'REQUEST_FAILED',
  'REQUEST_COMPLETED',
]);

export const evaluateManagedRemoteControlDiagnosticCoverage = (
  before: readonly ManagedDiagnosticSource[],
  after: readonly ManagedDiagnosticSource[],
  businessPassed: boolean,
): Readonly<{status: 'PASS' | 'FAIL'; code: string | null; missingOperations: readonly string[]}> => {
  const requests = (sources: readonly ManagedDiagnosticSource[]): readonly ManagedDiagnosticEvent[] =>
    sources.find(source => source.source === 'cbs')?.events?.filter(event =>
      typeof event.operationId === 'string' &&
      remoteControlDiagnosticOperations.has(event.operationId) &&
      typeof event.requestId === 'string' &&
      typeof event.event === 'string' &&
      remoteControlDiagnosticRequestEvents.has(event.event),
    ) ?? [];
  const identity = (event: ManagedDiagnosticEvent): string =>
    `${String(event.operationId)}:${String(event.requestId)}:${String(event.event)}`;
  const cbsEvents = (sources: readonly ManagedDiagnosticSource[]): readonly ManagedDiagnosticEvent[] =>
    sources.find(source => source.source === 'cbs')?.events ?? [];
  const ownerFailureIdentity = (event: ManagedDiagnosticEvent): string =>
    `${String(event.operationId)}:${String(event.requestId)}`;
  const priorOwnerFailures = new Set(cbsEvents(before)
    .filter(event => event.event === 'OWNER_RESULT_UNKNOWN')
    .map(ownerFailureIdentity));
  const currentOwnerFailures = cbsEvents(after).filter(event =>
    event.event === 'OWNER_RESULT_UNKNOWN' && !priorOwnerFailures.has(ownerFailureIdentity(event)),
  );
  const prior = new Set(requests(before).map(identity));
  const current = requests(after).filter(event => !prior.has(identity(event)));
  const completed = current.filter(event =>
    event.event === 'REQUEST_COMPLETED' || event.event === 'REQUEST_FAILED' || event.event === 'REQUEST_SUCCEEDED',
  );
  const failed = completed.find(event => {
    const status = typeof event.status === 'string' ? Number(event.status) : event.status;
    return event.event === 'REQUEST_FAILED' || event.outcome === 'FAILED' || (typeof status === 'number' && status >= 400);
  });
  if (failed !== undefined) {
    const failedStatus = typeof failed.status === 'string'
      ? Number(failed.status)
      : typeof failed.status === 'number'
        ? failed.status
        : undefined;
    if (typeof failedStatus === 'number' && Number.isFinite(failedStatus) && failedStatus >= 500 &&
        failed.errorCode === 'PLATFORM_COMMON_RESULT_UNKNOWN') {
      const cause = currentOwnerFailures.find(event =>
        event.event === 'OWNER_RESULT_UNKNOWN' &&
        event.operationId === failed.operationId &&
        event.requestId === failed.requestId &&
        typeof event.exceptionType === 'string' &&
        typeof event.rootCauseType === 'string' &&
        typeof event.exceptionOrigin === 'string',
      );
      if (cause === undefined) {
        return Object.freeze({
          status: 'FAIL',
          code: 'TERMINAL_AUTOMATION_REMOTE_FAILURE_CAUSE_DIAGNOSTICS_INCOMPLETE',
          missingOperations: Object.freeze([]),
        });
      }
    }
    // CBS owner diagnostics persist a terminal request event (operationId + requestId + status).
    // They do not emit REQUEST_STARTED for every ordinary owner route, so requiring a second
    // event would reject a complete failure record and hide the first broken HTTP boundary.
    return Object.freeze({status: 'PASS', code: null, missingOperations: Object.freeze([])});
  }

  const successfulOperations = new Set(completed.map(event => String(event.operationId)));
  const requiredOperations = businessPassed
    ? ['startOperationsTerminalRemoteControl', 'registerTerminalRemoteControl',
        'issueOperationsRemoteControlGrant', 'reportTerminalRemoteControl', 'endOperationsTerminalRemoteControl']
    : ['startOperationsTerminalRemoteControl', 'registerTerminalRemoteControl'];
  const missingOperations = requiredOperations.filter(operation => !successfulOperations.has(operation));
  return Object.freeze({
    status: missingOperations.length === 0 ? 'PASS' : 'FAIL',
    code: missingOperations.length === 0 ? null : 'TERMINAL_AUTOMATION_REMOTE_REQUEST_DIAGNOSTICS_INCOMPLETE',
    missingOperations: Object.freeze(missingOperations),
  });
};

export const evaluateAndroidDiagnostics = (
  execution: TerminalAutomationRunOptions,
  runId: string,
  output: string,
): Readonly<{
  status: 'PASS' | 'FAIL' | 'N/A';
  missing: readonly string[];
  unavailable: readonly string[];
  empty: readonly string[];
  duplicates: readonly string[];
}> => {
  if ((execution.phase !== 'update' && execution.phase !== 'remote') || execution.platform !== 'android') {
    return Object.freeze({
      status: 'N/A',
      missing: Object.freeze([]),
      unavailable: Object.freeze([]),
      empty: Object.freeze([]),
      duplicates: Object.freeze([]),
    });
  }
  const nativeSource = execution.phase === 'update' ? 'android-native-update' : 'android-native-remote';
  const expected = ['MASTER:android-runtime', `MASTER:${nativeSource}`];
  if (execution.phase === 'update' && execution.case === 'update.pair' ||
      execution.phase === 'remote' && execution.remoteTopology === 'laptop-paired')
    expected.push('PAIR_SLAVE:android-runtime', `PAIR_SLAVE:${nativeSource}`);
  const observed = new Map<string, Readonly<{status: 'READ' | 'LOG_NOT_AVAILABLE'; lines?: number}>>();
  const duplicates: string[] = [];
  for (const line of output.split(/\r?\n/u)) {
    const marker = `TERMINAL_AUTOMATION_DIAGNOSTICS run=${runId} `;
    const markerOffset = line.indexOf(marker);
    if (markerOffset < 0) continue;
    const match = /^(?:(role=PAIR_SLAVE) )?source=(android-runtime|android-native-update|android-native-remote) status=(READ|LOG_NOT_AVAILABLE)(?: lines=(\d+))?\b/u.exec(
      line.slice(markerOffset + marker.length),
    );
    if (!match) continue;
    const key = `${match[1] === undefined ? 'MASTER' : 'PAIR_SLAVE'}:${match[2]}`;
    if (observed.has(key)) duplicates.push(key);
    else observed.set(key, Object.freeze({
      status: match[3] as 'READ' | 'LOG_NOT_AVAILABLE',
      ...(match[4] === undefined ? {} : {lines: Number(match[4])}),
    }));
  }
  const missing = expected.filter(key => !observed.has(key));
  const unavailable = expected.filter(key => observed.get(key)?.status === 'LOG_NOT_AVAILABLE');
  const empty = execution.phase === 'remote'
    ? expected.filter(key => {
        if (!key.endsWith(':android-native-remote')) return false;
        const marker = observed.get(key);
        const lines = marker?.lines;
        return marker?.status === 'READ' && (lines === undefined || !Number.isSafeInteger(lines) || lines < 1);
      })
    : [];
  return Object.freeze({
    status: missing.length === 0 && unavailable.length === 0 && empty.length === 0 && duplicates.length === 0 ? 'PASS' : 'FAIL',
    missing: Object.freeze(missing),
    unavailable: Object.freeze(unavailable),
    empty: Object.freeze(empty),
    duplicates: Object.freeze(duplicates),
  });
};

export const terminalAutomationExitCode = (input: Readonly<{
  business: 'PASS' | 'FAIL';
  cleanup: 'PASS' | 'FAIL';
  diagnostics: 'PASS' | 'FAIL' | 'N/A';
  managedDevDiagnostics: 'PASS' | 'FAIL' | 'N/A';
}>): 0 | 1 =>
  input.business === 'PASS' &&
  input.cleanup === 'PASS' &&
  input.diagnostics !== 'FAIL' &&
  input.managedDevDiagnostics !== 'FAIL'
    ? 0
    : 1;

export const updateRequiresManagedDev = (execution: TerminalAutomationRunOptions): boolean =>
  execution.phase === 'update' &&
  execution.case !== undefined &&
  updateCasesRequiringManagedDev.has(execution.case);

export const remoteRequiresManagedDev = (execution: TerminalAutomationRunOptions): boolean =>
  execution.phase === 'remote';

export const requiresFixtureIntentForSuccessfulRun = (
  execution: TerminalAutomationRunOptions,
  exitCode: number,
): boolean =>
  exitCode === 0 &&
  (execution.phase === 'journey' || execution.phase === 'skill' || execution.phase === 'remote');

export const updateCaseImplemented = (execution: TerminalAutomationRunOptions): boolean =>
  execution.phase !== 'update' ||
  (execution.case !== undefined &&
    implementedUpdateCases[execution.platform as AutomationPlatform]?.has(execution.case) === true &&
    (execution.case !== 'update.supply-chain' || isSupportedSupplyChainRun(execution)));

export const updateScenarioAssertionsObserved = (
  execution: TerminalAutomationRunOptions,
  runId: string,
  output: string,
): boolean => {
  if (execution.phase !== 'update' || execution.case === undefined) return true;
  const requiresMarker = execution.platform === 'android' || execution.case === 'update.compatibility';
  return (
    !requiresMarker ||
    output.includes(`TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS case=${execution.case} run=${runId}`)
  );
};

export const createAndroidDeviceCleanupTracker = () => {
  const tails = new Map<'stdout' | 'stderr', string>([
    ['stdout', ''],
    ['stderr', ''],
  ]);
  let failed = false;
  let completed = false;
  return Object.freeze({
    accept: (stream: 'stdout' | 'stderr', chunk: string): void => {
      const combined = `${tails.get(stream) ?? ''}${chunk}`;
      failed ||= combined.includes(androidDeviceCleanupMarker);
      completed ||= combined.includes(androidDeviceCleanupCompleteMarker);
      const markerLength = Math.max(androidDeviceCleanupMarker.length, androidDeviceCleanupCompleteMarker.length);
      tails.set(stream, combined.slice(-(markerLength - 1)));
    },
    finish: (): 'PASS' | 'FAIL' | 'UNKNOWN' => (failed ? 'FAIL' : completed ? 'PASS' : 'UNKNOWN'),
  });
};

const managedArtifactBytes = (target: string): number => {
  const stat = lstatSync(target);
  if (stat.isSymbolicLink()) throw new Error('TERMINAL_AUTOMATION_ARTIFACT_CLEANUP_SYMLINK_FORBIDDEN');
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) throw new Error('TERMINAL_AUTOMATION_ARTIFACT_CLEANUP_ENTRY_INVALID');
  return readdirSync(target).reduce((bytes, entry) => bytes + managedArtifactBytes(path.join(target, entry)), 0);
};

export const cleanupManagedRunArtifacts = (
  runDirectory: string,
  cleanUpdateArtifacts: boolean,
  terminalRoot = path.join(root, 'apps/terminal'),
) => {
  const runRoot = realpathSync(runDirectory);
  const relativeTargets = ['android-build'];
  const removed: string[] = [];
  if (cleanUpdateArtifacts) {
    for (const app of updateArtifactApps) {
      const linkPath = path.join(terminalRoot, `application/android/${app}/android/build`);
      const expectedTarget = path.join(runRoot, 'android-build', app, 'root');
      if (cleanupRunOwnedDirectoryLink(linkPath, expectedTarget)) {
        removed.push(path.relative(root, linkPath));
      }
    }
    let nodeModulesRoot: string | undefined;
    for (const app of updateArtifactApps) {
      const registryPath = path.join(runRoot, 'android-build', app, 'temporary-source-build-links.json');
      if (!existsSync(registryPath)) continue;
      nodeModulesRoot ??= realpathSync(path.join(terminalRoot, 'node_modules'));
      const registryStat = lstatSync(registryPath);
      if (!registryStat.isFile() || registryStat.isSymbolicLink()) {
        throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_LINK_REGISTRY_INVALID');
      }
      const registry: unknown = JSON.parse(readFileSync(registryPath, 'utf8'));
      if (!Array.isArray(registry)) throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_LINK_REGISTRY_INVALID');
      const seen = new Set<string>();
      for (const entry of registry) {
        if (
          typeof entry !== 'object' ||
          entry === null ||
          !('path' in entry) ||
          typeof entry.path !== 'string' ||
          !('target' in entry) ||
          typeof entry.target !== 'string' ||
          seen.has(entry.path)
        ) {
          throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_LINK_REGISTRY_INVALID');
        }
        seen.add(entry.path);
        const linkPath = path.resolve(entry.path);
        const targetPath = path.resolve(entry.target);
        const linkParent = realpathSync(path.dirname(linkPath));
        const linkParentRelative = path.relative(nodeModulesRoot, linkParent);
        const targetRelative = path.relative(path.join(runRoot, 'android-build', app), targetPath);
        if (
          path.basename(linkPath) !== 'build' ||
          path.basename(linkParent) !== 'android' ||
          !linkParentRelative ||
          linkParentRelative === '..' ||
          linkParentRelative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(linkParentRelative) ||
          !targetRelative.startsWith(`projects${path.sep}`) ||
          targetRelative === '..' ||
          targetRelative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(targetRelative)
        ) {
          throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_LINK_REGISTRY_ENTRY_INVALID');
        }
        if (cleanupRunOwnedDirectoryLink(linkPath, targetPath)) removed.push(path.relative(root, linkPath));
      }
    }
  }
  if (cleanUpdateArtifacts) {
    for (const app of updateArtifactApps) {
      relativeTargets.push(
        `update/${app}/publication`,
        `update/${app}/embedded-metadata`,
        `update/${app}/full-staging`,
        `update/${app}/hot-staging`,
        `update/${app}/${app}.apk`,
        `update/${app}/${app}-full.zip`,
        `update/${app}/${app}-hot.zip`,
        `update/${app}/${app}-compat-full.zip`,
        `update/${app}/${app}-compat-external-full.zip`,
        `update/${app}/full-package.json`,
        `update/${app}/compatibility-full-package.json`,
        `update/${app}/compatibility-external-full-package.json`,
        `update/${app}/${app}-compat-hot-five.zip`,
        `update/${app}/${app}-compat-hot-six.zip`,
        `update/${app}/gradle-build`,
      );
    }
  }
  let removedBytes = 0;
  for (const relative of relativeTargets) {
    const segments = relative.split('/');
    let cursor = runRoot;
    let targetExists = true;
    for (const segment of segments) {
      cursor = path.join(cursor, segment);
      try {
        const stat = lstatSync(cursor);
        if (stat.isSymbolicLink()) throw new Error('TERMINAL_AUTOMATION_ARTIFACT_CLEANUP_SYMLINK_FORBIDDEN');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          targetExists = false;
          break;
        }
        throw error;
      }
    }
    if (!targetExists) continue;
    const target = path.join(runRoot, relative);
    removedBytes += managedArtifactBytes(target);
    rmSync(target, {recursive: true, force: false});
    if (existsSync(target)) throw new Error('TERMINAL_AUTOMATION_ARTIFACT_CLEANUP_READBACK_FAILED');
    removed.push(relative);
  }
  if (cleanUpdateArtifacts) assertNoAndroidIntermediateOutputs(terminalRoot);
  return {removedBytes, removed};
};

export const assertNoAndroidIntermediateOutputs = (terminalRoot: string): void => {
  const found: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, {withFileTypes: true})) {
      const absolute = path.join(directory, entry.name);
      const parentName = path.basename(directory);
      const androidPath = path.relative(terminalRoot, absolute).split(path.sep).includes('android');
      if (entry.isSymbolicLink()) {
        if (
          (androidPath &&
            (entry.name === '.cxx' || (entry.name === 'build' && ['android', 'app'].includes(parentName)))) ||
          entry.name === 'android'
        ) {
          found.push(path.relative(root, absolute));
        }
        continue;
      }
      if (!entry.isDirectory() || entry.name === '.gradle' || entry.name === '.git') continue;
      if (
        androidPath &&
        (entry.name === '.cxx' || (entry.name === 'build' && ['android', 'app'].includes(parentName)))
      ) {
        found.push(path.relative(root, absolute));
        continue;
      }
      visit(absolute);
    }
  };
  visit(terminalRoot);
  if (found.length > 0) {
    throw new Error(`TERMINAL_AUTOMATION_ANDROID_INTERMEDIATE_OUTSIDE_RUN:${found.sort().join(',')}`);
  }
};

export const cleanupRunOwnedDirectoryLink = (linkPath: string, expectedTarget: string): boolean => {
  let link;
  try {
    link = lstatSync(linkPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
  if (!link.isSymbolicLink()) throw new Error('TERMINAL_AUTOMATION_ARTIFACT_CLEANUP_PATH_NOT_OWNED_LINK');
  const actualTarget = path.resolve(path.dirname(linkPath), readlinkSync(linkPath));
  if (actualTarget !== path.resolve(expectedTarget)) {
    throw new Error('TERMINAL_AUTOMATION_ARTIFACT_CLEANUP_LINK_TARGET_MISMATCH');
  }
  unlinkSync(linkPath);
  try {
    lstatSync(linkPath);
    throw new Error('TERMINAL_AUTOMATION_ARTIFACT_CLEANUP_LINK_READBACK_FAILED');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return true;
};

const fail = (code: string): never => {
  throw new Error(code);
};

export const readFixtureIntent = (
  runDirectory: string,
  expectedManagedDevRunId?: string,
): NonNullable<TerminalAutomationManifest['fixture']> => {
  const runRoot = realpathSync(runDirectory);
  const intentPath = path.join(runRoot, 'fixture-intent.json');
  const stat = lstatSync(intentPath);
  if (!stat.isFile() || stat.isSymbolicLink() || path.dirname(realpathSync(intentPath)) !== runRoot) {
    throw new Error('TERMINAL_AUTOMATION_FIXTURE_INTENT_INVALID');
  }
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(intentPath, 'utf8'));
  } catch {
    throw new Error('TERMINAL_AUTOMATION_FIXTURE_INTENT_INVALID');
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !('managedDevRunId' in value) ||
    typeof value.managedDevRunId !== 'string' ||
    !('seedKey' in value) ||
    (value.seedKey !== 'term-front' && value.seedKey !== 'term-handheld') ||
    !('terminalRef' in value) ||
    typeof value.terminalRef !== 'string' ||
    !/^[A-Fa-f0-9-]{16,64}$/u.test(value.terminalRef) ||
    !('storeRef' in value) ||
    typeof value.storeRef !== 'string' ||
    !/^[A-Fa-f0-9-]{16,64}$/u.test(value.storeRef) ||
    !('deviceId' in value) ||
    typeof value.deviceId !== 'string' ||
    !/^[A-Za-z0-9:._-]{1,128}$/u.test(value.deviceId) ||
    ('bindingGeneration' in value &&
      (!Number.isSafeInteger(value.bindingGeneration) || Number(value.bindingGeneration) < 1))
  ) {
    throw new Error('TERMINAL_AUTOMATION_FIXTURE_INTENT_INVALID');
  }
  if (expectedManagedDevRunId !== undefined && value.managedDevRunId !== expectedManagedDevRunId) {
    throw new Error('TERMINAL_AUTOMATION_FIXTURE_MANAGED_DEV_RUN_MISMATCH');
  }
  return Object.freeze({
    managedDevRunId: value.managedDevRunId,
    seedKey: value.seedKey,
    terminalRef: value.terminalRef,
    storeRef: value.storeRef,
    deviceId: value.deviceId,
    activationIntent: true,
    ...('bindingGeneration' in value ? {bindingGeneration: Number(value.bindingGeneration)} : {}),
  });
};

export const parseAutomationRunArguments = (argv: readonly string[]): TerminalAutomationRunOptions => {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === undefined || !key.startsWith('--') || values.has(key)) fail('TERMINAL_AUTOMATION_ARGUMENT_INVALID');
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) fail('TERMINAL_AUTOMATION_ARGUMENT_VALUE_REQUIRED');
    values.set(key, value);
    index += 1;
  }

  const allowed = new Set([
    '--phase',
    '--platform',
    '--shape',
    '--case',
    '--age',
    '--sample',
    '--device-serial',
    '--peer-device-serial',
    '--remote-topology',
  ]);
  if ([...values.keys()].some(key => !allowed.has(key))) fail('TERMINAL_AUTOMATION_ARGUMENT_UNKNOWN');
  const phaseValue = values.get('--phase');
  const platform = values.get('--platform');
  const shape = values.get('--shape');
  const remoteTopologyValue = values.get('--remote-topology');
  if (phaseValue === undefined) fail('TERMINAL_AUTOMATION_PHASE_INVALID');
  if (
    phaseValue !== 'feasibility' &&
    phaseValue !== 'capabilities' &&
    phaseValue !== 'journey' &&
    phaseValue !== 'skill' &&
    phaseValue !== 'f4' &&
    phaseValue !== 'update' &&
    phaseValue !== 'remote'
  )
    fail('TERMINAL_AUTOMATION_PHASE_INVALID');
  const phase = phaseValue as AutomationPhase;
  if (platform !== 'web' && platform !== 'android') fail('TERMINAL_AUTOMATION_PLATFORM_INVALID');
  if (phase === 'remote') {
    if (shape !== undefined) fail('TERMINAL_AUTOMATION_REMOTE_SHAPE_NOT_APPLICABLE');
    if (!remoteTopologies.has(remoteTopologyValue as TerminalAutomationRemoteTopology)) {
      fail('TERMINAL_AUTOMATION_REMOTE_TOPOLOGY_INVALID');
    }
    if (platform === 'web' && remoteTopologyValue !== 'mobile-single') {
      fail('TERMINAL_AUTOMATION_REMOTE_WEB_TOPOLOGY_INVALID');
    }
  } else {
    if (remoteTopologyValue !== undefined) fail('TERMINAL_AUTOMATION_REMOTE_TOPOLOGY_NOT_APPLICABLE');
    if (shape !== 'mobile' && shape !== 'dual') fail('TERMINAL_AUTOMATION_SHAPE_INVALID');
  }
  const checkedPlatform = platform as 'web' | 'android';
  const remoteTopology = phase === 'remote' ? remoteTopologyValue as TerminalAutomationRemoteTopology : undefined;
  const checkedShape: 'mobile' | 'dual' =
    phase === 'remote'
      ? remoteTopology === 'laptop-dual'
        ? 'dual'
        : 'mobile'
      : (shape as 'mobile' | 'dual');
  if (phase === 'skill' && checkedShape !== 'mobile') fail('TERMINAL_AUTOMATION_SKILL_SHAPE_INVALID');

  const caseName = values.get('--case');
  const age = values.get('--age');
  const sample = values.get('--sample');
  if (phase === 'remote') {
    if (caseName !== 'remote.main' || (sample !== 'console' && sample !== 'wallpaper')) {
      fail('TERMINAL_AUTOMATION_REMOTE_CASE_INVALID');
    }
    if (age !== undefined) fail('TERMINAL_AUTOMATION_REMOTE_AGE_NOT_APPLICABLE');
  } else if (phase === 'journey' || phase === 'skill') {
    if (sample !== 'console' && sample !== 'wallpaper') fail('TERMINAL_AUTOMATION_SAMPLE_INVALID');
    if (phase === 'skill' && sample !== 'console') fail('TERMINAL_AUTOMATION_SKILL_SAMPLE_NOT_CONSOLE');
    if (sample === 'console') {
      if (!caseName) fail('TERMINAL_AUTOMATION_CASE_INVALID');
      if (caseName !== 'normal') fail('TERMINAL_AUTOMATION_CASE_OUTSIDE_MAIN_JOURNEY');
      if (!age || !ageNames.has(age)) fail('TERMINAL_AUTOMATION_AGE_INVALID');
      if (phase === 'skill' && age !== 'empty') fail('TERMINAL_AUTOMATION_SKILL_AGE_MUST_BE_EMPTY');
    } else if (caseName !== undefined || age !== undefined) {
      fail('TERMINAL_AUTOMATION_CASE_NOT_APPLICABLE');
    }
  } else if (phase === 'update') {
    if (!caseName || !updateCases.has(caseName)) fail('TERMINAL_AUTOMATION_UPDATE_CASE_INVALID');
    if (age !== undefined) fail('TERMINAL_AUTOMATION_UPDATE_AGE_NOT_APPLICABLE');
    if (sample !== undefined && sample !== 'console' && sample !== 'wallpaper') {
      fail('TERMINAL_AUTOMATION_UPDATE_SAMPLE_INVALID');
    }
  } else if (caseName !== undefined || age !== undefined || sample !== undefined) {
    fail('TERMINAL_AUTOMATION_CASE_NOT_APPLICABLE');
  }
  if (
    phase === 'update' &&
    caseName === 'update.supply-chain' &&
    !isSupportedSupplyChainRun({
      phase,
      platform: checkedPlatform,
      shape: checkedShape,
      case: caseName,
      ...(sample === undefined ? {} : {sample: sample as 'console' | 'wallpaper'}),
    })
  ) {
    fail('TERMINAL_AUTOMATION_UPDATE_SUPPLY_CHAIN_SAMPLE_SHAPE_INVALID');
  }
  if (
    phase === 'update' &&
    caseName === 'update.pair' &&
    (checkedPlatform !== 'android' || checkedShape !== 'mobile' || (sample !== 'console' && sample !== 'wallpaper'))
  ) {
    fail('TERMINAL_AUTOMATION_UPDATE_PAIR_REQUIRES_ANDROID_MOBILE_SAMPLE');
  }
  const deviceSerial = values.get('--device-serial');
  const peerDeviceSerial = values.get('--peer-device-serial');
  if (checkedPlatform === 'android') {
    if (!deviceSerial || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(deviceSerial)) {
      fail('TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIAL_REQUIRED');
    }
    if (peerDeviceSerial !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(peerDeviceSerial)) {
      fail('TERMINAL_AUTOMATION_ANDROID_PEER_DEVICE_SERIAL_INVALID');
    }
    if (peerDeviceSerial === deviceSerial) fail('TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIALS_MUST_DIFFER');
    if (
      ((phase === 'capabilities' && checkedShape === 'dual') ||
        (phase === 'update' && caseName === 'update.pair') ||
        (phase === 'remote' && remoteTopology === 'laptop-paired')) &&
      peerDeviceSerial === undefined
    ) {
      fail('TERMINAL_AUTOMATION_ANDROID_PEER_DEVICE_SERIAL_REQUIRED');
    }
    if (
      peerDeviceSerial !== undefined &&
      !((phase === 'capabilities' && checkedShape === 'dual') ||
        (phase === 'update' && caseName === 'update.pair') ||
        (phase === 'remote' && remoteTopology === 'laptop-paired'))
    ) {
      fail('TERMINAL_AUTOMATION_ANDROID_PEER_DEVICE_SERIAL_NOT_APPLICABLE');
    }
  } else if (deviceSerial !== undefined) {
    fail('TERMINAL_AUTOMATION_DEVICE_SERIAL_NOT_APPLICABLE');
  } else if (peerDeviceSerial !== undefined) {
    fail('TERMINAL_AUTOMATION_DEVICE_SERIAL_NOT_APPLICABLE');
  }

  const execution = Object.freeze({
    phase,
    platform: checkedPlatform,
    shape: checkedShape,
    ...(remoteTopology === undefined ? {} : {remoteTopology}),
    ...(caseName === undefined ? {} : {case: caseName}),
    ...(age === undefined ? {} : {age}),
    ...(sample === undefined ? {} : {sample: sample as 'console' | 'wallpaper'}),
    ...(deviceSerial === undefined ? {} : {deviceSerial}),
    ...(peerDeviceSerial === undefined ? {} : {peerDeviceSerial}),
  });
  resolveAutomationSuite(execution);
  return execution;
};

type ManagedDevContext = Readonly<{
  readonly runId: string;
  readonly manifestPath: string;
  readonly manifestSha256: string;
  readonly httpBaseUrl: string;
  readonly tdsEntryOneUrl: string;
  readonly tdsEntryTwoUrl: string;
  readonly webOrigin: string;
  readonly platformAdminOrigin: string;
  readonly operationsAdminOrigin: string;
  readonly operationsPassword: string;
  readonly platformRootPassword: string;
  readonly livekitResident: Readonly<{
    readonly state: 'RUNNING';
    readonly bootId: string;
    readonly containerId: string;
    readonly imageId: string;
    readonly endpointRef: 'LIVEKIT_RESIDENT_ENDPOINT';
    readonly signalTransport: 'WS';
  }>;
}>;

const readManagedDevContext = async (): Promise<ManagedDevContext> => {
  const expectedDirectory = path.join(root, '.runtime/r5');
  const manifestPath = path.join(expectedDirectory, 'run-manifest.json');
  const manifestStat = lstatSync(manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink())
    throw new Error('TERMINAL_AUTOMATION_DEV_MANIFEST_INVALID');
  const resolvedManifest = realpathSync(manifestPath);
  const resolvedDirectory = realpathSync(expectedDirectory);
  if (path.dirname(resolvedManifest) !== resolvedDirectory)
    throw new Error('TERMINAL_AUTOMATION_DEV_MANIFEST_PATH_INVALID');
  const manifestBytes = readFileSync(resolvedManifest);
  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestBytes.toString('utf8'));
  } catch {
    throw new Error('TERMINAL_AUTOMATION_DEV_MANIFEST_INVALID');
  }
  const {validateManagedDevManifest, readOperationsPassword, readPlatformRootPassword} =
    await import('../../../scripts/test/terminal-client-dev-acceptance.mjs');
  const validated = validateManagedDevManifest(parsed, {manifestPath: resolvedManifest}).manifest as Record<
    string,
    unknown
  >;
  const localHttpBaseUrl = validated.localHttpBaseUrl;
  const tdsEntryOneUrl = validated.localTdsWebSocketBaseUrl;
  const tdsEntryTwoUrl = validated.localTdsEntryTwoWebSocketBaseUrl;
  const webOrigin = selectManagedTerminalBrowserOrigin(validated.terminalBrowserAllowedOrigins);
  const adminOrigins = selectManagedDevAdminOrigins(validated);
  const safeWebSocketUrl = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    const url = new URL(value);
    return (
      url.protocol === 'ws:' &&
      url.hostname === '127.0.0.1' &&
      /^[0-9]{4,5}$/u.test(url.port) &&
      (url.pathname === '' || url.pathname === '/') &&
      url.username === '' &&
      url.password === '' &&
      url.search === '' &&
      url.hash === ''
    );
  };
  if (
    typeof validated.runId !== 'string' ||
    webOrigin === undefined ||
    adminOrigins === undefined ||
    !isManagedDevHttpBaseUrl(localHttpBaseUrl) ||
    !safeWebSocketUrl(tdsEntryOneUrl) ||
    !safeWebSocketUrl(tdsEntryTwoUrl) ||
    new URL(tdsEntryOneUrl).port === new URL(tdsEntryTwoUrl).port
  ) {
    throw new Error('TERMINAL_AUTOMATION_DEV_ENDPOINTS_INVALID');
  }
  const {checkLivekitResidentForManagedDev} = await import('../../../scripts/dev/r5-livekit-resident.mjs');
  const livekitResident = await checkLivekitResidentForManagedDev({
    host: (validated.remoteHostTrust as Record<string, unknown> | undefined)?.host,
    fingerprint: (validated.remoteHostTrust as Record<string, unknown> | undefined)?.fingerprint,
    expectedBootId: (validated.remoteResources as Record<string, unknown> | undefined)?.bootId,
    developmentResident: validated.livekitResident,
  });
  const operationsPassword = readOperationsPassword();
  if (!operationsPassword) throw new Error('TERMINAL_AUTOMATION_OPERATIONS_CREDENTIAL_MISSING');
  const platformRootPassword = readPlatformRootPassword();
  if (!platformRootPassword) throw new Error('TERMINAL_AUTOMATION_PLATFORM_ROOT_CREDENTIAL_MISSING');
  return Object.freeze({
    runId: validated.runId,
    manifestPath: resolvedManifest,
    manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
    httpBaseUrl: localHttpBaseUrl,
    tdsEntryOneUrl,
    tdsEntryTwoUrl,
    webOrigin,
    platformAdminOrigin: adminOrigins.platformAdmin,
    operationsAdminOrigin: adminOrigins.operationsAdmin,
    operationsPassword,
    platformRootPassword,
    livekitResident,
  });
};

export const selectManagedDevAdminOrigins = (
  value: unknown,
): Readonly<{readonly platformAdmin: string; readonly operationsAdmin: string}> | undefined => {
  if (!isRecord(value)) return undefined;
  const processes = value.processes;
  const readiness = value.readiness;
  if (!Array.isArray(processes) || !isRecord(readiness) || !isRecord(readiness.vite)) return undefined;
  const resolve = (name: 'platform-admin' | 'operations-admin'): string | undefined => {
    const entries = processes.filter(
      (entry): entry is Record<string, unknown> => isRecord(entry) && entry.name === name,
    );
    if (entries.length !== 1) return undefined;
    const processEntry = entries[0];
    const runtimeIdentity = processEntry.runtimeIdentity;
    const viteReadiness = readiness.vite;
    if (!isRecord(viteReadiness)) return undefined;
    const readinessIdentity = viteReadiness[name];
    if (
      !Number.isInteger(processEntry.port) ||
      (processEntry.port as number) < 1024 ||
      (processEntry.port as number) > 65535 ||
      !isRecord(runtimeIdentity) ||
      !isRecord(readinessIdentity) ||
      runtimeIdentity.pid !== readinessIdentity.pid ||
      runtimeIdentity.startToken !== readinessIdentity.startToken ||
      typeof runtimeIdentity.pid !== 'number' ||
      typeof runtimeIdentity.startToken !== 'string' ||
      runtimeIdentity.startToken.length === 0
    )
      return undefined;
    return `http://127.0.0.1:${processEntry.port}`;
  };
  const platformAdmin = resolve('platform-admin');
  const operationsAdmin = resolve('operations-admin');
  if (!platformAdmin || !operationsAdmin || platformAdmin === operationsAdmin) return undefined;
  return Object.freeze({platformAdmin, operationsAdmin});
};

export const selectManagedTerminalBrowserOrigin = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return undefined;
  const origins = value.filter((item): item is string => typeof item === 'string');
  for (const origin of origins) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      continue;
    }
    if (
      url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
      /^[0-9]{4,5}$/u.test(url.port) &&
      url.username === '' &&
      url.password === '' &&
      (url.pathname === '' || url.pathname === '/') &&
      url.search === '' &&
      url.hash === ''
    ) {
      return url.origin;
    }
  }
  return undefined;
};

export const isManagedDevHttpBaseUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === 'http:' &&
    url.hostname === '127.0.0.1' &&
    /^[0-9]{4,5}$/u.test(url.port) &&
    url.username === '' &&
    url.password === '' &&
    (url.pathname === '' || url.pathname === '/') &&
    url.search === '' &&
    url.hash === ''
  );
};

const redact = (input: string, extraSecrets: readonly string[] = []): string => {
  let value = input
    .replace(
      /((?:sessionToken|token|secret|password|authorization|cookie|activationCode|activation_code)\s*[=:]\s*)[^\s,}"']+/giu,
      '$1[REDACTED]',
    )
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/gu, '[IP]')
    .replace(/(https?:\/\/)[^/\s@]+:[^@/\s]+@/giu, '$1[REDACTED]@');
  for (const [name, secret] of Object.entries(process.env)) {
    if (secret && /token|secret|password|cookie|authorization|activation/iu.test(name)) {
      value = value.replaceAll(secret, '[REDACTED]');
    }
  }
  for (const secret of extraSecrets) if (secret) value = value.replaceAll(secret, '[REDACTED]');
  return value;
};

const save = (
  manifest: TerminalAutomationManifest,
  patch: Partial<TerminalAutomationManifest>,
): TerminalAutomationManifest => {
  const next = Object.freeze({...manifest, ...patch, updatedAt: new Date().toISOString()});
  persistManagedRun(root, next);
  return next;
};

const record = (runId: string, event: string, fields: Readonly<Record<string, unknown>> = {}): void => {
  const eventPath = path.join(root, '.runtime/terminal-automation', runId, 'events.jsonl');
  appendFileSync(eventPath, `${JSON.stringify({at: new Date().toISOString(), event, ...fields})}\n`, {mode: 0o600});
};

const failRun = (
  manifest: TerminalAutomationManifest,
  reason: string,
  cleanup: TerminalAutomationManifest['cleanup'] = manifest.cleanup,
): TerminalAutomationManifest => {
  const next = save(manifest, {
    stage: 'FAILED',
    firstFailure: manifest.firstFailure ?? reason,
    business: 'FAIL',
    cleanup,
  });
  record(manifest.runId, 'run.failed', {code: reason});
  return next;
};

const managedDiagnosticsFailureCode = (error: unknown): string => {
  if (!(error instanceof Error)) return 'TERMINAL_AUTOMATION_MANAGED_DIAGNOSTIC_READ_FAILED';
  if (/^TERMINAL_AUTOMATION_[A-Z0-9_]+$/u.test(error.message)) return error.message;
  const refused = /^R5_DEV_RUNNER=REFUSED; REASON=([A-Z0-9_]+)$/u.exec(error.message);
  return refused?.[1] ?? 'TERMINAL_AUTOMATION_MANAGED_DIAGNOSTIC_READ_FAILED';
};

const printRunSummary = (manifest: TerminalAutomationManifest): void => {
  const runDirectory = path.join(root, '.runtime/terminal-automation', manifest.runId);
  process.stdout.write(
    `TERMINAL_AUTOMATION_RUN runId=${manifest.runId} business=${manifest.business} diagnostics=${manifest.diagnostics ?? 'N/A'} cleanup=${manifest.cleanup} manifest=${path.relative(root, path.join(runDirectory, 'run-manifest.json'))}\n`,
  );
};

const readProcessIdentity = (pid: number): TerminalAutomationProcessIdentity => {
  const process = managedProcessTree.readProcessTable().find(value => value.pid === pid);
  if (!process?.pgid || !process.startToken) throw new Error('TERMINAL_AUTOMATION_CHILD_PROCESS_IDENTITY_UNAVAILABLE');
  return Object.freeze({pid: process.pid, pgid: process.pgid, startToken: process.startToken});
};

const runRecoveryAdb = (adbPath: string, args: readonly string[], failureCode: string): string => {
  const result = spawnSync(adbPath, [...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 64 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) fail(failureCode);
  return result.stdout;
};

const isLocalTcpPortListening = (port: number): Promise<boolean> =>
  new Promise((resolve, reject) => {
    const socket = createConnection({host: '127.0.0.1', port});
    let settled = false;
    const finish = (result: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1_000, () => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error('TERMINAL_AUTOMATION_RECOVERY_REVERSE_LOCAL_LISTENER_UNKNOWN'));
    });
    socket.once('connect', () => finish(true));
    socket.once('error', error => {
      if (settled) return;
      if ('code' in error && error.code === 'ECONNREFUSED') finish(false);
      else {
        settled = true;
        socket.destroy();
        reject(new Error('TERMINAL_AUTOMATION_RECOVERY_REVERSE_LOCAL_LISTENER_UNKNOWN'));
      }
    });
  });

const runFailedAndroidCleanupRecovery = async (runId: string, serial: string): Promise<number> => {
  const resourceGate = path.join(root, 'scripts/env/check-runtime-resource-budget');
  const preflight = spawnSync(resourceGate, ['--profile', 'ter-validation-with-dev', path.join(root, '.runtime')], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  if (preflight.stdout) process.stdout.write(redact(preflight.stdout));
  if (preflight.stderr) process.stderr.write(redact(preflight.stderr));
  if (preflight.error || preflight.status !== 0) {
    process.stderr.write('TERMINAL_AUTOMATION_RESOURCE_PREFLIGHT=FAIL\n');
    return 1;
  }

  let sourceTarget: ReturnType<typeof resolveFailedAndroidRunCleanupTarget>;
  try {
    sourceTarget = resolveFailedAndroidRunCleanupTarget(
      root,
      runId,
      serial,
      managedProcessTree.readProcessTable().map(process => ({pid: process.pid, startToken: process.startToken})),
    );
  } catch (error) {
    const code =
      error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+$/u.test(error.message)
        ? error.message
        : 'TERMINAL_AUTOMATION_RECOVERY_SOURCE_INVALID';
    process.stderr.write(`${code}\n`);
    return 2;
  }

  const wrapperPid = Number(process.env.TERMINAL_AUTOMATION_WRAPPER_PID);
  const expectedWrapperStart = process.env.TERMINAL_AUTOMATION_WRAPPER_START_TOKEN?.trim().replace(/\s+/gu, ' ');
  if (!Number.isInteger(wrapperPid) || wrapperPid <= 0 || !expectedWrapperStart)
    fail('TERMINAL_AUTOMATION_WRAPPER_IDENTITY_REQUIRED');
  const wrapperIdentity = readProcessIdentity(wrapperPid);
  if (wrapperIdentity.startToken !== expectedWrapperStart) fail('TERMINAL_AUTOMATION_WRAPPER_IDENTITY_MISMATCH');
  const manifest = createManagedRun(root, {
    phase: 'cleanup',
    platform: 'android',
    shape: sourceTarget.shape,
    case: 'android.failed-run-cleanup',
    sample: sourceTarget.sample,
    deviceSerial: sourceTarget.serial,
  });
  const runDirectory = path.join(root, '.runtime/terminal-automation', manifest.runId);
  const logPath = path.join(runDirectory, 'runner.log');
  writeFileSync(logPath, '', {mode: 0o600, flag: 'wx'});
  const cleanupManifest = Object.freeze({
    ...manifest,
    stage: 'DEVICE_CLEANUP_STARTING',
    processes: Object.freeze([...manifest.processes, wrapperIdentity]),
    androidPackageId: sourceTarget.packageId,
    recoveryOfRunId: sourceTarget.runId,
    logs: Object.freeze([path.relative(root, logPath)]),
  });
  persistManagedRun(root, cleanupManifest);
  const recordRecovery = (event: string, fields: Readonly<Record<string, unknown>> = {}): void => {
    appendFileSync(
      path.join(runDirectory, 'events.jsonl'),
      `${JSON.stringify({at: new Date().toISOString(), event, ...fields})}\n`,
      {mode: 0o600},
    );
    appendFileSync(
      logPath,
      `TERMINAL_AUTOMATION_RECOVERY run=${manifest.runId} ${event}${Object.entries(fields)
        .map(([key, value]) => ` ${key}=${String(value)}`)
        .join('')}\n`,
      {mode: 0o600},
    );
  };
  recordRecovery('source.run.verified', {sourceRunId: sourceTarget.runId, deviceSerial: sourceTarget.serial});
  try {
    const adbPath = process.env.ADB_PATH || 'adb';
    const devices = runRecoveryAdb(adbPath, ['devices'], 'TERMINAL_AUTOMATION_RECOVERY_DEVICE_DISCOVERY_FAILED');
    const readySerials = devices
      .split(/\r?\n/u)
      .filter(line => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\s+device(?:\s|$)/u.test(line));
    if (readySerials.filter(line => line.split(/\s+/u)[0] === sourceTarget.serial).length !== 1)
      fail('TERMINAL_AUTOMATION_RECOVERY_DEVICE_IDENTITY_UNAVAILABLE');
    const packageInstalled = async (packageId: string): Promise<boolean> => {
      const output = runRecoveryAdb(
        adbPath,
        ['-s', sourceTarget.serial, 'shell', 'pm', 'list', 'packages', '--user', '0', packageId],
        'TERMINAL_AUTOMATION_RECOVERY_PACKAGE_READ_FAILED',
      );
      const matching = output.split(/\r?\n/u).filter(line => line.trim() === `package:${packageId}`);
      if (matching.length > 1) fail('TERMINAL_AUTOMATION_RECOVERY_PACKAGE_READBACK_AMBIGUOUS');
      return matching.length === 1;
    };
    const cleanupResult = await cleanupFailedAndroidRunPackage(sourceTarget, {
      deviceSerial: sourceTarget.serial,
      isInstalled: packageInstalled,
      forceStop: async packageId => {
        runRecoveryAdb(
          adbPath,
          ['-s', sourceTarget.serial, 'shell', 'am', 'force-stop', packageId],
          'TERMINAL_AUTOMATION_RECOVERY_FORCE_STOP_FAILED',
        );
      },
      uninstall: async packageId => {
        runRecoveryAdb(
          adbPath,
          ['-s', sourceTarget.serial, 'uninstall', packageId],
          'TERMINAL_AUTOMATION_RECOVERY_UNINSTALL_FAILED',
        );
      },
    });
    recordRecovery('target.package.cleanup.complete', {
      packageId: sourceTarget.packageId,
      wasInstalled: cleanupResult.wasInstalled,
      packageReadback: 'ABSENT',
    });
    const reverseResult = await cleanupFailedAndroidRunReverses(sourceTarget, {
      deviceSerial: sourceTarget.serial,
      list: async () =>
        parseAndroidReverseList(
          runRecoveryAdb(
            adbPath,
            ['-s', sourceTarget.serial, 'reverse', '--list'],
            'TERMINAL_AUTOMATION_RECOVERY_REVERSE_LIST_FAILED',
          ),
        ),
      isLocalPortListening: isLocalTcpPortListening,
      remove: async remote => {
        runRecoveryAdb(
          adbPath,
          ['-s', sourceTarget.serial, 'reverse', '--remove', remote],
          'TERMINAL_AUTOMATION_RECOVERY_REVERSE_REMOVE_FAILED',
        );
      },
    });
    recordRecovery('target.reverse.cleanup.complete', {
      remotes: reverseResult.removed,
      readback: reverseResult.readback,
      sourceOwnership:
        sourceTarget.reverses.length > 0
          ? 'RECORDED_EVENTS'
          : sourceTarget.legacyRecoverableRemotes.length > 0
            ? 'LEGACY_RUN_LOG'
            : 'NONE',
    });
    const finished = Object.freeze({...cleanupManifest, stage: 'FINISHED', business: 'PASS', cleanup: 'PASS'});
    persistManagedRun(root, finished);
    recordRecovery('cleanup.passed', {sourceRunId: sourceTarget.runId, packageReadback: 'ABSENT'});
    printRunSummary(finished);
    return 0;
  } catch (error) {
    const code =
      error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+$/u.test(error.message)
        ? error.message
        : 'TERMINAL_AUTOMATION_RECOVERY_DEVICE_CLEANUP_FAILED';
    const failed = Object.freeze({
      ...cleanupManifest,
      stage: 'CLEANUP_FAILED',
      firstFailure: code,
      business: 'FAIL',
      cleanup: 'FAIL',
    });
    persistManagedRun(root, failed);
    recordRecovery('cleanup.failed', {sourceRunId: sourceTarget.runId, code});
    printRunSummary(failed);
    process.stderr.write(`${code}\n`);
    return 1;
  }
};

const readOwnedTreeSnapshot = (
  identity: TerminalAutomationProcessIdentity,
  additionalProcesses: readonly TerminalAutomationProcessIdentity[],
): Readonly<{readonly rssKiB: number; readonly processes: readonly TerminalAutomationProcessIdentity[]}> => {
  const table = managedProcessTree.readProcessTable();
  const tree = managedProcessTree.snapshotProcessTree(identity, table);
  if (tree.some(process => process.ownershipUnverified))
    throw new Error('TERMINAL_AUTOMATION_PROCESS_TREE_IDENTITY_LOST');
  const processes = [
    ...new Map(
      [
        ...additionalProcesses,
        ...tree.map(process => ({pid: process.pid, pgid: process.pgid, startToken: process.startToken})),
      ].map(process => [`${process.pid}:${process.startToken}`, process] as const),
    ).values(),
  ];
  if (processes.length === 0) return Object.freeze({rssKiB: 0, processes: Object.freeze([])});
  const result = spawnSync(
    'ps',
    ['-o', 'pid=', '-o', 'rss=', '-p', processes.map(process => String(process.pid)).join(',')],
    {
      encoding: 'utf8',
    },
  );
  if (result.status !== 0) throw new Error('TERMINAL_AUTOMATION_PROCESS_RSS_UNAVAILABLE');
  const rssKiB = result.stdout
    .trim()
    .split('\n')
    .reduce((total, line) => total + (Number(line.trim().split(/\s+/u).at(-1)) || 0), 0);
  return Object.freeze({
    rssKiB,
    processes: Object.freeze(processes.map(process => Object.freeze({...process}))),
  });
};

const run = async (execution: TerminalAutomationRunOptions): Promise<number> => {
  if (!updateCaseImplemented(execution)) {
    process.stderr.write('TERMINAL_AUTOMATION_UPDATE_CASE_NOT_IMPLEMENTED\n');
    return 1;
  }
  const resourceGate = path.join(root, 'scripts/env/check-runtime-resource-budget');
  const preflight = spawnSync(resourceGate, ['--profile', 'ter-validation-with-dev', path.join(root, '.runtime')], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  if (preflight.stdout) process.stdout.write(redact(preflight.stdout));
  if (preflight.stderr) process.stderr.write(redact(preflight.stderr));
  if (preflight.error || preflight.status !== 0) {
    process.stderr.write(
      `TERMINAL_AUTOMATION_RESOURCE_PREFLIGHT=FAIL code=${(preflight.error as NodeJS.ErrnoException | undefined)?.code ?? preflight.status ?? 'UNKNOWN'}\n`,
    );
    return 1;
  }

  const wrapperPid = Number(process.env.TERMINAL_AUTOMATION_WRAPPER_PID);
  const expectedWrapperStart = process.env.TERMINAL_AUTOMATION_WRAPPER_START_TOKEN?.trim().replace(/\s+/gu, ' ');
  let wrapperIdentity: TerminalAutomationProcessIdentity;
  try {
    if (!Number.isInteger(wrapperPid) || wrapperPid <= 0 || !expectedWrapperStart) {
      throw new Error('TERMINAL_AUTOMATION_WRAPPER_IDENTITY_REQUIRED');
    }
    wrapperIdentity = readProcessIdentity(wrapperPid);
    if (wrapperIdentity.startToken !== expectedWrapperStart)
      throw new Error('TERMINAL_AUTOMATION_WRAPPER_IDENTITY_MISMATCH');
  } catch (error) {
    const code = error instanceof Error ? error.message : 'TERMINAL_AUTOMATION_WRAPPER_IDENTITY_INVALID';
    process.stderr.write(`${code}\n`);
    return 1;
  }

  let manifest = createManagedRun(root, execution);
  const androidBuildIdentity =
    execution.platform === 'android'
      ? androidAutomationBuildIdentity(manifest.runId, execution.sample ?? 'console')
      : undefined;
  if (androidBuildIdentity !== undefined) manifest = save(manifest, {androidPackageId: androidBuildIdentity.packageId});
  manifest = save(manifest, {processes: Object.freeze([manifest.owner, wrapperIdentity])});
  const runDirectory = path.join(root, '.runtime/terminal-automation', manifest.runId);
  const logPath = path.join(runDirectory, 'runner.log');
  const logFile = path.relative(root, logPath);
  manifest = save(manifest, {stage: 'PREFLIGHT_PASS', logs: Object.freeze([logFile])});
  record(manifest.runId, 'resource.preflight.pass', {profile: 'ter-validation-with-dev'});
  writeFileSync(logPath, '', {mode: 0o600, flag: 'wx'});

  if ((execution.phase === 'update' || execution.phase === 'remote') && execution.platform === 'android') {
    try {
      assertNoAndroidIntermediateOutputs(path.join(root, 'apps/terminal'));
      record(manifest.runId, 'android.intermediate.preflight.pass');
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'TERMINAL_AUTOMATION_ANDROID_INTERMEDIATE_PREFLIGHT_FAILED';
      manifest = failRun(manifest, reason, 'PASS');
      record(manifest.runId, 'android.intermediate.preflight.failed', {code: reason});
      printRunSummary(manifest);
      process.stderr.write(`${reason}\n`);
      return 1;
    }
  }

  let managedDevContext: ManagedDevContext | undefined;
  let managedDevDiagnosticBaseline: readonly ManagedDiagnosticSource[] = [];
  if (
    execution.phase === 'journey' ||
    execution.phase === 'skill' ||
    updateRequiresManagedDev(execution) ||
    remoteRequiresManagedDev(execution)
  ) {
    try {
      managedDevContext = await readManagedDevContext();
      manifest = save(manifest, {
        managedDev: Object.freeze({
          runId: managedDevContext.runId,
          manifestSha256: managedDevContext.manifestSha256,
          livekitResident: managedDevContext.livekitResident,
        }),
      });
      record(manifest.runId, 'managed-dev.identity.verified', {
        managedDevRunId: managedDevContext.runId,
        manifestSha256: managedDevContext.manifestSha256,
      });
      record(manifest.runId, 'managed-dev.livekit-resident.verified', managedDevContext.livekitResident);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'TERMINAL_AUTOMATION_DEV_PREREQUISITE_FAILED';
      manifest = failRun(manifest, reason, 'PASS');
      printRunSummary(manifest);
      process.stderr.write(`${reason}\n`);
      return 1;
    }
  }

  const suiteRelative = resolveAutomationSuite(execution);
  const suite = path.join(driverRoot, suiteRelative);
  if (!existsSync(suite)) {
    manifest = failRun(manifest, 'TERMINAL_AUTOMATION_PHASE_SUITE_NOT_IMPLEMENTED', 'PASS');
    printRunSummary(manifest);
    process.stderr.write('TERMINAL_AUTOMATION_PHASE_SUITE_NOT_IMPLEMENTED\n');
    return 1;
  }

  if ((execution.phase === 'update' || execution.phase === 'remote') && managedDevContext !== undefined) {
    try {
      const sources = await readManagedDevDiagnosticEvents({
        manifestPath: managedDevContext.manifestPath,
        runId: managedDevContext.runId,
      });
      assertManagedDevDiagnosticSourcesReadable(sources);
      managedDevDiagnosticBaseline = sources;
      for (const source of sources) {
        const line = `TERMINAL_AUTOMATION_MANAGED_DEV_DIAGNOSTICS ${JSON.stringify({
          at: new Date().toISOString(),
          runId: manifest.runId,
          managedDevRunId: managedDevContext.runId,
          phase: 'preflight',
          source: source.source,
          status: source.status,
          tailBytes: source.tailBytes,
          eventCount: source.eventCount,
          events: source.events,
        })}\n`;
        appendFileSync(logPath, line, {mode: 0o600});
        process.stdout.write(line);
        record(manifest.runId, 'managed-dev.diagnostics.preflight.read', {
          managedDevRunId: managedDevContext.runId,
          source: source.source,
          eventCount: source.eventCount,
          tailBytes: source.tailBytes,
        });
      }
    } catch (error) {
      const code = managedDiagnosticsFailureCode(error);
      const line = `TERMINAL_AUTOMATION_MANAGED_DEV_DIAGNOSTICS ${JSON.stringify({
        at: new Date().toISOString(),
        runId: manifest.runId,
        managedDevRunId: managedDevContext.runId,
        phase: 'preflight',
        status: 'LOG_NOT_AVAILABLE',
        code,
      })}\n`;
      appendFileSync(logPath, line, {mode: 0o600});
      process.stdout.write(line);
      record(manifest.runId, 'managed-dev.diagnostics.preflight.failed', {
        managedDevRunId: managedDevContext.runId,
        code,
      });
      manifest = failRun(manifest, 'TERMINAL_AUTOMATION_MANAGED_DIAGNOSTICS_PREFLIGHT_FAILED', 'PASS');
      printRunSummary(manifest);
      process.stderr.write(`TERMINAL_AUTOMATION_MANAGED_DIAGNOSTICS_PREFLIGHT_FAILED code=${code}\n`);
      return 1;
    }
  }

  const vitest = path.join(root, 'node_modules/.bin/vitest');
  const env = {
    ...process.env,
    TERMINAL_AUTOMATION_RUN_ID: manifest.runId,
    TERMINAL_AUTOMATION_PHASE: execution.phase,
    TERMINAL_AUTOMATION_PLATFORM: execution.platform,
    TERMINAL_AUTOMATION_SHAPE: execution.shape,
    ...(execution.remoteTopology === undefined
      ? {}
      : {TERMINAL_AUTOMATION_REMOTE_TOPOLOGY: execution.remoteTopology}),
    ...(execution.deviceSerial === undefined
      ? {}
      : {TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIAL: execution.deviceSerial}),
    ...(execution.peerDeviceSerial === undefined
      ? {}
      : {TERMINAL_AUTOMATION_ANDROID_PEER_DEVICE_SERIAL: execution.peerDeviceSerial}),
    ...(androidBuildIdentity === undefined
      ? {}
      : {
          TERMINAL_AUTOMATION_ANDROID_PACKAGE_ID: androidBuildIdentity.packageId,
          TERMINAL_AUTOMATION_ANDROID_APPLICATION_ID_SUFFIX: androidBuildIdentity.applicationIdSuffix,
        }),
    ...(execution.case === undefined ? {} : {TERMINAL_AUTOMATION_CASE: execution.case}),
    ...(execution.age === undefined ? {} : {TERMINAL_AUTOMATION_AGE: execution.age}),
    ...(execution.sample === undefined ? {} : {TERMINAL_AUTOMATION_SAMPLE: execution.sample}),
    ...(execution.phase === 'update' &&
    ['update.fixed', 'update.install-result', 'update.compatibility'].includes(execution.case ?? '')
      ? {
          EXPO_PUBLIC_TER_AUTOMATION_RUN_ID: manifest.runId,
          EXPO_PUBLIC_TER_AUTOMATION_CASE: execution.case ?? '',
        }
      : {}),
    ...(execution.phase === 'remote' && execution.platform === 'web'
      ? {
          EXPO_PUBLIC_TER_AUTOMATION_PHASE: 'remote',
          EXPO_PUBLIC_TER_AUTOMATION_RUN_ID: manifest.runId,
          EXPO_PUBLIC_TER_AUTOMATION_CASE: execution.case ?? '',
        }
      : {}),
    ...((execution.phase === 'update' || execution.phase === 'remote') && execution.platform === 'android'
      ? {
          EXPO_PUBLIC_TER_AUTOMATION_BUILD: 'true',
          EXPO_PUBLIC_TER_AUTOMATION_RUN_ID: manifest.runId,
          EXPO_PUBLIC_TER_AUTOMATION_ANDROID_PACKAGE_ID: androidBuildIdentity?.packageId ?? '',
          ...(execution.phase === 'remote' ? {EXPO_PUBLIC_TER_AUTOMATION_PHASE: 'remote'} : {}),
        }
      : {}),
    ...(managedDevContext === undefined
      ? {}
      : {
          V2S_TERMINAL_DEV_MANIFEST: managedDevContext.manifestPath,
          V2S_TERMINAL_DEV_MANAGED_DEV_RUN_ID: managedDevContext.runId,
          TERMINAL_AUTOMATION_MANAGED_DEV_RUN_ID: managedDevContext.runId,
          TERMINAL_AUTOMATION_RUN_DIRECTORY: runDirectory,
          V2S_TERMINAL_DEV_HTTP_BASE_URL: managedDevContext.httpBaseUrl,
          V2S_TERMINAL_DEV_TDS_ENTRY_ONE_WS_URL: managedDevContext.tdsEntryOneUrl,
          V2S_TERMINAL_DEV_TDS_ENTRY_TWO_WS_URL: managedDevContext.tdsEntryTwoUrl,
          TERMINAL_AUTOMATION_WEB_ORIGIN: managedDevContext.webOrigin,
          TERMINAL_AUTOMATION_PLATFORM_ADMIN_ORIGIN: managedDevContext.platformAdminOrigin,
          TERMINAL_AUTOMATION_OPERATIONS_ADMIN_ORIGIN: managedDevContext.operationsAdminOrigin,
          V2S_SEED_OPERATIONS_DEFAULT_PASSWORD: managedDevContext.operationsPassword,
          V2S_SEED_PLATFORM_ROOT_PASSWORD: managedDevContext.platformRootPassword,
          EXPO_PUBLIC_TER_MANAGED_GROUP_WORKSPACE_BASE_URL: `${managedDevContext.httpBaseUrl}/api/terminal/group-workspaces/aurora`,
          EXPO_PUBLIC_TER_MANAGED_TDS_ENTRY_ONE_WS_URL: managedDevContext.tdsEntryOneUrl,
          EXPO_PUBLIC_TER_MANAGED_TDS_ENTRY_TWO_WS_URL: managedDevContext.tdsEntryTwoUrl,
          ...(execution.platform === 'web' ? {EXPO_PUBLIC_TER_MANAGED_DEVICE_ID: `ter-auto-${manifest.runId}`} : {}),
          EXPO_PUBLIC_TER_AUTOMATION_SURFACE_FORM:
            execution.phase === 'remote'
              ? execution.remoteTopology === 'mobile-single'
                ? 'mobile'
                : 'laptop'
              : execution.phase === 'update' && execution.case === 'update.pair'
                ? 'laptop'
                : execution.shape === 'mobile'
                  ? 'mobile'
                  : 'laptop',
        }),
  };
  manifest = save(manifest, {stage: 'TEST_STARTING'});
  record(manifest.runId, 'test.started', {
    phase: execution.phase,
    platform: execution.platform,
    shape: execution.shape,
  });
  const child = spawn(
    vitest,
    ['run', '--root', driverRoot, '--config', path.join(driverRoot, 'vitest.journeys.config.ts'), suite],
    {
      cwd: driverRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    },
  );
  let childSpawnFailure: string | null = null;
  child.once('error', error => {
    childSpawnFailure = `TERMINAL_AUTOMATION_CHILD_SPAWN_FAILURE_${(error as NodeJS.ErrnoException).code ?? 'UNKNOWN'}`;
  });

  let childIdentity: TerminalAutomationProcessIdentity;
  try {
    if (!child.pid) throw new Error('TERMINAL_AUTOMATION_CHILD_PID_UNAVAILABLE');
    childIdentity = readProcessIdentity(child.pid);
    manifest = save(manifest, {processes: Object.freeze([...manifest.processes, childIdentity])});
    record(manifest.runId, 'test.process.owned', {pid: childIdentity.pid, pgid: childIdentity.pgid});
  } catch (error) {
    if (!child.pid && childSpawnFailure !== null) {
      await new Promise<void>(resolve => child.once('close', () => resolve()));
      const reason = childSpawnFailure;
      manifest = failRun(manifest, reason, 'PASS');
      printRunSummary(manifest);
      process.stderr.write(`${reason}\n`);
      return 1;
    }
    child.kill('SIGTERM');
    await new Promise<void>(resolve => child.once('close', () => resolve()));
    const reason = error instanceof Error ? error.message : 'TERMINAL_AUTOMATION_CHILD_PROCESS_IDENTITY_UNAVAILABLE';
    failRun(manifest, reason, 'FAIL');
    process.stderr.write(`${reason}\n`);
    return 1;
  }

  const streamBuffers = new Map<'stdout' | 'stderr', string>([
    ['stdout', ''],
    ['stderr', ''],
  ]);
  const androidDeviceCleanup = createAndroidDeviceCleanupTracker();
  const writeOutput = (stream: 'stdout' | 'stderr', chunk: Buffer, final = false): void => {
    const raw = chunk.toString('utf8');
    if (execution.platform === 'android') androidDeviceCleanup.accept(stream, raw);
    const buffered = `${streamBuffers.get(stream) ?? ''}${raw}`;
    const lines = buffered.split('\n');
    const remainder = final ? '' : (lines.pop() ?? '');
    streamBuffers.set(stream, remainder);
    const safe = redact(
      `${lines.join('\n')}${lines.length || final ? '\n' : ''}${final ? redact(remainder) : ''}`,
      managedDevContext === undefined
        ? []
        : [managedDevContext.operationsPassword, managedDevContext.platformRootPassword],
    );
    if (!safe) return;
    appendFileSync(logPath, `${stream} ${safe}`, {mode: 0o600});
    (stream === 'stdout' ? process.stdout : process.stderr).write(safe);
  };
  child.stdout.on('data', chunk => writeOutput('stdout', Buffer.from(chunk)));
  child.stderr.on('data', chunk => writeOutput('stderr', Buffer.from(chunk)));

  let budgetExceeded = false;
  let monitorFailure: string | null = null;
  const monitorOwnedResources = (): void => {
    try {
      const {rssKiB, processes} = readOwnedTreeSnapshot(childIdentity, [manifest.owner, wrapperIdentity]);
      manifest = save(manifest, {
        processes: Object.freeze([manifest.owner, ...processes]),
        resource: Object.freeze({
          at: new Date().toISOString(),
          ownedTreeRssKiB: rssKiB,
          budgetKiB: ownProcessBudgetKiB,
        }),
      });
      record(manifest.runId, 'resource.heartbeat', {
        ownedTreeRssKiB: rssKiB,
        ownedProcessCount: processes.length,
        budgetKiB: ownProcessBudgetKiB,
      });
      if (rssKiB > ownProcessBudgetKiB) {
        budgetExceeded = true;
        monitorFailure = 'TERMINAL_AUTOMATION_OWNED_TREE_RSS_BUDGET_EXCEEDED';
        void managedProcessTree.terminateOwnedProcessTree(childIdentity).catch(() => undefined);
      }
    } catch (error) {
      monitorFailure = error instanceof Error ? error.message : 'TERMINAL_AUTOMATION_RESOURCE_HEARTBEAT_FAILED';
      void managedProcessTree.terminateOwnedProcessTree(childIdentity).catch(() => undefined);
    }
  };
  monitorOwnedResources();
  const heartbeat = setInterval(monitorOwnedResources, 5_000);

  let requestedSignal: NodeJS.Signals | null = null;
  const terminateOnSignal = (signal: NodeJS.Signals): void => {
    if (requestedSignal !== null) return;
    requestedSignal = signal;
    record(manifest.runId, 'run.interrupted', {signal});
    void managedProcessTree
      .terminateOwnedProcessTree(childIdentity)
      .then(result => {
        if (result.status !== 'PASS') child.kill('SIGTERM');
      })
      .catch(() => child.kill('SIGTERM'));
  };
  const onInterrupt = (): void => terminateOnSignal('SIGINT');
  const onTerminate = (): void => terminateOnSignal('SIGTERM');
  process.once('SIGINT', onInterrupt);
  process.once('SIGTERM', onTerminate);
  const exitCode = await new Promise<number>(resolve => child.once('close', code => resolve(code ?? 1)));
  process.off('SIGINT', onInterrupt);
  process.off('SIGTERM', onTerminate);
  clearInterval(heartbeat);
  writeOutput('stdout', Buffer.alloc(0), true);
  writeOutput('stderr', Buffer.alloc(0), true);
  let managedDevDiagnosticsUnavailable: string | null = null;
  if (managedDevContext !== undefined) {
    try {
      const sources = await readManagedDevDiagnosticEvents({
        manifestPath: managedDevContext.manifestPath,
        runId: managedDevContext.runId,
      });
      if (execution.phase === 'remote' && execution.case === 'remote.main') {
        const coverage = evaluateManagedRemoteControlDiagnosticCoverage(
          managedDevDiagnosticBaseline,
          sources,
          exitCode === 0,
        );
        if (coverage.status !== 'PASS') {
          managedDevDiagnosticsUnavailable = coverage.code ?? 'TERMINAL_AUTOMATION_REMOTE_DIAGNOSTICS_INCOMPLETE';
          const line = `TERMINAL_AUTOMATION_MANAGED_DEV_DIAGNOSTICS ${JSON.stringify({
            at: new Date().toISOString(),
            runId: manifest.runId,
            managedDevRunId: managedDevContext.runId,
            phase: 'coverage',
            status: 'FAIL',
            code: managedDevDiagnosticsUnavailable,
            missingOperations: coverage.missingOperations,
          })}\n`;
          appendFileSync(logPath, line, {mode: 0o600});
          process.stdout.write(line);
          record(manifest.runId, 'managed-dev.diagnostics.coverage.failed', {
            managedDevRunId: managedDevContext.runId,
            code: managedDevDiagnosticsUnavailable,
            missingOperations: coverage.missingOperations,
          });
        } else {
          record(manifest.runId, 'managed-dev.diagnostics.coverage.passed', {
            managedDevRunId: managedDevContext.runId,
            observedRemoteRequestCount: sources.find(source => source.source === 'cbs')?.events?.filter(event =>
              typeof event.operationId === 'string' && remoteControlDiagnosticOperations.has(event.operationId) &&
              typeof event.requestId === 'string' && remoteControlDiagnosticRequestEvents.has(event.event),
            ).length ?? 0,
          });
        }
      }
      for (const source of sources) {
        const line = `TERMINAL_AUTOMATION_MANAGED_DEV_DIAGNOSTICS ${JSON.stringify({
          at: new Date().toISOString(),
          runId: manifest.runId,
          managedDevRunId: managedDevContext.runId,
          source: source.source,
          status: source.status,
          tailBytes: source.tailBytes,
          eventCount: source.eventCount,
          events: source.events,
        })}\n`;
        appendFileSync(logPath, line, {mode: 0o600});
        process.stdout.write(line);
        record(manifest.runId, 'managed-dev.diagnostics.read', {
          managedDevRunId: managedDevContext.runId,
          source: source.source,
          eventCount: source.eventCount,
          tailBytes: source.tailBytes,
        });
      }
    } catch (error) {
      managedDevDiagnosticsUnavailable = managedDiagnosticsFailureCode(error);
      const line = `TERMINAL_AUTOMATION_MANAGED_DEV_DIAGNOSTICS ${JSON.stringify({
        at: new Date().toISOString(),
        runId: manifest.runId,
        managedDevRunId: managedDevContext.runId,
        status: 'LOG_NOT_AVAILABLE',
        code: managedDevDiagnosticsUnavailable,
      })}\n`;
      appendFileSync(logPath, line, {mode: 0o600});
      process.stdout.write(line);
      record(manifest.runId, 'managed-dev.diagnostics.unavailable', {
        managedDevRunId: managedDevContext.runId,
        code: managedDevDiagnosticsUnavailable,
      });
    }
  }
  let fixtureIntentFailure: string | null = null;
  try {
    const fixture = readFixtureIntent(runDirectory, managedDevContext?.runId);
    manifest = save(manifest, {fixture});
    record(manifest.runId, 'fixture.activation-intent.recorded', {
      managedDevRunId: fixture.managedDevRunId,
      seedKey: fixture.seedKey,
      bindingGeneration: fixture.bindingGeneration,
    });
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== 'ENOENT' ||
      requiresFixtureIntentForSuccessfulRun(execution, exitCode)
    ) {
      fixtureIntentFailure = error instanceof Error ? error.message : 'TERMINAL_AUTOMATION_FIXTURE_INTENT_INVALID';
    }
  }
  let treeReadback: readonly {pid: number; pgid: number; startToken: string; ownershipUnverified?: boolean}[] = [];
  try {
    treeReadback = managedProcessTree.snapshotProcessTree(childIdentity);
    if (treeReadback.length > 0) {
      const cleanup = await managedProcessTree.terminateOwnedProcessTree(childIdentity);
      treeReadback = cleanup.treeReadback;
    }
  } catch {
    treeReadback = [{...childIdentity, ownershipUnverified: true}];
  }
  let generatedArtifactCleanup: 'PASS' | 'FAIL' = 'PASS';
  let artifactCleanup: ReturnType<typeof cleanupManagedRunArtifacts> | undefined;
  try {
    artifactCleanup = cleanupManagedRunArtifacts(
      runDirectory,
      execution.phase === 'update' && (execution.case === 'update.artifacts' || execution.platform === 'android'),
    );
    record(manifest.runId, 'generated-artifacts.cleanup.passed', {
      removedPaths: artifactCleanup.removed,
      removedBytes: artifactCleanup.removedBytes,
    });
  } catch (error) {
    generatedArtifactCleanup = 'FAIL';
    record(manifest.runId, 'generated-artifacts.cleanup.failed', {
      code: error instanceof Error ? error.message : 'TERMINAL_AUTOMATION_ARTIFACT_CLEANUP_FAILED',
    });
  }
  const androidDeviceCleanupStatus = execution.platform === 'android' ? androidDeviceCleanup.finish() : 'N/A';
  const deviceCleanupPassed = execution.platform !== 'android' || androidDeviceCleanupStatus === 'PASS';
  let scenarioProofFailure: string | null = null;
  if ((execution.phase === 'update' || execution.phase === 'remote') && execution.platform === 'android') {
    try {
      const output = readFileSync(logPath, 'utf8');
      if (!updateScenarioAssertionsObserved(execution, manifest.runId, output)) {
        scenarioProofFailure = 'TERMINAL_AUTOMATION_UPDATE_SCENARIO_ASSERTIONS_NOT_OBSERVED';
      }
    } catch {
      scenarioProofFailure = 'TERMINAL_AUTOMATION_UPDATE_SCENARIO_LOG_READ_FAILED';
    }
    if (scenarioProofFailure !== null)
      record(manifest.runId, 'update.scenario-proof.failed', {code: scenarioProofFailure});
  }
  const cleanupStatus =
    treeReadback.length === 0 && generatedArtifactCleanup === 'PASS' && deviceCleanupPassed ? 'PASS' : 'FAIL';
  if (androidDeviceCleanupStatus === 'FAIL') {
    record(manifest.runId, 'android.device.cleanup.failed', {code: androidDeviceCleanupMarker});
  } else if (androidDeviceCleanupStatus === 'UNKNOWN') {
    record(manifest.runId, 'android.device.cleanup.unknown', {code: 'ANDROID_DEVICE_CLEANUP_COMPLETION_NOT_OBSERVED'});
  }
  const businessStatus =
    exitCode === 0 &&
    !budgetExceeded &&
    monitorFailure === null &&
    fixtureIntentFailure === null &&
    scenarioProofFailure === null &&
    requestedSignal === null &&
    childSpawnFailure === null
      ? 'PASS'
      : 'FAIL';
  if (businessStatus !== 'PASS') {
    const failure =
      monitorFailure ??
      fixtureIntentFailure ??
      scenarioProofFailure ??
      childSpawnFailure ??
      (requestedSignal
        ? `RUN_INTERRUPTED_${requestedSignal}`
        : budgetExceeded
          ? 'TERMINAL_AUTOMATION_OWNED_TREE_RSS_BUDGET_EXCEEDED'
          : `VITEST_EXIT_${exitCode}`);
    manifest = failRun(manifest, failure, cleanupStatus);
  } else {
    manifest = save(manifest, {stage: 'TEST_PASS', business: 'PASS'});
    record(manifest.runId, 'test.passed', {phase: execution.phase});
  }
  manifest = save(manifest, {stage: cleanupStatus === 'PASS' ? 'FINISHED' : 'CLEANUP_FAILED', cleanup: cleanupStatus});
  record(manifest.runId, cleanupStatus === 'PASS' ? 'cleanup.passed' : 'cleanup.failed', {
    processReadback: treeReadback.length === 0 ? 'EMPTY' : 'OWNED_PROCESS_REMAINS',
    generatedArtifactCleanup,
    generatedArtifactBytesRemoved: artifactCleanup?.removedBytes ?? null,
    androidDeviceCleanup: androidDeviceCleanupStatus,
  });
  const managedDevDiagnosticsStatus =
    managedDevContext === undefined ? 'N/A' : managedDevDiagnosticsUnavailable === null ? 'PASS' : 'FAIL';
  record(manifest.runId, 'managed-dev.diagnostics.result', {
    status: managedDevDiagnosticsStatus,
    code: managedDevDiagnosticsUnavailable,
  });
  let androidDiagnosticsStatus: 'PASS' | 'FAIL' | 'N/A' = 'N/A';
  if ((execution.phase === 'update' || execution.phase === 'remote') && execution.platform === 'android') {
    try {
      const diagnostics = evaluateAndroidDiagnostics(execution, manifest.runId, readBoundedLogTail(logPath));
      androidDiagnosticsStatus = diagnostics.status;
      manifest = save(manifest, {diagnostics: diagnostics.status});
      record(manifest.runId, 'android.diagnostics.result', diagnostics);
    } catch {
      androidDiagnosticsStatus = 'FAIL';
      manifest = save(manifest, {diagnostics: 'FAIL'});
      record(manifest.runId, 'android.diagnostics.result', {
        status: 'FAIL',
        code: 'TERMINAL_AUTOMATION_ANDROID_DIAGNOSTIC_LOG_READ_FAILED',
      });
    }
  }
  process.stdout.write(
    `TERMINAL_AUTOMATION_DIAGNOSTICS_RESULT runId=${manifest.runId} android=${androidDiagnosticsStatus} managedDev=${managedDevDiagnosticsStatus}\n`,
  );
  printRunSummary(manifest);
  return terminalAutomationExitCode({
    business: businessStatus,
    cleanup: cleanupStatus,
    diagnostics: androidDiagnosticsStatus,
    managedDevDiagnostics: managedDevDiagnosticsStatus,
  });
};

const main = async (): Promise<void> => {
  try {
    const argv = process.argv.slice(2);
    if (argv[0] === '--recover-failed-android-run') {
      if (argv.length !== 4 || argv[2] !== '--device-serial') fail('TERMINAL_AUTOMATION_RECOVERY_ARGUMENTS_INVALID');
      process.exitCode = await runFailedAndroidCleanupRecovery(argv[1] ?? '', argv[3] ?? '');
      return;
    }
    const execution = parseAutomationRunArguments(process.argv.slice(2));
    process.exitCode = await run(execution);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'TERMINAL_AUTOMATION_RUNNER_FAILURE';
    process.stderr.write(`${redact(code)}\n`);
    process.exitCode = 2;
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
