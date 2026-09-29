import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {PassThrough, Writable} from 'node:stream';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {
  classifyObservedDeviceForTest,
  finishBuildLogStreams,
  parseRemotePackagePidof,
  parseRemoteProcStatStartTicks,
  remotePackageCmdlineMatches,
  protectedMarkerOperation,
  protectedMarkerResult,
  protectedNamespaceObservation,
  protectedNamespaceReadbackFromLines,
  resolveTargetRolesForTest,
} from './ter-persist-kv-prechange-android.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(new URL('./ter-persist-kv-prechange-android.mjs', import.meta.url), 'utf8');

const dualFacts = {
  serial: 'fresh-device-physical',
  model: 'physical-device',
  qemu: false,
  logicalText: [
    'Display id 0: DisplayInfo{"Built-in", real 1920 x 1080, uniqueId "local:0", flags=FLAG_DEFAULT}',
    'Display id 2: DisplayInfo{"Presentation", real 1920 x 1080, uniqueId "local:1", flags=FLAG_PRESENTATION}',
  ].join('\n'),
  surfaceText: [
    'Display 0',
    '    connectionType=Internal',
    '    name="Built-in"',
    '    displayModes={id=0, resolution=1920x1080}',
    'Display 1',
    '    connectionType=External',
    '    name="Presentation"',
    '    displayModes={id=0, resolution=1920x1080}',
  ].join('\n'),
};

const mobileFacts = {
  serial: 'fresh-mobile-vm',
  model: 'Pixel-Mobile',
  qemu: true,
  logicalText: 'Display id 0: DisplayInfo{"Mobile", real 800 x 1280, uniqueId "local:0", flags=FLAG_DEFAULT}',
  surfaceText:
    'Display 0\n    connectionType=Internal\n    name="Mobile"\n    displayModes={id=0, resolution=800x1280}',
};

test('A11 target roles are identified from observed physical/logical facts and must be unique', () => {
  const dual = classifyObservedDeviceForTest(dualFacts);
  const mobile = classifyObservedDeviceForTest(mobileFacts);
  assert.equal(dual.role, 'physical-dual');
  assert.equal(dual.pairing.secondarySurfaceKind, 'physical');
  assert.equal(mobile.role, 'mobile-vm');
  assert.deepEqual(resolveTargetRolesForTest([dual, mobile]), {dual, mobile});
  assert.throws(
    () => resolveTargetRolesForTest([dual, mobile, {...mobile, serial: 'another-mobile'}]),
    /TER_A11_TARGET_ROLE_NOT_UNIQUE/,
  );
  assert.equal(classifyObservedDeviceForTest({...dualFacts, qemu: true}), null);
  assert.equal(classifyObservedDeviceForTest({...mobileFacts, qemu: false}), null);
});

test('A11 accepts only an App-owned protected persist-kv success marker', () => {
  assert.equal(
    protectedMarkerOperation(
      'I/TerminalPersistKv( 321): event=persist-kv operation=read mode=protected status=succeeded',
      ['321'],
    ),
    'read',
  );
  assert.equal(
    protectedMarkerOperation(
      'I/TerminalPersistKv( 321): event=persist-kv operation=writeMany mode=protected status=succeeded',
      ['321'],
    ),
    'writeMany',
  );
  assert.equal(
    protectedMarkerOperation('I/TerminalPersistKv( 321): event=persist-kv operation=read mode=plain status=succeeded', [
      '321',
    ]),
    null,
  );
  assert.equal(
    protectedMarkerOperation(
      'I/TerminalPersistKv( 321): event=persist-kv operation=read mode=protected status=failed',
      ['321'],
    ),
    null,
  );
  assert.equal(
    protectedMarkerOperation('I/TerminalPersistKv( 321): event=other operation=read mode=protected status=succeeded', [
      '321',
    ]),
    null,
  );
  assert.equal(
    protectedMarkerOperation(
      'I/TerminalPersistKv( 999): event=persist-kv operation=read mode=protected status=succeeded',
      ['321'],
    ),
    null,
    'a successful log from a PID not adopted for the app must not count',
  );
  assert.equal(
    protectedMarkerOperation(
      'I/TerminalPersistKv( 321): event=persist-kv operation=read mode=protected status=succeeded',
      [],
    ),
    null,
  );
});

test('A11 parses namespace pre-open state without accepting incomplete or unrelated fields', () => {
  assert.deepEqual(
    protectedNamespaceObservation(
      'I TerminalPersistKv: event=persist-kv operation=readMany mode=protected namespaceVersion=2 existedBeforeOpen=false legacyNamespacePresent=true',
    ),
    {operation: 'readMany', namespaceVersion: 2, existedBeforeOpen: false, legacyNamespacePresent: true},
  );
  assert.deepEqual(
    protectedNamespaceObservation(
      'I TerminalPersistKv: event=persist-kv operation=read mode=protected namespaceVersion=2 existedBeforeOpen=true',
    ),
    {operation: 'read', namespaceVersion: 2, existedBeforeOpen: true, legacyNamespacePresent: null},
  );
  assert.equal(
    protectedNamespaceObservation(
      'I TerminalPersistKv: event=persist-kv operation=read mode=plain namespaceVersion=2 existedBeforeOpen=false',
    ),
    null,
  );
  assert.equal(
    protectedNamespaceObservation(
      'I TerminalPersistKv: event=persist-kv operation=read mode=protected namespaceVersion=2',
    ),
    null,
  );
});

test('A11 requires the first app-owned protected namespace open and its matching operation to prove the old namespace', () => {
  const lines = [
    'I/TerminalPersistKv( 321): event=persist-kv operation=read mode=protected status=succeeded',
    'I/TerminalPersistKv( 321): event=persist-kv operation=read mode=protected namespaceVersion=2 existedBeforeOpen=true legacyNamespacePresent=false',
    'I/TerminalPersistKv( 321): event=persist-kv operation=read mode=protected status=succeeded',
  ];
  assert.deepEqual(protectedNamespaceReadbackFromLines(lines.slice(0, 1), ['321']), {status: 'pending'});
  assert.deepEqual(protectedNamespaceReadbackFromLines(lines, ['321']), {
    pid: '321',
    operation: 'read',
    namespaceVersion: 2,
    existedBeforeOpen: true,
    legacyNamespacePresent: false,
    preOpenLine: lines[1],
    status: 'confirmed',
    resultLine: lines[2],
  });
  assert.deepEqual(
    protectedMarkerResult('I/TerminalPersistKv( 321): event=persist-kv operation=read mode=protected status=failed code=PERSIST_KV_OPERATION_FAILED', ['321']),
    {
      pid: '321',
      operation: 'read',
      status: 'failed',
      line: 'I/TerminalPersistKv( 321): event=persist-kv operation=read mode=protected status=failed code=PERSIST_KV_OPERATION_FAILED',
    },
  );
});

test('A11 never lets a later successful open rescue a first fresh namespace', () => {
  const lines = [
    'I/TerminalPersistKv( 321): event=persist-kv operation=listKeys mode=protected namespaceVersion=2 existedBeforeOpen=false legacyNamespacePresent=false',
    'I/TerminalPersistKv( 321): event=persist-kv operation=listKeys mode=protected status=succeeded',
    'I/TerminalPersistKv( 321): event=persist-kv operation=read mode=protected namespaceVersion=2 existedBeforeOpen=true legacyNamespacePresent=false',
    'I/TerminalPersistKv( 321): event=persist-kv operation=read mode=protected status=succeeded',
  ];
  assert.equal(protectedNamespaceReadbackFromLines(lines, ['321']).status, 'missing');
});

test('A11 does not pair another process, another operation, or a failed call with the first namespace open', () => {
  const firstOpen = 'I/TerminalPersistKv( 321): event=persist-kv operation=read mode=protected namespaceVersion=2 existedBeforeOpen=true';
  assert.equal(
    protectedNamespaceReadbackFromLines(
      [firstOpen, 'I/TerminalPersistKv( 999): event=persist-kv operation=read mode=protected status=succeeded'],
      ['321'],
    ).status,
    'pending',
  );
  assert.equal(
    protectedNamespaceReadbackFromLines(
      [firstOpen, 'I/TerminalPersistKv( 321): event=persist-kv operation=listKeys mode=protected status=succeeded'],
      ['321'],
    ).status,
    'pending',
  );
  assert.equal(
    protectedNamespaceReadbackFromLines(
      [firstOpen, 'I/TerminalPersistKv( 321): event=persist-kv operation=read mode=protected status=failed code=PERSIST_KV_OPERATION_FAILED'],
      ['321'],
    ).status,
    'failed',
  );
});

test('A11 runner requires the first app-owned protected open to predate this launch', () => {
  const observeBody = source.slice(
    source.indexOf('async function observeProtectedMarker'),
    source.indexOf('\nasync function installObserveAndStop'),
  );
  const installBody = source.slice(
    source.indexOf('async function installObserveAndStop'),
    source.indexOf('\nasync function run('),
  );
  assert.match(observeBody, /protectedNamespaceReadbackFromLines\(/);
  assert.match(installBody, /oldNamespaceExistedBeforeOpen:\s*marker\.existedBeforeOpen/);
});

test('A11 installs the old APK without clearing data and records run ownership before launch observation', () => {
  const installBody = source.slice(
    source.indexOf('async function installObserveAndStop'),
    source.indexOf('\nasync function run('),
  );
  assert.match(installBody, /readRemotePackageProcesses\(manifest, device, app\.packageName, `preinstall-/);
  assert.match(installBody, /\['install', '-r', apk\]/);
  assert.doesNotMatch(installBody, /\['shell', 'pm', 'clear'/);
  const ownershipWrite = installBody.indexOf('manifest.ownedApps.push(owned)');
  const observation = installBody.indexOf('await observeProtectedMarker');
  assert.ok(
    ownershipWrite >= 0 && ownershipWrite < observation,
    'run ownership must be persisted before launch/marker observation',
  );
  assert.match(installBody, /processOwnership: 'PACKAGE_ABSENT_BEFORE_INSTALL_RUN_OWNED_LAUNCH'/);
  const finalizer = source.slice(
    source.indexOf('} finally {', source.indexOf('async function run(')),
    source.indexOf('\n  process.stdout.write', source.indexOf('async function run(')),
  );
  assert.match(finalizer, /\['shell', 'am', 'force-stop', owned\.packageName\]/);
  assert.match(
    finalizer,
    /readRemotePackageProcesses\(\s*manifest,\s*\{serial: owned\.serial\},\s*owned\.packageName,\s*`cleanup-\$\{owned\.deviceRole\}-\$\{owned\.appName\}`/,
  );
  assert.match(finalizer, /TER_A11_APP_PROCESS_REMAINS_AFTER_FORCE_STOP/);
  assert.match(finalizer, /TER_A11_APP_CLEANUP_READBACK_FAILED/);
  assert.doesNotMatch(finalizer, /\.filter\(value => \/\^\\d\+\$\/\.test\(value\)\)/);
});

test('A11 builds both old APKs before the first device installation', () => {
  const runBody = source.slice(
    source.indexOf('async function run('),
    source.indexOf('\nexport function protectedMarkerOperation'),
  );
  assert.match(
    runBody,
    /for \(const appName of Object\.keys\(APPS\)\) \{\s*manifest\.phase = `BUILD_\$\{appName\}`;\s*save\(manifest\);\s*await runManagedBuild\(manifest, appName\);\s*\}\s*for \(const appName of Object\.keys\(APPS\)\) \{\s*for \(const role of \['dual', 'mobile'\]\)/,
  );
  assert.ok(
    runBody.indexOf('await runManagedBuild(manifest, appName)') <
      runBody.indexOf('await installObserveAndStop(manifest, roles[role], appName)'),
  );
});

test('A11 Gradle stdout and stderr share a non-owning pipe and the runner ends the log once', () => {
  const drainBody = source.slice(
    source.indexOf('export async function finishBuildLogStreams'),
    source.indexOf('\nconst recordFailure'),
  );
  assert.match(drainBody, /stdout\.pipe\(log, \{end: false\}\)/);
  assert.match(drainBody, /stderr\.pipe\(log, \{end: false\}\)/);
  assert.match(drainBody, /log\.end\(\)/);
  assert.equal((drainBody.match(/log\.end\(/g) ?? []).length, 1);
  assert.match(source, /const logDrain = finishBuildLogStreams\(child\.stdout, child\.stderr, log\)/);
  assert.match(source, /await logDrain/);
});

test('A11 build log drain collects both child streams and finishes exactly once', async () => {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let captured = '';
  let finishCount = 0;
  const log = new Writable({
    write(chunk, _encoding, callback) {
      captured += chunk.toString();
      callback();
    },
    final(callback) {
      finishCount += 1;
      callback();
    },
  });
  const drained = finishBuildLogStreams(stdout, stderr, log);
  stdout.end('gradle stdout');
  stderr.end('gradle stderr');
  await drained;
  assert.match(captured, /gradle stdout/);
  assert.match(captured, /gradle stderr/);
  assert.equal(finishCount, 1);
});

test('A11 final cleanup reconciles every recorded Gradle process tree by its stored identity', () => {
  const runBody = source.slice(
    source.indexOf('async function run('),
    source.indexOf('\nexport function protectedMarkerOperation'),
  );
  assert.match(runBody, /const buildIdentity = \{pid: build\.pid, pgid: build\.pgid, startToken: build\.startToken\}/);
  assert.match(runBody, /const before = processRows\(buildIdentity\)[\s\S]*const after = processRows\(buildIdentity\)/);
  assert.match(
    runBody,
    /failedBuildCleanup = Object\.values\(manifest\.builds\)\.some\(build => build\.processTreeCleanup !== 'PASS'\)/,
  );
});

test('A11 requires positive process readback before any app run and preserves process command stderr metadata', () => {
  const runBody = source.slice(
    source.indexOf('async function run('),
    source.indexOf('\nexport function protectedMarkerOperation'),
  );
  const positiveReadback = runBody.search(/readRemoteProcessIds\(\s*manifest,\s*device,\s*'system_server'/);
  const appRun = runBody.indexOf('await installObserveAndStop');
  assert.ok(positiveReadback >= 0 && appRun > positiveReadback);
  assert.match(source, /function readRemoteProcessIds\([\s\S]*?return parseRemotePackagePidof\(lookup, deviceState\)/);
  assert.match(source, /systemServerPids\.length === 0/);
  assert.match(source, /parseRemotePackagePidof\(lookup, deviceState\)/);
  assert.match(source, /remotePackageCmdlineMatches\(cmdline\.stdout, packageName\)/);
  assert.doesNotMatch(source, /cmdline\.stdout\.includes\(packageName\)/);
  assert.match(source, /stdoutBytes: Buffer\.byteLength\(stdout\),\s*stderrBytes: Buffer\.byteLength\(stderr\)/);
  assert.match(source, /\['get-state'\], `\$\{label\}-pidof-empty-device-state`/);
});

test('A11 PID readback distinguishes a connected app absence from transport and output failures', () => {
  assert.deepEqual(parseRemotePackagePidof({status: 0, stdout: '321 654\n', stderr: ''}), ['321', '654']);
  assert.deepEqual(
    parseRemotePackagePidof({status: 1, stdout: '', stderr: ''}, {status: 0, stdout: 'device', stderr: ''}),
    [],
  );
  assert.throws(
    () => parseRemotePackagePidof({status: 1, stdout: '', stderr: ''}),
    /PIDOF_EMPTY_REQUIRES_CONNECTED_DEVICE/,
  );
  assert.throws(
    () =>
      parseRemotePackagePidof(
        {status: 1, stdout: '', stderr: ''},
        {status: 1, stdout: '', stderr: 'error: device offline'},
      ),
    /PIDOF_EMPTY_REQUIRES_CONNECTED_DEVICE/,
  );
  assert.throws(
    () => parseRemotePackagePidof({status: 1, stdout: '', stderr: 'error: device offline'}),
    /PIDOF_READBACK_FAILED/,
  );
  assert.throws(
    () => parseRemotePackagePidof({status: 0, stdout: '', stderr: ''}),
    /PIDOF_SUCCESS_OUTPUT_INVALID/,
  );
  assert.throws(
    () => parseRemotePackagePidof({status: 0, stdout: '321 unknown', stderr: ''}),
    /PIDOF_SUCCESS_OUTPUT_INVALID/,
  );
  assert.throws(
    () => parseRemotePackagePidof({status: 0, stdout: '321', stderr: 'pidof: transient read warning'}),
    /PIDOF_SUCCESS_OUTPUT_INVALID/,
  );
  assert.throws(
    () => parseRemotePackagePidof({status: null, stdout: '', stderr: '', error: {code: 'ETIMEDOUT'}}),
    /PIDOF_EXECUTION_FAILED/,
  );
});

test('A11 process start token is accepted only for the exact PID queried', () => {
  assert.equal(
    parseRemoteProcStatStartTicks(
      '321 (com.catering.sample) S 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 987654 20',
      321,
    ),
    '987654',
  );
  assert.throws(
    () =>
      parseRemoteProcStatStartTicks(
        '654 (com.catering.sample) S 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 987654 20',
        321,
      ),
    /REMOTE_PROCESS_IDENTITY_INVALID/,
  );
  assert.throws(
    () => parseRemoteProcStatStartTicks('321 (com.catering.sample)', 321),
    /REMOTE_PROCESS_IDENTITY_INVALID/,
  );
  assert.throws(
    () =>
      parseRemoteProcStatStartTicks(
        '321 (com.catering.sample) S 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 987654 20',
        undefined,
      ),
    /REMOTE_PROCESS_IDENTITY_INVALID/,
  );
  assert.throws(
    () =>
      parseRemoteProcStatStartTicks(
        '0 (com.catering.sample) S 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 987654 20',
        0,
      ),
    /REMOTE_PROCESS_IDENTITY_INVALID/,
  );
});

test('A11 cmdline readback binds the first process token to the exact package or its Android process suffix', () => {
  assert.equal(remotePackageCmdlineMatches('com.catering.sample\0--start\0', 'com.catering.sample'), true);
  assert.equal(remotePackageCmdlineMatches('com.catering.sample:sync\0--start\0', 'com.catering.sample'), true);
  assert.equal(remotePackageCmdlineMatches('com.catering.sample:\0--start\0', 'com.catering.sample'), false);
  assert.equal(remotePackageCmdlineMatches('com.catering.sample.extra\0', 'com.catering.sample'), false);
  assert.equal(remotePackageCmdlineMatches('worker\0com.catering.sample\0', 'com.catering.sample'), false);
  assert.equal(remotePackageCmdlineMatches('', 'com.catering.sample'), false);
});
