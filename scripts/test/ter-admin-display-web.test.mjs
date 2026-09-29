import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {EventEmitter, once} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PassThrough, Writable} from 'node:stream';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {
  ADMIN_SHELL_FRAME_SELECTOR,
  EXPECTED_ADMIN_SHELL_COLOR_BY_INTEGRATION,
  EXPECTED_TEXTINPUT_PROBE_COUNT,
  EXPECTED_TEXTINPUT_PROBE_IDS,
  WEB_LAYER_OWNER_COVERAGE,
  WEB_RUNNER_FIXED_SOURCE_FILES,
  WEB_SCENARIOS,
  applyWebSourceRecheckFailure,
  applyWebSourceSnapshot,
  acquireManagedWebRunLock,
  awaitManagedChildSpawn,
  assertManagedWebListenerOwnership,
  classifyAdminLauncherFailureRecoveryLog,
  collectWebSourceFiles,
  createExpoWebLaunchSpec,
  expectedTextInputProbeCount,
  expectedTextInputProbeIds,
  enumerateWebLayerOwnerCoverage,
  fetchExpoWebReadiness,
  hashWebSourceFiles,
  pipeExpoOutput,
  parseListeningProcessIds,
  releaseManagedWebRunLock,
  sendProtectedInputKeyboardProbe,
  sourceSnapshotsMatch,
  textInputProbeMismatch,
  verifyExpoWebListenerOwnership,
  webScenarioScopeError,
} from './ter-admin-display-web-contract.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-admin-display-web-test-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  return directory;
}

test('WEB scenario registry rejects mismatched integration and surface before the managed run starts', () => {
  assert.deepEqual(WEB_SCENARIOS, [
    'admin-runtime',
    'screen-error-member-journey',
    'screen-error-secondary-journey',
    'layer-error-production-journey',
    'keyboard-login',
    'keyboard-member-journey',
    'keyboard-overlay-ownership',
    'textinput-contextmenu',
  ]);
  assert.equal(webScenarioScopeError({
    integrationName: 'sample-console',
    webScenario: 'keyboard-login',
    surfaceForm: 'laptop',
    failureOwner: null,
  }), 'WEB_KEYBOARD_JOURNEY_SCOPE_INVALID');
  assert.equal(webScenarioScopeError({
    integrationName: 'sample-console',
    webScenario: 'keyboard-login',
    surfaceForm: 'mobile',
    failureOwner: null,
  }), 'WEB_KEYBOARD_JOURNEY_SCOPE_INVALID');
  assert.equal(webScenarioScopeError({
    integrationName: 'sample-wallpaper-console',
    webScenario: 'keyboard-login',
    surfaceForm: 'mobile',
    failureOwner: null,
  }), null);
  assert.equal(webScenarioScopeError({
    integrationName: 'sample-console',
    webScenario: 'screen-error-secondary-journey',
    surfaceForm: 'mobile',
    failureOwner: 'screen:main:sample.desk.customer-member',
  }), 'WEB_SCREEN_ERROR_SECONDARY_JOURNEY_SCOPE_INVALID');
});

test('WEB scenario admission matrix matches each actual integration and surface consumer', () => {
  const validRows = [
    ['admin-runtime', 'sample-console', 'laptop', null],
    ['admin-runtime', 'sample-console', 'mobile', null],
    ['admin-runtime', 'sample-wallpaper-console', 'laptop', null],
    ['admin-runtime', 'sample-wallpaper-console', 'mobile', null],
    ['admin-runtime', 'sample-console', 'laptop', 'screen:main:sample.auth.login'],
    ['admin-runtime', 'sample-console', 'mobile', 'screen:main:sample.auth.login'],
    ['admin-runtime', 'sample-wallpaper-console', 'laptop', 'screen:main:sample.auth.login'],
    ['admin-runtime', 'sample-wallpaper-console', 'mobile', 'screen:main:sample.auth.login'],
    ['screen-error-member-journey', 'sample-console', 'laptop', 'screen:main:sample.desk.member-list'],
    ['screen-error-member-journey', 'sample-console', 'mobile', 'screen:main:sample.desk.member-list'],
    ['screen-error-member-journey', 'sample-console', 'laptop', 'screen:main:sample.desk.member-form'],
    ['screen-error-member-journey', 'sample-console', 'mobile', 'screen:main:sample.desk.member-form'],
    ['screen-error-secondary-journey', 'sample-console', 'laptop', 'screen:main:sample.desk.customer-member'],
    ['screen-error-secondary-journey', 'sample-console', 'laptop', 'screen:main:sample.desk.customer-welcome'],
    ['screen-error-secondary-journey', 'sample-wallpaper-console', 'laptop', 'screen:main:sample.wallpaper-console.waiting'],
    ['screen-error-secondary-journey', 'sample-wallpaper-console', 'laptop', 'screen:main:sample.wallpaper-console.welcome'],
    ...enumerateWebLayerOwnerCoverage()
      .filter(row => row.status === 'WEB_REACHABLE')
      .flatMap(row => row.surfaceForms.map(surfaceForm => [
        'layer-error-production-journey',
        row.integrationName,
        surfaceForm,
        row.owner,
      ])),
    ['keyboard-login', 'sample-wallpaper-console', 'laptop', null],
    ['keyboard-login', 'sample-wallpaper-console', 'mobile', null],
    ['keyboard-member-journey', 'sample-console', 'laptop', null],
    ['keyboard-member-journey', 'sample-console', 'mobile', null],
    ['keyboard-overlay-ownership', 'sample-console', 'laptop', null],
    ['keyboard-overlay-ownership', 'sample-console', 'mobile', null],
    ['textinput-contextmenu', 'sample-console', 'laptop', null],
    ['textinput-contextmenu', 'sample-console', 'mobile', null],
    ['textinput-contextmenu', 'sample-wallpaper-console', 'laptop', null],
    ['textinput-contextmenu', 'sample-wallpaper-console', 'mobile', null],
  ];
  for (const [webScenario, integrationName, surfaceForm, failureOwner] of validRows) {
    assert.equal(webScenarioScopeError({integrationName, webScenario, surfaceForm, failureOwner}), null,
      `WEB_SCENARIO_EXPECTED_ADMITTED:${[webScenario, integrationName, surfaceForm, failureOwner].join('|')}`);
  }
  const keyOf = ([webScenario, integrationName, surfaceForm, failureOwner]) =>
    `${webScenario}|${integrationName}|${surfaceForm}|${failureOwner ?? '<none>'}`;
  const allowed = new Set(validRows.map(keyOf));
  const failureOwners = [
    null,
    'screen:main:sample.auth.login',
    'screen:main:sample.desk.member-list',
    'screen:main:sample.desk.member-form',
    'screen:main:sample.desk.customer-welcome',
    'screen:main:sample.desk.customer-member',
    'screen:main:sample.wallpaper-console.waiting',
    'screen:main:sample.wallpaper-console.welcome',
    ...Object.keys(WEB_LAYER_OWNER_COVERAGE),
    'unknown-owner',
  ];
  for (const webScenario of WEB_SCENARIOS) {
    for (const integrationName of ['sample-console', 'sample-wallpaper-console']) {
      for (const surfaceForm of ['laptop', 'mobile']) {
        for (const failureOwner of failureOwners) {
          const row = [webScenario, integrationName, surfaceForm, failureOwner];
          const result = webScenarioScopeError({integrationName, webScenario, surfaceForm, failureOwner});
          assert.equal(result === null, allowed.has(keyOf(row)),
            `WEB_SCENARIO_ADMISSION_MISMATCH:${keyOf(row)}:${result ?? 'ADMITTED'}`);
        }
      }
    }
  }
});

test('W4 layer inventory expands to all 14 integration-owner pairs without converting OPEN rows to PASS', () => {
  const rows = enumerateWebLayerOwnerCoverage();
  const expectedOwnerNames = [
    'layer:admin.console.layer',
    'layer:admin.console.power-confirmation.layer',
    'layer:sample.auth.notice',
    'layer:sample.auth.system-notice',
    'layer:sample.desk.waiting-confirm',
    'layer:sample.desk.registry-notice',
    'layer:sample.desk.discard-confirm',
    'layer:sample.desk.withdraw-confirm',
    'layer:sample.desk.system-notice',
    'layer:sample.wallpaper.system-notice',
  ].sort();
  assert.deepEqual(Object.keys(WEB_LAYER_OWNER_COVERAGE).sort(), expectedOwnerNames);
  assert.equal(rows.length, 14);
  const pairKey = row => `${row.integrationName}|${row.owner}`;
  const expectedOpenPairs = [
    'sample-console|layer:admin.console.power-confirmation.layer',
    'sample-wallpaper-console|layer:admin.console.power-confirmation.layer',
    'sample-console|layer:sample.auth.system-notice',
    'sample-wallpaper-console|layer:sample.auth.system-notice',
    'sample-console|layer:sample.desk.system-notice',
    'sample-wallpaper-console|layer:sample.wallpaper.system-notice',
  ].sort();
  const expectedReachablePairs = [
    'sample-console|layer:admin.console.layer',
    'sample-wallpaper-console|layer:admin.console.layer',
    'sample-console|layer:sample.auth.notice',
    'sample-wallpaper-console|layer:sample.auth.notice',
    'sample-console|layer:sample.desk.waiting-confirm',
    'sample-console|layer:sample.desk.registry-notice',
    'sample-console|layer:sample.desk.discard-confirm',
    'sample-console|layer:sample.desk.withdraw-confirm',
  ].sort();
  assert.deepEqual(rows.filter(row => row.status === 'OPEN').map(pairKey).sort(), expectedOpenPairs);
  assert.deepEqual(rows.filter(row => row.status === 'WEB_REACHABLE').map(pairKey).sort(), expectedReachablePairs);
  assert.ok(rows.filter(row => row.status === 'OPEN').every(row => row.reason?.length > 0));
  assert.equal(webScenarioScopeError({
    integrationName: 'sample-wallpaper-console',
    webScenario: 'layer-error-production-journey',
    surfaceForm: 'laptop',
    failureOwner: 'layer:sample.wallpaper.system-notice',
  }), 'WEB_LAYER_ERROR_OWNER_WEB_TRIGGER_OPEN:layer:sample.wallpaper.system-notice');
  assert.equal(webScenarioScopeError({
    integrationName: 'sample-console',
    webScenario: 'layer-error-production-journey',
    surfaceForm: 'mobile',
    failureOwner: 'layer:sample.desk.withdraw-confirm',
  }), 'WEB_LAYER_ERROR_PRODUCTION_JOURNEY_SCOPE_INVALID');
  assert.equal(webScenarioScopeError({
    integrationName: 'sample-console',
    webScenario: 'layer-error-production-journey',
    surfaceForm: 'mobile',
    failureOwner: 'layer:sample.desk.registry-notice',
  }), 'WEB_LAYER_ERROR_PRODUCTION_JOURNEY_SCOPE_INVALID');
  assert.equal(webScenarioScopeError({
    integrationName: 'sample-console',
    webScenario: 'layer-error-production-journey',
    surfaceForm: 'laptop',
    failureOwner: 'layer:sample.desk.registry-notice',
  }), null);
});

test('admin-shell runtime color oracle is distinct and exact for each integration', () => {
  assert.deepEqual(EXPECTED_ADMIN_SHELL_COLOR_BY_INTEGRATION, {
    'sample-console': {token: '16 29 49', computed: 'rgb(16, 29, 49)'},
    'sample-wallpaper-console': {token: '255 255 255', computed: 'rgb(255, 255, 255)'},
  });
  for (const [integration, expected] of Object.entries(EXPECTED_ADMIN_SHELL_COLOR_BY_INTEGRATION)) {
    const themePath = path.join(repositoryRoot, 'apps/terminal/ui/integration', integration, 'theme/global.css');
    const css = fs.readFileSync(themePath, 'utf8');
    const token = css.match(/--color-admin-shell-surface:\s*([^;]+);/)?.[1]?.trim();
    assert.equal(token, expected.token, `WEB_ADMIN_SHELL_THEME_TOKEN_MISMATCH:${integration}`);
  }
});

test('W9 color oracle selects the registered outer shell frame, not the white content panel', () => {
  assert.equal(ADMIN_SHELL_FRAME_SELECTOR, '[data-testid^="terminal.admin:frame:"]');
  const runner = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  assert.match(runner, /page\.locator\(ADMIN_SHELL_FRAME_SELECTOR\)/);
  assert.doesNotMatch(runner, /page\.getByTestId\('terminal\.admin:shell:panel'\)/);

  const registry = fs.readFileSync(
    path.join(repositoryRoot, 'apps/terminal/ui/base/admin-shell/src/foundations/adminFrameRegistry.ts'),
    'utf8',
  );
  assert.match(registry, /`terminal\.admin:frame:\$\{id\}`/);
  for (const [component, shellAppearance] of [
    ['AdminShellFrameLaptop.tsx', 'admin-shell'],
    ['AdminShellFrameMobile.tsx', 'admin-shell-mobile'],
  ]) {
    const source = fs.readFileSync(
      path.join(repositoryRoot, 'apps/terminal/ui/base/admin-shell/src/components', component),
      'utf8',
    );
    assert.match(source, new RegExp(`<PrimitiveContainer\\s+testID=\\{adminFrameTestId\\([\\s\\S]*?appearance="${shellAppearance}"`));
    assert.match(source, /<PrimitiveContainer\s+testID=\{adminTestIds\.panel\.frame\}[\s\S]*?appearance="admin-content"/);
  }
});

test('TextInput context-menu run has an exact per-integration and per-surface denominator', () => {
  assert.deepEqual(EXPECTED_TEXTINPUT_PROBE_COUNT, {
    'sample-console': {laptop: 7, mobile: 6},
    'sample-wallpaper-console': {laptop: 3, mobile: 2},
  });
  for (const [integrationName, surfaceForms] of Object.entries(EXPECTED_TEXTINPUT_PROBE_COUNT)) {
    for (const [surfaceForm, expected] of Object.entries(surfaceForms)) {
      assert.equal(expectedTextInputProbeCount({integrationName, surfaceForm}), expected);
    }
  }
  assert.throws(() => expectedTextInputProbeCount({integrationName: 'unknown', surfaceForm: 'laptop'}), {
    message: 'TER_ADMIN_DISPLAY_WEB_TEXTINPUT_SCOPE_INVALID',
  });
  assert.deepEqual(EXPECTED_TEXTINPUT_PROBE_IDS, {
    'sample-console': {
      laptop: [
        'sample.auth.login:operator-name',
        'sample.auth.login:passcode',
        'sample.desk.member-form:name',
        'sample.desk.member-form:phone',
        'sample.desk.member-form:keyboard-alpha-probe',
        'sample.desk.member-form:keyboard-financial-probe',
        'terminal.admin:topology:host',
      ],
      mobile: [
        'sample.auth.login:operator-name',
        'sample.auth.login:passcode',
        'sample.desk.member-form:name',
        'sample.desk.member-form:phone',
        'sample.desk.member-form:keyboard-alpha-probe',
        'sample.desk.member-form:keyboard-financial-probe',
      ],
    },
    'sample-wallpaper-console': {
      laptop: ['sample.auth.login:operator-name', 'sample.auth.login:passcode', 'terminal.admin:topology:host'],
      mobile: ['sample.auth.login:operator-name', 'sample.auth.login:passcode'],
    },
  });
  for (const [integrationName, forms] of Object.entries(EXPECTED_TEXTINPUT_PROBE_IDS)) {
    for (const [surfaceForm, ids] of Object.entries(forms)) {
      assert.equal(expectedTextInputProbeIds({integrationName, surfaceForm}).length, expectedTextInputProbeCount({
        integrationName,
        surfaceForm,
      }));
    }
  }
  const appSources = collectWebSourceFiles(repositoryRoot)
    .filter(file => file.startsWith('apps/terminal/') && /\.[cm]?[jt]sx?$/.test(file))
    .filter(file => !/(^|\/)(test|__tests__)(\/|$)|\.(test|spec)\./.test(file));
  const appSourceText = appSources.map(file => [file, fs.readFileSync(path.join(repositoryRoot, file), 'utf8')]);
  const allExpectedIds = new Set(Object.values(EXPECTED_TEXTINPUT_PROBE_IDS)
    .flatMap(forms => Object.values(forms).flat()));
  for (const expectedId of allExpectedIds) {
    assert.ok(
      appSourceText.some(([, source]) => source.includes(expectedId)),
      `WEB_TEXTINPUT_DENOMINATOR_ID_NOT_IN_PRODUCTION_SOURCE:${expectedId}`,
    );
  }
  const expectedIds = expectedTextInputProbeIds({integrationName: 'sample-console', surfaceForm: 'laptop'});
  const validObservations = expectedIds.flatMap(testID => [
    {testID, state: 'empty'},
    {testID, state: 'existing-text'},
  ]);
  assert.equal(textInputProbeMismatch(validObservations, expectedIds), null);
  assert.equal(
    textInputProbeMismatch(
      validObservations.filter(observation => observation.testID !== expectedIds[0]),
      expectedIds,
    ),
    'WEB_TEXTINPUT_CONTEXTMENU_FIELD_SET_MISMATCH',
  );
  assert.equal(
    textInputProbeMismatch([...validObservations, {testID: expectedIds[0], state: 'empty'}], expectedIds),
    'WEB_TEXTINPUT_CONTEXTMENU_DUPLICATE_STATE',
  );
  assert.equal(
    textInputProbeMismatch(validObservations.filter(item => item.state !== 'existing-text'), expectedIds),
    'WEB_TEXTINPUT_CONTEXTMENU_STATE_COUNT_MISMATCH',
  );
});

test('persistent admin-layer failure is OPEN unless a fresh launcher request completes', () => {
  const noRequest = classifyAdminLauncherFailureRecoveryLog('');
  assert.deepEqual(noRequest, {status: 'OPEN', openRequests: 0, completedResults: 0});
  const failedRequest = classifyAdminLauncherFailureRecoveryLog([
    JSON.stringify({event: 'admin.launcher-open-requested'}),
    JSON.stringify({event: 'admin.launcher-open-result', data: {status: 'failed'}}),
  ].join('\n'));
  assert.deepEqual(failedRequest, {status: 'OPEN', openRequests: 1, completedResults: 0});
  const completedRequest = classifyAdminLauncherFailureRecoveryLog([
    JSON.stringify({event: 'admin.launcher-open-requested'}),
    JSON.stringify({event: 'admin.launcher-open-result', data: {status: 'completed'}}),
  ].join('\n'));
  assert.deepEqual(completedRequest, {status: 'PASS', openRequests: 1, completedResults: 1});
  const unmatchedResult = classifyAdminLauncherFailureRecoveryLog([
    JSON.stringify({event: 'admin.launcher-open-requested'}),
    JSON.stringify({event: 'admin.launcher-open-result', data: {status: 'completed'}}),
    JSON.stringify({event: 'admin.launcher-open-result', data: {status: 'failed'}}),
  ].join('\n'));
  assert.deepEqual(unmatchedResult, {status: 'OPEN', openRequests: 1, completedResults: 1});
  const resultBeforeRequest = classifyAdminLauncherFailureRecoveryLog([
    JSON.stringify({event: 'admin.launcher-open-result', data: {status: 'completed'}}),
    JSON.stringify({event: 'admin.launcher-open-requested'}),
  ].join('\n'));
  assert.deepEqual(resultBeforeRequest, {status: 'OPEN', openRequests: 1, completedResults: 1});
  const duplicatedRequests = classifyAdminLauncherFailureRecoveryLog([
    JSON.stringify({event: 'admin.launcher-open-requested'}),
    JSON.stringify({event: 'admin.launcher-open-result', data: {status: 'completed'}}),
    JSON.stringify({event: 'admin.launcher-open-requested'}),
    JSON.stringify({event: 'admin.launcher-open-result', data: {status: 'completed'}}),
  ].join('\n'));
  assert.deepEqual(duplicatedRequests, {status: 'OPEN', openRequests: 2, completedResults: 2});
  const source = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  assert.match(source, /WEB_ADMIN_LAUNCHER_NOT_PROVEN_USABLE_WHILE_ADMIN_LAYER_FAILURE_PERSISTS/);
  assert.match(source, /manifest\.business = 'OPEN'/);
  assert.doesNotMatch(source, /adminLauncherRemainedUsable:\s*true/);
  assert.equal((source.match(/observeAdminLauncherAfterFailure\(/g) ?? []).length, 5);
});

test('W2 sends pointer probe, Tab, Shift+Tab, scanner suffix, and Enter in order', async () => {
  const observed = [];
  const keyboard = Object.fromEntries(['type', 'press', 'down', 'up'].map(method => [
    method,
    async value => observed.push([method, value]),
  ]));
  await sendProtectedInputKeyboardProbe(keyboard);
  assert.deepEqual(observed, [
    ['type', 'Z'],
    ['press', 'Tab'],
    ['down', 'Shift'],
    ['press', 'Tab'],
    ['up', 'Shift'],
    ['type', 'SCAN'],
    ['press', 'Enter'],
  ]);
  const source = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  assert.match(source, /coveredStaffFieldsUnchangedAfterPointerKeyboardTabShiftTabAndScannerSuffix/);
  assert.match(source, /WEB_OVERLAY_COVERED_STAFF_FIELD_ACCEPTED_WRITE/);
});

test('Expo launch opts into CI mode without unsupported non-interactive flag', () => {
  const inheritedEnv = {PATH: '/usr/bin', CI: '0'};
  const spec = createExpoWebLaunchSpec('/repo/apps/terminal/ui/integration/sample-console', 8093, inheritedEnv);
  assert.equal(spec.command, 'yarn');
  assert.deepEqual(spec.args, ['web', '--port', '8093']);
  assert.deepEqual(spec.options, {
    cwd: '/repo/apps/terminal/ui/integration/sample-console',
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {PATH: '/usr/bin', CI: '1'},
  });
});

test('Expo readiness requests are individually bounded by an aborting timeout', async () => {
  let observedSignal;
  const request = fetchExpoWebReadiness((_url, {signal}) => {
    observedSignal = signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), {once: true});
    });
  }, 'http://127.0.0.1:8093/', 5);

  await assert.rejects(request, error => error?.name === 'TimeoutError');
  assert.equal(observedSignal.aborted, true);
  const runner = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  assert.match(runner, /fetchExpoWebReadiness\(fetch,/);
});

test('Expo stdout and stderr both remain attached until the runner closes the shared log', async () => {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let contents = '';
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      contents += chunk.toString();
      callback();
    },
  });
  pipeExpoOutput(stdout, stderr, destination);
  stdout.end('stdout-first\n');
  await once(stdout, 'end');
  assert.equal(destination.writableEnded, false);
  stderr.end('stderr-after-stdout\n');
  await once(stderr, 'end');
  destination.end();
  await once(destination, 'finish');
  assert.equal(contents, 'stdout-first\nstderr-after-stdout\n');
});

test('managed child spawn helper turns both spawn and exec errors into bounded results', async () => {
  const spawnedChild = new EventEmitter();
  const spawned = awaitManagedChildSpawn(spawnedChild);
  spawnedChild.emit('spawn');
  assert.equal(await spawned, null);

  const failedChild = new EventEmitter();
  const failure = new Error('missing executable');
  failure.code = 'ENOENT';
  const failed = awaitManagedChildSpawn(failedChild);
  failedChild.emit('error', failure);
  assert.equal(await failed, failure);
});

test('Expo readiness requires an exclusively free port and a listener owned by the run process tree', () => {
  assert.deepEqual(parseListeningProcessIds('', 1, ''), []);
  assert.deepEqual(parseListeningProcessIds('412\n412\n 413\n', 0), [412, 413]);
  assert.throws(() => parseListeningProcessIds('not-a-pid\n', 0), {
    message: 'WEB_PORT_LISTENER_READBACK_MALFORMED',
  });
  assert.throws(() => parseListeningProcessIds('', 1, 'permission denied'), {
    message: 'WEB_PORT_LISTENER_READBACK_FAILED',
  });
  assert.throws(() => parseListeningProcessIds('', 2, ''), {
    message: 'WEB_PORT_LISTENER_READBACK_FAILED',
  });

  const ownedTree = [
    {pid: 500, ownershipUnverified: false},
    {pid: 501, ownershipUnverified: false},
  ];
  assert.equal(assertManagedWebListenerOwnership([501], ownedTree), true);
  assert.throws(() => assertManagedWebListenerOwnership([900], ownedTree), {
    message: 'WEB_PORT_LISTENER_NOT_OWNED_BY_RUNNER',
  });
  assert.throws(() => assertManagedWebListenerOwnership([501], [
    {pid: 501, ownershipUnverified: true},
  ]), {
    message: 'WEB_PORT_LISTENER_NOT_OWNED_BY_RUNNER',
  });
  assert.throws(() => assertManagedWebListenerOwnership([], ownedTree), {
    message: 'WEB_PORT_LISTENER_NOT_OBSERVED',
  });
  assert.deepEqual(verifyExpoWebListenerOwnership({
    stdout: '501\n',
    status: 0,
    ownedProcessTree: ownedTree,
  }), [501]);
  assert.throws(() => verifyExpoWebListenerOwnership({
    stdout: '900\n',
    status: 0,
    ownedProcessTree: ownedTree,
  }), {
    message: 'WEB_PORT_LISTENER_NOT_OWNED_BY_RUNNER',
  });

  const runner = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  assert.ok(runner.indexOf("'WEB_PORT_ALREADY_IN_USE'") < runner.indexOf('expo = spawn('));
  assert.match(runner, /verifyExpoWebListenerOwnership\(\{/);
  assert.match(runner, /port-readback\.json/);
  assert.doesNotMatch(runner, /verifyExpoWebListenerOwnership\([\s\S]*?\)\s*;?\s*\}\s*catch\s*\{\}/);
  assert.doesNotMatch(runner, /terminal\.admin:topology:action:return-choice/);
});

test('source inventory contains all tracked and active app files plus runner inputs and rejects path escape', () => {
  const files = collectWebSourceFiles(repositoryRoot);
  for (const expected of [
    'apps/terminal/ui/feature/sample-staff-auth/src/components/mobile/StaffLogin.tsx',
    'apps/terminal/ui/feature/sample-member-desk/src/components/mobile/MemberForm.tsx',
    'apps/terminal/ui/feature/sample-wallpaper-picker/src/components/mobile/WallpaperPicker.tsx',
    'package.json',
    'yarn.lock',
    'scripts/test/ter-admin-display-web.mjs',
    'scripts/test/ter-admin-display-web-contract.mjs',
  ]) assert.ok(files.includes(expected), `WEB_SOURCE_INVENTORY_MISSING:${expected}`);
  assert.equal(files.length, new Set(files).size);
  assert.throws(() => collectWebSourceFiles(repositoryRoot, () => '../outside.ts'), {
    message: 'TER_ADMIN_DISPLAY_WEB_SOURCE_PATH_INVALID',
  });
  assert.throws(() => collectWebSourceFiles(repositoryRoot, () => `${path.sep}outside.ts`), {
    message: 'TER_ADMIN_DISPLAY_WEB_SOURCE_PATH_INVALID',
  });
  assert.throws(() => collectWebSourceFiles(repositoryRoot, () => 'package.json'), {
    message: 'TER_ADMIN_DISPLAY_WEB_SOURCE_INVENTORY_DUPLICATE',
  });
  assert.ok(WEB_RUNNER_FIXED_SOURCE_FILES.includes('yarn.lock'));
});

test('source inventory rejects a symlink that resolves outside the repository', t => {
  const directory = temporaryDirectory(t);
  const fakeRepositoryRoot = path.join(directory, 'repository');
  const outsideFile = path.join(directory, 'outside.ts');
  fs.writeFileSync(outsideFile, 'export const outside = true;\n');
  for (const fixedSource of WEB_RUNNER_FIXED_SOURCE_FILES) {
    const fixedPath = path.join(fakeRepositoryRoot, fixedSource);
    fs.mkdirSync(path.dirname(fixedPath), {recursive: true});
    fs.writeFileSync(fixedPath, 'fixture\n');
  }
  const escapedSource = path.join(fakeRepositoryRoot, 'apps/terminal/escape.ts');
  fs.mkdirSync(path.dirname(escapedSource), {recursive: true});
  fs.symlinkSync(outsideFile, escapedSource);

  assert.throws(() => collectWebSourceFiles(fakeRepositoryRoot, () => 'apps/terminal/escape.ts'), {
    message: 'TER_ADMIN_DISPLAY_WEB_SOURCE_PATH_INVALID',
  });
});

test('source digest changes on content or inventory drift', t => {
  const directory = temporaryDirectory(t);
  const firstPath = path.join(directory, 'first.ts');
  const secondPath = path.join(directory, 'second.ts');
  fs.writeFileSync(firstPath, 'export const value = 1;\n');
  fs.writeFileSync(secondPath, 'export const next = 2;\n');
  const beforeFiles = ['first.ts', 'second.ts'];
  const before = {files: beforeFiles, sha256: hashWebSourceFiles(directory, beforeFiles)};
  fs.writeFileSync(firstPath, 'export const value = 3;\n');
  const afterContent = {files: beforeFiles, sha256: hashWebSourceFiles(directory, beforeFiles)};
  assert.equal(sourceSnapshotsMatch(before, afterContent), false);
  assert.equal(sourceSnapshotsMatch(before, {files: ['first.ts'], sha256: before.sha256}), false);
  const passingManifest = {business: 'PASS', firstFailure: null};
  assert.equal(applyWebSourceSnapshot(passingManifest, before, afterContent), 'FAIL');
  assert.deepEqual(passingManifest, {
    business: 'FAIL',
    firstFailure: 'WEB_SOURCE_CHANGED_DURING_RUN',
    sourceFilesAfterCount: 2,
    sourceSha256After: afterContent.sha256,
    sourceStable: 'FAIL',
    lastKnownGood: 'PASS',
  });
  const failedManifest = {business: 'FAIL', firstFailure: 'EARLIER_FIRST_FAILURE'};
  applyWebSourceRecheckFailure(failedManifest, new Error('fixture read failure'));
  assert.equal(failedManifest.firstFailure, 'EARLIER_FIRST_FAILURE');
  assert.equal(failedManifest.sourceStable, 'UNKNOWN');
});

test('managed Web lock is exclusive and release verifies run, PID, and start-token ownership', t => {
  const directory = temporaryDirectory(t);
  const lockPath = path.join(directory, 'web-run.lock');
  const identity = {pid: 34567, startToken: 'Mon Sep 29 12:34:56 2026'};
  const fd = acquireManagedWebRunLock(lockPath, 'web-run-001', identity);
  assert.throws(() => acquireManagedWebRunLock(lockPath, 'web-run-002', identity), {
    message: 'TER_ADMIN_DISPLAY_WEB_RUN_ALREADY_ACTIVE',
  });
  assert.throws(() => releaseManagedWebRunLock(lockPath, fd, 'other-run', identity), {
    message: 'TER_ADMIN_DISPLAY_WEB_RUN_LOCK_OWNERSHIP_MISMATCH',
  });
  assert.ok(fs.existsSync(lockPath), 'wrong owner must not unlink the active lock');
  fs.unlinkSync(lockPath);

  for (const wrongIdentity of [
    {pid: 34568, startToken: identity.startToken},
    {pid: identity.pid, startToken: 'reused-pid-different-start'},
  ]) {
    const mismatchLockPath = path.join(directory, `mismatch-${wrongIdentity.pid}.lock`);
    const mismatchFd = acquireManagedWebRunLock(mismatchLockPath, 'web-run-004', identity);
    assert.throws(() => releaseManagedWebRunLock(mismatchLockPath, mismatchFd, 'web-run-004', wrongIdentity), {
      message: 'TER_ADMIN_DISPLAY_WEB_RUN_LOCK_OWNERSHIP_MISMATCH',
    });
    assert.ok(fs.existsSync(mismatchLockPath), 'wrong PID/start token must not unlink the active lock');
    fs.unlinkSync(mismatchLockPath);
  }

  const replacedLockFd = acquireManagedWebRunLock(lockPath, 'web-run-replaced', identity);
  const originalContents = fs.readFileSync(lockPath, 'utf8');
  fs.unlinkSync(lockPath);
  fs.writeFileSync(lockPath, originalContents);
  assert.throws(() => releaseManagedWebRunLock(lockPath, replacedLockFd, 'web-run-replaced', identity), {
    message: 'TER_ADMIN_DISPLAY_WEB_RUN_LOCK_OWNERSHIP_MISMATCH',
  });
  assert.equal(fs.readFileSync(lockPath, 'utf8'), originalContents, 'replacement lock must be preserved');
  fs.unlinkSync(lockPath);

  const nextFd = acquireManagedWebRunLock(lockPath, 'web-run-003', identity);
  releaseManagedWebRunLock(lockPath, nextFd, 'web-run-003', identity);
  assert.equal(fs.existsSync(lockPath), false, 'matching owner must release the lock');
});

test('invalid scenario/integration pair fails before run directory, resource preflight, or Expo spawn', t => {
  const runId = `scope-invalid-${process.pid}-${Date.now()}`;
  const runRoot = path.join(repositoryRoot, '.runtime/ter-admin-display', runId);
  assert.equal(fs.existsSync(runRoot), false);
  const result = childProcess.spawnSync(process.execPath, [
    path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'),
    runId,
    '18993',
    '-',
    'sample-console',
    'keyboard-login',
    'laptop',
  ], {cwd: repositoryRoot, encoding: 'utf8'});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /WEB_KEYBOARD_JOURNEY_SCOPE_INVALID/);
  assert.equal(fs.existsSync(runRoot), false);
});
