#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {validateManagedDevManifest} from './terminal-client-dev-acceptance.mjs';
import {readProcessTable, snapshotProcessTree, terminateOwnedProcessTree} from '../dev/managed-process-tree.mjs';
import {
  collectRemoteLog,
  collectRemoteTdsLog,
  remoteJavaReadiness,
  remoteTdsReadiness,
} from '../dev/r5-remote-java-runtime.mjs';
import {readManagedTerminalBindingByName, remoteHaproxyIngressReadiness} from '../dev/r5-dev-runner.mjs';
import {terminalBusinessMemberFixture} from './terminal-business-fixtures.mjs';
import {
  ADMIN_SHELL_FRAME_SELECTOR,
  EXPECTED_ADMIN_SHELL_COLOR_BY_INTEGRATION,
  WEB_TEXTINPUT_CONTEXTMENU_UNREACHED_CONSUMERS,
  additionalTextInputContextMenuTargets,
  classifyAdminLauncherFailureRecoveryLog,
  adminLauncherGesturePagePoint,
  adminLauncherBindingReady,
  hasStartupContentFailureReadiness,
  hasStartupCompletionEvent,
  hasUnexpectedBrowserConsoleFailures,
  expectedActivationRejectionConsoleFailureIndexes,
  expectedTextInputProbeCount,
  expectedTextInputProbeIds,
  isExpectedRuntimeLogEvent,
  isWallpaperRadioMarkerSelected,
  memberConfirmationReadback,
  wallpaperExitReadbackMismatch,
  managedTestServerSpaceOverrides,
  WEB_LAYER_OWNER_COVERAGE,
  WEB_SCENARIOS,
  applyWebSourceRecheckFailure,
  applyWebSourceSnapshot,
  acquireManagedWebRunLock,
  awaitManagedChildSpawn,
  assertManagedWebListenerOwnership,
  collectWebSourceFiles,
  createWebLogCheckpoint,
  classifyBrowserConsoleFailure,
  createExpoWebLaunchSpec,
  fetchExpoWebReadiness,
  hashWebSourceFiles,
  parseJsonEventsAfterByteOffset,
  parsePlatformPortsSummaryCount,
  correlateManagedHttpExchange,
  projectWebFailureDiagnostic,
  projectFrontendCommandDispatchEvents,
  webCommandDispatchMismatch,
  unresolvedScreenPlacementsAfterStartup,
  projectTerminalActivationLogEvents,
  projectTerminalConnectionHeartbeatLogEvents,
  projectManagedTerminalActivationBackendLogLines,
  projectManagedTdsLogLines,
  displayedHeartbeatRttMismatch,
  ensureContainedWebDirectory,
  expectedWebBusinessAssertionIds,
  hasManagedTerminalBrowserOrigin,
  webBusinessAssertionSetMatches,
  parseListeningProcessIds,
  pipeExpoOutput,
  releaseManagedWebRunLock,
  sendProtectedInputKeyboardProbe,
  textInputProbeMismatch,
  verifyExpoWebListenerOwnership,
  webScenarioScopeError,
} from './ter-admin-display-web-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeRoot = path.join(root, '.runtime/ter-admin-display');
const integrationName = process.argv[5] ?? 'sample-console';
if (!['sample-console', 'sample-wallpaper-console'].includes(integrationName)) {
  throw new Error('TER_ADMIN_DISPLAY_WEB_INTEGRATION_INVALID');
}
const integrationRoot = path.join(root, 'apps/terminal/ui/integration', integrationName);
const surfaceTestIdPrefix = `${integrationName}:test-expo:surface:PRIMARY`;
const webScenario = process.argv[6] ?? 'admin-runtime';
if (!WEB_SCENARIOS.includes(webScenario)) {
  throw new Error('TER_ADMIN_DISPLAY_WEB_SCENARIO_INVALID');
}
const runId = process.argv[2];
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(runId ?? '')) throw new Error('TER_ADMIN_DISPLAY_RUN_ID_REQUIRED');
const surfaceForm = process.argv[7] ?? 'laptop';
if (!['laptop', 'mobile'].includes(surfaceForm)) throw new Error('TER_ADMIN_DISPLAY_WEB_SURFACE_FORM_INVALID');
const keyboardScenario = [
  'keyboard-member-journey',
  'keyboard-login',
  'keyboard-overlay-ownership',
  'textinput-contextmenu',
].includes(webScenario);
const isActivationRejectionScenario = webScenario === 'terminal-activation-owner-rejection';
const isManagedActivationScenario =
  webScenario === 'terminal-activation-connection' ||
  webScenario === 'terminal-wallpaper-exit' ||
  isActivationRejectionScenario;
const managedDevScenario = keyboardScenario || isManagedActivationScenario || webScenario === 'terminal-server-config';
const managedDevManifestPath = path.join(root, '.runtime/r5/run-manifest.json');
const managedDevManifestBytes = managedDevScenario ? fs.readFileSync(managedDevManifestPath) : null;
const managedDev =
  managedDevManifestBytes === null
    ? null
    : validateManagedDevManifest(JSON.parse(managedDevManifestBytes.toString('utf8'))).manifest;
const managedGroupWorkspaceKey = 'aurora';
const managedServerOverrides =
  managedDev === null ? null : managedTestServerSpaceOverrides(managedDev, managedGroupWorkspaceKey);
const managedGroupWorkspaceUrl = managedServerOverrides?.businessBaseUrl ?? null;
const managedGroupWorkspacePath =
  managedGroupWorkspaceUrl === null ? null : new URL(managedGroupWorkspaceUrl).pathname.replace(/\/+$/u, '');
const activationRouteTemplate = `/${['api', 'terminal', 'group-workspaces', '{groupWorkspaceKey}', 'activation'].join('/')}`;
const cancellationRouteTemplate = `/${[
  'api',
  'terminal',
  'group-workspaces',
  '{groupWorkspaceKey}',
  'terminals',
  '{terminalRef}',
  'activation',
  'cancel',
].join('/')}`;
const activationFixtureByIntegrationAndSurface = Object.freeze({
  'sample-console': Object.freeze({laptop: 'term-front', mobile: 'term-handheld'}),
  'sample-wallpaper-console': Object.freeze({laptop: 'term-kds', mobile: 'term-preparing'}),
});
const activationFixtureOverride = process.env.TER_WEB_MANAGED_FIXTURE_KEY ?? null;
const managedActivationFixtureKey = !isManagedActivationScenario
  ? null
  : isActivationRejectionScenario
    ? 'term-disabled'
    : (activationFixtureOverride ?? activationFixtureByIntegrationAndSurface[integrationName][surfaceForm]);
if (activationFixtureOverride !== null && (!isManagedActivationScenario || isActivationRejectionScenario)) {
  throw new Error('WEB_MANAGED_ACTIVATION_FIXTURE_OVERRIDE_NOT_APPLICABLE');
}
const managedActivationDeviceIdOverride = process.env.TER_WEB_MANAGED_DEVICE_ID ?? null;
if (managedActivationDeviceIdOverride !== null && !/^[A-Za-z0-9:._-]{1,128}$/.test(managedActivationDeviceIdOverride)) {
  throw new Error('WEB_MANAGED_ACTIVATION_DEVICE_ID_INVALID');
}
const managedActivationDeviceId =
  managedActivationFixtureKey === null
    ? null
    : (managedActivationDeviceIdOverride ?? `ter-web:${integrationName}:${surfaceForm}`);
const readManagedActivationFixture = (fixtureKey, expectedStatus = 'ENABLED') => {
  if (fixtureKey === null) return null;
  const contractPath = path.join(root, 'doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json');
  const fixtureContract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const entry = fixtureContract.stableFixtures?.organization?.storeTerminals?.find(value => value.key === fixtureKey);
  const expectedDeviceType = surfaceForm;
  if (
    entry?.status !== expectedStatus ||
    entry?.deviceType !== expectedDeviceType ||
    !/^\d{8}$/.test(entry.activationCode)
  ) {
    throw new Error('WEB_MANAGED_ACTIVATION_FIXTURE_INVALID');
  }
  return Object.freeze({key: fixtureKey, name: entry.name, activationCode: entry.activationCode});
};
const managedActivationFixture = readManagedActivationFixture(
  managedActivationFixtureKey,
  isActivationRejectionScenario ? 'DISABLED' : 'ENABLED',
);
const managedActivationFixtureState =
  managedActivationFixture === null || managedDev === null
    ? null
    : readManagedTerminalBindingByName({
        runId: managedDev.runId,
        groupWorkspaceKey: managedGroupWorkspaceKey,
        terminalNames: [managedActivationFixture.name],
      })[0];
if (
  managedActivationFixtureState !== null &&
  (managedActivationFixtureState.terminalStatus !== (isActivationRejectionScenario ? 'DISABLED' : 'ENABLED') ||
    (!isActivationRejectionScenario && managedActivationFixtureState.bindingStatus === 'ACTIVE'))
) {
  throw new Error(
    managedActivationFixtureState.bindingStatus === 'ACTIVE'
      ? 'WEB_MANAGED_ACTIVATION_FIXTURE_ALREADY_BOUND'
      : 'WEB_MANAGED_ACTIVATION_FIXTURE_READBACK_MISMATCH',
  );
}
const integrationPackage = JSON.parse(fs.readFileSync(path.join(integrationRoot, 'package.json'), 'utf8'));
const orientation = surfaceForm === 'laptop' ? 'landscape' : 'portrait';
const expectedPrimaryLogicalSize = integrationPackage.terminalSurfaces?.orientations?.[orientation]?.PRIMARY;
if (
  !Number.isFinite(expectedPrimaryLogicalSize?.width) ||
  !Number.isFinite(expectedPrimaryLogicalSize?.height) ||
  expectedPrimaryLogicalSize.width <= 0 ||
  expectedPrimaryLogicalSize.height <= 0
) {
  throw new Error('WEB_PRIMARY_LOGICAL_SIZE_SOURCE_INVALID');
}
const port = Number(process.argv[3] ?? 8093);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('TER_ADMIN_DISPLAY_PORT_INVALID');
if (isManagedActivationScenario) {
  const configuredOrigins = managedDev?.terminalBrowserAllowedOrigins;
  if (!hasManagedTerminalBrowserOrigin(configuredOrigins, port)) {
    throw new Error('WEB_MANAGED_DEV_TERMINAL_CORS_ORIGIN_NOT_CONFIGURED');
  }
}
const failureOwnerArgument = process.argv[4] ?? null;
const failureOwner = failureOwnerArgument === '-' ? null : failureOwnerArgument;
if (failureOwner !== null && !/^[A-Za-z0-9:._-]{1,160}$/.test(failureOwner)) {
  throw new Error('TER_ADMIN_DISPLAY_FAILURE_OWNER_INVALID');
}
const scenarioScopeProblem = webScenarioScopeError({integrationName, webScenario, surfaceForm, failureOwner});
if (scenarioScopeProblem !== null) throw new Error(scenarioScopeProblem);

const files = collectWebSourceFiles(root);
const sourceSnapshotBefore = Object.freeze({files, sha256: hashWebSourceFiles(root, files)});
ensureContainedWebDirectory(root, runtimeRoot);
const runRoot = path.join(runtimeRoot, runId);
try {
  fs.lstatSync(runRoot);
  throw new Error('TER_ADMIN_DISPLAY_RUN_ALREADY_EXISTS');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
fs.mkdirSync(runRoot, {mode: 0o700});
ensureContainedWebDirectory(root, runRoot);
const sourceSha256 = sourceSnapshotBefore.sha256;
const manifestPath = path.join(runRoot, 'run-manifest.json');
const logPath = path.join(runRoot, 'expo-web.log');
const captureWebLogCheckpoint = () => createWebLogCheckpoint(fs.readFileSync(logPath));
const screenshotPath = path.join(runRoot, 'admin-runtime.png');
const manifest = {
  runId,
  startedAt: new Date().toISOString(),
  phase: 'PREFLIGHT',
  sourceSha256,
  sourceFiles: files,
  sourceSha256After: null,
  sourceStable: 'NOT_CHECKED',
  webUrl: (() => {
    const url = new URL(`http://127.0.0.1:${port}/?surfaceForm=${surfaceForm}`);
    if (failureOwner !== null) url.searchParams.set('terFailureOwner', failureOwner);
    return url.toString();
  })(),
  failureOwner,
  webScenario,
  integrationName,
  surfaceForm,
  ...(managedDev === null
    ? {}
    : {
        managedDevRunId: managedDev.runId,
        managedDevManifestSha256: createHash('sha256').update(managedDevManifestBytes).digest('hex'),
        managedGroupWorkspaceUrl,
        managedTdsEntryOneWebSocketBaseUrl: managedServerOverrides.tdsEntryOneWebSocketBaseUrl,
        managedTdsEntryTwoWebSocketBaseUrl: managedServerOverrides.tdsEntryTwoWebSocketBaseUrl,
        ...(managedActivationFixture === null ? {} : {managedActivationFixture: managedActivationFixture.key}),
        ...(managedActivationFixtureState === null
          ? {}
          : {
              managedActivationFixtureReadback: {
                terminalStatus: managedActivationFixtureState.terminalStatus,
                bindingStatus: managedActivationFixtureState.bindingStatus,
                generation: managedActivationFixtureState.generation,
              },
            }),
        ...(managedActivationDeviceId === null ? {} : {managedActivationDeviceId}),
      }),
  process: null,
  business: 'NOT_RUN',
  cleanup: 'NOT_RUN',
  firstFailure: null,
};
const save = () => fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
save();
const observedBusinessAssertionIds = new Set();
const recordBusinessAssertion = id => {
  if (observedBusinessAssertionIds.has(id)) throw new Error(`WEB_BUSINESS_ASSERTION_REPEATED:${id}`);
  observedBusinessAssertionIds.add(id);
  manifest.businessAssertionIds = [...observedBusinessAssertionIds];
  save();
};
const completeWebBusinessAssertions = () => {
  const expected = expectedWebBusinessAssertionIds({webScenario, integrationName, surfaceForm});
  const observed = [...observedBusinessAssertionIds];
  if (!webBusinessAssertionSetMatches(expected, observed)) {
    throw new Error(`WEB_BUSINESS_ASSERTION_SET_MISMATCH:${JSON.stringify({expected, observed})}`);
  }
  manifest.businessAssertionIds = observed;
};
const recordWebScenarioStep = (name, details = {}) => {
  manifest.scenarioStep = {name, at: new Date().toISOString(), ...details};
  save();
};
const waitForMatchedHeartbeatRttReadback = async ({page: activePage, logPath: activeLogPath, startedAt}) => {
  const deadline = Date.now() + 40_000;
  let latestObservation = null;
  while (Date.now() < deadline) {
    const finishedAt = new Date().toISOString();
    const events = parseJsonEventsAfterByteOffset(fs.readFileSync(activeLogPath), 0);
    const matched = projectTerminalConnectionHeartbeatLogEvents(events, startedAt, finishedAt);
    const displayText = (
      await activePage
        .getByTestId('terminal.activation.admin:latency')
        .innerText()
        .catch(() => '')
    ).trim();
    const mismatch = displayedHeartbeatRttMismatch(displayText, matched);
    if (mismatch === null) return Object.freeze({displayText, matchedHeartbeat: matched.at(-1)});
    latestObservation = {mismatch, displayText, matchedHeartbeat: matched.at(-1) ?? null};
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const error = new Error('WEB_TERMINAL_HEARTBEAT_RTT_SELECTOR_MISMATCH');
  error.diagnostic = latestObservation;
  throw error;
};

let expo = null;
let expoSpawned = false;
let expoLog = null;
let expoLogError = null;
let browser = null;
let page = null;
let webRunLockFd = null;
let currentProcessIdentity = null;
const pageErrorNames = [];
const browserConsoleFailures = [];
const managedHttpResults = [];
const managedHttpRequests = [];
const managedHttpFailures = [];
const managedHttpTransfers = [];
const managedWebSocketPaths = [];
let managedActivationSucceeded = false;
let managedActivationAttempted = false;
let managedActivationRejectedExpected = false;
let managedActivationCancelled = false;
let managedActivationCancellationOutcome = null;
let managedCancellationAttempted = false;
let cleanupManagedActivation = null;
let cleanupManagedServerConfig = null;
let managedServerConfigDirty = false;
const scenarioCleanupFailures = [];
const waitForLauncherGeometryAfter = async (filePath, checkpoint, targetViewport, timeoutMs, displayMode = null) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const events = parseJsonEventsAfterByteOffset(fs.readFileSync(filePath), checkpoint);
    const measured = events.find(
      event =>
        isExpectedRuntimeLogEvent(event, 'admin.launcher-geometry-measured') &&
        (displayMode === null || event.data?.displayMode === displayMode) &&
        event.data?.windowDimensions?.width === targetViewport.width &&
        event.data?.windowDimensions?.height === targetViewport.height,
    );
    if (measured !== undefined) return measured;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`WEB_LAUNCHER_GEOMETRY_DID_NOT_MATCH_VIEWPORT:${targetViewport.width}x${targetViewport.height}`);
};
const waitForLogEvent = async (filePath, event, checkpoint, timeoutMs, predicate = () => true) => {
  recordWebScenarioStep('WAITING_FOR_LOG_EVENT', {expectedLogEvent: event, timeoutMs, checkpoint});
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let lastRead = null;
  while (Date.now() < deadline) {
    const bytes = fs.readFileSync(filePath);
    const events = parseJsonEventsAfterByteOffset(bytes, checkpoint);
    const matched = events.find(value => isExpectedRuntimeLogEvent(value, event) && predicate(value));
    if (matched !== undefined) {
      manifest.lastWebEventWait = {
        event,
        status: 'MATCHED',
        elapsedMs: Date.now() - startedAt,
        checkpointByteOffset: checkpoint.byteOffset,
        observedEventCount: events.length,
      };
      save();
      return matched;
    }
    lastRead = {
      byteLength: bytes.length,
      parsedEventCount: events.length,
      expectedOwnerEventCount: events.filter(value => isExpectedRuntimeLogEvent(value, event)).length,
      latestEventTimestamp: events.at(-1)?.timestamp ?? null,
      observedAtEpochMillis: Date.now(),
    };
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  recordWebScenarioStep('WAITING_FOR_LOG_EVENT', {
    expectedLogEvent: event,
    timeoutMs,
    checkpoint,
    elapsedMs: Date.now() - startedAt,
    lastRead,
  });
  manifest.lastWebEventWait = {
    event,
    status: 'MISSING',
    elapsedMs: Date.now() - startedAt,
    checkpointByteOffset: checkpoint.byteOffset,
    lastRead,
  };
  save();
  throw new Error(`WEB_EXPECTED_LOG_EVENT_MISSING:${event}`);
};
const currentAdminLauncherGeometry = async () => {
  const viewport = await page.evaluate(() => ({width: window.innerWidth, height: window.innerHeight}));
  const events = parseJsonEventsAfterByteOffset(fs.readFileSync(logPath), 0);
  const geometry = [...events]
    .reverse()
    .find(
      event =>
        isExpectedRuntimeLogEvent(event, 'admin.launcher-geometry-measured') &&
        event.data?.displayMode === 'PRIMARY' &&
        event.data?.windowDimensions?.width === viewport.width &&
        event.data?.windowDimensions?.height === viewport.height,
    );
  if (geometry === undefined) throw new Error('WEB_ADMIN_LAUNCHER_CURRENT_GEOMETRY_MISSING');
  return geometry;
};
const restorePrimarySurfaceOrigin = async () => {
  const initialScroll = await page.evaluate(() => ({x: window.scrollX, y: window.scrollY}));
  const root = page.getByTestId(`${integrationName}:test-expo:root`);
  const scrollablePositions = () =>
    root.evaluate(element => {
      const candidates = [element, ...element.querySelectorAll('*')];
      return candidates.flatMap(node => {
        const style = getComputedStyle(node);
        if (
          style.overflowX !== 'auto' &&
          style.overflowX !== 'scroll' &&
          style.overflowY !== 'auto' &&
          style.overflowY !== 'scroll'
        )
          return [];
        return [
          {
            testId: node.getAttribute('data-testid'),
            tagName: node.tagName,
            left: node.scrollLeft,
            top: node.scrollTop,
          },
        ];
      });
    });
  const scrollBefore = await scrollablePositions();
  await root.evaluate(element => {
    for (const node of [element, ...element.querySelectorAll('*')]) {
      const style = getComputedStyle(node);
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') node.scrollLeft = 0;
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') node.scrollTop = 0;
    }
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await root.evaluate(
    node => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))),
  );
  const restoredScroll = await page.evaluate(() => ({x: window.scrollX, y: window.scrollY}));
  const scrollAfter = await scrollablePositions();
  manifest.adminLauncherViewportRestore = {
    initialScroll,
    restoredScroll,
    scrollBefore,
    scrollAfter,
    at: new Date().toISOString(),
  };
  save();
  recordWebScenarioStep('ADMIN_PRIMARY_SURFACE_ORIGIN_RESTORED', {
    initialScroll,
    restoredScroll,
    scrollBefore,
    scrollAfter,
  });
  if (
    restoredScroll.x !== 0 ||
    restoredScroll.y !== 0 ||
    scrollAfter.some(position => position.left !== 0 || position.top !== 0)
  ) {
    throw new Error(
      `WEB_PRIMARY_SURFACE_ORIGIN_NOT_RESTORED:${JSON.stringify({
        initialScroll,
        restoredScroll,
        scrollBefore,
        scrollAfter,
      })}`,
    );
  }
};
const openAdminConsoleFromLauncher = async () => {
  await restorePrimarySurfaceOrigin();
  const geometry = await currentAdminLauncherGeometry();
  const bindingEvents = parseJsonEventsAfterByteOffset(fs.readFileSync(logPath), 0).filter(
    event => isExpectedRuntimeLogEvent(event, 'admin.launcher-binding') && event.data?.displayMode === 'PRIMARY',
  );
  const latestBinding = bindingEvents.at(-1);
  if (latestBinding === undefined || !adminLauncherBindingReady(latestBinding, 'PRIMARY')) {
    const bindingLogOffset = captureWebLogCheckpoint();
    await waitForLogEvent(logPath, 'admin.launcher-binding', bindingLogOffset, 2_000, event =>
      adminLauncherBindingReady(event, 'PRIMARY'),
    );
  }
  const point = adminLauncherGesturePagePoint(geometry);
  const primarySurface = page.getByTestId(surfaceTestIdPrefix);
  const launcher = primarySurface.getByTestId('terminal.admin:launcher');
  const locatorCount = await launcher.count();
  const surfaceBounds = await primarySurface.boundingBox();
  const bounds = await launcher.boundingBox();
  const measuredWindowRect = geometry.data.windowRect;
  const geometryMatchesSurface =
    surfaceBounds !== null &&
    Math.abs(measuredWindowRect.x - surfaceBounds.x) <= 1 &&
    Math.abs(measuredWindowRect.y - surfaceBounds.y) <= 1 &&
    Math.abs(measuredWindowRect.width - surfaceBounds.width) <= 1 &&
    Math.abs(measuredWindowRect.height - surfaceBounds.height) <= 1;
  manifest.adminLauncherTarget = {
    displayMode: geometry.data.displayMode,
    point,
    locatorCount,
    geometryMatchesSurface,
    measuredWindowRect,
    surfaceBounds,
    launcherBounds: bounds,
  };
  if (
    locatorCount !== 1 ||
    !geometryMatchesSurface ||
    bounds === null ||
    point.x < bounds.x ||
    point.x > bounds.x + bounds.width ||
    point.y < bounds.y ||
    point.y > bounds.y + bounds.height
  ) {
    throw new Error(
      `WEB_PRIMARY_ADMIN_LAUNCHER_TARGET_OUTSIDE_PRIMARY_SURFACE:${JSON.stringify(manifest.adminLauncherTarget)}`,
    );
  }
  const launcherLogOffset = captureWebLogCheckpoint();
  const gestureStartedAt = Date.now();
  for (let click = 0; click < 5; click += 1) {
    await page.mouse.click(point.x, point.y);
  }
  manifest.adminLauncherGestureDispatch = {
    displayMode: 'PRIMARY',
    eventCount: 5,
    elapsedMs: Date.now() - gestureStartedAt,
    pagePoint: point,
  };
  save();
  await waitForLogEvent(
    logPath,
    'admin.launcher-open-requested',
    launcherLogOffset,
    2_000,
    event => event.data?.displayMode === 'PRIMARY',
  );
  const openResult = await waitForLogEvent(
    logPath,
    'admin.launcher-open-result',
    launcherLogOffset,
    2_000,
    event => event.data?.displayMode === 'PRIMARY',
  );
  if (openResult.data?.status !== 'completed') throw new Error('WEB_ADMIN_LAUNCHER_OPEN_NOT_COMPLETED');
};
const observeAdminLauncherAfterFailure = async failureNotice => {
  const events = parseJsonEventsAfterByteOffset(fs.readFileSync(logPath), 0);
  const latestPrimaryLayerSelection = [...events]
    .reverse()
    .find(event => isExpectedRuntimeLogEvent(event, 'render.layer-selection') && event.data?.displayMode === 'PRIMARY');
  if (latestPrimaryLayerSelection === undefined || !Array.isArray(latestPrimaryLayerSelection.data?.layerIds)) {
    return Object.freeze({
      status: 'OPEN',
      openRequests: 0,
      completedResults: 0,
      reason: 'WEB_PRIMARY_LAYER_SELECTION_READBACK_MISSING',
    });
  }
  const adminLayerMounted = latestPrimaryLayerSelection.data.layerIds.includes('admin.console.layer');
  if (adminLayerMounted) {
    await failureNotice.waitFor({state: 'visible', timeout: 5_000});
    return classifyAdminLauncherFailureRecoveryLog(events.map(value => JSON.stringify(value)).join('\n'), {
      adminLayerMounted,
      failureOwner,
    });
  }
  const logOffset = captureWebLogCheckpoint();
  await openAdminConsoleFromLauncher();
  await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
  await failureNotice.waitFor({state: 'visible', timeout: 5_000});
  return classifyAdminLauncherFailureRecoveryLog(
    parseJsonEventsAfterByteOffset(fs.readFileSync(logPath), logOffset)
      .map(value => JSON.stringify(value))
      .join('\n'),
    {failureOwner},
  );
};
try {
  currentProcessIdentity = readProcessTable().find(entry => entry.pid === process.pid);
  if (!currentProcessIdentity) throw new Error('WEB_RUNNER_PROCESS_IDENTITY_READBACK_FAILED');
  webRunLockFd = acquireManagedWebRunLock(path.join(runtimeRoot, 'web-run.lock'), runId, {
    pid: currentProcessIdentity.pid,
    startToken: currentProcessIdentity.startToken,
  });
  manifest.runnerProcess = {
    pid: currentProcessIdentity.pid,
    startToken: currentProcessIdentity.startToken,
  };
  manifest.runLock = 'ACQUIRED';
  save();

  const budget = spawnSync(
    path.join(root, 'scripts/env/check-runtime-resource-budget'),
    ['--profile', 'ter-validation-with-dev', path.join(root, '.runtime')],
    {cwd: root, encoding: 'utf8'},
  );
  fs.writeFileSync(
    path.join(runRoot, 'resource-preflight.log'),
    `${budget.stdout ?? ''}${budget.stderr ?? ''}${budget.error ? `spawnError=${budget.error.code ?? budget.error.name}\n` : ''}`,
    {
      mode: 0o600,
    },
  );
  if (budget.error) throw new Error(`RESOURCE_PREFLIGHT_SPAWN_FAILED:${budget.error.code ?? budget.error.name}`);
  if (budget.status !== 0) throw new Error(`RESOURCE_PREFLIGHT_FAILED:${budget.status}`);

  if (managedDev !== null) {
    const host = managedDev.remoteHostTrust.host;
    const java = remoteJavaReadiness(host, managedDev.remoteJava);
    const javaIdentityMatches =
      java.pid === managedDev.remoteJava.pid &&
      java.pgid === managedDev.remoteJava.pgid &&
      java.bootId === managedDev.remoteJava.bootId &&
      java.processStartTicks === managedDev.remoteJava.processStartTicks &&
      java.commandSha256 === managedDev.remoteJava.commandSha256;
    if (!javaIdentityMatches || !java.readyMarkerSeen || !java.listenerReady)
      throw new Error('WEB_MANAGED_DEV_JAVA_READINESS_IDENTITY_MISMATCH');
    const tds = managedDev.remoteTdsNodes.map(control => remoteTdsReadiness(host, control));
    if (tds.length !== 3 || tds.some(value => value.readyMarkerSeen !== true || value.listenerReady !== true))
      throw new Error('WEB_MANAGED_DEV_TDS_READINESS_FAILED');
    const ingress = await remoteHaproxyIngressReadiness(host, managedDev.remoteHaproxy, managedDev.remoteTdsNodes);
    if (ingress.status !== 'PASS') throw new Error('WEB_MANAGED_DEV_HAPROXY_READINESS_FAILED');
    manifest.managedDevReadiness = {
      runId: managedDev.runId,
      business: {status: 'PASS', pid: java.pid, bootId: java.bootId, startTicks: java.processStartTicks},
      tds: tds.map(value => ({status: 'PASS', nodeId: value.nodeId, pid: value.pid, port: value.websocketPort})),
      ingress: {status: ingress.status, tdsReadinessCount: ingress.tdsReadinessCount},
    };
    fs.writeFileSync(
      path.join(runRoot, 'managed-dev-preflight.json'),
      `${JSON.stringify(manifest.managedDevReadiness, null, 2)}\n`,
      {mode: 0o600},
    );
    save();
  }

  const listenerPreflight = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (listenerPreflight.error) {
    manifest.portPreflight = {
      status: 'ERROR',
      errorCode: listenerPreflight.error.code ?? listenerPreflight.error.name,
    };
    save();
    throw new Error(
      `WEB_PORT_LISTENER_PREFLIGHT_SPAWN_FAILED:${listenerPreflight.error.code ?? listenerPreflight.error.name}`,
    );
  }
  const occupiedListenerPids = parseListeningProcessIds(
    listenerPreflight.stdout,
    listenerPreflight.status,
    listenerPreflight.stderr,
  );
  manifest.portPreflight = {
    status: occupiedListenerPids.length === 0 ? 'PASS' : 'FAIL',
    listenerPids: occupiedListenerPids,
    exitCode: listenerPreflight.status,
    stderr: String(listenerPreflight.stderr ?? '').trim().length > 0 ? 'NON_EMPTY_STDERR' : '',
  };
  fs.writeFileSync(path.join(runRoot, 'port-preflight.json'), `${JSON.stringify(manifest.portPreflight)}\n`, {
    mode: 0o600,
  });
  save();
  if (occupiedListenerPids.length > 0) throw new Error('WEB_PORT_ALREADY_IN_USE');

  expoLog = fs.createWriteStream(logPath, {flags: 'wx', mode: 0o600});
  expoLog.on('error', error => {
    expoLogError = error;
  });
  const expoEnvironment =
    managedGroupWorkspaceUrl === null
      ? process.env
      : {
          ...process.env,
          EXPO_PUBLIC_TER_MANAGED_GROUP_WORKSPACE_BASE_URL: managedGroupWorkspaceUrl,
          EXPO_PUBLIC_TER_MANAGED_TDS_ENTRY_ONE_WS_URL: managedServerOverrides.tdsEntryOneWebSocketBaseUrl,
          EXPO_PUBLIC_TER_MANAGED_TDS_ENTRY_TWO_WS_URL: managedServerOverrides.tdsEntryTwoWebSocketBaseUrl,
          ...(managedActivationDeviceId === null ? {} : {EXPO_PUBLIC_TER_MANAGED_DEVICE_ID: managedActivationDeviceId}),
        };
  const expoLaunch = createExpoWebLaunchSpec(integrationRoot, port, expoEnvironment);
  expo = spawn(expoLaunch.command, expoLaunch.args, expoLaunch.options);
  const expoSpawnError = await awaitManagedChildSpawn(expo);
  if (expoSpawnError !== null) {
    throw new Error(`EXPO_SPAWN_FAILED:${expoSpawnError.code ?? expoSpawnError.name}`);
  }
  expoSpawned = true;
  manifest.spawnedProcessPid = expo.pid;
  pipeExpoOutput(expo.stdout, expo.stderr, expoLog);
  const processTable = readProcessTable();
  const identity = processTable.find(process => process.pid === expo.pid);
  if (!identity) {
    manifest.processIdentityCandidates = processTable
      .filter(process => process.pid === expo.pid || process.pgid === expo.pid)
      .map(({pid, ppid, pgid, startToken, commandSha256}) => ({pid, ppid, pgid, startToken, commandSha256}));
    throw new Error('EXPO_PROCESS_IDENTITY_READBACK_FAILED');
  }
  manifest.process = {
    pid: identity.pid,
    pgid: identity.pgid,
    startToken: identity.startToken,
    commandSha256: identity.commandSha256,
    logPath: path.relative(root, logPath),
  };
  manifest.phase = 'WEB_STARTING';
  save();

  let ready = false;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (expo.exitCode !== null) throw new Error(`EXPO_EXITED:${expo.exitCode}`);
    let response;
    try {
      response = await fetchExpoWebReadiness(fetch, `http://127.0.0.1:${port}/`);
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
      continue;
    }
    if (response.ok) {
      const listenerReadback = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
        cwd: root,
        encoding: 'utf8',
      });
      if (listenerReadback.error) {
        manifest.portReadback = {
          status: 'ERROR',
          errorCode: listenerReadback.error.code ?? listenerReadback.error.name,
        };
        save();
        throw new Error(
          `WEB_PORT_LISTENER_READBACK_SPAWN_FAILED:${listenerReadback.error.code ?? listenerReadback.error.name}`,
        );
      }
      const ownedProcessTree = snapshotProcessTree({
        pid: manifest.process.pid,
        pgid: manifest.process.pgid,
        startToken: manifest.process.startToken,
      });
      let listenerPids;
      try {
        listenerPids = verifyExpoWebListenerOwnership({
          stdout: listenerReadback.stdout,
          status: listenerReadback.status,
          stderr: listenerReadback.stderr,
          ownedProcessTree,
        });
      } catch (error) {
        manifest.portReadback = {
          status: 'FAIL',
          exitCode: listenerReadback.status,
          processTreePids: ownedProcessTree
            .filter(process => process.ownershipUnverified !== true)
            .map(process => process.pid),
          failure: projectWebFailureDiagnostic(error, 'PORT_READBACK').failureCode,
          failureDetails: projectWebFailureDiagnostic(error, 'PORT_READBACK'),
        };
        fs.writeFileSync(path.join(runRoot, 'port-readback.json'), `${JSON.stringify(manifest.portReadback)}\n`, {
          mode: 0o600,
        });
        save();
        throw error;
      }
      manifest.portReadback = {
        status: 'PASS',
        listenerPids,
        processTreePids: ownedProcessTree
          .filter(process => process.ownershipUnverified !== true)
          .map(process => process.pid),
        exitCode: listenerReadback.status,
        stderr: String(listenerReadback.stderr ?? '').trim().length > 0 ? 'NON_EMPTY_STDERR' : '',
      };
      fs.writeFileSync(path.join(runRoot, 'port-readback.json'), `${JSON.stringify(manifest.portReadback)}\n`, {
        mode: 0o600,
      });
      manifest.webListenerPids = listenerPids;
      manifest.webListenerOwned = 'PASS';
      save();
      ready = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('EXPO_WEB_READINESS_TIMEOUT');

  manifest.phase = 'WEB_SCENARIO';
  save();
  browser = await chromium.launch({headless: true});
  page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  page.on('pageerror', error => pageErrorNames.push(projectWebFailureDiagnostic(error, 'BROWSER_PAGE').errorType));
  page.on('console', message => {
    if (message.type() !== 'error' && message.type() !== 'warning') return;
    browserConsoleFailures.push({
      at: new Date().toISOString(),
      level: message.type(),
      classification: classifyBrowserConsoleFailure(message.text()),
    });
  });
  const managedOperationForPath = pathname => {
    if (managedGroupWorkspacePath !== null && pathname === `${managedGroupWorkspacePath}/activation`)
      return 'activation';
    if (
      managedGroupWorkspacePath !== null &&
      pathname.startsWith(`${managedGroupWorkspacePath}/terminals/`) &&
      /\/activation\/cancel$/u.test(pathname)
    )
      return 'cancel-activation';
    return pathname.startsWith(`/${['api', 'terminal'].join('/')}/`) ? 'other-terminal-api' : null;
  };
  page.on('request', request => {
    try {
      const url = new URL(request.url());
      const operation = managedOperationForPath(url.pathname);
      if (operation === null) return;
      if (operation === 'activation' && request.method() === 'POST') managedActivationAttempted = true;
      const headers = request.headers();
      const safeId = value => (typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/u.test(value) ? value : null);
      managedHttpRequests.push({
        at: new Date().toISOString(),
        operation,
        method: request.method(),
        requestId: safeId(headers['x-request-id']),
        correlationId: safeId(headers['x-correlation-id']),
      });
    } catch {
      // Do not retain raw request URLs or payloads in run evidence.
    }
  });
  page.on('requestfailed', request => {
    try {
      const url = new URL(request.url());
      const operation = managedOperationForPath(url.pathname);
      if (operation === null) return;
      const errorText = request.failure()?.errorText ?? '';
      const chromiumCode = errorText.match(/ERR_[A-Z0-9_]+/u)?.[0] ?? 'REQUEST_FAILED';
      managedHttpFailures.push({at: new Date().toISOString(), operation, method: request.method(), code: chromiumCode});
    } catch {
      // Never retain request URLs, headers, or payloads while recording network failures.
    }
  });
  page.on('requestfinished', request => {
    try {
      const url = new URL(request.url());
      const operation = managedOperationForPath(url.pathname);
      if (operation !== null)
        managedHttpTransfers.push({
          at: new Date().toISOString(),
          operation,
          method: request.method(),
          outcome: 'body-complete',
        });
    } catch {
      // The classified operation record is optional for malformed unrelated URLs.
    }
  });
  page.on('response', response => {
    try {
      const url = new URL(response.url());
      const operation = managedOperationForPath(url.pathname);
      if (operation !== null) {
        const headers = response.headers();
        const safeId = value => (typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/u.test(value) ? value : null);
        managedHttpResults.push({
          at: new Date().toISOString(),
          operation,
          method: response.request().method(),
          status: response.status(),
          requestId: safeId(headers['x-request-id']),
          correlationId: safeId(headers['x-correlation-id']),
        });
      }
    } catch {
      // A malformed unrelated URL is not part of the observed business contract.
    }
  });
  page.on('websocket', socket => {
    try {
      const url = new URL(socket.url());
      managedWebSocketPaths.push({
        loopback: url.hostname === '127.0.0.1',
        pathMatchesTdsContract: /^\/tdp\/[^/]+\/ws$/.test(url.pathname),
      });
    } catch {
      managedWebSocketPaths.push({loopback: false, pathMatchesTdsContract: false});
    }
  });
  const initialGeometryLogOffset = captureWebLogCheckpoint();
  await page.goto(manifest.webUrl, {waitUntil: 'networkidle', timeout: 60_000});

  const launcher = page.getByTestId('terminal.admin:launcher');
  await launcher.waitFor({state: 'visible', timeout: 30_000});
  const bounds = await page.getByTestId(surfaceTestIdPrefix).boundingBox();
  if (bounds === null) throw new Error('ADMIN_LAUNCHER_BOUNDS_UNAVAILABLE');
  await waitForLauncherGeometryAfter(logPath, initialGeometryLogOffset, {width: 1440, height: 1000}, 10_000);
  if (webScenario === 'screen-error-member-journey') {
    const allowedFailureOwners = new Set([
      'screen:main:sample.desk.member-list',
      'screen:main:sample.desk.member-form',
    ]);
    if (integrationName !== 'sample-console' || failureOwner === null || !allowedFailureOwners.has(failureOwner)) {
      throw new Error('WEB_SCREEN_ERROR_MEMBER_JOURNEY_SCOPE_INVALID');
    }
    const tapKey = async (keyId, testIDSuffix = '') => {
      await page.getByTestId(`ui.base.input:virtual-keyboard:${keyId}${testIDSuffix}`).click({timeout: 5_000});
    };
    const operatorName = page.getByTestId('sample.auth.login:operator-name');
    const passcode = page.getByTestId('sample.auth.login:passcode');
    await operatorName.click();
    await tapKey('shift');
    await tapKey('text-a');
    for (const digit of '001') await tapKey(`text-${digit}`);
    if ((await operatorName.inputValue()) !== 'A001') throw new Error('WEB_SCREEN_ERROR_LOGIN_NAME_MISMATCH');
    await passcode.click();
    for (const digit of '1111') await tapKey(`text-${digit}`);
    if ((await passcode.inputValue()) !== '1111') throw new Error('WEB_SCREEN_ERROR_PASSCODE_MISMATCH');
    await page.getByTestId('sample.auth.login:submit').click();

    if (failureOwner === 'screen:main:sample.desk.member-form') {
      await page.getByTestId('sample.desk.member-list:empty-action').waitFor({state: 'visible', timeout: 15_000});
      await page.getByTestId('sample.desk.member-list:empty-action').click();
    }

    const failureNotice = page.getByTestId(`ui-base-render:system-failure:${failureOwner}`);
    const dismissButton = page.getByTestId(`ui-base-render:system-failure:${failureOwner}:dismiss`);
    await failureNotice.waitFor({state: 'visible', timeout: 10_000});
    if ((await page.getByText('知道了', {exact: true}).count()) !== 1) {
      throw new Error('WEB_SCREEN_ERROR_NOTICE_BUTTON_COUNT_MISMATCH');
    }
    const resetLogOffset = captureWebLogCheckpoint();
    await dismissButton.click();
    await waitForLogEvent(
      logPath,
      'runtime.system-failure.reset-unavailable',
      resetLogOffset,
      10_000,
      event => event.data?.portStatus === 'unavailable',
    );
    await failureNotice.waitFor({state: 'visible', timeout: 5_000});
    const launcherRecovery = await observeAdminLauncherAfterFailure(failureNotice);
    if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
    manifest.webObserved = {
      failureOwner,
      route: 'production-staff-login-to-member-screen',
      noticeButtonCount: 1,
      resetUnavailableLogged: true,
      adminLauncherRemainedUsable: launcherRecovery,
    };
    manifest.pageErrorNames = pageErrorNames;
    manifest.browserConsoleFailures = browserConsoleFailures;
    await page.screenshot({path: screenshotPath, fullPage: true});
    manifest.screenshotPath = path.relative(root, screenshotPath);
    manifest.business = launcherRecovery.status === 'PASS' ? 'PASS' : 'OPEN';
    if (launcherRecovery.status !== 'PASS') {
      manifest.openReason =
        launcherRecovery.reason ?? 'WEB_ADMIN_LAUNCHER_NOT_PROVEN_USABLE_AFTER_MEMBER_SCREEN_FAILURE';
    }
  } else if (webScenario === 'screen-error-secondary-journey') {
    const secondaryOwners = new Map([
      ['screen:main:sample.desk.customer-welcome', 'sample-console'],
      ['screen:main:sample.desk.customer-member', 'sample-console'],
      ['screen:main:sample.wallpaper-console.waiting', 'sample-wallpaper-console'],
      ['screen:main:sample.wallpaper-console.welcome', 'sample-wallpaper-console'],
    ]);
    if (failureOwner === null || secondaryOwners.get(failureOwner) !== integrationName || surfaceForm !== 'laptop') {
      throw new Error('WEB_SCREEN_ERROR_SECONDARY_JOURNEY_SCOPE_INVALID');
    }

    await page.getByTestId(`${integrationName}:test-expo:surface-mode:dual`).click();
    const secondarySurface = page.getByTestId(`${integrationName}:test-expo:surface:SECONDARY`);
    await secondarySurface.waitFor({state: 'visible', timeout: 10_000});

    const tapKey = async (keyId, testIDSuffix = '') => {
      await page.getByTestId(`ui.base.input:virtual-keyboard:${keyId}${testIDSuffix}`).click({timeout: 5_000});
    };
    const loginStaff = async () => {
      const operatorName = page.getByTestId('sample.auth.login:operator-name');
      await operatorName.click();
      await tapKey('shift');
      await tapKey('text-a');
      for (const digit of '001') await tapKey(`text-${digit}`);
      const passcode = page.getByTestId('sample.auth.login:passcode');
      await passcode.click();
      for (const digit of '1111') await tapKey(`text-${digit}`);
      if ((await operatorName.inputValue()) !== 'A001' || (await passcode.inputValue()) !== '1111') {
        throw new Error('WEB_SCREEN_ERROR_SECONDARY_LOGIN_INPUT_MISMATCH');
      }
      await page.getByTestId('sample.auth.login:submit').click();
    };

    if (failureOwner === 'screen:main:sample.desk.customer-member') {
      await loginStaff();
      await page.getByTestId('sample.desk.member-list:empty-action').click();
      const name = page.getByTestId('sample.desk.member-form:name');
      const phone = page.getByTestId('sample.desk.member-form:phone');
      await name.fill('W4 boundary probe');
      await phone.fill('13800000000');
      if ((await name.inputValue()) !== 'W4 boundary probe' || (await phone.inputValue()) !== '13800000000') {
        throw new Error('WEB_SCREEN_ERROR_SECONDARY_MEMBER_FORM_INPUT_MISMATCH');
      }
      await page.getByTestId('sample.desk.member-form:submit').click();
    } else if (
      failureOwner === 'screen:main:sample.desk.customer-welcome' ||
      failureOwner === 'screen:main:sample.wallpaper-console.welcome'
    ) {
      await loginStaff();
    }

    const failureNotice = page.getByTestId(`ui-base-render:system-failure:${failureOwner}`);
    const dismissButton = page.getByTestId(`ui-base-render:system-failure:${failureOwner}:dismiss`);
    await failureNotice.waitFor({state: 'visible', timeout: 15_000});
    if ((await page.getByText('知道了', {exact: true}).count()) !== 1) {
      throw new Error('WEB_SCREEN_ERROR_SECONDARY_NOTICE_BUTTON_COUNT_MISMATCH');
    }
    const resetLogOffset = captureWebLogCheckpoint();
    await dismissButton.click();
    await waitForLogEvent(
      logPath,
      'runtime.system-failure.reset-unavailable',
      resetLogOffset,
      10_000,
      event => event.data?.portStatus === 'unavailable',
    );
    await failureNotice.waitFor({state: 'visible', timeout: 5_000});
    await page.getByTestId(`${integrationName}:test-expo:root`).evaluate(root => {
      for (const element of root.querySelectorAll('*')) {
        const style = getComputedStyle(element);
        if (style.overflowX === 'auto' || style.overflowX === 'scroll') element.scrollLeft = 0;
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') element.scrollTop = 0;
      }
      window.scrollTo(0, 0);
    });
    await page.waitForFunction(
      () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))),
    );
    const primaryBoundsAfterSecondaryNotice = await page.getByTestId(surfaceTestIdPrefix).boundingBox();
    if (primaryBoundsAfterSecondaryNotice === null) throw new Error('WEB_SECONDARY_SCREEN_PRIMARY_BOUNDS_UNAVAILABLE');
    if (
      Math.abs(primaryBoundsAfterSecondaryNotice.x - bounds.x) > 1 ||
      Math.abs(primaryBoundsAfterSecondaryNotice.y - bounds.y) > 1 ||
      Math.abs(primaryBoundsAfterSecondaryNotice.width - bounds.width) > 1 ||
      Math.abs(primaryBoundsAfterSecondaryNotice.height - bounds.height) > 1
    ) {
      throw new Error('WEB_SECONDARY_SCREEN_PRIMARY_ORIGIN_NOT_RESTORED');
    }
    const launcherRecovery = await observeAdminLauncherAfterFailure(failureNotice);
    if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
    manifest.webObserved = {
      failureOwner,
      route: 'production-dual-preview-and-owner-specific-screen-journey',
      secondarySurfaceMounted: true,
      primaryReturnedToViewportAfterNotice: true,
      noticeButtonCount: 1,
      resetUnavailableLogged: true,
      primaryAdminLauncherRemainedUsable: launcherRecovery,
    };
    manifest.pageErrorNames = pageErrorNames;
    await page.screenshot({path: screenshotPath, fullPage: true});
    manifest.screenshotPath = path.relative(root, screenshotPath);
    manifest.business = launcherRecovery.status === 'PASS' ? 'PASS' : 'OPEN';
    if (launcherRecovery.status !== 'PASS') {
      manifest.openReason =
        launcherRecovery.reason ?? 'WEB_ADMIN_LAUNCHER_NOT_PROVEN_USABLE_AFTER_SECONDARY_SCREEN_FAILURE';
    }
  } else if (webScenario === 'layer-error-production-journey') {
    const target = failureOwner === null ? undefined : WEB_LAYER_OWNER_COVERAGE[failureOwner];
    if (
      target === undefined ||
      (target.integrations !== 'both' && target.integrations !== integrationName) ||
      target.status !== 'WEB_REACHABLE' ||
      !target.surfaceForms.includes(surfaceForm) ||
      target.journey === null
    ) {
      throw new Error('WEB_LAYER_ERROR_PRODUCTION_JOURNEY_SCOPE_INVALID');
    }
    const tapKey = async (keyId, testIDSuffix = '') => {
      await page.getByTestId(`ui.base.input:virtual-keyboard:${keyId}${testIDSuffix}`).click({timeout: 5_000});
    };
    const loginStaff = async accepted => {
      const operatorName = page.getByTestId('sample.auth.login:operator-name');
      await operatorName.click();
      await tapKey('shift');
      await tapKey('text-a');
      for (const digit of '001') await tapKey(`text-${digit}`);
      const passcode = page.getByTestId('sample.auth.login:passcode');
      await passcode.click();
      for (const digit of accepted ? '1111' : '0000') await tapKey(`text-${digit}`);
      await page.getByTestId('sample.auth.login:submit').click();
    };
    const openDualPreview = async () => {
      await page.getByTestId(`${integrationName}:test-expo:surface-mode:dual`).click();
      await page
        .getByTestId(`${integrationName}:test-expo:surface:SECONDARY`)
        .waitFor({state: 'visible', timeout: 10_000});
    };
    const openMemberForm = async () => {
      await page.getByTestId('sample.desk.member-list:empty-action').click();
      await page.getByTestId('sample.desk.member-form:name').waitFor({state: 'visible', timeout: 10_000});
      await page.getByTestId('sample.desk.member-form:name').fill('W4 layer probe');
      await page.getByTestId('sample.desk.member-form:phone').fill('13800000000');
    };
    const currentPrimaryBounds = async () => {
      await page.getByTestId(`${integrationName}:test-expo:root`).evaluate(root => {
        for (const element of root.querySelectorAll('*')) {
          const style = getComputedStyle(element);
          if (style.overflowX === 'auto' || style.overflowX === 'scroll') element.scrollLeft = 0;
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') element.scrollTop = 0;
        }
        window.scrollTo(0, 0);
      });
      await page.waitForFunction(
        () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))),
      );
      const current = await page.getByTestId(surfaceTestIdPrefix).boundingBox();
      if (current === null) throw new Error('WEB_LAYER_ERROR_PRIMARY_BOUNDS_UNAVAILABLE');
      return current;
    };

    if (target.journey === 'admin-launcher') {
      await openAdminConsoleFromLauncher();
    } else if (target.journey === 'auth-business-failure') {
      await loginStaff(false);
    } else {
      if (target.requiresDualPreview === true) await openDualPreview();
      await loginStaff(true);
      if (target.journey === 'dirty-member-form-cancel') {
        await openMemberForm();
        await page.getByTestId('sample.desk.member-form:cancel').click();
      } else {
        await openMemberForm();
        await page.getByTestId('sample.desk.member-form:submit').click();
        if (target.journey === 'member-registration-rejected') {
          await page.getByTestId('sample.desk.customer-member:reject').waitFor({state: 'visible', timeout: 15_000});
          await page.getByTestId('sample.desk.customer-member:reject').click();
        } else if (target.journey === 'member-registration-withdraw') {
          await page.getByTestId('sample.desk.waiting-confirm').waitFor({state: 'visible', timeout: 15_000});
          await page.getByTestId('sample.desk.waiting-confirm:withdraw').click();
        }
      }
    }

    const failureNotice = page.getByTestId(`ui-base-render:system-failure:${failureOwner}`);
    const dismissButton = page.getByTestId(`ui-base-render:system-failure:${failureOwner}:dismiss`);
    await failureNotice.waitFor({state: 'visible', timeout: 15_000});
    if ((await page.getByText('知道了', {exact: true}).count()) !== 1) {
      throw new Error('WEB_LAYER_ERROR_NOTICE_BUTTON_COUNT_MISMATCH');
    }
    const resetLogOffset = captureWebLogCheckpoint();
    await dismissButton.click();
    await waitForLogEvent(
      logPath,
      'runtime.system-failure.reset-unavailable',
      resetLogOffset,
      10_000,
      event => event.data?.portStatus === 'unavailable',
    );
    await failureNotice.waitFor({state: 'visible', timeout: 5_000});
    const primaryBounds = await currentPrimaryBounds();
    const adminLauncherWhileFailure = await observeAdminLauncherAfterFailure(failureNotice);
    if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
    manifest.webObserved = {
      failureOwner,
      productionJourney: target.journey,
      noticeButtonCount: 1,
      resetUnavailableLogged: true,
      adminLauncherRemainedUsable: adminLauncherWhileFailure,
    };
    manifest.pageErrorNames = pageErrorNames;
    await page.screenshot({path: screenshotPath, fullPage: true});
    manifest.screenshotPath = path.relative(root, screenshotPath);
    if (adminLauncherWhileFailure.status === 'OPEN') {
      manifest.business = 'OPEN';
      manifest.openReason =
        adminLauncherWhileFailure.reason ?? 'WEB_ADMIN_LAUNCHER_NOT_PROVEN_USABLE_WHILE_ADMIN_LAYER_FAILURE_PERSISTS';
    } else {
      manifest.business = 'PASS';
    }
  } else if (
    webScenario === 'keyboard-member-journey' ||
    webScenario === 'keyboard-login' ||
    webScenario === 'keyboard-overlay-ownership' ||
    webScenario === 'textinput-contextmenu'
  ) {
    const correctIntegration =
      (webScenario === 'keyboard-member-journey' && integrationName === 'sample-console') ||
      (webScenario === 'keyboard-login' && integrationName === 'sample-wallpaper-console') ||
      (webScenario === 'keyboard-overlay-ownership' && integrationName === 'sample-console') ||
      webScenario === 'textinput-contextmenu';
    if (failureOwner !== null || !correctIntegration) {
      throw new Error('WEB_KEYBOARD_JOURNEY_SCOPE_INVALID');
    }
    const tapKey = async (keyId, testIDSuffix = '') => {
      await page.getByTestId(`ui.base.input:virtual-keyboard:${keyId}${testIDSuffix}`).click({timeout: 5_000});
    };
    const contextMenuObservations = [];
    const observeContextMenu = async testID => {
      const input = page.getByTestId(testID);
      await input.waitFor({state: 'visible', timeout: 10_000});
      for (const state of ['empty', 'existing-text']) {
        await input.fill(state === 'empty' ? '' : 'menu-probe');
        const defaultPrevented = await input.evaluate(element => {
          const event = new MouseEvent('contextmenu', {bubbles: true, cancelable: true, view: window});
          element.dispatchEvent(event);
          return event.defaultPrevented;
        });
        if (!defaultPrevented) throw new Error(`WEB_TEXTINPUT_CONTEXTMENU_NOT_PREVENTED:${testID}:${state}`);
        contextMenuObservations.push({testID, state, contextMenuPrevented: true});
      }
      await input.fill('');
    };
    const observeTopologyHostInput = async () => {
      if (surfaceForm === 'mobile') {
        await page.getByTestId('terminal.admin:navigation:trigger').click();
        await page.getByTestId('terminal.admin:navigation:option:admin.console.topology').click();
        await page.getByTestId('terminal.admin:topology:page-gate').waitFor({state: 'visible', timeout: 10_000});
        if ((await page.getByTestId('terminal.admin:topology:host').count()) !== 0) {
          throw new Error('WEB_MOBILE_TOPOLOGY_HOST_UNEXPECTEDLY_MOUNTED');
        }
        return {
          status: 'NOT_COVERED_BY_PRODUCT_CONSUMER',
          reason: 'mobile topology page is fail-closed and does not render the host input',
        };
      }
      await page.getByTestId('terminal.admin:section:topology').click();
      await observeContextMenu('terminal.admin:topology:host');
      return {status: 'PASS'};
    };
    const openAdminConsole = async () => {
      await openAdminConsoleFromLauncher();
      await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
      const pin = (await page.getByTestId('terminal.admin:debug-password').innerText()).match(/\d{6}/)?.[0];
      if (pin === undefined) throw new Error('WEB_ADMIN_DEBUG_PASSWORD_READBACK_MISSING');
      for (const digit of pin) await tapKey(`text-${digit}`);
      await page.getByTestId('terminal.admin:verify').click();
    };
    const observeAdditionalContextMenuTargets = async () => {
      let topologyHostInput;
      for (const testID of additionalTextInputContextMenuTargets({integrationName, surfaceForm})) {
        if (testID === 'terminal.admin:topology:host') {
          await openAdminConsole();
          topologyHostInput = await observeTopologyHostInput();
        } else {
          await observeContextMenu(testID);
        }
      }
      if (surfaceForm === 'mobile') topologyHostInput = await observeTopologyHostInput();
      return topologyHostInput;
    };
    const textInputWebObservations = topologyHostInput => ({
      clipboardPrecondition: 'NON_EMPTY',
      textInputCount: contextMenuObservations.length / 2,
      textInputObservations: contextMenuObservations,
      nonTextInputAdminPinSkipped: true,
      notReachedProductionConsumers: WEB_TEXTINPUT_CONTEXTMENU_UNREACHED_CONSUMERS.filter(
        consumer => consumer.integrationName === integrationName,
      ),
      ...(topologyHostInput === undefined ? {} : {topologyHostInput}),
      contextMenuPrevented: 'PASS',
      observationKind: 'RNW_CONTEXTMENU_EVENT',
    });
    if (webScenario === 'textinput-contextmenu') {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      const clipboardValue = await page.evaluate(async () => {
        await navigator.clipboard.writeText('TER-REMEDIATION-CLIPBOARD');
        return navigator.clipboard.readText();
      });
      if (clipboardValue !== 'TER-REMEDIATION-CLIPBOARD') {
        throw new Error('WEB_TEXTINPUT_CONTEXTMENU_CLIPBOARD_PRECONDITION_MISSING');
      }
      await observeContextMenu('sample.auth.login:operator-name');
      await observeContextMenu('sample.auth.login:passcode');
    }
    const operatorName = page.getByTestId('sample.auth.login:operator-name');
    const passcode = page.getByTestId('sample.auth.login:passcode');
    if (webScenario !== 'keyboard-overlay-ownership') {
      await operatorName.click();
      await tapKey('shift');
      await tapKey('text-a');
      for (const digit of '001') await tapKey(`text-${digit}`);
      if ((await operatorName.inputValue()) !== 'A001') throw new Error('WEB_KEYBOARD_OPERATOR_NAME_MISMATCH');
      manifest.keyboardJourney = {loginName: 'PASS'};
      save();

      await passcode.click();
      for (const digit of '1111') await tapKey(`text-${digit}`);
      if ((await passcode.inputValue()) !== '1111') throw new Error('WEB_KEYBOARD_PASSCODE_ENTRY_MISMATCH');
      manifest.keyboardJourney.passcodeEntry = 'PASS';
      save();
      await page.getByTestId('sample.auth.login:submit').click();
    }
    if (webScenario === 'keyboard-login') {
      await page.getByTestId('sample.wallpaper.picker').waitFor({state: 'visible', timeout: 15_000});
      manifest.keyboardJourney.wallpaperPickerReached = 'PASS';
      manifest.webObserved = {...manifest.keyboardJourney};
      manifest.pageErrorNames = pageErrorNames;
      if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
      await page.screenshot({path: screenshotPath, fullPage: true});
      manifest.screenshotPath = path.relative(root, screenshotPath);
      manifest.business = 'PASS';
    } else if (
      webScenario === 'keyboard-member-journey' ||
      (webScenario === 'textinput-contextmenu' && integrationName === 'sample-console')
    ) {
      const addMember = page.getByTestId('sample.desk.member-list:empty-action');
      await addMember.waitFor({state: 'visible', timeout: 15_000});
      await addMember.click();

      if (webScenario === 'textinput-contextmenu') {
        const topologyHostInput = await observeAdditionalContextMenuTargets();
        const observedTextInputCount = contextMenuObservations.length / 2;
        const expectedTextInputCount = expectedTextInputProbeCount({integrationName, surfaceForm});
        const probeMismatch = textInputProbeMismatch(
          contextMenuObservations,
          expectedTextInputProbeIds({integrationName, surfaceForm}),
        );
        if (observedTextInputCount !== expectedTextInputCount || probeMismatch !== null) {
          throw new Error(
            `WEB_TEXTINPUT_CONTEXTMENU_PROBE_MISMATCH:${probeMismatch ?? 'COUNT'}:${observedTextInputCount}:${expectedTextInputCount}`,
          );
        }
        manifest.webObserved = textInputWebObservations(topologyHostInput);
        manifest.pageErrorNames = pageErrorNames;
        if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
        await page.screenshot({path: screenshotPath, fullPage: true});
        manifest.screenshotPath = path.relative(root, screenshotPath);
        manifest.business = 'PASS';
      } else {
        const name = page.getByTestId('sample.desk.member-form:name');
        await name.waitFor({state: 'visible', timeout: 10_000});
        await name.click();
        await tapKey('text-x');
        const symbols = [':', '/', '.', '?', '&', '=', '-', '_', '%', '+'];
        for (const [index, symbol] of symbols.entries()) {
          const digit = '1234567890'[index];
          await tapKey('shift');
          const keyId = `ui.base.input:virtual-keyboard:text-${digit}`;
          const visibleLabel = await page.getByTestId(keyId).innerText();
          if (visibleLabel !== symbol) {
            throw new Error(`WEB_KEYBOARD_URL_SYMBOL_LABEL_MISMATCH:${index}:${JSON.stringify(visibleLabel)}`);
          }
          await tapKey(`text-${digit}`);
          if ((await name.inputValue()) !== `x${symbols.slice(0, index + 1).join('')}`) {
            throw new Error(`WEB_KEYBOARD_URL_SYMBOL_INSERTION_MISMATCH:${index}`);
          }
          manifest.keyboardJourney.urlSymbolsMatched = index + 1;
          save();
        }

        const alphaProbe = page.getByTestId('sample.desk.member-form:keyboard-alpha-probe');
        await alphaProbe.click();
        await tapKey('text-a');
        await tapKey('shift');
        await tapKey('text-b');
        await tapKey('space');
        await tapKey('text-c');
        if ((await alphaProbe.inputValue()) !== 'aB c') throw new Error('WEB_KEYBOARD_ALPHA_SHIFT_SPACE_MISMATCH');

        const financialProbe = page.getByTestId('sample.desk.member-form:keyboard-financial-probe');
        await financialProbe.click();
        await tapKey('text-1');
        await tapKey('text-.');
        await tapKey('text-2');
        if ((await financialProbe.inputValue()) !== '1.2') throw new Error('WEB_KEYBOARD_FINANCIAL_INSERTION_MISMATCH');
        for (let index = 0; index < 3; index += 1) await tapKey('backspace');
        for (const keyId of ['text--', 'text-1', 'text-.', 'text-2']) await tapKey(keyId);
        if ((await financialProbe.inputValue()) !== '-1.2') throw new Error('WEB_KEYBOARD_FINANCIAL_SIGN_MISMATCH');

        manifest.webObserved = {
          loginViaVirtualKeys: 'PASS',
          urlSymbolCount: symbols.length,
          urlSymbolLabelMatchesInsertedValues: 'PASS',
          alphaShiftAndSpaceInsertion: 'PASS',
          financialAsciiInsertion: 'PASS',
        };
        manifest.pageErrorNames = pageErrorNames;
        if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
        await page.screenshot({path: screenshotPath, fullPage: true});
        manifest.screenshotPath = path.relative(root, screenshotPath);
        manifest.business = 'PASS';
      }
    } else if (webScenario === 'textinput-contextmenu') {
      await page.getByTestId('sample.wallpaper.picker').waitFor({state: 'visible', timeout: 15_000});
      const topologyHostInput = await observeAdditionalContextMenuTargets();
      const observedTextInputCount = contextMenuObservations.length / 2;
      const expectedTextInputCount = expectedTextInputProbeCount({integrationName, surfaceForm});
      const probeMismatch = textInputProbeMismatch(
        contextMenuObservations,
        expectedTextInputProbeIds({integrationName, surfaceForm}),
      );
      if (observedTextInputCount !== expectedTextInputCount || probeMismatch !== null) {
        throw new Error(
          `WEB_TEXTINPUT_CONTEXTMENU_PROBE_MISMATCH:${probeMismatch ?? 'COUNT'}:${observedTextInputCount}:${expectedTextInputCount}`,
        );
      }
      manifest.webObserved = textInputWebObservations(topologyHostInput);
      manifest.pageErrorNames = pageErrorNames;
      if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
      await page.screenshot({path: screenshotPath, fullPage: true});
      manifest.screenshotPath = path.relative(root, screenshotPath);
      manifest.business = 'PASS';
    } else if (webScenario === 'keyboard-overlay-ownership') {
      if (surfaceForm === 'laptop') {
        await page.getByTestId(`${integrationName}:test-expo:surface-mode:single`).click();
      }
      await page.waitForFunction(
        () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))),
      );
      const launcherBounds = await page.getByTestId(surfaceTestIdPrefix).boundingBox();
      if (launcherBounds === null) throw new Error('WEB_OVERLAY_SINGLE_SURFACE_BOUNDS_UNAVAILABLE');
      const coveredOperator = page.getByTestId('sample.auth.login:operator-name');
      const coveredPasscode = page.getByTestId('sample.auth.login:passcode');
      const typeStaffLogin = async () => {
        const operatorName = page.getByTestId('sample.auth.login:operator-name');
        await operatorName.click();
        await tapKey('shift');
        await tapKey('text-a');
        for (const digit of '001') await tapKey(`text-${digit}`);
        const passcode = page.getByTestId('sample.auth.login:passcode');
        await passcode.click();
        for (const digit of '1111') await tapKey(`text-${digit}`);
        if ((await operatorName.inputValue()) !== 'A001' || (await passcode.inputValue()) !== '1111') {
          throw new Error('WEB_OVERLAY_PRECONDITION_STAFF_FIELDS_MISMATCH');
        }
      };
      await typeStaffLogin();
      await openAdminConsoleFromLauncher();
      await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
      const pin = (await page.getByTestId('terminal.admin:debug-password').innerText()).match(/\d{6}/)?.[0];
      if (pin === undefined) throw new Error('WEB_ADMIN_DEBUG_PASSWORD_READBACK_MISSING');
      for (const digit of pin) await tapKey(`text-${digit}`);
      await page.getByTestId('terminal.admin:verify').click();

      for (const input of [coveredOperator, coveredPasscode]) {
        const box = await input.boundingBox();
        if (box === null) throw new Error('WEB_OVERLAY_COVERED_INPUT_BOUNDS_UNAVAILABLE');
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await sendProtectedInputKeyboardProbe(page.keyboard);
      }
      if ((await coveredOperator.inputValue()) !== 'A001' || (await coveredPasscode.inputValue()) !== '1111') {
        throw new Error('WEB_OVERLAY_COVERED_STAFF_FIELD_ACCEPTED_WRITE');
      }

      let topologyHostAddressPositiveControl;
      if (surfaceForm === 'mobile') {
        await page.getByTestId('terminal.admin:navigation:trigger').click();
        await page.getByTestId('terminal.admin:navigation:option:admin.console.topology').click();
        await page.getByTestId('terminal.admin:topology:page-gate').waitFor({state: 'visible', timeout: 10_000});
        if ((await page.getByTestId('terminal.admin:topology:host').count()) !== 0) {
          throw new Error('WEB_MOBILE_TOPOLOGY_HOST_UNEXPECTEDLY_MOUNTED');
        }
        topologyHostAddressPositiveControl = 'NOT_COVERED_BY_PRODUCT_CONSUMER';
      } else {
        await page.getByTestId('terminal.admin:section:topology').click();
        const hostInput = page.getByTestId('terminal.admin:topology:host');
        await hostInput.waitFor({state: 'visible', timeout: 10_000});
        await hostInput.click();
        for (const key of ['text-1', 'text-9', 'text-2', 'text-.', 'text-0', 'text-.', 'text-2', 'text-.', 'text-1']) {
          await tapKey(key);
        }
        if ((await hostInput.inputValue()) !== '192.0.2.1') {
          throw new Error('WEB_OVERLAY_POSITIVE_CONTROL_NOT_WRITABLE');
        }
        topologyHostAddressPositiveControl = 'PASS';
      }
      const closeAdmin = page.getByTestId('terminal.admin:close');
      await closeAdmin.focus();
      await closeAdmin.press('Enter');
      await page.getByTestId('terminal.admin:shell').waitFor({state: 'hidden', timeout: 5_000});
      await page.locator('[data-testid^="ui.base.input:virtual-keyboard:"]').first().waitFor({
        state: 'hidden',
        timeout: 2_000,
      });
      if ((await coveredOperator.inputValue()) !== 'A001' || (await coveredPasscode.inputValue()) !== '1111') {
        throw new Error('WEB_OVERLAY_CLOSE_CHANGED_COVERED_VALUES');
      }
      const keyboardKeys = page.locator('[data-testid^="ui.base.input:virtual-keyboard:"]');
      if ((await keyboardKeys.count()) > 0 && (await keyboardKeys.first().isVisible())) {
        throw new Error('WEB_OVERLAY_CLOSE_LEFT_KEYBOARD_VISIBLE');
      }
      await coveredOperator.click();
      await tapKey('text-z');
      if ((await coveredOperator.inputValue()) !== 'A001z') throw new Error('WEB_OVERLAY_CLOSED_FIELD_NOT_REACTIVATED');
      manifest.webObserved = {
        coveredStaffFieldsUnchangedAfterPointerKeyboardTabShiftTabAndScannerSuffix: 'PASS',
        topologyHostAddressPositiveControl,
        closeClearedVirtualKeyboard: 'PASS',
        explicitRefocusRestoredEntry: 'PASS',
      };
      manifest.pageErrorNames = pageErrorNames;
      if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
      await page.screenshot({path: screenshotPath, fullPage: true});
      manifest.screenshotPath = path.relative(root, screenshotPath);
      manifest.business = 'PASS';
    }
  } else if (webScenario === 'platform-ports-smoke') {
    await openAdminConsoleFromLauncher();
    await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
    const pin = (await page.getByTestId('terminal.admin:debug-password').innerText()).match(/\d{6}/)?.[0];
    if (pin === undefined) throw new Error('WEB_PLATFORM_PORTS_DEBUG_PASSWORD_MISSING');
    for (const digit of pin) await page.getByTestId(`ui.base.input:virtual-keyboard:text-${digit}`).click();
    await page.getByTestId('terminal.admin:verify').click();
    await page.getByTestId('terminal.admin:section:platform-ports').click();

    const overallStatus = page.getByTestId('terminal.admin:ports:overall-status');
    await overallStatus.waitFor({state: 'visible', timeout: 15_000});
    const countFor = async (testId, label) => {
      const text = (await page.getByTestId(testId).innerText()).trim();
      const count = parsePlatformPortsSummaryCount(text, label);
      if (count === null) throw new Error(`WEB_PLATFORM_PORTS_COUNT_INVALID:${testId}`);
      return count;
    };
    const counts = {
      available: await countFor('terminal.admin:ports:summary:available', '可用'),
      unavailable: await countFor('terminal.admin:ports:summary:unavailable', '不可用'),
      undeclared: await countFor('terminal.admin:ports:summary:undeclared', '未声明'),
    };
    const totalText = (await page.getByTestId('admin.console.platform-ports:total').innerText()).trim();
    const totalMatch = /^共 (0|[1-9]\d*) 项能力单位$/.exec(totalText);
    if (totalMatch === null) throw new Error('WEB_PLATFORM_PORTS_TOTAL_LABEL_INVALID');
    const total = Number(totalMatch[1]);
    if (total < 1 || counts.available + counts.unavailable + counts.undeclared !== total) {
      throw new Error('WEB_PLATFORM_PORTS_SUMMARY_TOTAL_MISMATCH');
    }
    if ((await overallStatus.innerText()).trim() !== '能力状态总览') {
      throw new Error('WEB_PLATFORM_PORTS_STATUS_LABEL_INVALID');
    }

    await page.getByTestId('terminal.admin:ports:category:device:expand').click();
    const networkCapabilities = ['getNetworkStatus', 'subscribeNetworkStatus', 'unsubscribeNetworkStatus'];
    for (const capability of networkCapabilities) {
      const status = page.getByTestId(`terminal.admin:ports:item:device:${capability}:status`);
      await status.waitFor({state: 'visible', timeout: 5_000});
      const value = (await status.innerText()).trim();
      if (value !== '不可用') throw new Error(`WEB_PLATFORM_PORTS_NETWORK_CAPABILITY_NOT_UNAVAILABLE:${capability}`);
    }
    const transportEvents = parseJsonEventsAfterByteOffset(fs.readFileSync(logPath), 0).filter(event =>
      event.event.startsWith('transport.connection.'),
    );
    if (!transportEvents.some(event => event.event === 'transport.connection.network-status-bridge-unavailable')) {
      throw new Error('WEB_PLATFORM_PORTS_TRANSPORT_NETWORK_BRIDGE_UNAVAILABLE_NOT_OBSERVED');
    }
    if (
      transportEvents.some(event =>
        [
          'transport.connection.socket-opened',
          'transport.connection.connection-ready',
          'transport.connection.connect-attempt-failed',
          'transport.connection.retry-scheduled',
          'transport.connection.network-recovery-expedited',
        ].includes(event.event),
      )
    ) {
      throw new Error('WEB_PLATFORM_PORTS_TRANSPORT_CONNECTION_ACTIVITY_OBSERVED');
    }
    if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);

    manifest.webObserved = {
      page: 'admin.console.platform-ports',
      overallStatus: '能力状态总览',
      counts,
      total,
      networkCapabilities: Object.fromEntries(networkCapabilities.map(capability => [capability, '不可用'])),
      transport: {networkBridge: 'unavailable', connectionActivity: 'none'},
    };
    manifest.pageErrorNames = pageErrorNames;
    await page.screenshot({path: screenshotPath, fullPage: true});
    manifest.screenshotPath = path.relative(root, screenshotPath);
    manifest.business = 'PASS';
  } else if (isActivationRejectionScenario) {
    if (managedDev === null || managedActivationFixture === null || managedActivationDeviceId === null) {
      throw new Error('WEB_TERMINAL_ACTIVATION_REJECTION_MANAGED_DEV_REQUIRED');
    }
    const activationField = page.getByTestId('terminal.activation.code');
    await activationField.waitFor({state: 'visible', timeout: 20_000});
    const activationServiceSpace = (await page.getByTestId('terminal.activation:service-space').innerText()).trim();
    if (activationServiceSpace !== '服务空间：development') {
      throw new Error('WEB_TERMINAL_ACTIVATION_SERVICE_SPACE_MISMATCH');
    }
    manifest.activationServiceSpace = activationServiceSpace;
    await activationField.click();
    for (const digit of managedActivationFixture.activationCode) {
      await page.getByTestId(`ui.base.input:virtual-keyboard:text-${digit}`).click();
    }
    if ((await activationField.inputValue()) !== managedActivationFixture.activationCode) {
      throw new Error('WEB_TERMINAL_ACTIVATION_REJECTION_INPUT_NOT_ACCEPTED');
    }
    await page.getByTestId('ui.base.input:virtual-keyboard:complete').click();
    await page.getByTestId('ui.base.input:virtual-keyboard').waitFor({state: 'hidden', timeout: 5_000});
    const responsePromise = page.waitForResponse(
      response => {
        try {
          const url = new URL(response.url());
          return (
            managedGroupWorkspacePath !== null &&
            url.pathname === `${managedGroupWorkspacePath}/activation` &&
            response.request().method() === 'POST'
          );
        } catch {
          return false;
        }
      },
      {timeout: 20_000},
    );
    const submitPromise = page.getByTestId('terminal.activation.submit').click();
    const [response] = await Promise.all([responsePromise, submitPromise]);
    const problem = await response.json().catch(() => null);
    if (response.status() === 200) {
      managedActivationSucceeded = true;
      manifest.onlineCancellationCleanup = {status: 'STARTED', step: 'UNEXPECTED_ACTIVATION'};
      try {
        await openAdminConsoleFromLauncher();
        await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
        const pinText = await page.getByTestId('terminal.admin:debug-password').innerText();
        const pin = pinText.match(/\d{6}/)?.[0];
        if (pin === undefined) throw new Error('WEB_TERMINAL_ACTIVATION_REJECTION_CLEANUP_PIN_MISSING');
        for (const digit of pin) await page.getByTestId(`ui.base.input:virtual-keyboard:text-${digit}`).click();
        await page.getByTestId('terminal.admin:verify').click();
        await page.getByTestId('terminal.admin:section:terminal.activation.admin.status').click();
        const cancelButton = page.getByTestId('terminal.activation.admin.cancel');
        await cancelButton.waitFor({state: 'visible', timeout: 10_000});
        const cancelResponsePromise = page.waitForResponse(
          value => {
            try {
              const url = new URL(value.url());
              return (
                /^\/api\/terminal\/group-workspaces\/aurora\/terminals\/[^/]+\/activation\/cancel$/u.test(
                  url.pathname,
                ) && value.request().method() === 'POST'
              );
            } catch {
              return false;
            }
          },
          {timeout: 20_000},
        );
        managedCancellationAttempted = true;
        const [cancelResponse] = await Promise.all([cancelResponsePromise, cancelButton.click()]);
        const cancellation = await cancelResponse.json();
        if (cancelResponse.status() !== 200 || !['CANCELLED', 'ALREADY_CANCELLED'].includes(cancellation?.outcome)) {
          throw new Error('WEB_TERMINAL_ACTIVATION_REJECTION_CLEANUP_CANCEL_FAILED');
        }
        managedActivationCancellationOutcome = cancellation.outcome;
        managedActivationCancelled = true;
        manifest.onlineCancellationCleanup = {status: 'PASS', step: 'UNEXPECTED_ACTIVATION_CANCELLED'};
      } catch (cleanupError) {
        scenarioCleanupFailures.push('UNEXPECTED_ACTIVATION_CANCEL_FAILED');
        manifest.onlineCancellationCleanup = {
          status: 'FAIL',
          step: 'UNEXPECTED_ACTIVATION_CANCEL_FAILED',
          errorType: cleanupError instanceof Error ? cleanupError.name : 'UnknownError',
        };
      }
    }
    if (response.status() !== 409 || problem?.errorCode !== 'STORE_TERMINAL_DISABLED') {
      throw new Error('WEB_TERMINAL_DISABLED_ACTIVATION_OWNER_RESULT_MISMATCH');
    }
    await page
      .getByTestId('terminal.activation.result')
      .getByText('终端已停用', {exact: false})
      .waitFor({state: 'visible'});
    if (
      !(await page.getByTestId('terminal.activation.screen').isVisible()) ||
      (await page
        .getByTestId('sample.auth.login:operator-name')
        .isVisible()
        .catch(() => false))
    ) {
      throw new Error('WEB_TERMINAL_DISABLED_ACTIVATION_CHANGED_ROUTE');
    }
    managedActivationRejectedExpected = true;
    manifest.activationRejection = {
      fixtureKey: managedActivationFixture.key,
      httpStatus: response.status(),
      ownerCode: problem.errorCode,
      rejectionVisible: 'PASS',
      activationPageRetained: 'PASS',
      noCredentialCommit: 'PASS',
    };
    recordBusinessAssertion('A-04a');
    completeWebBusinessAssertions();
    manifest.business = 'PASS';
  } else if (webScenario === 'terminal-server-config') {
    if (managedDev === null) throw new Error('WEB_TERMINAL_SERVER_CONFIG_MANAGED_DEV_REQUIRED');
    await openAdminConsoleFromLauncher();
    await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
    const pinText = await page.getByTestId('terminal.admin:debug-password').innerText();
    const pin = pinText.match(/\d{6}/)?.[0];
    if (pin === undefined) throw new Error('WEB_TERMINAL_SERVER_CONFIG_ADMIN_PIN_MISSING');
    for (const digit of pin) await page.getByTestId(`ui.base.input:virtual-keyboard:text-${digit}`).click();
    await page.getByTestId('terminal.admin:verify').click();
    if (surfaceForm === 'mobile') {
      await page.getByTestId('terminal.admin:navigation:trigger').click();
      await page.getByTestId('terminal.admin:navigation:option:terminal.server-config.admin').click();
    } else {
      await page.getByTestId('terminal.admin:section:terminal.server-config.admin').click();
    }
    const servicePicker = page.getByTestId('terminal.server-config.service');
    await servicePicker.waitFor({state: 'visible', timeout: 10_000});
    const declaredSpace = integrationPackage.serverSpaces?.spaces?.find(space => space.name === 'development');
    const declaredBusiness = declaredSpace?.servers?.find(server => server.serverName === 'business');
    const declaredTds = declaredSpace?.servers?.find(server => server.serverName === 'terminal-data-server');
    const businessServiceReadback = (await page.getByTestId('terminal.server-config.read.service').innerText()).trim();
    const businessAddressReadback = (
      await page.getByTestId('terminal.server-config.effective.address.1').innerText()
    ).trim();
    const declaredBusinessPath =
      typeof declaredBusiness?.addresses?.[0]?.baseUrl === 'string'
        ? new URL(declaredBusiness.addresses[0].baseUrl).pathname
        : null;
    const timeoutLabel = milliseconds => `（${milliseconds} ms）`;
    if (
      declaredBusiness?.addresses?.length !== 1 ||
      declaredBusiness.addresses[0]?.addressName !== 'primary' ||
      declaredTds?.addresses?.length !== 2 ||
      declaredBusiness.addresses[0]?.timeoutMs !== 10000 ||
      declaredTds.addresses.some(address => address.timeoutMs !== 10000) ||
      declaredBusinessPath !== new URL(managedGroupWorkspaceUrl).pathname ||
      !businessServiceReadback.includes('business') ||
      !businessAddressReadback.includes(`primary · ${managedGroupWorkspaceUrl}`) ||
      !businessAddressReadback.includes(timeoutLabel(10000))
    ) {
      throw new Error('WEB_TERMINAL_SERVER_CONFIG_PACKAGE_BUSINESS_ADDRESS_PROJECTION_MISMATCH');
    }
    await servicePicker.click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="terminal.server-config.read.service"]')
          ?.textContent?.includes('terminal-data-server'),
      undefined,
      {timeout: 5_000},
    );
    const timeoutField = page.getByTestId('terminal.server-config.address.1.timeout');
    await timeoutField.waitFor({state: 'visible', timeout: 10_000});
    const replaceTimeout = async value => {
      recordWebScenarioStep('SERVER_CONFIG_TIMEOUT_EDIT_STARTED');
      await timeoutField.click();
      const previous = await timeoutField.inputValue();
      for (let index = 0; index < previous.length; index += 1) {
        await page.getByTestId('ui.base.input:virtual-keyboard:backspace').click();
      }
      for (const digit of value) {
        await page.getByTestId(`ui.base.input:virtual-keyboard:text-${digit}`).click();
      }
      if ((await timeoutField.inputValue()) !== value)
        throw new Error('WEB_TERMINAL_SERVER_CONFIG_TIMEOUT_INPUT_MISMATCH');
      recordWebScenarioStep('SERVER_CONFIG_TIMEOUT_INPUT_CONFIRMED', {valueLength: value.length});
      const keyboardPresentation = async () =>
        page.evaluate(() => {
          const layer = document.querySelector('[data-testid="ui.base.input:keyboard-layer-position:active"]');
          const keyboard = layer?.querySelector('[data-testid="ui.base.input:virtual-keyboard"]') ?? null;
          if (layer === null) {
            return {layerPresent: false, keyboardPresent: false, layerId: null, pointerEvents: null, opacity: null};
          }
          const style = getComputedStyle(layer);
          return {
            layerPresent: true,
            keyboardPresent: keyboard !== null,
            layerId: layer.id || null,
            pointerEvents: style.pointerEvents,
            opacity: Number(style.opacity),
          };
        });
      const configInputCount = await page.getByTestId('terminal.server-config.section').locator('input').count();
      if (configInputCount < 1 || configInputCount > 32) {
        throw new Error('WEB_TERMINAL_SERVER_CONFIG_INPUT_COUNT_OUT_OF_BOUNDS');
      }
      let previousLayerId = (await keyboardPresentation()).layerId;
      if (previousLayerId === null) throw new Error('WEB_TERMINAL_SERVER_CONFIG_KEYBOARD_LAYER_ID_MISSING');
      let keyboardClosed = false;
      for (let advance = 1; advance <= configInputCount + 1; advance += 1) {
        await page.getByTestId('ui.base.input:virtual-keyboard:complete').click({timeout: 5_000});
        await page.waitForFunction(
          previous => {
            const layer = document.querySelector('[data-testid="ui.base.input:keyboard-layer-position:active"]');
            const keyboard = layer?.querySelector('[data-testid="ui.base.input:virtual-keyboard"]') ?? null;
            if (layer === null || keyboard === null) return true;
            const style = getComputedStyle(layer);
            const opacity = Number(style.opacity);
            return (
              (style.pointerEvents === 'none' && opacity <= 0.01) ||
              (style.pointerEvents === 'auto' && opacity >= 0.99 && layer.id !== previous)
            );
          },
          previousLayerId,
          {timeout: 5_000},
        );
        const state = await keyboardPresentation();
        keyboardClosed = !state.keyboardPresent || (state.pointerEvents === 'none' && state.opacity <= 0.01);
        recordWebScenarioStep('SERVER_CONFIG_TIMEOUT_KEYBOARD_ADVANCE', {
          advance,
          configInputCount,
          keyboardClosed,
          ...state,
        });
        if (keyboardClosed) break;
        if (state.layerId === null || state.layerId === previousLayerId) {
          throw new Error('WEB_TERMINAL_SERVER_CONFIG_KEYBOARD_FOCUS_DID_NOT_ADVANCE');
        }
        previousLayerId = state.layerId;
      }
      if (!keyboardClosed) throw new Error('WEB_TERMINAL_SERVER_CONFIG_KEYBOARD_CLOSE_BOUND_EXCEEDED');
    };
    const effectiveFirstAddress = page.getByTestId('terminal.server-config.effective.address.1');
    const waitForEffectiveAddress = async expectedText => {
      try {
        await page.waitForFunction(
          expected => {
            const value = document.querySelector('[data-testid="terminal.server-config.effective.address.1"]');
            return value !== null && value.textContent?.includes(expected);
          },
          expectedText,
          {timeout: 10_000},
        );
      } catch {
        const readback = await effectiveFirstAddress.textContent().catch(() => '');
        recordWebScenarioStep('SERVER_CONFIG_EFFECTIVE_ADDRESS_TIMEOUT_NOT_OBSERVED', {
          expectedTimeoutMs: expectedText === timeoutLabel(10001) ? 10001 : 10000,
          observedDefaultTimeout: readback.includes(timeoutLabel(10000)),
          observedChangedTimeout: readback.includes(timeoutLabel(10001)),
          observedEntryOne: readback.includes('haproxy-entry-one'),
          observedEntryTwo: readback.includes('haproxy-entry-two'),
        });
        throw new Error('WEB_TERMINAL_SERVER_CONFIG_EFFECTIVE_ADDRESS_TIMEOUT_NOT_OBSERVED');
      }
      recordWebScenarioStep('SERVER_CONFIG_EFFECTIVE_ADDRESS_TIMEOUT_OBSERVED', {
        expectedTimeoutMs: expectedText === timeoutLabel(10001) ? 10001 : 10000,
      });
      return (await effectiveFirstAddress.innerText()).trim();
    };
    const defaultBefore = (await effectiveFirstAddress.innerText()).trim();
    if (!defaultBefore.includes('haproxy-entry-one') || !defaultBefore.includes(timeoutLabel(10000))) {
      throw new Error('WEB_TERMINAL_SERVER_CONFIG_DEFAULT_READBACK_MISMATCH');
    }
    cleanupManagedServerConfig = async () => {
      if (!managedServerConfigDirty) return;
      const restoreButton = page.getByTestId('terminal.server-config.restore');
      await restoreButton.waitFor({state: 'visible', timeout: 5_000});
      await restoreButton.click();
      await page
        .getByTestId('terminal.server-config.result')
        .getByText('配置已生效', {exact: false})
        .waitFor({state: 'visible', timeout: 10_000});
      const restoredBusinessAddress = (
        await page.getByTestId('terminal.server-config.effective.address.1').innerText()
      ).trim();
      const restoredSpace = (await page.getByTestId('terminal.server-config.read.space').innerText()).trim();
      const restoredService = (await page.getByTestId('terminal.server-config.read.service').innerText()).trim();
      const restoredTdsAddresses = await Promise.all(
        [1, 2].map(async index =>
          (await page.getByTestId(`terminal.server-config.effective.address.${index}`).innerText()).trim(),
        ),
      );
      if (
        !restoredBusinessAddress.includes(timeoutLabel(10000)) ||
        restoredSpace !== '服务空间：development' ||
        !restoredService.includes('terminal-data-server') ||
        restoredTdsAddresses.some(
          (value, index) =>
            !value.includes(
              `${index === 0 ? 'haproxy-entry-one' : 'haproxy-entry-two'} · ${
                index === 0
                  ? managedServerOverrides.tdsEntryOneWebSocketBaseUrl
                  : managedServerOverrides.tdsEntryTwoWebSocketBaseUrl
              }`,
            ) || !value.includes(timeoutLabel(10000)),
        )
      ) {
        throw new Error('WEB_TERMINAL_SERVER_CONFIG_CLEANUP_READBACK_MISMATCH');
      }
      managedServerConfigDirty = false;
      manifest.serverConfigCleanup = {status: 'PASS', operation: 'restore-defaults', effectiveReadback: 'PASS'};
    };
    await replaceTimeout('10001');
    managedServerConfigDirty = true;
    recordWebScenarioStep('SERVER_CONFIG_SAVE_CLICK_STARTED');
    await page.getByTestId('terminal.server-config.save').click();
    recordWebScenarioStep('SERVER_CONFIG_SAVE_CLICK_RETURNED');
    await page
      .getByTestId('terminal.server-config.result')
      .getByText('配置已生效', {exact: false})
      .waitFor({state: 'visible', timeout: 10_000});
    recordWebScenarioStep('SERVER_CONFIG_SAVE_FEEDBACK_OBSERVED');
    await waitForEffectiveAddress(timeoutLabel(10001));
    recordWebScenarioStep('SERVER_CONFIG_SAVE_TRACKED_FEEDBACK_AND_SELECTOR_READBACK');
    await page.getByTestId('terminal.server-config.clear').click();
    await page
      .getByTestId('terminal.server-config.result')
      .getByText('配置已生效', {exact: false})
      .waitFor({state: 'visible', timeout: 10_000});
    await waitForEffectiveAddress(timeoutLabel(10000));
    recordWebScenarioStep('SERVER_CONFIG_CLEAR_TRACKED_FEEDBACK_AND_SELECTOR_READBACK');
    await replaceTimeout('0');
    const invalidSaveLogOffset = captureWebLogCheckpoint();
    await page.getByTestId('terminal.server-config.save').click();
    await page
      .getByTestId('terminal.server-config.result')
      .getByText(/配置未通过校验|配置 owner 拒绝/u)
      .waitFor({state: 'visible', timeout: 10_000});
    const afterInvalidAddress = (await effectiveFirstAddress.innerText()).trim();
    if (!afterInvalidAddress.includes(timeoutLabel(10000))) {
      throw new Error('WEB_TERMINAL_SERVER_CONFIG_INVALID_INPUT_CHANGED_EFFECTIVE_VALUE');
    }
    const invalidCommandEvents = projectFrontendCommandDispatchEvents(
      parseJsonEventsAfterByteOffset(fs.readFileSync(logPath), invalidSaveLogOffset),
    ).events.filter(event => event.event === 'command-dispatch-rejected');
    if (
      invalidCommandEvents.length !== 1 ||
      !invalidCommandEvents[0].commandName?.endsWith('kernel.base.server-config.set-server-override')
    ) {
      throw new Error('WEB_TERMINAL_SERVER_CONFIG_INVALID_COMMAND_REJECTION_NOT_OBSERVED');
    }
    recordWebScenarioStep('SERVER_CONFIG_INVALID_COMMAND_REJECTED', {commandName: invalidCommandEvents[0].commandName});
    await cleanupManagedServerConfig();
    const restoredAddress = (await effectiveFirstAddress.innerText()).trim();
    if (
      !restoredAddress.includes(timeoutLabel(10000)) ||
      (await page.getByTestId('terminal.server-config.read.space').innerText()).trim() !== '服务空间：development'
    ) {
      throw new Error('WEB_TERMINAL_SERVER_CONFIG_RESTORE_READBACK_MISMATCH');
    }
    const effectiveTdsEntries = await Promise.all(
      [1, 2].map(async index =>
        (await page.getByTestId(`terminal.server-config.effective.address.${index}`).innerText()).trim(),
      ),
    );
    const expectedTdsEntries = [
      {name: 'haproxy-entry-one', baseUrl: managedServerOverrides.tdsEntryOneWebSocketBaseUrl},
      {name: 'haproxy-entry-two', baseUrl: managedServerOverrides.tdsEntryTwoWebSocketBaseUrl},
    ];
    if (
      declaredTds?.addresses?.length !== 2 ||
      expectedTdsEntries.some(
        (expected, index) =>
          declaredTds.addresses[index]?.addressName !== expected.name ||
          !effectiveTdsEntries[index].includes(`${expected.name} · ${expected.baseUrl}`) ||
          !effectiveTdsEntries[index].includes(timeoutLabel(10000)),
      )
    ) {
      throw new Error('WEB_TERMINAL_SERVER_CONFIG_PACKAGE_TDS_ADDRESS_PROJECTION_MISMATCH');
    }
    manifest.serverConfigUi = {
      selectedService: 'terminal-data-server',
      publicCommandReadback: 'TRACKED_FEEDBACK_AND_EFFECTIVE_SELECTOR',
      rejectedInvalidCommand: invalidCommandEvents[0].commandName,
      defaultReadback: 'PASS',
      savedOverrideReadback: 'PASS',
      clearedOverrideReadback: 'PASS',
      rejectedInvalidOverrideWithoutEffectiveChange: 'PASS',
      restoredDefaultReadback: 'PASS',
      declaredAddressOrderAndManagedUrlReadback: 'PASS',
    };
    recordBusinessAssertion('A-06a');
    recordBusinessAssertion('A-07a');
    completeWebBusinessAssertions();
    manifest.business = 'PASS';
  } else if (isManagedActivationScenario) {
    if (managedDev === null || managedActivationFixture === null || managedActivationDeviceId === null) {
      throw new Error('WEB_TERMINAL_ACTIVATION_MANAGED_DEV_REQUIRED');
    }
    const openActivationAdminStatus = async () => {
      const statusId = 'terminal.activation.admin.status';
      const statusPanel = page.getByTestId(statusId);
      recordWebScenarioStep('ADMIN_STATUS_ENTRY_CHECK_STARTED');
      if (await statusPanel.isVisible()) {
        recordWebScenarioStep('ADMIN_STATUS_ALREADY_VISIBLE');
        return;
      }
      const login = page.getByTestId('terminal.admin:login');
      const laptopStatusNavigation = page.getByTestId(`terminal.admin:section:${statusId}`);
      const mobileNavigation = page.getByTestId('terminal.admin:navigation:trigger');
      if (
        !(await login.isVisible()) &&
        !(surfaceForm === 'laptop' && (await laptopStatusNavigation.isVisible())) &&
        !(surfaceForm === 'mobile' && (await mobileNavigation.isVisible()))
      ) {
        const launcherBounds = await page.getByTestId(surfaceTestIdPrefix).boundingBox();
        if (launcherBounds === null) throw new Error('WEB_TERMINAL_ACTIVATION_ADMIN_LAUNCHER_BOUNDS_MISSING');
        recordWebScenarioStep('ADMIN_LAUNCHER_OPEN_STARTED', {launcherBounds});
        await openAdminConsoleFromLauncher();
        recordWebScenarioStep('ADMIN_LAUNCHER_OPEN_RETURNED');
      }
      let entryState;
      if (await login.isVisible()) entryState = 'LOGIN';
      else if (surfaceForm === 'mobile' && (await mobileNavigation.isVisible())) entryState = 'AUTHENTICATED_SHELL';
      else if (surfaceForm === 'laptop' && (await laptopStatusNavigation.isVisible()))
        entryState = 'AUTHENTICATED_SHELL';
      else {
        const entryWaitStartedAt = Date.now();
        entryState = await Promise.any([
          statusPanel.waitFor({state: 'visible', timeout: 10_000}).then(() => 'STATUS'),
          login.waitFor({state: 'visible', timeout: 10_000}).then(() => 'LOGIN'),
          ...(surfaceForm === 'mobile'
            ? [mobileNavigation.waitFor({state: 'visible', timeout: 10_000}).then(() => 'AUTHENTICATED_SHELL')]
            : [laptopStatusNavigation.waitFor({state: 'visible', timeout: 10_000}).then(() => 'AUTHENTICATED_SHELL')]),
        ]).catch(() => {
          recordWebScenarioStep('ADMIN_ENTRY_WAIT_FAILED', {surfaceForm, elapsedMs: Date.now() - entryWaitStartedAt});
          throw new Error('WEB_TERMINAL_ADMIN_ENTRY_STATE_UNREACHED');
        });
      }
      manifest.activationAdminEntryState = entryState;
      recordWebScenarioStep('ADMIN_ENTRY_STATE_OBSERVED', {entryState});
      if (entryState === 'LOGIN') {
        recordWebScenarioStep('ADMIN_LOGIN_STARTED');
        const pinText = await page.getByTestId('terminal.admin:debug-password').innerText();
        const pin = pinText.match(/\d{6}/)?.[0];
        if (pin === undefined) throw new Error('WEB_TERMINAL_ACTIVATION_ADMIN_PIN_MISSING');
        for (const digit of pin) await page.getByTestId(`ui.base.input:virtual-keyboard:text-${digit}`).click();
        await page.getByTestId('terminal.admin:verify').click();
        recordWebScenarioStep('ADMIN_LOGIN_SUBMITTED');
      }
      if (entryState !== 'STATUS') {
        if (surfaceForm === 'mobile') {
          await mobileNavigation.click();
          await page.getByTestId(`terminal.admin:navigation:option:${statusId}`).click();
        } else {
          await laptopStatusNavigation.click();
        }
        recordWebScenarioStep('ADMIN_STATUS_NAVIGATION_SUBMITTED');
      }
      await statusPanel.waitFor({state: 'visible', timeout: 10_000});
      recordWebScenarioStep('ADMIN_STATUS_VISIBLE');
    };
    cleanupManagedActivation = async () => {
      manifest.onlineCancellationCleanup = {status: 'STARTED', step: 'OPEN_ADMIN_STATUS'};
      await openActivationAdminStatus();
      manifest.onlineCancellationCleanup.step = 'WAIT_CANCEL_CONTROL';
      const cancelButton = page.getByTestId('terminal.activation.admin.cancel');
      await cancelButton.waitFor({state: 'visible', timeout: 5_000});
      manifest.onlineCancellationCleanup.step = 'WAIT_CANCEL_RESPONSE';
      const cancelResponsePromise = page.waitForResponse(
        response => {
          try {
            const url = new URL(response.url());
            return (
              /^\/api\/terminal\/group-workspaces\/aurora\/terminals\/[^/]+\/activation\/cancel$/.test(url.pathname) &&
              response.request().method() === 'POST'
            );
          } catch {
            return false;
          }
        },
        {timeout: 20_000},
      );
      managedCancellationAttempted = true;
      const cancelClickPromise = cancelButton.click();
      const [response] = await Promise.all([cancelResponsePromise, cancelClickPromise]);
      if (response.status() !== 200) throw new Error('WEB_TERMINAL_CANCELLATION_HTTP_REJECTED');
      const cancellationBody = await response.json();
      if (!['CANCELLED', 'ALREADY_CANCELLED'].includes(cancellationBody?.outcome)) {
        throw new Error('WEB_TERMINAL_CANCELLATION_OUTCOME_INVALID');
      }
      managedActivationCancellationOutcome = cancellationBody.outcome;
      managedActivationCancelled = true;
      manifest.onlineCancellationCleanup = {status: 'PASS', step: 'CANCELLED'};
      // Cancellation resets the runtime. Expo Web has no successor-runtime
      // appControl adapter, so the activation screen is the business-visible
      // reset result; the native successor-runtime observation is VM-only.
      await page.getByTestId('terminal.activation.screen').waitFor({state: 'visible', timeout: 15_000});
    };
    const activationField = page.getByTestId('terminal.activation.code');
    await activationField.waitFor({state: 'visible', timeout: 20_000});
    const activationServiceSpace = (await page.getByTestId('terminal.activation:service-space').innerText()).trim();
    if (activationServiceSpace !== '服务空间：development') {
      throw new Error('WEB_TERMINAL_ACTIVATION_SERVICE_SPACE_MISMATCH');
    }
    manifest.activationServiceSpace = activationServiceSpace;
    await activationField.click();
    for (const digit of managedActivationFixture.activationCode) {
      await page.getByTestId(`ui.base.input:virtual-keyboard:text-${digit}`).click();
    }
    if ((await activationField.inputValue()) !== managedActivationFixture.activationCode) {
      throw new Error('WEB_TERMINAL_ACTIVATION_INPUT_NOT_ACCEPTED');
    }
    if (!(await page.getByTestId('terminal.activation.submit').isEnabled())) {
      throw new Error('WEB_TERMINAL_ACTIVATION_SUBMIT_NOT_ENABLED_AFTER_KEYBOARD_INPUT');
    }
    // Complete is the input owner's supported close action. Leaving the virtual
    // keyboard mounted can cover the submit control in the real Expo Web surface.
    await page.getByTestId('ui.base.input:virtual-keyboard:complete').click();
    await page.getByTestId('ui.base.input:virtual-keyboard').waitFor({state: 'hidden', timeout: 5_000});
    manifest.activationSubmission = {
      inputLength: (await activationField.inputValue()).length,
      submitEnabled: await page.getByTestId('terminal.activation.submit').isEnabled(),
      inputOwnerCompleted: 'PASS',
    };
    const activationResponsePromise = page.waitForResponse(
      response => {
        try {
          const url = new URL(response.url());
          return (
            managedGroupWorkspacePath !== null &&
            url.pathname === `${managedGroupWorkspacePath}/activation` &&
            response.request().method() === 'POST'
          );
        } catch {
          return false;
        }
      },
      {timeout: 20_000},
    );
    const activationClickPromise = page.getByTestId('terminal.activation.submit').click();
    const [activationResponse] = await Promise.all([activationResponsePromise, activationClickPromise]);
    if (activationResponse.status() === 200) managedActivationSucceeded = true;
    else throw new Error('WEB_TERMINAL_ACTIVATION_HTTP_REJECTED');
    recordBusinessAssertion('A-02');
    // Integration owns the next route, so the activation success screen may be
    // replaced immediately. The assembly test covers its transient copy.
    await page.getByTestId('sample.auth.login:operator-name').waitFor({state: 'visible', timeout: 20_000});
    if (
      await page
        .getByTestId('terminal.activation.screen')
        .isVisible()
        .catch(() => false)
    ) {
      throw new Error('WEB_ACTIVATION_STAGE_DID_NOT_HAND_OFF_TO_STAFF_LOGIN');
    }
    recordBusinessAssertion('A-10a');
    const tapKey = async keyId => page.getByTestId(`ui.base.input:virtual-keyboard:${keyId}`).click({timeout: 5_000});
    const operatorName = page.getByTestId('sample.auth.login:operator-name');
    await operatorName.click();
    await tapKey('shift');
    await tapKey('text-a');
    for (const digit of '001') await tapKey(`text-${digit}`);
    const passcode = page.getByTestId('sample.auth.login:passcode');
    await passcode.click();
    for (const digit of '1111') await tapKey(`text-${digit}`);
    if ((await operatorName.inputValue()) !== 'A001' || (await passcode.inputValue()) !== '1111') {
      throw new Error('WEB_STAFF_LOGIN_INPUT_NOT_ACCEPTED');
    }
    await page.getByTestId('sample.auth.login:submit').click();
    if (integrationName === 'sample-console') {
      await page.getByTestId('sample.desk.member-list:empty-action').waitFor({state: 'visible', timeout: 15_000});
      if (surfaceForm === 'laptop') {
        await page.getByTestId(`${integrationName}:test-expo:surface-mode:dual`).click();
        await page
          .getByTestId(`${integrationName}:test-expo:surface:SECONDARY`)
          .waitFor({state: 'visible', timeout: 10_000});
      }
      await page.getByTestId('sample.desk.member-list:empty-action').click();
      const memberFixture = terminalBusinessMemberFixture(runId);
      const memberName = page.getByTestId('sample.desk.member-form:name');
      await memberName.waitFor({state: 'visible', timeout: 10_000});
      await memberName.click();
      for (const character of memberFixture.name) await tapKey(`text-${character}`);
      const memberPhone = page.getByTestId('sample.desk.member-form:phone');
      await memberPhone.click();
      for (const digit of memberFixture.phone) await tapKey(`text-${digit}`);
      if (
        (await memberName.inputValue()) !== memberFixture.name ||
        (await memberPhone.inputValue()) !== memberFixture.phone
      ) {
        throw new Error('WEB_MEMBER_INPUT_NOT_ACCEPTED');
      }
      const memberKeyboard = page.getByTestId('ui.base.input:virtual-keyboard');
      // Complete advances name -> phone -> the two registered keyboard probes;
      // the last completion closes the shared input owner overlay.
      for (let completion = 0; completion < 3 && (await memberKeyboard.isVisible()); completion += 1) {
        await tapKey('complete');
      }
      await memberKeyboard.waitFor({state: 'hidden', timeout: 5_000});
      await page.getByTestId('sample.desk.member-form:submit').click();
      const customerConfirmation = page.getByTestId('sample.desk.customer-member:confirm');
      await customerConfirmation.waitFor({state: 'visible', timeout: 15_000});
      const pendingName = (await page.getByTestId('sample.desk.customer-member:name').innerText()).trim();
      const pendingPhone = (await page.getByTestId('sample.desk.customer-member:phone').innerText()).trim();
      if (pendingName !== memberFixture.name || pendingPhone !== memberFixture.phone) {
        throw new Error('WEB_MEMBER_PENDING_CONTENT_MISMATCH');
      }
      const memberAge = page.getByTestId('sample.desk.customer-member:age');
      await memberAge.waitFor({state: 'visible', timeout: 10_000});
      await memberAge.click();
      for (const digit of '37') await tapKey(`text-${digit}`);
      if ((await memberAge.inputValue()) !== '37') throw new Error('WEB_MEMBER_AGE_INPUT_NOT_ACCEPTED');
      await tapKey('complete');
      await page.getByTestId('ui.base.input:virtual-keyboard').waitFor({state: 'hidden', timeout: 5_000});
      await customerConfirmation.click();
      const memberRows = page.locator('[data-testid^="sample.desk.member-list:row:"]:not([data-testid$=":content"])');
      await memberRows.first().waitFor({state: 'visible', timeout: 10_000});
      const memberReadback = memberConfirmationReadback({
        rowTexts: await memberRows.allInnerTexts(),
        expectedName: memberFixture.name,
        expectedPhone: memberFixture.phone,
      });
      manifest.memberConfirmationReadback = memberReadback;
      if (memberReadback.status !== 'PASS') {
        throw new Error('WEB_MEMBER_CONFIRMATION_NOT_READ_BACK');
      }
      manifest.memberRegistration = {
        pendingContentMatched: 'PASS',
        confirmationReadbackMatched: 'PASS',
        confirmedMemberRowCount: memberReadback.rowCount,
        matchingConfirmedMemberRowCount: memberReadback.matchingRowCount,
        optionalAgeInputAcceptedAndSubmitted: 'PASS',
        exactAgeStateReadback: 'OWNER_FOCUSED_PROOF_REQUIRED',
        confirmationOwnerSelectorReadback: 'PASS',
        confirmationSurface: surfaceForm === 'laptop' ? 'SECONDARY' : 'PRIMARY_HANDHELD',
      };
      recordBusinessAssertion('A-13a');
      await page.getByTestId('sample.desk.member-list:logout').click();
    } else {
      await page.getByTestId('sample.wallpaper.picker').waitFor({state: 'visible', timeout: 15_000});
      const wallpaperIds = ['none', 'w1', 'w2', 'w3'];
      const wallpaperStates = await Promise.all(
        wallpaperIds.map(async wallpaperId => ({
          wallpaperId,
          selected: isWallpaperRadioMarkerSelected(
            await page.getByTestId(`sample.wallpaper.picker:options:${wallpaperId}`).innerText(),
          ),
        })),
      );
      const currentSelection = wallpaperStates.filter(value => value.selected);
      if (currentSelection.length !== 1)
        throw new Error(`WEB_WALLPAPER_CURRENT_SELECTION_INVALID:${JSON.stringify(wallpaperStates)}`);
      const targetWallpaperId = currentSelection[0].wallpaperId === 'w1' ? 'w2' : 'w1';
      const wallpaperOption = page.getByTestId(`sample.wallpaper.picker:options:${targetWallpaperId}`);
      if (isWallpaperRadioMarkerSelected(await wallpaperOption.innerText())) {
        throw new Error(`WEB_WALLPAPER_TARGET_SELECTION_NOT_DISTINCT:${targetWallpaperId}`);
      }
      await wallpaperOption.click();
      const confirmWallpaper = page.getByTestId('sample.wallpaper.picker:confirm');
      await confirmWallpaper.waitFor({state: 'visible', timeout: 5_000});
      if (!(await confirmWallpaper.isEnabled())) throw new Error('WEB_WALLPAPER_CONFIRM_NOT_ENABLED_AFTER_SELECTION');
      const pendingSelection = await Promise.all(
        wallpaperIds.map(async wallpaperId => ({
          wallpaperId,
          selected: isWallpaperRadioMarkerSelected(
            await page.getByTestId(`sample.wallpaper.picker:options:${wallpaperId}`).innerText(),
          ),
        })),
      );
      if (
        pendingSelection
          .filter(value => value.selected)
          .map(value => value.wallpaperId)
          .join() !== targetWallpaperId
      ) {
        throw new Error(`WEB_WALLPAPER_PENDING_SELECTION_MISMATCH:${JSON.stringify(pendingSelection)}`);
      }
      if (webScenario === 'terminal-wallpaper-exit') {
        const homeRouteByteOffset = captureWebLogCheckpoint();
        await page.getByTestId('sample.wallpaper.picker:exit').click();
        await waitForLogEvent(
          logPath,
          'render.screen-selection',
          homeRouteByteOffset,
          10_000,
          event =>
            event.data?.displayMode === 'PRIMARY' &&
            event.data?.containerKey === 'main' &&
            event.data?.screenPartKey === 'sample.wallpaper.home' &&
            event.data?.fallback === null,
        );
        const homeBackground = page.getByTestId('sample.wallpaper.background');
        if (currentSelection[0].wallpaperId !== 'none') {
          await homeBackground.waitFor({state: 'visible', timeout: 10_000});
        }
        const backgroundCount = await homeBackground.count();
        const confirmedLabel = backgroundCount === 1 ? await homeBackground.getAttribute('aria-label') : null;
        const wallpaperExitMismatch = wallpaperExitReadbackMismatch({
          wallpaperId: currentSelection[0].wallpaperId,
          homeRouteObserved: true,
          backgroundCount,
          backgroundLabel: confirmedLabel,
        });
        if (wallpaperExitMismatch !== null) throw new Error(wallpaperExitMismatch);
        recordBusinessAssertion('A-14b');
        manifest.wallpaperSelection = {
          beforeSelection: currentSelection[0].wallpaperId,
          pendingSelection: targetWallpaperId,
          cancelledPendingReadback: 'PASS',
          confirmedValueAfterExit: currentSelection[0].wallpaperId,
          homeRouteReadback: 'PASS',
          backgroundReadback: currentSelection[0].wallpaperId === 'none' ? 'ABSENT_AS_EXPECTED' : 'LABEL_MATCHED',
        };
        manifest.staffLogout = 'NOT_EXERCISED_IN_EXIT_SCENARIO';
      } else {
        await confirmWallpaper.click();
        await page.waitForFunction(
          wallpaperId => {
            const option = document.querySelector(`[data-testid="sample.wallpaper.picker:options:${wallpaperId}"]`);
            return option?.textContent?.trim() === '•';
          },
          targetWallpaperId,
          {timeout: 10_000},
        );
        if (await confirmWallpaper.isEnabled()) throw new Error('WEB_WALLPAPER_CONFIRM_REMAINS_ENABLED_AFTER_COMMIT');
        manifest.wallpaperSelection = {
          beforeSelection: currentSelection[0].wallpaperId,
          selectedOptionReadback: 'PASS',
          confirmedStateReadback: 'PASS',
        };
        recordBusinessAssertion('A-14a');
        await page.getByTestId('sample.wallpaper.picker:logout').click();
      }
    }
    if (webScenario !== 'terminal-wallpaper-exit') {
      await page.getByTestId('sample.auth.login:operator-name').waitFor({state: 'visible', timeout: 15_000});
      manifest.staffLogout = {returnedToStaffLogin: 'PASS'};
      recordBusinessAssertion('A-11a');
    }
    const successfulActivation = [...managedHttpResults]
      .reverse()
      .find(value => value.operation === 'activation' && value.method === 'POST' && value.status === 200);
    if (successfulActivation === undefined) throw new Error('WEB_TERMINAL_ACTIVATION_HTTP_SUCCESS_NOT_OBSERVED');

    recordWebScenarioStep('ACTIVATION_AND_MEMBER_JOURNEY_COMPLETE');
    await openActivationAdminStatus();
    recordWebScenarioStep('ADMIN_STATUS_ASSERTIONS_STARTED');
    const activationState = page.getByTestId('terminal.activation.admin:state');
    const connectionState = page.getByTestId('terminal.activation.admin:connection');
    await activationState.getByText('已激活', {exact: false}).waitFor({state: 'visible', timeout: 10_000});
    const activeStatusText = (await activationState.innerText()).trim();
    await connectionState.getByText('已连接', {exact: false}).waitFor({state: 'visible', timeout: 40_000});
    const connectedStatusText = (await connectionState.innerText()).trim();
    const latencyReadback = await waitForMatchedHeartbeatRttReadback({
      page,
      logPath,
      startedAt: manifest.startedAt,
    });
    const latencyBeforeCancellation = latencyReadback.displayText;
    manifest.matchedHeartbeatRtt = latencyReadback.matchedHeartbeat;
    recordBusinessAssertion('A-05a');
    recordWebScenarioStep('TDS_STATUS_AND_LATENCY_CONFIRMED');
    if (!managedWebSocketPaths.some(value => value.loopback && value.pathMatchesTdsContract)) {
      throw new Error('WEB_TERMINAL_TDS_WEBSOCKET_ROUTE_NOT_OBSERVED');
    }

    await cleanupManagedActivation();
    recordWebScenarioStep('ACTIVATION_CANCELLATION_CONFIRMED');
    const successfulCancellation = [...managedHttpResults]
      .reverse()
      .find(value => value.operation === 'cancel-activation' && value.method === 'POST' && value.status === 200);
    if (
      successfulCancellation === undefined ||
      !managedHttpRequests.some(value => value.operation === 'activation' && value.method === 'POST') ||
      !managedHttpRequests.some(value => value.operation === 'cancel-activation' && value.method === 'POST')
    ) {
      throw new Error('WEB_TERMINAL_GENERATED_URL_SUFFIX_NOT_OBSERVED');
    }
    recordBusinessAssertion('A-03a');
    if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
    manifest.activationResult = {
      fixtureKey: managedActivationFixture.key,
      httpActivation: successfulActivation,
      httpCancellation: successfulCancellation,
      deviceIdentityInjected: 'PASS',
      activeMessageObserved: 'PASS',
      tdsSessionRouteObserved: 'PASS',
      activationStatus: activeStatusText,
      connectionStatusBeforeCancellation: connectedStatusText,
      latencyBeforeCancellation,
      cancellationOutcome: managedActivationCancellationOutcome,
      cancellationResultObserved: 'activation-screen-restored',
      successorRuntimeAdapter: 'NOT_APPLICABLE_IN_EXPO_WEB',
      vmSuccessorRuntimeEvidence: 'NOT_RUN',
      offlineActivationFormRestored: 'PASS',
      websocketRouteObservations: managedWebSocketPaths,
    };
    manifest.pageErrorNames = pageErrorNames;
    manifest.managedHttpRequests = managedHttpRequests;
    completeWebBusinessAssertions();
    manifest.business = 'PASS';
  } else if (failureOwner !== null) {
    const failureNotice = page.getByTestId(`ui-base-render:system-failure:${failureOwner}`);
    const dismissButton = page.getByTestId(`ui-base-render:system-failure:${failureOwner}:dismiss`);
    await failureNotice.waitFor({state: 'visible', timeout: 10_000});
    if (failureOwner === 'screen:main:sample.auth.login') {
      const startupEvents = parseJsonEventsAfterByteOffset(fs.readFileSync(logPath), 0);
      if (!hasStartupContentFailureReadiness(startupEvents)) {
        throw new Error('WEB_STARTUP_CONTENT_FAILURE_READINESS_MISMATCH');
      }
      manifest.startupContentFailure = 'PASS';
      manifest.startupLoadingReleasedWithoutRealReady = 'PASS';
    }
    if ((await page.getByText('知道了', {exact: true}).count()) !== 1) {
      throw new Error('WEB_SYSTEM_FAILURE_NOTICE_BUTTON_COUNT_MISMATCH');
    }
    const resetLogOffset = captureWebLogCheckpoint();
    await dismissButton.click();
    await waitForLogEvent(
      logPath,
      'runtime.system-failure.reset-unavailable',
      resetLogOffset,
      10_000,
      event => event.data?.portStatus === 'unavailable',
    );
    await failureNotice.waitFor({state: 'visible', timeout: 5_000});
    const launcherRecovery = await observeAdminLauncherAfterFailure(failureNotice);
    if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
    manifest.failureNoticeStayedVisible = 'PASS';
    manifest.adminLauncherRemainedUsable = launcherRecovery;
    manifest.webObserved = {failureOwner, resetUnavailableLogged: true, adminLauncherRemainedUsable: launcherRecovery};
    manifest.pageErrorNames = pageErrorNames;
    await page.screenshot({path: screenshotPath, fullPage: true});
    manifest.screenshotPath = path.relative(root, screenshotPath);
    manifest.business = launcherRecovery.status === 'PASS' ? 'PASS' : 'OPEN';
    if (launcherRecovery.status !== 'PASS') {
      manifest.openReason = launcherRecovery.reason ?? 'WEB_ADMIN_LAUNCHER_NOT_PROVEN_USABLE_AFTER_SYSTEM_FAILURE';
    }
  } else {
    await openAdminConsoleFromLauncher();

    await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
    const passwordText = await page.getByTestId('terminal.admin:debug-password').innerText();
    const digits = passwordText.match(/\d{6}/)?.[0];
    if (digits === undefined) throw new Error('ADMIN_DEBUG_PASSWORD_READBACK_MISSING');
    for (const digit of digits) await page.getByTestId(`ui.base.input:virtual-keyboard:text-${digit}`).click();
    await page.getByTestId('terminal.admin:verify').click();
    if (surfaceForm === 'mobile') {
      await page.getByTestId('terminal.admin:navigation:trigger').click();
      await page.getByTestId('terminal.admin:navigation:option:admin.console.runtime').click();
    } else {
      await page.getByTestId('terminal.admin:section:runtime').click();
    }

    const primaryWidth = page.getByTestId('terminal.admin:runtime:surface-map:surface:PRIMARY:logic-width');
    const primaryHeight = page.getByTestId('terminal.admin:runtime:surface-map:surface:PRIMARY:logic-height');
    await primaryWidth.waitFor({state: 'visible', timeout: 15_000});
    const shellFrame = page.locator(ADMIN_SHELL_FRAME_SELECTOR);
    if ((await shellFrame.count()) !== 1) throw new Error('WEB_ADMIN_SHELL_FRAME_COUNT_MISMATCH');
    await shellFrame.waitFor({state: 'visible', timeout: 10_000});
    const shellColor = await shellFrame.evaluate(element => ({
      testID: element.getAttribute('data-testid'),
      computed: getComputedStyle(element).backgroundColor,
      token: getComputedStyle(document.documentElement).getPropertyValue('--color-admin-shell-surface').trim(),
    }));
    const expectedShellColor = EXPECTED_ADMIN_SHELL_COLOR_BY_INTEGRATION[integrationName];
    const observed = {
      primaryLogicalWidth: await primaryWidth.innerText(),
      primaryLogicalHeight: await primaryHeight.innerText(),
      primaryReadiness: await page
        .getByTestId('terminal.admin:runtime:surface-map:surface:PRIMARY:inside:0')
        .innerText(),
      deviceDisplayAreaLabelCount: await page.getByText(/设备显示区域：/).count(),
      secondaryCardCount: await page.getByTestId('terminal.admin:runtime:surface-map:surface:SECONDARY:card').count(),
      adminShellFrameTestID: shellColor.testID,
      adminShellSurfaceToken: shellColor.token,
      adminShellComputedBackground: shellColor.computed,
    };
    if (
      observed.primaryLogicalWidth !== `逻辑分辨率宽：${expectedPrimaryLogicalSize.width}` ||
      observed.primaryLogicalHeight !== `逻辑分辨率高：${expectedPrimaryLogicalSize.height}`
    ) {
      throw new Error(`WEB_PRIMARY_LOGICAL_RESOLUTION_MISMATCH:${JSON.stringify(observed)}`);
    }
    if (observed.primaryReadiness !== '已就绪' || observed.deviceDisplayAreaLabelCount !== 0) {
      throw new Error(`WEB_RUNTIME_DISPLAY_AREA_LABEL_PRESENT_OR_READINESS_MISSING:${JSON.stringify(observed)}`);
    }
    if (shellColor.token !== expectedShellColor.token || shellColor.computed !== expectedShellColor.computed) {
      throw new Error(`WEB_ADMIN_SHELL_SEMANTIC_COLOR_MISMATCH:${JSON.stringify(observed)}`);
    }
    if (observed.secondaryCardCount !== 0) throw new Error('WEB_SECONDARY_ADAPTER_FACTS_UNEXPECTEDLY_PRESENT');
    if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);

    await page.getByTestId('terminal.admin:close').click();
    // Authentication hides the login form while the admin layer remains mounted.
    // Wait for the actual layer owner to unmount before sending a new launcher gesture.
    await page.getByTestId('terminal.admin:shell').waitFor({state: 'hidden', timeout: 10_000});
    const geometryLogOffset = captureWebLogCheckpoint();
    await page.setViewportSize({width: 1180, height: 760});
    await page.waitForFunction(
      () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))),
    );
    const resizedBounds = await page.getByTestId(surfaceTestIdPrefix).boundingBox();
    if (resizedBounds === null) throw new Error('ADMIN_LAUNCHER_RESIZED_BOUNDS_UNAVAILABLE');
    await waitForLauncherGeometryAfter(logPath, geometryLogOffset, {width: 1180, height: 760}, 10_000);
    await openAdminConsoleFromLauncher();
    await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
    const resizedOpenRequests = parseJsonEventsAfterByteOffset(fs.readFileSync(logPath), geometryLogOffset).filter(
      event => isExpectedRuntimeLogEvent(event, 'admin.launcher-open-requested'),
    ).length;
    if (resizedOpenRequests !== 1) throw new Error(`WEB_RESIZED_LAUNCHER_OPEN_COUNT:${resizedOpenRequests}`);
    manifest.geometryAfterViewportResize = 'PASS';
    await page.screenshot({path: screenshotPath, fullPage: true});
    manifest.webObserved = observed;
    manifest.screenshotPath = path.relative(root, screenshotPath);
    manifest.pageErrorNames = pageErrorNames;
    manifest.business = 'PASS';
  }
} catch (error) {
  const failureDiagnostic = projectWebFailureDiagnostic(error, manifest.scenarioStep?.name ?? null);
  manifest.firstFailure ??= failureDiagnostic.failureCode;
  manifest.firstFailureDetails ??= failureDiagnostic;
  if (
    managedActivationSucceeded &&
    !managedActivationCancelled &&
    !managedCancellationAttempted &&
    cleanupManagedActivation !== null
  ) {
    try {
      await cleanupManagedActivation();
    } catch (error) {
      const previous = manifest.onlineCancellationCleanup ?? {step: 'UNKNOWN'};
      manifest.onlineCancellationCleanup = {
        ...previous,
        status: 'FAIL',
        errorName: projectWebFailureDiagnostic(error, 'ONLINE_CANCEL_CLEANUP').errorType,
      };
      scenarioCleanupFailures.push('MANAGED_ACTIVATION_ONLINE_CANCEL_FAILED');
    }
  }
  if (
    managedActivationAttempted &&
    !managedActivationSucceeded &&
    !managedActivationCancelled &&
    !managedActivationRejectedExpected
  ) {
    manifest.onlineCancellationCleanup = {
      status: 'OPEN',
      step: 'ACTIVATION_RESPONSE_OUTCOME_UNKNOWN',
    };
    scenarioCleanupFailures.push('MANAGED_ACTIVATION_OUTCOME_UNKNOWN_CLEANUP_UNPROVEN');
  }
  if (managedCancellationAttempted && !managedActivationCancelled) {
    manifest.onlineCancellationCleanup = {
      ...(manifest.onlineCancellationCleanup ?? {}),
      status: 'FAIL',
      step: 'CANCELLATION_NOT_CONFIRMED',
    };
    scenarioCleanupFailures.push('MANAGED_ACTIVATION_CANCELLATION_NOT_CONFIRMED');
  }
  manifest.business = 'FAIL';
  manifest.managedHttpRequests = managedHttpRequests;
  manifest.managedHttpResults = managedHttpResults;
  manifest.managedHttpFailures = managedHttpFailures;
  manifest.managedHttpTransfers = managedHttpTransfers;
  manifest.browserConsoleFailures = browserConsoleFailures;
  if (page !== null) {
    if (isManagedActivationScenario) {
      manifest.failureScreenshot = 'OMITTED_SENSITIVE_ACTIVATION_AND_MEMBER_INPUTS';
    } else {
      try {
        await page.screenshot({path: screenshotPath, fullPage: true});
        manifest.screenshotPath = path.relative(root, screenshotPath);
      } catch (screenshotError) {
        manifest.failureScreenshotError = projectWebFailureDiagnostic(screenshotError, 'FAILURE_SCREENSHOT').errorType;
      }
    }
    try {
      if (isManagedActivationScenario) {
        const activationInput = page.getByTestId('terminal.activation.code');
        const activationSubmit = page.getByTestId('terminal.activation.submit');
        manifest.activationSubmission = {
          inputLength: (await activationInput.inputValue().catch(() => '')).length,
          submitEnabled: await activationSubmit.isEnabled().catch(() => false),
          keyboardVisible: await page
            .getByTestId('ui.base.input:virtual-keyboard')
            .isVisible()
            .catch(() => false),
          resultVisible: await page
            .getByTestId('terminal.activation.result')
            .isVisible()
            .catch(() => false),
          resultClass: await page
            .getByTestId('terminal.activation.result')
            .innerText()
            .then(text => {
              if (text.includes('设备已激活成功')) return 'ACTIVATED';
              if (text.includes('激活请求未完成')) return 'CLIENT_REQUEST_FAILED';
              if (text.includes('拒绝') || text.includes('未通过校验') || text.includes('已过期'))
                return 'BUSINESS_REJECTED';
              return text.length === 0 ? 'NO_RESULT' : 'OTHER_VISIBLE_RESULT';
            })
            .catch(() => 'RESULT_UNAVAILABLE'),
        };
      }
      manifest.pageDiagnostics = await page.locator('[data-testid]').evaluateAll(elements =>
        elements.map(element => ({
          testID: element.getAttribute('data-testid'),
          tagName: element.tagName,
          visible: element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden',
        })),
      );
    } catch (diagnosticError) {
      manifest.pageDiagnosticsFailure = diagnosticError instanceof Error ? diagnosticError.name : 'UnknownError';
    }
    manifest.pageErrorNames = pageErrorNames;
  }
} finally {
  if (cleanupManagedServerConfig !== null && managedServerConfigDirty) {
    try {
      await cleanupManagedServerConfig();
    } catch (cleanupError) {
      scenarioCleanupFailures.push('SERVER_CONFIG_RESTORE_FAILED');
      manifest.serverConfigCleanup = {
        status: 'FAIL',
        operation: 'restore-defaults',
        errorType: cleanupError instanceof Error ? cleanupError.name : 'UnknownError',
      };
    }
  }
  manifest.finishedAt = new Date().toISOString();
  manifest.browserConsoleFailures = browserConsoleFailures;
  manifest.managedHttpRequests = managedHttpRequests;
  manifest.managedHttpResults = managedHttpResults;
  manifest.managedHttpFailures = managedHttpFailures;
  manifest.managedHttpTransfers = managedHttpTransfers;
  if (managedDev !== null && managedDevScenario) {
    const fullLogPath = path.join(runRoot, '.remote-business-server.log.tmp');
    try {
      collectRemoteLog(managedDev.remoteHostTrust.host, managedDev.remoteJava, fullLogPath);
      const lines = fs.readFileSync(fullLogPath, 'utf8').split(/\r?\n/u);
      manifest.backendTerminalHttpLogEvents = projectManagedTerminalActivationBackendLogLines(
        lines,
        new Date(Date.parse(manifest.startedAt) - 2_000).toISOString(),
        new Date(Date.parse(manifest.finishedAt) + 2_000).toISOString(),
      );
      manifest.backendLogRead = 'PASS';
      if (managedActivationAttempted) {
        const expected = [
          {
            operation: 'activation',
            operationId: 'activateTerminal',
            routeTemplate: activationRouteTemplate,
            expectedOutcome: isActivationRejectionScenario ? 'FAILED' : 'SUCCEEDED',
            expectedStatus: isActivationRejectionScenario ? 409 : 200,
            expectedErrorCode: isActivationRejectionScenario ? 'STORE_TERMINAL_DISABLED' : null,
          },
          {
            operation: 'cancel-activation',
            operationId: 'cancelTerminalActivation',
            routeTemplate: cancellationRouteTemplate,
            expectedOutcome: 'SUCCEEDED',
            expectedStatus: 200,
            expectedErrorCode: null,
          },
        ];
        manifest.frontendBackendLogCorrelation = Object.fromEntries(
          expected.map(item => {
            const attempts = managedHttpRequests.filter(
              value => value.operation === item.operation && value.method === 'POST',
            );
            if (attempts.length === 0) return [item.operation, 'NOT_APPLICABLE'];
            const request = attempts.at(-1);
            const responses = managedHttpResults.filter(
              value => value.operation === item.operation && value.method === 'POST',
            );
            const response = responses.length === 1 ? responses[0] : undefined;
            const matched =
              attempts.length === 1 &&
              response !== undefined &&
              correlateManagedHttpExchange({
                request,
                response,
                backendEvents: manifest.backendTerminalHttpLogEvents,
                operationId: item.operationId,
                routeTemplate: item.routeTemplate,
                expectedOutcome: item.expectedOutcome,
                expectedStatus: item.expectedStatus,
                expectedErrorCode: item.expectedErrorCode,
              });
            return [item.operation, matched ? 'PASS' : 'FAIL'];
          }),
        );
        if (
          Object.values(manifest.frontendBackendLogCorrelation).some(
            value => !['PASS', 'NOT_APPLICABLE'].includes(value),
          )
        ) {
          manifest.business = 'FAIL';
          manifest.firstFailure ??= 'FRONTEND_BACKEND_REQUEST_LOG_CORRELATION_MISMATCH';
        }
      }
      const sanitizedLogPath = path.join(runRoot, 'backend-terminal-activation.jsonl');
      fs.writeFileSync(
        sanitizedLogPath,
        `${manifest.backendTerminalHttpLogEvents.map(value => JSON.stringify(value)).join('\n')}${manifest.backendTerminalHttpLogEvents.length ? '\n' : ''}`,
        {mode: 0o600},
      );
      manifest.backendRequestLog = path.relative(root, sanitizedLogPath);
      fs.rmSync(fullLogPath, {force: true});
    } catch (error) {
      manifest.backendLogRead = 'LOG_NOT_AVAILABLE';
      manifest.backendLogReadFailure =
        error instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(error.name) ? error.name : 'UNKNOWN';
      if (isManagedActivationScenario) {
        manifest.business = 'FAIL';
        manifest.firstFailure ??= 'BACKEND_LOG_NOT_AVAILABLE';
      }
      try {
        fs.rmSync(fullLogPath, {force: true});
      } catch {
        scenarioCleanupFailures.push('BACKEND_RAW_LOG_REMOVE_FAILED');
      }
    }
  }
  if (managedActivationSucceeded && managedDev !== null) {
    const projectedTdsEvents = [];
    const tdsNodeLogRead = [];
    let tdsLogProjectionFailed = false;
    for (const node of managedDev.remoteTdsNodes) {
      const rawLogPath = path.join(runRoot, `.remote-${node.nodeId}-tds.log.tmp`);
      try {
        collectRemoteTdsLog(managedDev.remoteHostTrust.host, node, rawLogPath);
        const lines = fs.readFileSync(rawLogPath, 'utf8').split(/\r?\n/u);
        const nodeEvents = projectManagedTdsLogLines(
          lines,
          node.nodeId,
          manifest.startedAt,
          manifest.finishedAt,
          2_000,
        );
        projectedTdsEvents.push(...nodeEvents);
        tdsNodeLogRead.push({nodeId: node.nodeId, status: 'PASS', eventCount: nodeEvents.length});
      } catch (error) {
        tdsLogProjectionFailed = true;
        tdsNodeLogRead.push({nodeId: node.nodeId, status: 'LOG_NOT_AVAILABLE'});
        manifest.tdsLogReadFailure =
          error instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(error.name) ? error.name : 'UNKNOWN';
      } finally {
        try {
          fs.rmSync(rawLogPath, {force: true});
        } catch {
          tdsLogProjectionFailed = true;
          scenarioCleanupFailures.push(`TDS_RAW_LOG_REMOVE_FAILED:${node.nodeId}`);
        }
      }
    }
    manifest.tdsServerLogEvents = projectedTdsEvents;
    manifest.tdsNodeLogRead = tdsNodeLogRead;
    manifest.tdsLogRead =
      !tdsLogProjectionFailed && managedDev.remoteTdsNodes.length === 3 ? 'PASS' : 'LOG_NOT_AVAILABLE';
    const tdsEvidencePath = path.join(runRoot, 'tds-server-events.jsonl');
    try {
      fs.writeFileSync(
        tdsEvidencePath,
        `${projectedTdsEvents.map(value => JSON.stringify(value)).join('\n')}${projectedTdsEvents.length ? '\n' : ''}`,
        {mode: 0o600},
      );
      manifest.tdsServerLog = path.relative(root, tdsEvidencePath);
    } catch {
      manifest.tdsLogRead = 'LOG_NOT_AVAILABLE';
    }
    const acceptedTdsSessions = new Set(
      projectedTdsEvents
        .filter(value => value.event === 'tds_ws_accepted' && typeof value.connectionId === 'string')
        .map(value => `${value.nodeId}|${value.connectionId}`),
    );
    const hasRegisteredTdsSession = projectedTdsEvents.some(
      value =>
        value.event === 'tds_session_registered' &&
        typeof value.connectionId === 'string' &&
        acceptedTdsSessions.has(`${value.nodeId}|${value.connectionId}`),
    );
    if (manifest.tdsLogRead !== 'PASS' || !hasRegisteredTdsSession) {
      manifest.business = 'FAIL';
      manifest.firstFailure ??=
        manifest.tdsLogRead === 'PASS' ? 'TDS_SERVER_SESSION_LOG_EVIDENCE_MISSING' : 'TDS_SERVER_LOG_NOT_AVAILABLE';
    }
  }
  const cleanupFailures = [...scenarioCleanupFailures];
  try {
    await browser?.close();
  } catch (error) {
    cleanupFailures.push(`BROWSER_CLOSE:${projectWebFailureDiagnostic(error, 'BROWSER_CLOSE').errorType}`);
  }

  if (expo !== null && expoSpawned) {
    const startToken = manifest.process?.startToken;
    if (typeof startToken !== 'string' || startToken.length === 0) {
      cleanupFailures.push('EXPO_PROCESS_OWNERSHIP_UNRESOLVED');
      try {
        const observed = snapshotProcessTree({pid: expo.pid, pgid: expo.pid, startToken: ''});
        manifest.cleanupReadback = observed.length > 0 ? observed : [{pid: expo.pid, ownershipUnverified: true}];
      } catch {
        manifest.cleanupReadback = [{pid: expo.pid, ownershipUnverified: true, readback: 'FAILED'}];
      }
    } else {
      try {
        const identity = {pid: expo.pid, pgid: expo.pid, startToken};
        const result = await terminateOwnedProcessTree(identity);
        const remaining = snapshotProcessTree(identity);
        manifest.cleanupReadback = remaining;
        if (result.status !== 'PASS' || remaining.length !== 0) cleanupFailures.push('EXPO_PROCESS_TREE_REMAINS');
      } catch (error) {
        cleanupFailures.push(
          `EXPO_PROCESS_CLEANUP:${projectWebFailureDiagnostic(error, 'EXPO_PROCESS_CLEANUP').errorType}`,
        );
      }
    }
  }

  if (expoLog !== null) {
    try {
      expo?.stdout?.unpipe(expoLog);
      expo?.stderr?.unpipe(expoLog);
      if (expoLogError !== null) throw expoLogError;
      const finished = new Promise((resolve, reject) => {
        expoLog.once('finish', resolve);
        expoLog.once('error', reject);
        expoLog.end();
      });
      await finished;
      if (expoLogError !== null) throw expoLogError;
    } catch (error) {
      cleanupFailures.push(`EXPO_LOG_CLOSE:${projectWebFailureDiagnostic(error, 'EXPO_LOG_CLOSE').errorType}`);
      expoLog.destroy();
    }
  }

  if (managedDevScenario && manifest.startedAt && manifest.finishedAt) {
    try {
      const events = parseJsonEventsAfterByteOffset(fs.readFileSync(logPath), 0);
      const commandDispatchProjection = projectFrontendCommandDispatchEvents(events);
      manifest.frontendCommandEvents = commandDispatchProjection.events;
      manifest.frontendRejectedCommandCount = commandDispatchProjection.rejectedCount;
      const commandDispatchMismatch = webCommandDispatchMismatch(webScenario, commandDispatchProjection.events);
      manifest.frontendUnresolvedScreenPlacements = unresolvedScreenPlacementsAfterStartup(events);
      const allowedConsoleFailureIndexes =
        isActivationRejectionScenario &&
        managedActivationRejectedExpected &&
        manifest.frontendBackendLogCorrelation?.activation === 'PASS'
          ? expectedActivationRejectionConsoleFailureIndexes({
              failures: browserConsoleFailures,
              httpResults: managedHttpResults,
            })
          : [];
      manifest.expectedHttpStatusConsoleFailureIndexes = allowedConsoleFailureIndexes;
      if (
        !['screen-error-member-journey', 'screen-error-secondary-journey', 'layer-error-production-journey'].includes(
          webScenario,
        ) &&
        (!hasStartupCompletionEvent(events) ||
          hasUnexpectedBrowserConsoleFailures(browserConsoleFailures, allowedConsoleFailureIndexes) ||
          manifest.frontendUnresolvedScreenPlacements.length > 0 ||
          pageErrorNames.length > 0 ||
          commandDispatchMismatch !== null)
      ) {
        manifest.business = 'FAIL';
        manifest.firstFailure ??=
          commandDispatchMismatch !== null
            ? 'FRONTEND_COMMAND_DISPATCH_REJECTED'
            : 'FRONTEND_RUNTIME_DIAGNOSTIC_FAILURE';
      }
      if (isManagedActivationScenario) {
        manifest.frontendActivationLogEvents = projectTerminalActivationLogEvents(
          events,
          manifest.startedAt,
          manifest.finishedAt,
        );
        manifest.frontendTerminalHeartbeatLogEvents = projectTerminalConnectionHeartbeatLogEvents(
          events,
          manifest.startedAt,
          manifest.finishedAt,
        );
      }
      manifest.frontendLogRead = 'PASS';
      if (
        isManagedActivationScenario &&
        managedActivationSucceeded &&
        manifest.frontendTerminalHeartbeatLogEvents.length === 0
      ) {
        manifest.business = 'FAIL';
        manifest.firstFailure ??= 'WEB_TERMINAL_HEARTBEAT_RTT_NOT_OBSERVED';
      }
    } catch (error) {
      manifest.frontendActivationLogEvents = [];
      manifest.frontendTerminalHeartbeatLogEvents = [];
      manifest.frontendLogRead = 'LOG_NOT_AVAILABLE';
      manifest.frontendLogReadFailure = projectWebFailureDiagnostic(error, 'FRONTEND_LOG_READ').errorType;
      if (isManagedActivationScenario) {
        manifest.business = 'FAIL';
        manifest.firstFailure ??= 'FRONTEND_LOG_NOT_AVAILABLE';
      }
    }
  }

  try {
    const sourceFilesAfter = collectWebSourceFiles(root);
    const sourceSnapshotAfter = Object.freeze({
      files: sourceFilesAfter,
      sha256: hashWebSourceFiles(root, sourceFilesAfter),
    });
    applyWebSourceSnapshot(manifest, sourceSnapshotBefore, sourceSnapshotAfter);
  } catch (error) {
    applyWebSourceRecheckFailure(manifest, error);
  }

  if (webRunLockFd !== null && currentProcessIdentity !== null) {
    try {
      releaseManagedWebRunLock(path.join(runtimeRoot, 'web-run.lock'), webRunLockFd, runId, {
        pid: currentProcessIdentity.pid,
        startToken: currentProcessIdentity.startToken,
      });
      manifest.runLock = 'RELEASED';
    } catch (error) {
      cleanupFailures.push(
        `WEB_RUN_LOCK_RELEASE:${projectWebFailureDiagnostic(error, 'RUN_LOCK_RELEASE').failureCode}`,
      );
      manifest.runLock = 'RELEASE_FAILED';
    }
  }
  manifest.cleanup = cleanupFailures.length === 0 ? 'PASS' : 'FAIL';
  manifest.cleanupFailures = cleanupFailures;
  manifest.phase = 'COMPLETE';
  save();
}

process.stdout.write(
  `TER_ADMIN_DISPLAY_WEB business=${manifest.business} cleanup=${manifest.cleanup} sourceStable=${manifest.sourceStable} runId=${runId} sourceSha256=${sourceSha256}\n`,
);
if (manifest.business !== 'PASS' || manifest.cleanup !== 'PASS') {
  process.stderr.write(
    `TER_ADMIN_DISPLAY_WEB_FAILURE=${manifest.firstFailure ?? manifest.openReason ?? manifest.cleanupFailures?.[0] ?? 'CLEANUP_FAILED'}\n`,
  );
  process.exitCode = 1;
}
