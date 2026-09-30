#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {finished} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import {
  canonicalStartToken,
  readProcessTable,
  snapshotProcessTree,
  terminateOwnedProcessTree,
} from '../dev/managed-process-tree.mjs';
import {
  parseAdbDeviceList,
  parseLogicalDisplays,
  parseSurfaceDisplays,
  validateDeviceShape,
} from './ter-virtual-keyboard-android.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUNTIME_ROOT = path.join(ROOT, '.runtime/ter-third-party-usage-remediation/cp-a/a6/prechange');
const EVIDENCE_ROOT = path.join(
  ROOT,
  'doc/evidence/platform/2026-09-28-ter-third-party-usage-remediation/cp-a/a6/prechange',
);
const RUN_ID_RE = /^ter-a11-prechange-[A-Za-z0-9._-]{1,52}$/;
const APPS = Object.freeze({
  'sample-terminal': Object.freeze({
    packageName: 'com.anonymous.sampleterminal',
    activity: 'com.anonymous.sampleterminal/.MainActivity',
    androidRoot: 'apps/terminal/application/android/sample-terminal/android',
  }),
  'sample-wallpaper-terminal': Object.freeze({
    packageName: 'com.catering.v2s.terminal.samplewallpaper',
    activity: 'com.catering.v2s.terminal.samplewallpaper/.MainActivity',
    androidRoot: 'apps/terminal/application/android/sample-wallpaper-terminal/android',
  }),
});
const SOURCE_PATHS = Object.freeze([
  'yarn.lock',
  'apps/terminal/package.json',
  'apps/terminal/adapter/android/persist-kv/package.json',
  'apps/terminal/adapter/android/persist-kv/expo-module.config.json',
  'apps/terminal/adapter/android/persist-kv/android/build.gradle',
  'apps/terminal/adapter/android/persist-kv/android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/TerminalPersistKvModule.kt',
  'apps/terminal/adapter/android/persist-kv/android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/ProtectedStorageIdentity.kt',
  'apps/terminal/adapter/android/persist-kv/android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/StorageMode.kt',
  'apps/terminal/adapter/android/persist-kv/android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/StorageValidation.kt',
  'apps/terminal/adapter/android/persist-kv/src/implementations/androidPersistKv.ts',
  'apps/terminal/application/base/android/src/foundations/androidPlatform.ts',
  'apps/terminal/kernel/base/state/src/foundations/keyspace.ts',
  'apps/terminal/kernel/base/state/src/foundations/persistenceHydration.ts',
  'apps/terminal/kernel/base/state/src/foundations/persistencePrimitives.ts',
  'apps/terminal/application/android/sample-terminal/app.json',
  'apps/terminal/application/android/sample-terminal/package.json',
  'apps/terminal/application/android/sample-terminal/src/assembly/platformPorts.ts',
  'apps/terminal/application/android/sample-terminal/android/app/build.gradle',
  'apps/terminal/application/android/sample-wallpaper-terminal/app.json',
  'apps/terminal/application/android/sample-wallpaper-terminal/package.json',
  'apps/terminal/application/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts',
  'apps/terminal/application/android/sample-wallpaper-terminal/android/app/build.gradle',
]);

const now = () => new Date().toISOString();
const sha256 = value => createHash('sha256').update(value).digest('hex');
const safeRunId = value => {
  if (!RUN_ID_RE.test(value ?? '')) throw new Error('TER_A11_RUN_ID_INVALID');
  return value;
};
const runtimeManifestPath = runId => path.join(RUNTIME_ROOT, safeRunId(runId), 'run-manifest.json');
const evidenceManifestPath = runId => path.join(EVIDENCE_ROOT, safeRunId(runId), 'run-manifest.json');
const save = manifest => {
  manifest.updatedAt = now();
  const bytes = `${JSON.stringify(manifest, null, 2)}\n`;
  for (const file of [runtimeManifestPath(manifest.runId), evidenceManifestPath(manifest.runId)]) {
    fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
    fs.writeFileSync(file, bytes, {mode: 0o600});
  }
};
const appendEvent = (manifest, event, fields = {}) => {
  const line = `${JSON.stringify({at: now(), runId: manifest.runId, event, ...fields})}\n`;
  for (const base of [path.join(RUNTIME_ROOT, manifest.runId), path.join(EVIDENCE_ROOT, manifest.runId)]) {
    fs.mkdirSync(base, {recursive: true, mode: 0o700});
    fs.appendFileSync(path.join(base, 'events.jsonl'), line, {mode: 0o600});
  }
};
const sourceDigest = () => {
  const chunks = SOURCE_PATHS.map(file => {
    const absolute = path.resolve(ROOT, file);
    if (!absolute.startsWith(`${ROOT}${path.sep}`) || !fs.statSync(absolute).isFile())
      throw new Error('TER_A11_SOURCE_INPUT_INVALID');
    return `${file}\0${fs.readFileSync(absolute)}`;
  });
  return sha256(chunks.join('\0'));
};
const runPreflight = manifest => {
  const result = spawnSync(
    path.join(ROOT, 'scripts/env/check-runtime-resource-budget'),
    ['--profile', 'ter-validation-with-dev', path.join(ROOT, '.runtime')],
    {cwd: ROOT, encoding: 'utf8', timeout: 30_000},
  );
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  fs.writeFileSync(path.join(RUNTIME_ROOT, manifest.runId, 'resource-preflight.log'), output, {mode: 0o600});
  fs.writeFileSync(path.join(EVIDENCE_ROOT, manifest.runId, 'resource-preflight.log'), output, {mode: 0o600});
  manifest.resourcePreflight = {at: now(), result: result.status === 0 ? 'PASS' : 'FAIL'};
  save(manifest);
  if (result.status !== 0) throw new Error('TER_A11_RESOURCE_PREFLIGHT_FAILED');
};
const adb = (manifest, serial, args, label, {allowExit = [0], timeout = 30_000} = {}) => {
  if (
    !/^[A-Za-z0-9._:-]{1,128}$/.test(serial) ||
    args.includes('clear') ||
    (args[0] === 'logcat' && args.includes('-c'))
  )
    throw new Error('TER_A11_ADB_ARGUMENT_REJECTED');
  const result = spawnSync('adb', ['-s', serial, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout,
    maxBuffer: 8 * 1024 * 1024,
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const record = {
    at: now(),
    label,
    exitCode: result.status ?? -1,
    result: allowExit.includes(result.status) ? 'PASS' : 'FAIL',
    stdoutBytes: Buffer.byteLength(stdout),
    stderrBytes: Buffer.byteLength(stderr),
  };
  manifest.commands.push(record);
  appendEvent(manifest, 'ADB_COMMAND', record);
  save(manifest);
  if (!allowExit.includes(result.status)) throw new Error(`TER_A11_ADB_FAILED:${label}:${result.status ?? 'spawn'}`);
  return {stdout, stderr, status: result.status, error: result.error ?? null};
};
const processIdentity = pid => {
  const row = readProcessTable().find(item => item.pid === pid);
  return row ? {pid: row.pid, pgid: row.pgid, startToken: canonicalStartToken(row.startToken)} : null;
};
const processRows = identity => snapshotProcessTree(identity, readProcessTable());
export async function finishBuildLogStreams(stdout, stderr, log) {
  stdout.pipe(log, {end: false});
  stderr.pipe(log, {end: false});
  await Promise.all([finished(stdout), finished(stderr)]);
  log.end();
  await finished(log);
}
const recordFailure = (manifest, code, stage) => {
  manifest.firstFailure ??= {code, stage, at: now()};
  manifest.brokenBoundary ??= stage;
  manifest.status = 'FAIL';
  appendEvent(manifest, 'FIRST_FAILURE', {code, stage});
  save(manifest);
};

function discoverRoles(deviceRows) {
  const dual = deviceRows.filter(device => device.role === 'physical-dual');
  const mobile = deviceRows.filter(device => device.role === 'mobile-vm');
  if (dual.length !== 1 || mobile.length !== 1 || dual[0].serial === mobile[0].serial)
    throw new Error('TER_A11_TARGET_ROLE_NOT_UNIQUE');
  return {dual: dual[0], mobile: mobile[0]};
}

export function resolveTargetRolesForTest(deviceRows) {
  return discoverRoles(deviceRows);
}

export function classifyObservedDevice({serial, model, qemu, logicalText, surfaceText}) {
  const logical = parseLogicalDisplays(logicalText);
  const surfaces = parseSurfaceDisplays(surfaceText);
  if (logical.length === 2) {
    const pairing = validateDeviceShape({shape: 'dual', logical, surfaces});
    if (qemu || pairing.secondarySurfaceKind !== 'physical') return null;
    return {serial, model, role: 'physical-dual', logical, surfaces, pairing};
  }
  if (
    logical.length === 1 &&
    logical[0].height > logical[0].width &&
    qemu &&
    surfaces.external.length === 0 &&
    surfaces.virtual.length === 0
  ) {
    const pairing = validateDeviceShape({shape: 'mobile', logical, surfaces});
    return {serial, model, role: 'mobile-vm', logical, surfaces, pairing};
  }
  return null;
}

async function discoverDevices(manifest) {
  const list = spawnSync('adb', ['devices', '-l'], {cwd: ROOT, encoding: 'utf8', timeout: 10_000});
  if (list.status !== 0) throw new Error('TER_A11_DEVICE_ENUMERATION_FAILED');
  const online = parseAdbDeviceList(list.stdout);
  const observed = [];
  for (const serial of online.keys()) {
    const model = adb(
      manifest,
      serial,
      ['shell', 'getprop', 'ro.product.model'],
      `inventory-${serial}-model`,
    ).stdout.trim();
    const qemuValue = adb(
      manifest,
      serial,
      ['shell', 'getprop', 'ro.kernel.qemu'],
      `inventory-${serial}-qemu`,
    ).stdout.trim();
    const logicalText = adb(
      manifest,
      serial,
      ['shell', 'cmd', 'display', 'get-displays'],
      `inventory-${serial}-logical`,
    ).stdout;
    const surfaceText = adb(
      manifest,
      serial,
      ['shell', 'dumpsys', 'SurfaceFlinger', '--displays'],
      `inventory-${serial}-surfaceflinger`,
    ).stdout;
    const candidate = classifyObservedDevice({serial, model, qemu: qemuValue === '1', logicalText, surfaceText});
    if (candidate) {
      const bootId = adb(
        manifest,
        serial,
        ['shell', 'cat', '/proc/sys/kernel/random/boot_id'],
        `inventory-${serial}-boot-id`,
      ).stdout.trim();
      if (!/^[A-Za-z0-9-]{8,96}$/.test(bootId)) throw new Error('TER_A11_DEVICE_BOOT_ID_INVALID');
      candidate.bootId = bootId;
      observed.push(candidate);
    }
  }
  return discoverRoles(observed);
}

async function runManagedBuild(manifest, appName) {
  const app = APPS[appName];
  const androidRoot = path.join(ROOT, app.androidRoot);
  const apkPath = path.join(androidRoot, 'app/build/outputs/apk/release/app-release.apk');
  const logPath = path.join(RUNTIME_ROOT, manifest.runId, `${appName}-gradle.log`);
  fs.mkdirSync(path.dirname(logPath), {recursive: true, mode: 0o700});
  const log = fs.createWriteStream(logPath, {flags: 'wx', mode: 0o600});
  const child = spawn('./gradlew', ['assembleRelease', '--rerun-tasks', '--no-daemon', '--console=plain'], {
    cwd: androidRoot,
    env: {...process.env, NODE_ENV: 'production'},
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!child.pid) throw new Error(`TER_A11_BUILD_START_FAILED:${appName}`);
  let identity = null;
  for (let attempt = 0; attempt < 50 && !identity; attempt += 1) {
    identity = processIdentity(child.pid);
    if (!identity) await new Promise(resolve => setTimeout(resolve, 20));
  }
  if (!identity) {
    child.kill('SIGTERM');
    throw new Error(`TER_A11_BUILD_IDENTITY_UNAVAILABLE:${appName}`);
  }
  manifest.builds[appName] = {
    phase: 'RUNNING',
    pid: identity.pid,
    pgid: identity.pgid,
    startToken: identity.startToken,
    sourceDigest: manifest.sourceDigest,
    logPath: path.relative(ROOT, logPath),
    startedAt: now(),
  };
  appendEvent(manifest, 'BUILD_STARTED', {appName, pid: identity.pid, sourceDigest: manifest.sourceDigest});
  save(manifest);
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  const logDrain = finishBuildLogStreams(child.stdout, child.stderr, log);
  let resourceFailure = null;
  const heartbeat = setInterval(() => {
    const rows = processRows(identity);
    const resources = rows.map(row => {
      const sample = spawnSync('ps', ['-o', 'rss=', '-p', String(row.pid)], {encoding: 'utf8'});
      return {pid: row.pid, rssKiB: Number(sample.stdout?.trim()) || 0};
    });
    manifest.builds[appName].resourceSample = resources;
    manifest.builds[appName].ownedProcessCount = rows.length;
    manifest.builds[appName].managedRssMiB = Math.ceil(resources.reduce((sum, row) => sum + row.rssKiB, 0) / 1024);
    manifest.builds[appName].heartbeatAt = now();
    save(manifest);
    if (manifest.builds[appName].managedRssMiB > 4096) resourceFailure = 'TER_A11_BUILD_RSS_LIMIT_EXCEEDED';
    if (resourceFailure) void terminateOwnedProcessTree(identity, {waitMs: 15_000});
  }, 1000);
  const timeout = setTimeout(() => {
    resourceFailure ??= 'TER_A11_BUILD_TIMEOUT';
    void terminateOwnedProcessTree(identity, {waitMs: 15_000});
  }, 20 * 60_000);
  const exitCode = await new Promise(resolve => child.once('close', code => resolve(code ?? -1)));
  clearInterval(heartbeat);
  clearTimeout(timeout);
  await logDrain;
  const evidenceLogPath = path.join(EVIDENCE_ROOT, manifest.runId, `${appName}-gradle.log`);
  fs.copyFileSync(logPath, evidenceLogPath);
  manifest.builds[appName].evidenceLogPath = path.relative(ROOT, evidenceLogPath);
  const remaining = processRows(identity);
  const build = manifest.builds[appName];
  build.finishedAt = now();
  build.exitCode = exitCode;
  build.processTreeCleanup = remaining.length === 0 ? 'PASS' : 'FAIL';
  if (exitCode !== 0 || resourceFailure || remaining.length !== 0 || !fs.existsSync(apkPath)) {
    build.phase = 'FAIL';
    build.failureCode = resourceFailure ?? (remaining.length ? 'TER_A11_BUILD_TREE_REMAINS' : 'TER_A11_BUILD_FAILED');
    if (remaining.length !== 0) manifest.cleanup = 'FAIL';
    recordFailure(manifest, build.failureCode, `build-${appName}`);
    throw new Error(build.failureCode);
  }
  const bytes = fs.readFileSync(apkPath);
  build.phase = 'PASS';
  build.apkPath = path.relative(ROOT, apkPath);
  build.apkBytes = bytes.length;
  build.apkSha256 = sha256(bytes);
  appendEvent(manifest, 'BUILD_FINISHED', {
    appName,
    result: 'PASS',
    apkBytes: bytes.length,
    apkSha256: build.apkSha256,
  });
  save(manifest);
}

function readRemoteProcessIds(manifest, device, processName, label) {
  const lookup = adb(manifest, device.serial, ['shell', 'pidof', processName], `${label}-pidof`, {allowExit: [0, 1]});
  let deviceState = null;
  if (
    lookup.status === 1 &&
    lookup.error == null &&
    lookup.stdout.trim().length === 0 &&
    lookup.stderr.trim().length === 0
  ) {
    deviceState = adb(manifest, device.serial, ['get-state'], `${label}-pidof-empty-device-state`);
  }
  return parseRemotePackagePidof(lookup, deviceState);
}

function readRemotePackageProcesses(manifest, device, packageName, label) {
  const pids = readRemoteProcessIds(manifest, device, packageName, label);
  return pids.map(pid => {
    const stat = adb(manifest, device.serial, ['shell', 'cat', `/proc/${pid}/stat`], `${label}-stat-${pid}`);
    const cmdline = adb(manifest, device.serial, ['shell', 'cat', `/proc/${pid}/cmdline`], `${label}-cmdline-${pid}`);
    const startTicks = parseRemoteProcStatStartTicks(stat.stdout, pid);
    if (!remotePackageCmdlineMatches(cmdline.stdout, packageName))
      throw new Error('TER_A11_REMOTE_PROCESS_IDENTITY_INVALID');
    return {pid: Number(pid), startTicks};
  });
}

async function observeProtectedMarker(manifest, device, appName) {
  const app = APPS[appName];
  const intentId = `${manifest.runId}-${device.role}-${appName}`;
  const child = spawn('adb', ['-s', device.serial, 'logcat', '-v', 'brief', '-s', 'TER-A11:I', 'TerminalPersistKv:I'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!child.pid) throw new Error('TER_A11_LOGCAT_START_FAILED');
  let identity = null;
  for (let attempt = 0; attempt < 50 && !identity; attempt += 1) {
    identity = processIdentity(child.pid);
    if (!identity) await new Promise(resolve => setTimeout(resolve, 20));
  }
  if (!identity) {
    child.kill('SIGTERM');
    throw new Error('TER_A11_LOGCAT_IDENTITY_UNAVAILABLE');
  }
  manifest.logcatWatchers.push({
    serial: device.serial,
    appName,
    pid: identity.pid,
    pgid: identity.pgid,
    startToken: identity.startToken,
    intentId,
    state: 'RUNNING',
    startedAt: now(),
  });
  appendEvent(manifest, 'PROTECTED_MARKER_WATCH_STARTED', {deviceRole: device.role, appName, intentId});
  save(manifest);
  let intentSeen = false;
  let matched = null;
  let observerFailureCode = null;
  const appProcessIds = new Set();
  const candidateMarkerLines = [];
  let buffer = '';
  const evaluateNamespaceReadback = () => {
    if (appProcessIds.size === 0 || matched || observerFailureCode) return;
    const observation = protectedNamespaceReadbackFromLines(candidateMarkerLines, [...appProcessIds]);
    if (observation?.status === 'missing') {
      observerFailureCode = 'TER_A11_OLD_NAMESPACE_NOT_PRESENT_BEFORE_LAUNCH';
      return;
    }
    if (observation?.status === 'failed') {
      observerFailureCode = 'TER_A11_PROTECTED_NAMESPACE_OPEN_FAILED';
      return;
    }
    if (observation?.status === 'confirmed') matched = observation;
  };
  const inspect = chunk => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const intentMarker = line.match(/^[VDIWEF]\/TER-A11\(\s*\d+\):\s*intent=([A-Za-z0-9._-]{1,128})\s*$/);
      if (intentMarker?.[1] === intentId) {
        intentSeen = true;
        continue;
      }
      if (!intentSeen || !/^\s*[VDIWEF]\/TerminalPersistKv\(\s*\d+\):/.test(line)) continue;
      candidateMarkerLines.push(line);
      if (candidateMarkerLines.length > 64) {
        observerFailureCode = 'TER_A11_PROTECTED_MARKER_CANDIDATE_LIMIT';
        child.kill('SIGTERM');
        return;
      }
      evaluateNamespaceReadback();
    }
  };
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', inspect);
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', inspect);
  child.on('error', () => {
    observerFailureCode ??= 'TER_A11_LOGCAT_READ_FAILED';
  });
  const timeout = setTimeout(() => child.kill('SIGTERM'), 90_000);
  try {
    adb(
      manifest,
      device.serial,
      ['shell', 'log', '-p', 'i', '-t', 'TER-A11', `intent=${intentId}`],
      `${device.role}-${appName}-log-marker`,
    );
    const start = adb(
      manifest,
      device.serial,
      ['shell', 'am', 'start', '-W', '-n', app.activity],
      `${device.role}-${appName}-launch`,
    );
    if (!/Status:\s*ok/.test(start.stdout)) throw new Error('TER_A11_ACTIVITY_LAUNCH_FAILED');
    const launchedProcesses = readRemotePackageProcesses(
      manifest,
      device,
      app.packageName,
      `${device.role}-${appName}-launch-process-readback`,
    );
    if (launchedProcesses.length === 0) throw new Error('TER_A11_LAUNCHED_PROCESS_NOT_READABLE');
    for (const process of launchedProcesses) appProcessIds.add(String(process.pid));
    evaluateNamespaceReadback();
    if (observerFailureCode) throw new Error(observerFailureCode);
    const deadline = Date.now() + 90_000;
    while (!matched && !observerFailureCode && Date.now() < deadline)
      await new Promise(resolve => setTimeout(resolve, 100));
    if (observerFailureCode) throw new Error(observerFailureCode);
    if (!matched) throw new Error('TER_A11_PROTECTED_MARKER_NOT_OBSERVED');
    const watcher = manifest.logcatWatchers.at(-1);
    watcher.state = 'MATCHED';
    watcher.finishedAt = now();
    watcher.observation = {
      operation: matched.operation,
      namespaceVersion: matched.namespaceVersion,
      existedBeforeOpen: matched.existedBeforeOpen,
      legacyNamespacePresent: matched.legacyNamespacePresent,
      preOpenLine: matched.preOpenLine,
      resultLine: matched.resultLine,
    };
    appendEvent(manifest, 'PROTECTED_MARKER_OBSERVED', {
      deviceRole: device.role,
      appName,
      operation: matched.operation,
      namespaceVersion: matched.namespaceVersion,
      existedBeforeOpen: matched.existedBeforeOpen,
    });
    save(manifest);
    return matched;
  } finally {
    clearTimeout(timeout);
    const stopped = await terminateOwnedProcessTree(identity, {waitMs: 10_000});
    await Promise.race([
      new Promise(resolve => child.once('close', resolve)),
      new Promise(resolve => setTimeout(resolve, 10_000)),
    ]);
    const watcher = manifest.logcatWatchers.at(-1);
    watcher.processTreeCleanup = stopped.status;
    if (stopped.status !== 'PASS') {
      manifest.cleanup = 'FAIL';
      recordFailure(manifest, 'TER_A11_LOGCAT_CLEANUP_FAILED', `logcat-${device.role}-${appName}`);
    }
    save(manifest);
  }
}

async function installObserveAndStop(manifest, device, appName) {
  const app = APPS[appName];
  const build = manifest.builds[appName];
  const apk = path.join(ROOT, build.apkPath);
  if (sourceDigest() !== manifest.sourceDigest || sha256(fs.readFileSync(apk)) !== build.apkSha256)
    throw new Error('TER_A11_SOURCE_OR_APK_BINDING_CHANGED');
  if (readRemotePackageProcesses(manifest, device, app.packageName, `preinstall-${device.role}-${appName}`).length)
    throw new Error('TER_A11_PREEXISTING_APP_PROCESS');
  const install = adb(manifest, device.serial, ['install', '-r', apk], `${device.role}-${appName}-install-r`, {
    timeout: 120_000,
  });
  if (!/Success/.test(install.stdout)) throw new Error('TER_A11_INSTALL_RESULT_INVALID');
  const packagePath = adb(
    manifest,
    device.serial,
    ['shell', 'pm', 'path', app.packageName],
    `${device.role}-${appName}-installed-path`,
  ).stdout.match(/^package:(\S+)$/m)?.[1];
  if (!packagePath) throw new Error('TER_A11_INSTALLED_APK_PATH_MISSING');
  const installedHash = adb(
    manifest,
    device.serial,
    ['shell', 'sha256sum', packagePath],
    `${device.role}-${appName}-installed-sha256`,
  )
    .stdout.trim()
    .split(/\s+/)[0];
  if (installedHash?.toLowerCase() !== build.apkSha256.toLowerCase())
    throw new Error('TER_A11_INSTALLED_APK_HASH_MISMATCH');
  manifest.installations.push({
    deviceRole: device.role,
    serial: device.serial,
    appName,
    apkSha256: build.apkSha256,
    installedSha256: installedHash,
    installMode: 'install -r',
    dataCleared: false,
    at: now(),
  });
  appendEvent(manifest, 'PRECHANGE_APK_INSTALLED', {
    deviceRole: device.role,
    appName,
    apkSha256: build.apkSha256,
    dataCleared: false,
  });
  const owned = {
    deviceRole: device.role,
    serial: device.serial,
    appName,
    packageName: app.packageName,
    processOwnership: 'PACKAGE_ABSENT_BEFORE_INSTALL_RUN_OWNED_LAUNCH',
    processes: [],
    startedAt: null,
    stoppedAt: null,
    cleanup: 'PENDING',
  };
  manifest.ownedApps.push(owned);
  save(manifest);
  owned.startedAt = now();
  save(manifest);
  const marker = await observeProtectedMarker(manifest, device, appName);
  if (marker.status !== 'confirmed' || marker.existedBeforeOpen !== true)
    throw new Error('TER_A11_OLD_NAMESPACE_PRECONDITION_UNPROVEN');
  const launched = readRemotePackageProcesses(manifest, device, app.packageName, `owned-${device.role}-${appName}`);
  if (!launched.length) throw new Error('TER_A11_LAUNCHED_PROCESS_NOT_READABLE');
  owned.processes = launched;
  save(manifest);
  adb(
    manifest,
    device.serial,
    ['shell', 'am', 'force-stop', app.packageName],
    `${device.role}-${appName}-force-stop-owned`,
  );
  if (readRemotePackageProcesses(manifest, device, app.packageName, `cleanup-${device.role}-${appName}`).length)
    throw new Error('TER_A11_APP_CLEANUP_READBACK_FAILED');
  owned.stoppedAt = now();
  owned.cleanup = 'PASS';
  manifest.markers.push({
    deviceRole: device.role,
    serial: device.serial,
    appName,
    packageName: app.packageName,
    sourceDigest: manifest.sourceDigest,
    apkSha256: build.apkSha256,
    markerOperation: marker.operation,
    oldNamespaceExistedBeforeOpen: marker.existedBeforeOpen,
    namespaceVersion: marker.namespaceVersion,
    legacyNamespacePresent: marker.legacyNamespacePresent,
    preOpenLine: marker.preOpenLine,
    resultLine: marker.resultLine,
    status: 'CONFIRMED',
    confirmedAt: now(),
  });
  appendEvent(manifest, 'OLD_PROTECTED_NAMESPACE_CONFIRMED', {
    deviceRole: device.role,
    appName,
    operation: marker.operation,
    apkSha256: build.apkSha256,
  });
  save(manifest);
}

async function run(args) {
  const runId = safeRunId(args[0]);
  const runRoot = path.join(RUNTIME_ROOT, runId);
  const evidenceRoot = path.join(EVIDENCE_ROOT, runId);
  if (fs.existsSync(runRoot) || fs.existsSync(evidenceRoot)) throw new Error('TER_A11_RUN_ID_ALREADY_EXISTS');
  fs.mkdirSync(runRoot, {recursive: true, mode: 0o700});
  fs.mkdirSync(evidenceRoot, {recursive: true, mode: 0o700});
  const identity = processIdentity(process.pid);
  if (!identity) throw new Error('TER_A11_RUNNER_IDENTITY_UNAVAILABLE');
  const manifest = {
    schemaVersion: 1,
    runId,
    tool: 'scripts/test/ter-persist-kv-prechange-android.mjs',
    authorization: 'TER_THIRD_PARTY_REMEDIATION_TP_A11_PRECHANGE_BASELINE',
    status: 'RUNNING',
    phase: 'PREFLIGHT',
    startedAt: now(),
    runnerProcess: identity,
    sourceFiles: SOURCE_PATHS,
    sourceDigest: sourceDigest(),
    devices: {},
    builds: {},
    installations: [],
    logcatWatchers: [],
    ownedApps: [],
    markers: [],
    commands: [],
    business: 'NOT_RUN',
    cleanup: 'NOT_RUN',
    firstFailure: null,
    lastKnownGood: null,
    brokenBoundary: null,
  };
  save(manifest);
  try {
    runPreflight(manifest);
    const roles = await discoverDevices(manifest);
    manifest.devices = roles;
    for (const device of Object.values(roles)) {
      const systemServerPids = readRemoteProcessIds(
        manifest,
        device,
        'system_server',
        `${device.role}-system-server-positive-readback`,
      );
      if (systemServerPids.length === 0) throw new Error('TER_A11_PROCESS_READBACK_POSITIVE_PREFLIGHT_FAILED');
      manifest.lastKnownGood = `positive-system-server-${device.role}`;
    }
    manifest.status = 'READY';
    manifest.phase = 'TARGETS_CONFIRMED';
    appendEvent(manifest, 'TARGETS_CONFIRMED', {
      roles: Object.fromEntries(
        Object.entries(roles).map(([role, device]) => [
          role,
          {serial: device.serial, model: device.model, bootId: device.bootId},
        ]),
      ),
    });
    save(manifest);
    for (const appName of Object.keys(APPS)) {
      manifest.phase = `BUILD_${appName}`;
      save(manifest);
      await runManagedBuild(manifest, appName);
    }
    for (const appName of Object.keys(APPS)) {
      for (const role of ['dual', 'mobile']) {
        manifest.phase = `INSTALL_AND_MARKER_${role}_${appName}`;
        save(manifest);
        await installObserveAndStop(manifest, roles[role], appName);
        manifest.lastKnownGood = `old-protected-marker-${role}-${appName}`;
        save(manifest);
      }
    }
    manifest.business = manifest.markers.length === 4 ? 'PASS' : 'FAIL';
    if (manifest.business !== 'PASS') throw new Error('TER_A11_MARKER_PAIRING_DENOMINATOR_INCOMPLETE');
  } catch (error) {
    recordFailure(manifest, error.message || 'TER_A11_RUN_FAILED', manifest.phase);
    manifest.business = manifest.business === 'NOT_RUN' ? 'FAIL' : manifest.business;
  } finally {
    for (const build of Object.values(manifest.builds)) {
      if (build.processTreeCleanup === 'PASS' || !build.pid || !build.pgid || !build.startToken) continue;
      const buildIdentity = {pid: build.pid, pgid: build.pgid, startToken: build.startToken};
      try {
        const before = processRows(buildIdentity);
        if (before.length) await terminateOwnedProcessTree(buildIdentity, {waitMs: 15_000});
        const after = processRows(buildIdentity);
        build.processTreeCleanup = after.length === 0 ? 'PASS' : 'FAIL';
        if (build.phase === 'RUNNING') build.phase = 'FAIL';
        if (after.length) manifest.cleanup = 'FAIL';
      } catch {
        build.processTreeCleanup = 'FAIL';
        manifest.cleanup = 'FAIL';
      }
    }
    for (const owned of manifest.ownedApps.filter(item => item.cleanup !== 'PASS')) {
      try {
        adb(
          manifest,
          owned.serial,
          ['shell', 'am', 'force-stop', owned.packageName],
          `cleanup-${owned.deviceRole}-${owned.appName}-force-stop`,
        );
        const identityNow = readRemotePackageProcesses(
          manifest,
          {serial: owned.serial},
          owned.packageName,
          `cleanup-${owned.deviceRole}-${owned.appName}`,
        );
        if (identityNow.length === 0) {
          owned.cleanup = 'PASS';
          owned.stoppedAt = now();
        } else {
          throw new Error('TER_A11_APP_PROCESS_REMAINS_AFTER_FORCE_STOP');
        }
      } catch {
        owned.cleanup = 'FAIL';
        manifest.cleanup = 'FAIL';
        if (manifest.firstFailure === null) {
          recordFailure(
            manifest,
            'TER_A11_APP_CLEANUP_READBACK_FAILED',
            `cleanup-${owned.deviceRole}-${owned.appName}`,
          );
        } else {
          appendEvent(manifest, 'CLEANUP_FAILURE', {
            code: 'TER_A11_APP_CLEANUP_READBACK_FAILED',
            stage: `cleanup-${owned.deviceRole}-${owned.appName}`,
          });
        }
      }
      save(manifest);
    }
    const failedBuildCleanup = Object.values(manifest.builds).some(build => build.processTreeCleanup !== 'PASS');
    const failedWatcherCleanup = manifest.logcatWatchers.some(watcher => watcher.processTreeCleanup !== 'PASS');
    const failedAppCleanup = manifest.ownedApps.some(item => item.cleanup !== 'PASS');
    if (failedBuildCleanup || failedWatcherCleanup || failedAppCleanup) manifest.cleanup = 'FAIL';
    else if (manifest.cleanup !== 'FAIL') manifest.cleanup = 'PASS';
    manifest.phase = 'COMPLETE';
    manifest.status = manifest.business === 'PASS' && manifest.cleanup === 'PASS' ? 'PASS' : 'FAIL';
    manifest.finishedAt = now();
    save(manifest);
  }
  process.stdout.write(
    `TER_A11_PRECHANGE status=${manifest.status} business=${manifest.business} cleanup=${manifest.cleanup} markers=${manifest.markers.length}/4 sourceDigest=${manifest.sourceDigest} runId=${runId}\n`,
  );
  if (manifest.status !== 'PASS') throw new Error(manifest.firstFailure?.code ?? 'TER_A11_PRECHANGE_FAILED');
}

export function protectedMarkerOperation(line, allowedProcessIds) {
  const result = protectedMarkerResult(line, allowedProcessIds);
  return result?.status === 'succeeded' ? result.operation : null;
}

export function protectedMarkerResult(line, allowedProcessIds) {
  if (
    !Array.isArray(allowedProcessIds) ||
    allowedProcessIds.length === 0 ||
    allowedProcessIds.some(value => !/^\d{1,10}$/.test(String(value)))
  ) {
    return null;
  }
  const text = String(line ?? '');
  const pid = text.match(/^\s*[VDIWEF]\/TerminalPersistKv\(\s*(\d+)\):/)?.[1];
  if (!pid || !allowedProcessIds.map(String).includes(pid)) return null;
  const match = text.match(
    /^\s*[VDIWEF]\/TerminalPersistKv\(\s*\d+\):\s*event=persist-kv operation=(read|readMany|write|writeMany|listKeys|clear) mode=protected status=(succeeded|failed|unavailable)(?: code=[A-Z0-9_]+)?\s*$/,
  );
  if (!match) return null;
  return {pid, operation: match[1], status: match[2], line: text.trim().slice(-320)};
}

export function parseRemotePackagePidof(pidof, deviceState = null) {
  const stdout = String(pidof?.stdout ?? '').trim();
  const stderr = String(pidof?.stderr ?? '').trim();
  if (pidof?.error != null) throw new Error('TER_A11_PIDOF_EXECUTION_FAILED');
  if (pidof?.status === 0) {
    const pids = stdout.length === 0 ? [] : stdout.split(/\s+/);
    if (stderr.length > 0 || pids.length === 0 || pids.some(pid => !/^\d+$/.test(pid) || Number(pid) <= 0)) {
      throw new Error('TER_A11_PIDOF_SUCCESS_OUTPUT_INVALID');
    }
    return pids;
  }
  if (pidof?.status === 1 && stdout.length === 0 && stderr.length === 0) {
    if (
      deviceState?.status === 0 &&
      deviceState.error == null &&
      String(deviceState.stdout ?? '').trim() === 'device' &&
      String(deviceState.stderr ?? '').trim() === ''
    ) {
      return [];
    }
    throw new Error('TER_A11_PIDOF_EMPTY_REQUIRES_CONNECTED_DEVICE');
  }
  throw new Error(`TER_A11_PIDOF_READBACK_FAILED:${stderr || stdout || `exit=${pidof?.status ?? 'unknown'}`}`);
}

export function parseRemoteProcStatStartTicks(value, expectedPid) {
  const stat = String(value ?? '').trim();
  const expected = String(expectedPid ?? '');
  if (!/^[1-9]\d*$/.test(expected)) throw new Error('TER_A11_REMOTE_PROCESS_IDENTITY_INVALID');
  const actualPid = stat.match(/^([1-9]\d*)\s+\(/)?.[1];
  const endOfComm = stat.lastIndexOf(')');
  const fields =
    endOfComm < 0
      ? []
      : stat
          .slice(endOfComm + 1)
          .trim()
          .split(/\s+/);
  const startTicks = fields[19];
  if (actualPid !== expected || !/^\d+$/.test(startTicks ?? ''))
    throw new Error('TER_A11_REMOTE_PROCESS_IDENTITY_INVALID');
  return startTicks;
}

export function remotePackageCmdlineMatches(value, packageName) {
  if (typeof packageName !== 'string' || packageName.length === 0) return false;
  const processName = String(value ?? '').split('\0', 1)[0];
  return (
    processName === packageName ||
    (processName.startsWith(`${packageName}:`) && processName.length > packageName.length + 1)
  );
}

export function protectedNamespaceObservation(line) {
  const match = String(line ?? '').match(
    /event=persist-kv operation=(read|readMany|write|writeMany|listKeys|clear) mode=protected namespaceVersion=(\d+) existedBeforeOpen=(true|false)(?: legacyNamespacePresent=(true|false))?\b/,
  );
  if (!match) return null;
  return {
    operation: match[1],
    namespaceVersion: Number(match[2]),
    existedBeforeOpen: match[3] === 'true',
    legacyNamespacePresent: match[4] == null ? null : match[4] === 'true',
  };
}

export function protectedNamespaceReadbackFromLines(lines, allowedProcessIds) {
  if (
    !Array.isArray(lines) ||
    !Array.isArray(allowedProcessIds) ||
    allowedProcessIds.length === 0 ||
    allowedProcessIds.some(value => !/^\d{1,10}$/.test(String(value)))
  ) {
    return null;
  }

  let firstOpen = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] ?? '');
    const pid = line.match(/^\s*[VDIWEF]\/TerminalPersistKv\(\s*(\d+)\):/)?.[1];
    const observation = protectedNamespaceObservation(line);
    if (pid && allowedProcessIds.map(String).includes(pid) && observation) {
      firstOpen = {index, pid, observation, line: line.trim().slice(-320)};
      break;
    }
  }
  if (!firstOpen) return {status: 'pending'};

  const {operation, namespaceVersion, existedBeforeOpen, legacyNamespacePresent} = firstOpen.observation;
  const base = {
    pid: firstOpen.pid,
    operation,
    namespaceVersion,
    existedBeforeOpen,
    legacyNamespacePresent,
    preOpenLine: firstOpen.line,
  };
  if (!existedBeforeOpen) return {...base, status: 'missing'};

  for (let index = firstOpen.index + 1; index < lines.length; index += 1) {
    const result = protectedMarkerResult(lines[index], allowedProcessIds);
    if (result?.pid !== firstOpen.pid || result.operation !== operation) continue;
    if (result.status === 'succeeded') return {...base, status: 'confirmed', resultLine: result.line};
    return {...base, status: 'failed', resultLine: result.line};
  }
  return {...base, status: 'pending'};
}

export function classifyObservedDeviceForTest(input) {
  return classifyObservedDevice(input);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const [action, ...args] = process.argv.slice(2);
  if (action !== 'run') {
    process.stderr.write('TER_A11_ACTION_INVALID\n');
    process.exitCode = 2;
  } else
    run(args).catch(error => {
      process.stderr.write(`TER_A11_PRECHANGE_FAILURE=${error?.message ?? 'TER_A11_RUN_FAILED'}\n`);
      process.exitCode = 1;
    });
}
