import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {EventEmitter, once} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PassThrough, Writable} from 'node:stream';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {terminalBusinessMemberFixture} from './terminal-business-fixtures.mjs';
import {
  ADMIN_SHELL_FRAME_SELECTOR,
  EXPECTED_ADMIN_SHELL_COLOR_BY_INTEGRATION,
  EXPECTED_TEXTINPUT_PROBE_COUNT,
  EXPECTED_TEXTINPUT_PROBE_IDS,
  WEB_TEXTINPUT_CONTEXTMENU_UNREACHED_CONSUMERS,
  WEB_LAYER_OWNER_COVERAGE,
  WEB_RUNNER_FIXED_SOURCE_FILES,
  WEB_SCENARIOS,
  managedTestGroupWorkspaceUrl,
  managedTestServerSpaceOverrides,
  additionalTextInputContextMenuTargets,
  applyWebSourceRecheckFailure,
  applyWebSourceSnapshot,
  acquireManagedWebRunLock,
  adminLauncherGesturePagePoint,
  adminLauncherBindingReady,
  awaitManagedChildSpawn,
  assertManagedWebListenerOwnership,
  classifyAdminLauncherFailureRecoveryLog,
  classifyBrowserConsoleFailure,
  expectedActivationRejectionConsoleFailureIndexes,
  correlateManagedBackendRequest,
  correlateManagedHttpExchange,
  collectWebSourceFiles,
  createExpoWebLaunchSpec,
  expectedTextInputProbeCount,
  expectedTextInputProbeIds,
  enumerateWebLayerOwnerCoverage,
  fetchExpoWebReadiness,
  hasStartupContentFailureReadiness,
  hashWebSourceFiles,
  hasStartupCompletionEvent,
  hasUnexpectedBrowserConsoleFailures,
  isExpectedRuntimeLogEvent,
  isWallpaperRadioMarkerSelected,
  memberConfirmationReadback,
  wallpaperExitReadbackMismatch,
  launcherGeometryMatches,
  projectWebFailureDiagnostic,
  projectFrontendCommandDispatchEvents,
  webCommandDispatchMismatch,
  pipeExpoOutput,
  parseListeningProcessIds,
  parseJsonEventsAfterByteOffset,
  createWebLogCheckpoint,
  parsePlatformPortsSummaryCount,
  unresolvedScreenPlacementsAfterStartup,
  projectTerminalActivationLogEvents,
  projectTerminalConnectionHeartbeatLogEvents,
  projectManagedTdsLogLines,
  projectManagedTerminalActivationBackendLogLines,
  displayedHeartbeatRttMismatch,
  ensureContainedWebDirectory,
  WEB_TERMINAL_BUSINESS_ASSERTION_IDS,
  expectedWebAStageRows,
  expectedWebBusinessAssertionIds,
  hasManagedTerminalBrowserOrigin,
  validateWebAStageManifests,
  webBusinessAssertionSetMatches,
  releaseManagedWebRunLock,
  sendProtectedInputKeyboardProbe,
  sourceSnapshotsMatch,
  textInputProbeMismatch,
  verifyExpoWebListenerOwnership,
  webScenarioScopeError,
} from './ter-admin-display-web-contract.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeLogEvent = (event, data = {}, {category, moduleName = 'platform-ports', layer = 'kernel'} = {}) => ({
  timestamp: 1790740000000,
  level: 'info',
  category: category ?? event,
  event,
  scope: {moduleName, layer},
  data,
  security: {containsSensitiveRaw: false, maskingMode: 'masked'},
});
const TEXTINPUT_CONSUMER_SOURCE = Object.freeze({
  'sample.auth.login:operator-name':
    'apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLoginOperatorNameInput.tsx',
  'sample.auth.login:passcode': 'apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLoginPasscodeInput.tsx',
  'sample.desk.customer-member:age':
    'apps/terminal/ui/feature/sample-member-desk/src/components/CustomerMemberAgeField.tsx',
  'sample.desk.member-form:name':
    'apps/terminal/ui/feature/sample-member-desk/src/components/MemberFormScrollContent.tsx',
  'sample.desk.member-form:phone':
    'apps/terminal/ui/feature/sample-member-desk/src/components/MemberFormScrollContent.tsx',
  'sample.desk.member-form:keyboard-alpha-probe':
    'apps/terminal/ui/feature/sample-member-desk/src/components/MemberFormScrollContent.tsx',
  'sample.desk.member-form:keyboard-financial-probe':
    'apps/terminal/ui/feature/sample-member-desk/src/components/MemberFormScrollContent.tsx',
  'terminal.admin:topology:host': 'apps/terminal/ui/base/admin-shell/src/components/sections/TopologySectionLaptop.tsx',
});
const TEXTINPUT_CONSUMER_BINDING = Object.freeze({
  'sample.auth.login:operator-name': 'testID: operatorNameFieldId',
  'sample.auth.login:passcode': 'testID: passcodeFieldId',
  'sample.desk.customer-member:age': 'testID: fieldId',
  'sample.desk.member-form:name': 'testID: `${prefix}:name`',
  'sample.desk.member-form:phone': 'testID: `${prefix}:phone`',
  'sample.desk.member-form:keyboard-alpha-probe': 'testID: `${prefix}:keyboard-alpha-probe`',
  'sample.desk.member-form:keyboard-financial-probe': 'testID: `${prefix}:keyboard-financial-probe`',
  'terminal.admin:topology:host': 'testID: topologyIds.host',
});
const TEXTINPUT_PRODUCTION_CONSUMER_FILES = Object.freeze([
  {
    path: TEXTINPUT_CONSUMER_SOURCE['sample.auth.login:operator-name'],
    required: ['useInputField', 'testID: operatorNameFieldId', "layout: 'full'"],
  },
  {
    path: TEXTINPUT_CONSUMER_SOURCE['sample.auth.login:passcode'],
    required: ['useInputField', 'testID: passcodeFieldId', "layout: 'full'"],
  },
  {
    path: 'apps/terminal/ui/feature/sample-member-desk/src/components/CustomerMemberAgeField.tsx',
    required: ['const fieldId = ageFieldId(prefix);', 'useInputField', 'testID: fieldId', "layout: 'numeric'"],
  },
  {
    path: TEXTINPUT_CONSUMER_SOURCE['sample.desk.member-form:name'],
    required: [
      'testID: `${prefix}:name`',
      'testID: `${prefix}:phone`',
      'testID: `${prefix}:keyboard-alpha-probe`',
      'testID: `${prefix}:keyboard-financial-probe`',
    ],
  },
  {
    path: TEXTINPUT_CONSUMER_SOURCE['terminal.admin:topology:host'],
    required: ['useInputField', 'testID: topologyIds.host'],
  },
  {
    path: 'apps/terminal/application/android/sample-terminal/src/components/controlledKeyboardHarness.tsx',
    required: ['useInputField', "testID: 'harness:full-field'", "layout: 'full'"],
  },
  {
    path: 'apps/terminal/application/android/sample-wallpaper-terminal/src/components/controlledKeyboardHarness.tsx',
    required: ['useInputField', "testID: 'harness:full-field'", "layout: 'full'"],
  },
]);

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-admin-display-web-test-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  return directory;
}

test('WEB scenario registry rejects mismatched integration and surface before the managed run starts', () => {
  assert.deepEqual(WEB_SCENARIOS, [
    'admin-runtime',
    'platform-ports-smoke',
    'screen-error-member-journey',
    'screen-error-secondary-journey',
    'layer-error-production-journey',
    'keyboard-login',
    'keyboard-member-journey',
    'keyboard-overlay-ownership',
    'textinput-contextmenu',
    'terminal-activation-connection',
    'terminal-activation-owner-rejection',
    'terminal-server-config',
    'terminal-wallpaper-exit',
  ]);
  assert.equal(
    webScenarioScopeError({
      integrationName: 'sample-console',
      webScenario: 'keyboard-login',
      surfaceForm: 'laptop',
      failureOwner: null,
    }),
    'WEB_KEYBOARD_JOURNEY_SCOPE_INVALID',
  );
  assert.equal(
    webScenarioScopeError({
      integrationName: 'sample-console',
      webScenario: 'keyboard-login',
      surfaceForm: 'mobile',
      failureOwner: null,
    }),
    'WEB_KEYBOARD_JOURNEY_SCOPE_INVALID',
  );
  assert.equal(
    webScenarioScopeError({
      integrationName: 'sample-wallpaper-console',
      webScenario: 'keyboard-login',
      surfaceForm: 'mobile',
      failureOwner: null,
    }),
    null,
  );
  assert.equal(
    webScenarioScopeError({
      integrationName: 'sample-console',
      webScenario: 'screen-error-secondary-journey',
      surfaceForm: 'mobile',
      failureOwner: 'screen:main:sample.desk.customer-member',
    }),
    'WEB_SCREEN_ERROR_SECONDARY_JOURNEY_SCOPE_INVALID',
  );
  assert.equal(
    webScenarioScopeError({
      integrationName: 'sample-wallpaper-console',
      webScenario: 'platform-ports-smoke',
      surfaceForm: 'laptop',
      failureOwner: null,
    }),
    'WEB_PLATFORM_PORTS_SMOKE_SCOPE_INVALID',
  );
  assert.equal(
    webScenarioScopeError({
      integrationName: 'sample-console',
      webScenario: 'platform-ports-smoke',
      surfaceForm: 'mobile',
      failureOwner: null,
    }),
    'WEB_PLATFORM_PORTS_SMOKE_SCOPE_INVALID',
  );
});

test('managed DEV group-workspace URL is loopback-only and uses the selected fixture route', () => {
  const manifest = {
    kind: 'r5-dev-run-manifest',
    runId: 'r5-dev-1790922860937-77212-d6aee404-6382-43b0-804f-b9becf3f5c3c',
    localHttpBaseUrl: 'http://127.0.0.1:28080',
    localTdsWebSocketBaseUrl: 'ws://127.0.0.1:28180',
    localTdsEntryTwoWebSocketBaseUrl: 'ws://127.0.0.1:28181',
  };
  assert.equal(managedTestGroupWorkspaceUrl(manifest), 'http://127.0.0.1:28080/api/terminal/group-workspaces/aurora');
  assert.throws(
    () => managedTestGroupWorkspaceUrl({...manifest, localHttpBaseUrl: 'http://192.0.2.8:28080'}),
    /WEB_MANAGED_DEV_GROUP_WORKSPACE_INPUT_INVALID/,
  );
  assert.throws(
    () => managedTestGroupWorkspaceUrl(manifest, '../outside'),
    /WEB_MANAGED_DEV_GROUP_WORKSPACE_INPUT_INVALID/,
  );
  assert.deepEqual(managedTestServerSpaceOverrides(manifest), {
    businessBaseUrl: 'http://127.0.0.1:28080/api/terminal/group-workspaces/aurora',
    tdsEntryOneWebSocketBaseUrl: 'ws://127.0.0.1:28180',
    tdsEntryTwoWebSocketBaseUrl: 'ws://127.0.0.1:28181',
  });
  assert.throws(
    () => managedTestServerSpaceOverrides({...manifest, localTdsEntryTwoWebSocketBaseUrl: 'ws://192.0.2.2:28181'}),
    /WEB_MANAGED_DEV_TDS_ENTRY_URL_INVALID/,
  );
  assert.throws(
    () =>
      managedTestServerSpaceOverrides({
        ...manifest,
        localTdsEntryTwoWebSocketBaseUrl: manifest.localTdsWebSocketBaseUrl,
      }),
    /WEB_MANAGED_DEV_TDS_ENTRIES_NOT_DISTINCT/,
  );
});

test('managed terminal Web acceptance requires the exact DEV CORS origin and port', () => {
  assert.equal(hasManagedTerminalBrowserOrigin(['http://127.0.0.1:8093'], 8093), true);
  assert.equal(hasManagedTerminalBrowserOrigin(['http://localhost:8093'], 8093), false);
  assert.equal(hasManagedTerminalBrowserOrigin(['http://127.0.0.1:8093'], 8094), false);
  assert.equal(hasManagedTerminalBrowserOrigin(['*'], 8093), false);
  assert.equal(hasManagedTerminalBrowserOrigin(null, 8093), false);
});

test('wallpaper Web selection reads the production radio marker exactly', () => {
  assert.equal(isWallpaperRadioMarkerSelected(' • '), true);
  assert.equal(isWallpaperRadioMarkerSelected(''), false);
  assert.equal(isWallpaperRadioMarkerSelected('w1'), false);
  assert.equal(isWallpaperRadioMarkerSelected(null), false);
});

test('wallpaper exit readback handles the valid no-wallpaper state without requiring an image node', () => {
  assert.equal(
    wallpaperExitReadbackMismatch({
      wallpaperId: 'none',
      homeRouteObserved: true,
      backgroundCount: 0,
      backgroundLabel: null,
    }),
    null,
  );
  assert.equal(
    wallpaperExitReadbackMismatch({
      wallpaperId: 'none',
      homeRouteObserved: true,
      backgroundCount: 1,
      backgroundLabel: '当前壁纸：山景',
    }),
    'WEB_WALLPAPER_EXIT_NONE_BACKGROUND_PRESENT',
  );
  assert.equal(
    wallpaperExitReadbackMismatch({
      wallpaperId: 'w2',
      homeRouteObserved: true,
      backgroundCount: 1,
      backgroundLabel: '当前壁纸：湖景',
    }),
    null,
  );
  assert.equal(
    wallpaperExitReadbackMismatch({
      wallpaperId: 'w2',
      homeRouteObserved: true,
      backgroundCount: 0,
      backgroundLabel: null,
    }),
    'WEB_WALLPAPER_EXIT_CHANGED_CONFIRMED_VALUE',
  );
  assert.equal(
    wallpaperExitReadbackMismatch({
      wallpaperId: 'none',
      homeRouteObserved: false,
      backgroundCount: 0,
      backgroundLabel: null,
    }),
    'WEB_WALLPAPER_EXIT_HOME_ROUTE_NOT_OBSERVED',
  );
});

test('activation latency selector must match a real same-run matched PONG rather than an initial sentinel', () => {
  const heartbeat = [{sequence: 7, rttMs: 42}];
  assert.equal(displayedHeartbeatRttMismatch('连接延时：42 ms', heartbeat), null);
  assert.equal(
    displayedHeartbeatRttMismatch('连接延时：0 ms', heartbeat),
    'WEB_TERMINAL_HEARTBEAT_RTT_SELECTOR_MISMATCH',
  );
  assert.equal(displayedHeartbeatRttMismatch('连接延时：0 ms', []), 'WEB_TERMINAL_HEARTBEAT_RTT_NOT_OBSERVED');
  assert.equal(displayedHeartbeatRttMismatch('等待主机状态', heartbeat), 'WEB_TERMINAL_HEARTBEAT_RTT_NOT_OBSERVED');
});

test('all four terminal entry packages declare business HTTP and two HAProxy TDS addresses', () => {
  const packagePaths = [
    'apps/terminal/ui/integration/sample-console/package.json',
    'apps/terminal/ui/integration/sample-wallpaper-console/package.json',
    'apps/terminal/application/android/sample-terminal/package.json',
    'apps/terminal/application/android/sample-wallpaper-terminal/package.json',
  ];
  for (const packagePath of packagePaths) {
    const packageConfig = JSON.parse(fs.readFileSync(path.join(repositoryRoot, packagePath), 'utf8'));
    const config = packageConfig.serverSpaces;
    assert.equal(config.selectedSpace, 'development', packagePath);
    assert.equal(config.spaces.length, 1, packagePath);
    const development = config.spaces[0];
    assert.equal(development.name, 'development', packagePath);
    assert.deepEqual(
      development.servers.map(server => server.serverName).sort(),
      ['business', 'terminal-data-server'],
      packagePath,
    );
    assert.deepEqual(
      development.servers.find(server => server.serverName === 'terminal-data-server')?.addresses,
      [
        {addressName: 'haproxy-entry-one', baseUrl: 'ws://127.0.0.1:28180', timeoutMs: 10000},
        {addressName: 'haproxy-entry-two', baseUrl: 'ws://127.0.0.1:28181', timeoutMs: 10000},
      ],
      packagePath,
    );
  }
});

test('WEB scenario admission matrix matches each actual integration and surface consumer', () => {
  const validRows = [
    ['platform-ports-smoke', 'sample-console', 'laptop', null],
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
    [
      'screen-error-secondary-journey',
      'sample-wallpaper-console',
      'laptop',
      'screen:main:sample.wallpaper-console.waiting',
    ],
    [
      'screen-error-secondary-journey',
      'sample-wallpaper-console',
      'laptop',
      'screen:main:sample.wallpaper-console.welcome',
    ],
    ...enumerateWebLayerOwnerCoverage()
      .filter(row => row.status === 'WEB_REACHABLE')
      .flatMap(row =>
        row.surfaceForms.map(surfaceForm => [
          'layer-error-production-journey',
          row.integrationName,
          surfaceForm,
          row.owner,
        ]),
      ),
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
    ...['sample-console', 'sample-wallpaper-console'].flatMap(integrationName =>
      ['laptop', 'mobile'].map(surfaceForm => ['terminal-activation-connection', integrationName, surfaceForm, null]),
    ),
    ...['sample-console', 'sample-wallpaper-console'].map(integrationName => [
      'terminal-activation-owner-rejection',
      integrationName,
      'laptop',
      null,
    ]),
    ...['sample-console', 'sample-wallpaper-console'].flatMap(integrationName =>
      ['laptop', 'mobile'].map(surfaceForm => ['terminal-server-config', integrationName, surfaceForm, null]),
    ),
    ['terminal-wallpaper-exit', 'sample-wallpaper-console', 'laptop', null],
  ];
  for (const [webScenario, integrationName, surfaceForm, failureOwner] of validRows) {
    assert.equal(
      webScenarioScopeError({integrationName, webScenario, surfaceForm, failureOwner}),
      null,
      `WEB_SCENARIO_EXPECTED_ADMITTED:${[webScenario, integrationName, surfaceForm, failureOwner].join('|')}`,
    );
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
          assert.equal(
            result === null,
            allowed.has(keyOf(row)),
            `WEB_SCENARIO_ADMISSION_MISMATCH:${keyOf(row)}:${result ?? 'ADMITTED'}`,
          );
        }
      }
    }
  }
});

test('Web business scenario catalog names the exact per-run A-ID evidence set', () => {
  assert.deepEqual(
    expectedWebBusinessAssertionIds({
      webScenario: 'terminal-activation-connection',
      integrationName: 'sample-console',
      surfaceForm: 'laptop',
    }),
    ['A-02', 'A-03a', 'A-05a', 'A-10a', 'A-11a', 'A-13a'],
  );
  assert.deepEqual(
    expectedWebBusinessAssertionIds({
      webScenario: 'terminal-activation-owner-rejection',
      integrationName: 'sample-console',
      surfaceForm: 'laptop',
    }),
    ['A-04a'],
  );
  assert.deepEqual(
    expectedWebBusinessAssertionIds({
      webScenario: 'terminal-server-config',
      integrationName: 'sample-console',
      surfaceForm: 'mobile',
    }),
    ['A-06a', 'A-07a'],
  );
  assert.deepEqual(
    expectedWebBusinessAssertionIds({
      webScenario: 'terminal-wallpaper-exit',
      integrationName: 'sample-wallpaper-console',
      surfaceForm: 'laptop',
    }),
    ['A-02', 'A-03a', 'A-05a', 'A-10a', 'A-14b'],
  );
  assert.throws(
    () =>
      expectedWebBusinessAssertionIds({
        webScenario: 'terminal-wallpaper-exit',
        integrationName: 'sample-wallpaper-console',
        surfaceForm: 'mobile',
      }),
    /WEB_TERMINAL_BUSINESS_ASSERTION_SCOPE_INVALID/u,
  );
  assert.deepEqual(Object.keys(WEB_TERMINAL_BUSINESS_ASSERTION_IDS), [
    'terminal-activation-connection',
    'terminal-activation-owner-rejection',
    'terminal-server-config',
    'terminal-wallpaper-exit',
  ]);
});

test('Web business evidence rejects a missing, extra, or duplicated observed assertion id', () => {
  const expected = ['A-02', 'A-05a', 'A-10a'];
  assert.equal(webBusinessAssertionSetMatches(expected, ['A-10a', 'A-02', 'A-05a']), true);
  assert.equal(webBusinessAssertionSetMatches(expected, ['A-02', 'A-10a']), false);
  assert.equal(webBusinessAssertionSetMatches(expected, ['A-02', 'A-05a', 'A-10a', 'A-11a']), false);
  assert.equal(webBusinessAssertionSetMatches(expected, ['A-02', 'A-05a', 'A-10a', 'A-10a']), false);
});

test('Web A-stage gate requires all exact rows, assertion ids, cleanups, and current source bytes', () => {
  const sourceSha256 = 'a'.repeat(64);
  const managedDevRunId = 'r5-dev-1790922860937-77212-d6aee404-6382-43b0-804f-b9becf3f5c3c';
  const manifests = expectedWebAStageRows().map((row, index) => ({
    runId: `web-a-${index}`,
    requestedRunId: `web-a-${index}`,
    phase: 'COMPLETE',
    business: 'PASS',
    cleanup: 'PASS',
    sourceStable: 'PASS',
    sourceSha256,
    sourceSha256After: sourceSha256,
    managedDevRunId,
    managedDevManifestSha256: 'b'.repeat(64),
    managedDevReadiness: {
      runId: managedDevRunId,
      business: {status: 'PASS'},
      tds: [{status: 'PASS'}, {status: 'PASS'}, {status: 'PASS'}],
      ingress: {status: 'PASS'},
    },
    frontendLogRead: 'PASS',
    browserConsoleFailures: [],
    managedHttpResults: [],
    expectedHttpStatusConsoleFailureIndexes: [],
    frontendRejectedCommandCount: row.webScenario === 'terminal-server-config' ? 1 : 0,
    frontendCommandEvents:
      row.webScenario === 'terminal-server-config'
        ? [
            {
              event: 'command-dispatch-rejected',
              commandName: 'kernel.base.server-config.set-server-override',
              failure: 'error',
            },
          ]
        : [],
    ...(row.businessAssertionIds.includes('A-02')
      ? {
          backendLogRead: 'PASS',
          tdsLogRead: 'PASS',
          tdsNodeLogRead: [{status: 'PASS'}, {status: 'PASS'}, {status: 'PASS'}],
          tdsServerLog: '.runtime/ter-admin-display/web-a/tds-server-events.jsonl',
          tdsServerLogEvents: [
            {event: 'tds_ws_accepted', nodeId: 'tds-a', connectionId: 'conn-1'},
            {event: 'tds_session_registered', nodeId: 'tds-a', connectionId: 'conn-1'},
          ],
          frontendBackendLogCorrelation: {activation: 'PASS', 'cancel-activation': 'PASS'},
          matchedHeartbeatRtt: {sequence: 1, rttMs: 12},
          activationResult: {tdsSessionRouteObserved: 'PASS'},
        }
      : {}),
    ...(row.businessAssertionIds.includes('A-04a')
      ? {
          backendLogRead: 'PASS',
          frontendBackendLogCorrelation: {activation: 'PASS'},
          activationRejection: {httpStatus: 409, ownerCode: 'STORE_TERMINAL_DISABLED'},
        }
      : {}),
    ...(row.businessAssertionIds.includes('A-13a')
      ? {
          memberRegistration: {
            pendingContentMatched: 'PASS',
            confirmationReadbackMatched: 'PASS',
            confirmedMemberRowCount: 1,
            matchingConfirmedMemberRowCount: 1,
            optionalAgeInputAcceptedAndSubmitted: 'PASS',
            exactAgeStateReadback: 'OWNER_FOCUSED_PROOF_REQUIRED',
          },
        }
      : {}),
    ...(row.businessAssertionIds.includes('A-06a')
      ? {
          serverConfigUi: {
            savedOverrideReadback: 'PASS',
            clearedOverrideReadback: 'PASS',
            rejectedInvalidOverrideWithoutEffectiveChange: 'PASS',
            rejectedInvalidCommand: 'kernel.base.server-config.set-server-override',
            restoredDefaultReadback: 'PASS',
          },
        }
      : {}),
    ...row,
  }));
  assert.equal(validateWebAStageManifests(manifests, sourceSha256).status, 'PASS');
  assert.equal(manifests.length, 11);
  assert.equal(
    validateWebAStageManifests(manifests.slice(1), sourceSha256).errors.some(value =>
      value.startsWith('WEB_A_ROW_MISSING:'),
    ),
    true,
  );
  assert.equal(
    validateWebAStageManifests(
      [{...manifests[0], cleanup: 'FAIL'}, ...manifests.slice(1)],
      sourceSha256,
    ).errors.includes('WEB_A_RUN_NOT_CLOSED:terminal-activation-connection|sample-console|laptop'),
    true,
  );
  assert.equal(
    validateWebAStageManifests(
      [{...manifests[0], sourceSha256After: 'b'.repeat(64)}, ...manifests.slice(1)],
      sourceSha256,
    ).errors.includes('WEB_A_SOURCE_BYTES_MISMATCH:terminal-activation-connection|sample-console|laptop'),
    true,
  );
  assert.equal(
    validateWebAStageManifests(
      [{...manifests[0], businessAssertionIds: ['A-02']}, ...manifests.slice(1)],
      sourceSha256,
    ).errors.includes('WEB_A_ASSERTION_SET_MISMATCH:terminal-activation-connection|sample-console|laptop'),
    true,
  );
  assert.equal(
    validateWebAStageManifests(
      [{...manifests[0], requestedRunId: 'web-a-other'}, ...manifests.slice(1)],
      sourceSha256,
    ).errors.includes('WEB_A_MANIFEST_RUN_ID_MISMATCH:terminal-activation-connection|sample-console|laptop'),
    true,
  );
  assert.equal(
    validateWebAStageManifests(
      [...manifests.slice(0, 1), {...manifests[1], managedDevManifestSha256: 'c'.repeat(64)}, ...manifests.slice(2)],
      sourceSha256,
    ).errors.includes('WEB_A_MANAGED_DEV_IDENTITY_MISMATCH:terminal-activation-connection|sample-console|mobile'),
    true,
  );
  assert.equal(
    validateWebAStageManifests(
      [{...manifests[0], frontendLogRead: 'LOG_NOT_AVAILABLE'}, ...manifests.slice(1)],
      sourceSha256,
    ).errors.includes('WEB_A_FRONTEND_LOG_EVIDENCE_MISSING:terminal-activation-connection|sample-console|laptop'),
    true,
  );
  const configRowIndex = manifests.findIndex(value => value.webScenario === 'terminal-server-config');
  const rejectionRowIndex = manifests.findIndex(value => value.webScenario === 'terminal-activation-owner-rejection');
  const memberRowIndex = manifests.findIndex(value => value.businessAssertionIds.includes('A-13a'));
  assert.equal(
    validateWebAStageManifests(
      [
        ...manifests.slice(0, memberRowIndex),
        {
          ...manifests[memberRowIndex],
          memberRegistration: {...manifests[memberRowIndex].memberRegistration, confirmedMemberRowCount: 2},
        },
        ...manifests.slice(memberRowIndex + 1),
      ],
      sourceSha256,
    ).errors.includes(
      'WEB_A_MEMBER_CONFIRMATION_EVIDENCE_MISSING:terminal-activation-connection|sample-console|laptop',
    ),
    true,
  );
  assert.equal(
    validateWebAStageManifests(
      [
        ...manifests.slice(0, configRowIndex),
        {...manifests[configRowIndex], frontendRejectedCommandCount: 0},
        ...manifests.slice(configRowIndex + 1),
      ],
      sourceSha256,
    ).errors.includes('WEB_A_COMMAND_REJECTION_EVIDENCE_MISMATCH:terminal-server-config|sample-console|laptop'),
    true,
  );
  const rejectedRun = {
    ...manifests[rejectionRowIndex],
    browserConsoleFailures: [
      {at: new Date(100).toISOString(), level: 'error', classification: 'HTTP_RESPONSE_STATUS_409'},
    ],
    managedHttpResults: [{at: new Date(150).toISOString(), operation: 'activation', method: 'POST', status: 409}],
    expectedHttpStatusConsoleFailureIndexes: [0],
  };
  assert.equal(
    validateWebAStageManifests(
      [...manifests.slice(0, rejectionRowIndex), rejectedRun, ...manifests.slice(rejectionRowIndex + 1)],
      sourceSha256,
    ).errors.some(value => value.startsWith('WEB_A_BROWSER_CONSOLE_EVIDENCE_MISMATCH:')),
    false,
  );
  assert.equal(
    validateWebAStageManifests(
      [
        ...manifests.slice(0, rejectionRowIndex),
        {...rejectedRun, expectedHttpStatusConsoleFailureIndexes: []},
        ...manifests.slice(rejectionRowIndex + 1),
      ],
      sourceSha256,
    ).errors.includes(
      'WEB_A_BROWSER_CONSOLE_EVIDENCE_MISMATCH:terminal-activation-owner-rejection|sample-console|laptop',
    ),
    true,
  );
  assert.equal(
    validateWebAStageManifests(
      [{...manifests[0], frontendRejectedCommandCount: 1}, ...manifests.slice(1)],
      sourceSha256,
    ).errors.includes('WEB_A_COMMAND_REJECTION_EVIDENCE_MISMATCH:terminal-activation-connection|sample-console|laptop'),
    true,
  );
  assert.equal(
    validateWebAStageManifests(
      [
        ...manifests.slice(0, configRowIndex),
        {
          ...manifests[configRowIndex],
          serverConfigUi: {
            ...manifests[configRowIndex].serverConfigUi,
            rejectedInvalidCommand: 'kernel.base.server-config.restore-defaults',
          },
        },
        ...manifests.slice(configRowIndex + 1),
      ],
      sourceSha256,
    ).errors.includes('WEB_A_SERVER_CONFIG_EVIDENCE_MISSING:terminal-server-config|sample-console|laptop'),
    true,
  );
  assert.equal(
    validateWebAStageManifests(
      [
        ...manifests.slice(0, configRowIndex),
        {
          ...manifests[configRowIndex],
          frontendCommandEvents: [
            {
              event: 'command-dispatch-rejected',
              commandName: 'kernel.base.server-config.restore-defaults',
              failure: 'error',
            },
          ],
        },
        ...manifests.slice(configRowIndex + 1),
      ],
      sourceSha256,
    ).errors.includes('WEB_A_COMMAND_REJECTION_EVIDENCE_MISMATCH:terminal-server-config|sample-console|laptop'),
    true,
  );
  assert.equal(
    validateWebAStageManifests(
      [{...manifests[0], matchedHeartbeatRtt: null}, ...manifests.slice(1)],
      sourceSha256,
    ).errors.includes(
      'WEB_A_ACTIVATION_BACKEND_TDS_OR_RTT_EVIDENCE_MISSING:terminal-activation-connection|sample-console|laptop',
    ),
    true,
  );
  assert.equal(
    validateWebAStageManifests(
      [
        {...manifests[0], tdsServerLogEvents: [{event: 'tds_ws_accepted', nodeId: 'tds-a', connectionId: 'conn-1'}]},
        ...manifests.slice(1),
      ],
      sourceSha256,
    ).errors.includes(
      'WEB_A_ACTIVATION_BACKEND_TDS_OR_RTT_EVIDENCE_MISSING:terminal-activation-connection|sample-console|laptop',
    ),
    true,
  );
});

test('managed Web business scenarios assert owner outcomes, config readback and same-run RTT identity', () => {
  const runner = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  assert.equal(runner.includes('manifest.businessAssertionIds = expectedWebBusinessAssertionIds('), false);
  for (const fragment of [
    "problem?.errorCode !== 'STORE_TERMINAL_DISABLED'",
    'response.status() !== 409',
    'WEB_TERMINAL_DISABLED_ACTIVATION_CHANGED_ROUTE',
    'timeoutLabel(10001)',
    'timeoutLabel(10000)',
    'const timeoutLabel = milliseconds => `（${milliseconds} ms）`;',
    "const configInputCount = await page.getByTestId('terminal.server-config.section').locator('input').count();",
    "recordWebScenarioStep('SERVER_CONFIG_TIMEOUT_KEYBOARD_ADVANCE', {",
    'advance <= configInputCount + 1',
    'layerId: layer.id || null',
    'layer.id !== previous',
    "(style.pointerEvents === 'none' && opacity <= 0.01) ||",
    'WEB_TERMINAL_SERVER_CONFIG_INVALID_INPUT_CHANGED_EFFECTIVE_VALUE',
    'SERVER_CONFIG_EFFECTIVE_ADDRESS_TIMEOUT_NOT_OBSERVED',
    'SERVER_CONFIG_SAVE_CLICK_RETURNED',
    'await restoreButton.click();',
    'completeWebBusinessAssertions();',
    "recordBusinessAssertion('A-02')",
    "recordBusinessAssertion('A-03a')",
    "recordBusinessAssertion('A-05a')",
    "recordBusinessAssertion('A-10a')",
    "recordBusinessAssertion('A-11a')",
    "recordBusinessAssertion('A-13a')",
    "recordBusinessAssertion('A-14a')",
    "recordBusinessAssertion('A-14b')",
    'WEB_TERMINAL_SERVER_CONFIG_PACKAGE_TDS_ADDRESS_PROJECTION_MISMATCH',
    'WEB_TERMINAL_SERVER_CONFIG_PACKAGE_BUSINESS_ADDRESS_PROJECTION_MISMATCH',
    'WEB_TERMINAL_SERVER_CONFIG_INVALID_COMMAND_REJECTION_NOT_OBSERVED',
    'WEB_TERMINAL_SERVER_CONFIG_CLEANUP_READBACK_MISMATCH',
    'BACKEND_RAW_LOG_REMOVE_FAILED',
    'TDS_RAW_LOG_REMOVE_FAILED',
    'if (cleanupManagedServerConfig !== null && managedServerConfigDirty)',
    'WEB_MEMBER_AGE_INPUT_NOT_ACCEPTED',
    "recordBusinessAssertion('A-06a')",
    "recordBusinessAssertion('A-07a')",
    "recordBusinessAssertion('A-04a')",
  ])
    assert.ok(runner.includes(fragment), `WEB_BUSINESS_ASSERTION_MISSING:${fragment}`);
  const stageRunner = fs.readFileSync(
    path.join(repositoryRoot, 'scripts/test/ter-admin-display-web-stage.mjs'),
    'utf8',
  );
  assert.ok(stageRunner.includes('validateWebAStageManifests(manifests, sourceSha256)'));
  assert.ok(stageRunner.includes("stage: 'EXPO_WEB_A'"));
  assert.ok(stageRunner.includes('frontendRejectedCommandCount: manifest.frontendRejectedCommandCount'));
  assert.ok(stageRunner.includes('frontendCommandEvents: manifest.frontendCommandEvents'));
  assert.ok(runner.includes('webCommandDispatchMismatch(webScenario, commandDispatchProjection.events)'));
});

test('Web command rejection policy permits only the asserted invalid server-config override', () => {
  const invalidOverride = [
    {
      event: 'command-dispatch-rejected',
      commandName: 'kernel.base.server-config.set-server-override',
      failure: 'error',
    },
  ];
  assert.equal(webCommandDispatchMismatch('terminal-server-config', invalidOverride), null);
  assert.equal(webCommandDispatchMismatch('terminal-server-config', []), 'WEB_COMMAND_REJECTION_COUNT_MISMATCH');
  assert.equal(
    webCommandDispatchMismatch('terminal-server-config', [...invalidOverride, ...invalidOverride]),
    'WEB_COMMAND_REJECTION_COUNT_MISMATCH',
  );
  assert.equal(
    webCommandDispatchMismatch('terminal-server-config', [
      {
        event: 'command-dispatch-rejected',
        commandName: 'kernel.base.server-config.restore-defaults',
      },
    ]),
    'WEB_COMMAND_REJECTION_COMMAND_MISMATCH',
  );
  assert.equal(
    webCommandDispatchMismatch('terminal-activation-connection', invalidOverride),
    'WEB_COMMAND_REJECTION_COUNT_MISMATCH',
  );
  assert.equal(webCommandDispatchMismatch('terminal-activation-connection', []), null);
});

test('each admitted integration Web run starts that integration test-expo assembly', () => {
  const runner = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  assert.ok(runner.includes("path.join(root, 'apps/terminal/ui/integration', integrationName)"));
  assert.ok(
    runner.includes(
      'const scenarioScopeProblem = webScenarioScopeError({integrationName, webScenario, surfaceForm, failureOwner})',
    ),
  );
  for (const row of [
    {
      integrationName: 'sample-console',
      moduleSpecifier: "import {createSampleAssembly, terminalSurfaces} from '../src';",
      assembly: 'createSampleAssembly',
    },
    {
      integrationName: 'sample-wallpaper-console',
      moduleSpecifier: "import {createSampleWallpaperConsoleAssembly, terminalSurfaces} from '../src';",
      assembly: 'createSampleWallpaperConsoleAssembly',
    },
  ]) {
    const source = fs.readFileSync(
      path.join(repositoryRoot, `apps/terminal/ui/integration/${row.integrationName}/test-expo/App.tsx`),
      'utf8',
    );
    assert.ok(source.includes("import {createTestExpoApp} from '@catering-v2s/ui-base-dev-host';"));
    assert.ok(source.includes(row.moduleSpecifier));
    assert.ok(source.includes(`appName: '${row.integrationName}'`));
    assert.ok(
      source.includes(`createAssembly: input => ${row.assembly}({...input, serverSpaces: testServerSpaces()})`),
    );
  }
});

test('managed activation Web scenario enters the 8-digit fixture through the input owner and keeps it out of diagnostics', () => {
  const runner = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  const compactRunner = runner.replace(/\s+/gu, ' ');
  assert.ok(runner.includes("const activationField = page.getByTestId('terminal.activation.code')"));
  assert.ok(runner.includes('await activationField.click();'));
  assert.ok(runner.includes('ui.base.input:virtual-keyboard:text-${digit}'));
  assert.ok(runner.includes('ui.base.input:virtual-keyboard:complete'));
  assert.ok(runner.includes("waitFor({state: 'hidden', timeout: 5_000})"));
  assert.ok(runner.includes('Promise.all([activationResponsePromise, activationClickPromise])'));
  assert.ok(runner.includes('manifest.managedHttpRequests = managedHttpRequests'));
  assert.ok(runner.includes("page.on('requestfailed'"));
  assert.ok(runner.includes("page.on('requestfinished'"));
  assert.ok(runner.includes('managedHttpFailures.push'));
  assert.ok(runner.includes('managedHttpTransfers.push'));
  assert.ok(runner.includes('managedHttpResults.push'));
  assert.ok(runner.includes("headers['x-request-id']"));
  assert.ok(runner.includes("headers['x-correlation-id']"));
  assert.ok(runner.includes('projectManagedTerminalActivationBackendLogLines'));
  assert.ok(runner.includes('manifest.frontendBackendLogCorrelation'));
  assert.ok(runner.includes('collectRemoteTdsLog'));
  assert.ok(runner.includes('projectManagedTdsLogLines'));
  assert.ok(runner.includes('hasRegisteredTdsSession'));
  assert.ok(runner.includes('readManagedTerminalBindingByName'));
  assert.ok(runner.includes("managedActivationFixtureState.bindingStatus === 'ACTIVE'"));
  assert.ok(runner.includes('TER_WEB_MANAGED_FIXTURE_KEY'));
  assert.ok(runner.includes('WEB_MANAGED_ACTIVATION_FIXTURE_ALREADY_BOUND'));
  assert.ok(runner.includes("['CANCELLED', 'ALREADY_CANCELLED'].includes(cancellationBody?.outcome)"));
  assert.ok(runner.includes("successorRuntimeAdapter: 'NOT_APPLICABLE_IN_EXPO_WEB'"));
  assert.ok(runner.includes("vmSuccessorRuntimeEvidence: 'NOT_RUN'"));
  assert.ok(
    runner.includes("page.getByTestId('terminal.activation.screen').waitFor({state: 'visible', timeout: 15_000})"),
  );
  assert.ok(runner.includes('const latencyReadback = await waitForMatchedHeartbeatRttReadback({'));
  assert.ok(runner.includes('displayedHeartbeatRttMismatch(displayText, matched)'));
  assert.ok(
    runner.includes('for (let completion = 0; completion < 3 && (await memberKeyboard.isVisible()); completion += 1)'),
  );
  assert.match(runner, /data-testid\^="sample\.desk\.member-list:row:"\]\:not\(\[data-testid\$=":content"\]\)/);
  assert.ok(runner.includes('memberConfirmationReadback({'));
  assert.ok(runner.includes('manifest.memberConfirmationReadback = memberReadback;'));
  assert.ok(runner.includes('confirmedMemberRowCount: memberReadback.rowCount'));
  assert.ok(
    runner.includes(
      "await memberKeyboard.waitFor({state: 'hidden', timeout: 5_000});\n      await page.getByTestId('sample.desk.member-form:submit').click();",
    ),
  );
  assert.ok(
    runner.includes('latencyBeforeCancellation,\n      cancellationOutcome: managedActivationCancellationOutcome'),
  );
  assert.ok(runner.indexOf('const latencyBeforeCancellation =') < runner.indexOf('await cleanupManagedActivation();'));
  assert.ok(!runner.includes("getByText('终端已取消激活。', {exact: true})"));
  assert.ok(runner.includes('correlateManagedHttpExchange({'));
  assert.ok(runner.includes("expectedOutcome: isActivationRejectionScenario ? 'FAILED' : 'SUCCEEDED'"));
  assert.ok(runner.includes('routeTemplate: item.routeTemplate'));
  assert.match(runner, /resultClass:\s*await page\s*\.getByTestId\('terminal\.activation\.result'\)/u);
  assert.ok(runner.includes('collectRemoteLog(managedDev.remoteHostTrust.host, managedDev.remoteJava, fullLogPath)'));
  assert.ok(runner.includes('manifest.backendTerminalHttpLogEvents = projectManagedTerminalActivationBackendLogLines'));
  assert.ok(runner.includes('manifest.frontendActivationLogEvents = projectTerminalActivationLogEvents'));
  assert.ok(runner.includes('manifest.browserConsoleFailures = browserConsoleFailures'));
  assert.ok(runner.includes("manifest.frontendLogRead = 'PASS'"));
  assert.ok(runner.includes("value.operation === 'activation' && value.method === 'POST' && value.status === 200"));
  assert.ok(!runner.includes('request.postData()'));
  assert.ok(runner.includes("headers['x-request-id']"));
  assert.ok(runner.includes("headers['x-correlation-id']"));
  assert.ok(!runner.includes('managedHttpRequests.push({url:'));
  assert.ok(!runner.includes('activationField.fill(managedActivationFixture.activationCode)'));
  assert.ok(
    runner.includes(
      '...(managedActivationFixture === null ? {} : {managedActivationFixture: managedActivationFixture.key})',
    ),
  );
  assert.ok(runner.includes('TER_WEB_MANAGED_DEVICE_ID'));
  assert.ok(runner.includes('sample.auth.login:operator-name'));
  assert.ok(runner.includes('Integration owns the next route'));
  assert.ok(!runner.includes('bounds.x + Math.min(24'));
  assert.ok(!runner.includes('launcherBounds.x + Math.min(24'));
  assert.match(runner, /await page\.screenshot\(\{path: screenshotPath, fullPage: true\}\)/);
});

test('member confirmation oracle rejects missing, duplicate, partial, and extra rows without returning PII', () => {
  const {name, phone} = terminalBusinessMemberFixture('ter-oracle-run-01');
  const expected = {expectedName: name, expectedPhone: phone};
  assert.deepEqual(memberConfirmationReadback({...expected, rowTexts: [`${name} ${phone}`]}), {
    status: 'PASS',
    rowCount: 1,
    matchingRowCount: 1,
  });
  for (const rowTexts of [
    [],
    [`other ${phone}`],
    [`${name} ${phone}`, `${name} ${phone}`],
    [`${name} ${phone}`, `other 0100000002`],
  ]) {
    const result = memberConfirmationReadback({...expected, rowTexts});
    assert.equal(result.status, 'FAIL');
    assert.equal(result.rowCount, rowTexts.length);
    assert.equal(JSON.stringify(result).includes(expected.expectedPhone), false);
  }
});

test('Web member journey uses the shared per-run terminal business fixture without persisting its values', () => {
  const runner = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  const fixture = terminalBusinessMemberFixture('web-a-1791021504646-071d6f18-c362-48db-8605-b05fca0bffd9');
  assert.match(fixture.name, /^ter[a-f0-9]{10}$/u);
  assert.match(fixture.phone, /^010\d{8}$/u);
  assert.notDeepEqual(
    fixture,
    terminalBusinessMemberFixture('web-a-1791021504647-071d6f18-c362-48db-8605-b05fca0bffd9'),
  );
  assert.match(runner, /const memberFixture = terminalBusinessMemberFixture\(runId\)/u);
  assert.match(runner, /expectedName: memberFixture\.name/u);
  assert.match(runner, /expectedPhone: memberFixture\.phone/u);
  assert.doesNotMatch(runner, /Web Guest|0100000001/u);
  assert.doesNotMatch(runner, /manifest\.[\w.]*member(?:Name|Phone|Fixture)/u);
});

test('managed activation Web status navigation uses shared page-level admin locators after opening the primary surface', () => {
  const runner = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  const start = runner.indexOf('const openActivationAdminStatus = async () => {');
  const end = runner.indexOf('cleanupManagedActivation = async () => {', start);
  assert.ok(start >= 0 && end > start);
  const openStatus = runner.slice(start, end);
  assert.ok(openStatus.includes('const statusPanel = page.getByTestId(statusId);'));
  assert.ok(openStatus.includes("const login = page.getByTestId('terminal.admin:login');"));
  assert.ok(openStatus.includes('entryState = await Promise.any(['));
  assert.ok(openStatus.includes("statusPanel.waitFor({state: 'visible', timeout: 10_000})"));
  assert.ok(openStatus.includes("login.waitFor({state: 'visible', timeout: 10_000})"));
  assert.ok(openStatus.includes("mobileNavigation.waitFor({state: 'visible', timeout: 10_000})"));
  assert.ok(openStatus.includes("laptopStatusNavigation.waitFor({state: 'visible', timeout: 10_000})"));
  assert.ok(openStatus.includes('if (await statusPanel.isVisible()) {'));
  assert.ok(openStatus.includes("if (await login.isVisible()) entryState = 'LOGIN';"));
  assert.ok(openStatus.includes("entryState = 'AUTHENTICATED_SHELL';"));
  assert.ok(openStatus.includes("if (entryState === 'LOGIN') {"));
  assert.ok(openStatus.includes("if (entryState !== 'STATUS') {"));
  assert.ok(openStatus.includes('manifest.activationAdminEntryState = entryState;'));
  assert.ok(openStatus.includes("recordWebScenarioStep('ADMIN_ENTRY_STATE_OBSERVED', {entryState});"));
  assert.ok(openStatus.includes("recordWebScenarioStep('ADMIN_LAUNCHER_OPEN_STARTED', {launcherBounds})"));
  assert.ok(openStatus.includes("recordWebScenarioStep('ADMIN_LAUNCHER_OPEN_RETURNED')"));
  assert.ok(openStatus.includes("recordWebScenarioStep('ADMIN_ENTRY_WAIT_FAILED'"));
  assert.ok(runner.includes('manifest.firstFailure ??= failureDiagnostic.failureCode;'));
  assert.ok(runner.includes('manifest.firstFailureDetails ??= failureDiagnostic;'));
  assert.ok(!runner.includes('error.stack'));
  assert.ok(!runner.includes('error.message'));
  assert.ok(!runner.includes('manifest.portReadback.listenerStderr'));
  assert.ok(!runner.includes("stderr: String(listenerReadback.stderr ?? '').trim(),"));
  assert.ok(runner.includes("String(listenerReadback.stderr ?? '').trim().length > 0 ? 'NON_EMPTY_STDERR' : ''"));
});

test('admin launcher gesture is transformed from current logical canvas coordinates', () => {
  const geometry = runtimeLogEvent(
    'admin.launcher-geometry-measured',
    {
      windowRect: {x: 40, y: 159, width: 1360, height: 765},
      canvas: {width: 1280, height: 720},
      windowDimensions: {width: 1440, height: 1000},
    },
    {category: 'admin.launcher'},
  );
  assert.deepEqual(adminLauncherGesturePagePoint(geometry), {x: 65.5, y: 184.5});
  const readyBinding = runtimeLogEvent(
    'admin.launcher-binding',
    {displayMode: 'PRIMARY', handlerAttached: true, hasAdminLayer: false},
    {category: 'admin.launcher'},
  );
  assert.equal(adminLauncherBindingReady(readyBinding), true);
  assert.equal(
    adminLauncherBindingReady({...readyBinding, data: {...readyBinding.data, handlerAttached: false}}),
    false,
  );
  assert.equal(adminLauncherBindingReady({...readyBinding, data: {...readyBinding.data, hasAdminLayer: true}}), false);
  assert.equal(
    adminLauncherBindingReady({...readyBinding, data: {...readyBinding.data, displayMode: 'SECONDARY'}}),
    false,
  );
  assert.equal(
    adminLauncherBindingReady({...readyBinding, scope: {...readyBinding.scope, moduleName: 'fixture'}}),
    false,
  );
  const runner = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  const compactRunner = runner.replace(/\s+/gu, ' ');
  assert.ok(runner.includes("event.data?.displayMode === 'PRIMARY'"));
  assert.ok(runner.includes('const primarySurface = page.getByTestId(surfaceTestIdPrefix);'));
  assert.ok(runner.includes("const launcher = primarySurface.getByTestId('terminal.admin:launcher')"));
  assert.ok(runner.includes('await restorePrimarySurfaceOrigin();'));
  const restoreOrigin = runner.indexOf('await restorePrimarySurfaceOrigin();');
  const readGeometry = runner.indexOf('const geometry = await currentAdminLauncherGeometry();', restoreOrigin);
  assert.ok(
    restoreOrigin >= 0 && readGeometry > restoreOrigin,
    'launcher geometry must be read after restoring the page origin',
  );
  const bindingRead = runner.indexOf(
    "event => isExpectedRuntimeLogEvent(event, 'admin.launcher-binding')",
    readGeometry,
  );
  const clickGesture = runner.indexOf('await page.mouse.click(point.x, point.y);', readGeometry);
  assert.ok(
    bindingRead > readGeometry && clickGesture > bindingRead,
    'read the latest launcher binding before tapping',
  );
  assert.ok(
    runner.includes("if (latestBinding === undefined || !adminLauncherBindingReady(latestBinding, 'PRIMARY'))"),
  );
  assert.ok(runner.includes("event => adminLauncherBindingReady(event, 'PRIMARY')"));
  assert.ok(runner.includes('eventCount: 5'));
  assert.ok(runner.includes('manifest.lastWebEventWait = {'));
  assert.ok(runner.includes('const root = page.getByTestId(`${integrationName}:test-expo:root`);'));
  assert.ok(runner.includes("const candidates = [element, ...element.querySelectorAll('*')];"));
  assert.ok(runner.includes('node.scrollTop = 0;'));
  assert.ok(runner.includes('node.scrollLeft = 0;'));
  assert.ok(runner.includes('await page.evaluate(() => window.scrollTo(0, 0));'));
  assert.ok(compactRunner.includes('const geometryMatchesSurface = surfaceBounds !== null &&'));
  assert.ok(runner.includes('!geometryMatchesSurface'));
  assert.ok(runner.includes("'admin.launcher-open-requested'"));
  assert.ok(runner.includes("'admin.launcher-open-result'"));
  assert.ok(runner.includes('WEB_PRIMARY_ADMIN_LAUNCHER_TARGET_OUTSIDE_PRIMARY_SURFACE'));
  assert.ok(!runner.includes('refreshGeometry'));
  assert.ok(runner.includes('await openAdminConsoleFromLauncher();'));
  assert.throws(() => adminLauncherGesturePagePoint({...geometry, category: 'fixture'}), {
    message: 'WEB_ADMIN_LAUNCHER_GEOMETRY_INVALID',
  });
  assert.throws(() => adminLauncherGesturePagePoint(geometry, {x: 97, y: 24}), {
    message: 'WEB_ADMIN_LAUNCHER_GEOMETRY_INVALID',
  });
});

test('activation log projection keeps request phase evidence and drops arbitrary payload fields', () => {
  const startedAt = '2026-10-03T10:00:00.000+09:00';
  const event = runtimeLogEvent(
    'activation-request-result',
    {
      operationId: 'activateTerminal',
      profileId: 'terminal-data-client',
      kind: 'failure',
      category: 'not-delivered',
      status: 200,
      elapsedMs: 17,
      secret: 'must-not-appear',
    },
    {category: 'terminal.activation.http', moduleName: 'kernel.base.terminal-data-client'},
  );
  event.timestamp = Date.parse('2026-10-03T10:00:01.000+09:00');
  event.context = {commandId: 'command-1', credentialSecret: 'must-not-appear'};
  const projected = projectTerminalActivationLogEvents([event], startedAt, '2026-10-03T10:00:02.000+09:00');
  assert.deepEqual(projected, [
    {
      at: '2026-10-03T01:00:01.000Z',
      event: 'activation-request-result',
      operationId: 'activateTerminal',
      outcome: 'failure',
      category: 'not-delivered',
      status: 200,
      elapsedMs: 17,
      commandIdPresent: true,
    },
  ]);
  assert.ok(!JSON.stringify(projected).includes('must-not-appear'));
  assert.deepEqual(projectTerminalActivationLogEvents([event], startedAt, '2026-10-03T10:00:00.500+09:00'), []);
});

test('heartbeat log projection retains only matched sequence and RTT evidence', () => {
  const startedAt = '2026-10-03T10:00:00.000+09:00';
  const event = runtimeLogEvent(
    'heartbeat-pong-matched',
    {
      profileId: 'terminal-data-client',
      sequence: 7,
      rttMs: 23,
      credentialSecret: 'must-not-appear',
    },
    {category: 'terminal.connection.heartbeat', moduleName: 'kernel.base.terminal-data-client'},
  );
  event.timestamp = Date.parse('2026-10-03T10:00:01.000+09:00');
  event.context = {commandId: 'heartbeat-command', credentialSecret: 'must-not-appear'};
  const projected = projectTerminalConnectionHeartbeatLogEvents([event], startedAt, '2026-10-03T10:00:02.000+09:00');
  assert.deepEqual(projected, [
    {
      at: '2026-10-03T01:00:01.000Z',
      sequence: 7,
      rttMs: 23,
      commandIdPresent: true,
    },
  ]);
  assert.ok(!JSON.stringify(projected).includes('must-not-appear'));
  assert.deepEqual(
    projectTerminalConnectionHeartbeatLogEvents([event], startedAt, '2026-10-03T10:00:00.500+09:00'),
    [],
  );
});

test('TDS log projection keeps run-window lifecycle diagnostics and excludes unapproved fields', () => {
  const projected = projectManagedTdsLogLines(
    [
      '2026-10-03T10:00:01.123+09:00 INFO event=tds_ws_accepted connectionId=conn-1 sessionId=session-1 credentialSecret=do-not-copy',
      '2026-10-03T10:00:02.123+09:00 INFO event=tds_session_registered connectionId=conn-1 sessionId=session-1 generation=4',
      '2026-10-03T10:00:03.500+09:00 INFO event=tds_session_registered connectionId=late-flush',
      '2026-10-03T10:00:04.501+09:00 INFO event=tds_ws_accepted connectionId=outside-grace',
      'not-a-timestamp event=tds_ws_accepted connectionId=invalid',
    ],
    'tds-a',
    '2026-10-03T10:00:00.000+09:00',
    '2026-10-03T10:00:02.500+09:00',
    2_000,
  );
  assert.equal(projected.length, 3);
  assert.equal(projected[0].event, 'tds_ws_accepted');
  assert.equal(projected[1].event, 'tds_session_registered');
  assert.equal(projected[0].connectionId, 'conn-1');
  assert.equal(projected[1].connectionId, 'conn-1');
  assert.equal(projected[2].connectionId, 'late-flush');
  assert.ok(!JSON.stringify(projected).includes('do-not-copy'));
  assert.ok(!JSON.stringify(projected).includes('generation=4'));
  assert.throws(
    () => projectManagedTdsLogLines([], 'tds-a', '2026-10-03T10:00:00.000+09:00', '2026-10-03T10:00:02.500+09:00', -1),
    /WEB_TDS_LOG_PROJECTION_INPUT_INVALID/u,
  );
});

test('managed activation backend log projection keeps request identity and excludes unrelated lines', () => {
  const projected = projectManagedTerminalActivationBackendLogLines(
    [
      '2026-10-03T10:00:01.123+09:00 INFO com.example.SecurityDiagnosticRecorder : request-completed correlationId=corr-1 requestId=req-1 operationId=activateTerminal routeTemplate=/api/terminal/group-workspaces/{groupWorkspaceKey}/activation owner=terminal-binding consumerFace=terminal event=REQUEST_COMPLETED phase=EDGE outcome=SUCCEEDED status=200 databaseOperationCount=9 credentialSecret=discard',
      '2026-10-03T10:00:02.123+09:00 INFO com.example.SecurityDiagnosticRecorder : request-completed correlationId=corr-2 requestId=req-2 operationId=route.unresolved routeTemplate=/health owner=unknown consumerFace=unknown event=REQUEST_COMPLETED phase=EDGE outcome=SUCCEEDED status=200 databaseOperationCount=0',
      '2026-10-03T10:00:03.123+09:00 INFO com.example.SecurityDiagnosticRecorder : request-completed correlationId=corr-outside requestId=req-outside operationId=activateTerminal routeTemplate=/api/terminal/group-workspaces/{groupWorkspaceKey}/activation owner=terminal-binding consumerFace=terminal event=REQUEST_COMPLETED phase=EDGE outcome=SUCCEEDED status=200 databaseOperationCount=9',
    ],
    '2026-10-03T10:00:00.000+09:00',
    '2026-10-03T10:00:02.000+09:00',
  );
  assert.equal(projected.length, 1);
  assert.equal(projected[0].event, 'REQUEST_COMPLETED');
  assert.equal(projected[0].requestId, 'req-1');
  assert.equal(projected[0].databaseOperationCount, 9);
  assert.equal(JSON.stringify(projected).includes('discard'), false);
  assert.throws(
    () => projectManagedTerminalActivationBackendLogLines([], 'not-a-time', '2026-10-03T10:00:02.000Z'),
    /WEB_TERMINAL_BACKEND_LOG_PROJECTION_INPUT_INVALID/u,
  );
});

test('browser console diagnostics classify network policy failures without preserving message text', () => {
  assert.equal(
    classifyBrowserConsoleFailure(
      "Access to fetch at 'http://127.0.0.1:28080/private' from origin 'http://localhost:8093' has been blocked by CORS policy",
    ),
    'CROSS_ORIGIN_POLICY',
  );
  assert.equal(classifyBrowserConsoleFailure('net::ERR_FAILED'), 'CHROMIUM_NETWORK_FAILURE');
  assert.equal(classifyBrowserConsoleFailure('Failed to fetch'), 'FETCH_FAILED');
  assert.equal(
    classifyBrowserConsoleFailure('Failed to load resource: the server responded with a status of 409 (Conflict)'),
    'HTTP_RESPONSE_STATUS_409',
  );
  assert.equal(classifyBrowserConsoleFailure('Unclassified message with private data'), 'OTHER_CONSOLE_FAILURE');
  assert.equal(classifyBrowserConsoleFailure('{"event":"container-empty"}'), 'UI_CONTAINER_EMPTY');
  assert.equal(
    classifyBrowserConsoleFailure('{"event":"command-dispatch-rejected","data":{"failure":"error"}}'),
    'COMMAND_DISPATCH_REJECTION_ERROR',
  );
  assert.equal(
    hasUnexpectedBrowserConsoleFailures([{level: 'warning', classification: 'OTHER_CONSOLE_FAILURE'}]),
    false,
  );
  assert.equal(hasUnexpectedBrowserConsoleFailures([{level: 'error', classification: 'OTHER_CONSOLE_FAILURE'}]), true);
  assert.equal(hasUnexpectedBrowserConsoleFailures([{level: 'error', classification: 'UI_CONTAINER_EMPTY'}]), false);
  const expectedConflict = [
    {at: new Date(100).toISOString(), level: 'error', classification: 'HTTP_RESPONSE_STATUS_409'},
  ];
  const conflictResponse = [{at: new Date(150).toISOString(), operation: 'activation', method: 'POST', status: 409}];
  const allowed = expectedActivationRejectionConsoleFailureIndexes({
    failures: expectedConflict,
    httpResults: conflictResponse,
  });
  assert.deepEqual(allowed, [0]);
  assert.equal(hasUnexpectedBrowserConsoleFailures(expectedConflict, allowed), false);
  assert.equal(
    hasUnexpectedBrowserConsoleFailures(
      [...expectedConflict, {level: 'error', classification: 'OTHER_CONSOLE_FAILURE'}],
      allowed,
    ),
    true,
  );
  assert.deepEqual(
    expectedActivationRejectionConsoleFailureIndexes({
      failures: expectedConflict,
      httpResults: [{...conflictResponse[0], at: new Date(2_000).toISOString()}],
    }),
    [],
  );
});

test('frontend startup diagnostics use the production completion event and retain unresolved empty placements', () => {
  const completion = runtimeLogEvent('startup.complete', {
    groups: {modules: true, slices: true, commands: true, actors: true, ports: true, parts: true},
    primaryDeclared: true,
    primaryMeasured: true,
    primaryRealReady: false,
    primaryContentFailure: 'container-empty',
  });
  completion.timestamp = 20;
  const events = [
    Object.assign(
      runtimeLogEvent(
        'container-empty',
        {displayMode: 'PRIMARY', containerKey: 'main', reason: 'container-empty'},
        {category: 'display-diagnostics', moduleName: 'ui-base-render', layer: 'kernel'},
      ),
      {level: 'error', timestamp: 10},
    ),
    completion,
    Object.assign(
      runtimeLogEvent(
        'render.screen-selection',
        {displayMode: 'PRIMARY', containerKey: 'main', fallback: null, screenPartKey: 'terminal.activation.lmp'},
        {category: 'display-diagnostics', moduleName: 'ui-base-render', layer: 'kernel'},
      ),
      {timestamp: 30},
    ),
    Object.assign(
      runtimeLogEvent(
        'render.screen-selection',
        {displayMode: 'SECONDARY', containerKey: 'main', fallback: 'container-empty', screenPartKey: null},
        {category: 'display-diagnostics', moduleName: 'ui-base-render', layer: 'kernel'},
      ),
      {timestamp: 31},
    ),
    Object.assign(
      runtimeLogEvent(
        'container-empty',
        {displayMode: 'SECONDARY', containerKey: 'main', reason: 'container-empty'},
        {category: 'display-diagnostics', moduleName: 'ui-base-render', layer: 'kernel'},
      ),
      {level: 'error', timestamp: 31},
    ),
  ];
  assert.deepEqual(unresolvedScreenPlacementsAfterStartup(events), [
    {
      at: new Date(31).toISOString(),
      displayMode: 'SECONDARY',
      containerKey: 'main',
      reason: 'container-empty',
    },
  ]);
  const resetCompleted = Object.assign(
    runtimeLogEvent(
      'runtime.reset.completed',
      {rootCommandId: 'root-1'},
      {category: 'runtime.lifecycle', moduleName: 'kernel.base.runtime'},
    ),
    {timestamp: 40},
  );
  assert.deepEqual(unresolvedScreenPlacementsAfterStartup([...events, resetCompleted]), []);
  assert.deepEqual(
    unresolvedScreenPlacementsAfterStartup([
      completion,
      resetCompleted,
      Object.assign(
        runtimeLogEvent('render.screen-selection', {
          displayMode: 'SECONDARY',
          containerKey: 'main',
          fallback: 'container-empty',
          screenPartKey: null,
        }),
        {timestamp: 41},
      ),
    ]),
    [
      {
        at: new Date(41).toISOString(),
        displayMode: 'SECONDARY',
        containerKey: 'main',
        reason: 'container-empty',
      },
    ],
  );
  assert.equal(hasStartupCompletionEvent(events), true);
  assert.equal(
    hasStartupCompletionEvent([
      {
        ...completion,
        data: {...completion.data, groups: {...completion.data.groups, commands: false}},
      },
    ]),
    false,
  );
  assert.equal(hasStartupCompletionEvent([{event: 'startup.ready', timestamp: 30}]), false);
  assert.deepEqual(
    unresolvedScreenPlacementsAfterStartup([
      completion,
      Object.assign(
        runtimeLogEvent(
          'render.screen-selection',
          {displayMode: 'SECONDARY', containerKey: 'main', fallback: null, screenPartKey: 'terminal.activation.lms'},
          {category: 'display-diagnostics', moduleName: 'ui-base-render', layer: 'kernel'},
        ),
        {timestamp: 32},
      ),
    ]),
    [],
  );
  assert.deepEqual(
    unresolvedScreenPlacementsAfterStartup([
      completion,
      Object.assign(
        runtimeLogEvent(
          'render.screen-selection',
          {displayMode: 'PRIMARY', containerKey: 'main', fallback: null, screenPartKey: null},
          {category: 'display-diagnostics', moduleName: 'ui-base-render', layer: 'kernel'},
        ),
        {timestamp: 33},
      ),
    ]),
    [
      {
        at: new Date(33).toISOString(),
        displayMode: 'PRIMARY',
        containerKey: 'main',
        reason: 'screen-selection-incomplete',
      },
    ],
  );
});

test('Web failure evidence keeps diagnostic markers and excludes raw exception content', () => {
  const diagnostic = projectWebFailureDiagnostic(
    new Error('WEB_REQUEST_FAILED:https://private.example/path?token=secret phone=5551234567'),
    'ACTIVATION_SUBMIT',
  );
  assert.deepEqual(diagnostic, {
    failureCode: 'WEB_REQUEST_FAILED',
    errorType: 'Error',
    scenarioStep: 'ACTIVATION_SUBMIT',
  });
  assert.equal(JSON.stringify(diagnostic).includes('private.example'), false);
  assert.equal(JSON.stringify(diagnostic).includes('secret'), false);
  assert.equal(JSON.stringify(diagnostic).includes('5551234567'), false);
  assert.deepEqual(projectWebFailureDiagnostic(new Error(''), 'bad step'), {
    failureCode: 'UNCLASSIFIED_WEB_FAILURE',
    errorType: 'Error',
    scenarioStep: 'UNCLASSIFIED_STEP',
  });
  assert.deepEqual(
    projectWebFailureDiagnostic(
      new Error('WEB_EXPECTED_LOG_EVENT_MISSING:admin.launcher-open-requested'),
      'WAITING_FOR_LOG_EVENT',
    ),
    {
      failureCode: 'WEB_EXPECTED_LOG_EVENT_MISSING',
      errorType: 'Error',
      scenarioStep: 'WAITING_FOR_LOG_EVENT',
      expectedLogEvent: 'admin.launcher-open-requested',
    },
  );
  const manifest = {business: 'PASS', firstFailure: null};
  applyWebSourceRecheckFailure(manifest, new Error('source recheck failed /private/worktree/token'));
  assert.equal(manifest.firstFailure, 'WEB_SOURCE_RECHECK_FAILED');
  assert.equal(JSON.stringify(manifest).includes('/private/worktree'), false);
  assert.equal(JSON.stringify(manifest).includes('token'), false);
});

test('frontend rejected command diagnostics are retained and counted without request identities', () => {
  const projected = projectFrontendCommandDispatchEvents([
    {
      ...runtimeLogEvent('command-dispatch-completed', {}, {category: 'ui.base.render'}),
      context: {commandName: 'integration.route-stage'},
    },
    {
      ...runtimeLogEvent('command-dispatch-rejected', {failure: 'error'}, {category: 'ui.base.render'}),
      context: {commandName: 'terminal-data-client.cancel-activation', requestId: 'private-request-id'},
    },
  ]);
  assert.equal(projected.events.length, 2);
  assert.equal(projected.rejectedCount, 1);
  assert.equal(projected.events[1].event, 'command-dispatch-rejected');
  assert.equal(projected.events[1].commandName, 'terminal-data-client.cancel-activation');
  assert.equal(projected.events[1].failure, 'error');
  assert.equal('requestId' in projected.events[1], false);
  assert.equal(JSON.stringify(projected).includes('private-request-id'), false);
  const runner = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  assert.ok(runner.includes('webCommandDispatchMismatch(webScenario, commandDispatchProjection.events)'));
  assert.ok(runner.includes('commandDispatchMismatch !== null'));
  assert.ok(runner.includes("'FRONTEND_COMMAND_DISPATCH_REJECTED'"));
});

test('front/back correlation requires one matching terminal-binding completion with owner outcome', () => {
  const frontendResponse = {requestId: 'request-1', correlationId: 'correlation-1', status: 200};
  const backendEvent = {
    event: 'REQUEST_COMPLETED',
    operationId: 'activateTerminal',
    outcome: 'SUCCEEDED',
    status: 200,
    owner: 'terminal-binding',
    consumerFace: 'terminal',
    databaseOperationCount: 10,
    routeTemplate: '/api/terminal/group-workspaces/{groupWorkspaceKey}/activation',
    requestId: 'request-1',
    correlationId: 'correlation-1',
  };
  const expected = {
    frontendResponse,
    backendEvents: [backendEvent],
    operationId: 'activateTerminal',
    routeTemplate: backendEvent.routeTemplate,
  };
  assert.equal(correlateManagedBackendRequest(expected), true);
  assert.equal(
    correlateManagedBackendRequest({...expected, backendEvents: [{...backendEvent, owner: 'unresolved'}]}),
    false,
  );
  assert.equal(correlateManagedBackendRequest({...expected, backendEvents: [backendEvent, backendEvent]}), false);
  const rejected = {
    ...expected,
    frontendResponse: {...frontendResponse, status: 409},
    backendEvents: [{...backendEvent, outcome: 'FAILED', status: 409, errorCode: 'STORE_TERMINAL_DISABLED'}],
    expectedOutcome: 'FAILED',
    expectedStatus: 409,
    expectedErrorCode: 'STORE_TERMINAL_DISABLED',
  };
  assert.equal(correlateManagedBackendRequest(rejected), true);
  assert.equal(
    correlateManagedBackendRequest({...rejected, expectedErrorCode: 'TERMINAL_BINDING_ALREADY_BOUND'}),
    false,
  );
});

test('front/back exchange uses backend response ids as the authoritative correlation key', () => {
  const backendEvent = {
    event: 'REQUEST_COMPLETED',
    operationId: 'activateTerminal',
    outcome: 'SUCCEEDED',
    status: 200,
    owner: 'terminal-binding',
    consumerFace: 'terminal',
    databaseOperationCount: 10,
    routeTemplate: '/api/terminal/group-workspaces/{groupWorkspaceKey}/activation',
    requestId: 'backend-request-1',
    correlationId: 'backend-correlation-1',
  };
  const common = {
    backendEvents: [backendEvent],
    operationId: 'activateTerminal',
    routeTemplate: backendEvent.routeTemplate,
  };
  assert.equal(
    correlateManagedHttpExchange({
      ...common,
      request: {operation: 'activation', method: 'POST', requestId: null, correlationId: null},
      response: {
        operation: 'activation',
        method: 'POST',
        status: 200,
        requestId: 'backend-request-1',
        correlationId: 'backend-correlation-1',
      },
    }),
    true,
  );
  assert.equal(
    correlateManagedHttpExchange({
      ...common,
      request: {
        operation: 'activation',
        method: 'POST',
        requestId: 'request-from-client',
        correlationId: 'front-correlation',
      },
      response: {
        operation: 'activation',
        method: 'POST',
        status: 200,
        requestId: 'backend-request-1',
        correlationId: 'backend-correlation-1',
      },
    }),
    true,
  );
  assert.equal(
    correlateManagedHttpExchange({
      ...common,
      request: {operation: 'activation', method: 'POST', requestId: null, correlationId: null},
      response: {
        operation: 'activation',
        method: 'POST',
        status: 200,
        requestId: 'wrong-backend-request',
        correlationId: 'backend-correlation-1',
      },
    }),
    false,
  );
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
  assert.deepEqual(
    rows
      .filter(row => row.status === 'OPEN')
      .map(pairKey)
      .sort(),
    expectedOpenPairs,
  );
  assert.deepEqual(
    rows
      .filter(row => row.status === 'WEB_REACHABLE')
      .map(pairKey)
      .sort(),
    expectedReachablePairs,
  );
  assert.ok(rows.filter(row => row.status === 'OPEN').every(row => row.reason?.length > 0));
  assert.equal(
    webScenarioScopeError({
      integrationName: 'sample-wallpaper-console',
      webScenario: 'layer-error-production-journey',
      surfaceForm: 'laptop',
      failureOwner: 'layer:sample.wallpaper.system-notice',
    }),
    'WEB_LAYER_ERROR_OWNER_WEB_TRIGGER_OPEN:layer:sample.wallpaper.system-notice',
  );
  assert.equal(
    webScenarioScopeError({
      integrationName: 'sample-console',
      webScenario: 'layer-error-production-journey',
      surfaceForm: 'mobile',
      failureOwner: 'layer:sample.desk.withdraw-confirm',
    }),
    'WEB_LAYER_ERROR_PRODUCTION_JOURNEY_SCOPE_INVALID',
  );
  assert.equal(
    webScenarioScopeError({
      integrationName: 'sample-console',
      webScenario: 'layer-error-production-journey',
      surfaceForm: 'mobile',
      failureOwner: 'layer:sample.desk.registry-notice',
    }),
    'WEB_LAYER_ERROR_PRODUCTION_JOURNEY_SCOPE_INVALID',
  );
  assert.equal(
    webScenarioScopeError({
      integrationName: 'sample-console',
      webScenario: 'layer-error-production-journey',
      surfaceForm: 'laptop',
      failureOwner: 'layer:sample.desk.registry-notice',
    }),
    null,
  );
});

test('V-T17 Expo Web smoke reads the network capability rows and transport state on the existing admin page', () => {
  const runner = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  assert.match(runner, /webScenario === 'platform-ports-smoke'/);
  assert.match(runner, /terminal\.admin:ports:item:device:\$\{capability\}:status/);
  for (const capability of ['getNetworkStatus', 'subscribeNetworkStatus', 'unsubscribeNetworkStatus']) {
    assert.ok(runner.includes(capability), `WEB_PLATFORM_PORTS_NETWORK_CAPABILITY_MISSING:${capability}`);
  }
  assert.match(runner, /WEB_PLATFORM_PORTS_NETWORK_CAPABILITY_NOT_UNAVAILABLE/);
  assert.match(runner, /transport\.connection\.network-status-bridge-unavailable/);
  assert.match(runner, /WEB_PLATFORM_PORTS_TRANSPORT_CONNECTION_ACTIVITY_OBSERVED/);
  assert.match(runner, /WEB_PLATFORM_PORTS_SUMMARY_TOTAL_MISMATCH/);
  assert.match(runner, /screenshotPath/);
});

test('V-T17 parses visible platform-port fact labels plus values instead of treating the full row as a number', () => {
  assert.equal(parsePlatformPortsSummaryCount('可用\n18', '可用'), 18);
  assert.equal(parsePlatformPortsSummaryCount('  未声明   0  ', '未声明'), 0);
  assert.equal(parsePlatformPortsSummaryCount('不可用\n36', '不可用'), 36);
  assert.equal(parsePlatformPortsSummaryCount('不可用\n36', '可用'), null);
  assert.equal(parsePlatformPortsSummaryCount('可用\n十八', '可用'), null);
  assert.equal(parsePlatformPortsSummaryCount('可用\n18 多余', '可用'), null);
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
    assert.match(
      source,
      new RegExp(`<PrimitiveContainer\\s+testID=\\{adminFrameTestId\\([\\s\\S]*?appearance="${shellAppearance}"`),
    );
    assert.match(
      source,
      /<PrimitiveContainer\s+testID=\{adminTestIds\.panel\.frame\}[\s\S]*?appearance="admin-content"/,
    );
  }
});

test('TextInput context-menu run has an exact per-integration and per-surface denominator', () => {
  assert.equal(TEXTINPUT_PRODUCTION_CONSUMER_FILES.length, 7, 'TP-B5 path denominator must remain complete');
  assert.deepEqual(WEB_TEXTINPUT_CONTEXTMENU_UNREACHED_CONSUMERS, [
    {
      integrationName: 'sample-console',
      testID: 'sample.desk.customer-member:age',
      status: 'NOT_REACHED_BY_THIS_SCENARIO',
      reason: 'textinput-contextmenu does not submit the member form to mount CustomerMemberAgeField',
    },
  ]);
  assert.equal(
    TEXTINPUT_CONSUMER_SOURCE['sample.desk.customer-member:age'],
    'apps/terminal/ui/feature/sample-member-desk/src/components/CustomerMemberAgeField.tsx',
  );
  assert.equal(TEXTINPUT_CONSUMER_BINDING['sample.desk.customer-member:age'], 'testID: fieldId');
  assert.equal(
    Object.values(EXPECTED_TEXTINPUT_PROBE_IDS).some(forms =>
      Object.values(forms).some(ids => ids.includes('sample.desk.customer-member:age')),
    ),
    false,
    'the explicitly unreached age field must not be presented as a runtime-observed field',
  );
  assert.deepEqual(EXPECTED_TEXTINPUT_PROBE_COUNT, {
    'sample-console': {laptop: 7, mobile: 6},
    'sample-wallpaper-console': {laptop: 3, mobile: 2},
  });
  for (const [integrationName, surfaceForms] of Object.entries(EXPECTED_TEXTINPUT_PROBE_COUNT)) {
    for (const [surfaceForm, expected] of Object.entries(surfaceForms)) {
      assert.equal(expectedTextInputProbeCount({integrationName, surfaceForm}), expected);
    }
  }
  assert.deepEqual(additionalTextInputContextMenuTargets({integrationName: 'sample-console', surfaceForm: 'laptop'}), [
    'sample.desk.member-form:name',
    'sample.desk.member-form:phone',
    'sample.desk.member-form:keyboard-alpha-probe',
    'sample.desk.member-form:keyboard-financial-probe',
    'terminal.admin:topology:host',
  ]);
  assert.deepEqual(additionalTextInputContextMenuTargets({integrationName: 'sample-console', surfaceForm: 'mobile'}), [
    'sample.desk.member-form:name',
    'sample.desk.member-form:phone',
    'sample.desk.member-form:keyboard-alpha-probe',
    'sample.desk.member-form:keyboard-financial-probe',
  ]);
  assert.deepEqual(
    additionalTextInputContextMenuTargets({integrationName: 'sample-wallpaper-console', surfaceForm: 'laptop'}),
    ['terminal.admin:topology:host'],
  );
  assert.deepEqual(
    additionalTextInputContextMenuTargets({integrationName: 'sample-wallpaper-console', surfaceForm: 'mobile'}),
    [],
  );
  const runnerSource = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  assert.match(
    runnerSource,
    /for \(const testID of additionalTextInputContextMenuTargets\(\{integrationName, surfaceForm\}\)\)/,
  );
  assert.match(runnerSource, /if \(testID === 'terminal\.admin:topology:host'\)/);
  assert.match(runnerSource, /textInputObservations: contextMenuObservations/);
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
      assert.equal(
        expectedTextInputProbeIds({integrationName, surfaceForm}).length,
        expectedTextInputProbeCount({
          integrationName,
          surfaceForm,
        }),
      );
    }
  }
  const consumerSource = new Map();
  for (const {path: sourcePath, required} of TEXTINPUT_PRODUCTION_CONSUMER_FILES) {
    const source = fs.readFileSync(path.join(repositoryRoot, sourcePath), 'utf8');
    for (const requiredSnippet of required) {
      assert.ok(
        source.includes(requiredSnippet),
        `TEXTINPUT_PRODUCTION_CONSUMER_CONTRACT_MISSING:${sourcePath}:${requiredSnippet}`,
      );
    }
    consumerSource.set(sourcePath, source);
  }
  const staffLoginHook = fs.readFileSync(
    path.join(repositoryRoot, 'apps/terminal/ui/feature/sample-staff-auth/src/hooks/useStaffLogin.ts'),
    'utf8',
  );
  assert.ok(staffLoginHook.includes("operatorNameFieldId = 'sample.auth.login:operator-name'"));
  assert.ok(staffLoginHook.includes("passcodeFieldId = 'sample.auth.login:passcode'"));
  const memberHook = fs.readFileSync(
    path.join(repositoryRoot, 'apps/terminal/ui/feature/sample-member-desk/src/hooks/useCustomerMember.ts'),
    'utf8',
  );
  assert.ok(
    memberHook.includes("export const ageFieldId = (prefix = 'sample.desk.customer-member') => `${prefix}:age`"),
  );
  const adminTestIds = fs.readFileSync(
    path.join(repositoryRoot, 'apps/terminal/ui/base/admin-shell/src/foundations/adminTestIds.ts'),
    'utf8',
  );
  assert.ok(adminTestIds.includes("host: 'terminal.admin:topology:host'"));
  for (const expectedId of new Set(
    Object.values(EXPECTED_TEXTINPUT_PROBE_IDS).flatMap(forms => Object.values(forms).flat()),
  )) {
    const sourcePath = TEXTINPUT_CONSUMER_SOURCE[expectedId];
    assert.ok(sourcePath, `WEB_TEXTINPUT_DENOMINATOR_OWNER_MISSING:${expectedId}`);
    const source = consumerSource.get(sourcePath);
    assert.ok(
      source?.includes(TEXTINPUT_CONSUMER_BINDING[expectedId]),
      `WEB_TEXTINPUT_DENOMINATOR_ID_NOT_IN_OWNING_SOURCE:${expectedId}:${sourcePath}`,
    );
  }
  const expectedIds = expectedTextInputProbeIds({integrationName: 'sample-console', surfaceForm: 'laptop'});
  const validObservations = expectedIds.flatMap(testID => [
    {testID, state: 'empty', contextMenuPrevented: true},
    {testID, state: 'existing-text', contextMenuPrevented: true},
  ]);
  assert.equal(textInputProbeMismatch(validObservations, expectedIds), null);
  assert.equal(
    textInputProbeMismatch(
      validObservations.map((observation, index) =>
        index === 0 ? {...observation, contextMenuPrevented: false} : observation,
      ),
      expectedIds,
    ),
    'WEB_TEXTINPUT_CONTEXTMENU_OBSERVATION_INVALID',
    'a field observation must prove that the context-menu event was actually prevented',
  );
  assert.equal(
    textInputProbeMismatch(
      validObservations.filter(observation => observation.testID !== expectedIds[0]),
      expectedIds,
    ),
    'WEB_TEXTINPUT_CONTEXTMENU_FIELD_SET_MISMATCH',
  );
  assert.equal(
    textInputProbeMismatch(
      [...validObservations, {testID: expectedIds[0], state: 'empty', contextMenuPrevented: true}],
      expectedIds,
    ),
    'WEB_TEXTINPUT_CONTEXTMENU_DUPLICATE_STATE',
  );
  assert.equal(
    textInputProbeMismatch(
      validObservations.filter(item => item.state !== 'existing-text'),
      expectedIds,
    ),
    'WEB_TEXTINPUT_CONTEXTMENU_STATE_COUNT_MISMATCH',
  );
});

test('persistent admin-layer failure requires either a fresh launcher request or proven self-owner launch', () => {
  const noRequest = classifyAdminLauncherFailureRecoveryLog('');
  assert.deepEqual(noRequest, {status: 'OPEN', openRequests: 0, completedResults: 0});
  assert.deepEqual(classifyAdminLauncherFailureRecoveryLog('', {adminLayerMounted: true}), {
    status: 'OPEN',
    openRequests: 0,
    completedResults: 0,
    reason: 'ADMIN_LAYER_REMAINS_MOUNTED_LAUNCHER_REENTRY_NOT_APPLICABLE',
  });
  const selfOwnerBoundaryEvents = [
    runtimeLogEvent('admin.launcher-open-requested', {}, {category: 'admin.launcher'}),
    runtimeLogEvent('admin.launcher-open-result', {status: 'completed'}, {category: 'admin.launcher'}),
    runtimeLogEvent(
      'runtime.system-failure.reset-unavailable',
      {portStatus: 'unavailable'},
      {category: 'runtime.system-failure'},
    ),
    runtimeLogEvent(
      'render.layer-selection',
      {displayMode: 'PRIMARY', layerCount: 1, layerIds: ['admin.console.layer']},
      {category: 'display-diagnostics'},
    ),
  ].map(event =>
    event.event === 'runtime.system-failure.reset-unavailable'
      ? {...event, context: {commandName: 'kernel.base.runtime.reset-runtime-after-system-failure'}}
      : event,
  );
  assert.deepEqual(
    classifyAdminLauncherFailureRecoveryLog(selfOwnerBoundaryEvents.map(event => JSON.stringify(event)).join('\n'), {
      adminLayerMounted: true,
      failureOwner: 'layer:admin.console.layer',
    }),
    {
      status: 'PASS',
      openRequests: 1,
      completedResults: 1,
      reason: 'OPENED_BOUNDARY_OWNER',
    },
  );
  const forgedLayerSelectionEvents = selfOwnerBoundaryEvents.map(event =>
    event.event === 'render.layer-selection' ? {...event, scope: {moduleName: 'unrelated', layer: 'kernel'}} : event,
  );
  assert.deepEqual(
    classifyAdminLauncherFailureRecoveryLog(forgedLayerSelectionEvents.map(event => JSON.stringify(event)).join('\n'), {
      adminLayerMounted: true,
      failureOwner: 'layer:admin.console.layer',
    }),
    {
      status: 'OPEN',
      openRequests: 1,
      completedResults: 1,
      reason: 'ADMIN_LAYER_REMAINS_MOUNTED_LAUNCHER_REENTRY_NOT_APPLICABLE',
    },
    'a layer-selection event from another logger cannot close active-layer readback',
  );
  assert.deepEqual(
    classifyAdminLauncherFailureRecoveryLog(
      selfOwnerBoundaryEvents
        .slice(0, -1)
        .map(event => JSON.stringify(event))
        .join('\n'),
      {adminLayerMounted: true, failureOwner: 'layer:admin.console.layer'},
    ),
    {
      status: 'OPEN',
      openRequests: 1,
      completedResults: 1,
      reason: 'ADMIN_LAYER_REMAINS_MOUNTED_LAUNCHER_REENTRY_NOT_APPLICABLE',
    },
    'a successful initial dispatch without a post-reset active-layer readback must remain OPEN',
  );
  const fakeTextOnly = classifyAdminLauncherFailureRecoveryLog(
    [
      JSON.stringify({event: 'admin.launcher-open-requested'}),
      JSON.stringify({event: 'admin.launcher-open-result', data: {status: 'completed'}}),
    ].join('\n'),
  );
  assert.deepEqual(fakeTextOnly, {status: 'OPEN', openRequests: 0, completedResults: 0});
  const wrongOwnerEvents = classifyAdminLauncherFailureRecoveryLog(
    [
      JSON.stringify(runtimeLogEvent('admin.launcher-open-requested', {}, {category: 'fixture'})),
      JSON.stringify(runtimeLogEvent('admin.launcher-open-result', {status: 'completed'}, {category: 'fixture'})),
    ].join('\n'),
  );
  assert.deepEqual(wrongOwnerEvents, {status: 'OPEN', openRequests: 0, completedResults: 0});
  const failedRequest = classifyAdminLauncherFailureRecoveryLog(
    [
      JSON.stringify(runtimeLogEvent('admin.launcher-open-requested', {}, {category: 'admin.launcher'})),
      JSON.stringify(runtimeLogEvent('admin.launcher-open-result', {status: 'failed'}, {category: 'admin.launcher'})),
    ].join('\n'),
  );
  assert.deepEqual(failedRequest, {status: 'OPEN', openRequests: 1, completedResults: 0});
  const completedRequest = classifyAdminLauncherFailureRecoveryLog(
    [
      JSON.stringify(runtimeLogEvent('admin.launcher-open-requested', {}, {category: 'admin.launcher'})),
      JSON.stringify(
        runtimeLogEvent('admin.launcher-open-result', {status: 'completed'}, {category: 'admin.launcher'}),
      ),
    ].join('\n'),
  );
  assert.deepEqual(completedRequest, {status: 'PASS', openRequests: 1, completedResults: 1});
  const unmatchedResult = classifyAdminLauncherFailureRecoveryLog(
    [
      JSON.stringify(runtimeLogEvent('admin.launcher-open-requested', {}, {category: 'admin.launcher'})),
      JSON.stringify(
        runtimeLogEvent('admin.launcher-open-result', {status: 'completed'}, {category: 'admin.launcher'}),
      ),
      JSON.stringify(runtimeLogEvent('admin.launcher-open-result', {status: 'failed'}, {category: 'admin.launcher'})),
    ].join('\n'),
  );
  assert.deepEqual(unmatchedResult, {status: 'OPEN', openRequests: 1, completedResults: 1});
  const resultBeforeRequest = classifyAdminLauncherFailureRecoveryLog(
    [
      JSON.stringify(
        runtimeLogEvent('admin.launcher-open-result', {status: 'completed'}, {category: 'admin.launcher'}),
      ),
      JSON.stringify(runtimeLogEvent('admin.launcher-open-requested', {}, {category: 'admin.launcher'})),
    ].join('\n'),
  );
  assert.deepEqual(resultBeforeRequest, {status: 'OPEN', openRequests: 1, completedResults: 1});
  const duplicatedRequests = classifyAdminLauncherFailureRecoveryLog(
    [
      JSON.stringify(runtimeLogEvent('admin.launcher-open-requested', {}, {category: 'admin.launcher'})),
      JSON.stringify(
        runtimeLogEvent('admin.launcher-open-result', {status: 'completed'}, {category: 'admin.launcher'}),
      ),
      JSON.stringify(runtimeLogEvent('admin.launcher-open-requested', {}, {category: 'admin.launcher'})),
      JSON.stringify(
        runtimeLogEvent('admin.launcher-open-result', {status: 'completed'}, {category: 'admin.launcher'}),
      ),
    ].join('\n'),
  );
  assert.deepEqual(duplicatedRequests, {status: 'OPEN', openRequests: 2, completedResults: 2});
  const source = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  const contractSource = fs.readFileSync(
    path.join(repositoryRoot, 'scripts/test/ter-admin-display-web-contract.mjs'),
    'utf8',
  );
  assert.match(source, /WEB_ADMIN_LAUNCHER_NOT_PROVEN_USABLE_WHILE_ADMIN_LAYER_FAILURE_PERSISTS/);
  assert.match(contractSource, /ADMIN_LAYER_REMAINS_MOUNTED_LAUNCHER_REENTRY_NOT_APPLICABLE/);
  assert.match(source, /data\?\.portStatus === 'unavailable'/);
  assert.match(source, /isExpectedRuntimeLogEvent\(event, 'render\.layer-selection'\)/);
  assert.match(source, /manifest\.business = 'OPEN'/);
  assert.doesNotMatch(source, /adminLauncherRemainedUsable:\s*true/);
  assert.match(source, /isExpectedRuntimeLogEvent\(event, 'admin\.launcher-open-requested'\)/);
  const helperStart = source.indexOf('const observeAdminLauncherAfterFailure = async');
  const helperEnd = source.indexOf('\ntry {', helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, 'launcher observation helper must be present and bounded');
  const helperSource = source.slice(helperStart, helperEnd);
  assert.equal((helperSource.match(/page\.mouse\.click\(/g) ?? []).length, 0);
  assert.match(helperSource, /openAdminConsoleFromLauncher\(\)/);
  assert.doesNotMatch(helperSource, /\b(?:for|while)\s*\(/);
  assert.match(helperSource, /parseJsonEventsAfterByteOffset\(fs\.readFileSync\(logPath\), 0\)/);
  assert.doesNotMatch(helperSource, /ui-base-render:layer:admin\.console\.layer.*isVisible/);
  assert.equal(
    (source.match(/observeAdminLauncherAfterFailure\(/g) ?? []).length,
    4,
    'each supported Web launcher-recovery path must perform exactly one observation',
  );
});

test('WEB startup failure and launcher geometry checks require owned structured runtime events', () => {
  const startupRunId = 'startup-run-7';
  const complete = runtimeLogEvent(
    'startup.complete',
    {startupRunId, primaryContentFailure: 'render-error', primaryRealReady: false},
    {category: 'startup.complete'},
  );
  const hidden = runtimeLogEvent(
    'startup.ready-hidden',
    {startupRunId, contentFailure: 'render-error'},
    {category: 'startup.ready-hidden'},
  );
  assert.equal(hasStartupContentFailureReadiness([complete, hidden]), true);
  assert.equal(
    hasStartupContentFailureReadiness([hidden, complete]),
    false,
    'readiness cannot be assembled from events observed in the wrong lifecycle order',
  );
  assert.equal(hasStartupContentFailureReadiness([{event: 'startup.complete', data: complete.data}, hidden]), false);
  assert.equal(
    hasStartupContentFailureReadiness([complete, {...hidden, data: {...hidden.data, startupRunId: 'other-run'}}]),
    false,
  );
  assert.equal(
    hasStartupContentFailureReadiness([complete, {...hidden, scope: {moduleName: 'unrelated', layer: 'kernel'}}]),
    false,
  );

  const geometry = runtimeLogEvent(
    'admin.launcher-geometry-measured',
    {windowRect: {x: 1, y: 2, width: 480, height: 360}, windowDimensions: {width: 1180, height: 760}},
    {category: 'admin.launcher'},
  );
  const expectedGeometry = {x: 2, y: 2, width: 481, height: 360};
  assert.equal(launcherGeometryMatches(geometry, expectedGeometry, {width: 1180, height: 760}), true);
  assert.equal(
    launcherGeometryMatches({...geometry, category: 'fixture'}, expectedGeometry, {width: 1180, height: 760}),
    false,
  );
  assert.equal(
    launcherGeometryMatches({event: geometry.event, data: geometry.data}, expectedGeometry, {width: 1180, height: 760}),
    false,
  );
  assert.equal(
    launcherGeometryMatches(
      {...geometry, data: {...geometry.data, windowRect: {...geometry.data.windowRect, x: 12}}},
      expectedGeometry,
      {width: 1180, height: 760},
    ),
    false,
    'stale position must fail even when launcher size and viewport still match',
  );
  assert.equal(
    launcherGeometryMatches(geometry, {...expectedGeometry, y: 4}, {width: 1180, height: 760}),
    false,
    'stale vertical position must fail after ancestor movement',
  );

  const runnerSource = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  const geometryStart = runnerSource.indexOf('const waitForLauncherGeometryAfter =');
  const geometryEnd = runnerSource.indexOf('\nconst waitForLogEvent =', geometryStart);
  assert.ok(geometryStart >= 0 && geometryEnd > geometryStart);
  assert.match(runnerSource.slice(geometryStart, geometryEnd), /parseJsonEventsAfterByteOffset/);
  assert.doesNotMatch(runnerSource.slice(geometryStart, geometryEnd), /line\.includes\(/);
  const startupStart = runnerSource.indexOf('const startupEvents = parseJsonEventsAfterByteOffset');
  const startupEnd = runnerSource.indexOf('if (!hasStartupContentFailureReadiness(startupEvents))', startupStart);
  assert.ok(startupStart >= 0 && startupEnd > startupStart);
  assert.match(runnerSource.slice(startupStart, startupEnd), /parseJsonEventsAfterByteOffset/);
  const countStart = runnerSource.indexOf('const resizedOpenRequests =');
  const countEnd = runnerSource.indexOf('\n    if (resizedOpenRequests', countStart);
  assert.ok(countStart >= 0 && countEnd > countStart);
  assert.match(runnerSource.slice(countStart, countEnd), /parseJsonEventsAfterByteOffset/);
  assert.match(runnerSource.slice(countStart, countEnd), /isExpectedRuntimeLogEvent/);
  assert.doesNotMatch(runnerSource.slice(countStart, countEnd), /line\.includes\(/);
});

test('WEB log event readback uses fresh complete JSONL records after a byte offset', () => {
  const resetEvent = {
    timestamp: 1790740000000,
    level: 'error',
    category: 'runtime.system-failure',
    event: 'runtime.system-failure.reset-unavailable',
    context: {commandName: 'kernel.base.runtime.reset-runtime-after-system-failure'},
    scope: {moduleName: 'platform-ports', layer: 'kernel'},
    data: {portStatus: 'unavailable'},
    security: {containsSensitiveRaw: false, maskingMode: 'masked'},
  };
  const earlier = Buffer.from(
    `Web  ERROR  ${JSON.stringify({...resetEvent, event: 'runtime.system-failure.reset-accepted', data: {portStatus: 'accepted'}})}\n先前日志\n`,
  );
  const later = Buffer.from(`Web  ERROR  ${JSON.stringify(resetEvent)}\n`);
  const forgedMinimal = Buffer.from(
    'Web LOG fixture {"event":"runtime.system-failure.reset-unavailable","data":{"portStatus":"unavailable"}}\n',
  );
  const combined = Buffer.concat([earlier, forgedMinimal, later, Buffer.from('Web ERROR {"event":"partial')]);
  assert.deepEqual(parseJsonEventsAfterByteOffset(combined, earlier.length), [resetEvent]);
  assert.deepEqual(parseJsonEventsAfterByteOffset(combined, 0), [
    {...resetEvent, event: 'runtime.system-failure.reset-accepted', data: {portStatus: 'accepted'}},
    resetEvent,
  ]);
  assert.equal(isExpectedRuntimeLogEvent(resetEvent, 'runtime.system-failure.reset-unavailable'), true);
  assert.equal(
    isExpectedRuntimeLogEvent({...resetEvent, category: 'fixture'}, 'runtime.system-failure.reset-unavailable'),
    false,
    'the event name alone cannot satisfy the runtime owner log contract',
  );
  const reactNativeWebConsoleRecord = Buffer.from(
    'Web  ERROR  {"category": "runtime.system-failure", "context": {"commandName": "kernel.base.runtime.reset-runtime-after-system-failure", "connectionId": undefined}, "data": {"portStatus": "unavailable"}, "error": undefined, "event": "runtime.system-failure.reset-unavailable", "level": "error", "message": "literal undefined: undefined stays text", "scope": {"component": undefined, "layer": "kernel", "moduleName": "platform-ports", "subsystem": undefined}, "security": {"containsSensitiveRaw": false, "maskingMode": "masked"}, "timestamp": 1790740000000}\n',
  );
  const normalizedExpoEvents = parseJsonEventsAfterByteOffset(reactNativeWebConsoleRecord, 0);
  assert.equal(normalizedExpoEvents.length, 1, 'actual Expo console object formatting must be machine-readable');
  assert.equal(normalizedExpoEvents[0].context.connectionId, null);
  assert.equal(normalizedExpoEvents[0].error, null);
  assert.equal(normalizedExpoEvents[0].message, 'literal undefined: undefined stays text');
  assert.equal(
    isExpectedRuntimeLogEvent(normalizedExpoEvents[0], 'runtime.system-failure.reset-unavailable'),
    true,
    'runtime owner is verified by the platform-port logger plus exact reset command context',
  );
  assert.equal(
    isExpectedRuntimeLogEvent(
      {...resetEvent, scope: {moduleName: 'fixture', layer: 'kernel'}},
      'runtime.system-failure.reset-unavailable',
    ),
    false,
  );
  const midRecordOffset = earlier.indexOf(Buffer.from('"event"')) + 2;
  assert.deepEqual(parseJsonEventsAfterByteOffset(Buffer.concat([earlier, later]), midRecordOffset), [resetEvent]);
  assert.throws(() => parseJsonEventsAfterByteOffset(combined, combined.length + 1), /WEB_LOG_BYTE_OFFSET_INVALID/);

  const olderEvent = {...resetEvent, timestamp: 99, event: 'admin.launcher-open-requested', category: 'admin.launcher'};
  const targetEvent = {...olderEvent, timestamp: 101};
  const partialOlderRecord = Buffer.from(`Web  INFO  ${JSON.stringify(olderEvent).slice(0, 80)}`);
  const checkpointPrefix = Buffer.concat([Buffer.from('completed old line\n'), partialOlderRecord]);
  const checkpoint = createWebLogCheckpoint(checkpointPrefix, 100);
  const checkpointSuffix = Buffer.from(
    `${JSON.stringify(olderEvent).slice(80)}\nWeb  INFO  ${JSON.stringify(targetEvent)}\n`,
  );
  const recordsAfterSplitCheckpoint = parseJsonEventsAfterByteOffset(
    Buffer.concat([checkpointPrefix, checkpointSuffix]),
    checkpoint,
  );
  assert.deepEqual(
    recordsAfterSplitCheckpoint,
    [targetEvent],
    'a partial old record must not hide or impersonate a complete post-checkpoint event',
  );
  assert.deepEqual(createWebLogCheckpoint(Buffer.from('x'), 100), {
    byteOffset: 1,
    notBeforeEpochMillis: 100,
  });

  const runnerSource = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'), 'utf8');
  const waitStart = runnerSource.indexOf('const waitForLogEvent =');
  const waitEnd = runnerSource.indexOf('\nconst observeAdminLauncherAfterFailure', waitStart);
  assert.ok(waitStart >= 0 && waitEnd > waitStart, 'log event wait helper must exist and be bounded');
  assert.match(runnerSource.slice(waitStart, waitEnd), /parseJsonEventsAfterByteOffset\(bytes, checkpoint\)/);
  assert.match(runnerSource.slice(waitStart, waitEnd), /expectedOwnerEventCount/);
  assert.match(runnerSource.slice(waitStart, waitEnd), /elapsedMs/);
});

test('W2 sends pointer probe, Tab, Shift+Tab, scanner suffix, and Enter in order', async () => {
  const observed = [];
  const keyboard = Object.fromEntries(
    ['type', 'press', 'down', 'up'].map(method => [method, async value => observed.push([method, value])]),
  );
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
  const request = fetchExpoWebReadiness(
    (_url, {signal}) => {
      observedSignal = signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {once: true});
      });
    },
    'http://127.0.0.1:8093/',
    5,
  );

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
  assert.throws(() => assertManagedWebListenerOwnership([501], [{pid: 501, ownershipUnverified: true}]), {
    message: 'WEB_PORT_LISTENER_NOT_OWNED_BY_RUNNER',
  });
  assert.throws(() => assertManagedWebListenerOwnership([], ownedTree), {
    message: 'WEB_PORT_LISTENER_NOT_OBSERVED',
  });
  assert.deepEqual(
    verifyExpoWebListenerOwnership({
      stdout: '501\n',
      status: 0,
      ownedProcessTree: ownedTree,
    }),
    [501],
  );
  assert.throws(
    () =>
      verifyExpoWebListenerOwnership({
        stdout: '900\n',
        status: 0,
        ownedProcessTree: ownedTree,
      }),
    {
      message: 'WEB_PORT_LISTENER_NOT_OWNED_BY_RUNNER',
    },
  );

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
    'scripts/test/ter-admin-display-web.test.mjs',
    'scripts/test/terminal-client-dev-acceptance.mjs',
    'scripts/test/terminal-business-fixtures.mjs',
    'scripts/dev/r5-dev-environment.mjs',
    'scripts/dev/r5-dev-runner.mjs',
    'scripts/dev/r5-remote-java-runtime.mjs',
    'scripts/dev/managed-diagnostic-protocol.mjs',
    'scripts/dev/r5-managed-terminal-topology.mjs',
    'scripts/dev/r5-remote-java.mjs',
    'scripts/dev/r5-doris-resident.mjs',
    'scripts/dev/terminal-client-dev-acceptance-lock.mjs',
  ])
    assert.ok(files.includes(expected), `WEB_SOURCE_INVENTORY_MISSING:${expected}`);
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

test('Web runner runtime directories reject symlinked roots and stay inside the repository', t => {
  const directory = temporaryDirectory(t);
  const fakeRepositoryRoot = path.join(directory, 'repository');
  const outsideDirectory = path.join(directory, 'outside');
  fs.mkdirSync(fakeRepositoryRoot, {recursive: true});
  fs.mkdirSync(outsideDirectory, {recursive: true});

  const safeRuntime = ensureContainedWebDirectory(
    fakeRepositoryRoot,
    path.join(fakeRepositoryRoot, '.runtime/ter-admin-display'),
  );
  assert.equal(safeRuntime, path.join(fs.realpathSync(fakeRepositoryRoot), '.runtime/ter-admin-display'));

  const otherRepositoryRoot = path.join(directory, 'other-repository');
  fs.mkdirSync(otherRepositoryRoot, {recursive: true});
  fs.symlinkSync(outsideDirectory, path.join(otherRepositoryRoot, '.runtime'));
  assert.throws(
    () =>
      ensureContainedWebDirectory(otherRepositoryRoot, path.join(otherRepositoryRoot, '.runtime/ter-admin-display')),
    {message: 'TER_ADMIN_DISPLAY_WEB_RUNTIME_PATH_INVALID'},
  );
  assert.equal(fs.existsSync(path.join(outsideDirectory, 'ter-admin-display')), false);
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
  const firstFailureManifest = {business: 'PASS', firstFailure: 'EARLIER_FIRST_FAILURE'};
  applyWebSourceSnapshot(firstFailureManifest, before, afterContent);
  assert.equal(firstFailureManifest.firstFailure, 'EARLIER_FIRST_FAILURE');
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
  const result = childProcess.spawnSync(
    process.execPath,
    [
      path.join(repositoryRoot, 'scripts/test/ter-admin-display-web.mjs'),
      runId,
      '18993',
      '-',
      'sample-console',
      'keyboard-login',
      'laptop',
    ],
    {cwd: repositoryRoot, encoding: 'utf8'},
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /WEB_KEYBOARD_JOURNEY_SCOPE_INVALID/);
  assert.equal(fs.existsSync(runRoot), false);
});
