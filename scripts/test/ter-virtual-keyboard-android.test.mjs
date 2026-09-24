import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import * as runner from './ter-virtual-keyboard-android.mjs';
import {
  emptyFrameMatrix,
  captureObservationMatrix,
  classifyFrameRoute,
  iaControlRoster,
  perControlVisualAuditRows,
  parseArgs,
  parseAndroidProcessTable,
  parseLogicalDisplays,
  parseResourceNode,
  parseResourceContentDescriptionHash,
  parseResourceTextHash,
  parseVisibleControlInventory,
  sameResourceNodeBounds,
  URL_SYMBOL_KEYS,
  URL_SYMBOL_SEQUENCE,
  parseDumpsysDisplayFacts,
  parseDisplayWindowIdentity,
  parsePngFileDescription,
  parseSurfaceDisplays,
  resolveCaptureDisplayInventory,
  validateDeviceShape,
} from './ter-virtual-keyboard-android.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const IA_IDS = [
  'VK-IA-01', 'VK-IA-02', 'VK-IA-03', 'VK-IA-04', 'VK-IA-05', 'VK-IA-06', 'VK-IA-07',
  'VK-IA-08', 'VK-IA-09', 'VK-IA-10', 'VK-IA-11', 'VK-IA-12', 'VK-IA-13', 'VK-IA-14',
  'VK-IA-15', 'VK-IA-16', 'VK-IA-17', 'VK-IA-18', 'VK-IA-19',
];

function validManifest() {
  return {
    schemaVersion: 2,
    runId: 'vk-run-01',
    devices: {
      dual: {serial: 'emulator-5554', inventory: {serial: 'emulator-5554', bootId: 'boot-12345678'}},
      mobile: {serial: 'emulator-5556', inventory: {serial: 'emulator-5556', bootId: 'boot-87654321'}},
    },
    appBindings: {
      'sample-terminal': {
        apkPath: 'apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk',
        bytes: 128,
        sha256: 'a'.repeat(64),
      },
    },
    ownedRemoteProcesses: [],
    ownedRemoteCaptureProcesses: [],
    pendingRemoteLaunches: [],
    pendingRemoteCaptureProcesses: [],
    remoteTempFiles: [],
    processes: [],
  };
}

function validLaunchLogReinspectionManifest() {
  const intent = {
    intentId: 'dual-sample-terminal-epoch-01', shape: 'dual', appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal', host: 'emulator-5554', bootId: 'boot-12345678',
    resolution: 'PROCESS_ABSENT', processCount: 0,
  };
  const inspection = {
    intentId: intent.intentId, shape: intent.shape, appName: intent.appName, packageName: intent.packageName,
    host: intent.host, bootId: intent.bootId, evidenceStatus: 'MATCHED', startupPid: '321',
    startupAtEpochMs: 1790203633400, overlayOutcome: 'ATTACHED',
    observedMarkers: ['activity.onCreate:start', 'native.loading-overlay-attached'], markerCount: 2,
    signals: {fatalException: false, processDied: false, nativeFatalSignals: [], exceptionTypes: [], appFrames: [], jsErrorSeen: false},
    processObservation: {
      startupPid: '321', processTableCandidateCount: 1,
      processTableCandidates: [{pid: 321, name: 'com.anonymous.sampleterminal', statStatus: 'READABLE', processState: 'S', startTicks: '9001'}],
      startupPidStatus: 'READABLE',
    },
    exitInfo: {startupPid: '321', status: 'NO_PACKAGE_RECORD', packageRecordCount: 0, targetPidRecordCount: 0, records: []},
    inspectedAt: '2026-09-24T00:00:00.000Z',
  };
  const manifest = validManifest();
  manifest.resolvedRemoteLaunches = [intent];
  manifest.launchLogReinspections = [inspection];
  return {manifest, intent, inspection};
}

test('runner requires explicit, distinct device identities and keeps fixed IA denominator', () => {
  assert.deepEqual(parseArgs(['prepare', '--run-id', 'vk-run-01', '--dual-serial', 'emulator-5554']), {
    positionals: ['prepare'], 'run-id': 'vk-run-01', 'dual-serial': 'emulator-5554',
  });
  const frames = emptyFrameMatrix();
  assert.deepEqual(Object.keys(frames), IA_IDS);
  assert.throws(() => parseArgs(['prepare', '--run-id', 'x', '--run-id', 'y']), /VK_ANDROID_ARGUMENT_INVALID/);
});

test('successful Gradle output binds a nonempty APK by exact bytes without requiring mtime churn', () => {
  assert.equal(typeof runner.createAppBuildBinding, 'function');
  const bytes = Buffer.from('verified APK bytes');
  const binding = runner.createAppBuildBinding('apps/example/app-release.apk', bytes);
  assert.deepEqual({apkPath: binding.apkPath, bytes: binding.bytes, sha256: binding.sha256}, {
    apkPath: 'apps/example/app-release.apk', bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  assert.match(binding.builtAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.throws(() => runner.createAppBuildBinding('apps/example/app-release.apk', Buffer.alloc(0)), /VK_ANDROID_BUILD_ARTIFACT_INVALID/);
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const build = source.slice(source.indexOf('async function buildApp('), source.indexOf('async function remoteProcessIdentity('));
  assert.match(build, /createAppBuildBinding\(path\.relative\(ROOT, apk\), bytes\)/);
  assert.match(build, /'--rerun-tasks'/);
  assert.match(build, /env: releaseBuildEnvironment\(\)/);
  assert.doesNotMatch(build, /mtime|BUILD_ARTIFACT_NOT_REFRESHED/);
  assert.deepEqual(runner.releaseBuildEnvironment({NODE_ENV: 'development', CI: '1'}), {NODE_ENV: 'production', CI: '1'});
});

test('report retains the full IA by app by VM-shape by surface observation denominator without visual false PASS', () => {
  const frames = emptyFrameMatrix();
  frames['VK-IA-01'].captures.push({
    shape: 'dual', app: 'sample-terminal', surface: 'primary', screenshot: 'evidence/one.png',
    captureEvidence: 'evidence/one.capture-evidence.json', state: 'stable', transitionIndex: null,
  });
  const matrix = captureObservationMatrix(frames);
  assert.deepEqual(Object.keys(matrix), IA_IDS);
  assert.equal(Object.keys(matrix['VK-IA-01'].routes).length, 8);
  assert.equal(matrix['VK-IA-01'].routes['dual/sample-terminal/primary'].status, 'CAPTURED_AWAITING_PER_CONTROL_AUDIT');
  assert.equal(matrix['VK-IA-01'].routes['dual/sample-terminal/primary'].perControlVisualAudit, 'OPEN');
  assert.equal(matrix['VK-IA-01'].routes['dual/sample-wallpaper-terminal/primary'].status, 'OPEN_NOT_OBSERVED');
  assert.equal(matrix['VK-IA-01'].routes['mobile/sample-terminal/primary'].status, 'NOT_APPLICABLE_FRAME_SHAPE');
  assert.equal(matrix['VK-IA-03'].routes['dual/sample-wallpaper-terminal/primary'].status, 'NOT_COVERED_BY_PRODUCT_CONSUMER');
  assert.equal(matrix['VK-IA-17'].routes['dual/sample-terminal/primary'].status, 'HARNESS_ONLY_NOT_PRODUCT');
  assert.equal(matrix['VK-IA-19'].routes['dual/sample-wallpaper-terminal/secondary'].status, 'NOT_COVERED_BY_PRODUCT_CONSUMER');
  assert.equal(matrix['VK-IA-01'].routes['mobile/sample-terminal/secondary'].status, 'NOT_APPLICABLE_DEVICE_SHAPE');
  assert.equal(matrix['VK-IA-11'].routes['dual/sample-terminal/primary'].controlRoster.some(item => item.controlId === 'sample.desk.member-form:cancel'), true);
  assert.equal(matrix['VK-IA-11'].routes['dual/sample-wallpaper-terminal/primary'].controlRoster.some(item => item.controlId === 'sample.desk.member-form:cancel'), false);
});

test('all 19 IA frames retain explicit per-control rosters and CP-0 product coverage classes', () => {
  const frames = emptyFrameMatrix();
  const matrix = captureObservationMatrix(frames);
  assert.equal(Object.keys(matrix).length, 19);
  for (const [iaId, frame] of Object.entries(matrix)) {
    assert.ok(frame.controlRoster.length > 0, `${iaId} must have at least one expected visual/control target`);
    assert.equal(new Set(frame.controlRoster.map(item => item.controlId)).size, frame.controlRoster.length, `${iaId} roster IDs must be unique`);
    assert.equal(frame.controlRoster.every(item => item.status === 'OPEN' && item.reviewer === null), true);
  }
  assert.equal(iaControlRoster('VK-IA-01').length, 41);
  assert.equal(iaControlRoster('VK-IA-03').length, 31);
  assert.equal(iaControlRoster('VK-IA-03').some(item => item.controlId === 'ui.base.input:virtual-keyboard:space'), true);
  assert.equal(iaControlRoster('VK-IA-05').length, 13);
  assert.equal(iaControlRoster('VK-IA-07').length, 15);
  assert.equal(iaControlRoster('VK-IA-15').some(item => item.controlId === 'outgoing/ui.base.input:virtual-keyboard:text-1'), true);
  assert.equal(iaControlRoster('VK-IA-15').some(item => item.controlId === 'incoming/ui.base.input:virtual-keyboard:text-a'), true);
  assert.equal(classifyFrameRoute('VK-IA-13', 'dual', 'sample-terminal', 'secondary'), 'OPEN_PRODUCT_PATH_TO_CONFIRM');
  assert.equal(classifyFrameRoute('VK-IA-15', 'mobile', 'sample-terminal', 'primary'), 'NOT_APPLICABLE_FRAME_SHAPE');
  assert.equal(classifyFrameRoute('VK-IA-18', 'mobile', 'sample-wallpaper-terminal', 'primary'), 'PRODUCT_CONSUMER_CANDIDATE');
  assert.throws(() => iaControlRoster('VK-IA-99'), /VK_ANDROID_IA_ID_INVALID/);
});

test('per-control visual report includes every captured UI node and keeps all judgments OPEN by default', () => {
  const frames = emptyFrameMatrix();
  frames['VK-IA-01'].captures.push({
    shape: 'dual', app: 'sample-terminal', surface: 'primary', screenshot: 'evidence/one.png',
    visibleControls: [
      {nodeIndex: 0, resourceId: 'ui.base.input:virtual-keyboard:text-1', className: 'android.widget.Button', bounds: {left: 1, top: 2, right: 10, bottom: 11}, textSha256: 'a'.repeat(64), contentDescriptionSha256: 'b'.repeat(64)},
      {nodeIndex: 1, resourceId: null, resourceIdSha256: 'c'.repeat(64), className: 'android.widget.TextView', bounds: null, textSha256: null, contentDescriptionSha256: null},
    ],
  });
  const audit = perControlVisualAuditRows(frames);
  assert.equal(audit.length, 42);
  const observed = audit.find(row => row.controlId === 'ui.base.input:virtual-keyboard:text-1');
  assert.equal(observed?.presenceStatus, 'OBSERVED_AWAITING_VISUAL_JUDGMENT');
  assert.equal(observed?.observedResourceIds[0], 'ui.base.input:virtual-keyboard:text-1');
  assert.equal(audit.some(row => row.controlId === 'ui.base.input:virtual-keyboard:text-2' && row.presenceStatus === 'OPEN_EXPECTED_CONTROL_NOT_OBSERVED'), true);
  assert.equal(audit.some(row => row.controlId === 'unaddressed:android.widget.TextView:1:cccccccccccc'), true);
  assert.equal(audit.every(row => row.visualStatus === 'OPEN' && row.reviewer === null), true);
  assert.deepEqual(audit[0].visualDimensions, ['position', 'size', 'shape', 'color', 'icon', 'font', 'background', 'text', 'state', 'hierarchy', 'gap']);
});

test('prepare rejects a missing serial and duplicate dual/mobile identity before resource work', () => {
  assert.equal(typeof runner.validatePrepareOptions, 'function');
  assert.throws(() => runner.validatePrepareOptions({'run-id': 'vk-run-01', 'mobile-serial': 'emulator-5556'}), /VK_ANDROID_SERIAL_REQUIRED/);
  assert.throws(() => runner.validatePrepareOptions({'run-id': 'vk-run-01', 'dual-serial': 'emulator-5554', 'mobile-serial': 'emulator-5554'}), /VK_ANDROID_DEVICE_SERIALS_MUST_DIFFER/);
  assert.deepEqual(runner.validatePrepareOptions({'run-id': 'vk-run-01', 'dual-serial': 'emulator-5554', 'mobile-serial': 'emulator-5556'}), {
    runId: 'vk-run-01', dualSerial: 'emulator-5554', mobileSerial: 'emulator-5556',
  });
});

test('ADB device inventory accepts tab or space delimiters and excludes non-device states', () => {
  assert.equal(typeof runner.parseAdbDeviceList, 'function');
  if (typeof runner.parseAdbDeviceList !== 'function') return;
  const output = [
    'List of devices attached',
    'emulator-5554 device product:sdk_gtablet_arm64 model:Pixel_Tablet device:emu64a transport_id:1',
    'emulator-5556\tdevice product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:2',
    'emulator-5558 offline product:sdk_gphone64_arm64 model:sdk_gphone64_arm64',
    'emulator-5560 unauthorized product:sdk_gphone64_arm64 model:sdk_gphone64_arm64',
    '',
  ].join('\n');
  assert.deepEqual([...runner.parseAdbDeviceList(output).keys()], ['emulator-5554', 'emulator-5556']);
  const runnerSource = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const queryDevicesSource = runnerSource.slice(
    runnerSource.indexOf('async function queryDevices('),
    runnerSource.indexOf('async function inventoryDevice('),
  );
  assert.match(queryDevicesSource, /parseAdbDeviceList\(output\)/);
  assert.doesNotMatch(queryDevicesSource, /\\tdevice/);
});

test('Android process-table parser keeps exact package and colon sub-process identities', () => {
  assert.equal(typeof parseAndroidProcessTable, 'function');
  assert.deepEqual(parseAndroidProcessTable([
    'PID NAME',
    '101 init',
    '202 com.anonymous.sampleterminal',
    '303 com.anonymous.sampleterminal:remote',
    '404 com.anonymous.sampleterminal.debug',
    '505 com.catering.v2s.terminal.samplewallpaper',
  ].join('\n'), 'com.anonymous.sampleterminal'), [
    {pid: 202, name: 'com.anonymous.sampleterminal'},
    {pid: 303, name: 'com.anonymous.sampleterminal:remote'},
  ]);
  assert.throws(() => parseAndroidProcessTable('USER PID CMD\nuser 202 app', 'com.anonymous.sampleterminal'), /VK_ANDROID_PROCESS_TABLE_INVALID/);
  assert.throws(() => parseAndroidProcessTable('PID NAME\n202 com.unknown', 'com.unknown'), /VK_ANDROID_APP_INVALID/);
});

test('process observation keeps ps candidates whose proc stat disappeared', () => {
  const pkg = 'com.anonymous.sampleterminal';
  const statFields = ['S', '1', ...Array(17).fill('0'), '90210'];
  const result = runner.summarizeAndroidProcessObservation([
    'PID NAME',
    `${4500} ${pkg}`,
    `${4501} ${pkg}:remote`,
    '4502 com.other.app',
  ].join('\n'), pkg, new Map([
    ['4500', ''],
    ['4501', `4501 (${pkg}:remote) ${statFields.join(' ')}`],
  ]), '4500');

  assert.deepEqual(result, {
    startupPid: '4500',
    processTableCandidateCount: 2,
    processTableCandidates: [
      {pid: 4500, name: pkg, statStatus: 'UNREADABLE', processState: null, startTicks: null},
      {pid: 4501, name: `${pkg}:remote`, statStatus: 'READABLE', processState: 'S', startTicks: '90210'},
    ],
    startupPidStatus: 'CANDIDATE_STAT_UNREADABLE',
  });
});

test('activity exit-info summary keeps exact target exit facts and drops descriptions', () => {
  const pkg = 'com.anonymous.sampleterminal';
  const evidence = runner.summarizeAndroidExitInfo([
    'Historical Process Exit for uid 10234:',
    `  #0: ApplicationExitInfo(timestamp=2026-09-24 01:06:58, pid=4500, process=${pkg}, reason=6 (CRASH_NATIVE), subReason=0, status=11, description=private raw exception payload)`,
    '  #1: ApplicationExitInfo(timestamp=2026-09-24 01:05:00, pid=4499, process=com.other.app, reason=4 (USER_REQUESTED), status=0, description=ignore)',
  ].join('\n'), pkg, '4500');

  assert.deepEqual(evidence, {
    startupPid: '4500',
    status: 'MATCHED',
    packageRecordCount: 1,
    targetPidRecordCount: 1,
    records: [{pid: 4500, reasonCode: 6, reasonName: 'CRASH_NATIVE', statusCode: 11}],
  });
  assert.doesNotMatch(JSON.stringify(evidence), /private raw exception payload|description/);
});

test('run manifest accepts only fixed app bindings and run-scoped remote temporary files', () => {
  assert.equal(typeof runner.validateRunManifest, 'function');
  assert.equal(runner.validateRunManifest(validManifest()), true);

  const wrongPackage = validManifest();
  wrongPackage.ownedRemoteProcesses.push({
    host: 'emulator-5554', bootId: 'boot-a', packageName: 'com.attacker/.Injected',
    appName: 'sample-terminal', shape: 'dual', processes: [{pid: 100, startTicks: '20'}],
  });
  assert.throws(() => runner.validateRunManifest(wrongPackage), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);

  const wrongPath = validManifest();
  wrongPath.appBindings['sample-terminal'].apkPath = '../../tmp/foreign.apk';
  assert.throws(() => runner.validateRunManifest(wrongPath), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);

  const wrongTemporaryPath = validManifest();
  wrongTemporaryPath.remoteTempFiles.push({host: 'emulator-5554', path: '/sdcard/other-run-dual-1234567890123.xml'});
  assert.throws(() => runner.validateRunManifest(wrongTemporaryPath), /VK_ANDROID_MANIFEST_TEMP_PATH_INVALID/);

  const ownedRecorder = validManifest();
  ownedRecorder.ownedRemoteCaptureProcesses.push({shape: 'dual', host: 'emulator-5554', bootId: 'boot-id-123', executable: 'screenrecord', pid: 123, startTicks: '50', path: '/sdcard/vk-run-01-dual-1234567890123-transition.mp4'});
  ownedRecorder.remoteTempFiles.push({host: 'emulator-5554', path: '/sdcard/vk-run-01-dual-1234567890123-transition.mp4'});
  assert.equal(runner.validateRunManifest(ownedRecorder), true);
  const foreignRecorder = validManifest();
  foreignRecorder.ownedRemoteCaptureProcesses.push({shape: 'dual', host: 'emulator-5554', bootId: 'boot-id-123', executable: 'screenrecord', pid: 123, startTicks: '50', path: '/sdcard/foreign-dual-1234567890123-transition.mp4'});
  assert.throws(() => runner.validateRunManifest(foreignRecorder), /VK_ANDROID_REMOTE_CAPTURE_IDENTITY_INVALID/);
});

test('remote process identity includes the bound device serial, boot and complete PID/start-tick set', () => {
  assert.equal(typeof runner.remoteProcessIdentityMatches, 'function');
  const expected = {host: 'emulator-5554', bootId: 'boot-a', processes: [{pid: 101, startTicks: '900'}]};
  assert.equal(runner.remoteProcessIdentityMatches(expected, expected, 'emulator-5554'), true);
  assert.equal(runner.remoteProcessIdentityMatches(expected, expected, 'emulator-5556'), false);
  assert.equal(runner.remoteProcessIdentityMatches(expected, {...expected, bootId: 'boot-b'}, 'emulator-5554'), false);
  assert.equal(runner.remoteProcessIdentityMatches(expected, {...expected, processes: []}, 'emulator-5554'), false);
});

test('cleanup terminates only a still-live local command with matching PID, PGID and start token', async () => {
  assert.equal(typeof runner.cleanupRecordedLocalCommand, 'function');
  const manifest = {activeProcessIdentity: {pid: 42, pgid: 42, startToken: 'Mon Sep 21 10:11:12 2026'}};
  let terminateCalls = 0;
  let rows = [{pid: 42, pgid: 42, startToken: 'Mon Sep 21 10:11:12 2026'}];
  const matched = await runner.cleanupRecordedLocalCommand(manifest, {
    readTable: () => rows,
    terminate: async identity => {
      terminateCalls += 1;
      assert.deepEqual(identity, manifest.activeProcessIdentity);
      rows = [];
      return {status: 'PASS', treeReadback: []};
    },
  });
  assert.equal(matched.status, 'PASS');
  assert.equal(terminateCalls, 1);
  assert.equal(manifest.activeProcessIdentity, null);

  const reused = {activeProcessIdentity: {pid: 42, pgid: 42, startToken: 'old-process'}};
  terminateCalls = 0;
  const rejected = await runner.cleanupRecordedLocalCommand(reused, {
    readTable: () => [{pid: 42, pgid: 42, startToken: 'new-process'}],
    terminate: async () => { terminateCalls += 1; return {status: 'PASS', treeReadback: []}; },
  });
  assert.equal(rejected.status, 'FAIL');
  assert.equal(terminateCalls, 0);

  const exitedCommandWithLiveRunner = {
    activeProcessIdentity: {pid: 42, pgid: 42, startToken: 'old-command'},
    processes: [{pid: 7, pgid: 7, startToken: 'live-runner', commandLabel: 'managed-runner'}],
  };
  const runnerStillLive = await runner.cleanupRecordedLocalCommand(exitedCommandWithLiveRunner, {
    readTable: () => [{pid: 7, pgid: 7, startToken: 'live-runner'}],
    terminate: async () => { throw new Error('must-not-terminate-unowned-runner-group'); },
  });
  assert.deepEqual(runnerStillLive, {status: 'FAIL', reason: 'VK_ANDROID_LOCAL_RUNNER_STILL_LIVE'});
});

test('pending remote launch survives a failed readback so cleanup cannot report false PASS', async () => {
  assert.equal(typeof runner.launchWithPendingOwnership, 'function');
  const manifest = {devices: {dual: {serial: 'emulator-5554'}}, pendingRemoteLaunches: [], ownedRemoteProcesses: []};
  const order = [];
  await assert.rejects(() => runner.launchWithPendingOwnership(manifest, {
    host: 'emulator-5554', bootId: 'boot-a', packageName: 'com.anonymous.sampleterminal',
    appName: 'sample-terminal', shape: 'dual', intentId: 'launch-01',
  }, {
    persist: async () => { order.push(`persist:${manifest.pendingRemoteLaunches.length}`); },
    launch: async () => { order.push(`launch:${manifest.pendingRemoteLaunches.length}`); },
    readback: async () => { order.push(`readback:${manifest.pendingRemoteLaunches.length}`); throw new Error('readback-failed'); },
  }), /readback-failed/);
  assert.deepEqual(order, ['persist:1', 'launch:1', 'readback:1']);
  assert.equal(manifest.pendingRemoteLaunches.length, 1);
  assert.equal(manifest.ownedRemoteProcesses.length, 0);
});

test('managed cleanup recovers only runner-recorded invalidated app ownership on the same host and boot', () => {
  const makeManifest = ({startupPid = null, resolution = 'PROCESS_ABSENT', markers = ['activity.onCreate:start']} = {}) => {
    const manifest = validManifest();
    const bootId = 'boot-recovery-12345678';
    manifest.devices.dual.inventory = {bootId};
    const intent = {
      intentId: 'dual-sample-terminal-recovery-01', shape: 'dual', appName: 'sample-terminal',
      packageName: 'com.anonymous.sampleterminal', host: 'emulator-5554', bootId,
      startedAt: '2026-09-24T00:00:00Z', resolution, processCount: 0,
    };
    manifest.resolvedRemoteLaunches = [{...intent}];
    manifest.launchDiagnostics = [{
      intentId: intent.intentId, shape: intent.shape, appName: intent.appName,
      packageName: intent.packageName, host: intent.host, bootId: intent.bootId,
      startupPid: startupPid == null ? null : String(startupPid), observedMarkers: markers,
    }];
    return {manifest, intent};
  };

  const {manifest, intent} = makeManifest({startupPid: 4500});
  assert.equal(runner.resolveInvalidatedRemoteLaunch(manifest, intent.intentId, {
    host: intent.host, bootId: intent.bootId, processes: [{pid: 4500, startTicks: '90123'}],
  }, '2026-09-24T03:00:00Z'), 'PROCESS_ADOPTED');
  assert.deepEqual(manifest.ownedRemoteProcesses, [{
    host: intent.host, bootId: intent.bootId, processes: [{pid: 4500, startTicks: '90123'}],
    packageName: intent.packageName, appName: intent.appName, shape: intent.shape,
  }]);
  assert.equal(manifest.historicalRemoteLaunchRecoveries[0].resolution, 'PROCESS_ADOPTED');
  assert.equal(runner.validateRunManifest(manifest), true);

  const absent = makeManifest();
  assert.equal(runner.resolveInvalidatedRemoteLaunch(absent.manifest, absent.intent.intentId, {
    host: absent.intent.host, bootId: absent.intent.bootId, processes: [],
  }, '2026-09-24T03:00:01Z'), 'PROCESS_ABSENT');
  assert.equal(absent.manifest.ownedRemoteProcesses.length, 0);
  assert.equal(runner.validateRunManifest(absent.manifest), true);

  const invalidReadbacks = [
    {host: intent.host, bootId: 'other-boot-12345678', processes: []},
    {host: 'emulator-5556', bootId: intent.bootId, processes: []},
    {host: intent.host, bootId: intent.bootId, processes: [{pid: 4501, startTicks: '90123'}]},
    {host: intent.host, bootId: intent.bootId, processes: [{pid: 4500, startTicks: 'bad'}]},
  ];
  for (const observed of invalidReadbacks) {
    const invalid = makeManifest({startupPid: 4500});
    assert.throws(() => runner.resolveInvalidatedRemoteLaunch(invalid.manifest, invalid.intent.intentId, observed),
      /VK_ANDROID_HISTORICAL_LAUNCH_IDENTITY_MISMATCH/);
    assert.equal(invalid.manifest.ownedRemoteProcesses.length, 0);
    assert.equal(invalid.manifest.historicalRemoteLaunchRecoveries, undefined);
  }
  for (const invalid of [
    makeManifest({resolution: 'PROCESS_ADOPTED'}),
    makeManifest({markers: []}),
  ]) {
    assert.throws(() => runner.resolveInvalidatedRemoteLaunch(invalid.manifest, invalid.intent.intentId, {
      host: invalid.intent.host, bootId: invalid.intent.bootId, processes: [],
    }), /VK_ANDROID_HISTORICAL_LAUNCH_IDENTITY_MISMATCH/);
    assert.equal(invalid.manifest.ownedRemoteProcesses.length, 0);
  }

  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const recovery = source.slice(source.indexOf('async function recoverInvalidatedLaunchOwnership('), source.indexOf('async function doCleanup('));
  assert.match(recovery, /remoteProcessIdentity\(manifest, device, intent\.packageName\)/);
  assert.match(recovery, /resolveInvalidatedRemoteLaunch\(manifest, intent\.intentId, observed\)/);
  assert.match(recovery, /doCleanup\(manifest\)/);
  assert.match(source, /args\['recover-invalidated-launches'\] === 'yes'/);
});

test('unresolved launch reports a bounded diagnostic callback before preserving failure ownership', async () => {
  const manifest = {devices: {dual: {serial: 'emulator-5554'}}, pendingRemoteLaunches: [], ownedRemoteProcesses: []};
  const notices = [];
  await assert.rejects(() => runner.launchWithPendingOwnership(manifest, {
    host: 'emulator-5554', bootId: 'boot-a', packageName: 'com.anonymous.sampleterminal',
    appName: 'sample-terminal', shape: 'dual', intentId: 'launch-capture-01',
  }, {
    persist: async () => {},
    launch: async () => {},
    readback: async () => ({host: 'emulator-5554', bootId: 'boot-a', processes: []}),
    onLaunchFailure: async notice => { notices.push(notice); },
  }), /VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED/);
  assert.deepEqual(notices, [{intentId: 'launch-capture-01', stage: 'ownership-readback', failureCode: 'VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED'}]);
  assert.equal(manifest.pendingRemoteLaunches.length, 1);
  assert.equal(manifest.ownedRemoteProcesses.length, 0);

  const errorManifest = {devices: {dual: {serial: 'emulator-5554'}}, pendingRemoteLaunches: [], ownedRemoteProcesses: []};
  const errorNotices = [];
  await assert.rejects(() => runner.launchWithPendingOwnership(errorManifest, {
    host: 'emulator-5554', bootId: 'boot-a', packageName: 'com.anonymous.sampleterminal',
    appName: 'sample-terminal', shape: 'dual', intentId: 'launch-capture-02',
  }, {
    persist: async () => {},
    launch: async () => {},
    readback: async () => { throw new Error('raw readback detail must not enter callback'); },
    onLaunchFailure: async notice => { errorNotices.push(notice); },
  }), /raw readback detail must not enter callback/);
  assert.deepEqual(errorNotices, [{intentId: 'launch-capture-02', stage: 'process-readback', failureCode: 'VK_ANDROID_REMOTE_PROCESS_READBACK_FAILED'}]);
  assert.equal(errorManifest.pendingRemoteLaunches.length, 1);
  assert.equal(errorManifest.ownedRemoteProcesses.length, 0);

  const launchErrorManifest = {devices: {dual: {serial: 'emulator-5554'}}, pendingRemoteLaunches: [], ownedRemoteProcesses: []};
  const launchErrorNotices = [];
  await assert.rejects(() => runner.launchWithPendingOwnership(launchErrorManifest, {
    host: 'emulator-5554', bootId: 'boot-a', packageName: 'com.anonymous.sampleterminal',
    appName: 'sample-terminal', shape: 'dual', intentId: 'launch-capture-03',
  }, {
    persist: async () => {},
    launch: async () => { throw new Error('VK_ANDROID_ACTIVITY_LAUNCH_FAILED'); },
    readback: async () => { throw new Error('readback must not be reached'); },
    onLaunchFailure: async notice => { launchErrorNotices.push(notice); },
  }), /VK_ANDROID_ACTIVITY_LAUNCH_FAILED/);
  assert.deepEqual(launchErrorNotices, [{intentId: 'launch-capture-03', stage: 'activity-launch', failureCode: 'VK_ANDROID_ACTIVITY_LAUNCH_FAILED'}]);
  assert.equal(launchErrorManifest.pendingRemoteLaunches.length, 1);
  assert.equal(launchErrorManifest.ownedRemoteProcesses.length, 0);
});

test('launch diagnostic callback failure cannot replace the original launch failure', async () => {
  const manifest = {devices: {dual: {serial: 'emulator-5554'}}, pendingRemoteLaunches: [], ownedRemoteProcesses: []};
  await assert.rejects(() => runner.launchWithPendingOwnership(manifest, {
    host: 'emulator-5554', bootId: 'boot-a', packageName: 'com.anonymous.sampleterminal',
    appName: 'sample-terminal', shape: 'dual', intentId: 'launch-capture-callback-fails',
  }, {
    persist: async () => {},
    launch: async () => {},
    readback: async () => ({host: 'emulator-5554', bootId: 'boot-a', processes: []}),
    onLaunchFailure: async () => { throw new Error('diagnostic-write-failed'); },
  }), /VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED/);
  assert.equal(manifest.pendingRemoteLaunches.length, 1);
  assert.equal(manifest.ownedRemoteProcesses.length, 0);
});

test('launch crash diagnostics expose only package-bound failure facts and reconcile exact pending ownership', () => {
  assert.equal(typeof runner.summarizeAndroidLaunchDiagnostics, 'function');
  assert.equal(typeof runner.resolvePendingRemoteLaunch, 'function');
  const summary = runner.summarizeAndroidLaunchDiagnostics([
    'E/AndroidRuntime( 100): FATAL EXCEPTION: main',
    'E/AndroidRuntime( 100): Process: com.anonymous.sampleterminal, PID: 100',
    'E/AndroidRuntime( 100): java.lang.RuntimeException: password=secret token=abc 192.168.1.2',
    'E/AndroidRuntime( 100):     at com.anonymous.sampleterminal.MainActivity.onCreate(MainActivity.kt:42)',
    'E/AndroidRuntime( 100): Process: com.other.app, PID: 200',
    'E/AndroidRuntime( 200): java.lang.IllegalStateException: unrelated',
  ].join('\n'), 'com.anonymous.sampleterminal', '100');
  assert.deepEqual(summary, {
    fatalException: true,
    processDied: false,
    nativeFatalSignals: [],
    exceptionTypes: ['java.lang.RuntimeException'],
    appFrames: [{className: 'com.anonymous.sampleterminal.MainActivity', location: 'MainActivity.kt:42'}],
    jsErrorSeen: false,
  });

  const processDeathForOtherPid = runner.summarizeAndroidLaunchDiagnostics([
    'E/AndroidRuntime( 100): Process: com.anonymous.sampleterminal, PID: 100',
    'E/ActivityManager( 1): Process com.anonymous.sampleterminal (pid 200) has died: fg TOP',
  ].join('\n'), 'com.anonymous.sampleterminal', '100');
  assert.equal(processDeathForOtherPid.processDied, false);
  const processDeathForPackagePrefix = runner.summarizeAndroidLaunchDiagnostics([
    'E/AndroidRuntime( 100): Process: com.anonymous.sampleterminal, PID: 100',
    'E/ActivityManager( 1): Process com.anonymous.sampleterminal.debug (pid 100) has died: fg TOP',
  ].join('\n'), 'com.anonymous.sampleterminal', '100');
  assert.equal(processDeathForPackagePrefix.processDied, false);
  const processDeathForTargetPid = runner.summarizeAndroidLaunchDiagnostics([
    'E/AndroidRuntime( 100): Process: com.anonymous.sampleterminal, PID: 100',
    'E/ActivityManager( 1): Process com.anonymous.sampleterminal (pid 100) has died: fg TOP',
  ].join('\n'), 'com.anonymous.sampleterminal', '100');
  assert.equal(processDeathForTargetPid.processDied, true);
  const processDeathFromStartupBreadcrumbPid = runner.summarizeAndroidLaunchDiagnostics([
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'I/ActivityManager( 1): Process com.anonymous.sampleterminal (pid 321) has died: vis +30s',
  ].join('\n'), 'com.anonymous.sampleterminal', '321');
  assert.equal(processDeathFromStartupBreadcrumbPid.processDied, true);
  const processDeathForOtherStartupPid = runner.summarizeAndroidLaunchDiagnostics([
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'I/ActivityManager( 1): Process com.anonymous.sampleterminal (pid 654) has died: vis +30s',
  ].join('\n'), 'com.anonymous.sampleterminal', '321');
  assert.equal(processDeathForOtherStartupPid.processDied, false);
  const staleProcessDeathBeforeLatestLaunch = runner.summarizeAndroidLaunchDiagnostics([
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'I/ActivityManager( 1): Process com.anonymous.sampleterminal (pid 321) has died: vis +30s',
    'I/TER-Splash( 654): event=activity.onCreate phase=start app=sample-terminal',
  ].join('\n'), 'com.anonymous.sampleterminal', '654');
  assert.equal(staleProcessDeathBeforeLatestLaunch.processDied, false);

  const nativeCrashForTarget = runner.summarizeAndroidLaunchDiagnostics([
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'F/DEBUG( 999): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 999): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
    'F/DEBUG( 999): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
  ].join('\n'), 'com.anonymous.sampleterminal', '321');
  assert.deepEqual(nativeCrashForTarget.nativeFatalSignals, ['SIGSEGV']);
  const nativeCrashForOtherPid = runner.summarizeAndroidLaunchDiagnostics([
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'F/DEBUG( 999): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 999): pid: 654, tid: 654, name: main >>> com.anonymous.sampleterminal <<<',
    'F/DEBUG( 999): signal 6 (SIGABRT), code -1 (SI_QUEUE)',
  ].join('\n'), 'com.anonymous.sampleterminal', '321');
  assert.deepEqual(nativeCrashForOtherPid.nativeFatalSignals, []);
  const nativeCrashForPackagePrefix = runner.summarizeAndroidLaunchDiagnostics([
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'F/DEBUG( 999): Cmdline: com.anonymous.sampleterminal.debug',
    'F/DEBUG( 999): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal.debug <<<',
    'F/DEBUG( 999): signal 6 (SIGABRT), code -1 (SI_QUEUE)',
  ].join('\n'), 'com.anonymous.sampleterminal', '321');

  const nativeCrashWithoutExactLaunchPid = runner.summarizeAndroidLaunchDiagnostics([
    'E/AndroidRuntime( 654): Process: com.anonymous.sampleterminal, PID: 654',
    'F/DEBUG( 999): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 999): pid: 654, tid: 654, name: main >>> com.anonymous.sampleterminal <<<',
    'F/DEBUG( 999): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
  ].join('\n'), 'com.anonymous.sampleterminal');
  assert.deepEqual(nativeCrashWithoutExactLaunchPid.nativeFatalSignals, []);
  const nativeCrashWithUnknownSignal = runner.summarizeAndroidLaunchDiagnostics([
    'F/DEBUG( 999): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 999): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
    'F/DEBUG( 999): signal 11 (SIGNOTREAL), code 1 (UNKNOWN)',
  ].join('\n'), 'com.anonymous.sampleterminal', '321');
  assert.deepEqual(nativeCrashWithUnknownSignal.nativeFatalSignals, []);
  assert.deepEqual(nativeCrashForPackagePrefix.nativeFatalSignals, []);
  const nativeCrashEvidenceAcrossSeparateDumps = runner.summarizeAndroidLaunchDiagnostics([
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'F/DEBUG( 999): *** *** *** *** *** *** *** *** *** *** *** *** *** *** *** ***',
    'F/DEBUG( 999): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 999): pid: 654, tid: 654, name: main >>> com.anonymous.sampleterminal <<<',
    'F/DEBUG( 998): *** *** *** *** *** *** *** *** *** *** *** *** *** *** *** ***',
    'F/DEBUG( 998): Cmdline: com.other.process',
    'F/DEBUG( 998): pid: 321, tid: 321, name: main >>> com.other.process <<<',
    'F/DEBUG( 998): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
  ].join('\n'), 'com.anonymous.sampleterminal');
  assert.deepEqual(nativeCrashEvidenceAcrossSeparateDumps.nativeFatalSignals, []);

  const intent = {
    host: 'emulator-5554', bootId: 'boot-a', packageName: 'com.anonymous.sampleterminal',
    appName: 'sample-terminal', shape: 'dual', intentId: 'dual-sample-terminal-01', startedAt: '2026-09-24T00:00:00Z',
  };
  const absent = {pendingRemoteLaunches: [{...intent}], ownedRemoteProcesses: [], resolvedRemoteLaunches: []};
  assert.equal(runner.resolvePendingRemoteLaunch(absent, intent.intentId, {host: intent.host, bootId: intent.bootId, processes: []}, '2026-09-24T00:00:01Z'), 'PROCESS_ABSENT');
  assert.equal(absent.pendingRemoteLaunches.length, 0);
  assert.equal(absent.resolvedRemoteLaunches[0].resolution, 'PROCESS_ABSENT');

  const live = {pendingRemoteLaunches: [{...intent}], ownedRemoteProcesses: [], resolvedRemoteLaunches: []};
  assert.equal(runner.resolvePendingRemoteLaunch(live, intent.intentId, {
    host: intent.host, bootId: intent.bootId, processes: [{pid: 101, startTicks: '55'}],
  }, '2026-09-24T00:00:02Z'), 'PROCESS_ADOPTED');
  assert.equal(live.pendingRemoteLaunches.length, 0);
  assert.equal(live.ownedRemoteProcesses[0].processes[0].pid, 101);

  const mismatched = {pendingRemoteLaunches: [{...intent}], ownedRemoteProcesses: [], resolvedRemoteLaunches: []};
  assert.throws(() => runner.resolvePendingRemoteLaunch(mismatched, intent.intentId, {
    host: intent.host, bootId: 'other-boot', processes: [],
  }, '2026-09-24T00:00:03Z'), /VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH/);
  assert.equal(mismatched.pendingRemoteLaunches.length, 1);

  for (const processes of [
    [null],
    [{pid: '101', startTicks: '55'}],
    [{pid: 101, startTicks: 'not-numeric'}],
    [{pid: 101, startTicks: '55'}, {pid: 101, startTicks: '56'}],
  ]) {
    const invalid = {pendingRemoteLaunches: [{...intent}], ownedRemoteProcesses: [], resolvedRemoteLaunches: []};
    assert.throws(() => runner.resolvePendingRemoteLaunch(invalid, intent.intentId, {
      host: intent.host, bootId: intent.bootId, processes,
    }, '2026-09-24T00:00:04Z'), /VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH/);
    assert.equal(invalid.pendingRemoteLaunches.length, 1);
    assert.equal(invalid.ownedRemoteProcesses.length, 0);
    assert.equal(invalid.resolvedRemoteLaunches.length, 0);
  }

  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const action = source.slice(source.indexOf('async function diagnosePendingLaunch('), source.indexOf('async function report('));
  assert.match(action, /remoteProcessIdentity\(manifest, device, intent\.packageName\)/);
  assert.match(action, /summarizeAppLaunchBreadcrumbs\(logcat, intent\.appName, intent\.intentId\)/);
  assert.match(action, /summarizeAndroidLaunchDiagnostics\(logcat, intent\.packageName, breadcrumbs\.startupPid, intent\.intentId\)/);
  assert.match(action, /'AndroidRuntime:E', 'ReactNativeJS:E'/);
  assert.match(action, /'TER-VK-LAUNCH:I', 'TER-Splash:I'/);
  assert.match(action, /'ActivityManager:I', 'ActivityTaskManager:I'/);
  assert.match(action, /diagnosticOutput: 'omit'/);
  assert.match(action, /resolvePendingRemoteLaunch\(manifest, intent\.intentId, observed\)/);
  assert.match(source, /action === 'diagnose-pending-launch'/);
});

test('launch breadcrumb diagnostics expose only whitelisted TER-Splash stages for the exact app', () => {
  assert.equal(typeof runner.summarizeAppLaunchBreadcrumbs, 'function');
  const summary = runner.summarizeAppLaunchBreadcrumbs([
    'I/TER-Splash( 100): event=activity.onCreate phase=start app=sample-terminal',
    'I/TER-VK-LAUNCH( 111): intent=dual-sample-terminal-01',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'I/TER-Splash( 321): event=expo.prevent-auto-hide-set app=sample-terminal value=true',
    'I/TER-Splash( 321): event=activity.onCreate phase=after-super app=sample-terminal',
    'I/TER-Splash( 654): event=activity.onCreate phase=start app=sample-wallpaper-terminal',
    'I/OtherTag( 321): event=activity.onCreate phase=before-super app=sample-terminal',
    'I/TER-Splash( 321): event=untrusted marker app=sample-terminal token=secret',
  ].join('\n'), 'sample-terminal', 'dual-sample-terminal-01');
  assert.deepEqual(summary, {
    observedMarkers: [
      'activity.onCreate:start',
      'expo.prevent-auto-hide-set',
      'activity.onCreate:after-super',
    ],
    markerCount: 3,
    startupPid: '321',
  });
  assert.deepEqual(runner.summarizeAppLaunchBreadcrumbs([
    'I/TER-Splash( 100): event=activity.onCreate phase=start app=sample-terminal',
  ].join('\n'), 'sample-terminal', 'dual-sample-terminal-01'), {
    observedMarkers: [], markerCount: 0, startupPid: null,
  });
  assert.throws(() => runner.summarizeAppLaunchBreadcrumbs([
    'I/TER-VK-LAUNCH( 111): intent=dual-sample-terminal-01',
    'I/TER-VK-LAUNCH( 112): intent=dual-sample-terminal-01',
  ].join('\n'), 'sample-terminal', 'dual-sample-terminal-01'), /VK_ANDROID_LAUNCH_SENTINEL_DUPLICATE/);
  const laterLaunchLog = [
    'I/TER-VK-LAUNCH( 111): intent=dual-sample-terminal-old',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'I/TER-Splash( 321): event=activity.onCreate phase=after-super app=sample-terminal',
    'I/TER-VK-LAUNCH( 112): intent=dual-sample-terminal-new',
    'I/TER-Splash( 999): event=activity.onCreate phase=start app=sample-terminal',
    'F/DEBUG( 998): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 998): pid: 999, tid: 999, name: main >>> com.anonymous.sampleterminal <<<',
    'F/DEBUG( 998): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
  ].join('\n');
  const oldLaunch = runner.summarizeAppLaunchBreadcrumbs(
    laterLaunchLog, 'sample-terminal', 'dual-sample-terminal-old',
  );
  assert.equal(oldLaunch.startupPid, '321');
  assert.deepEqual(
    runner.summarizeAndroidLaunchDiagnostics(
      laterLaunchLog, 'com.anonymous.sampleterminal', oldLaunch.startupPid,
    ).nativeFatalSignals,
    [],
  );
  const reusedPidLaunchLog = [
    'I/TER-VK-LAUNCH( 111): intent=dual-sample-terminal-old-pid-reuse',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'I/TER-Splash( 321): event=activity.onCreate phase=after-super app=sample-terminal',
    'I/TER-VK-LAUNCH( 112): intent=dual-sample-terminal-new-pid-reuse',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'F/DEBUG( 998): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 998): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
    'F/DEBUG( 998): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
  ].join('\n');
  const oldReusedPidLaunch = runner.summarizeAppLaunchBreadcrumbs(
    reusedPidLaunchLog, 'sample-terminal', 'dual-sample-terminal-old-pid-reuse',
  );
  assert.equal(oldReusedPidLaunch.startupPid, '321');
  assert.deepEqual(
    runner.summarizeAndroidLaunchDiagnostics(
      reusedPidLaunchLog, 'com.anonymous.sampleterminal', oldReusedPidLaunch.startupPid,
      'dual-sample-terminal-old-pid-reuse',
    ),
    {
      fatalException: false,
      processDied: false,
      nativeFatalSignals: [],
      exceptionTypes: [],
      appFrames: [],
      jsErrorSeen: false,
    },
  );
  const malformedNextSentinelLog = [
    'I/TER-VK-LAUNCH( 111): intent=dual-sample-terminal-old-malformed-next',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'I/TER-VK-LAUNCH( 112): malformed marker without an intent value',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'F/DEBUG( 998): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 998): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
    'F/DEBUG( 998): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
  ].join('\n');
  const oldMalformedNextLaunch = runner.summarizeAppLaunchBreadcrumbs(
    malformedNextSentinelLog, 'sample-terminal', 'dual-sample-terminal-old-malformed-next',
  );
  assert.equal(oldMalformedNextLaunch.startupPid, '321');
  assert.deepEqual(
    runner.summarizeAndroidLaunchDiagnostics(
      malformedNextSentinelLog, 'com.anonymous.sampleterminal', oldMalformedNextLaunch.startupPid,
      'dual-sample-terminal-old-malformed-next',
    ).nativeFatalSignals,
    [],
  );
  assert.throws(() => runner.summarizeAppLaunchBreadcrumbs('I/TER-Splash( 321): event=activity.onCreate phase=start app=unknown', 'unknown'), /VK_ANDROID_APP_INVALID/);
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const inspection = source.slice(source.indexOf('async function inspectResolvedLaunch('), source.indexOf('async function report('));
  const resolver = source.slice(source.indexOf('export function resolveInspectableLaunch('), source.indexOf('async function inspectResolvedLaunch('));
  assert.match(resolver, /resolvedRemoteLaunches/);
  assert.match(inspection, /resolveInspectableLaunch\(manifest\)/);
  assert.match(inspection, /summarizeAppLaunchBreadcrumbs\(logcat, intent\.appName, intent\.intentId\)/);
  assert.match(inspection, /summarizeAndroidLaunchDiagnostics\(logcat, intent\.packageName, breadcrumbs\.startupPid, intent\.intentId\)/);
  assert.match(inspection, /'TER-Splash:I'/);
  assert.match(inspection, /'TER-VK-LAUNCH:I', 'TER-Splash:I'/);
  assert.match(inspection, /diagnosticOutput: 'omit'/);
  const resolvedProcessTableRead = inspection.slice(
    inspection.indexOf('const processTableText ='), inspection.indexOf('const processTable ='),
  );
  assert.match(resolvedProcessTableRead, /'shell', 'ps', '-A', '-o', 'PID,NAME'/);
  assert.match(resolvedProcessTableRead, /diagnosticOutput: 'sanitized'/);
  assert.doesNotMatch(resolvedProcessTableRead, /diagnosticOutput: 'omit'/);
  assert.match(inspection, /'ActivityManager:I', 'ActivityTaskManager:I'/);
  assert.match(inspection, /'DEBUG:F', 'libc:F', 'crash_dump32:F', 'crash_dump64:F', 'tombstoned:F'/);
  assert.match(inspection, /'shell', 'ps', '-A', '-o', 'PID,NAME'/);
  assert.match(inspection, /parseAndroidProcessTable\(processTableText, intent\.packageName\)/);
  assert.doesNotMatch(inspection, /remoteProcessIdentity\(|am', 'start|force-stop/);
  const installer = source.slice(source.indexOf('async function installLaunch('), source.indexOf('function screenshotPath('));
  assert.match(installer, /onLaunchFailure: async \(\{intentId, stage, failureCode\}\)/);
  assert.match(installer, /launch-intent-marker/);
  assert.match(installer, /'shell', 'log', '-p', 'i', '-t', 'TER-VK-LAUNCH'/);
  assert.ok(installer.indexOf('launch-intent-marker') < installer.indexOf("'shell', 'am', 'start'"));
  assert.match(installer, /launch-failure-logcat/);
  assert.match(installer, /'TER-VK-LAUNCH:I', 'TER-Splash:I'/);
  assert.match(installer, /'ActivityManager:I', 'ActivityTaskManager:I'/);
  assert.match(installer, /'DEBUG:F', 'libc:F', 'crash_dump32:F', 'crash_dump64:F', 'tombstoned:F'/);
  assert.match(installer, /summarizeAndroidLaunchDiagnostics\(logcat, app\.packageName, breadcrumbs\.startupPid, intentId\)/);
  assert.match(installer, /summarizeAppLaunchBreadcrumbs\(logcat, appName, intentId\)/);
  assert.match(installer, /appendEvent\(manifest, 'REMOTE_LAUNCH_FAILURE_LOG_CAPTURED'/);
  assert.match(source, /action === 'inspect-resolved-launch'/);
});

test('launch epoch diagnostics bind app pid, timestamp, and actual overlay outcome to one intent', () => {
  const summary = runner.summarizeAppLaunchBreadcrumbs([
    '1790203633.300 777 777 I TER-VK-LAUNCH: intent=dual-sample-terminal-epoch-01',
    '1790203633.400 321 321 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
    '1790203633.405 321 321 I TER-Splash: event=native.loading-overlay-attached activity=ephemeral-activity-token',
    '1790203633.410 321 321 I TER-Splash: event=native.loading-overlay-attached-after-super app=sample-terminal',
    '1790203633.415 322 322 I TER-Splash: event=native.loading-overlay-skipped reason=gate-unavailable activity=other-token',
    '1790203633.500 778 778 I TER-VK-LAUNCH: intent=dual-sample-terminal-epoch-02',
    '1790203633.510 999 999 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
  ].join('\n'), 'sample-terminal', 'dual-sample-terminal-epoch-01');

  assert.equal(summary.startupPid, '321');
  assert.equal(summary.startupAtEpochMs, 1790203633400);
  assert.equal(summary.overlayOutcome, 'ATTACHED');
  assert.ok(summary.observedMarkers.includes('native.loading-overlay-attach-call-returned-after-super'));
  assert.ok(summary.observedMarkers.includes('native.loading-overlay-attached'));
  assert.ok(!summary.observedMarkers.includes('native.loading-overlay-skipped:gate-unavailable'));
});

test('launch epoch diagnostics report a same-process registry skip without exposing activity tokens', () => {
  const summary = runner.summarizeAppLaunchBreadcrumbs([
    '1790203633.300 777 777 I TER-VK-LAUNCH: intent=dual-sample-terminal-epoch-skip',
    '1790203633.400 321 321 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
    '1790203633.405 321 321 I TER-Splash: event=native.loading-overlay-skipped reason=config-unavailable activity=private-token',
  ].join('\n'), 'sample-terminal', 'dual-sample-terminal-epoch-skip');

  assert.equal(summary.overlayOutcome, 'SKIPPED_CONFIG_UNAVAILABLE');
  assert.ok(summary.observedMarkers.includes('native.loading-overlay-skipped:config-unavailable'));
  assert.ok(!JSON.stringify(summary).includes('private-token'));
});

test('launch epoch diagnostics mark repeated same-pid Activity starts ambiguous', () => {
  const summary = runner.summarizeAppLaunchBreadcrumbs([
    '1790203633.300 777 777 I TER-VK-LAUNCH: intent=dual-sample-terminal-epoch-repeat',
    '1790203633.400 321 321 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
    '1790203633.405 321 321 I TER-Splash: event=native.loading-overlay-attached activity=first-token',
    '1790203633.410 321 321 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
  ].join('\n'), 'sample-terminal', 'dual-sample-terminal-epoch-repeat');

  assert.equal(summary.startupPidStatus, 'AMBIGUOUS');
  assert.equal(summary.startupPid, null);
  assert.equal(summary.startupAtEpochMs, undefined);
  assert.deepEqual(summary.observedMarkers, []);
});

test('launch log reinspection requires an exact uninspected PROCESS_ABSENT intent', () => {
  const absent = {
    intentId: 'dual-sample-terminal-epoch-01', shape: 'dual', appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal', host: 'emulator-5554', bootId: 'boot-12345678',
    resolution: 'PROCESS_ABSENT', processCount: 0,
  };
  const secondAbsent = {...absent, intentId: 'dual-sample-wallpaper-terminal-epoch-02',
    appName: 'sample-wallpaper-terminal', packageName: 'com.catering.v2s.terminal.samplewallpaper'};
  const adopted = {...absent, intentId: 'dual-sample-wallpaper-terminal-adopted', appName: 'sample-wallpaper-terminal',
    packageName: 'com.catering.v2s.terminal.samplewallpaper', resolution: 'PROCESS_ADOPTED', processCount: 1};

  assert.deepEqual(runner.resolveLaunchLogReinspection({
    resolvedRemoteLaunches: [adopted, absent, secondAbsent], launchLogReinspections: [],
  }, absent.intentId), absent);
  assert.deepEqual(runner.resolveLaunchLogReinspection({
    resolvedRemoteLaunches: [adopted, absent, secondAbsent], launchLogReinspections: [],
  }, secondAbsent.intentId), secondAbsent);
  assert.throws(() => runner.resolveLaunchLogReinspection({
    resolvedRemoteLaunches: [absent, secondAbsent], launchLogReinspections: [],
  }), /VK_ANDROID_LAUNCH_INTENT_ID_INVALID/);
  assert.throws(() => runner.resolveLaunchLogReinspection({
    resolvedRemoteLaunches: [absent, secondAbsent], launchLogReinspections: [{intentId: absent.intentId}],
  }, absent.intentId), /VK_ANDROID_RESOLVED_LAUNCH_ALREADY_INSPECTED/);
  assert.throws(() => runner.resolveLaunchLogReinspection({
    resolvedRemoteLaunches: [adopted, absent, secondAbsent], launchLogReinspections: [],
  }, adopted.intentId), /VK_ANDROID_RESOLVED_LAUNCH_NOT_INSPECTABLE/);
  assert.throws(() => runner.resolveLaunchLogReinspection({
    resolvedRemoteLaunches: [absent, {...absent}], launchLogReinspections: [],
  }, absent.intentId), /VK_ANDROID_RESOLVED_LAUNCH_COUNT_INVALID/);
  assert.deepEqual(parseArgs(['reinspect-resolved-launch-logs', '--run-id', 'vk-run-01', '--intent-id', absent.intentId]), {
    positionals: ['reinspect-resolved-launch-logs'], 'run-id': 'vk-run-01', 'intent-id': absent.intentId,
  });
  assert.throws(() => runner.resolveLaunchLogReinspection({
    resolvedRemoteLaunches: [absent], launchLogReinspections: [{intentId: absent.intentId}],
  }, absent.intentId), /VK_ANDROID_RESOLVED_LAUNCH_ALREADY_INSPECTED/);
});

test('resolved launch evidence joins epoch and brief logs only for the same startup pid', () => {
  const intent = {
    intentId: 'dual-sample-terminal-epoch-01', shape: 'dual', appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal', host: 'emulator-5554', bootId: 'boot-12345678',
  };
  const epochLogcat = [
    '1790203633.300 777 777 I TER-VK-LAUNCH: intent=dual-sample-terminal-epoch-01',
    '1790203633.400 321 321 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
    '1790203633.405 321 321 I TER-Splash: event=native.loading-overlay-attached activity=private-activity-token',
    '1790203633.410 321 321 I TER-Splash: event=native.loading-overlay-attached-after-super app=sample-terminal',
    '1790203633.420 998 998 F DEBUG: Cmdline: com.anonymous.sampleterminal',
    '1790203633.421 998 998 F DEBUG: pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
    '1790203633.422 998 998 F DEBUG: signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
  ].join('\n');
  const briefLogcat = [
    'I/TER-VK-LAUNCH( 777): intent=dual-sample-terminal-epoch-01',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'I/TER-Splash( 321): event=native.loading-overlay-attached activity=private-activity-token',
    'I/TER-Splash( 321): event=native.loading-overlay-attached-after-super app=sample-terminal',
    'F/DEBUG( 998): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 998): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
    'F/DEBUG( 998): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
  ].join('\n');

  const summary = runner.summarizeResolvedLaunchLogEvidence(intent, epochLogcat, briefLogcat);
  assert.equal(summary.evidenceStatus, 'MATCHED');
  assert.equal(summary.startupPid, '321');
  assert.equal(summary.startupAtEpochMs, 1790203633400);
  assert.equal(summary.overlayOutcome, 'ATTACHED');
  assert.deepEqual(summary.signals.nativeFatalSignals, ['SIGSEGV']);
  assert.ok(summary.observedMarkers.includes('native.loading-overlay-attached'));
  assert.ok(!JSON.stringify(summary).includes('private-activity-token'));

  const mismatch = runner.summarizeResolvedLaunchLogEvidence(intent, epochLogcat, briefLogcat.replaceAll('( 321)', '( 999)').replaceAll('pid: 321', 'pid: 999'));
  assert.equal(mismatch.evidenceStatus, 'PID_MISMATCH');
  assert.equal(mismatch.startupPid, null);
  assert.equal(mismatch.startupAtEpochMs, null);
  assert.equal(mismatch.overlayOutcome, 'NOT_OBSERVED');
  assert.deepEqual(mismatch.observedMarkers, []);
  assert.deepEqual(mismatch.signals.nativeFatalSignals, []);
});

test('resolved native fatal signals are timestamped at or after the exact Activity start', () => {
  const intent = {
    intentId: 'dual-sample-terminal-epoch-time', shape: 'dual', appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal', host: 'emulator-5554', bootId: 'boot-12345678',
  };
  const epochLogcat = [
    '1790203633.300 777 777 I TER-VK-LAUNCH: intent=dual-sample-terminal-epoch-time',
    '1790203633.390 321 321 F DEBUG: Cmdline: com.anonymous.sampleterminal',
    '1790203633.391 321 321 F DEBUG: pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
    '1790203633.392 321 321 F DEBUG: signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
    '1790203633.400 321 321 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
  ].join('\n');
  const briefLogcat = [
    'I/TER-VK-LAUNCH( 777): intent=dual-sample-terminal-epoch-time',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'F/DEBUG( 321): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 321): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
    'F/DEBUG( 321): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
  ].join('\n');

  const stale = runner.summarizeResolvedLaunchLogEvidence(intent, epochLogcat, briefLogcat);
  assert.equal(stale.evidenceStatus, 'MATCHED');
  assert.deepEqual(stale.signals.nativeFatalSignals, []);

  const freshEpochLogcat = epochLogcat.replace(
    '1790203633.390 321 321 F DEBUG:', '1790203633.405 321 321 F DEBUG:',
  ).replace(
    '1790203633.391 321 321 F DEBUG:', '1790203633.406 321 321 F DEBUG:',
  ).replace(
    '1790203633.392 321 321 F DEBUG:', '1790203633.407 321 321 F DEBUG:',
  );
  const fresh = runner.summarizeResolvedLaunchLogEvidence(intent, freshEpochLogcat, briefLogcat);
  assert.deepEqual(fresh.signals.nativeFatalSignals, ['SIGSEGV']);
});

test('manifest binds launch log reinspection to absent intent and rejects raw output fields', () => {
  const manifest = validManifest();
  const intent = {
    intentId: 'dual-sample-terminal-epoch-01', shape: 'dual', appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal', host: 'emulator-5554', bootId: 'boot-12345678',
    resolution: 'PROCESS_ABSENT', processCount: 0,
  };
  manifest.resolvedRemoteLaunches = [intent];
  const inspection = {
    intentId: intent.intentId, shape: intent.shape, appName: intent.appName, packageName: intent.packageName,
    host: intent.host, bootId: intent.bootId, evidenceStatus: 'MATCHED', startupPid: '321',
    startupAtEpochMs: 1790203633400, overlayOutcome: 'ATTACHED',
    observedMarkers: ['activity.onCreate:start', 'native.loading-overlay-attached'], markerCount: 2,
    signals: {fatalException: false, processDied: false, nativeFatalSignals: [], exceptionTypes: [], appFrames: [], jsErrorSeen: false},
    processObservation: {
      startupPid: '321', processTableCandidateCount: 1,
      processTableCandidates: [{pid: 321, name: 'com.anonymous.sampleterminal', statStatus: 'READABLE', processState: 'S', startTicks: '9001'}],
      startupPidStatus: 'READABLE',
    },
    exitInfo: {startupPid: '321', status: 'NO_PACKAGE_RECORD', packageRecordCount: 0, targetPidRecordCount: 0, records: []},
    inspectedAt: '2026-09-24T00:00:00.000Z',
  };
  manifest.launchLogReinspections = [{...inspection}];

  assert.equal(runner.validateRunManifest(manifest), true);
  manifest.launchLogReinspections[0].rawOutput = 'unredacted process description';
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);

  const nestedManifest = validManifest();
  nestedManifest.resolvedRemoteLaunches = [intent];
  nestedManifest.launchLogReinspections = [{...inspection, signals: {...inspection.signals, rawOutput: 'unredacted nested output'}}];
  assert.throws(() => runner.validateRunManifest(nestedManifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);

  const invalidRecords = [
    {...inspection, signals: {...inspection.signals, appFrames: [{className: 'com.anonymous.sampleterminal.MainActivity', location: 'MainActivity.kt:4', rawOutput: 'secret'}]}},
    {...inspection, signals: {...inspection.signals, exceptionTypes: ['unbounded raw exception payload']}},
    {...inspection, signals: {...inspection.signals, nativeFatalSignals: ['SIGSEGV', 'SIGSEGV']}},
    {...inspection, evidenceStatus: 'INSUFFICIENT_EVIDENCE'},
    {...inspection, observedMarkers: ['activity.onCreate:start'], markerCount: 1},
  ];
  for (const invalidRecord of invalidRecords) {
    const candidate = validManifest();
    candidate.resolvedRemoteLaunches = [intent];
    candidate.launchLogReinspections = [invalidRecord];
    assert.throws(() => runner.validateRunManifest(candidate), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  }
});

test('manifest preserves bounded legacy insufficient launch reinspection records for managed cleanup', () => {
  const {manifest, inspection} = validLaunchLogReinspectionManifest();
  const legacy = {...inspection,
    evidenceStatus: 'INSUFFICIENT_EVIDENCE', startupPid: null, startupAtEpochMs: null,
    overlayOutcome: 'NOT_OBSERVED', observedMarkers: [], markerCount: 0,
    signals: {fatalException: false, processDied: false, nativeFatalSignals: [], exceptionTypes: [], appFrames: [], jsErrorSeen: false},
  };
  delete legacy.processObservation;
  delete legacy.exitInfo;
  manifest.launchLogReinspections = [legacy];

  assert.equal(runner.validateRunManifest(manifest), true);

  const unsafeLegacyVariants = [
    {...legacy, startupPid: '4500'},
    {...legacy, observedMarkers: ['activity.onCreate:start'], markerCount: 1},
    {...legacy, signals: {...legacy.signals, jsErrorSeen: true}},
    {...legacy, evidenceStatus: 'MATCHED', startupPid: '4500', startupAtEpochMs: 1790203633400},
    {...legacy, rawOutput: 'must not be preserved'},
  ];
  for (const invalid of unsafeLegacyVariants) {
    const candidate = validManifest();
    candidate.resolvedRemoteLaunches = [...manifest.resolvedRemoteLaunches];
    candidate.launchLogReinspections = [invalid];
    assert.throws(() => runner.validateRunManifest(candidate), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  }
});

test('manifest rejects overlay summaries that contradict the observed outcome markers', () => {
  const {manifest, inspection} = validLaunchLogReinspectionManifest();
  inspection.observedMarkers.push('native.loading-overlay-skipped:gate-unavailable');
  inspection.markerCount = inspection.observedMarkers.length;

  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
});

test('manifest bounds reinspection timestamps and diagnostic string fields', () => {
  const invalidCases = [
    ['non-string inspectedAt', candidate => { candidate.inspection.inspectedAt = {raw: 'timestamp'}; }],
    ['non-canonical inspectedAt', candidate => { candidate.inspection.inspectedAt = '2026-02-30T00:00:00.000Z'; }],
    ['oversized startup pid', candidate => { candidate.inspection.startupPid = '9'.repeat(1000); }],
    ['oversized exception type', candidate => { candidate.inspection.signals.exceptionTypes = [`com.example.${'A'.repeat(300)}Exception`]; }],
    ['oversized app frame class', candidate => { candidate.inspection.signals.appFrames = [{
      className: `com.anonymous.sampleterminal.${'A'.repeat(300)}`, location: 'MainActivity.kt:4',
    }]; }],
    ['oversized app frame location', candidate => { candidate.inspection.signals.appFrames = [{
      className: 'com.anonymous.sampleterminal.MainActivity', location: `MainActivity.kt:${'1'.repeat(1000)}`,
    }]; }],
    ['process candidate crosses package boundary', candidate => {
      candidate.inspection.processObservation.processTableCandidates[0].name = 'com.anonymous.sampleterminal.debug';
    }],
    ['process candidate has unreadable stat fields marked readable', candidate => {
      candidate.inspection.processObservation.processTableCandidates[0].startTicks = null;
    }],
    ['exit-info summary cannot persist raw description', candidate => {
      candidate.inspection.exitInfo = {
        startupPid: '321', status: 'MATCHED', packageRecordCount: 1, targetPidRecordCount: 1,
        records: [{pid: 321, reasonCode: 6, reasonName: 'CRASH_NATIVE', statusCode: 11, description: 'private'},],
      };
    }],
    ['exit-info record cannot claim another pid', candidate => {
      candidate.inspection.exitInfo = {
        startupPid: '321', status: 'MATCHED', packageRecordCount: 1, targetPidRecordCount: 1,
        records: [{pid: 322, reasonCode: 6, reasonName: 'CRASH_NATIVE', statusCode: 11}],
      };
    }],
  ];

  for (const [label, mutate] of invalidCases) {
    const candidate = validLaunchLogReinspectionManifest();
    mutate(candidate);
    assert.throws(() => runner.validateRunManifest(candidate.manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/, label);
  }
});

test('resolved launch log collection verifies boot before reading bounded read-only logcat', async () => {
  const intent = {
    intentId: 'dual-sample-terminal-epoch-01', shape: 'dual', appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal', host: 'emulator-5554', bootId: 'boot-12345678',
  };
  const epochLogcat = [
    '1790203633.300 777 777 I TER-VK-LAUNCH: intent=dual-sample-terminal-epoch-01',
    '1790203633.400 321 321 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
  ].join('\n');
  const briefLogcat = [
    'I/TER-VK-LAUNCH( 777): intent=dual-sample-terminal-epoch-01',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
  ].join('\n');
  const processTableText = 'PID NAME\n321 com.anonymous.sampleterminal';
  const statFields = ['S', '1', ...Array(17).fill('0'), '9001'];
  const processStat = `321 (com.anonymous.sampleterminal) ${statFields.join(' ')}`;
  const exitInfoText = 'No historical process exit information';
  const calls = [];
  const replies = [intent.bootId, epochLogcat, briefLogcat, processTableText, processStat, exitInfoText, intent.bootId];
  const evidence = await runner.collectResolvedLaunchLogEvidence(validManifest(), intent, async (manifest, device, label, args, options) => {
    calls.push({runId: manifest.runId, serial: device.serial, label, args, options});
    return replies.shift();
  });

  assert.equal(evidence.evidenceStatus, 'MATCHED');
  assert.equal(evidence.processObservation.startupPidStatus, 'READABLE');
  assert.equal(evidence.exitInfo.status, 'NO_PACKAGE_RECORD');
  assert.deepEqual(calls.map(call => call.label), [
    'dual-sample-terminal-reinspection-boot-id',
    'dual-sample-terminal-reinspection-epoch-logcat',
    'dual-sample-terminal-reinspection-brief-logcat',
    'dual-sample-terminal-reinspection-process-table',
    'dual-sample-terminal-reinspection-stat-321',
    'dual-sample-terminal-reinspection-exit-info',
    'dual-sample-terminal-reinspection-post-boot-id',
  ]);
  assert.ok(calls.every(call => call.serial === intent.host));
  assert.deepEqual(calls[1].args, [
    'shell', 'logcat', '-d', '-t', '2000', '-v', 'epoch', '-s', 'TER-VK-LAUNCH:I', 'TER-Splash:I',
    'AndroidRuntime:E', 'ReactNativeJS:E', 'ActivityManager:I', 'ActivityTaskManager:I',
    'DEBUG:F', 'libc:F', 'crash_dump32:F', 'crash_dump64:F', 'tombstoned:F',
  ]);
  assert.ok(calls.every(call => call.options?.preserveLastKnownGood === true));
  assert.equal(calls[1].options?.diagnosticOutput, 'omit');
  assert.equal(calls[2].options?.diagnosticOutput, 'omit');
  assert.equal(calls[2].args[0], 'shell');
  assert.equal(calls[2].args[1], 'logcat');
  assert.deepEqual(calls[3].args, ['shell', 'ps', '-A', '-o', 'PID,NAME']);
  assert.equal(calls[3].options?.diagnosticOutput, 'sanitized');
  assert.deepEqual(calls[4].args, ['shell', 'cat', '/proc/321/stat']);
  assert.equal(calls[4].options?.diagnosticOutput, 'sanitized');
  assert.deepEqual(calls[4].options?.acceptedExitCodes, [0, 1]);
  assert.equal(calls[4].options?.returnCommandResult, true);
  assert.deepEqual(calls[5].args, ['shell', 'dumpsys', 'activity', 'exit-info', intent.packageName]);
  assert.ok(!calls.some(call => call.args.includes('am') || call.args.includes('force-stop')));

  const mismatchCalls = [];
  await assert.rejects(() => runner.collectResolvedLaunchLogEvidence(validManifest(), intent, async (_manifest, _device, _label, args) => {
    mismatchCalls.push(args);
    return 'boot-87654321';
  }), /VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH/);
  assert.equal(mismatchCalls.length, 1);

  const postMismatchCalls = [];
  const postMismatchReplies = [intent.bootId, epochLogcat, briefLogcat, processTableText, processStat, exitInfoText, 'boot-87654321'];
  await assert.rejects(() => runner.collectResolvedLaunchLogEvidence(validManifest(), intent,
    async (_manifest, _device, label, args) => {
      postMismatchCalls.push({label, args});
      return postMismatchReplies.shift();
    }), /VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH/);
  assert.equal(postMismatchCalls.length, 7);
  assert.equal(postMismatchCalls[6].label, 'dual-sample-terminal-reinspection-post-boot-id');
});

test('remote process readback passes pidof and stat operands directly and preserves expected absence stderr', async () => {
  assert.equal(typeof runner.remoteNamedProcessIdentity, 'function');
  const calls = [];
  const identity = await runner.remoteNamedProcessIdentity(validManifest(),
    {serial: 'emulator-5554', shape: 'dual'}, 'system_server',
    async (_manifest, _device, label, args, options) => {
      calls.push({label, args, options});
      if (label.endsWith('remote-boot-id')) return 'boot-12345678';
      if (label.endsWith('remote-process')) return {stdout: '', stderr: 'pidof: no matching process', exitCode: 1};
      throw new Error('stat must not run when pidof reports absence');
    });

  assert.deepEqual(identity, {host: 'emulator-5554', bootId: 'boot-12345678', processes: []});
  assert.deepEqual(calls[1].args, ['shell', 'pidof', 'system_server']);
  assert.equal(calls[1].options?.diagnosticOutput, 'sanitized');
  assert.deepEqual(calls[1].options?.acceptedExitCodes, [0, 1]);
  assert.equal(calls[1].options?.returnCommandResult, true);

  const missingStatCalls = [];
  const missingStat = await runner.remoteNamedProcessIdentity(validManifest(),
    {serial: 'emulator-5554', shape: 'dual'}, 'system_server',
    async (_manifest, _device, label, args, options) => {
      missingStatCalls.push({label, args, options});
      if (label.endsWith('remote-boot-id')) return 'boot-12345678';
      if (label.endsWith('remote-process')) return {stdout: '321\n', stderr: '', exitCode: 0};
      if (label.endsWith('remote-stat-321')) return {stdout: '', stderr: 'cat: /proc/321/stat: No such file', exitCode: 1};
      throw new Error(`unexpected read: ${label}`);
    });
  assert.deepEqual(missingStat.processes, []);
  assert.deepEqual(missingStatCalls[1].args, ['shell', 'pidof', 'system_server']);
  assert.deepEqual(missingStatCalls[2].args, ['shell', 'cat', '/proc/321/stat']);
  assert.deepEqual(missingStatCalls[2].options?.acceptedExitCodes, [0, 1]);
});

test('process readback preflight checks known-present system_server before every target package on both devices', async () => {
  assert.equal(typeof runner.verifyRemoteProcessReadback, 'function');
  const manifest = validManifest();
  const calls = [];
  const observations = await runner.verifyRemoteProcessReadback(manifest, async (_manifest, device, processName) => {
    calls.push(`${device.shape}:${processName}`);
    return {
      host: device.serial, bootId: device.shape === 'dual' ? 'boot-12345678' : 'boot-87654321',
      processes: processName === 'system_server' ? [{pid: 1, startTicks: '10'}] : [],
    };
  }, () => {});

  assert.deepEqual(calls, [
    'dual:system_server', 'dual:com.anonymous.sampleterminal', 'dual:com.catering.v2s.terminal.samplewallpaper',
    'mobile:system_server', 'mobile:com.anonymous.sampleterminal', 'mobile:com.catering.v2s.terminal.samplewallpaper',
  ]);
  assert.equal(observations.length, 6);
  assert.equal(observations.filter(item => item.processName === 'system_server').every(item => item.status === 'PRESENT'), true);
  assert.equal(manifest.processReadbackPreflight, observations);

  const unavailable = validManifest();
  let laterReadReached = false;
  await assert.rejects(() => runner.verifyRemoteProcessReadback(unavailable, async (_manifest, _device, processName) => {
    if (processName !== 'system_server') laterReadReached = true;
    return {host: 'emulator-5554', bootId: 'boot-12345678', processes: []};
  }, () => {}), /VK_ANDROID_PROCESS_READBACK_POSITIVE_PREFLIGHT_FAILED/);
  assert.equal(laterReadReached, false);

  const bootMismatch = validManifest();
  const bootMismatchCalls = [];
  await assert.rejects(() => runner.verifyRemoteProcessReadback(bootMismatch, async (_manifest, device, processName) => {
    bootMismatchCalls.push(`${device.shape}:${processName}`);
    return {
      host: device.serial,
      bootId: device.shape === 'dual' ? 'boot-wrong-123456' : 'boot-87654321',
      processes: [{pid: 1, startTicks: '10'}],
    };
  }, () => {}), /VK_ANDROID_PROCESS_READBACK_IDENTITY_MISMATCH/);
  assert.deepEqual(bootMismatchCalls, ['dual:system_server']);

  const packageMismatch = validManifest();
  const packageMismatchCalls = [];
  await assert.rejects(() => runner.verifyRemoteProcessReadback(packageMismatch, async (_manifest, device, processName) => {
    packageMismatchCalls.push(`${device.shape}:${processName}`);
    return {
      host: device.serial,
      bootId: processName === 'system_server' ? 'boot-12345678' : 'boot-wrong-123456',
      processes: processName === 'system_server' ? [{pid: 1, startTicks: '10'}] : [],
    };
  }, () => {}), /VK_ANDROID_PROCESS_READBACK_IDENTITY_MISMATCH/);
  assert.deepEqual(packageMismatchCalls, ['dual:system_server', 'dual:com.anonymous.sampleterminal']);
});

test('remote PID identity reads stat and cmdline as direct adb shell argv', async () => {
  assert.equal(typeof runner.remotePidIdentity, 'function');
  const calls = [];
  const statFields = ['S', '1', ...Array(17).fill('0'), '9001'];
  const identity = await runner.remotePidIdentity(validManifest(),
    {serial: 'emulator-5554', shape: 'dual'}, 321, 'screenrecord', '/sdcard/run-dual-transition.mp4',
    async (_manifest, _device, label, args, options) => {
      calls.push({label, args, options});
      if (label.endsWith('boot-id')) return 'boot-12345678';
      if (label.includes('-stat-')) return {stdout: `321 (screenrecord) ${statFields.join(' ')}`, stderr: '', exitCode: 0};
      if (label.includes('-cmdline-')) return {stdout: 'screenrecord\u0000/sdcard/run-dual-transition.mp4\u0000', stderr: '', exitCode: 0};
      throw new Error(`unexpected read: ${label}`);
    });

  assert.deepEqual(identity, {host: 'emulator-5554', bootId: 'boot-12345678', process: {pid: 321, startTicks: '9001'}});
  assert.deepEqual(calls[1].args, ['shell', 'cat', '/proc/321/stat']);
  assert.deepEqual(calls[2].args, ['shell', 'cat', '/proc/321/cmdline']);
  for (const call of calls.slice(1)) {
    assert.deepEqual(call.options?.acceptedExitCodes, [0, 1]);
    assert.equal(call.options?.returnCommandResult, true);
    assert.equal(call.options?.diagnosticOutput, 'sanitized');
  }

  const missingStatCalls = [];
  const missingStat = await runner.remotePidIdentity(validManifest(),
    {serial: 'emulator-5554', shape: 'dual'}, 321, 'screenrecord', '/sdcard/run-dual-transition.mp4',
    async (_manifest, _device, label, args) => {
      missingStatCalls.push({label, args});
      if (label.endsWith('boot-id')) return 'boot-12345678';
      return {stdout: '', stderr: 'cat: /proc/321/stat: No such file', exitCode: 1};
    });
  assert.equal(missingStat.process, null);
  assert.deepEqual(missingStatCalls[1].args, ['shell', 'cat', '/proc/321/stat']);
  assert.equal(missingStatCalls.length, 2);
});

test('screenrecord startup passes one complete shell command string to adb', async () => {
  assert.equal(typeof runner.launchRemoteScreenrecord, 'function');
  const calls = [];
  const command = 'screenrecord --time-limit 2 --display-id 11 /sdcard/run-dual-transition.mp4 >/sdcard/run-dual-transition.log 2>&1 & echo $!';
  const output = await runner.launchRemoteScreenrecord(validManifest(),
    {serial: 'emulator-5554', shape: 'dual'}, 'sample-terminal', 'VK-IA-15', 11,
    '/sdcard/run-dual-transition.mp4', '/sdcard/run-dual-transition.log',
    async (_manifest, _device, _label, args) => { calls.push(args); return '321\n'; });

  assert.equal(output, '321\n');
  assert.deepEqual(calls, [['shell', command]]);
  const source = fs.readFileSync(new URL('./ter-virtual-keyboard-android.mjs', import.meta.url), 'utf8');
  assert.match(source, /launchRemoteScreenrecord\(manifest, device, appName, iaId, sf\.id, remoteVideo, remoteLog\)/);
});

test('screenrecord startup accepts a SurfaceFlinger 64-bit display id and cleanup distinguishes an active path', async () => {
  assert.equal(typeof runner.screenrecordProcessUsesPath, 'function');
  const calls = [];
  const displayId = '4619827259835644672';
  const command = `screenrecord --time-limit 2 --display-id ${displayId} /sdcard/run-dual-transition.mp4 >/sdcard/run-dual-transition.log 2>&1 & echo $!`;
  const output = await runner.launchRemoteScreenrecord(validManifest(),
    {serial: 'emulator-5554', shape: 'dual'}, 'sample-terminal', 'VK-IA-15', displayId,
    '/sdcard/run-dual-transition.mp4', '/sdcard/run-dual-transition.log',
    async (_manifest, _device, _label, args) => { calls.push(args); return '321\\n'; });
  assert.equal(output, '321\\n');
  assert.deepEqual(calls, [['shell', command]]);
  assert.equal(runner.screenrecordProcessUsesPath(`123 screenrecord ${displayId} /sdcard/run-dual-transition.mp4`, '/sdcard/run-dual-transition.mp4'), true);
  assert.equal(runner.screenrecordProcessUsesPath('123 surfaceflinger', '/sdcard/run-dual-transition.mp4'), false);
});

test('native fatal signal allowlist rejects unknown and non-fatal signal names', () => {
  const summarize = signal => runner.summarizeAndroidLaunchDiagnostics([
    'F/DEBUG( 999): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 999): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
    `F/DEBUG( 999): signal 11 (${signal}), code 1 (UNKNOWN)`,
  ].join('\n'), 'com.anonymous.sampleterminal', '321');
  assert.deepEqual(summarize('SIGSEGV').nativeFatalSignals, ['SIGSEGV']);
  assert.deepEqual(summarize('SIGNOTREAL').nativeFatalSignals, []);
  assert.deepEqual(summarize('SIGTERM').nativeFatalSignals, []);
});

test('launch breadcrumb evidence stays bound to one exact absent launch and marker vocabulary', () => {
  const manifest = validManifest();
  manifest.resolvedRemoteLaunches = [{
    intentId: 'dual-sample-terminal-01', shape: 'dual', appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal', host: 'emulator-5554', bootId: 'boot-abcdef',
    resolution: 'PROCESS_ABSENT', processCount: 0,
  }];
  manifest.launchLogInspections = [{
    intentId: 'dual-sample-terminal-01', shape: 'dual', appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal', host: 'emulator-5554', bootId: 'boot-abcdef',
    startupPid: '321', observedMarkers: ['activity.onCreate:start'], markerCount: 1,
    signals: {nativeFatalSignals: ['SIGSEGV']},
  }];
  assert.equal(runner.validateRunManifest(manifest), true);

  manifest.launchLogInspections[0].signals.nativeFatalSignals = ['SIGNOTREAL'];
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.launchLogInspections[0].signals.nativeFatalSignals = ['SIGSEGV'];
  manifest.launchLogInspections[0].startupPid = 'not-a-pid';
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.launchLogInspections[0].startupPid = '321';
  manifest.launchLogInspections[0].startupPid = null;
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.launchLogInspections[0].startupPid = '321';
  manifest.launchDiagnostics = [{startupPid: null, signals: {nativeFatalSignals: ['SIGSEGV']}}];
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.launchDiagnostics = [];

  manifest.launchLogInspections[0].host = 'emulator-5556';
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.launchLogInspections[0].host = 'emulator-5554';
  manifest.launchLogInspections[0].observedMarkers = ['raw exception message'];
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);

  manifest.launchLogInspections[0].observedMarkers = ['activity.onCreate:start'];
  manifest.resolvedRemoteLaunches[0].resolution = 'PROCESS_ADOPTED';
  manifest.resolvedRemoteLaunches[0].processCount = 1;
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.resolvedRemoteLaunches[0].resolution = 'PROCESS_ABSENT';
  manifest.resolvedRemoteLaunches[0].processCount = 0;
  manifest.launchLogInspections.push({...manifest.launchLogInspections[0]});
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);

  const historical = validManifest();
  historical.resolvedRemoteLaunches = [{
    intentId: 'dual-sample-terminal-historical-01', shape: 'dual', appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal', host: 'emulator-5554', bootId: 'boot-abcdef',
    resolution: 'PROCESS_ABSENT', processCount: 0,
  }];
  historical.launchLogInspections = [{
    intentId: 'dual-sample-terminal-historical-01', shape: 'dual', appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal', host: 'emulator-5554', bootId: 'boot-abcdef',
    observedMarkers: ['native.loading-overlay-attached-after-super'], markerCount: 1,
  }];
  assert.equal(runner.validateRunManifest(historical), true);
});

test('resolved launch process-table evidence accepts only exact package identities', () => {
  const manifest = validManifest();
  manifest.resolvedRemoteLaunches = [{
    intentId: 'dual-sample-terminal-01', shape: 'dual', appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal', host: 'emulator-5554', bootId: 'boot-abcdef',
    resolution: 'PROCESS_ABSENT', processCount: 0,
  }];
  manifest.launchLogInspections = [{
    intentId: 'dual-sample-terminal-01', shape: 'dual', appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal', host: 'emulator-5554', bootId: 'boot-abcdef',
    observedMarkers: [], markerCount: 0, processTableCandidateCount: 1,
    processTableCandidates: [{pid: 612, name: 'com.anonymous.sampleterminal:remote', startTicks: '9182'}],
  }];
  assert.equal(runner.validateRunManifest(manifest), true);

  manifest.launchLogInspections[0].processTableCandidates[0].name = 'com.anonymous.sampleterminal.debug';
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.launchLogInspections[0].processTableCandidates[0].name = 'com.anonymous.sampleterminal:';
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.launchLogInspections[0].processTableCandidates[0].name = 'com.anonymous.sampleterminal';
  manifest.launchLogInspections[0].processTableCandidates[0].startTicks = 'not-a-tick';
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
});

test('resolved launch inspection refuses repeated reads before touching logcat', () => {
  const manifest = {
    resolvedRemoteLaunches: [{
      intentId: 'dual-sample-terminal-01', shape: 'dual', appName: 'sample-terminal',
      packageName: 'com.anonymous.sampleterminal', host: 'emulator-5554', bootId: 'boot-abcdef',
      resolution: 'PROCESS_ABSENT', processCount: 0,
    }],
    launchLogInspections: [{intentId: 'dual-sample-terminal-01'}],
  };
  assert.throws(() => runner.resolveInspectableLaunch(manifest), /VK_ANDROID_RESOLVED_LAUNCH_ALREADY_INSPECTED/);
});

test('resolved launch inspector selects the only uninspected absent launch', () => {
  const terminal = {
    intentId: 'dual-sample-terminal-01', shape: 'dual', appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal', host: 'emulator-5554', bootId: 'boot-abcdef',
    resolution: 'PROCESS_ABSENT', processCount: 0,
  };
  const wallpaper = {
    intentId: 'dual-sample-wallpaper-terminal-01', shape: 'dual', appName: 'sample-wallpaper-terminal',
    packageName: 'com.catering.v2s.terminal.samplewallpaper', host: 'emulator-5554', bootId: 'boot-abcdef',
    resolution: 'PROCESS_ABSENT', processCount: 0,
  };
  const manifest = {
    resolvedRemoteLaunches: [terminal, wallpaper],
    launchLogInspections: [{intentId: terminal.intentId}],
  };
  assert.equal(runner.resolveInspectableLaunch(manifest).intentId, wallpaper.intentId);

  manifest.launchLogInspections.push({intentId: wallpaper.intentId});
  assert.throws(() => runner.resolveInspectableLaunch(manifest), /VK_ANDROID_RESOLVED_LAUNCH_ALREADY_INSPECTED/);
  manifest.launchLogInspections = [];
  assert.throws(() => runner.resolveInspectableLaunch(manifest), /VK_ANDROID_RESOLVED_LAUNCH_COUNT_INVALID/);
});

test('first failure keeps its broken boundary available at the top level', () => {
  assert.equal(typeof runner.recordFirstFailure, 'function');
  const manifest = {firstFailure: null, lastKnownGood: 'dual-app-process', brokenBoundary: null};
  runner.recordFirstFailure(manifest, 'VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED', 'INSTALL_dual_sample-terminal');
  assert.equal(manifest.firstFailure.code, 'VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED');
  assert.equal(manifest.firstFailure.brokenBoundary, 'INSTALL_dual_sample-terminal');
  assert.equal(manifest.brokenBoundary, 'INSTALL_dual_sample-terminal');

  runner.recordFirstFailure(manifest, 'VK_ANDROID_CLEANUP_FAILED', 'CLEANUP');
  assert.equal(manifest.firstFailure.code, 'VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED');
  assert.equal(manifest.brokenBoundary, 'INSTALL_dual_sample-terminal');
});

test('diagnostic command success preserves the previous last-known-good checkpoint', () => {
  const manifest = {lastKnownGood: 'dual-sample-wallpaper-terminal-startup-logcat-diagnostic'};
  assert.equal(runner.recordLastKnownGood(manifest, 'dual-reinspection-logcat', {preserveCurrent: true}),
    'dual-sample-wallpaper-terminal-startup-logcat-diagnostic');
  assert.equal(manifest.lastKnownGood, 'dual-sample-wallpaper-terminal-startup-logcat-diagnostic');
  assert.equal(runner.recordLastKnownGood(manifest, 'next-owned-runtime-step'), 'next-owned-runtime-step');
});

test('command logs mirror complete runtime history when evidence logs directory is absent', () => {
  assert.equal(typeof runner.appendCommandLogRecord, 'function');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-vk-command-log-'));
  try {
    const runtimeLogPath = path.join(tempRoot, 'runtime', 'logs', 'commands.jsonl');
    const evidenceRunDirectory = path.join(tempRoot, 'evidence', 'run-01');
    const evidenceLogPath = path.join(evidenceRunDirectory, 'logs', 'commands.jsonl');
    fs.mkdirSync(path.dirname(runtimeLogPath), {recursive: true});
    fs.mkdirSync(evidenceRunDirectory, {recursive: true});
    fs.writeFileSync(runtimeLogPath, `${JSON.stringify({label: 'earlier-command', result: 'PASS'})}\n`);

    runner.appendCommandLogRecord({runtimeLogPath, evidenceLogPath, evidenceRunDirectory, record: {label: 'diagnose', result: 'PASS'}});
    assert.equal(fs.readFileSync(evidenceLogPath, 'utf8'), fs.readFileSync(runtimeLogPath, 'utf8'));
    runner.appendCommandLogRecord({runtimeLogPath, evidenceLogPath, evidenceRunDirectory, record: {label: 'cleanup', result: 'PASS'}});
    assert.equal(fs.readFileSync(evidenceLogPath, 'utf8'), fs.readFileSync(runtimeLogPath, 'utf8'));
    assert.equal(fs.readFileSync(evidenceLogPath, 'utf8').match(/earlier-command/g)?.length, 1);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
});

test('transition evidence samples are explicitly unaligned video times and full-video review remains open', () => {
  assert.deepEqual(runner.transitionVideoSampleOffsets(2), [
    {index: 1, offsetFromVideoStartMs: 333.333}, {index: 2, offsetFromVideoStartMs: 666.667},
    {index: 3, offsetFromVideoStartMs: 1000}, {index: 4, offsetFromVideoStartMs: 1333.333},
    {index: 5, offsetFromVideoStartMs: 1666.667},
  ]);
  assert.throws(() => runner.transitionVideoSampleOffsets(0), /VK_ANDROID_TRANSITION_VIDEO_DURATION_INVALID/);
  const source = fs.readFileSync(new URL('./ter-virtual-keyboard-android.mjs', import.meta.url), 'utf8');
  assert.match(source, /screenrecord --time-limit 2 --display-id/);
  assert.match(source, /TRANSITION_VIDEO_CAPTURED/);
  assert.match(source, /UNALIGNED_TO_TAP_EVENT/);
  assert.match(source, /OPEN_REQUIRES_FULL_VIDEO_AND_PER_CONTROL_REVIEW/);
  assert.match(source, /VISUAL=OPEN/);
  assert.match(source, /remotePidIdentity\(manifest, device, recorderPid, 'screenrecord', remoteVideo\)/);
  assert.match(source, /VK_ANDROID_OWNED_SCREENRECORD_STILL_RUNNING/);
  assert.doesNotMatch(source, /progress: sample\.progress|offsetFromTapMs|tapOffsetMs \+ sample/);
  assert.doesNotMatch(source, /VK_ANDROID_SCREENRECORD_TAP_OFFSET_INVALID/);
  assert.doesNotMatch(source, /recorderReadbackToTapMs/);
});

test('transition video samples are tied only to the probed video timeline, never mislabeled as animation progress', () => {
  assert.equal(typeof runner.transitionVideoSampleOffsets, 'function');
  if (typeof runner.transitionVideoSampleOffsets !== 'function') return;
  assert.deepEqual(runner.transitionVideoSampleOffsets(2), [
    {index: 1, offsetFromVideoStartMs: 333.333},
    {index: 2, offsetFromVideoStartMs: 666.667},
    {index: 3, offsetFromVideoStartMs: 1000},
    {index: 4, offsetFromVideoStartMs: 1333.333},
    {index: 5, offsetFromVideoStartMs: 1666.667},
  ]);
  assert.throws(() => runner.transitionVideoSampleOffsets(0), /VK_ANDROID_TRANSITION_VIDEO_DURATION_INVALID/);
});

test('cleanup recovery never skips the full repository runtime resource inventory for new work', () => {
  assert.equal(typeof runner.runtimeResourceRoot, 'function');
  assert.equal(runner.runtimeResourceRoot('/workspace/repo'), path.join('/workspace/repo', '.runtime'));
});

test('ADB command validation rejects destructive argument vectors independent of source formatting', () => {
  assert.equal(typeof runner.validateAdbArgs, 'function');
  assert.throws(() => runner.validateAdbArgs(['-s', 'emulator-5554', 'shell', 'pm', 'clear', 'com.example.app']), /VK_ANDROID_FORBIDDEN_DEVICE_COMMAND/);
  assert.throws(() => runner.validateAdbArgs(['-s', 'emulator-5554', 'logcat', '-c']), /VK_ANDROID_FORBIDDEN_DEVICE_COMMAND/);
  assert.equal(runner.validateAdbArgs(['-s', 'emulator-5554', 'shell', 'input', 'tap', '10', '20']), true);
});

test('command diagnostics are readable, secret-redacted, and never persist raw UI hierarchy', () => {
  assert.equal(typeof runner.commandDiagnosticRecord, 'function');
  const ordinary = runner.commandDiagnosticRecord({
    phase: 'INSPECT', label: 'dual-adb-display', executable: 'adb', args: ['-s', 'emulator-5554', 'shell', 'dumpsys'],
    durationMs: 17, exitCode: 1, signal: null, stdout: 'token=abc123', stderr: 'failed for 192.0.2.8', outputPolicy: 'sanitized',
  });
  assert.equal(ordinary.result, 'FAIL');
  assert.match(ordinary.stdout, /token=\[REDACTED\]/);
  assert.match(ordinary.stderr, /\[IP_REDACTED\]/);
  assert.equal(ordinary.argumentCount, 4);
  assert.equal('args' in ordinary, false);

  const hierarchy = runner.commandDiagnosticRecord({
    phase: 'INSPECT', label: 'uia-read', executable: 'adb', args: ['shell', 'cat', 'temp.xml'],
    durationMs: 10, exitCode: 0, signal: null, stdout: '<node text="private-value"/>', stderr: 'private-stderr-payload', outputPolicy: 'omit',
  });
  assert.equal(hierarchy.stdout, '[RAW_OUTPUT_OMITTED]');
  assert.equal(hierarchy.stderr, '[RAW_OUTPUT_OMITTED]');
  assert.doesNotMatch(JSON.stringify(hierarchy), /private-value|private-stderr-payload/);

  const expectedAbsent = runner.commandDiagnosticRecord({
    phase: 'PREPARE', label: 'dual-sample-terminal-remote-process', executable: 'adb', args: ['shell', 'pidof', 'com.anonymous.sampleterminal'],
    durationMs: 12, exitCode: 1, signal: null, stdout: '', stderr: 'pidof: no matching process',
    acceptedExitCodes: [0, 1], outputPolicy: 'sanitized',
  });
  assert.equal(expectedAbsent.result, 'PASS');
  assert.deepEqual(expectedAbsent.acceptedExitCodes, [0, 1]);
  assert.equal(expectedAbsent.stderr, 'pidof: no matching process');
});

test('binary command output is omitted from structured diagnostic logs', () => {
  assert.equal(typeof runner.commandDiagnosticOutputPolicy, 'function');
  assert.equal(runner.commandDiagnosticOutputPolicy({binary: true}), 'omit');
  assert.equal(runner.commandDiagnosticOutputPolicy({binary: false, requestedPolicy: 'sanitized'}), 'sanitized');
  const binaryRecord = runner.commandDiagnosticRecord({
    phase: 'CAPTURE', label: 'dual-frame-capture', executable: 'adb', args: ['exec-out', 'screencap'],
    durationMs: 10, exitCode: 0, signal: null, stdout: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff]),
    stderr: Buffer.alloc(0), outputPolicy: 'omit',
  });
  assert.equal(binaryRecord.stdoutBytes, 5);
  assert.equal(binaryRecord.stdout, '[RAW_OUTPUT_OMITTED]');
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const diagnosticCall = source.match(/appendCommandLog\(manifest, commandDiagnosticRecord\(\{([\s\S]*?)\}\)\)/)?.[1] ?? '';
  assert.match(diagnosticCall, /\bstdout,\s*stderr\b/);
  assert.doesNotMatch(diagnosticCall, /\bstdout:\s*stdoutText/);
});

test('omitted command output stays omitted in runtime and evidence capture logs', () => {
  assert.equal(typeof runner.writeCommandCaptureLog, 'function');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-vk-capture-log-'));
  const runtimeLogPath = path.join(tempRoot, 'runtime', 'logs', 'capture.log');
  const evidenceRunDirectory = path.join(tempRoot, 'evidence', 'run-01');
  const evidenceLogPath = path.join(evidenceRunDirectory, 'logs', 'capture.log');
  fs.mkdirSync(path.dirname(evidenceLogPath), {recursive: true});

  try {
    runner.writeCommandCaptureLog({
      runtimeLogPath, evidenceLogPath, evidenceRunDirectory,
      stdout: 'raw stdout payload', stderr: 'raw stderr token=private-value', outputPolicy: 'omit',
    });
    const runtimeContent = fs.readFileSync(runtimeLogPath, 'utf8');
    const evidenceContent = fs.readFileSync(evidenceLogPath, 'utf8');
    assert.equal(runtimeContent, evidenceContent);
    assert.match(runtimeContent, /^\[RAW_COMMAND_OUTPUT_OMITTED\] stdoutBytes=\d+ stderrBytes=\d+\n$/);
    assert.doesNotMatch(runtimeContent, /raw stdout payload|raw stderr|private-value/);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
});

test('logical and SurfaceFlinger identities must prove both approved device shapes', () => {
  const logicalDual = parseLogicalDisplays([
    'Display id 0: DisplayInfo{"Internal", real 2560 x 1600, uniqueId "primary", flags=FLAG_DEFAULT}',
    'Display id 2: DisplayInfo{"Presentation", real 1280 x 720, uniqueId "secondary", flags=FLAG_PRESENTATION}',
  ].join('\n'));
  const surfacesDual = parseSurfaceDisplays([
    'Display local:0 (HWC display 0, primary, "Internal")',
    'activeMode={id=1, resolution=2560x1600}',
    'Virtual Display virtual:1',
    'name="Presentation"',
    'activeMode={id=2, resolution=1280x720}',
  ].join('\n'));
  assert.equal(validateDeviceShape({shape: 'dual', logical: logicalDual, surfaces: surfacesDual}).secondary.id, 2);
  assert.throws(() => validateDeviceShape({shape: 'mobile', logical: logicalDual, surfaces: surfacesDual}), /VK_ANDROID_MOBILE_SHAPE_MISMATCH/);
  const logicalMobile = [logicalDual[0]];
  const surfacesMobile = {primary: surfacesDual.primary, virtual: []};
  assert.equal(validateDeviceShape({shape: 'mobile', logical: logicalMobile, surfaces: surfacesMobile}).secondary, null);
});

test('capture display inventory is freshly resolved and corroborated by dumpsys display facts', () => {
  const logicalText = [
    'Display id 0: DisplayInfo{"Built-in Screen", displayId 0, FLAG_DEFAULT, real 1280 x 800, uniqueId "local:primary", state ON}',
    'Display id 2: DisplayInfo{"Emulator 2D Display", displayId 2, FLAG_PRESENTATION, real 1280 x 800, uniqueId "virtual:secondary", state ON}',
  ].join('\n');
  const displayDump = [
    'mBaseDisplayInfo=DisplayInfo{"Built-in Screen", displayId 0, FLAG_DEFAULT, real 1280 x 800, uniqueId "local:primary", state ON}',
    'mOverrideDisplayInfo=DisplayInfo{"Built-in Screen", displayId 0, FLAG_DEFAULT, real 1200 x 800, uniqueId "local:primary", state ON}',
    'mBaseDisplayInfo=DisplayInfo{"Emulator 2D Display", displayId 2, FLAG_PRESENTATION, real 1280 x 800, uniqueId "virtual:secondary", state ON}',
  ].join('\n');
  const latestSurfaceDump = [
    'Display local:latest-primary (HWC display 0, primary, "Built-in Screen")',
    'activeMode={id=1, resolution=1280x800}',
    'Virtual Display virtual:latest-secondary',
    'name="Emulator 2D Display"',
    'activeMode={id=2, resolution=1280x800}',
  ].join('\n');

  assert.deepEqual(parseDumpsysDisplayFacts(displayDump), [
    {id: 0, name: 'Built-in Screen', width: 1280, height: 800, uniqueId: 'local:primary', flags: ['FLAG_DEFAULT']},
    {id: 2, name: 'Emulator 2D Display', width: 1280, height: 800, uniqueId: 'virtual:secondary', flags: ['FLAG_PRESENTATION']},
  ]);
  const resolved = resolveCaptureDisplayInventory('dual', logicalText, displayDump, latestSurfaceDump);
  assert.equal(resolved.pairing.primarySurface.id, 'local:latest-primary');
  assert.equal(resolved.pairing.secondarySurface.id, 'virtual:latest-secondary');
  assert.throws(() => resolveCaptureDisplayInventory('dual', logicalText, displayDump.replace('uniqueId "virtual:secondary"', 'uniqueId "virtual:stale"'), latestSurfaceDump), /VK_ANDROID_CAPTURE_DISPLAY_FACTS_MISMATCH/);
});

test('testID taps are scoped to the requested Android logical display', () => {
  const xml = '<hierarchy><display id="0"><node resource-id="shared:key" bounds="[1,2][9,10]" enabled="true"/></display><display id="2"><node resource-id="shared:key" bounds="[11,12][29,30]" enabled="true"/></display></hierarchy>';
  assert.deepEqual(parseResourceNode(xml, 'shared:key', 0), {left: 1, top: 2, right: 9, bottom: 10, enabled: true, selected: false});
  assert.deepEqual(parseResourceNode(xml, 'shared:key', 2), {left: 11, top: 12, right: 29, bottom: 30, enabled: true, selected: false});
  assert.equal(parseResourceNode(xml, 'shared:key', 3), null);
  assert.throws(() => parseResourceNode(
    '<hierarchy><display id="2"><node resource-id="shared:key" bounds="[11,12][29,30]" enabled="true"/><node resource-id="shared:key" bounds="[31,32][49,50]" enabled="true"/></display></hierarchy>',
    'shared:key', 2,
  ), /VK_ANDROID_RESOURCE_NODE_AMBIGUOUS/);
});

test('URL symbol taps use the shifted-state nodes only after confirming unchanged key geometry', () => {
  assert.equal(sameResourceNodeBounds(
    {left: 1, top: 2, right: 10, bottom: 11},
    {left: 1, top: 2, right: 10, bottom: 11},
  ), true);
  assert.equal(sameResourceNodeBounds(
    {left: 1, top: 2, right: 10, bottom: 11},
    {left: 1, top: 3, right: 10, bottom: 11},
  ), false);
  assert.equal(sameResourceNodeBounds(null, {left: 1, top: 2, right: 10, bottom: 11}), false);

  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const action = source.slice(source.indexOf('async function insertUrlSymbolSequence('), source.indexOf('async function doCleanup('));
  assert.match(action, /shiftedShift\.selected/);
  assert.match(action, /sameResourceNodeBounds\(item\.node, keys\[index\]\.node\)/);
  assert.match(action, /tapNodeCenter\(manifest, device, display\.id, shiftedKeys\[index\]\.node/);
  assert.match(action, /tapNodeCenter\(manifest, device, display\.id, shiftedShift/);
});

test('screenshot proof requires an app window identity scoped to its logical display and file dimensions', () => {
  const xml = '<hierarchy><display id="0"><window id="w-primary"><node class="android.widget.FrameLayout" package="com.anonymous.sampleterminal" resource-id="sample.auth.login" bounds="[0,0][1280,800]"/></window></display><display id="2"><window id="w-secondary"><node class="android.widget.FrameLayout" package="com.other.app" resource-id="other:root" bounds="[0,0][1280,800]"/></window></display></hierarchy>';
  assert.deepEqual(parseDisplayWindowIdentity(xml, 0, 'com.anonymous.sampleterminal'), {
    logicalDisplayId: 0, packageName: 'com.anonymous.sampleterminal', rootClass: 'android.widget.FrameLayout', rootResourceId: 'sample.auth.login',
  });
  assert.throws(() => parseDisplayWindowIdentity(xml, 2, 'com.anonymous.sampleterminal'), /VK_ANDROID_CAPTURE_WINDOW_IDENTITY_UNPROVEN/);
  assert.deepEqual(parsePngFileDescription('/tmp/cap.png: PNG image data, 1280 x 800, 8-bit/color RGBA, non-interlaced'), {
    description: 'PNG image data, 1280 x 800, 8-bit/color RGBA, non-interlaced', width: 1280, height: 800,
  });
  assert.throws(() => parsePngFileDescription('/tmp/cap.png: ASCII text'), /VK_ANDROID_CAPTURE_FILE_TYPE_INVALID/);
  const inventory = parseVisibleControlInventory(
    '<hierarchy><display id="0"><node resource-id="keyboard:key" class="android.widget.Button" bounds="[1,2][9,10]" enabled="true" selected="false" clickable="true" text=":/.?&amp;=-_%+" content-desc="符号键"/><node class="android.widget.TextView" text="敏感输入"/></display><display id="2"><node resource-id="other:key"/></display></hierarchy>',
    0,
  );
  assert.equal(inventory.length, 2);
  assert.equal(inventory[0].resourceId, 'keyboard:key');
  assert.deepEqual(inventory[0].bounds, {left: 1, top: 2, right: 9, bottom: 10});
  assert.equal(inventory[0].textSha256, createHash('sha256').update(':/ .?&=-_%+'.replace(' ', '')).digest('hex'));
  assert.equal(inventory[0].contentDescriptionSha256, createHash('sha256').update('符号键').digest('hex'));
  assert.equal(inventory[1].textSha256, createHash('sha256').update('敏感输入').digest('hex'));
  assert.equal(JSON.stringify(inventory).includes('敏感输入'), false);
  assert.throws(() => parseVisibleControlInventory('<hierarchy/>', 0), /VK_ANDROID_CONTROL_INVENTORY_DISPLAY_MISSING/);
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const captureSource = source.slice(source.indexOf('async function capture('), source.indexOf('async function tapResource('));
  assert.match(captureSource, /parseDisplayWindowIdentity\(/);
  assert.match(captureSource, /cmd', 'display', 'get-displays/);
  assert.match(captureSource, /dumpsys', 'display/);
  assert.match(captureSource, /dumpsys', 'SurfaceFlinger', '--displays/);
  assert.match(captureSource, /resolveCaptureDisplayInventory\(/);
  assert.match(captureSource, /'file', \[file\]/);
  assert.match(captureSource, /dumpsys-display\.txt/);
  assert.match(captureSource, /surfaceflinger-displays\.txt/);
  assert.match(captureSource, /parseVisibleControlInventory\(/);
  assert.match(captureSource, /\.controls\.json/);
  assert.match(captureSource, /controlsInventory:/);
  assert.match(source, /perControlVisualAuditRows\(manifest\.frameMatrix\)/);
});

test('URL symbol business oracle hashes only the exact ten synthetic inserted characters', () => {
  assert.deepEqual(URL_SYMBOL_KEYS, [
    {keyId: 'text-1', value: ':'}, {keyId: 'text-2', value: '/'}, {keyId: 'text-3', value: '.'},
    {keyId: 'text-4', value: '?'}, {keyId: 'text-5', value: '&'}, {keyId: 'text-6', value: '='},
    {keyId: 'text-7', value: '-'}, {keyId: 'text-8', value: '_'}, {keyId: 'text-9', value: '%'}, {keyId: 'text-0', value: '+'},
  ]);
  assert.equal(URL_SYMBOL_SEQUENCE, ':/ .?&=-_%+'.replace(' ', ''));
  assert.equal(typeof runner.resolveUrlSymbolHarnessField, 'function');
  if (typeof runner.resolveUrlSymbolHarnessField !== 'function') return;
  const loginOnlyXml = '<hierarchy><display id="0"><node resource-id="sample.auth.login:operator-name" text="" enabled="true" bounds="[1,2][9,10]"/></display></hierarchy>';
  assert.equal(runner.resolveUrlSymbolHarnessField(loginOnlyXml, 0), null);
  const harnessXml = '<hierarchy><display id="0"><node resource-id="harness:full-field" text=":/.?&amp;=-_%+" enabled="true" bounds="[1,2][9,10]"/><node resource-id="sample.auth.login:operator-name" text="must-not-read" enabled="true" bounds="[11,12][19,20]"/></display></hierarchy>';
  assert.deepEqual(runner.resolveUrlSymbolHarnessField(harnessXml, 0), {
    fieldId: 'harness:full-field',
    node: {left: 1, top: 2, right: 9, bottom: 10, enabled: true, selected: false},
    textSha256: createHash('sha256').update(URL_SYMBOL_SEQUENCE).digest('hex'),
  });
  const digest = parseResourceTextHash(harnessXml, 'harness:full-field', 0);
  assert.equal(digest, createHash('sha256').update(URL_SYMBOL_SEQUENCE).digest('hex'));
  assert.doesNotMatch(digest, /[:/?&=_%+]/);
  assert.throws(() => parseResourceTextHash('<hierarchy><display id="0"><node resource-id="field"/></display></hierarchy>', 'field', 0), /VK_ANDROID_RESOURCE_TEXT_MISSING/);
  const keyboardLabelXml = '<hierarchy><display id="0"><node resource-id="ui.base.input:virtual-keyboard:text-1" text="" content-desc="1" enabled="true" bounds="[1,2][9,10]"/></display></hierarchy>';
  assert.equal(parseResourceContentDescriptionHash(keyboardLabelXml, 'ui.base.input:virtual-keyboard:text-1', 0), createHash('sha256').update('1').digest('hex'));
  assert.throws(() => parseResourceContentDescriptionHash('<hierarchy><display id="0"><node resource-id="ui.base.input:virtual-keyboard:text-1" text="" /></display></hierarchy>', 'ui.base.input:virtual-keyboard:text-1', 0), /VK_ANDROID_RESOURCE_CONTENT_DESCRIPTION_MISSING/);

  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const action = source.slice(source.indexOf('async function insertUrlSymbolSequence('), source.indexOf('async function doCleanup('));
  assert.match(action, /URL_SYMBOL_KEYS/);
  assert.match(action, /parseResourceContentDescriptionHash\(xml, item\.id, display\.id\)/);
  assert.match(action, /observedSha256 === expectedSha256/);
  assert.match(action, /submitted: false/);
  assert.doesNotMatch(action, /URL_SYMBOL_FIELD_ID/);
  assert.match(action, /controlledKeyboardHarnessIntentArgs\(APPS\[appName\]\.activity\)/);
  assert.match(action, /remoteProcessIdentityMatches\(ownedApp, beforeRoute, device\.serial\)/);
  assert.match(action, /remoteProcessIdentityMatches\(ownedApp, afterRoute, device\.serial\)/);
  assert.match(action, /VK_ANDROID_CONTROLLED_HARNESS_FIELD_NOT_OBSERVED/);
  assert.doesNotMatch(action, /sample\.auth\.login:operator-name|sample\.auth\.login:submit|login\.submit/);
  assert.match(source, /insert-url-symbol-sequence.*insertUrlSymbolSequence/s);
});

test('managed device runner cannot clear app data or global device logs', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  assert.match(source, /check-runtime-resource-budget/);
  assert.match(source, /canonicalStartToken/);
  assert.match(source, /bootId/);
  assert.match(source, /startTicks/);
  assert.doesNotMatch(source, /pm\s+clear/);
  assert.doesNotMatch(source, /logcat['",\s]+['"]?-c/);
  assert.match(source, /args\['dual-serial'\]/);
  assert.match(source, /args\['mobile-serial'\]/);
  assert.doesNotMatch(source, /emulator-555[0-9]/);
});

test('controlled keyboard harness accepts only its exact explicit route', () => {
  assert.equal(typeof runner.isControlledKeyboardHarnessUrl, 'function');
  assert.equal(typeof runner.CONTROLLED_KEYBOARD_HARNESS_URL, 'string');
  if (typeof runner.isControlledKeyboardHarnessUrl !== 'function') return;
  const route = runner.CONTROLLED_KEYBOARD_HARNESS_URL;
  assert.equal(route, 'ter-vk://controlled/full');
  assert.equal(runner.isControlledKeyboardHarnessUrl(route), true);
  assert.equal(runner.isControlledKeyboardHarnessUrl(`${route}/unexpected`), false);
  assert.equal(runner.isControlledKeyboardHarnessUrl(`${route}?field=sample.auth.login`), false);
  assert.equal(runner.isControlledKeyboardHarnessUrl(null), false);
});

test('both Android apps mount the harness only from the exact primary-surface route and declare its UI dependencies', () => {
  const appDirectories = [
    'apps/terminal/assembly/android/sample-terminal',
    'apps/terminal/assembly/android/sample-wallpaper-terminal',
  ];
  for (const directory of appDirectories) {
    const appSource = fs.readFileSync(path.join(root, directory, 'App.tsx'), 'utf8');
    const harnessSource = fs.readFileSync(path.join(root, directory, 'src/controlledKeyboardHarness.tsx'), 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, directory, 'package.json'), 'utf8'));
    const dependenciesSource = fs.readFileSync(path.join(root, directory, 'src/dependencies.ts'), 'utf8');

    assert.match(appSource, /useControlledKeyboardHarness\(displayIndex !== 1\)/);
    assert.match(appSource, /if \(controlledKeyboardHarness\) return <ControlledKeyboardHarness \/>/);
    assert.match(harnessSource, /ter-vk:\/\/controlled\/full/);
    assert.match(harnessSource, /value === CONTROLLED_KEYBOARD_HARNESS_URL/);
    assert.match(harnessSource, /Linking\.addEventListener\('url'/);
    assert.match(harnessSource, /<InputSurfaceFrame>/);
    assert.match(harnessSource, /useInputField\(/);
    assert.match(harnessSource, /<PrimitiveInput \{\.\.\.field\.inputProps\}/);
    assert.match(harnessSource, /fieldId: 'harness:full-field'/);
    assert.match(harnessSource, /testID: 'harness:full-field'/);
    assert.match(harnessSource, /layout: 'full'/);
    assert.doesNotMatch(harnessSource, /sample\.auth\.login|sample\.desk\.|dispatchAction|onSubmit|payload/i);
    assert.equal(packageJson.dependencies['@catering-v2s/ui-base-input'], 'workspace:*');
    assert.equal(packageJson.dependencies['@catering-v2s/ui-base-primitives'], 'workspace:*');
    assert.match(dependenciesSource, /@catering-v2s\/ui-base-input/);
    assert.match(dependenciesSource, /@catering-v2s\/ui-base-primitives/);
  }
});

test('controlled harness is entered by an explicit VIEW intent without stopping the owned app', () => {
  assert.equal(typeof runner.controlledKeyboardHarnessIntentArgs, 'function');
  if (typeof runner.controlledKeyboardHarnessIntentArgs !== 'function') return;
  assert.deepEqual(runner.controlledKeyboardHarnessIntentArgs('com.example/.MainActivity'), [
    'shell', 'am', 'start', '-W', '-n', 'com.example/.MainActivity',
    '-a', 'android.intent.action.VIEW', '-d', runner.CONTROLLED_KEYBOARD_HARNESS_URL,
  ]);
  assert.throws(() => runner.controlledKeyboardHarnessIntentArgs('com.example;pm clear'), /VK_ANDROID_HARNESS_ACTIVITY_INVALID/);
  assert.throws(() => runner.controlledKeyboardHarnessIntentArgs('com.example/.Main$Activity'), /VK_ANDROID_HARNESS_ACTIVITY_INVALID/);
});

test('controlled-harness screenshots remain separate from the 19 product IA-frame denominator', () => {
  assert.equal(typeof runner.recordCapture, 'function');
  if (typeof runner.recordCapture !== 'function') return;
  const manifest = {frameMatrix: emptyFrameMatrix()};
  const record = {
    shape: 'dual', app: 'sample-terminal', iaId: 'VK-IA-09', surface: 'primary',
    screenshot: 'evidence/harness-shift.png', captureEvidence: 'evidence/harness-shift.capture-evidence.json',
    state: 'controlled-harness-url-symbol-shift', transitionIndex: null,
  };
  runner.recordCapture(manifest, 'VK-IA-09', record, 'CONTROLLED_HARNESS');
  assert.equal(manifest.frameMatrix['VK-IA-09'].captures.length, 0);
  assert.equal(manifest.controlledHarnessCaptures.length, 1);
  assert.equal(manifest.controlledHarnessCaptures[0].evidenceKind, 'CONTROLLED_HARNESS');
  assert.equal(manifest.controlledHarnessCaptures[0].coveredIaId, 'VK-IA-09');
  assert.equal(captureObservationMatrix(manifest.frameMatrix)['VK-IA-09'].routes['dual/sample-terminal/primary'].status, 'OPEN_NOT_OBSERVED');
  assert.throws(() => runner.recordCapture(manifest, 'VK-IA-09', {...record, iaId: 'VK-IA-08'}, 'CONTROLLED_HARNESS'), /VK_ANDROID_IA_ID_OUT_OF_RANGE/);
});
