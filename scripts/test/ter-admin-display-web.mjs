#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {readProcessTable, snapshotProcessTree, terminateOwnedProcessTree} from '../dev/managed-process-tree.mjs';
import {
  ADMIN_SHELL_FRAME_SELECTOR,
  EXPECTED_ADMIN_SHELL_COLOR_BY_INTEGRATION,
  classifyAdminLauncherFailureRecoveryLog,
  expectedTextInputProbeCount,
  expectedTextInputProbeIds,
  WEB_LAYER_OWNER_COVERAGE,
  WEB_SCENARIOS,
  applyWebSourceRecheckFailure,
  applyWebSourceSnapshot,
  acquireManagedWebRunLock,
  awaitManagedChildSpawn,
  assertManagedWebListenerOwnership,
  collectWebSourceFiles,
  createExpoWebLaunchSpec,
  fetchExpoWebReadiness,
  hashWebSourceFiles,
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
const surfaceForm = process.argv[7] ?? 'laptop';
if (!['laptop', 'mobile'].includes(surfaceForm)) throw new Error('TER_ADMIN_DISPLAY_WEB_SURFACE_FORM_INVALID');
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
const runId = process.argv[2];
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(runId ?? '')) throw new Error('TER_ADMIN_DISPLAY_RUN_ID_REQUIRED');
const port = Number(process.argv[3] ?? 8093);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('TER_ADMIN_DISPLAY_PORT_INVALID');
const failureOwnerArgument = process.argv[4] ?? null;
const failureOwner = failureOwnerArgument === '-' ? null : failureOwnerArgument;
if (failureOwner !== null && !/^[A-Za-z0-9:._-]{1,160}$/.test(failureOwner)) {
  throw new Error('TER_ADMIN_DISPLAY_FAILURE_OWNER_INVALID');
}
const scenarioScopeProblem = webScenarioScopeError({integrationName, webScenario, surfaceForm, failureOwner});
if (scenarioScopeProblem !== null) throw new Error(scenarioScopeProblem);

const files = collectWebSourceFiles(root);
const sourceSnapshotBefore = Object.freeze({files, sha256: hashWebSourceFiles(root, files)});
fs.mkdirSync(runtimeRoot, {recursive: true, mode: 0o700});
const runRoot = path.join(runtimeRoot, runId);
if (fs.existsSync(runRoot)) throw new Error('TER_ADMIN_DISPLAY_RUN_ALREADY_EXISTS');
fs.mkdirSync(runRoot, {recursive: true, mode: 0o700});
const sourceSha256 = sourceSnapshotBefore.sha256;
const manifestPath = path.join(runRoot, 'run-manifest.json');
const logPath = path.join(runRoot, 'expo-web.log');
const screenshotPath = path.join(runRoot, 'admin-runtime.png');
const manifest = {
  runId,
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
  surfaceForm,
  process: null,
  business: 'NOT_RUN',
  cleanup: 'NOT_RUN',
  firstFailure: null,
};
const save = () => fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
save();

let expo = null;
let expoSpawned = false;
let expoLog = null;
let expoLogError = null;
let browser = null;
let page = null;
let webRunLockFd = null;
let currentProcessIdentity = null;
const pageErrorNames = [];
const waitForLauncherGeometryAfter = async (filePath, byteOffset, targetRect, targetViewport, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const content = fs.readFileSync(filePath, 'utf8');
    const tail = content.slice(byteOffset);
    for (const line of tail.split('\n')) {
      if (!line.includes('"event": "admin.launcher-geometry-measured"')) continue;
      const viewport = line.match(/"windowDimensions":\s*\{([^}]*)\}/)?.[1];
      const rect = line.match(/"windowRect":\s*\{([^}]*)\}/)?.[1];
      const viewportWidth = Number(viewport?.match(/"width":\s*([\d.]+)/)?.[1]);
      const viewportHeight = Number(viewport?.match(/"height":\s*([\d.]+)/)?.[1]);
      const measuredWidth = Number(rect?.match(/"width":\s*([\d.]+)/)?.[1]);
      const measuredHeight = Number(rect?.match(/"height":\s*([\d.]+)/)?.[1]);
      if (
        viewportWidth === targetViewport.width &&
        viewportHeight === targetViewport.height &&
        Math.abs(measuredWidth - targetRect.width) <= 1 &&
        Math.abs(measuredHeight - targetRect.height) <= 1
      ) return line;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(
    `WEB_LAUNCHER_GEOMETRY_DID_NOT_MATCH_VISIBLE_PRIMARY:${targetViewport.width}x${targetViewport.height}:${targetRect.width}x${targetRect.height}`,
  );
};
const waitForLogEvent = async (filePath, event, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.readFileSync(filePath, 'utf8').includes(`"event": "${event}"`)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`WEB_EXPECTED_LOG_EVENT_MISSING:${event}`);
};
const observeAdminLauncherAfterFailure = async (targetBounds, failureNotice) => {
  const logOffset = fs.statSync(logPath).size;
  for (let index = 0; index < 5; index += 1) {
    await page.mouse.click(
      targetBounds.x + Math.min(24, targetBounds.width / 4),
      targetBounds.y + Math.min(24, targetBounds.height / 4),
    );
  }
  await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
  await failureNotice.waitFor({state: 'visible', timeout: 5_000});
  return classifyAdminLauncherFailureRecoveryLog(fs.readFileSync(logPath, 'utf8').slice(logOffset));
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

  const listenerPreflight = spawnSync(
    'lsof',
    ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
    {cwd: root, encoding: 'utf8'},
  );
  if (listenerPreflight.error) {
    manifest.portPreflight = {
      status: 'ERROR',
      errorCode: listenerPreflight.error.code ?? listenerPreflight.error.name,
    };
    save();
    throw new Error(`WEB_PORT_LISTENER_PREFLIGHT_SPAWN_FAILED:${listenerPreflight.error.code ?? listenerPreflight.error.name}`);
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
    stderr: String(listenerPreflight.stderr ?? '').trim(),
  };
  fs.writeFileSync(
    path.join(runRoot, 'port-preflight.json'),
    `${JSON.stringify(manifest.portPreflight)}\n`,
    {mode: 0o600},
  );
  save();
  if (occupiedListenerPids.length > 0) throw new Error('WEB_PORT_ALREADY_IN_USE');

  expoLog = fs.createWriteStream(logPath, {flags: 'wx', mode: 0o600});
  expoLog.on('error', error => { expoLogError = error; });
  const expoLaunch = createExpoWebLaunchSpec(integrationRoot, port);
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
      const listenerReadback = spawnSync(
        'lsof',
        ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
        {cwd: root, encoding: 'utf8'},
      );
      if (listenerReadback.error) {
        manifest.portReadback = {
          status: 'ERROR',
          errorCode: listenerReadback.error.code ?? listenerReadback.error.name,
        };
        save();
        throw new Error(`WEB_PORT_LISTENER_READBACK_SPAWN_FAILED:${listenerReadback.error.code ?? listenerReadback.error.name}`);
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
          listenerStdout: String(listenerReadback.stdout ?? '').trim(),
          listenerStderr: String(listenerReadback.stderr ?? '').trim(),
          exitCode: listenerReadback.status,
          processTreePids: ownedProcessTree
            .filter(process => process.ownershipUnverified !== true)
            .map(process => process.pid),
          failure: error instanceof Error ? error.message : 'UNKNOWN',
        };
        fs.writeFileSync(
          path.join(runRoot, 'port-readback.json'),
          `${JSON.stringify(manifest.portReadback)}\n`,
          {mode: 0o600},
        );
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
        stderr: String(listenerReadback.stderr ?? '').trim(),
      };
      fs.writeFileSync(
        path.join(runRoot, 'port-readback.json'),
        `${JSON.stringify(manifest.portReadback)}\n`,
        {mode: 0o600},
      );
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
  page.on('pageerror', error => pageErrorNames.push(error.name || 'Error'));
  const initialGeometryLogOffset = fs.statSync(logPath).size;
  await page.goto(manifest.webUrl, {waitUntil: 'networkidle', timeout: 60_000});

  const launcher = page.getByTestId('terminal.admin:launcher');
  await launcher.waitFor({state: 'visible', timeout: 30_000});
  const bounds = await page.getByTestId(surfaceTestIdPrefix).boundingBox();
  if (bounds === null) throw new Error('ADMIN_LAUNCHER_BOUNDS_UNAVAILABLE');
  await waitForLauncherGeometryAfter(logPath, initialGeometryLogOffset, bounds, {width: 1440, height: 1000}, 10_000);
  if (webScenario === 'screen-error-member-journey') {
    const allowedFailureOwners = new Set([
      'screen:main:sample.desk.member-list',
      'screen:main:sample.desk.member-form',
    ]);
    if (
      integrationName !== 'sample-console' ||
      failureOwner === null ||
      !allowedFailureOwners.has(failureOwner)
    ) {
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
    if (await page.getByText('知道了', {exact: true}).count() !== 1) {
      throw new Error('WEB_SCREEN_ERROR_NOTICE_BUTTON_COUNT_MISMATCH');
    }
    await dismissButton.click();
    await waitForLogEvent(logPath, 'runtime.system-failure.reset-unavailable', 10_000);
    await failureNotice.waitFor({state: 'visible', timeout: 5_000});
    const launcherRecovery = await observeAdminLauncherAfterFailure(bounds, failureNotice);
    if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
    manifest.webObserved = {
      failureOwner,
      route: 'production-staff-login-to-member-screen',
      noticeButtonCount: 1,
      resetUnavailableLogged: true,
      adminLauncherRemainedUsable: launcherRecovery,
    };
    manifest.pageErrorNames = pageErrorNames;
    await page.screenshot({path: screenshotPath, fullPage: true});
    manifest.screenshotPath = path.relative(root, screenshotPath);
    manifest.business = launcherRecovery.status === 'PASS' ? 'PASS' : 'OPEN';
    if (launcherRecovery.status !== 'PASS') {
      manifest.openReason = 'WEB_ADMIN_LAUNCHER_NOT_PROVEN_USABLE_AFTER_MEMBER_SCREEN_FAILURE';
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
    if (await page.getByText('知道了', {exact: true}).count() !== 1) {
      throw new Error('WEB_SCREEN_ERROR_SECONDARY_NOTICE_BUTTON_COUNT_MISMATCH');
    }
    await dismissButton.click();
    await waitForLogEvent(logPath, 'runtime.system-failure.reset-unavailable', 10_000);
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
    const launcherRecovery = await observeAdminLauncherAfterFailure(
      primaryBoundsAfterSecondaryNotice,
      failureNotice,
    );
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
      manifest.openReason = 'WEB_ADMIN_LAUNCHER_NOT_PROVEN_USABLE_AFTER_SECONDARY_SCREEN_FAILURE';
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
    const loginStaff = async (accepted) => {
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
      await page.getByTestId(`${integrationName}:test-expo:surface:SECONDARY`).waitFor({state: 'visible', timeout: 10_000});
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
      for (let index = 0; index < 5; index += 1) {
        await page.mouse.click(bounds.x + Math.min(24, bounds.width / 4), bounds.y + Math.min(24, bounds.height / 4));
      }
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
    if (await page.getByText('知道了', {exact: true}).count() !== 1) {
      throw new Error('WEB_LAYER_ERROR_NOTICE_BUTTON_COUNT_MISMATCH');
    }
    await dismissButton.click();
    await waitForLogEvent(logPath, 'runtime.system-failure.reset-unavailable', 10_000);
    await failureNotice.waitFor({state: 'visible', timeout: 5_000});
    let adminLauncherWhileFailure;
    if (failureOwner !== 'layer:admin.console.layer') {
      const primaryBounds = await currentPrimaryBounds();
      adminLauncherWhileFailure = await observeAdminLauncherAfterFailure(primaryBounds, failureNotice);
    } else {
      const currentBounds = await currentPrimaryBounds();
      adminLauncherWhileFailure = await observeAdminLauncherAfterFailure(currentBounds, failureNotice);
    }
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
      manifest.openReason = 'WEB_ADMIN_LAUNCHER_NOT_PROVEN_USABLE_WHILE_ADMIN_LAYER_FAILURE_PERSISTS';
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
        for (const testID of [
          'sample.desk.member-form:name',
          'sample.desk.member-form:phone',
          'sample.desk.member-form:keyboard-alpha-probe',
          'sample.desk.member-form:keyboard-financial-probe',
        ]) await observeContextMenu(testID);

        let topologyHostInput;
        if (integrationName === 'sample-console') {
          for (let index = 0; index < 5; index += 1) {
            await page.mouse.click(bounds.x + Math.min(24, bounds.width / 4), bounds.y + Math.min(24, bounds.height / 4));
          }
          await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
          const pin = (await page.getByTestId('terminal.admin:debug-password').innerText()).match(/\d{6}/)?.[0];
          if (pin === undefined) throw new Error('WEB_ADMIN_DEBUG_PASSWORD_READBACK_MISSING');
          for (const digit of pin) await tapKey(`text-${digit}`);
          await page.getByTestId('terminal.admin:verify').click();
          topologyHostInput = await observeTopologyHostInput();
        }
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
        manifest.webObserved = {
          clipboardPrecondition: 'NON_EMPTY',
          textInputCount: observedTextInputCount,
          emptyAndExistingTextStates: contextMenuObservations.length,
          nonTextInputAdminPinSkipped: true,
          ...(integrationName === 'sample-console' ? {topologyHostInput} : {}),
          contextMenuPrevented: 'PASS',
          observationKind: 'RNW_CONTEXTMENU_EVENT',
        };
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
      for (let index = 0; index < 5; index += 1) {
        await page.mouse.click(bounds.x + Math.min(24, bounds.width / 4), bounds.y + Math.min(24, bounds.height / 4));
      }
      await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
      const pin = (await page.getByTestId('terminal.admin:debug-password').innerText()).match(/\d{6}/)?.[0];
      if (pin === undefined) throw new Error('WEB_ADMIN_DEBUG_PASSWORD_READBACK_MISSING');
      for (const digit of pin) await tapKey(`text-${digit}`);
      await page.getByTestId('terminal.admin:verify').click();
      const topologyHostInput = await observeTopologyHostInput();
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
      manifest.webObserved = {
        clipboardPrecondition: 'NON_EMPTY',
        textInputCount: observedTextInputCount,
        emptyAndExistingTextStates: contextMenuObservations.length,
        nonTextInputAdminPinSkipped: true,
        topologyHostInput,
        contextMenuPrevented: 'PASS',
        observationKind: 'RNW_CONTEXTMENU_EVENT',
      };
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
      for (let index = 0; index < 5; index += 1) {
        await page.mouse.click(
          launcherBounds.x + Math.min(24, launcherBounds.width / 4),
          launcherBounds.y + Math.min(24, launcherBounds.height / 4),
        );
      }
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
      if (await keyboardKeys.count() > 0 && await keyboardKeys.first().isVisible()) {
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
  } else if (failureOwner !== null) {
    const failureNotice = page.getByTestId(`ui-base-render:system-failure:${failureOwner}`);
    const dismissButton = page.getByTestId(`ui-base-render:system-failure:${failureOwner}:dismiss`);
    await failureNotice.waitFor({state: 'visible', timeout: 10_000});
    if (failureOwner === 'screen:main:sample.auth.login') {
      const readinessLog = fs.readFileSync(logPath, 'utf8');
      const startupComplete = readinessLog.split('\n').find(line =>
        line.includes('"event": "startup.complete"') &&
        line.includes('"primaryContentFailure": "render-error"') &&
        line.includes('"primaryRealReady": false'),
      );
      const loadingReleased = readinessLog.split('\n').some(line =>
        line.includes('"event": "startup.ready-hidden"') &&
        line.includes('"contentFailure": "render-error"'),
      );
      if (startupComplete === undefined || !loadingReleased) {
        throw new Error('WEB_STARTUP_CONTENT_FAILURE_READINESS_MISMATCH');
      }
      manifest.startupContentFailure = 'PASS';
      manifest.startupLoadingReleasedWithoutRealReady = 'PASS';
    }
    if (await page.getByText('知道了', {exact: true}).count() !== 1) {
      throw new Error('WEB_SYSTEM_FAILURE_NOTICE_BUTTON_COUNT_MISMATCH');
    }
    await dismissButton.click();
    await waitForLogEvent(logPath, 'runtime.system-failure.reset-unavailable', 10_000);
    await failureNotice.waitFor({state: 'visible', timeout: 5_000});
    const launcherRecovery = await observeAdminLauncherAfterFailure(bounds, failureNotice);
    if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
    manifest.failureNoticeStayedVisible = 'PASS';
    manifest.adminLauncherRemainedUsable = launcherRecovery;
    manifest.webObserved = {failureOwner, resetUnavailableLogged: true, adminLauncherRemainedUsable: launcherRecovery};
    manifest.pageErrorNames = pageErrorNames;
    await page.screenshot({path: screenshotPath, fullPage: true});
    manifest.screenshotPath = path.relative(root, screenshotPath);
    manifest.business = launcherRecovery.status === 'PASS' ? 'PASS' : 'OPEN';
    if (launcherRecovery.status !== 'PASS') {
      manifest.openReason = 'WEB_ADMIN_LAUNCHER_NOT_PROVEN_USABLE_AFTER_SYSTEM_FAILURE';
    }
  } else {
    for (let index = 0; index < 5; index += 1) {
      await page.mouse.click(bounds.x + Math.min(24, bounds.width / 4), bounds.y + Math.min(24, bounds.height / 4));
    }

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
    if (await shellFrame.count() !== 1) throw new Error('WEB_ADMIN_SHELL_FRAME_COUNT_MISMATCH');
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
      primaryReadiness: await page.getByTestId('terminal.admin:runtime:surface-map:surface:PRIMARY:inside:0').innerText(),
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
    if (
      shellColor.token !== expectedShellColor.token ||
      shellColor.computed !== expectedShellColor.computed
    ) {
      throw new Error(`WEB_ADMIN_SHELL_SEMANTIC_COLOR_MISMATCH:${JSON.stringify(observed)}`);
    }
    if (observed.secondaryCardCount !== 0) throw new Error('WEB_SECONDARY_ADAPTER_FACTS_UNEXPECTEDLY_PRESENT');
    if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);

    await page.getByTestId('terminal.admin:close').click();
    // Authentication hides the login form while the admin layer remains mounted.
    // Wait for the actual layer owner to unmount before sending a new launcher gesture.
    await page.getByTestId('terminal.admin:shell').waitFor({state: 'hidden', timeout: 10_000});
    const geometryLogOffset = fs.statSync(logPath).size;
    await page.setViewportSize({width: 1180, height: 760});
    await page.waitForFunction(
      () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))),
    );
    const resizedBounds = await page.getByTestId(surfaceTestIdPrefix).boundingBox();
    if (resizedBounds === null) throw new Error('ADMIN_LAUNCHER_RESIZED_BOUNDS_UNAVAILABLE');
    await waitForLauncherGeometryAfter(
      logPath,
      geometryLogOffset,
      resizedBounds,
      {width: 1180, height: 760},
      10_000,
    );
    for (let index = 0; index < 5; index += 1) {
      await page.mouse.click(
        resizedBounds.x + Math.min(24, resizedBounds.width / 4),
        resizedBounds.y + Math.min(24, resizedBounds.height / 4),
      );
    }
    await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
    const resizedOpenRequests = fs.readFileSync(logPath, 'utf8').slice(geometryLogOffset)
      .split('\n')
      .filter(line => line.includes('"event": "admin.launcher-open-requested"')).length;
    if (resizedOpenRequests !== 1) throw new Error(`WEB_RESIZED_LAUNCHER_OPEN_COUNT:${resizedOpenRequests}`);
    manifest.geometryAfterViewportResize = 'PASS';
    await page.screenshot({path: screenshotPath, fullPage: true});
    manifest.webObserved = observed;
    manifest.screenshotPath = path.relative(root, screenshotPath);
    manifest.pageErrorNames = pageErrorNames;
    manifest.business = 'PASS';
  }
} catch (error) {
  manifest.firstFailure = error instanceof Error ? error.message : String(error);
  manifest.business = 'FAIL';
  if (page !== null) {
    try {
      await page.screenshot({path: screenshotPath, fullPage: true});
      manifest.screenshotPath = path.relative(root, screenshotPath);
    } catch (screenshotError) {
      manifest.failureScreenshotError = screenshotError instanceof Error ? screenshotError.name : 'UnknownError';
    }
    try {
      manifest.pageDiagnostics = await page.locator('[data-testid]').evaluateAll(elements => elements.map(element => ({
        testID: element.getAttribute('data-testid'),
        tagName: element.tagName,
        visible: element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden',
      })));
    } catch (diagnosticError) {
      manifest.pageDiagnosticsFailure = diagnosticError instanceof Error ? diagnosticError.name : 'UnknownError';
    }
    manifest.pageErrorNames = pageErrorNames;
  }
} finally {
  const cleanupFailures = [];
  try {
    await browser?.close();
  } catch (error) {
    cleanupFailures.push(`BROWSER_CLOSE:${error instanceof Error ? error.name : 'UNKNOWN'}`);
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
        cleanupFailures.push(`EXPO_PROCESS_CLEANUP:${error instanceof Error ? error.message : 'UNKNOWN'}`);
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
      cleanupFailures.push(`EXPO_LOG_CLOSE:${error instanceof Error ? error.name : 'UNKNOWN'}`);
      expoLog.destroy();
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
      cleanupFailures.push(`WEB_RUN_LOCK_RELEASE:${error instanceof Error ? error.message : 'UNKNOWN'}`);
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
  process.stderr.write(`TER_ADMIN_DISPLAY_WEB_FAILURE=${manifest.firstFailure ?? manifest.openReason ?? manifest.cleanupFailures?.[0] ?? 'CLEANUP_FAILED'}\n`);
  process.exitCode = 1;
}
