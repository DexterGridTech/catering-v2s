import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

export const WEB_SCENARIOS = Object.freeze([
  'admin-runtime',
  'screen-error-member-journey',
  'screen-error-secondary-journey',
  'layer-error-production-journey',
  'keyboard-login',
  'keyboard-member-journey',
  'keyboard-overlay-ownership',
  'textinput-contextmenu',
]);

export const EXPECTED_ADMIN_SHELL_COLOR_BY_INTEGRATION = Object.freeze({
  'sample-console': Object.freeze({token: '16 29 49', computed: 'rgb(16, 29, 49)'}),
  'sample-wallpaper-console': Object.freeze({token: '255 255 255', computed: 'rgb(255, 255, 255)'}),
});

export const ADMIN_SHELL_FRAME_SELECTOR = '[data-testid^="terminal.admin:frame:"]';

export const EXPECTED_TEXTINPUT_PROBE_COUNT = Object.freeze({
  'sample-console': Object.freeze({laptop: 7, mobile: 6}),
  'sample-wallpaper-console': Object.freeze({laptop: 3, mobile: 2}),
});

export const EXPECTED_TEXTINPUT_PROBE_IDS = Object.freeze({
  'sample-console': Object.freeze({
    laptop: Object.freeze([
      'sample.auth.login:operator-name',
      'sample.auth.login:passcode',
      'sample.desk.member-form:name',
      'sample.desk.member-form:phone',
      'sample.desk.member-form:keyboard-alpha-probe',
      'sample.desk.member-form:keyboard-financial-probe',
      'terminal.admin:topology:host',
    ]),
    mobile: Object.freeze([
      'sample.auth.login:operator-name',
      'sample.auth.login:passcode',
      'sample.desk.member-form:name',
      'sample.desk.member-form:phone',
      'sample.desk.member-form:keyboard-alpha-probe',
      'sample.desk.member-form:keyboard-financial-probe',
    ]),
  }),
  'sample-wallpaper-console': Object.freeze({
    laptop: Object.freeze([
      'sample.auth.login:operator-name',
      'sample.auth.login:passcode',
      'terminal.admin:topology:host',
    ]),
    mobile: Object.freeze([
      'sample.auth.login:operator-name',
      'sample.auth.login:passcode',
    ]),
  }),
});

export function expectedTextInputProbeCount({integrationName, surfaceForm}) {
  const count = EXPECTED_TEXTINPUT_PROBE_COUNT[integrationName]?.[surfaceForm];
  if (!Number.isInteger(count)) throw new Error('TER_ADMIN_DISPLAY_WEB_TEXTINPUT_SCOPE_INVALID');
  return count;
}

export function expectedTextInputProbeIds({integrationName, surfaceForm}) {
  const ids = EXPECTED_TEXTINPUT_PROBE_IDS[integrationName]?.[surfaceForm];
  if (!Array.isArray(ids)) throw new Error('TER_ADMIN_DISPLAY_WEB_TEXTINPUT_SCOPE_INVALID');
  return ids;
}

export function textInputProbeMismatch(observations, expectedIds) {
  const statesById = new Map();
  for (const observation of observations) {
    if (typeof observation?.testID !== 'string' || typeof observation?.state !== 'string') {
      return 'WEB_TEXTINPUT_CONTEXTMENU_OBSERVATION_INVALID';
    }
    const states = statesById.get(observation.testID) ?? new Set();
    if (states.has(observation.state)) return 'WEB_TEXTINPUT_CONTEXTMENU_DUPLICATE_STATE';
    states.add(observation.state);
    statesById.set(observation.testID, states);
  }
  const actualIds = [...statesById.keys()].sort();
  const requiredIds = [...expectedIds].sort();
  if (actualIds.length !== requiredIds.length || actualIds.some((id, index) => id !== requiredIds[index])) {
    return 'WEB_TEXTINPUT_CONTEXTMENU_FIELD_SET_MISMATCH';
  }
  if ([...statesById.values()].some(states =>
    states.size !== 2 || !states.has('empty') || !states.has('existing-text'),
  )) {
    return 'WEB_TEXTINPUT_CONTEXTMENU_STATE_COUNT_MISMATCH';
  }
  return null;
}

export function classifyAdminLauncherFailureRecoveryLog(logText) {
  const events = String(logText).split(/\r?\n/).flatMap(line => {
    try {
      const value = JSON.parse(line);
      return value !== null && typeof value === 'object' ? [value] : [];
    } catch {
      return [];
    }
  });
  const requestIndexes = [];
  const resultEvents = [];
  events.forEach((event, index) => {
    if (event.event === 'admin.launcher-open-requested') requestIndexes.push(index);
    if (event.event === 'admin.launcher-open-result') resultEvents.push({event, index});
  });
  const openRequests = requestIndexes.length;
  const results = resultEvents.map(entry => entry.event);
  const completedResults = results.filter(event => event.data?.status === 'completed').length;
  const exactlyOneOrderedRequest = openRequests === 1 && resultEvents.length === 1 &&
    resultEvents[0].index > requestIndexes[0];
  return Object.freeze({
    status: exactlyOneOrderedRequest && completedResults === 1 ? 'PASS' : 'OPEN',
    openRequests,
    completedResults,
  });
}

export function verifyExpoWebListenerOwnership({stdout, status, stderr = '', ownedProcessTree}) {
  const listenerPids = parseListeningProcessIds(stdout, status, stderr);
  assertManagedWebListenerOwnership(listenerPids, ownedProcessTree);
  return listenerPids;
}

export const WEB_LAYER_OWNER_COVERAGE = Object.freeze({
  'layer:admin.console.layer': Object.freeze({
    integrations: 'both',
    journey: 'admin-launcher',
    surfaceForms: Object.freeze(['laptop', 'mobile']),
    status: 'WEB_REACHABLE',
  }),
  'layer:admin.console.power-confirmation.layer': Object.freeze({
    integrations: 'both',
    journey: null,
    surfaceForms: Object.freeze([]),
    status: 'OPEN',
    reason: 'production power-status subscription is unavailable in Web; no production Web trigger exists',
  }),
  'layer:sample.auth.notice': Object.freeze({
    integrations: 'both',
    journey: 'auth-business-failure',
    surfaceForms: Object.freeze(['laptop', 'mobile']),
    status: 'WEB_REACHABLE',
  }),
  'layer:sample.auth.system-notice': Object.freeze({
    integrations: 'both',
    journey: null,
    surfaceForms: Object.freeze([]),
    status: 'OPEN',
    reason: 'requires a production auth system-failure outcome; Web has no controlled failure result',
  }),
  'layer:sample.desk.waiting-confirm': Object.freeze({
    integrations: 'sample-console',
    journey: 'member-registration-pending',
    surfaceForms: Object.freeze(['laptop']),
    status: 'WEB_REACHABLE',
    requiresDualPreview: true,
  }),
  'layer:sample.desk.registry-notice': Object.freeze({
    integrations: 'sample-console',
    journey: 'member-registration-rejected',
    surfaceForms: Object.freeze(['laptop']),
    status: 'WEB_REACHABLE',
    requiresDualPreview: true,
  }),
  'layer:sample.desk.discard-confirm': Object.freeze({
    integrations: 'sample-console',
    journey: 'dirty-member-form-cancel',
    surfaceForms: Object.freeze(['laptop', 'mobile']),
    status: 'WEB_REACHABLE',
  }),
  'layer:sample.desk.withdraw-confirm': Object.freeze({
    integrations: 'sample-console',
    journey: 'member-registration-withdraw',
    surfaceForms: Object.freeze(['laptop']),
    status: 'WEB_REACHABLE',
    requiresDualPreview: true,
  }),
  'layer:sample.desk.system-notice': Object.freeze({
    integrations: 'sample-console',
    journey: null,
    surfaceForms: Object.freeze([]),
    status: 'OPEN',
    reason: 'requires a production member-system-failure outcome; Web has no controlled failure result',
  }),
  'layer:sample.wallpaper.system-notice': Object.freeze({
    integrations: 'sample-wallpaper-console',
    journey: null,
    surfaceForms: Object.freeze([]),
    status: 'OPEN',
    reason: 'requires a production wallpaper-system-failure outcome; Web has no controlled failure result',
  }),
});

export function enumerateWebLayerOwnerCoverage() {
  return Object.freeze(Object.entries(WEB_LAYER_OWNER_COVERAGE).flatMap(([owner, entry]) => {
    const integrations = entry.integrations === 'both'
      ? ['sample-console', 'sample-wallpaper-console']
      : [entry.integrations];
    return integrations.map(integrationName => Object.freeze({
      integrationName,
      owner,
      journey: entry.journey,
      surfaceForms: entry.surfaceForms,
      status: entry.status,
      reason: entry.reason ?? null,
    }));
  }));
}

const memberScreenOwners = new Set([
  'screen:main:sample.desk.member-list',
  'screen:main:sample.desk.member-form',
]);

const secondaryScreenOwnerIntegrations = Object.freeze({
  'screen:main:sample.desk.customer-welcome': 'sample-console',
  'screen:main:sample.desk.customer-member': 'sample-console',
  'screen:main:sample.wallpaper-console.waiting': 'sample-wallpaper-console',
  'screen:main:sample.wallpaper-console.welcome': 'sample-wallpaper-console',
});

const isIntegrationAllowed = (allowed, actual) => allowed === 'both' || allowed === actual;

export function webScenarioScopeError({integrationName, webScenario, surfaceForm, failureOwner}) {
  if (!WEB_SCENARIOS.includes(webScenario)) return 'TER_ADMIN_DISPLAY_WEB_SCENARIO_INVALID';
  if (!['sample-console', 'sample-wallpaper-console'].includes(integrationName)) {
    return 'TER_ADMIN_DISPLAY_WEB_INTEGRATION_INVALID';
  }
  if (!['laptop', 'mobile'].includes(surfaceForm)) return 'TER_ADMIN_DISPLAY_WEB_SURFACE_FORM_INVALID';

  if (webScenario === 'screen-error-member-journey') {
    return integrationName === 'sample-console' && memberScreenOwners.has(failureOwner)
      ? null
      : 'WEB_SCREEN_ERROR_MEMBER_JOURNEY_SCOPE_INVALID';
  }

  if (webScenario === 'screen-error-secondary-journey') {
    return surfaceForm === 'laptop' && secondaryScreenOwnerIntegrations[failureOwner] === integrationName
      ? null
      : 'WEB_SCREEN_ERROR_SECONDARY_JOURNEY_SCOPE_INVALID';
  }

  if (webScenario === 'layer-error-production-journey') {
    const target = WEB_LAYER_OWNER_COVERAGE[failureOwner];
    if (target?.status === 'OPEN') return `WEB_LAYER_ERROR_OWNER_WEB_TRIGGER_OPEN:${failureOwner}`;
    return target !== undefined &&
      target.journey !== null &&
      isIntegrationAllowed(target.integrations, integrationName) &&
      target.surfaceForms.includes(surfaceForm)
      ? null
      : 'WEB_LAYER_ERROR_PRODUCTION_JOURNEY_SCOPE_INVALID';
  }

  if (webScenario === 'keyboard-member-journey') {
    return integrationName === 'sample-console' && failureOwner === null
      ? null
      : 'WEB_KEYBOARD_JOURNEY_SCOPE_INVALID';
  }
  if (webScenario === 'keyboard-login') {
    return integrationName === 'sample-wallpaper-console' && failureOwner === null
      ? null
      : 'WEB_KEYBOARD_JOURNEY_SCOPE_INVALID';
  }
  if (webScenario === 'keyboard-overlay-ownership') {
    return integrationName === 'sample-console' && failureOwner === null
      ? null
      : 'WEB_KEYBOARD_JOURNEY_SCOPE_INVALID';
  }
  if (webScenario === 'textinput-contextmenu') {
    return failureOwner === null ? null : 'WEB_KEYBOARD_JOURNEY_SCOPE_INVALID';
  }

  return failureOwner === null || failureOwner === 'screen:main:sample.auth.login'
    ? null
    : 'WEB_ADMIN_RUNTIME_FAILURE_OWNER_INVALID';
}

export function acquireManagedWebRunLock(lockPath, runId, {pid = process.pid, startToken}) {
  if (!Number.isInteger(pid) || pid <= 0 || typeof startToken !== 'string' || startToken.length === 0) {
    throw new Error('TER_ADMIN_DISPLAY_WEB_RUN_LOCK_IDENTITY_INVALID');
  }
  fs.mkdirSync(path.dirname(lockPath), {recursive: true});
  let fd;
  try {
    fd = fs.openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error('TER_ADMIN_DISPLAY_WEB_RUN_ALREADY_ACTIVE');
    throw error;
  }
  try {
    fs.writeFileSync(fd, `${JSON.stringify({runId, pid, startToken})}\n`);
    fs.fsyncSync(fd);
    return fd;
  } catch (error) {
    try {
      const opened = fs.fstatSync(fd);
      const current = fs.lstatSync(lockPath);
      if (opened.dev === current.dev && opened.ino === current.ino) fs.unlinkSync(lockPath);
    } catch {}
    try {
      fs.closeSync(fd);
    } catch {}
    throw error;
  }
}

export function releaseManagedWebRunLock(lockPath, fd, runId, {pid = process.pid, startToken}) {
  if (fd === null || fd === undefined) return;
  try {
    const opened = fs.fstatSync(fd);
    const currentPath = fs.lstatSync(lockPath);
    if (opened.dev !== currentPath.dev || opened.ino !== currentPath.ino) {
      throw new Error('TER_ADMIN_DISPLAY_WEB_RUN_LOCK_OWNERSHIP_MISMATCH');
    }
    const recorded = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (recorded.runId !== runId || recorded.pid !== pid || recorded.startToken !== startToken) {
      throw new Error('TER_ADMIN_DISPLAY_WEB_RUN_LOCK_OWNERSHIP_MISMATCH');
    }
    fs.closeSync(fd);
    fs.unlinkSync(lockPath);
  } catch (error) {
    try {
      fs.closeSync(fd);
    } catch {}
    throw error;
  }
}

export const WEB_RUNNER_FIXED_SOURCE_FILES = Object.freeze([
  'package.json',
  'yarn.lock',
  '.yarnrc.yml',
  'turbo.json',
  'scripts/dev/managed-process-tree.mjs',
  'scripts/env/check-runtime-resource-budget',
  'scripts/test/ter-admin-display-web-contract.mjs',
  'scripts/test/ter-admin-display-web.mjs',
]);

export function collectWebSourceFiles(repositoryRoot, listAppFiles = () => execFileSync(
  'git',
  ['ls-files', '-co', '--exclude-standard', '--', 'apps/terminal'],
  {cwd: repositoryRoot, encoding: 'utf8'},
)) {
  const appFiles = String(listAppFiles())
    .split(/\r?\n/)
    .map(file => file.trim())
    .filter(Boolean);
  const files = [...new Set([...appFiles, ...WEB_RUNNER_FIXED_SOURCE_FILES])].sort((left, right) => left.localeCompare(right));
  if (files.length !== appFiles.length + WEB_RUNNER_FIXED_SOURCE_FILES.length) {
    throw new Error('TER_ADMIN_DISPLAY_WEB_SOURCE_INVENTORY_DUPLICATE');
  }
  const repositoryRealRoot = fs.realpathSync(repositoryRoot);
  for (const relativePath of files) {
    if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) {
      throw new Error('TER_ADMIN_DISPLAY_WEB_SOURCE_PATH_INVALID');
    }
    const absolutePath = path.resolve(repositoryRealRoot, relativePath);
    if (!absolutePath.startsWith(`${repositoryRealRoot}${path.sep}`)) {
      throw new Error('TER_ADMIN_DISPLAY_WEB_SOURCE_PATH_INVALID');
    }
    const realPath = fs.realpathSync(absolutePath);
    if (!realPath.startsWith(`${repositoryRealRoot}${path.sep}`) || !fs.statSync(realPath).isFile()) {
      throw new Error('TER_ADMIN_DISPLAY_WEB_SOURCE_PATH_INVALID');
    }
  }
  return Object.freeze(files);
}

export function hashWebSourceFiles(repositoryRoot, files) {
  const hash = createHash('sha256');
  for (const relativePath of files) {
    hash.update(relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(repositoryRoot, relativePath)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function sourceSnapshotsMatch(before, after) {
  return before.sha256 === after.sha256 &&
    before.files.length === after.files.length &&
    before.files.every((file, index) => file === after.files[index]);
}

export function applyWebSourceSnapshot(manifest, before, after) {
  manifest.sourceFilesAfterCount = after.files.length;
  manifest.sourceSha256After = after.sha256;
  manifest.sourceStable = sourceSnapshotsMatch(before, after) ? 'PASS' : 'FAIL';
  if (manifest.sourceStable === 'FAIL' && manifest.business === 'PASS') {
    manifest.lastKnownGood = 'PASS';
    manifest.firstFailure = 'WEB_SOURCE_CHANGED_DURING_RUN';
    manifest.business = 'FAIL';
  }
  return manifest.sourceStable;
}

export function applyWebSourceRecheckFailure(manifest, error) {
  manifest.sourceStable = 'UNKNOWN';
  if (manifest.business === 'PASS') {
    manifest.lastKnownGood = 'PASS';
    manifest.firstFailure = `WEB_SOURCE_RECHECK_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}`;
    manifest.business = 'FAIL';
  }
}

export function createExpoWebLaunchSpec(integrationRoot, port, inheritedEnv = process.env) {
  return Object.freeze({
    command: 'yarn',
    args: Object.freeze(['web', '--port', String(port)]),
    options: Object.freeze({
      cwd: integrationRoot,
      detached: true,
      stdio: Object.freeze(['ignore', 'pipe', 'pipe']),
      env: Object.freeze({...inheritedEnv, CI: '1'}),
    }),
  });
}

export function fetchExpoWebReadiness(fetchImpl, url, timeoutMs = 1_000) {
  if (typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('EXPO_WEB_READINESS_REQUEST_INVALID');
  }
  return fetchImpl(url, {signal: AbortSignal.timeout(timeoutMs)});
}

export function awaitManagedChildSpawn(child) {
  return new Promise(resolve => {
    const onSpawn = () => {
      child.off('error', onError);
      resolve(null);
    };
    const onError = error => {
      child.off('spawn', onSpawn);
      resolve(error);
    };
    child.once('spawn', onSpawn);
    child.once('error', onError);
  });
}

export function parseListeningProcessIds(stdout, status, stderr = '') {
  const output = String(stdout ?? '').trim();
  const errorOutput = String(stderr ?? '').trim();
  if (status === 1 && output.length === 0 && errorOutput.length === 0) return Object.freeze([]);
  if (status !== 0 || output.length === 0) throw new Error('WEB_PORT_LISTENER_READBACK_FAILED');
  const values = output.split(/\r?\n/).map(value => value.trim());
  if (values.some(value => !/^\d{1,10}$/.test(value) || Number(value) <= 0)) {
    throw new Error('WEB_PORT_LISTENER_READBACK_MALFORMED');
  }
  return Object.freeze([...new Set(values.map(Number))].sort((left, right) => left - right));
}

export function assertManagedWebListenerOwnership(listenerPids, ownedProcessTree) {
  if (!Array.isArray(listenerPids) || listenerPids.length === 0 || !Array.isArray(ownedProcessTree)) {
    throw new Error('WEB_PORT_LISTENER_NOT_OBSERVED');
  }
  const ownedPids = new Set(ownedProcessTree
    .filter(process => process?.ownershipUnverified !== true)
    .map(process => process?.pid)
    .filter(pid => Number.isInteger(pid) && pid > 0));
  if (listenerPids.some(pid => !ownedPids.has(pid))) {
    throw new Error('WEB_PORT_LISTENER_NOT_OWNED_BY_RUNNER');
  }
  return true;
}

export function pipeExpoOutput(stdout, stderr, destination) {
  stdout.pipe(destination, {end: false});
  stderr.pipe(destination, {end: false});
}

export async function sendProtectedInputKeyboardProbe(keyboard) {
  await keyboard.type('Z');
  await keyboard.press('Tab');
  await keyboard.down('Shift');
  await keyboard.press('Tab');
  await keyboard.up('Shift');
  await keyboard.type('SCAN');
  await keyboard.press('Enter');
}
