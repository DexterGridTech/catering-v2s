#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {PNG} from 'pngjs';
import WebSocket from 'ws';
import {
  parseAdbEmulatorInventory,
  parseAvdNameReply,
  parseAvdNames,
  resolveTopologyAvds,
  validateLaptopDisplayShape,
  parseWmDensityDpi,
} from './device-identity.mjs';
import {findImmersiveClingDismissal} from './android-ui-prompts.mjs';
import {createTcpBridge} from './tcp-bridge.mjs';
import {waitForRoleOccupancyProbe} from './role-occupancy-probe.mjs';
import {parsePidofResult, parseProcStatStartTicks} from './process-identity.mjs';
import {submitMemberFormWithClosedKeyboard} from './member-form-submit.mjs';
import {memberJourneyCustomerSurfaceReady, prepareMemberJourneySurface} from './member-journey-admission.mjs';
import {
  evaluateHeartbeatOnlyWindow,
  findUniqueUiNodeById,
  hasExactScopedResourceText,
  readScopedUiEvidence,
  readHeartbeatTopologyFromXml,
  waitForPairedReachableTopology,
  topologyPeerEventsBetweenMarkers,
  topologyLifecycleSnapshot,
} from './heartbeat-window.mjs';
import {
  evaluateCloseOriginAcceptance,
  evaluateMemberJourneyTransferAcceptance,
  parseTopologyPeerLogEvents,
  topologyAcceptanceStatusForProfiles,
  topologyStageOneOutcome,
} from './journey-acceptance.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const topologyConfigPath = path.join(
  repositoryRoot,
  'apps/terminal/kernel/base/contracts/topology-transport.config.json',
);
const topologyTransportConfig = JSON.parse(fs.readFileSync(topologyConfigPath, 'utf8'));
const topologyPort = topologyTransportConfig.port;
// The slave reverse enters a runner-owned TCP bridge. A separate ADB forward
// carries bridge traffic to the master's topology service; removing that
// listener alone does not close already-established TCP sessions.
const hostBridgePort = 43174;
const topologyUpstreamPort = 43175;
// The direct-pair red mutation uses the device loopback.  The runner must
// suspend its own reverse first: Android routes loopback aliases through the
// reverse endpoint too, which would otherwise turn a supposed failure into a
// real master pairing.  A TEST-NET address is avoided because its connect
// timeout is longer than the runtime's bounded command window.
const directPairFailureHost = '127.0.0.1';
const topologyBasePath = topologyTransportConfig.basePath;
// Android's shell-side `uiautomator dump` creates a fresh UiAutomation
// connection for each invocation.  The stage-one emulator evidence shows
// that starting the next dump immediately after a UI action can race the
// previous connection's release (`could not get idle state` / duplicate
// registration), even though the React screen is already visible.  These
// are observer-boundary delays, not application readiness claims: they are
// only used after an input action or an observed dump failure.
const uiActionSettleDelayMs = 1_500;
const uiObservationRecoveryDelayMs = 4_000;
const uiObservationMinIntervalMs = 250;
const uiObserverRequestTimeoutMs = 8_000;
// The runner owns a host-side ADB forward to the master emulator and a
// separate reverse on the slave emulator. The slave addresses that bridge as
// loopback, keeping both app runtimes on real device/process boundaries
// without depending on emulator-internal peer routing.
const hostAliasForAndroidEmulator = '127.0.0.1';

const profiles = Object.freeze({
  'sample-terminal': Object.freeze({
    name: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal',
    activity: 'com.anonymous.sampleterminal/.MainActivity',
    apk: path.join(
      repositoryRoot,
      'apps/terminal/application/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk',
    ),
    memberJourney: false,
  }),
  'sample-wallpaper-terminal': Object.freeze({
    name: 'sample-wallpaper-terminal',
    packageName: 'com.catering.v2s.terminal.samplewallpaper',
    activity: 'com.catering.v2s.terminal.samplewallpaper/.MainActivity',
    apk: path.join(
      repositoryRoot,
      'apps/terminal/application/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk',
    ),
    memberJourney: false,
  }),
});

const parseArgs = () => {
  const values = new Map();
  for (let index = 2; index < process.argv.length; index += 1) {
    const value = process.argv[index];
    if (value === '--master-avd-name') values.set('masterAvdName', process.argv[++index]);
    else if (value === '--slave-avd-name') values.set('slaveAvdName', process.argv[++index]);
    else if (value === '--app') values.set('app', process.argv[++index]);
    else if (value === '--stage') values.set('stage', process.argv[++index]);
    else if (value === '--serial') values.set('serial', process.argv[++index]);
    else if (value === '--shape') values.set('shape', process.argv[++index]);
    else if (value === '--output') values.set('output', process.argv[++index]);
    else if (value === '--include-member-journey') values.set('includeMemberJourney', true);
    else throw new Error(`unknown argument: ${value}`);
  }
  return values;
};

const cli = parseArgs();
const stage = cli.get('stage') ?? '1';
const appSelection = cli.get('app') ?? 'sample-terminal';
const masterAvdName = cli.get('masterAvdName');
const slaveAvdName = cli.get('slaveAvdName');
const stage2Serial = cli.get('serial');
const stage2Shape = cli.get('shape') ?? 'dual';
const includeMemberJourney = cli.get('includeMemberJourney') === true;
const selectedProfiles = appSelection === 'all' ? Object.values(profiles) : [profiles[appSelection]];

if (!['1', '2'].includes(stage)) throw new Error(`invalid stage: ${stage}`);
if (stage === '2' && !['dual', 'mobile'].includes(stage2Shape))
  throw new Error(`invalid stage 2 shape: ${stage2Shape}`);
if (stage === '1' && (typeof masterAvdName !== 'string' || typeof slaveAvdName !== 'string')) {
  throw new Error('stage 1 requires current --master-avd-name and --slave-avd-name inputs');
}
if (stage === '2' && (typeof stage2Serial !== 'string' || stage2Serial.trim() === '')) {
  throw new Error('stage 2 requires an explicitly discovered --serial input');
}
if (includeMemberJourney && (stage !== '1' || !selectedProfiles.some(profile => profile?.name === 'sample-terminal'))) {
  throw new Error('--include-member-journey requires stage 1 with sample-terminal selected');
}
if (selectedProfiles.some(profile => profile === undefined)) throw new Error(`invalid app selection: ${appSelection}`);
if (typeof cli.get('output') !== 'string' || cli.get('output').trim() === '') {
  throw new Error('an explicit run-scoped --output path is required');
}

const timestamp = new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, 'Z');
const outputDirectory = path.resolve(repositoryRoot, cli.get('output'));
const topologyEvidenceRoot = path.join(repositoryRoot, '.runtime/ter-third-party-usage-remediation') + path.sep;
if (!outputDirectory.startsWith(topologyEvidenceRoot)) {
  throw new Error('topology output must be inside .runtime/ter-third-party-usage-remediation/<runId>/topology');
}

fs.mkdirSync(outputDirectory, {recursive: true});

const sanitizeDiagnostic = value =>
  `${value ?? ''}`
    .replace(/(text="（)\d{6}(）")/g, '$1[REDACTED]$2')
    .replace(/(debug-password[^>]*text=")[^"]*(")/gi, '$1[REDACTED]$2')
    .replace(
      /((?:password|passwd|token|cookie|authorization|otp|phone|username|login)\s*[:=]\s*)[^\s,;]+/gi,
      '$1[REDACTED]',
    )
    .replace(
      /((?:password|passwd|token|cookie|authorization|otp|phone|username|login)"\s*:\s*")[^"]*(")/gi,
      '$1[REDACTED]$2',
    )
    .replace(/\b\d{10,11}\b/g, '[PHONE_REDACTED]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_REDACTED]')
    .replace(/10\.0\.2\.2/g, '[HOST_REDACTED]');

const inspectExpectedUi = (xml, expectedIds = [], expectedTexts = [], scopeId = null) =>
  readScopedUiEvidence(xml, expectedIds, expectedTexts, sanitizeDiagnostic, scopeId);

const expectedUiMatches = (xml, expectedIds = [], expectedTexts = [], scopeId = null) => {
  const evidence = inspectExpectedUi(xml, expectedIds, expectedTexts, scopeId);
  return (
    evidence.hierarchyValid &&
    evidence.scopeValid &&
    evidence.missingIds.length === 0 &&
    evidence.ambiguousIds.length === 0 &&
    evidence.missingTexts.length === 0
  );
};

const byteLength = value => (Buffer.isBuffer(value) ? value.length : Buffer.byteLength(value ?? ''));

let commandSequence = 0;
const appendCommandLog = entry => {
  const sequence = String(commandSequence++).padStart(5, '0');
  const stderrText = Buffer.isBuffer(entry.stderr) ? entry.stderr.toString('utf8') : `${entry.stderr ?? ''}`;
  const stderrPath =
    stderrText.length === 0 ? null : path.join(currentOutputDirectory, `command-stderr-${sequence}.txt`);
  if (stderrPath !== null) fs.writeFileSync(stderrPath, `${sanitizeDiagnostic(stderrText).slice(0, 16_384)}\n`);
  fs.appendFileSync(
    path.join(currentOutputDirectory, 'command-actions.jsonl'),
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry,
      stderr: undefined,
      stderrPath: stderrPath === null ? null : path.relative(repositoryRoot, stderrPath),
      logPath: path.relative(repositoryRoot, path.join(currentOutputDirectory, 'command-actions.jsonl')),
    })}\n`,
  );
};

class RunnerFailure extends Error {
  constructor(label, detail) {
    super(`${label}: ${detail}`);
    this.name = 'RunnerFailure';
    this.label = label;
  }
}

const failureBoundaryOf = (error, lastKnownGood) =>
  error instanceof RunnerFailure ? error.label : (lastKnownGood ?? 'before-first-known-good');

const run = (command, commandArgs, options = {}) => {
  const startedAt = Date.now();
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: options.binary === true ? undefined : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout ?? 15_000,
  });
  const stdout = result.stdout ?? (options.binary === true ? Buffer.alloc(0) : '');
  const stderr = result.stderr ?? (options.binary === true ? Buffer.alloc(0) : '');
  const status = result.status ?? -1;
  const failed = result.error !== undefined || status !== 0;
  appendCommandLog({
    phase: options.phase ?? 'local-observation',
    deviceRole: options.deviceRole ?? null,
    label: options.label ?? command,
    command,
    argumentCount: commandArgs.length,
    status,
    result: failed ? 'failed' : 'passed',
    timedOut: result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM',
    stdoutBytes: byteLength(stdout),
    stderrBytes: byteLength(stderr),
    durationMs: Date.now() - startedAt,
    stderr,
  });
  if (failed && options.allowFailure !== true) {
    const detail = sanitizeDiagnostic(`${result.error?.message ?? ''}\n${stderr || stdout}`)
      .trim()
      .slice(0, 4_000);
    throw new RunnerFailure(options.label ?? command, detail || `exit ${status}`);
  }
  return {status, stdout, stderr, error: result.error};
};

const textOf = result => `${result.stdout ?? ''}${result.stderr ?? ''}`.replace(/\r/g, '');
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const writeText = (name, value) => fs.writeFileSync(path.join(currentOutputDirectory, name), `${value ?? ''}`);
const writeBinary = (name, value) => fs.writeFileSync(path.join(currentOutputDirectory, name), value);
const writeJson = (name, value) => writeText(name, `${JSON.stringify(value, null, 2)}\n`);

const deviceTag = role => (role === 'master' || role === 'slave' ? role : role);
const device = (role, serial, profile, avdName = null) => ({
  role,
  serial,
  avdName,
  tag: deviceTag(role),
  profile,
  displayWidth: null,
  displayHeight: null,
  secondaryDisplayId: null,
  surfaceDisplayIds: new Map(),
  remoteUiPath: `/sdcard/ter-topology-${process.pid}-${role}.xml`,
  remoteWindowsUiPath: `/sdcard/ter-topology-windows-${process.pid}-${role}.xml`,
  lastWindowsXml: '',
  lastUiXml: '',
  lastDisplayUiXml: new Map(),
  lastWindowsByDisplay: new Map(),
  uiSequence: 0,
  remoteUiCreated: false,
  lastUiActionAt: 0,
  nextUiObservationAt: 0,
  uiObserver: null,
  uiObserverDexPushed: false,
  remoteUiObserverDexPath: `/data/local/tmp/ter-no-idle-ui-${process.pid}-${profile.name}-${role}.dex`,
  uiRotation: 0,
  portOccupantProcess: null,
  systemPromptDismissals: [],
});

const adb = (target, commandArgs, label, options = {}) =>
  run('adb', ['-s', target.serial, ...commandArgs], {
    ...options,
    label,
    deviceRole: target.role,
    phase: options.phase ?? 'device-observation',
  });

const localRun = (command, commandArgs, label, options = {}) =>
  run(command, commandArgs, {...options, label, phase: options.phase ?? 'local-observation'});

const discoverTopologyAvds = () => {
  const avdResult = localRun('emulator', ['-list-avds'], 'current AVD inventory');
  const adbResult = localRun('adb', ['devices', '-l'], 'current ADB emulator inventory');
  const availableAvdNames = parseAvdNames(textOf(avdResult));
  const adbEmulators = parseAdbEmulatorInventory(textOf(adbResult));
  const activeAvds = adbEmulators
    .filter(item => item.state === 'device')
    .map(({serial}) => ({
      serial,
      avdName: parseAvdNameReply(
        textOf(localRun('adb', ['-s', serial, 'emu', 'avd', 'name'], `resolve current AVD for ${serial}`)),
      ),
    }));
  writeText('current-avd-inventory.txt', textOf(avdResult));
  writeText('current-adb-emulator-inventory.txt', textOf(adbResult));
  writeJson('current-avd-serial-map.json', {availableAvdNames, adbEmulators, activeAvds});
  return resolveTopologyAvds({
    masterAvdName,
    slaveAvdName,
    availableAvdNames,
    adbEmulators,
    activeAvds,
  });
};

const terminalSourceSnapshot = () => {
  const excludedDirectories = new Set([
    '.expo',
    '.gradle',
    '.runtime',
    '.yarn',
    'build',
    'coverage',
    'dist',
    'node_modules',
  ]);
  const files = [];
  const visit = (directory, prefix) => {
    for (const entry of fs
      .readdirSync(directory, {withFileTypes: true})
      .sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.isSymbolicLink()) continue;
      const relativePath = path.posix.join(prefix, entry.name);
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!excludedDirectories.has(entry.name)) visit(absolutePath, relativePath);
      } else if (entry.isFile()) {
        files.push({absolutePath, relativePath});
      }
    }
  };
  visit(path.join(repositoryRoot, 'apps/terminal'), 'apps/terminal');
  files.push(
    ...[
      'tools/terminal-topology/android-ui-prompts.mjs',
      'tools/terminal-topology/device-identity.mjs',
      'tools/terminal-topology/heartbeat-window.mjs',
      'tools/terminal-topology/member-journey-admission.mjs',
      'tools/terminal-topology/member-form-submit.mjs',
      'tools/terminal-topology/process-identity.mjs',
      'tools/terminal-topology/role-occupancy-probe.mjs',
      'tools/terminal-topology/journey-acceptance.mjs',
      'tools/terminal-topology/run-dual-device.mjs',
      'tools/terminal-topology/tcp-bridge.mjs',
      'tools/terminal-topology/android/NoIdleUiDump.java',
    ].map(relativePath => ({absolutePath: path.join(repositoryRoot, relativePath), relativePath})),
  );
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file.relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(file.absolutePath));
    hash.update('\0');
  }
  return {sha256: hash.digest('hex'), fileCount: files.length};
};

const hostProcessIdentity = () => {
  const startToken = textOf(
    localRun('ps', ['-o', 'lstart=', '-p', String(process.pid)], 'runner process start token'),
  ).trim();
  const rssText = textOf(localRun('ps', ['-o', 'rss=', '-p', String(process.pid)], 'runner process RSS')).trim();
  const rssKiB = Number(rssText);
  if (startToken === '' || !Number.isFinite(rssKiB) || rssKiB <= 0) {
    throw new RunnerFailure('runner process identity', 'PID start token or RSS readback is unavailable');
  }
  return {pid: process.pid, startToken, rssKiB};
};

const numericVersion = value => value.split('.').map(part => Number(part) || 0);
const compareVersions = (left, right) => {
  const leftParts = numericVersion(left);
  const rightParts = numericVersion(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
};

const highestVersionDirectory = (root, predicate) =>
  fs
    .readdirSync(root, {withFileTypes: true})
    .filter(entry => entry.isDirectory() && predicate(entry.name))
    .map(entry => entry.name)
    .sort((left, right) => compareVersions(right.replace(/^[^0-9]+/, ''), left.replace(/^[^0-9]+/, '')))[0] ?? null;

const buildUiObserverDex = () => {
  const androidSdkRoot = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? null;
  if (androidSdkRoot === null)
    throw new RunnerFailure('no-idle UI observer build', 'ANDROID_HOME or ANDROID_SDK_ROOT is not set');
  const platformsRoot = path.join(androidSdkRoot, 'platforms');
  const buildToolsRoot = path.join(androidSdkRoot, 'build-tools');
  const platformName = highestVersionDirectory(platformsRoot, name => /^android-\d+$/.test(name));
  const buildToolsName = highestVersionDirectory(
    buildToolsRoot,
    name => /^\d+\.\d+\.\d+$/.test(name) && fs.existsSync(path.join(buildToolsRoot, name, 'd8')),
  );
  if (platformName === null || buildToolsName === null) {
    throw new RunnerFailure(
      'no-idle UI observer build',
      'no stable Android platform/android build-tools with d8 was found',
    );
  }
  const androidJar = path.join(platformsRoot, platformName, 'android.jar');
  const d8 = path.join(buildToolsRoot, buildToolsName, 'd8');
  const source = path.join(repositoryRoot, 'tools/terminal-topology/android/NoIdleUiDump.java');
  const buildRoot = path.join(outputDirectory, 'no-idle-ui-observer-build');
  const classesRoot = path.join(buildRoot, 'classes');
  const dexRoot = path.join(buildRoot, 'dex');
  fs.mkdirSync(classesRoot, {recursive: true});
  fs.mkdirSync(dexRoot, {recursive: true});
  localRun(
    'javac',
    ['-source', '8', '-target', '8', '-classpath', androidJar, '-d', classesRoot, source],
    'compile no-idle UI observer',
    {timeout: 30_000},
  );
  localRun(
    d8,
    ['--lib', androidJar, '--output', dexRoot, path.join(classesRoot, 'NoIdleUiDump.class')],
    'dex no-idle UI observer',
    {timeout: 30_000},
  );
  const dexPath = path.join(dexRoot, 'classes.dex');
  if (!fs.existsSync(dexPath)) throw new RunnerFailure('no-idle UI observer build', 'd8 did not produce classes.dex');
  writeJson('no-idle-ui-observer-build.json', {
    source: path.relative(repositoryRoot, source),
    androidJar: path.relative(androidSdkRoot, androidJar),
    buildTools: buildToolsName,
    dexPath: path.relative(repositoryRoot, dexPath),
  });
  return dexPath;
};

class PersistentUiObserver {
  constructor(target, dexPath) {
    this.target = target;
    this.dexPath = dexPath;
    this.child = null;
    this.stdoutBuffer = '';
    this.stderrBuffer = '';
    this.pending = null;
    this.closed = false;
    this.exitCode = null;
  }

  start() {
    if (this.child !== null) throw new RunnerFailure(`${this.target.tag} UI observer`, 'observer already started');
    this.child = spawn(
      'adb',
      [
        '-s',
        this.target.serial,
        'shell',
        `CLASSPATH=${this.target.remoteUiObserverDexPath}:/system/framework/uiautomator.jar`,
        'app_process',
        '/system/bin',
        'NoIdleUiDump',
        '--server',
      ],
      {cwd: repositoryRoot, stdio: ['pipe', 'pipe', 'pipe']},
    );
    this.child.stdout.on('data', chunk => this.onStdout(chunk));
    this.child.stderr.on('data', chunk => {
      this.stderrBuffer += chunk.toString('utf8');
    });
    this.child.on('error', error => this.onClosed(null, error));
    this.child.on('close', (code, signal) =>
      this.onClosed(code, signal === null ? null : new Error(`signal ${signal}`)),
    );
    appendCommandLog({
      phase: 'device-observation',
      deviceRole: this.target.role,
      label: 'start persistent no-idle UI observer',
      command: 'adb shell app_process NoIdleUiDump --server',
      argumentCount: 0,
      status: 0,
      result: 'started',
      stdoutBytes: 0,
      stderrBytes: 0,
      stderr: '',
    });
  }

  onStdout(chunk) {
    this.stdoutBuffer += chunk.toString('utf8');
    while (this.stdoutBuffer.includes('\n')) {
      const newlineIndex = this.stdoutBuffer.indexOf('\n');
      const line = this.stdoutBuffer.slice(0, newlineIndex).replace(/\r$/, '');
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      if (line.length === 0) continue;
      if (this.pending === null) continue;
      const pending = this.pending;
      this.pending = null;
      clearTimeout(pending.timer);
      const ok = line === 'NO_IDLE_UI_DUMP_OK';
      const result = {ok, response: line, stderr: this.stderrBuffer};
      appendCommandLog({
        phase: 'device-observation',
        deviceRole: this.target.role,
        label: 'persistent no-idle UI observer request',
        command: 'NoIdleUiDump --server',
        argumentCount: 2,
        status: ok ? 0 : 1,
        result: ok ? 'passed' : 'failed',
        stdoutBytes: Buffer.byteLength(line),
        stderrBytes: Buffer.byteLength(this.stderrBuffer),
        stderr: this.stderrBuffer,
      });
      this.stderrBuffer = '';
      pending.resolve(result);
    }
  }

  onClosed(code, error) {
    if (this.closed) return;
    this.closed = true;
    this.exitCode = code;
    const detail = error?.message ?? `exit ${code}`;
    if (this.pending !== null) {
      const pending = this.pending;
      this.pending = null;
      clearTimeout(pending.timer);
      pending.reject(new RunnerFailure(`${this.target.tag} UI observer`, detail));
    }
  }

  dump(remotePath, rotation) {
    if (this.child === null || this.closed || this.child.stdin.destroyed) {
      return Promise.reject(new RunnerFailure(`${this.target.tag} UI observer`, 'observer is not running'));
    }
    if (this.pending !== null) {
      return Promise.reject(new RunnerFailure(`${this.target.tag} UI observer`, 'concurrent observer request'));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        reject(
          new RunnerFailure(`${this.target.tag} UI observer`, `request timeout after ${uiObserverRequestTimeoutMs}ms`),
        );
      }, uiObserverRequestTimeoutMs);
      this.pending = {resolve, reject, timer};
      try {
        this.child.stdin.write(`${remotePath}\t${rotation}\n`);
      } catch (error) {
        clearTimeout(timer);
        this.pending = null;
        reject(error);
      }
    });
  }

  async stop() {
    if (this.child === null || this.closed) return true;
    const child = this.child;
    const closed = new Promise(resolve => child.once('close', () => resolve(true)));
    child.stdin.end();
    const stopped = await Promise.race([closed, sleep(3_000).then(() => false)]);
    if (!stopped && !this.closed) child.kill('SIGTERM');
    appendCommandLog({
      phase: 'cleanup',
      deviceRole: this.target.role,
      label: 'stop persistent no-idle UI observer',
      command: 'adb shell app_process NoIdleUiDump --server',
      argumentCount: 0,
      status: stopped ? 0 : 1,
      result: stopped ? 'passed' : 'failed',
      stdoutBytes: 0,
      stderrBytes: Buffer.byteLength(this.stderrBuffer),
      stderr: this.stderrBuffer,
    });
    this.closed = stopped || this.closed;
    return stopped;
  }
}

const installUiObserver = async (target, dexPath) => {
  adb(target, ['push', dexPath, target.remoteUiObserverDexPath], 'upload no-idle UI observer');
  target.uiObserverDexPushed = true;
  target.uiObserver = new PersistentUiObserver(target, dexPath);
  target.uiObserver.start();
};

const processIdentity = target => {
  const pidResult = adb(target, ['shell', 'pidof', target.profile.packageName], 'package PID readback', {
    allowFailure: true,
  });
  let deviceStateResult = null;
  if (
    pidResult.status === 1 &&
    pidResult.error == null &&
    textOf(pidResult.stdout).trim().length === 0 &&
    textOf(pidResult.stderr).trim().length === 0
  ) {
    deviceStateResult = adb(target, ['get-state'], 'verify connected device for empty package PID readback', {
      allowFailure: true,
    });
  }
  let pids;
  try {
    pids = parsePidofResult(pidResult, deviceStateResult);
  } catch (error) {
    throw new RunnerFailure(
      'package PID readback',
      sanitizeDiagnostic(error instanceof Error ? error.message : String(error)),
    );
  }
  if (pids.length === 0) return {pid: null, startTicks: null, pids};
  const pid = pids[0];
  const statResult = adb(target, ['shell', 'cat', `/proc/${pid}/stat`], 'package process start token', {
    allowFailure: true,
  });
  if (statResult.status !== 0 || statResult.error != null) {
    throw new RunnerFailure(
      'package process start token',
      sanitizeDiagnostic(textOf(statResult) || `exit=${statResult.status}`),
    );
  }
  try {
    return {pid, startTicks: parseProcStatStartTicks(statResult.stdout, pid), pids};
  } catch (error) {
    throw new RunnerFailure(
      'package process start token',
      sanitizeDiagnostic(error instanceof Error ? error.message : String(error)),
    );
  }
};

const readCleanupProcessIdentity = (target, errors) => {
  try {
    const process = processIdentity(target);
    return process;
  } catch (error) {
    errors.push(
      `${target.tag} package process readback failed: ${sanitizeDiagnostic(
        error instanceof Error ? error.message : String(error),
      )}`,
    );
    return {pid: null, startTicks: null, pids: null, readback: 'FAILED'};
  }
};

const bootId = target =>
  textOf(adb(target, ['shell', 'cat', '/proc/sys/kernel/random/boot_id'], 'device boot identity')).trim();

const localApkBinding = profile => {
  if (!fs.existsSync(profile.apk)) return {path: path.relative(repositoryRoot, profile.apk), exists: false};
  const bytes = fs.readFileSync(profile.apk);
  return {
    path: path.relative(repositoryRoot, profile.apk),
    exists: true,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
};

const installedApkBinding = target => {
  const pathResult = adb(target, ['shell', 'pm', 'path', target.profile.packageName], 'installed APK path', {
    allowFailure: true,
  });
  const paths = [...textOf(pathResult).matchAll(/^package:(\S+)$/gm)].map(match => match[1]);
  if (paths.length !== 1)
    throw new RunnerFailure(`${target.tag} APK binding`, `expected one base APK, observed ${paths.length}`);
  const installedPath = paths[0];
  const digestResult = adb(target, ['shell', 'sha256sum', installedPath], 'installed APK sha256', {allowFailure: true});
  const sha256 =
    textOf(digestResult)
      .match(/\b([a-f0-9]{64})\b/i)?.[1]
      ?.toLowerCase() ?? null;
  const sizeResult = adb(target, ['shell', 'stat', '-c', '%s', installedPath], 'installed APK size', {
    allowFailure: true,
  });
  const sizeText = textOf(sizeResult).trim().split(/\s+/).at(-1) ?? '';
  const bytes = /^\d+$/.test(sizeText) ? Number(sizeText) : null;
  if (sha256 === null || bytes === null)
    throw new RunnerFailure(`${target.tag} APK binding`, `incomplete binding for ${installedPath}`);
  return {paths, path: installedPath, bytes, sha256};
};

const assertApkBinding = (local, installed, label) => {
  if (!local.exists) throw new RunnerFailure(label, `release APK missing: ${local.path}`);
  if (installed.bytes !== local.bytes || installed.sha256 !== local.sha256) {
    throw new RunnerFailure(label, 'installed APK does not match the recorded release APK');
  }
};

const displayFragment = (windowsXml, displayId) => {
  const opening = new RegExp(`<display id=["']${displayId}["']>`).exec(windowsXml);
  if (opening === null) return null;
  const closing = windowsXml.indexOf('</display>', opening.index + opening[0].length);
  return closing < 0 ? null : windowsXml.slice(opening.index, closing + '</display>'.length);
};

const logicalDisplays = commandText =>
  commandText
    .split('\n')
    .filter(line => /^\s*Display id \d+:/.test(line))
    .map(line => ({
      id: Number(line.match(/Display id (\d+):/)?.[1]),
      width: Number(line.match(/real (\d+) x (\d+)/)?.[1] ?? 0),
      height: Number(line.match(/real (\d+) x (\d+)/)?.[2] ?? 0),
      uniqueId: line.match(/uniqueId "([^"]+)"/)?.[1] ?? null,
      flags: [...line.matchAll(/FLAG_[A-Z_]+/g)].map(match => match[0]),
    }));

const captureDeviceShape = target => {
  const state = textOf(adb(target, ['get-state'], 'device state'));
  if (state.trim() !== 'device')
    throw new RunnerFailure(`${target.tag} device state`, `unexpected state ${state.trim()}`);
  const currentAvdName = parseAvdNameReply(
    textOf(localRun('adb', ['-s', target.serial, 'emu', 'avd', 'name'], `${target.tag} current AVD identity readback`)),
  );
  if (currentAvdName !== target.avdName) {
    throw new RunnerFailure(`${target.tag} AVD identity`, `expected ${target.avdName}, observed ${currentAvdName}`);
  }
  const displaysResult = adb(target, ['shell', 'cmd', 'display', 'get-displays'], 'logical display inventory');
  const displayDump = adb(target, ['shell', 'dumpsys', 'display'], 'display manager inventory');
  const surfaces = adb(target, ['shell', 'dumpsys', 'SurfaceFlinger', '--displays'], 'SurfaceFlinger inventory');
  const size = textOf(adb(target, ['shell', 'wm', 'size'], 'window size'));
  const density = textOf(adb(target, ['shell', 'wm', 'density'], 'window density'));
  const displays = logicalDisplays(textOf(displaysResult));
  const surfaceText = textOf(surfaces);
  const virtualCount = (surfaceText.match(/^Virtual Display /gm) ?? []).length;
  let densityDpi;
  let laptopShape;
  try {
    densityDpi = parseWmDensityDpi(density);
    laptopShape = validateLaptopDisplayShape({displays, virtualDisplayCount: virtualCount, densityDpi});
  } catch (error) {
    throw new RunnerFailure(`${target.tag} stage-one shape`, error instanceof Error ? error.message : String(error));
  }
  target.displayWidth = displays[0].width;
  target.displayHeight = displays[0].height;
  writeText(`${target.tag}-shape-get-displays.txt`, textOf(displaysResult));
  writeText(`${target.tag}-shape-dumpsys-display.txt`, textOf(displayDump));
  writeText(`${target.tag}-shape-dumpsys-surfaceflinger.txt`, surfaceText);
  writeText(`${target.tag}-shape-wm-size.txt`, size);
  writeText(`${target.tag}-shape-wm-density.txt`, density);
  return {
    avdName: target.avdName,
    serial: target.serial,
    bootId: bootId(target),
    sdk: textOf(adb(target, ['shell', 'getprop', 'ro.build.version.sdk'], 'Android SDK readback')).trim(),
    displays,
    virtualDisplayCount: virtualCount,
    wmSize: size.trim(),
    wmDensity: density.trim(),
    densityDpi,
    shortestEdgeDp: laptopShape.shortestEdgeDp,
    preexistingProcess: processIdentity(target),
  };
};

const captureStage2Shape = (target, expectedShape) => {
  const state = textOf(adb(target, ['get-state'], 'stage-two device state'));
  if (state.trim() !== 'device')
    throw new RunnerFailure(`${target.tag} device state`, `unexpected state ${state.trim()}`);
  const displaysResult = adb(
    target,
    ['shell', 'cmd', 'display', 'get-displays'],
    'stage-two logical display inventory',
  );
  const displayDump = adb(target, ['shell', 'dumpsys', 'display'], 'stage-two display manager inventory');
  const surfaces = adb(
    target,
    ['shell', 'dumpsys', 'SurfaceFlinger', '--displays'],
    'stage-two SurfaceFlinger inventory',
  );
  const size = textOf(adb(target, ['shell', 'wm', 'size'], 'stage-two window size'));
  const density = textOf(adb(target, ['shell', 'wm', 'density'], 'stage-two window density'));
  const displays = logicalDisplays(textOf(displaysResult));
  const surfaceText = textOf(surfaces);
  const virtualCount = (surfaceText.match(/^Virtual Display /gm) ?? []).length;
  const primarySurfaceId = surfaceText.match(/^Display (\S+)/m)?.[1] ?? null;
  const secondarySurfaceId = surfaceText.match(/^Virtual Display (\S+)/m)?.[1] ?? null;
  const primary = displays.find(display => display.id === 0) ?? null;
  const secondary = displays.find(display => display.id !== 0) ?? null;
  if (primary === null || primary.width <= 0 || primary.height <= 0) {
    throw new RunnerFailure(
      `${target.tag} stage-two shape`,
      `primary logical display is incomplete: ${displays.length} display(s)`,
    );
  }
  if (expectedShape === 'dual' && (secondary === null || secondary.width <= 0 || secondary.height <= 0)) {
    throw new RunnerFailure(
      `${target.tag} stage-two dual shape`,
      `expected a secondary logical display, observed ${displays.length}`,
    );
  }
  if (expectedShape === 'dual' && displays.length !== 2) {
    throw new RunnerFailure(
      `${target.tag} stage-two dual shape`,
      `expected exactly two logical displays, observed ${displays.length}`,
    );
  }
  if (expectedShape === 'mobile' && displays.length !== 1) {
    throw new RunnerFailure(
      `${target.tag} stage-two mobile shape`,
      `expected exactly one logical display, observed ${displays.length}`,
    );
  }
  if (primarySurfaceId === null)
    throw new RunnerFailure(`${target.tag} stage-two shape`, 'SurfaceFlinger primary display id is missing');
  if (expectedShape === 'dual' && secondarySurfaceId === null)
    throw new RunnerFailure(`${target.tag} stage-two dual shape`, 'SurfaceFlinger virtual display id is missing');
  target.displayWidth = primary.width;
  target.displayHeight = primary.height;
  target.secondaryDisplayId = secondary?.id ?? null;
  target.surfaceDisplayIds.set(0, primarySurfaceId);
  if (secondary !== null && secondarySurfaceId !== null) target.surfaceDisplayIds.set(secondary.id, secondarySurfaceId);
  writeText(`${target.tag}-stage2-shape-get-displays.txt`, textOf(displaysResult));
  writeText(`${target.tag}-stage2-shape-dumpsys-display.txt`, textOf(displayDump));
  writeText(`${target.tag}-stage2-shape-dumpsys-surfaceflinger.txt`, surfaceText);
  writeText(`${target.tag}-stage2-shape-wm-size.txt`, size);
  writeText(`${target.tag}-stage2-shape-wm-density.txt`, density);
  return {
    expectedShape,
    bootId: bootId(target),
    sdk: textOf(adb(target, ['shell', 'getprop', 'ro.build.version.sdk'], 'stage-two Android SDK readback')).trim(),
    displays,
    surfaceDisplayIds: Object.fromEntries(target.surfaceDisplayIds),
    virtualDisplayCount: virtualCount,
    wmSize: size.trim(),
    wmDensity: density.trim(),
    preexistingProcess: processIdentity(target),
  };
};

const nodeForId = findUniqueUiNodeById;

const nodeText = node => node?.text ?? '';

const readUi = async (target, label) => {
  target.remoteUiCreated = true;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actionReadyAt = (target.lastUiActionAt ?? 0) + (target.lastUiActionSettleDelayMs ?? uiActionSettleDelayMs);
    const observationReadyAt = Math.max(actionReadyAt, target.nextUiObservationAt ?? 0);
    const waitMs = observationReadyAt - Date.now();
    if (waitMs > 0) await sleep(waitMs);
    // The stock `uiautomator dump` form reads the current hierarchy for the
    // focused application but first waits for the whole device to become idle.
    // React surface transitions can keep that global idle condition false even
    // after the requested screen is visible. The persistent helper retains the
    // same shell-side UiAutomation boundary and reads the active root without
    // creating a new observer connection for every poll. Keep the parser
    // compatible with a window-wrapped response for images that provide one.
    // Never read a previous successful dump after a failed refresh.  `adb`
    // can itself exit successfully while the shell-side uiautomator reports
    // `could not get idle state`; without removing the target first that
    // failure would leave a stale hierarchy that looks like valid business
    // state.
    adb(target, ['shell', 'rm', '-f', target.remoteUiPath], `${label} stale UI dump removal`, {allowFailure: true});
    // The explicit action/recovery slots above remain intentional: after a
    // ReactHost transition the focused root can still be temporarily null.
    // That is a bounded observation retry, not a readiness claim.
    const dump =
      target.uiObserver === null
        ? {status: 1, stdout: '', stderr: 'persistent no-idle UI observer is not installed'}
        : await target.uiObserver.dump(target.remoteUiPath, target.uiRotation);
    const xmlResult = adb(target, ['exec-out', 'cat', target.remoteUiPath], `${label} UI readback`, {
      allowFailure: true,
    });
    const windowsXml = textOf(xmlResult);
    const fragment = displayFragment(windowsXml, 0);
    const plainHierarchy = windowsXml.startsWith('<?xml') && windowsXml.includes('<hierarchy');
    const dumpStdout = `${dump.response ?? ''}`;
    const dumpFailed = dump.ok !== true || /(?:^|\n)\s*(?:ERROR|Exception):/i.test(dumpStdout);
    if (!dumpFailed && plainHierarchy) {
      const immersiveCling = findImmersiveClingDismissal(windowsXml);
      if (immersiveCling !== null) {
        const occurrence = target.systemPromptDismissals.length + 1;
        writeText(`${target.tag}-android-immersive-cling-${occurrence}-before.xml`, sanitizeDiagnostic(windowsXml));
        adb(
          target,
          ['shell', 'input', 'tap', String(immersiveCling.x), String(immersiveCling.y)],
          'ack exact Android immersive full-screen prompt',
        );
        const dismissedAt = new Date().toISOString();
        target.systemPromptDismissals.push({
          kind: 'android-immersive-full-screen-cling',
          resourceId: 'android:id/ok',
          timestamp: dismissedAt,
        });
        target.lastUiActionAt = Date.now();
        target.lastUiActionSettleDelayMs = uiActionSettleDelayMs;
        target.nextUiObservationAt = Math.max(
          target.nextUiObservationAt ?? 0,
          target.lastUiActionAt + uiActionSettleDelayMs,
        );
        continue;
      }
      target.lastWindowsXml = windowsXml;
      target.lastUiXml = fragment ?? windowsXml;
      target.lastUiActionAt = 0;
      target.nextUiObservationAt = Date.now() + uiObservationMinIntervalMs;
      return target.lastUiXml;
    }
    target.nextUiObservationAt = Date.now() + uiObservationRecoveryDelayMs;
  }
  throw new RunnerFailure(`${target.tag} ${label} UI`, 'UI dump/readback did not return display 0 XML');
};

// Stage two needs the whole multi-display window tree. The persistent helper
// intentionally remains a display-0 observer; using the stock --windows dump
// here is the Android-supported way to select a Presentation display and keeps
// display 2 evidence tied to the real device rather than a test abstraction.
const readStage2Ui = async (target, displayId, label) => {
  target.remoteUiCreated = true;
  target.stage2UiCreated = true;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    adb(target, ['shell', 'rm', '-f', target.remoteWindowsUiPath], `${label} stale windows dump removal`, {
      allowFailure: true,
    });
    const dump = adb(
      target,
      ['shell', 'uiautomator', 'dump', '--windows', target.remoteWindowsUiPath],
      `${label} windows UI dump`,
      {allowFailure: true},
    );
    const xmlResult = adb(target, ['exec-out', 'cat', target.remoteWindowsUiPath], `${label} windows UI readback`, {
      allowFailure: true,
    });
    const windowsXml = textOf(xmlResult);
    const fragment = displayFragment(windowsXml, displayId);
    const plainHierarchy = displayId === 0 && windowsXml.startsWith('<?xml') && windowsXml.includes('<hierarchy');
    const xml = fragment ?? (plainHierarchy ? windowsXml : null);
    if (dump.status === 0 && windowsXml.startsWith('<?xml') && xml !== null && xml.includes('<hierarchy')) {
      target.lastWindowsByDisplay.set(displayId, windowsXml);
      target.lastDisplayUiXml.set(displayId, xml);
      target.lastUiActionAt = 0;
      return xml;
    }
    await sleep(500);
  }
  throw new RunnerFailure(
    `${target.tag} ${label} display ${displayId} UI`,
    'windows UI dump/readback did not return a fresh hierarchy',
  );
};

// Port capability rows are owner data, not a fixed synthetic release shape.
// Discover the concrete logger/logUpload capability prefixes from the fresh
// expanded hierarchy so the oracle verifies the controls the product actually
// rendered. This intentionally requires both owner rows; silently reducing
// the denominator would turn a missing capability into a false green.
const portDetailPrefixesFromXml = xml => [
  ...new Set(
    [
      ...xml.matchAll(
        /resource-id="(terminal\.admin:ports:item:(?:logger|logUpload):[^"]+):(name|status|reason|source)"/g,
      ),
    ].map(match => match[1]),
  ),
];

const portDetailIdsFromPrefixes = (target, prefixes, label) => {
  const loggerPrefixes = prefixes.filter(prefix => prefix.includes(':logger:'));
  const logUploadPrefixes = prefixes.filter(prefix => prefix.includes(':logUpload:'));
  if (loggerPrefixes.length === 0 || logUploadPrefixes.length === 0) {
    throw new RunnerFailure(
      `${target.tag} ${label}`,
      `expanded logs category did not expose both owner capability rows (logger=${loggerPrefixes.length}, logUpload=${logUploadPrefixes.length})`,
    );
  }
  return [...prefixes].flatMap(prefix => ['name', 'status', 'reason', 'source'].map(field => `${prefix}:${field}`));
};

const nudgePortDetailScroll = async (target, displayId, xml, label, scrollResourceId) => {
  const scroll = nodeForId(xml, scrollResourceId);
  if (scroll === null || scroll.right <= scroll.left || scroll.bottom <= scroll.top) {
    throw new RunnerFailure(
      `${target.tag} ${label}`,
      `port ScrollView ${scrollResourceId} was not observable for capability discovery`,
    );
  }
  const displayArgs = displayId === 0 ? [] : ['-d', String(displayId)];
  const x = Math.floor((scroll.left + scroll.right) / 2);
  const startY = Math.floor(scroll.bottom - 80);
  const endY = Math.floor(scroll.top + 100);
  if (endY >= startY)
    throw new RunnerFailure(`${target.tag} ${label}`, 'port ScrollView could not advance to the next capability row');
  adb(
    target,
    ['shell', 'input', ...displayArgs, 'swipe', String(x), String(startY), String(x), String(endY), '350'],
    `discover ${label} next port capability row`,
  );
  target.lastUiActionAt = Date.now();
  target.nextUiObservationAt = Math.max(
    target.nextUiObservationAt ?? 0,
    target.lastUiActionAt + (target.lastUiActionSettleDelayMs ?? uiActionSettleDelayMs),
  );
  await sleep(target.lastUiActionSettleDelayMs ?? uiActionSettleDelayMs);
};

const discoverPortDetailIds = async (target, label, displayId = 0, read = readUi) => {
  const prefixes = new Set();
  let lastXml = '';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    lastXml = await read(target, label);
    for (const prefix of portDetailPrefixesFromXml(lastXml)) prefixes.add(prefix);
    try {
      return portDetailIdsFromPrefixes(target, [...prefixes], label);
    } catch (error) {
      if (attempt === 5) throw error;
      await nudgePortDetailScroll(target, displayId, lastXml, label, 'admin.console.platform-ports:scroll');
    }
  }
  throw new RunnerFailure(`${target.tag} ${label}`, 'port capability discovery ended without an observable result');
};

const discoverStage2PortDetailIds = async (target, displayId, label) =>
  discoverPortDetailIds(target, label, displayId, (currentTarget, currentLabel) =>
    readStage2Ui(currentTarget, displayId, currentLabel),
  );

const restoreStage2ScrollToSummary = async (target, displayId, scrollResourceId, summaryIds, label) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const xml = await readStage2Ui(target, displayId, `${label} readback`);
    const scroll = nodeForId(xml, scrollResourceId);
    if (summaryIds.every(resourceId => nodeForId(xml, resourceId) !== null)) return xml;
    if (scroll === null || scroll.right <= scroll.left || scroll.bottom <= scroll.top) {
      throw new RunnerFailure(
        `${target.tag} ${label}`,
        `ScrollView ${scrollResourceId} was not observable while restoring the summary viewport`,
      );
    }
    const displayArgs = displayId === 0 ? [] : ['-d', String(displayId)];
    const x = Math.floor((scroll.left + scroll.right) / 2);
    const startY = Math.floor(scroll.top + 100);
    const endY = Math.floor(scroll.bottom - 80);
    if (endY <= startY)
      throw new RunnerFailure(`${target.tag} ${label}`, 'ScrollView could not move toward the summary viewport');
    adb(
      target,
      ['shell', 'input', ...displayArgs, 'swipe', String(x), String(startY), String(x), String(endY), '350'],
      `${label} toward summary viewport`,
    );
    target.lastUiActionAt = Date.now();
    target.nextUiObservationAt = Math.max(
      target.nextUiObservationAt ?? 0,
      target.lastUiActionAt + (target.lastUiActionSettleDelayMs ?? uiActionSettleDelayMs),
    );
    await sleep(target.lastUiActionSettleDelayMs ?? uiActionSettleDelayMs);
  }
  throw new RunnerFailure(
    `${target.tag} ${label}`,
    `summary nodes did not return to the visible viewport: ${summaryIds.join(', ')}`,
  );
};

const saveStage2Ui = (target, displayId, label, xml) => {
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '-');
  writeText(
    `${target.tag}-display-${displayId}-${String(target.uiSequence++).padStart(3, '0')}-${safeLabel}.xml`,
    sanitizeDiagnostic(xml),
  );
  writeText(
    `${target.tag}-display-${displayId}-${safeLabel}-uiautomator-windows.xml`,
    sanitizeDiagnostic(target.lastWindowsByDisplay.get(displayId) ?? ''),
  );
};

const waitForStage2Node = async (target, displayId, resourceId, predicate = () => true, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs;
  let lastXml = '';
  let lastObservationError = null;
  while (Date.now() < deadline) {
    try {
      lastXml = await readStage2Ui(target, displayId, `wait ${resourceId}`);
      lastObservationError = null;
    } catch (error) {
      lastObservationError = error;
      await sleep(700);
      continue;
    }
    const node = nodeForId(lastXml, resourceId);
    if (node !== null && predicate(node, lastXml)) return {xml: lastXml, node};
    await sleep(400);
  }
  saveStage2Ui(target, displayId, `wait-failed-${resourceId}`, lastXml);
  if (lastObservationError !== null && lastXml.length === 0) throw lastObservationError;
  throw new RunnerFailure(`${target.tag} wait display ${displayId} ${resourceId}`, 'expected UI state was not reached');
};

const waitForStage2Absent = async (target, displayId, resourceId, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs;
  let lastXml = '';
  while (Date.now() < deadline) {
    lastXml = await readStage2Ui(target, displayId, `wait absent ${resourceId}`);
    if (nodeForId(lastXml, resourceId) === null) return lastXml;
    await sleep(400);
  }
  saveStage2Ui(target, displayId, `absent-failed-${resourceId}`, lastXml);
  throw new RunnerFailure(
    `${target.tag} wait absent display ${displayId} ${resourceId}`,
    'UI resource did not disappear',
  );
};

const scrollStage2NodeIntoView = async (
  target,
  displayId,
  resourceId,
  scrollResourceId = 'terminal.admin:topology:scroll',
  timeoutMs = 20_000,
) => {
  const deadline = Date.now() + timeoutMs;
  let lastXml = '';
  while (Date.now() < deadline) {
    lastXml = await readStage2Ui(target, displayId, `scroll ${resourceId}`);
    const node = nodeForId(lastXml, resourceId);
    const scroll = nodeForId(lastXml, scrollResourceId);
    if (node !== null && scroll !== null) {
      // The Android accessibility bounds already describe the visible
      // ScrollView viewport.  Do not add an artificial inset here: the last
      // reason card is intentionally allowed to end at the viewport edge and
      // remains fully visible above the app's bottom safe-area padding.
      const viewportBottom = scroll.bottom;
      const viewportTop = scroll.top;
      const nodeHasVisibleBounds = node.right > node.left && node.bottom > node.top;
      if (nodeHasVisibleBounds && node.top >= viewportTop && node.bottom <= viewportBottom) return {xml: lastXml, node};
      const x = Math.floor((scroll.left + scroll.right) / 2);
      if (!nodeHasVisibleBounds) {
        // UiAutomator represents a child clipped above the viewport with an
        // inverted box such as [top=viewportTop,bottom=offscreenTop].  Treat
        // that as an above-viewport target and reverse the finger direction;
        // otherwise the generic missing/inverted path keeps swiping upward
        // and can never recover a header that precedes the current scroll.
        const nodeIsAboveViewport = node.bottom <= viewportTop;
        const nodeIsBelowViewport = node.top >= viewportBottom;
        if (nodeIsAboveViewport || nodeIsBelowViewport) {
          const correctionDistance = Math.min(260, Math.floor((viewportBottom - viewportTop) / 2));
          const startY = nodeIsAboveViewport ? Math.floor(viewportTop + 100) : Math.floor(viewportBottom - 100);
          const endY = nodeIsAboveViewport
            ? Math.min(Math.floor(viewportBottom - 80), startY + correctionDistance)
            : Math.max(Math.floor(viewportTop + 80), startY - correctionDistance);
          if (startY !== endY) {
            const displayArgs = displayId === 0 ? [] : ['-d', String(displayId)];
            adb(
              target,
              ['shell', 'input', ...displayArgs, 'swipe', String(x), String(startY), String(x), String(endY), '350'],
              `scroll clipped ${resourceId} into view`,
            );
            target.lastUiActionAt = Date.now();
            await sleep(700);
            continue;
          }
        }
      }
      // React Native can publish a clipped child with zero or inverted
      // accessibility bounds while its owning port card is already inside the
      // ScrollView.  The direction is determined by the clipped edge: a
      // bottom-edge child needs an upward finger swipe; a top-edge child needs
      // a downward finger swipe.  Guessing one direction for both cases can
      // move the owner farther out of the viewport and make the field
      // unrecoverable.
      const parentResourceId = resourceId.includes(':') ? resourceId.slice(0, resourceId.lastIndexOf(':')) : '';
      const parent = parentResourceId === '' ? null : nodeForId(lastXml, parentResourceId);
      const parentHasVisibleBounds = parent !== null && parent.right > parent.left && parent.bottom > parent.top;
      const parentInsideViewport =
        parentHasVisibleBounds && parent.top >= viewportTop && parent.bottom <= viewportBottom;
      if (!nodeHasVisibleBounds && parentInsideViewport) {
        const targetAtTopEdge = node.top <= viewportTop;
        const targetAtBottomEdge = node.top >= viewportBottom || node.bottom >= viewportBottom;
        const startY = targetAtBottomEdge ? Math.floor(viewportBottom - 100) : Math.floor(viewportTop + 100);
        const endY = targetAtBottomEdge
          ? Math.floor(Math.max(viewportTop + 40, startY - 180))
          : Math.floor(Math.min(viewportBottom - 40, startY + 180));
        if (targetAtTopEdge ? endY > startY : targetAtBottomEdge && endY < startY) {
          const displayArgs = displayId === 0 ? [] : ['-d', String(displayId)];
          adb(
            target,
            ['shell', 'input', ...displayArgs, 'swipe', String(x), String(startY), String(x), String(endY), '350'],
            `nudge clipped ${resourceId} owner into view`,
          );
          target.lastUiActionAt = Date.now();
          await sleep(700);
          continue;
        }
      }
      const startY = Math.max(
        viewportTop + 80,
        Math.min(viewportBottom - 24, node.bottom > viewportBottom ? viewportBottom - 24 : viewportTop + 260),
      );
      const nodeIsBelowViewport = node.bottom > viewportBottom || node.top >= viewportBottom || !nodeHasVisibleBounds;
      const endY = nodeIsBelowViewport
        ? Math.max(viewportTop + 40, startY - Math.max(320, node.bottom - viewportBottom + 220))
        : Math.min(viewportBottom - 40, startY + Math.max(320, viewportTop - node.top + 220));
      if (startY !== endY) {
        const displayArgs = displayId === 0 ? [] : ['-d', String(displayId)];
        adb(
          target,
          [
            'shell',
            'input',
            ...displayArgs,
            'swipe',
            String(x),
            String(Math.floor(startY)),
            String(x),
            String(Math.floor(endY)),
            '350',
          ],
          `scroll display ${displayId} ${resourceId} into view`,
        );
        target.lastUiActionAt = Date.now();
      }
    } else {
      const displayArgs = displayId === 0 ? [] : ['-d', String(displayId)];
      // A clipped child may be absent from UiAutomator while its real
      // ScrollView is already observable. Keep both gesture endpoints inside
      // that owner; screen-ratio endpoints can finish outside the viewport and
      // be delivered to the shell instead of scrolling the list.
      const scroll = nodeForId(lastXml, scrollResourceId);
      const x = Math.floor(scroll === null ? (target.displayWidth ?? 360) / 2 : (scroll.left + scroll.right) / 2);
      const startY = Math.floor(scroll === null ? (target.displayHeight ?? 640) * 0.78 : scroll.bottom - 80);
      const endY = Math.floor(scroll === null ? (target.displayHeight ?? 640) * 0.22 : scroll.top + 80);
      adb(
        target,
        ['shell', 'input', ...displayArgs, 'swipe', String(x), String(startY), String(x), String(endY), '350'],
        `scroll display ${displayId} ${resourceId} into view without container`,
      );
      target.lastUiActionAt = Date.now();
    }
    await sleep(700);
  }
  saveStage2Ui(target, displayId, `scroll-failed-${resourceId}`, lastXml);
  throw new RunnerFailure(
    `${target.tag} scroll display ${displayId} ${resourceId}`,
    'resource did not become visible in the scroll viewport',
  );
};

const nudgeStage2Scroll = async (target, displayId, scrollResourceId) => {
  const observed = await waitForStage2Node(
    target,
    displayId,
    scrollResourceId,
    current => current.right > current.left && current.bottom > current.top,
  );
  const displayArgs = displayId === 0 ? [] : ['-d', String(displayId)];
  const x = Math.floor((observed.node.left + observed.node.right) / 2);
  const startY = Math.max(observed.node.top + 80, observed.node.bottom - 80);
  const endY = Math.min(observed.node.bottom - 40, observed.node.top + 100);
  adb(
    target,
    [
      'shell',
      'input',
      ...displayArgs,
      'swipe',
      String(x),
      String(Math.floor(startY)),
      String(x),
      String(Math.floor(endY)),
      '350',
    ],
    `nudge display ${displayId} ${scrollResourceId}`,
  );
  target.lastUiActionAt = Date.now();
  await sleep(uiActionSettleDelayMs);
};

const tapStage2Node = async (target, displayId, resourceId, options = {}) => {
  const observed =
    options.scrollIntoView === true
      ? await scrollStage2NodeIntoView(target, displayId, resourceId, options.scrollResourceId)
      : await waitForStage2Node(
          target,
          displayId,
          resourceId,
          current => current.right > current.left && current.bottom > current.top,
        );
  if (options.requireEnabled !== false && !observed.node.enabled)
    throw new RunnerFailure(`${target.tag} tap display ${displayId} ${resourceId}`, 'control is disabled');
  const x = Math.floor((observed.node.left + observed.node.right) / 2);
  const y = Math.floor((observed.node.top + observed.node.bottom) / 2);
  const displayArgs = displayId === 0 ? [] : ['-d', String(displayId)];
  adb(
    target,
    ['shell', 'input', ...displayArgs, 'tap', String(x), String(y)],
    `tap display ${displayId} ${resourceId}`,
  );
  target.lastUiActionAt = Date.now();
  return {node: observed.node, x, y};
};

const observeStage2 = async (record, target, displayId, label, expectedIds = [], expectedTexts = []) => {
  const xml = await readStage2Ui(target, displayId, label);
  const evidence = inspectExpectedUi(xml, expectedIds, expectedTexts);
  if (!evidence.hierarchyValid)
    throw new RunnerFailure(target.tag + ' ' + label, 'UI hierarchy was malformed or incomplete');
  const missing = evidence.missingIds;
  if (missing.length > 0) throw new RunnerFailure(`${target.tag} ${label}`, `missing UI nodes: ${missing.join(', ')}`);
  if (evidence.ambiguousIds.length > 0)
    throw new RunnerFailure(`${target.tag} ${label}`, `ambiguous UI nodes: ${evidence.ambiguousIds.join(', ')}`);
  const missingTexts = evidence.missingTexts;
  if (missingTexts.length > 0)
    throw new RunnerFailure(`${target.tag} ${label}`, `missing business state text: ${missingTexts.join(', ')}`);
  const diagnosticTexts = expectedTexts.map(sanitizeDiagnostic);
  saveStage2Ui(target, displayId, label, xml);
  record.steps.push({
    label,
    deviceRole: target.role,
    displayId,
    timestamp: new Date().toISOString(),
    expectedIds,
    expectedTexts: diagnosticTexts,
    observedIds: evidence.observedIds,
    observedText: evidence.observedText,
  });
  return xml;
};

const saveUi = (target, label, xml) => {
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '-');
  writeText(`${target.tag}-${String(target.uiSequence++).padStart(3, '0')}-${safeLabel}.xml`, sanitizeDiagnostic(xml));
  writeText(`${target.tag}-${safeLabel}-uiautomator-windows.xml`, sanitizeDiagnostic(target.lastWindowsXml));
};

const waitForNode = async (target, resourceId, predicate = () => true, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs;
  let lastXml = '';
  let lastObservationError = null;
  while (Date.now() < deadline) {
    try {
      lastXml = await readUi(target, `wait ${resourceId}`);
      lastObservationError = null;
    } catch (error) {
      lastObservationError = error;
      if (Date.now() >= deadline) break;
      await sleep(Math.min(uiObservationRecoveryDelayMs, Math.max(250, deadline - Date.now())));
      continue;
    }
    const node = nodeForId(lastXml, resourceId);
    if (node !== null && predicate(node, lastXml)) return {xml: lastXml, node};
    await sleep(300);
  }
  saveUi(target, `wait-failed-${resourceId}`, lastXml);
  if (lastObservationError !== null && lastXml.length === 0) throw lastObservationError;
  throw new RunnerFailure(`${target.tag} wait ${resourceId}`, 'expected UI state was not reached');
};

const waitForAbsent = async (target, resourceId, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs;
  let lastXml = '';
  let lastObservationError = null;
  while (Date.now() < deadline) {
    try {
      lastXml = await readUi(target, `wait absent ${resourceId}`);
      lastObservationError = null;
    } catch (error) {
      lastObservationError = error;
      if (Date.now() >= deadline) break;
      await sleep(Math.min(uiObservationRecoveryDelayMs, Math.max(250, deadline - Date.now())));
      continue;
    }
    if (nodeForId(lastXml, resourceId) === null) return lastXml;
    await sleep(300);
  }
  saveUi(target, `absent-failed-${resourceId}`, lastXml);
  if (lastObservationError !== null && lastXml.length === 0) throw lastObservationError;
  throw new RunnerFailure(`${target.tag} wait absent ${resourceId}`, 'UI resource did not disappear');
};

const waitForPairRuntimeReset = async target =>
  waitForNode(
    target,
    'terminal.admin:launcher',
    (_node, xml) => nodeForId(xml, 'terminal.admin:shell') === null && nodeForId(xml, 'terminal.admin:login') === null,
  );

const waitForAdminLayerReset = async target =>
  waitForNode(target, 'terminal.admin:launcher', (_node, xml) => nodeForId(xml, 'terminal.admin:shell') === null);

const scrollNodeIntoView = async (target, resourceId, scrollResourceId = 'terminal.admin:topology:scroll') => {
  // Android can expose a real enabled control at the content boundary with a
  // zero-height accessibility bounds until its ScrollView is moved.  First
  // observe the resource itself without a shape predicate; the subsequent
  // gesture must be driven by the observed topology ScrollView, not by a
  // guessed screen coordinate.
  const observed = await waitForNode(target, resourceId);
  // The laptop emulator exposes a 96px bottom taskbar interaction inset. A
  // node below this edge may have positive accessibility bounds while its
  // center tap is delivered to the launcher/taskbar instead of the app.
  const displayBottom = target.displayHeight === null ? observed.node.bottom : Math.max(0, target.displayHeight - 96);
  const scroll = await waitForNode(
    target,
    scrollResourceId,
    current => current.right > current.left && current.bottom > current.top,
  );
  // The accessibility bounds are the authoritative visible ScrollView
  // viewport. Do not subtract a guessed system-inset margin: that rejects a
  // real control which is inside the ScrollView but below the device-height
  // heuristic used by the old runner.
  const viewportTop = scroll.node.top;
  const viewportBottom = Math.min(scroll.node.bottom, displayBottom);
  if (
    observed.node.right > observed.node.left &&
    observed.node.bottom > observed.node.top &&
    observed.node.top >= viewportTop &&
    observed.node.bottom <= viewportBottom
  )
    return observed;

  // The topology form is a real scroll surface. A control at the lower edge
  // can have a clickable UiAutomator node while its center falls below the
  // RN viewport/system inset, so a raw center tap is not a delivered gesture.
  // The mobile port detail union can also visit a later row first and then
  // request an earlier row whose accessibility bounds are above the viewport
  // (sometimes with inverted zero-height bounds). Choose the gesture
  // direction from the observed bounds, then re-read the node; do not reuse
  // its pre-scroll bounds.
  const x = Math.floor((scroll.node.left + scroll.node.right) / 2);
  const targetAboveViewport = observed.node.top <= viewportTop || observed.node.bottom <= viewportTop;
  const startY = targetAboveViewport
    ? Math.max(scroll.node.top + 40, Math.min(scroll.node.bottom - 80, viewportTop + 80))
    : Math.max(scroll.node.top + 80, Math.min(scroll.node.bottom - 24, viewportBottom - 24));
  const travel = targetAboveViewport
    ? Math.max(480, viewportTop - Math.min(observed.node.top, observed.node.bottom) + 320)
    : Math.max(480, observed.node.bottom - viewportBottom + 320);
  const endY = targetAboveViewport
    ? Math.min(viewportBottom - 24, startY + travel)
    : Math.max(viewportTop + 40, startY - travel);
  if (targetAboveViewport ? endY <= startY : endY >= startY)
    throw new RunnerFailure(`${target.tag} scroll ${resourceId}`, 'control could not be moved into the viewport');
  adb(
    target,
    ['shell', 'input', 'swipe', String(x), String(startY), String(x), String(endY), '350'],
    `scroll ${resourceId} into view`,
  );
  target.lastUiActionAt = Date.now();
  target.nextUiObservationAt = Math.max(
    target.nextUiObservationAt ?? 0,
    target.lastUiActionAt + (target.lastUiActionSettleDelayMs ?? uiActionSettleDelayMs),
  );
  return waitForNode(
    target,
    resourceId,
    current => current.right > current.left && current.bottom > current.top && current.bottom <= viewportBottom,
  );
};

const tapNode = async (target, resourceId, options = {}) => {
  const observed =
    options.scrollIntoView === true
      ? await scrollNodeIntoView(target, resourceId, options.scrollResourceId)
      : await waitForNode(target, resourceId, current => current.right > current.left && current.bottom > current.top);
  const node = observed.node;
  if (options.requireEnabled !== false && !node.enabled)
    throw new RunnerFailure(`${target.tag} tap ${resourceId}`, 'control is disabled');
  const x = Math.floor((node.left + node.right) / 2);
  const y = Math.floor((node.top + node.bottom) / 2);
  adb(target, ['shell', 'input', 'tap', String(x), String(y)], `tap ${resourceId}`);
  target.lastUiActionAt = Date.now();
  target.lastUiActionSettleDelayMs = options.settleDelayMs ?? uiActionSettleDelayMs;
  const nextObservationAt = target.lastUiActionAt + target.lastUiActionSettleDelayMs;
  target.nextUiObservationAt =
    options.settleDelayMs === undefined
      ? Math.max(target.nextUiObservationAt ?? 0, nextObservationAt)
      : nextObservationAt;
  return {node, x, y};
};

const recordObservation = (record, target, label, xml, expectedIds = [], expectedTexts = [], scopeId = null) => {
  const evidence = inspectExpectedUi(xml, expectedIds, expectedTexts, scopeId);
  if (!evidence.hierarchyValid)
    throw new RunnerFailure(target.tag + ' ' + label, 'UI hierarchy was malformed or incomplete');
  if (!evidence.scopeValid)
    throw new RunnerFailure(`${target.tag} ${label}`, `UI evidence scope is missing or ambiguous: ${scopeId}`);
  const missing = evidence.missingIds;
  if (missing.length > 0) throw new RunnerFailure(`${target.tag} ${label}`, `missing UI nodes: ${missing.join(', ')}`);
  if (evidence.ambiguousIds.length > 0)
    throw new RunnerFailure(`${target.tag} ${label}`, `ambiguous UI nodes: ${evidence.ambiguousIds.join(', ')}`);
  const missingTexts = evidence.missingTexts;
  if (missingTexts.length > 0)
    throw new RunnerFailure(`${target.tag} ${label}`, `missing business state text: ${missingTexts.join(', ')}`);
  const diagnosticTexts = expectedTexts.map(sanitizeDiagnostic);
  saveUi(target, label, xml);
  const step = {
    label,
    deviceRole: target.role,
    timestamp: new Date().toISOString(),
    expectedIds,
    expectedTexts: diagnosticTexts,
    observedIds: evidence.observedIds,
    observedText: evidence.observedText,
  };
  record.steps.push(step);
  return xml;
};

const observe = async (record, target, label, expectedIds = [], expectedTexts = []) =>
  recordObservation(record, target, label, await readUi(target, label), expectedIds, expectedTexts);

const captureStage2Screenshot = (target, displayId, label) => {
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '-');
  const surfaceDisplayId = target.surfaceDisplayIds.get(displayId);
  if (surfaceDisplayId === undefined)
    throw new RunnerFailure(
      `${target.tag} display ${displayId} ${label} screenshot`,
      'SurfaceFlinger display id mapping is missing',
    );
  const screenshot = adb(target, ['exec-out', 'screencap', '-p', '-d', surfaceDisplayId], `${label} screenshot`, {
    allowFailure: true,
    binary: true,
  });
  if (screenshot.status !== 0 || !Buffer.isBuffer(screenshot.stdout) || screenshot.stdout.length === 0) {
    throw new RunnerFailure(`${target.tag} display ${displayId} ${label} screenshot`, 'screenshot is empty');
  }
  const screenshotPath = path.join(currentOutputDirectory, `${target.tag}-display-${displayId}-${safeLabel}.png`);
  writeBinary(`${target.tag}-display-${displayId}-${safeLabel}.png`, screenshot.stdout);
  const fileResult = localRun('file', [screenshotPath], `${label} screenshot metadata`, {allowFailure: true});
  const fileText = textOf(fileResult);
  writeText(`${target.tag}-display-${displayId}-${safeLabel}.file.txt`, fileText);
  const dimensions = fileText.match(/(\d+) x (\d+)/);
  if (!/PNG image data/.test(fileText) || dimensions === null) {
    throw new RunnerFailure(
      `${target.tag} display ${displayId} ${label} screenshot`,
      `invalid PNG metadata: ${fileText}`,
    );
  }
  return {
    path: path.relative(repositoryRoot, screenshotPath),
    width: Number(dimensions[1]),
    height: Number(dimensions[2]),
    fileText,
  };
};

const captureStage1Screenshot = (target, label) => {
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '-');
  const screenshot = adb(target, ['exec-out', 'screencap', '-p'], `${label} screenshot`, {
    allowFailure: true,
    binary: true,
  });
  if (screenshot.status !== 0 || !Buffer.isBuffer(screenshot.stdout) || screenshot.stdout.length === 0) {
    throw new RunnerFailure(`${target.tag} display 0 ${label} screenshot`, 'screenshot is empty');
  }
  const screenshotPath = path.join(currentOutputDirectory, `${target.tag}-display-0-${safeLabel}.png`);
  writeBinary(`${target.tag}-display-0-${safeLabel}.png`, screenshot.stdout);
  const fileResult = localRun('file', [screenshotPath], `${label} screenshot metadata`, {allowFailure: true});
  const fileText = textOf(fileResult);
  writeText(`${target.tag}-display-0-${safeLabel}.file.txt`, fileText);
  const dimensions = fileText.match(/(\d+) x (\d+)/);
  if (!/PNG image data/.test(fileText) || dimensions === null) {
    throw new RunnerFailure(`${target.tag} display 0 ${label} screenshot`, `invalid PNG metadata: ${fileText}`);
  }
  return {
    path: path.relative(repositoryRoot, screenshotPath),
    width: Number(dimensions[1]),
    height: Number(dimensions[2]),
    fileText,
  };
};

const screenshotFilePath = screenshot =>
  path.isAbsolute(screenshot.path) ? screenshot.path : path.join(repositoryRoot, screenshot.path);

const composeCrossTabScreenshot = (leftScreenshot, rightScreenshot) => {
  const left = PNG.sync.read(fs.readFileSync(screenshotFilePath(leftScreenshot)));
  const right = PNG.sync.read(fs.readFileSync(screenshotFilePath(rightScreenshot)));
  const margin = 32;
  const gap = 32;
  const composed = new PNG({
    width: margin + left.width + gap + right.width + margin,
    height: margin + Math.max(left.height, right.height) + margin,
  });
  for (let offset = 0; offset < composed.data.length; offset += 4) {
    composed.data[offset] = 245;
    composed.data[offset + 1] = 247;
    composed.data[offset + 2] = 250;
    composed.data[offset + 3] = 255;
  }
  PNG.bitblt(left, composed, 0, 0, left.width, left.height, margin, margin);
  PNG.bitblt(right, composed, 0, 0, right.width, right.height, margin + left.width + gap, margin);
  const name = 'master-display-0-IA-32-cross-tab-dual-physical.png';
  writeBinary(name, PNG.sync.write(composed));
  const absolutePath = path.join(currentOutputDirectory, name);
  const fileResult = localRun('file', [absolutePath], 'IA-32 cross-tab screenshot metadata', {allowFailure: true});
  const fileText = textOf(fileResult);
  writeText('master-display-0-IA-32-cross-tab-dual-physical.file.txt', fileText);
  return {
    path: path.relative(repositoryRoot, absolutePath),
    width: composed.width,
    height: composed.height,
    fileText,
  };
};

const upsertFrameEvidence = (record, entry) => {
  record.frameEvidence ??= [];
  const existingIndex = record.frameEvidence.findIndex(candidate => candidate.frameId === entry.frameId);
  if (existingIndex === -1) record.frameEvidence.push(entry);
  else record.frameEvidence[existingIndex] = entry;
  writeJson('frame-evidence.json', record.frameEvidence);
  return entry;
};

const upsertFrameVariantEvidence = (record, frameId, variant, entry) => {
  record.frameEvidence ??= [];
  const existing = record.frameEvidence.find(candidate => candidate.frameId === frameId);
  if (existing === undefined) {
    upsertFrameEvidence(record, {
      frameId,
      variants: {[variant]: entry},
      status: entry.status,
      observedAt: new Date().toISOString(),
    });
    return;
  }
  existing.variants ??= {};
  existing.variants[variant] = entry;
  writeJson('frame-evidence.json', record.frameEvidence);
};

const captureAdminFrame = async (
  record,
  target,
  frameId,
  label,
  expectedIds = [],
  expectedTexts = [],
  options = {},
) => {
  record.frameEvidence ??= [];
  if (record.frameEvidence.some(entry => entry.frameId === frameId && entry.status === 'MATCHED'))
    return record.frameEvidence.find(entry => entry.frameId === frameId);
  const rootId = `terminal.admin:frame:${frameId}`;
  try {
    const observed = await waitForNode(
      target,
      rootId,
      (current, xml) =>
        current.right > current.left &&
        current.bottom > current.top &&
        expectedIds.every(resourceId => nodeForId(xml, resourceId) !== null) &&
        expectedUiMatches(xml, [rootId, ...expectedIds], expectedTexts, rootId),
      options.timeoutMs ?? 4_000,
    );
    // Busy frames can trigger an owner runtime reset immediately after the
    // successful read. Reuse that fresh hierarchy instead of performing a
    // second read that may already observe the post-reset surface.
    const xml = recordObservation(
      record,
      target,
      `frame-${frameId}-${label}`,
      observed.xml,
      [rootId, ...expectedIds],
      expectedTexts,
      rootId,
    );
    const screenshot = captureStage1Screenshot(target, `frame-${frameId}-${label}`);
    const entry = {
      frameId,
      label,
      deviceRole: target.role,
      status: 'MATCHED',
      screenshot,
      observedAt: new Date().toISOString(),
    };
    upsertFrameEvidence(record, entry);
    record.lastKnownGood = `frame-${frameId}-${label}`;
    return entry;
  } catch (error) {
    const entry = {
      frameId,
      label,
      deviceRole: target.role,
      status: 'OPEN',
      firstFailure: sanitizeDiagnostic(error instanceof Error ? error.message : String(error)),
      observedAt: new Date().toISOString(),
    };
    upsertFrameEvidence(record, entry);
    if (options.required === true) throw error;
    return entry;
  }
};

const captureStage1ScrolledFrame = async (record, target, frameId, label, summaryIds, detailIds, scrollResourceId) => {
  const rootId = `terminal.admin:frame:${frameId}`;
  record.frameEvidence ??= [];
  const expectedIds = [...new Set([...summaryIds, ...detailIds])];
  try {
    const summary = await waitForNode(
      target,
      rootId,
      (current, xml) =>
        current.right > current.left &&
        current.bottom > current.top &&
        summaryIds.every(resourceId => nodeForId(xml, resourceId) !== null),
    );
    saveUi(target, `frame-${frameId}-${label}-summary`, summary.xml);
    const summaryScreenshot = captureStage1Screenshot(target, `frame-${frameId}-${label}-summary`);
    const detailViewports = [];
    let observedXml = [summary.xml];
    for (const [index, resourceId] of detailIds.filter(id => id !== rootId).entries()) {
      const detail = await scrollNodeIntoView(target, resourceId, scrollResourceId);
      const detailLabel = `frame-${frameId}-${label}-detail-${String(index + 1).padStart(2, '0')}`;
      saveUi(target, detailLabel, detail.xml);
      const screenshot = captureStage1Screenshot(target, detailLabel);
      detailViewports.push({resourceId, xml: `${detailLabel}.xml`, screenshot: screenshot.path});
      observedXml.push(detail.xml);
    }
    const observedIds = [
      ...new Set(observedXml.flatMap(xml => [...xml.matchAll(/resource-id="([^"]+)"/g)].map(match => match[1]))),
    ];
    const missingIds = expectedIds.filter(resourceId => !observedIds.includes(resourceId));
    if (missingIds.length > 0)
      throw new RunnerFailure(
        `${target.tag} frame ${frameId} ${label}`,
        `missing UI nodes after scroll union: ${missingIds.join(', ')}`,
      );
    const screenshots = [summaryScreenshot.path, ...detailViewports.map(viewport => viewport.screenshot)];
    const entry = {
      frameId,
      label,
      deviceRole: target.role,
      status: 'MATCHED',
      screenshot: {path: screenshots[screenshots.length - 1]},
      screenshots,
      observedAt: new Date().toISOString(),
      expectedIds,
      expectedTexts: [],
      observedIds,
      viewportEvidence: {
        summary: `frame-${frameId}-${label}-summary.xml`,
        details: detailViewports,
      },
    };
    upsertFrameEvidence(record, entry);
    record.steps.push({
      label: `frame-${frameId}-${label}`,
      deviceRole: target.role,
      timestamp: new Date().toISOString(),
      expectedIds,
      expectedTexts: [],
      observedIds,
      screenshots,
    });
    record.lastKnownGood = `frame-${frameId}-${label}`;
    return entry;
  } catch (error) {
    const entry = {
      frameId,
      label,
      deviceRole: target.role,
      status: 'OPEN',
      firstFailure: sanitizeDiagnostic(error instanceof Error ? error.message : String(error)),
      observedAt: new Date().toISOString(),
      expectedIds,
      expectedTexts: [],
    };
    upsertFrameEvidence(record, entry);
    throw error;
  }
};

const captureVisiblePanelFrame = async (record, target, frameId, label, variantIds) => {
  const rootId = `terminal.admin:frame:${frameId}`;
  const current = await readUi(target, `probe ${rootId}`);
  if (nodeForId(current, rootId) === null) {
    upsertFrameEvidence(record, {
      frameId,
      label,
      deviceRole: target.role,
      status: 'OPEN',
      firstFailure: `${rootId} was not present in the fresh release UI hierarchy; no real frame was captured`,
      observedAt: new Date().toISOString(),
    });
    return false;
  }
  await captureAdminFrame(
    record,
    target,
    frameId,
    label,
    [
      'terminal.admin:shell:panel',
      'terminal.admin:shell:header',
      'terminal.admin:shell:brand',
      'terminal.admin:shell:title',
      'terminal.admin:shell:overall-status',
      'terminal.admin:close',
      'terminal.admin:navigation',
      'terminal.admin:section:platform-ports',
      'terminal.admin:section:runtime',
      'terminal.admin:section:topology',
      'terminal.admin:content',
      ...variantIds,
    ],
    [],
    {required: true},
  );
  return true;
};

const stage2PanelControls = Object.freeze([
  'terminal.admin:shell:panel',
  'terminal.admin:shell:header',
  'terminal.admin:shell:brand',
  'terminal.admin:shell:title',
  'terminal.admin:shell:overall-status',
  'terminal.admin:close',
  'terminal.admin:navigation',
  'terminal.admin:content',
]);

const captureStage2Frame = async (
  record,
  target,
  frameId,
  label,
  expectedIds = [],
  expectedTexts = [],
  displayId = 0,
  options = {},
) => {
  const rootId = `terminal.admin:frame:${frameId}`;
  record.frameEvidence ??= [];
  const existing = record.frameEvidence.find(entry => entry.frameId === frameId);
  if (existing?.status === 'MATCHED' && options.variant === undefined) return existing;
  try {
    const observed = await waitForStage2Node(
      target,
      displayId,
      rootId,
      (current, xml) =>
        current.right > current.left &&
        current.bottom > current.top &&
        expectedIds.every(resourceId => nodeForId(xml, resourceId) !== null) &&
        expectedUiMatches(xml, [rootId, ...expectedIds], expectedTexts, rootId),
      options.timeoutMs ?? 8_000,
    );
    const xml = observed.xml;
    const evidence = inspectExpectedUi(xml, [rootId, ...expectedIds], expectedTexts, rootId);
    if (
      !evidence.hierarchyValid ||
      !evidence.scopeValid ||
      evidence.missingIds.length > 0 ||
      evidence.ambiguousIds.length > 0 ||
      evidence.missingTexts.length > 0
    )
      throw new RunnerFailure(
        `${target.tag} frame-${frameId}-${label}`,
        'settled UI evidence no longer matches the scoped frame',
      );
    saveStage2Ui(target, displayId, `frame-${frameId}-${label}`, xml);
    // Accessibility can publish the new React tree before the native surface
    // has committed the same navigation state to pixels.  Keep the screenshot
    // bound to the settled frame rather than the previous section.
    await sleep(uiActionSettleDelayMs);
    const screenshot = captureStage2Screenshot(target, displayId, `frame-${frameId}-${label}`);
    const entry = {
      frameId,
      label,
      deviceRole: target.role,
      displayId,
      status: 'MATCHED',
      screenshot,
      observedAt: new Date().toISOString(),
      expectedIds,
      expectedTexts: expectedTexts.map(sanitizeDiagnostic),
      observedIds: evidence.observedIds,
      observedText: evidence.observedText,
    };
    if (options.variant !== undefined) upsertFrameVariantEvidence(record, frameId, options.variant, entry);
    else upsertFrameEvidence(record, entry);
    record.steps.push({
      label: `frame-${frameId}-${label}`,
      deviceRole: target.role,
      displayId,
      timestamp: new Date().toISOString(),
      expectedIds,
      expectedTexts: expectedTexts.map(sanitizeDiagnostic),
      observedIds: entry.observedIds,
      observedText: entry.observedText,
      screenshot: screenshot.path,
    });
    record.lastKnownGood = `frame-${frameId}-${label}`;
    return entry;
  } catch (error) {
    const entry = {
      frameId,
      label,
      deviceRole: target.role,
      displayId,
      status: 'OPEN',
      firstFailure: sanitizeDiagnostic(error instanceof Error ? error.message : String(error)),
      observedAt: new Date().toISOString(),
      expectedIds,
      expectedTexts: expectedTexts.map(sanitizeDiagnostic),
    };
    if (options.variant !== undefined) upsertFrameVariantEvidence(record, frameId, options.variant, entry);
    else upsertFrameEvidence(record, entry);
    if (options.required === true) throw error;
    return entry;
  }
};

const captureStage2ScrolledFrame = async (
  record,
  target,
  frameId,
  label,
  summaryIds,
  detailIds,
  displayId = 0,
  scrollResourceId = 'admin.console.platform-ports:scroll',
) => {
  const rootId = `terminal.admin:frame:${frameId}`;
  record.frameEvidence ??= [];
  const expectedIds = [...new Set([...summaryIds, ...detailIds])];
  try {
    const summary = await waitForStage2Node(
      target,
      displayId,
      rootId,
      (current, xml) =>
        current.right > current.left &&
        current.bottom > current.top &&
        summaryIds.every(resourceId => nodeForId(xml, resourceId) !== null),
    );
    saveStage2Ui(target, displayId, `frame-${frameId}-${label}-summary`, summary.xml);
    const summaryScreenshot = captureStage2Screenshot(target, displayId, `frame-${frameId}-${label}-summary`);
    const detailResourceIds = detailIds.filter(resourceId => resourceId !== rootId);
    const detailViewports = [];
    let observedXml = [summary.xml];
    for (const [index, resourceId] of detailResourceIds.entries()) {
      const detail = await scrollStage2NodeIntoView(target, displayId, resourceId, scrollResourceId);
      const detailLabel = `frame-${frameId}-${label}-detail-${String(index + 1).padStart(2, '0')}`;
      saveStage2Ui(target, displayId, detailLabel, detail.xml);
      await sleep(uiActionSettleDelayMs);
      const screenshot = captureStage2Screenshot(target, displayId, detailLabel);
      detailViewports.push({resourceId, xml: detailLabel + '.xml', screenshot: screenshot.path});
      observedXml.push(detail.xml);
    }
    const observedIds = [
      ...new Set(observedXml.flatMap(xml => [...xml.matchAll(/resource-id="([^"]+)"/g)].map(match => match[1]))),
    ];
    const missingIds = expectedIds.filter(resourceId => !observedIds.includes(resourceId));
    if (missingIds.length > 0)
      throw new RunnerFailure(
        `${target.tag} frame ${frameId} ${label}`,
        `missing UI nodes after scroll union: ${missingIds.join(', ')}`,
      );
    const screenshots = [summaryScreenshot.path, ...detailViewports.map(viewport => viewport.screenshot)];
    const entry = {
      frameId,
      label,
      deviceRole: target.role,
      displayId,
      status: 'MATCHED',
      screenshot: {path: screenshots[screenshots.length - 1]},
      screenshots,
      observedAt: new Date().toISOString(),
      expectedIds,
      expectedTexts: [],
      observedIds,
      viewportEvidence: {
        summary: `stage2-display-${displayId}-frame-${frameId}-${label}-summary.xml`,
        details: detailViewports,
      },
    };
    upsertFrameEvidence(record, entry);
    record.steps.push({
      label: `frame-${frameId}-${label}`,
      deviceRole: target.role,
      displayId,
      timestamp: new Date().toISOString(),
      expectedIds,
      expectedTexts: [],
      observedIds,
      screenshots,
    });
    record.lastKnownGood = `frame-${frameId}-${label}`;
    return entry;
  } catch (error) {
    const entry = {
      frameId,
      label,
      deviceRole: target.role,
      displayId,
      status: 'OPEN',
      firstFailure: sanitizeDiagnostic(error instanceof Error ? error.message : String(error)),
      observedAt: new Date().toISOString(),
      expectedIds,
      expectedTexts: [],
    };
    upsertFrameEvidence(record, entry);
    return entry;
  }
};

const markFrameOpen = (record, frameId, label, firstFailure, deviceRole) => {
  if (record.frameEvidence?.some(entry => entry.frameId === frameId && entry.status === 'MATCHED')) return;
  upsertFrameEvidence(record, {
    frameId,
    label,
    deviceRole,
    status: 'OPEN',
    firstFailure,
    observedAt: new Date().toISOString(),
  });
};

const adminFrameDenominator = Object.freeze([
  ...Array.from({length: 29}, (_value, index) => `IA-${String(index + 1).padStart(2, '0')}`),
  'IA-32',
]);

const finalizeFrameEvidence = (record, target) => {
  const firstBatch = new Set([
    'IA-01',
    'IA-03',
    'IA-05',
    'IA-07',
    'IA-09',
    'IA-11',
    'IA-13',
    'IA-18',
    'IA-19',
    'IA-20',
    'IA-21',
    'IA-22',
    'IA-23',
    'IA-24',
    'IA-25',
    'IA-26',
    'IA-27',
    'IA-28',
    'IA-29',
  ]);
  for (const frameId of adminFrameDenominator) {
    if (record.frameEvidence?.some(entry => entry.frameId === frameId)) continue;
    const belongsToThisStage = stage === '1' ? firstBatch.has(frameId) : !firstBatch.has(frameId);
    markFrameOpen(
      record,
      frameId,
      `frame-${frameId}-not-captured`,
      belongsToThisStage
        ? 'No frame evidence was produced before this run stopped; first failure is recorded at the run boundary.'
        : stage === '1'
          ? 'This frame belongs to the second VM batch and was not run in stage 1.'
          : 'This frame belongs to the first VM batch and was not run in stage 2.',
      target.role,
    );
  }
  const matched = record.frameEvidence.filter(entry => entry.status === 'MATCHED').map(entry => entry.frameId);
  const open = record.frameEvidence.filter(entry => entry.status === 'OPEN').map(entry => entry.frameId);
  record.frameDenominator = {
    expected: adminFrameDenominator,
    count: adminFrameDenominator.length,
    matched,
    open,
    matchedCount: matched.length,
    openCount: open.length,
    stage: stage === '1' ? 'first-batch' : 'second-batch',
  };
  writeJson('frame-denominator.json', record.frameDenominator);
};

const progress = (record, label, details = {}) => {
  record.lastKnownGood = label;
  record.timeline.push({label, timestamp: new Date().toISOString(), ...details});
  writeJson('progress.json', record);
};

const stage2OpenAdmin = async (record, target) => {
  let current = await readStage2Ui(target, 0, 'stage2 open admin preflight');
  if (nodeForId(current, 'terminal.admin:shell') !== null) return;
  if (nodeForId(current, 'terminal.admin:login') === null) {
    const launcher = await waitForStage2Node(target, 0, 'terminal.admin:launcher');
    const x = launcher.node.left + 48;
    const y = launcher.node.top + 48;
    const started = Date.now();
    for (let index = 0; index < 5; index += 1) {
      adb(target, ['shell', 'input', 'tap', String(x), String(y)], `stage2 admin launcher tap ${index + 1}`);
      await sleep(110);
    }
    if (Date.now() - started >= 1_800)
      throw new RunnerFailure(`${target.tag} stage2 admin launcher`, 'five-tap gesture exceeded its time window');
    current = (await waitForStage2Node(target, 0, 'terminal.admin:login')).xml;
  }
  const password = current.match(/请输入(?:六位)?动态口令（(\d{6})）/)?.[1] ?? null;
  if (password === null)
    throw new RunnerFailure(`${target.tag} stage2 admin login`, 'debug password display was not available');
  for (const digit of password) await tapStage2Node(target, 0, `ui.base.input:virtual-keyboard:text-${digit}`);
  await waitForStage2Node(target, 0, 'terminal.admin:verify', currentNode => currentNode.enabled);
  await tapStage2Node(target, 0, 'terminal.admin:verify');
  await waitForStage2Node(target, 0, 'terminal.admin:shell');
  await stage2CapturePanel(record, target);
  record.timeline.push({
    label: 'stage2-admin-authenticated',
    deviceRole: target.role,
    timestamp: new Date().toISOString(),
    debugPasswordObserved: true,
  });
};

const stage2CloseAdmin = async target => {
  const current = await readStage2Ui(target, 0, 'stage2 close admin preflight');
  if (nodeForId(current, 'terminal.admin:close') === null) {
    if (nodeForId(current, 'terminal.admin:shell') === null) return;
    throw new RunnerFailure(
      `${target.tag} stage2 close admin`,
      'admin shell is present but close control is not observable',
    );
  }
  await tapStage2Node(target, 0, 'terminal.admin:close');
  await waitForStage2Absent(target, 0, 'terminal.admin:shell');
};

const stage2OpenSection = async (target, partKey) => {
  const sectionName = partKey.replace('admin.console.', '');
  const sectionId = `terminal.admin:section:${sectionName}`;
  const sectionTitleId = {
    'admin.console.platform-ports': 'terminal.admin:ports:title',
    'admin.console.runtime': 'terminal.admin:runtime:title',
    'admin.console.topology': 'terminal.admin:topology:title',
  }[partKey];
  if (sectionTitleId === undefined)
    throw new RunnerFailure(`${target.tag} ${partKey} navigation`, `no stage2 title mapping exists for ${partKey}`);
  const current = await readStage2Ui(target, 0, `stage2 ${partKey} preflight`);
  if (nodeForId(current, sectionTitleId) !== null) return;
  if (nodeForId(current, sectionId) !== null) {
    await tapStage2Node(target, 0, sectionId);
  } else if (nodeForId(current, 'terminal.admin:navigation:trigger') !== null) {
    await tapStage2Node(target, 0, 'terminal.admin:navigation:trigger');
    await tapStage2Node(target, 0, `terminal.admin:navigation:option:${partKey}`);
  } else {
    throw new RunnerFailure(
      `${target.tag} ${partKey} navigation`,
      `section ${sectionId} and mobile navigation trigger were both unavailable`,
    );
  }
  await waitForStage2Node(target, 0, sectionTitleId);
  // Re-read after the observer settle window. The first accessibility tree can
  // reflect the selected option before the native pixels finish committing.
  await sleep(uiActionSettleDelayMs);
  await waitForStage2Node(target, 0, sectionTitleId);
};

const stage2CapturePanel = async (record, target) => {
  const frameId = stage2Shape === 'dual' ? 'IA-01' : 'IA-02';
  const navigationIds =
    stage2Shape === 'dual'
      ? ['terminal.admin:section:platform-ports', 'terminal.admin:section:runtime', 'terminal.admin:section:topology']
      : ['terminal.admin:navigation:trigger'];
  await captureStage2Frame(record, target, frameId, 'panel-normal', [...stage2PanelControls, ...navigationIds], [], 0, {
    required: true,
  });
  for (const [variantFrameId, variantLabel, variantIds] of stage2Shape === 'dual'
    ? [
        ['IA-03', 'panel-empty', ['terminal.admin:panel:empty', 'terminal.admin:panel:empty:reason']],
        [
          'IA-05',
          'panel-loading',
          [
            'terminal.admin:panel:loading',
            'terminal.admin:panel:loading:content',
            'terminal.admin:panel:loading:spinner',
            'terminal.admin:panel:loading:skeleton',
            'terminal.admin:panel:loading:message',
          ],
        ],
        [
          'IA-07',
          'panel-error',
          [
            'terminal.admin:panel:error',
            'terminal.admin:panel:error:content',
            'terminal.admin:panel:error:reason',
            'terminal.admin:panel:retry',
          ],
        ],
      ]
    : [
        ['IA-04', 'panel-empty', ['terminal.admin:panel:empty', 'terminal.admin:panel:empty:reason']],
        [
          'IA-06',
          'panel-loading',
          [
            'terminal.admin:panel:loading',
            'terminal.admin:panel:loading:content',
            'terminal.admin:panel:loading:spinner',
            'terminal.admin:panel:loading:skeleton',
            'terminal.admin:panel:loading:message',
          ],
        ],
        [
          'IA-08',
          'panel-error',
          [
            'terminal.admin:panel:error',
            'terminal.admin:panel:error:content',
            'terminal.admin:panel:error:reason',
            'terminal.admin:panel:retry',
          ],
        ],
      ]) {
    const current = await readStage2Ui(target, 0, `stage2 probe ${variantLabel}`);
    if (nodeForId(current, `terminal.admin:frame:${variantFrameId}`) !== null) {
      await captureStage2Frame(
        record,
        target,
        variantFrameId,
        variantLabel,
        [...stage2PanelControls, ...navigationIds, ...variantIds],
        [],
        0,
      );
    } else {
      markFrameOpen(
        record,
        variantFrameId,
        variantLabel,
        'No release UI state transition exposed this panel fixture after authentication; no runtime mutation was authorized to fabricate it.',
        target.role,
      );
    }
  }
};

const stage2CaptureRuntime = async (record, target) => {
  await stage2OpenSection(target, 'admin.console.runtime');
  if (stage2Shape === 'dual') {
    await captureStage2ScrolledFrame(
      record,
      target,
      'IA-15',
      'runtime-dual-surface',
      [
        'terminal.admin:section:runtime',
        'terminal.admin:runtime:title',
        'terminal.admin:runtime:overall-status',
        'admin.console.runtime:facts',
        'terminal.admin:runtime:surface-map',
        'terminal.admin:runtime:surface-map:surface:PRIMARY',
        'terminal.admin:runtime:surface-map:surface:SECONDARY',
        'terminal.admin:runtime:surface-map:surface:SECONDARY:inside:0',
        'terminal.admin:runtime:surface-map:surface:SECONDARY:inside:1',
      ],
      ['terminal.admin:runtime:surface:legend'],
      0,
      'admin.console.runtime:scroll',
    );
    return;
  }
  const normal = await captureStage2ScrolledFrame(
    record,
    target,
    'IA-14',
    'runtime-mobile-single-surface',
    [
      'terminal.admin:section:runtime',
      'terminal.admin:runtime:title',
      'terminal.admin:runtime:overall-status',
      'admin.console.runtime:facts',
    ],
    [
      'terminal.admin:frame:IA-14',
      'terminal.admin:runtime:surface-map',
      'admin.console.runtime:surface-card',
      'terminal.admin:runtime:mobile:single-surface-boundary',
      'terminal.admin:runtime:surface-map:surface:PRIMARY:card',
      'terminal.admin:runtime:surface-map:surface:PRIMARY:label',
      'terminal.admin:runtime:surface-map:surface:PRIMARY:role',
      'terminal.admin:runtime:surface-map:surface:PRIMARY:outside:0',
      'terminal.admin:runtime:surface-map:surface:PRIMARY:logic-width',
      'terminal.admin:runtime:surface-map:surface:PRIMARY',
      'terminal.admin:runtime:surface-map:surface:PRIMARY:logic-height',
      'terminal.admin:runtime:surface-map:surface:PRIMARY:inside:0',
      'terminal.admin:runtime:surface-map:surface:PRIMARY:inside:1',
      'terminal.admin:runtime:surface-map:surface:PRIMARY:outside:1',
      'terminal.admin:runtime:surface:legend',
    ],
    0,
    'admin.console.runtime:scroll',
  );
  const current = await readStage2Ui(target, 0, 'stage2 probe mobile display-facts-error variant');
  if (nodeForId(current, 'terminal.admin:runtime:display-facts-error') !== null) {
    await captureStage2Frame(
      record,
      target,
      'IA-14',
      'runtime-mobile-display-facts-error',
      [
        'terminal.admin:section:runtime',
        'terminal.admin:runtime:title',
        'admin.console.runtime:facts',
        'terminal.admin:runtime:display-facts-error',
      ],
      [],
      0,
      {variant: 'display-facts-error'},
    );
  } else {
    upsertFrameVariantEvidence(record, 'IA-14', 'display-facts-error', {
      frameId: 'IA-14',
      label: 'runtime-mobile-display-facts-error',
      deviceRole: target.role,
      displayId: 0,
      status: 'OPEN',
      firstFailure:
        'Mobile release runtime exposed one physical display and no multi-surface fact claim; the display-facts-error input condition was unavailable.',
      observedAt: new Date().toISOString(),
    });
  }
  return normal;
};

const stage2CapturePorts = async (record, target) => {
  await stage2OpenSection(target, 'admin.console.platform-ports');
  const frameId = stage2Shape === 'dual' ? 'IA-09' : 'IA-10';
  const baseIds = [
    `terminal.admin:section:platform-ports`,
    'terminal.admin:ports:title',
    'terminal.admin:ports:overall-status',
    'admin.console.platform-ports:total',
    'terminal.admin:ports:summary:ratio-bar',
    'terminal.admin:ports:summary-grid',
    'admin.console.platform-ports:scroll',
  ];
  await captureStage2Frame(record, target, frameId, 'ports-overview', baseIds);
  await tapStage2Node(target, 0, 'terminal.admin:ports:category:logs:expand', {
    scrollIntoView: true,
    scrollResourceId: 'admin.console.platform-ports:scroll',
  });
  await sleep(uiActionSettleDelayMs);
  const portDetailIds = await discoverStage2PortDetailIds(target, 0, 'discover stage2 expanded logs capability rows');
  await restoreStage2ScrollToSummary(
    target,
    0,
    'admin.console.platform-ports:scroll',
    baseIds,
    'restore stage2 ports summary',
  );
  await captureStage2ScrolledFrame(
    record,
    target,
    stage2Shape === 'dual' ? 'IA-11' : 'IA-12',
    'ports-logs-expanded',
    [...baseIds, 'terminal.admin:ports:category:logs:row'],
    [
      'terminal.admin:frame:' + (stage2Shape === 'dual' ? 'IA-11' : 'IA-12'),
      'terminal.admin:ports:category:logs:row',
      ...portDetailIds,
    ],
    0,
    'admin.console.platform-ports:scroll',
  );
};

const stage2RunDualAdminFrames = async (record, target) => {
  await stage2OpenAdmin(record, target);
  await stage2CaptureRuntime(record, target);
  await stage2CapturePorts(record, target);
  await stage2OpenTopology(record, target);
  const topology = await captureStage2Frame(
    record,
    target,
    'IA-16',
    'topology-dual-screen-unavailable',
    [
      'terminal.admin:section:topology',
      'terminal.admin:topology:content-root',
      'terminal.admin:topology:title',
      'terminal.admin:topology:page-gate',
      'terminal.admin:topology:page-gate:card',
      'terminal.admin:topology:page-gate:icon',
      'terminal.admin:topology:page-gate-reason',
    ],
    ['双机拓扑要求本机只有一个物理屏'],
  );
  const runtime = record.frameEvidence?.find(entry => entry.frameId === 'IA-15' && entry.status === 'MATCHED');
  if (runtime?.screenshot !== undefined && topology.screenshot !== undefined) {
    const crossTabScreenshot = composeCrossTabScreenshot(runtime.screenshot, topology.screenshot);
    const artifact = {
      frameId: 'IA-32',
      label: 'cross-tab-dual-physical',
      deviceRole: target.role,
      bindingKind: 'artifact-only',
      status: 'MATCHED',
      sourceFrames: ['IA-15', 'IA-16'],
      screenshots: [runtime.screenshot, topology.screenshot],
      screenshot: crossTabScreenshot,
      combinedScreenshot: crossTabScreenshot,
      displayShape: record.devices.stage2.displays,
      note: '真实 dual-screen runtime 与同一设备 topology 不可用页的跨 tab 对照；combined screenshot 由两张真实运行截图组成，不是结构测试或截图差分 oracle。',
      observedAt: new Date().toISOString(),
    };
    writeJson('IA-32-cross-tab-dual-physical.json', artifact);
    upsertFrameEvidence(record, artifact);
  } else {
    markFrameOpen(
      record,
      'IA-32',
      'cross-tab-dual-physical',
      'IA-15 runtime 或 IA-16 topology 的真实截图缺失，无法形成跨 tab 对照。',
      target.role,
    );
  }
  captureStage2Screenshot(target, 0, 'dual-topology-unavailable');
  await stage2CloseAdmin(target);
};

const stage2OpenTopology = async (record, target) => {
  const current = await readStage2Ui(target, 0, 'stage2 topology preflight');
  if (
    nodeForId(current, 'terminal.admin:topology:title') !== null ||
    nodeForId(current, 'terminal.admin:topology:page-gate') !== null
  )
    return;
  if (nodeForId(current, 'terminal.admin:section:topology') !== null) {
    await tapStage2Node(target, 0, 'terminal.admin:section:topology');
  } else if (nodeForId(current, 'terminal.admin:navigation:trigger') !== null) {
    // Mobile uses the bounded dropdown navigation instead of the laptop
    // section grid. Select the real option exposed by the primitive; do not
    // invent laptop-only section nodes in the mobile UI hierarchy.
    await tapStage2Node(target, 0, 'terminal.admin:navigation:trigger');
    await tapStage2Node(target, 0, 'terminal.admin:navigation:option:admin.console.topology');
  } else {
    throw new RunnerFailure(
      `${target.tag} topology navigation`,
      'neither laptop section nor mobile navigation trigger was observable',
    );
  }
  // The navigation button remains mounted and selected while the content
  // section is switching. Waiting for that already-present node can observe
  // the previous runtime section and turn a real page transition into a
  // false missing-control failure. Wait for the topology page's own title,
  // then distinguish the unavailable page-gate contract from the available
  // page's result/feedback contract.
  const topology = await waitForStage2Node(target, 0, 'terminal.admin:topology:title');
  const unavailable = nodeForId(topology.xml, 'terminal.admin:topology:page-gate') !== null;
  const expectedIds = unavailable
    ? [
        'terminal.admin:section:topology',
        'terminal.admin:topology:content-root',
        'terminal.admin:topology:title',
        'terminal.admin:topology:page-gate',
        'terminal.admin:topology:page-gate-reason',
      ]
    : [
        'terminal.admin:section:topology',
        'terminal.admin:topology:content-root',
        'terminal.admin:topology:title',
        'terminal.admin:topology:pair-result',
        'terminal.admin:topology:goal-choice',
        'terminal.admin:topology:goal:host',
        'terminal.admin:topology:goal:slave',
      ];
  await observeStage2(
    record,
    target,
    0,
    'stage2-topology-open',
    [...expectedIds],
    unavailable ? ['当前功能不可用'] : [],
  );
};

const stage2TapVirtualText = async (target, displayId, value) => {
  const normalized = value.toLowerCase();
  if (value !== normalized) await tapStage2Node(target, displayId, 'ui.base.input:virtual-keyboard:shift');
  for (const character of normalized)
    await tapStage2Node(target, displayId, `ui.base.input:virtual-keyboard:text-${character}`);
};

const stage2FillStaffLogin = async target => {
  await waitForStage2Node(target, 0, 'sample.auth.login');
  await tapStage2Node(target, 0, 'sample.auth.login:operator-name');
  await stage2TapVirtualText(target, 0, 'A001');
  await tapStage2Node(target, 0, 'ui.base.input:virtual-keyboard:complete');
  await tapStage2Node(target, 0, 'sample.auth.login:passcode');
  await stage2TapVirtualText(target, 0, '1111');
  await tapStage2Node(target, 0, 'ui.base.input:virtual-keyboard:complete');
  await tapStage2Node(target, 0, 'sample.auth.login:submit');
  await waitForStage2Node(target, 0, 'sample.desk.member-list');
};

const stage2ColdLaunch = async target => {
  adb(target, ['shell', 'am', 'force-stop', target.profile.packageName], 'stage2 pre-run force-stop');
  adb(target, ['shell', 'pm', 'clear', target.profile.packageName], 'stage2 clear package state');
  adb(target, ['shell', 'am', 'start', '-W', '-n', target.profile.activity], 'stage2 cold launch release app');
  await waitForStage2Node(target, 0, 'terminal.admin:launcher');
  const process = processIdentity(target);
  if (process.pid === null || process.startTicks === null)
    throw new RunnerFailure(`${target.tag} stage2 process identity`, 'release app PID/start token was not readable');
  return process;
};

const stage2RestartAndCheckChief = async (record, target) => {
  adb(target, ['shell', 'am', 'force-stop', target.profile.packageName], 'stage2 dual-screen restart force-stop');
  adb(target, ['shell', 'am', 'start', '-W', '-n', target.profile.activity], 'stage2 dual-screen restart launch');
  await waitForStage2Node(target, 0, 'terminal.admin:launcher');
  await stage2OpenAdmin(record, target);
  await tapStage2Node(target, 0, 'terminal.admin:section:runtime');
  await observeStage2(
    record,
    target,
    0,
    'dual-screen-hydrate-chief',
    [
      'terminal.admin:frame:IA-15',
      'terminal.admin:runtime:surface-map',
      'terminal.admin:runtime:surface-map:surface:SECONDARY',
    ],
    ['2'],
  );
  captureStage2Screenshot(target, 0, 'dual-screen-hydrate-chief');
  progress(record, 'dual-screen-restart-restores-chief-master', {
    deviceRole: target.role,
    displayCount: 2,
    process: processIdentity(target),
  });
  await stage2CloseAdmin(target);
};

const stage2RunMemberJourney = async (record, target) => {
  const secondaryDisplayId = target.secondaryDisplayId;
  if (secondaryDisplayId === null)
    throw new RunnerFailure(`${target.tag} stage2 member journey`, 'secondary display id is unavailable');
  await stage2CloseAdmin(target);
  await stage2FillStaffLogin(target);
  await observeStage2(
    record,
    target,
    0,
    'local-dual-member-list-before-registration',
    ['sample.desk.member-list'],
    ['已登记会员'],
  );
  captureStage2Screenshot(target, 0, 'local-dual-member-list-before-registration');
  const masterList = await readStage2Ui(target, 0, 'stage2 find member add control');
  const addId =
    nodeForId(masterList, 'sample.desk.member-list:empty-action') === null
      ? 'sample.desk.member-list:add'
      : 'sample.desk.member-list:empty-action';
  await tapStage2Node(target, 0, addId);
  await waitForStage2Node(target, 0, 'sample.desk.member-form');
  await tapStage2Node(target, 0, 'sample.desk.member-form:name');
  await stage2TapVirtualText(target, 0, 'ALICE');
  await waitForStage2Node(target, 0, 'sample.desk.member-form:name', node => nodeText(node).includes('Alice'));
  await tapStage2Node(target, 0, 'ui.base.input:virtual-keyboard:complete');
  await tapStage2Node(target, 0, 'sample.desk.member-form:phone');
  await stage2TapVirtualText(target, 0, '01012345678');
  await waitForStage2Node(target, 0, 'sample.desk.member-form:phone', node => nodeText(node).includes('01012345678'));
  await submitMemberFormWithClosedKeyboard({
    tap: testId => tapStage2Node(target, 0, testId),
    waitForKeyboardClosed: () => waitForStage2Absent(target, 0, 'ui.base.input:virtual-keyboard:complete'),
  });
  await waitForStage2Node(target, 0, 'sample.desk.waiting-confirm');
  await observeStage2(
    record,
    target,
    0,
    'local-dual-member-waiting-on-primary',
    ['sample.desk.member-list', 'sample.desk.waiting-confirm'],
    ['已提交，等待顾客确认', 'Alice', '01012345678'],
  );
  captureStage2Screenshot(target, 0, 'local-dual-member-waiting-on-primary');
  await waitForStage2Node(target, secondaryDisplayId, 'sample.desk.customer-member');
  await observeStage2(
    record,
    target,
    secondaryDisplayId,
    'local-dual-member-confirmation-on-secondary',
    ['sample.desk.customer-member'],
    ['请确认登记', 'Alice', '01012345678'],
  );
  captureStage2Screenshot(target, secondaryDisplayId, 'local-dual-member-confirmation-on-secondary');
  progress(record, 'local-dual-member-pending-state', {
    primaryPartKey: 'sample.desk.waiting-confirm',
    secondaryPartKey: 'sample.desk.customer-member',
    secondaryDisplayId,
  });

  await tapStage2Node(target, secondaryDisplayId, 'sample.desk.customer-member:age');
  await tapStage2Node(target, secondaryDisplayId, 'ui.base.input:virtual-keyboard:text-3');
  await tapStage2Node(target, secondaryDisplayId, 'ui.base.input:virtual-keyboard:text-7');
  await tapStage2Node(target, secondaryDisplayId, 'ui.base.input:virtual-keyboard:complete');
  await tapStage2Node(target, secondaryDisplayId, 'sample.desk.customer-member:confirm');
  await waitForStage2Node(target, 0, 'sample.desk.member-list:row');
  await observeStage2(
    record,
    target,
    0,
    'local-dual-member-confirmed-on-primary',
    ['sample.desk.member-list', 'sample.desk.member-list:row'],
    ['已登记会员', 'Alice', '01012345678'],
  );
  captureStage2Screenshot(target, 0, 'local-dual-member-confirmed-on-primary');
  await waitForStage2Node(target, secondaryDisplayId, 'sample.desk.customer-welcome');
  await observeStage2(
    record,
    target,
    secondaryDisplayId,
    'local-dual-member-welcome-on-secondary',
    ['sample.desk.customer-welcome'],
    ['欢迎，请等待店员操作'],
  );
  captureStage2Screenshot(target, secondaryDisplayId, 'local-dual-member-welcome-on-secondary');
  progress(record, 'local-dual-member-confirmed-state', {
    primaryPartKey: 'sample.desk.member-list',
    secondaryPartKey: 'sample.desk.customer-welcome',
    secondaryDisplayId,
  });

  adb(
    target,
    ['shell', 'am', 'force-stop', target.profile.packageName],
    'stage2 authenticated cold restart force-stop',
  );
  adb(target, ['shell', 'am', 'start', '-W', '-n', target.profile.activity], 'stage2 authenticated cold restart');
  await waitForStage2Node(target, 0, 'sample.desk.member-list:row');
  await observeStage2(
    record,
    target,
    0,
    'local-dual-authenticated-state-after-cold-restart-primary',
    ['sample.desk.member-list', 'sample.desk.member-list:row'],
    ['Alice', '01012345678'],
  );
  await waitForStage2Node(target, secondaryDisplayId, 'sample.desk.customer-welcome');
  await observeStage2(
    record,
    target,
    secondaryDisplayId,
    'local-dual-authenticated-state-after-cold-restart-secondary',
    ['sample.desk.customer-welcome'],
    ['欢迎，请等待店员操作'],
  );
  captureStage2Screenshot(target, 0, 'local-dual-authenticated-state-after-cold-restart-primary');
  captureStage2Screenshot(target, secondaryDisplayId, 'local-dual-authenticated-state-after-cold-restart-secondary');
  progress(record, 'local-dual-authenticated-state-restored-after-cold-restart', {
    primaryPartKey: 'sample.desk.member-list',
    secondaryPartKey: 'sample.desk.customer-welcome',
    process: processIdentity(target),
  });
};

const stage1MemberLabels = [
  'member-list-before-registration',
  'member-waiting-on-master',
  'member-confirmation-on-slave',
  'member-confirmed-on-master',
  'member-welcome-on-slave',
  'authenticated-state-after-cold-restart',
];

const loadLatestStage1MemberReference = () => {
  const root = path.join(repositoryRoot, '.runtime/ter-dual-machine-topology/2026-09-17/cp5');
  if (!fs.existsSync(root)) return null;
  const candidates = fs
    .readdirSync(root, {withFileTypes: true})
    .filter(entry => entry.isDirectory() && entry.name.startsWith('stage1-'))
    .map(entry => path.join(root, entry.name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  for (const candidate of candidates) {
    const resultPath = path.join(candidate, 'sample-terminal', 'result.json');
    if (!fs.existsSync(resultPath)) continue;
    try {
      const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
      const labels = result.steps.filter(step => stage1MemberLabels.includes(step.label)).map(step => step.label);
      if (result.business !== 'PASS' || result.cleanup !== 'PASS' || labels.length !== stage1MemberLabels.length)
        continue;
      return {path: path.relative(repositoryRoot, resultPath), labels};
    } catch {
      continue;
    }
  }
  return null;
};

const compareStage2MemberJourney = record => {
  const reference = loadLatestStage1MemberReference();
  const observed = record.steps.filter(step => step.label.startsWith('local-dual-')).map(step => step.label);
  const required = [
    'local-dual-member-list-before-registration',
    'local-dual-member-waiting-on-primary',
    'local-dual-member-confirmation-on-secondary',
    'local-dual-member-confirmed-on-primary',
    'local-dual-member-welcome-on-secondary',
    'local-dual-authenticated-state-after-cold-restart-primary',
    'local-dual-authenticated-state-after-cold-restart-secondary',
  ];
  const missing = required.filter(label => !observed.includes(label));
  const result =
    reference !== null && reference.labels.length === stage1MemberLabels.length && missing.length === 0
      ? 'MATCHED'
      : 'OPEN';
  const comparison = {
    result,
    reference,
    stage1Labels: stage1MemberLabels,
    stage2Labels: observed,
    requiredStage2Labels: required,
    missing,
    note: '逐步对照比较业务 partKey/state 的设备观察；不是截图差分或结构 mock。',
  };
  writeJson('stage2-member-stepwise-comparison.json', comparison);
  if (result !== 'MATCHED')
    throw new RunnerFailure(
      'stage2 member stepwise comparison',
      `stage1 reference or required local dual steps are incomplete: missing=${missing.join(',') || 'none'}`,
    );
  return comparison;
};

const stage2RunMobileTopology = async (record, target) => {
  await stage2OpenAdmin(record, target);
  await stage2CaptureRuntime(record, target);
  await stage2CapturePorts(record, target);
  await stage2OpenTopology(record, target);
  await captureStage2Frame(
    record,
    target,
    'IA-17',
    'mobile-topology-tab-visible',
    [
      'terminal.admin:section:topology',
      'terminal.admin:topology:content-root',
      'terminal.admin:topology:title',
      'terminal.admin:topology:page-gate',
      'terminal.admin:topology:page-gate-reason',
    ],
    ['mobile 形态不支持双机拓扑'],
  );
  const controls = [
    'terminal.admin:topology:host',
    'terminal.admin:topology:pair',
    'terminal.admin:topology:unpair',
    'terminal.admin:topology:enable',
  ];
  const absent = [];
  for (const id of controls) {
    await waitForStage2Absent(target, 0, id);
    absent.push({id, present: false});
  }
  captureStage2Screenshot(target, 0, 'mobile-topology-tab-visible-disabled');
  progress(record, 'mobile-topology-tab-visible-with-readable-reason-and-absent-actions', {
    deviceRole: target.role,
    absent,
  });
  await stage2CloseAdmin(target);
};

const openAdmin = async (record, target) => {
  let current = await readUi(target, 'open admin preflight');
  if (nodeForId(current, 'terminal.admin:shell') !== null) return;
  if (nodeForId(current, 'terminal.admin:login') === null) {
    const launcher = await waitForNode(target, 'terminal.admin:launcher');
    // AdminLauncher intentionally accepts only the top-left 96x96 logical
    // gesture area.  A full-screen center tap is outside that contract even
    // though the launcher View itself spans the whole surface.
    const x = launcher.node.left + 48;
    const y = launcher.node.top + 48;
    const started = Date.now();
    for (let index = 0; index < 5; index += 1) {
      adb(target, ['shell', 'input', 'tap', String(x), String(y)], `admin launcher tap ${index + 1}`);
      await sleep(110);
    }
    if (Date.now() - started >= 1_800)
      throw new RunnerFailure(`${target.tag} admin launcher`, 'five-tap gesture exceeded its time window');
  }
  // The login shell can mount before its debug-password instruction has been
  // rendered. Wait for the actual six-digit text, not merely the login node,
  // so a re-entry after a runtime reset cannot consume a partially rendered
  // accessibility tree.
  current = (
    await waitForNode(target, 'terminal.admin:login', (_node, xml) => /请输入(?:六位)?动态口令（\d{6}）/.test(xml))
  ).xml;
  await captureVisiblePanelFrame(record, target, 'IA-03', 'panel-empty-before-auth', [
    'terminal.admin:panel:empty',
    'terminal.admin:panel:empty:reason',
  ]);
  await captureVisiblePanelFrame(record, target, 'IA-05', 'panel-loading-before-auth', [
    'terminal.admin:panel:loading',
    'terminal.admin:panel:loading:content',
    'terminal.admin:panel:loading:spinner',
    'terminal.admin:panel:loading:skeleton',
    'terminal.admin:panel:loading:message',
  ]);
  await captureVisiblePanelFrame(record, target, 'IA-07', 'panel-error-before-auth', [
    'terminal.admin:panel:error',
    'terminal.admin:panel:error:content',
    'terminal.admin:panel:error:reason',
    'terminal.admin:panel:retry',
  ]);
  // Android accessibility may flatten the nested debug-password Text node
  // into the instruction node, so the release observation is keyed by the
  // visible six-digit instruction rather than by the nested resource-id.
  const password = current.match(/请输入(?:六位)?动态口令（(\d{6})）/)?.[1] ?? null;
  if (password === null)
    throw new RunnerFailure(`${target.tag} admin login`, 'debug password display was not available in the release app');
  for (const digit of password) {
    await tapNode(target, `ui.base.input:virtual-keyboard:text-${digit}`, {settleDelayMs: 0});
  }
  // The shared virtual keyboard owns the final input focus.  Its complete
  // action closes the keyboard before the verify button can receive a real
  // surface tap; tapping the button while the keyboard is still present hits
  // the covered numeric-key region instead of the admin action.
  await tapNode(target, 'ui.base.input:virtual-keyboard:complete', {settleDelayMs: 0});
  await waitForNode(target, 'terminal.admin:verify', current => current.enabled);
  await tapNode(target, 'terminal.admin:verify');
  await waitForNode(target, 'terminal.admin:shell');
  await captureVisiblePanelFrame(record, target, 'IA-03', 'panel-empty-after-auth', [
    'terminal.admin:panel:empty',
    'terminal.admin:panel:empty:reason',
  ]);
  await captureVisiblePanelFrame(record, target, 'IA-05', 'panel-loading-after-auth', [
    'terminal.admin:panel:loading',
    'terminal.admin:panel:loading:content',
    'terminal.admin:panel:loading:spinner',
    'terminal.admin:panel:loading:skeleton',
    'terminal.admin:panel:loading:message',
  ]);
  await captureVisiblePanelFrame(record, target, 'IA-07', 'panel-error-after-auth', [
    'terminal.admin:panel:error',
    'terminal.admin:panel:error:content',
    'terminal.admin:panel:error:reason',
    'terminal.admin:panel:retry',
  ]);
  await captureAdminFrame(record, target, 'IA-01', 'panel-normal', [
    'terminal.admin:shell:header',
    'terminal.admin:shell:brand',
    'terminal.admin:shell:overall-status',
  ]);
  record.timeline.push({
    label: 'admin-authenticated',
    deviceRole: target.role,
    timestamp: new Date().toISOString(),
    debugPasswordObserved: true,
  });
};

const closeAdmin = async target => {
  await tapNode(target, 'terminal.admin:close');
  await waitForAbsent(target, 'ui-base-render:layer:admin.console.layer');
};

const openTopology = async (record, target) => {
  const current = await readUi(target, 'topology preflight');
  if (
    nodeForId(current, 'terminal.admin:topology:title') !== null ||
    nodeForId(current, 'terminal.admin:topology:page-gate') !== null
  )
    return;
  await tapNode(target, 'terminal.admin:section:topology');
  // Wait for page content, not the selected navigation button, to prove that
  // the route changed. The two controls now have distinct test IDs.
  await waitForNode(target, 'terminal.admin:topology:title');
  await observe(record, target, 'topology-open', [
    'terminal.admin:section:topology',
    'terminal.admin:topology:content-root',
    'terminal.admin:topology:title',
  ]);
};

const assertTopologyValue = async (record, target, label, id, text) => {
  const observed = await waitForNode(target, id);
  if (hasExactScopedResourceText(observed.xml, id, text)) {
    recordObservation(record, target, label, observed.xml, [id], [text]);
    return;
  }

  // Some admin primitives (PrimitiveStatusLine and PrimitiveFactGrid) paint
  // their values into the surface but expose only an empty ViewGroup to
  // Android's accessibility tree. Do not turn that platform limitation into
  // a product failure: keep the structural node observation and bind the
  // expected visible value to a screenshot for post-run visual verification.
  recordObservation(record, target, label, observed.xml, [id]);
  const screenshot = captureStage1Screenshot(target, `${label}-visual-state`);
  const step = record.steps.at(-1);
  step.visualExpectedText = sanitizeDiagnostic(text);
  step.visualVerification = 'REVIEW_REQUIRED';
  step.screenshot = screenshot;
};

const assertTopologySnapshot = async (record, target, label, expected) => {
  const observed = await waitForNode(target, 'terminal.admin:topology:pair-state', (_node, xml) => {
    const snapshot = readHeartbeatTopologyFromXml(xml);
    return Object.entries(expected).every(([key, value]) => snapshot[key] === value);
  });
  const snapshot = readHeartbeatTopologyFromXml(observed.xml);
  recordObservation(record, target, label, observed.xml, [
    'terminal.admin:topology:pair-state',
    'terminal.admin:topology:reachability',
    'terminal.admin:topology:role',
  ]);
  Object.assign(record.steps.at(-1), {
    expectedTopology: expected,
    observedTopology: snapshot,
  });
};

const endpointRequest = (method, pathName, body = undefined) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const finishResolve = value => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const finishReject = error => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const request = http.request(
      {
        host: '127.0.0.1',
        port: hostBridgePort,
        path: `${topologyBasePath}${pathName}`,
        method,
        ...(body === undefined ? {} : {headers: {'content-length': Buffer.byteLength(body)}}),
      },
      response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(Buffer.from(chunk)));
        response.on('end', () => {
          const responseText = Buffer.concat(chunks).toString('utf8');
          request.destroy();
          finishResolve({
            status: response.statusCode ?? 0,
            bodyBytes: Buffer.byteLength(responseText),
            body: responseText,
          });
        });
        response.on('error', finishReject);
      },
    );
    request.setTimeout(4_000, () => finishReject(new Error('topology endpoint request timeout')));
    request.on('error', finishReject);
    if (body !== undefined) request.write(body);
    request.end();
  });

let topologyBridge = null;

const ensureForward = async (master, record) => {
  const forwards = textOf(localRun('adb', ['forward', '--list'], 'ADB forward inventory', {allowFailure: true}));
  if (new RegExp(`\\btcp:${topologyUpstreamPort}\\b`).test(forwards)) {
    throw new RunnerFailure(
      'ADB topology forward preflight',
      `topology upstream port ${topologyUpstreamPort} already has a pre-existing forward`,
    );
  }
  adb(
    master,
    ['forward', `tcp:${topologyUpstreamPort}`, `tcp:${topologyPort}`],
    'create owned topology upstream forward',
  );
  record.resources.forwardOwned = true;
  record.resources.forward = `tcp:${topologyUpstreamPort}->tcp:${topologyPort}`;
  topologyBridge = createTcpBridge({
    listenHost: '127.0.0.1',
    listenPort: hostBridgePort,
    targetHost: '127.0.0.1',
    targetPort: topologyUpstreamPort,
  });
  const address = await topologyBridge.listen();
  record.resources.bridge = {
    host: address.host,
    port: address.port,
    upstreamPort: topologyUpstreamPort,
    activeConnections: 0,
  };
  appendCommandLog({
    phase: 'device-observation',
    deviceRole: null,
    label: 'start owned topology TCP bridge',
    command: 'node:net.createServer',
    argumentCount: 0,
    status: 0,
    result: 'passed',
    timedOut: false,
    stdoutBytes: 0,
    stderr: '',
    durationMs: 0,
  });
};

const ensureReverse = (slave, record) => {
  const reverses = textOf(adb(slave, ['reverse', '--list'], 'ADB reverse inventory', {allowFailure: true}));
  if (new RegExp(`\\btcp:${topologyPort}\\b`).test(reverses)) {
    throw new RunnerFailure(
      'ADB topology reverse preflight',
      `device topology port ${topologyPort} already has a pre-existing reverse`,
    );
  }
  adb(slave, ['reverse', `tcp:${topologyPort}`, `tcp:${hostBridgePort}`], 'create owned slave topology reverse');
  record.resources.reverseOwned = true;
  record.resources.reverse = `tcp:${topologyPort}->tcp:${hostBridgePort}`;
};

const suspendOwnedReverseForPairFailure = (slave, record) => {
  if (record.resources.reverseOwned !== true || record.resources.reverseSuspended === true) {
    throw new RunnerFailure('direct-pair failure mutation', 'owned slave topology reverse was not active');
  }
  adb(
    slave,
    ['reverse', '--remove', `tcp:${topologyPort}`],
    'suspend owned slave topology reverse for direct-pair failure',
  );
  record.resources.reverseSuspended = true;
  appendCommandLog({
    phase: 'device-mutation',
    deviceRole: slave.role,
    label: 'suspend owned slave topology reverse for direct-pair failure',
    command: 'adb',
    argumentCount: 5,
    status: 0,
    result: 'passed',
    timedOut: false,
    stdoutBytes: 0,
    stderr: '',
    durationMs: 0,
  });
};

const restoreOwnedReverseAfterPairFailure = (slave, record) => {
  if (record.resources.reverseOwned !== true || record.resources.reverseSuspended !== true) return;
  adb(
    slave,
    ['reverse', `tcp:${topologyPort}`, `tcp:${hostBridgePort}`],
    'restore owned slave topology reverse after direct-pair failure',
  );
  record.resources.reverseSuspended = false;
  appendCommandLog({
    phase: 'device-mutation',
    deviceRole: slave.role,
    label: 'restore owned slave topology reverse after direct-pair failure',
    command: 'adb',
    argumentCount: 5,
    status: 0,
    result: 'passed',
    timedOut: false,
    stdoutBytes: 0,
    stderr: '',
    durationMs: 0,
  });
};

const interruptTopologyBridge = (record, reason) => {
  if (topologyBridge === null || record.resources.bridge === null) {
    throw new RunnerFailure('disconnect/reconnect', 'owned topology TCP bridge is not active');
  }
  const closedConnections = topologyBridge.pause();
  if (closedConnections < 1)
    throw new RunnerFailure('disconnect/reconnect', 'no established topology TCP session was available to interrupt');
  record.resources.bridge.activeConnections = topologyBridge.activeConnections;
  record.resources.bridge.lastInterruption = {reason, closedConnections, at: new Date().toISOString()};
  appendCommandLog({
    phase: 'device-mutation',
    deviceRole: null,
    label: 'interrupt established topology TCP sessions',
    command: 'runner-owned TCP bridge pause',
    argumentCount: 0,
    status: 0,
    result: 'passed',
    timedOut: false,
    stdoutBytes: 0,
    stderr: '',
    durationMs: 0,
  });
};

const resumeTopologyBridge = (record, reason) => {
  if (topologyBridge === null || record.resources.bridge === null) {
    throw new RunnerFailure('disconnect/reconnect', 'owned topology TCP bridge is not active');
  }
  topologyBridge.resume();
  record.resources.bridge.resumedAt = new Date().toISOString();
  record.resources.bridge.resumeReason = reason;
  appendCommandLog({
    phase: 'device-mutation',
    deviceRole: null,
    label: 'resume topology TCP sessions',
    command: 'runner-owned TCP bridge resume',
    argumentCount: 0,
    status: 0,
    result: 'passed',
    timedOut: false,
    stdoutBytes: 0,
    stderr: '',
    durationMs: 0,
  });
};

const startPortOccupant = async (target, record) => {
  if (record.resources.portOccupant?.owned === true)
    throw new RunnerFailure('host service red mutation', 'owned port occupant is already active');
  const listeners = textOf(adb(target, ['shell', 'ss', '-ltn'], 'host service port preflight', {allowFailure: true}));
  if (new RegExp(`:${topologyPort}\\b`).test(listeners))
    throw new RunnerFailure(
      'host service port preflight',
      `topology port ${topologyPort} is already occupied by an unknown process`,
    );
  const child = spawn('adb', ['-s', target.serial, 'shell', 'toybox', 'nc', '-l', '-p', String(topologyPort)], {
    cwd: repositoryRoot,
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  target.portOccupantProcess = child;
  await sleep(800);
  if (child.exitCode !== null || child.killed === true) {
    target.portOccupantProcess = null;
    throw new RunnerFailure(
      'host service red mutation',
      `owned ADB port occupant exited before host-service attempt: code=${child.exitCode ?? 'unknown'}`,
    );
  }
  const liveListeners = textOf(
    adb(target, ['shell', 'ss', '-ltn'], 'verify owned host service port listener', {allowFailure: true}),
  );
  if (!new RegExp(`:${topologyPort}\\b`).test(liveListeners)) {
    child.kill('SIGTERM');
    target.portOccupantProcess = null;
    throw new RunnerFailure(
      'host service red mutation',
      `owned ADB port occupant did not expose listener ${topologyPort}`,
    );
  }
  appendCommandLog({
    phase: 'device-mutation',
    deviceRole: target.role,
    label: 'start owned host service port occupant',
    command: 'adb',
    argumentCount: 7,
    status: 0,
    result: 'passed',
    timedOut: false,
    stdoutBytes: 0,
    stderrBytes: '',
    durationMs: 800,
  });
  record.resources.portOccupant = {
    owned: true,
    deviceRole: target.role,
    localPid: child.pid ?? null,
    port: topologyPort,
    command: 'adb shell toybox nc -l -p <topologyPort>',
    stdinHeldOpen: true,
  };
  writeJson('port-occupant.json', record.resources.portOccupant);
};

const stopPortOccupant = async (target, record) => {
  const occupant = record.resources.portOccupant;
  if (occupant?.owned !== true) return;
  const child = target.portOccupantProcess;
  if (child !== null) {
    child.stdin?.end();
    if (child.exitCode === null) child.kill('SIGTERM');
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 2_000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    if (child.exitCode === null) child.kill('SIGKILL');
    target.portOccupantProcess = null;
  }
  const listeners = textOf(
    adb(target, ['shell', 'ss', '-ltn'], 'verify owned host service port listener stopped', {allowFailure: true}),
  );
  if (new RegExp(`:${topologyPort}\\b`).test(listeners))
    throw new RunnerFailure('host service red mutation cleanup', `owned port listener ${topologyPort} remains`);
  appendCommandLog({
    phase: 'device-mutation',
    deviceRole: target.role,
    label: 'stop owned host service port occupant',
    command: 'adb',
    argumentCount: 5,
    status: 0,
    result: 'passed',
    timedOut: false,
    stdoutBytes: 0,
    stderrBytes: '',
    durationMs: 0,
  });
  record.resources.portOccupant = {...occupant, owned: false, stoppedAt: new Date().toISOString()};
  writeJson('port-occupant.json', record.resources.portOccupant);
};

const probeEndpointBoundary = async record => {
  const identity = await endpointRequest('GET', '/status');
  let parsed;
  try {
    parsed = JSON.parse(identity.body);
  } catch {
    parsed = null;
  }
  if (
    identity.status !== 200 ||
    parsed?.type !== 'identity' ||
    parsed?.protocolVersion !== 1 ||
    parsed?.instanceMode !== 'MASTER' ||
    parsed?.displayRole !== 'CHIEF'
  ) {
    throw new RunnerFailure(
      'topology identity endpoint',
      'status endpoint did not return the expected master identity contract',
    );
  }
  const probes = [
    {method: 'POST', path: ''},
    {method: 'PUT', path: ''},
    {method: 'DELETE', path: ''},
  ];
  for (const pathName of ['/start', '/stop', '/pair', '/unpair', '/config'])
    probes.push({method: 'POST', path: pathName});
  const results = [];
  for (const probe of probes) {
    const result = await endpointRequest(probe.method, probe.path);
    if (result.status >= 200 && result.status < 300)
      throw new RunnerFailure(
        'topology mutation endpoint probe',
        'an unauthenticated mutation-like request unexpectedly succeeded',
      );
    results.push({method: probe.method, path: probe.path, status: result.status, bodyBytes: result.bodyBytes});
  }
  record.endpoint = {
    identity: {
      status: identity.status,
      bodyBytes: identity.bodyBytes,
      type: parsed.type,
      protocolVersion: parsed.protocolVersion,
      instanceMode: parsed.instanceMode,
      displayRole: parsed.displayRole,
    },
    mutationProbes: results,
  };
  writeJson('endpoint-probe.json', record.endpoint);
};

const installProfile = async target => {
  const local = localApkBinding(target.profile);
  if (!local.exists) throw new RunnerFailure(`${target.tag} release install`, `APK missing: ${local.path}`);
  const install = adb(target, ['install', '-r', target.profile.apk], 'install release APK');
  writeText(`${target.tag}-release-install.txt`, sanitizeDiagnostic(textOf(install)));
  const installed = installedApkBinding(target);
  assertApkBinding(local, installed, `${target.tag} APK binding`);
  return {local, installed};
};

const coldLaunch = async target => {
  adb(target, ['shell', 'am', 'force-stop', target.profile.packageName], 'pre-run force-stop');
  adb(target, ['shell', 'pm', 'clear', target.profile.packageName], 'clear package state');
  adb(target, ['shell', 'am', 'start', '-W', '-n', target.profile.activity], 'cold launch release app');
  await waitForNode(target, 'terminal.admin:launcher');
  const process = processIdentity(target);
  if (process.pid === null || process.startTicks === null)
    throw new RunnerFailure(`${target.tag} process identity`, 'release app PID/start token was not readable');
  return process;
};

const restartAndCheckHost = async (record, target) => {
  adb(target, ['shell', 'am', 'force-stop', target.profile.packageName], 'JS/runtime restart force-stop');
  adb(target, ['shell', 'am', 'start', '-W', '-n', target.profile.activity], 'JS/runtime restart launch');
  await waitForNode(target, 'terminal.admin:launcher');
  await openAdmin(record, target);
  await openTopology(record, target);
  await assertTopologyValue(
    record,
    target,
    'host-after-js-restart',
    'terminal.admin:topology:host-service:state',
    '运行中',
  );
  progress(record, 'host-desired-actual-js-restart', {deviceRole: target.role, process: processIdentity(target)});
};

const fillHost = async target => {
  await tapNode(target, 'terminal.admin:topology:host');
  // Topology uses the same terminal-owned virtual keyboard as every other
  // input field. Do not inject through Android's IME: PrimitiveInput
  // deliberately disables the system keyboard, and the shared field is the
  // source of truth for both visible value and input snapshots.
  for (const character of hostAliasForAndroidEmulator) {
    await tapNode(target, `ui.base.input:virtual-keyboard:text-${character}`);
  }
  await tapNode(target, 'ui.base.input:virtual-keyboard:complete');
  await waitForNode(target, 'terminal.admin:topology:pair', node => node.enabled);
};

const replaceHost = async (target, value) => {
  await tapNode(target, 'terminal.admin:topology:host');
  // Read the real terminal-owned input value before clearing. A fixed
  // backspace count made the device evidence look like the runner was stuck
  // pressing backspace and added needless UI action/observation races.
  const current = await readUi(target, 'read topology host before replacement');
  const currentValue = nodeText(nodeForId(current, 'terminal.admin:topology:host'));
  const clearCount = Math.min(32, currentValue.length);
  for (let index = 0; index < clearCount; index += 1) await tapNode(target, 'ui.base.input:virtual-keyboard:backspace');
  for (const character of value) await tapNode(target, `ui.base.input:virtual-keyboard:text-${character}`);
  await tapNode(target, 'ui.base.input:virtual-keyboard:complete');
  await waitForPairSubmissionControl(target);
};

const waitForPairSubmissionControl = async target => {
  const pairId = 'terminal.admin:topology:pair';
  const retryId = 'terminal.admin:topology:retry';
  const deadline = Date.now() + 20_000;
  let lastXml = '';
  while (Date.now() < deadline) {
    lastXml = await readUi(target, 'wait direct pair submission control');
    const retry = nodeForId(lastXml, retryId);
    if (retry !== null && retry.enabled) return retryId;
    const pair = nodeForId(lastXml, pairId);
    if (pair !== null && pair.enabled) return pairId;
    await sleep(300);
  }
  saveUi(target, 'wait-failed-direct-pair-submission-control', lastXml);
  throw new RunnerFailure(
    `${target.tag} direct pair submission control`,
    'neither retry nor pair control became enabled',
  );
};

const pairDevices = async (record, master, slave) => {
  await openAdmin(record, master);
  await openTopology(record, master);
  await captureAdminFrame(
    record,
    master,
    'IA-18',
    'topology-role-choice',
    ['terminal.admin:topology:goal-choice', 'terminal.admin:topology:goal:host', 'terminal.admin:topology:goal:slave'],
    [],
    {required: true},
  );
  await tapNode(master, 'terminal.admin:section:platform-ports');
  await captureAdminFrame(record, master, 'IA-09', 'ports-overview', ['terminal.admin:ports:summary:ratio-bar'], [], {
    required: true,
  });
  await tapNode(master, 'terminal.admin:ports:category:logs:expand', {
    scrollIntoView: true,
    scrollResourceId: 'admin.console.platform-ports:scroll',
  });
  const portDetailIds = await discoverPortDetailIds(master, 'discover stage1 expanded logs capability rows');
  await captureStage1ScrolledFrame(
    record,
    master,
    'IA-11',
    'ports-logs-expanded',
    [
      'terminal.admin:section:platform-ports',
      'terminal.admin:ports:title',
      'terminal.admin:ports:overall-status',
      'admin.console.platform-ports:total',
      'terminal.admin:ports:summary:ratio-bar',
      'terminal.admin:ports:category:logs:row',
    ],
    portDetailIds,
    'admin.console.platform-ports:scroll',
  );
  await tapNode(master, 'terminal.admin:section:runtime');
  await captureStage1ScrolledFrame(
    record,
    master,
    'IA-13',
    'runtime-single-surface',
    [
      'terminal.admin:section:runtime',
      'terminal.admin:runtime:title',
      'terminal.admin:runtime:overall-status',
      'admin.console.runtime:facts',
      'terminal.admin:runtime:surface-map',
      'terminal.admin:runtime:physical-display-count',
      'terminal.admin:runtime:surface-map:surface:PRIMARY',
    ],
    [
      'terminal.admin:runtime:surface-map:surface:PRIMARY:outside:0',
      'terminal.admin:runtime:surface-map:surface:PRIMARY:logic-width',
      'terminal.admin:runtime:surface-map:surface:PRIMARY:logic-height',
      'terminal.admin:runtime:surface-map:surface:PRIMARY:inside:0',
      'terminal.admin:runtime:surface-map:surface:PRIMARY:inside:1',
      'terminal.admin:runtime:surface-map:surface:PRIMARY:outside:1',
      'terminal.admin:runtime:surface:legend',
    ],
    'admin.console.runtime:scroll',
  );
  await tapNode(master, 'terminal.admin:section:topology');
  // PrimitiveStatusLine is painted into the app surface and does not expose
  // its copy in Android's UI hierarchy.  The role-choice screen and its
  // actionable host/slave controls are the machine-readable unpaired-state
  // oracle; the screenshot remains the visual copy evidence.
  await observe(record, master, 'master-host-initially-stopped', [
    'terminal.admin:frame:IA-18',
    'terminal.admin:topology:goal-choice',
    'terminal.admin:topology:goal:host',
    'terminal.admin:topology:action:host-enable',
    'terminal.admin:topology:goal:slave',
    'terminal.admin:topology:host',
  ]);
  const initialTopology = await readUi(master, 'verify master starts from unpaired role-choice');
  if (
    nodeForId(initialTopology, 'terminal.admin:topology:pair-state') !== null ||
    nodeForId(initialTopology, 'terminal.admin:topology:host-service:state') !== null
  ) {
    throw new RunnerFailure('master initial topology state', 'role-choice screen conflicts with paired/host state');
  }
  await startPortOccupant(master, record);
  await tapNode(master, 'terminal.admin:topology:action:host-enable', {scrollIntoView: true, settleDelayMs: 0});
  await captureAdminFrame(
    record,
    master,
    'IA-19',
    'host-starting',
    ['terminal.admin:topology:host-service', 'terminal.admin:topology:host-service:state'],
    [],
    {timeoutMs: 2_000},
  );
  // IA-21 paints the error copy into the surface, so uiautomator exposes the
  // alert and retry controls but not PrimitiveStatusLine/PrimitiveText values.
  // Wait on those stable controls; captureAdminFrame below records the visible
  // error copy and the run logcat retains the typed host failure evidence.
  await waitForNode(
    master,
    'terminal.admin:topology:alert',
    (_node, xml) =>
      nodeForId(xml, 'terminal.admin:topology:failure:reason') !== null &&
      nodeForId(xml, 'terminal.admin:topology:retry') !== null,
    10_000,
  );
  await captureAdminFrame(
    record,
    master,
    'IA-21',
    'host-error',
    ['terminal.admin:topology:host-service', 'terminal.admin:topology:failure:reason', 'terminal.admin:topology:retry'],
    [],
    {required: true},
  );
  await stopPortOccupant(master, record);
  await tapNode(master, 'terminal.admin:topology:retry', {settleDelayMs: 0});
  await captureAdminFrame(
    record,
    master,
    'IA-19',
    'host-retry-starting',
    ['terminal.admin:topology:host-service:state'],
    [],
    {timeoutMs: 2_000},
  );
  await assertTopologyValue(
    record,
    master,
    'master-host-running',
    'terminal.admin:topology:host-service:state',
    '运行中',
  );
  await captureAdminFrame(
    record,
    master,
    'IA-20',
    'host-ready',
    [
      'terminal.admin:topology:host-service',
      'terminal.admin:topology:host-service:state',
      'terminal.admin:topology:host-ip',
    ],
    [],
    {required: true},
  );
  await ensureForward(master, record);
  ensureReverse(slave, record);
  await probeEndpointBoundary(record);
  progress(record, 'master-host-started-via-enable-slave-chain', {
    deviceRole: 'master',
    process: processIdentity(master),
  });

  await restartAndCheckHost(record, master);
  await openAdmin(record, slave);
  await openTopology(record, slave);
  suspendOwnedReverseForPairFailure(slave, record);
  try {
    await replaceHost(slave, directPairFailureHost);
    await tapNode(slave, 'terminal.admin:topology:pair', {settleDelayMs: 0});
    await waitForNode(slave, 'terminal.admin:frame:IA-23', () => true, 15_000);
    await captureAdminFrame(
      record,
      slave,
      'IA-23',
      'direct-pair-error',
      ['terminal.admin:topology:failure:reason', 'terminal.admin:topology:alert', 'terminal.admin:topology:retry'],
      [],
      {required: true},
    );
  } finally {
    restoreOwnedReverseAfterPairFailure(slave, record);
  }
  await replaceHost(slave, hostAliasForAndroidEmulator);
  await tapNode(slave, await waitForPairSubmissionControl(slave), {scrollIntoView: true, settleDelayMs: 0});
  await waitForNode(slave, 'terminal.admin:frame:IA-22');
  await captureAdminFrame(
    record,
    slave,
    'IA-22',
    'direct-pair-submitted',
    [
      'terminal.admin:topology:pairing',
      'terminal.admin:topology:pair-state',
      'terminal.admin:topology:pairing:facts',
      'terminal.admin:topology:host-ip',
      'terminal.admin:topology:role',
      'terminal.admin:topology:pairing:hint',
    ],
    [],
    {required: true},
  );
  // Pairing resets the slave JS runtime into its VICE surface.  A clean
  // slave has no active customer workflow, so its post-reset content is the
  // valid content failure `container-empty: main`, not `sample.auth.login`.
  // Wait for the admin shell to be unloaded; openAdmin then deliberately
  // reopens the login flow and authenticates it through the real UI.
  await waitForAdminLayerReset(slave);
  progress(record, 'identity-before-ws-pair-and-slave-reset', {
    deviceRole: 'slave',
    slaveProcess: processIdentity(slave),
  });

  await openAdmin(record, slave);
  await openTopology(record, slave);
  await assertTopologyValue(record, slave, 'slave-paired', 'terminal.admin:topology:pair-state', '已配对');
  await assertTopologyValue(record, slave, 'slave-reachable', 'terminal.admin:topology:reachability', '可达');
  await assertTopologyValue(record, slave, 'slave-role-after-pair', 'terminal.admin:topology:role', '副机');

  await assertTopologyValue(record, master, 'master-paired', 'terminal.admin:topology:pair-state', '已配对');
  await assertTopologyValue(record, master, 'master-peer-reachable', 'terminal.admin:topology:reachability', '可达');
  await captureAdminFrame(
    record,
    master,
    'IA-24',
    'master-paired-reachable',
    [
      'terminal.admin:topology:pairing',
      'terminal.admin:topology:reachability',
      'terminal.admin:topology:counterparty',
      'terminal.admin:topology:unpair',
    ],
    [],
    {required: true},
  );
  await captureAdminFrame(
    record,
    slave,
    'IA-27',
    'slave-paired-reachable',
    [
      'terminal.admin:topology:pairing',
      'terminal.admin:topology:reachability',
      'terminal.admin:topology:counterparty',
      'terminal.admin:topology:unpair',
    ],
    [],
    {required: true},
  );
  await probeRoleOccupancy(record);
  await closeAdmin(slave);
  progress(record, 'single-master-single-slave-role-occupancy', {deviceRole: 'master'});
};

const probeRoleOccupancy = async record => {
  const socket = new WebSocket(`ws://127.0.0.1:${hostBridgePort}${topologyBasePath}/ws`);
  const result = await waitForRoleOccupancyProbe(socket);
  record.roleOccupancy = result;
  writeJson('role-occupancy.json', result);
  if (result.status !== 'PASS')
    throw new RunnerFailure(
      'single-master-single-slave role occupancy',
      `expected ROLE_OCCUPIED, observed ${result.reasonCode}`,
    );
};

const tapVirtualText = async (target, value) => {
  const normalized = value.toLowerCase();
  if (value !== normalized) await tapNode(target, 'ui.base.input:virtual-keyboard:shift');
  for (const character of normalized) {
    await tapNode(target, `ui.base.input:virtual-keyboard:text-${character}`);
  }
};

const fillStaffLogin = async target => {
  await waitForNode(target, 'sample.auth.login');
  await tapNode(target, 'sample.auth.login:operator-name');
  await tapVirtualText(target, 'A001');
  await tapNode(target, 'ui.base.input:virtual-keyboard:complete');
  await tapNode(target, 'sample.auth.login:passcode');
  await tapVirtualText(target, '1111');
  await tapNode(target, 'ui.base.input:virtual-keyboard:complete');
  await tapNode(target, 'sample.auth.login:submit');
  await waitForNode(target, 'sample.desk.member-list');
};

const runMemberJourney = async (record, master, slave) => {
  const transferLogBaselineByDirection = {};
  // A paired single-screen slave is anonymous until the master authenticates,
  // but it still owns the customer-facing logical SECONDARY surface. This
  // observation must also prove that a leftover Admin login layer is not
  // covering the customer surface before any customer control is tapped.
  await prepareMemberJourneySurface({
    master,
    slave,
    closeAdmin,
    assertCustomerSurface: async target => {
      await waitForNode(target, 'sample.desk.customer-welcome', (_node, xml) => memberJourneyCustomerSurfaceReady(xml));
      await observe(
        record,
        target,
        'anonymous-paired-slave-customer-surface',
        ['sample.desk.customer-welcome'],
        ['欢迎，请等待店员操作'],
      );
      progress(record, 'paired-anonymous-slave-renders-customer-surface', {deviceRole: 'slave'});
    },
  });
  await fillStaffLogin(master);
  await observe(record, master, 'member-list-before-registration', ['sample.desk.member-list'], ['已登记会员']);
  const masterList = await readUi(master, 'find member add control');
  const addId =
    nodeForId(masterList, 'sample.desk.member-list:empty-action') === null
      ? 'sample.desk.member-list:add'
      : 'sample.desk.member-list:empty-action';
  await tapNode(master, addId);
  await waitForNode(master, 'sample.desk.member-form');
  await tapNode(master, 'sample.desk.member-form:name');
  await tapVirtualText(master, 'ALICE');
  await waitForNode(master, 'sample.desk.member-form:name', node => nodeText(node).includes('Alice'));
  await tapNode(master, 'ui.base.input:virtual-keyboard:complete');
  await tapNode(master, 'sample.desk.member-form:phone');
  await tapVirtualText(master, '01012345678');
  await waitForNode(master, 'sample.desk.member-form:phone', node => nodeText(node).includes('01012345678'));
  transferLogBaselineByDirection['master-to-slave'] = captureTopologyPeerTimestampBaseline(
    record,
    [master, slave],
    'before-alice-pending-submit',
  );
  await submitMemberFormWithClosedKeyboard({
    tap: testId => tapNode(master, testId),
    waitForKeyboardClosed: () => waitForAbsent(master, 'ui.base.input:virtual-keyboard:complete'),
  });
  await waitForNode(master, 'sample.desk.waiting-confirm');
  await observe(
    record,
    master,
    'member-waiting-on-master',
    ['sample.desk.member-list', 'sample.desk.waiting-confirm'],
    ['已提交，等待顾客确认', 'Alice', '01012345678'],
  );
  await waitForNode(slave, 'sample.desk.customer-member');
  await observe(
    record,
    slave,
    'member-confirmation-on-slave',
    ['sample.desk.customer-member'],
    ['请确认登记', 'Alice', '01012345678'],
  );
  captureStage1Screenshot(slave, 'member-confirmation-on-slave');
  progress(record, 'cross-device-member-pending-state', {
    masterPartKey: 'sample.desk.waiting-confirm',
    slavePartKey: 'sample.desk.customer-member',
  });

  // Reboot the real slave while the peer-owned pending workflow is visible.
  // The post-reconnect assertion is deliberately the business part, not the
  // process start result, so a stale or missing synced pending state fails.
  await adb(slave, ['shell', 'am', 'force-stop', slave.profile.packageName], 'pending slave cold restart force-stop');
  await adb(slave, ['shell', 'am', 'start', '-W', '-n', slave.profile.activity], 'pending slave cold restart');
  await waitForNode(slave, 'sample.desk.customer-member');
  await observe(
    record,
    slave,
    'pending-state-after-slave-restart',
    ['sample.desk.customer-member'],
    ['请确认登记', 'Alice', '01012345678'],
  );
  progress(record, 'pending-customer-workflow-restored-after-slave-restart', {
    deviceRole: 'slave',
    process: processIdentity(slave),
  });

  await tapNode(master, 'sample.desk.waiting-confirm:withdraw');
  await waitForNode(master, 'sample.desk.withdraw-confirm');
  await tapNode(master, 'sample.desk.withdraw-confirm:withdraw');
  await waitForNode(master, 'sample.desk.member-form');
  await waitForNode(slave, 'sample.desk.customer-welcome');
  await waitForAbsent(slave, 'sample.desk.customer-member');
  await observe(record, master, 'withdrawn-state-after-slave-restart', ['sample.desk.member-form'], []);
  await observe(
    record,
    slave,
    'no-stale-customer-popup-after-reconnect',
    ['sample.desk.customer-welcome'],
    ['欢迎，请等待店员操作'],
  );
  progress(record, 'slave-reconnect-clears-cancelled-customer-popup', {
    masterPartKey: 'sample.desk.member-form',
    slavePartKey: 'sample.desk.customer-welcome',
  });

  // Register a second member through the restored master form so the normal
  // confirmation path remains covered after the cancellation scenario.
  await tapNode(master, 'sample.desk.member-form:name');
  await tapVirtualText(master, 'BOB');
  await waitForNode(master, 'sample.desk.member-form:name', node => nodeText(node).includes('Bob'));
  await tapNode(master, 'ui.base.input:virtual-keyboard:complete');
  await tapNode(master, 'sample.desk.member-form:phone');
  await tapVirtualText(master, '01087654321');
  await waitForNode(master, 'sample.desk.member-form:phone', node => nodeText(node).includes('01087654321'));
  await submitMemberFormWithClosedKeyboard({
    tap: testId => tapNode(master, testId),
    waitForKeyboardClosed: () => waitForAbsent(master, 'ui.base.input:virtual-keyboard:complete'),
  });
  await waitForNode(master, 'sample.desk.waiting-confirm');
  await waitForNode(slave, 'sample.desk.customer-member');
  await observe(
    record,
    master,
    'second-member-waiting-after-cancel',
    ['sample.desk.waiting-confirm'],
    ['Bob', '01087654321'],
  );
  await observe(
    record,
    slave,
    'second-member-confirmation-after-cancel',
    ['sample.desk.customer-member'],
    ['Bob', '01087654321'],
  );

  await tapNode(slave, 'sample.desk.customer-member:age');
  await tapNode(slave, 'ui.base.input:virtual-keyboard:text-3');
  await tapNode(slave, 'ui.base.input:virtual-keyboard:text-7');
  await tapNode(slave, 'ui.base.input:virtual-keyboard:complete');
  transferLogBaselineByDirection['slave-to-master'] = captureTopologyPeerTimestampBaseline(
    record,
    [master, slave],
    'before-bob-confirmation',
  );
  await tapNode(slave, 'sample.desk.customer-member:confirm');
  await waitForNode(master, 'sample.desk.member-list:row');
  await observe(
    record,
    master,
    'member-confirmed-on-master',
    ['sample.desk.member-list', 'sample.desk.member-list:row'],
    ['已登记会员', 'Bob', '01087654321'],
  );
  captureStage1Screenshot(master, 'member-confirmed-on-master');
  await waitForNode(slave, 'sample.desk.customer-welcome');
  await observe(record, slave, 'member-welcome-on-slave', ['sample.desk.customer-welcome'], ['欢迎，请等待店员操作']);
  captureStage1Screenshot(slave, 'member-welcome-on-slave');
  progress(record, 'cross-device-member-confirmed-state', {
    masterPartKey: 'sample.desk.member-list',
    slavePartKey: 'sample.desk.customer-welcome',
  });

  await adb(
    master,
    ['shell', 'am', 'force-stop', master.profile.packageName],
    'authenticated master cold restart force-stop',
  );
  await adb(master, ['shell', 'am', 'start', '-W', '-n', master.profile.activity], 'authenticated master cold restart');
  await waitForNode(master, 'sample.desk.member-list:row');
  // Alice was deliberately withdrawn before the second registration.  The
  // authenticated restart assertion must follow the member that was actually
  // confirmed and persisted by this journey, rather than the cancelled draft.
  await observe(
    record,
    master,
    'authenticated-state-after-cold-restart',
    ['sample.desk.member-list', 'sample.desk.member-list:row'],
    ['Bob', '01087654321'],
  );
  progress(record, 'authenticated-member-state-restored-after-cold-restart', {
    deviceRole: 'master',
    process: processIdentity(master),
  });
  const logsAfterMemberJourney = Object.fromEntries(
    [master, slave].map(target => [target.role, captureTopologyLogcat(target, record)]),
  );
  record.memberJourneyTransferAcceptance = evaluateMemberJourneyTransferAcceptance({
    ...logsAfterMemberJourney,
    steps: record.steps,
    timeline: record.timeline,
    afterTimestampByDirection: transferLogBaselineByDirection,
  });
};

const ensureAdminTopology = async (record, target) => {
  const current = await readUi(target, 'ensure topology preflight');
  if (
    nodeForId(current, 'terminal.admin:topology:title') !== null ||
    nodeForId(current, 'terminal.admin:topology:page-gate') !== null
  )
    return;
  await openAdmin(record, target);
  await openTopology(record, target);
};

const runDisconnectRecovery = async (record, master, slave) => {
  if (!record.resources.forwardOwned || topologyBridge === null)
    throw new RunnerFailure('disconnect/reconnect', 'owned topology bridge was not created');
  await ensureAdminTopology(record, master);
  await ensureAdminTopology(record, slave);
  interruptTopologyBridge(record, 'disconnect/reconnect acceptance');
  await assertTopologySnapshot(record, slave, 'slave-paired-reconnecting-during-disconnect', {
    role: 'SLAVE',
    pairState: 'PAIRED',
    reachability: 'RECONNECTING',
  });
  await assertTopologySnapshot(record, master, 'master-paired-during-disconnect', {
    role: 'MASTER',
    pairState: 'PAIRED',
    reachability: 'RECONNECTING',
  });
  await captureAdminFrame(
    record,
    master,
    'IA-25',
    'master-paired-reconnecting',
    [
      'terminal.admin:topology:pairing',
      'terminal.admin:topology:reachability',
      'terminal.admin:topology:counterparty',
      'terminal.admin:topology:unpair',
    ],
    ['重连中'],
    {required: true},
  );
  await captureAdminFrame(
    record,
    slave,
    'IA-28',
    'slave-paired-reconnecting',
    [
      'terminal.admin:topology:pairing',
      'terminal.admin:topology:reachability',
      'terminal.admin:topology:counterparty',
      'terminal.admin:topology:unpair',
    ],
    ['重连中'],
    {required: true},
  );
  progress(record, 'disconnect-preserves-paired-and-secondary-semantics', {deviceRole: 'slave'});
  resumeTopologyBridge(record, 'restore peer transport after reconnecting state observation');
  await assertTopologySnapshot(record, slave, 'slave-paired-reachable-after-reconnect', {
    role: 'SLAVE',
    pairState: 'PAIRED',
    reachability: 'REACHABLE',
  });
  await assertTopologySnapshot(record, master, 'master-reachable-after-reconnect', {
    role: 'MASTER',
    pairState: 'PAIRED',
    reachability: 'REACHABLE',
  });
  progress(record, 'reconnect-full-recovery', {deviceRole: 'slave'});
};

const readHeartbeatTopology = async target => {
  const xml = await readUi(target, 'TP-A7 heartbeat window topology snapshot');
  return readHeartbeatTopologyFromXml(xml);
};

const readHeartbeatLifecycle = target => {
  const process = processIdentity(target);
  if (process.pid === null || process.startTicks === null) {
    throw new RunnerFailure('TP-A7 process identity', `${target.role} process identity was not readable`);
  }
  const result = adb(target, ['logcat', '-b', 'main', '-d', '-v', 'epoch'], 'TP-A7 peer lifecycle log snapshot');
  const pidPattern = new RegExp(`\\s${process.pid}\\s`);
  const lines = textOf(result)
    .split('\n')
    .filter(line => pidPattern.test(line) && line.includes('topology.peer.'));
  return Object.freeze({
    process: Object.freeze({pid: process.pid, startTicks: process.startTicks}),
    events: topologyLifecycleSnapshot(lines.join('\n')),
  });
};

const markHeartbeatLogBoundary = (record, target, edge) => {
  const marker = `TER_TOPOLOGY_A7_${record.runId}_${target.role}_${edge}`;
  adb(target, ['shell', 'log', '-t', 'TER_TOPOLOGY_A7', marker], `TP-A7 ${edge} peer-log boundary`);
  return marker;
};

const readHeartbeatPeerEvents = (target, process, markers) => {
  const result = adb(target, ['logcat', '-b', 'main', '-d', '-v', 'epoch'], 'TP-A7 marked peer-event window');
  try {
    return topologyPeerEventsBetweenMarkers(textOf(result), {
      ...markers,
      processId: process.pid,
    });
  } catch (error) {
    throw new RunnerFailure(
      'TP-A7 peer-event log readback',
      `${target.role}: ${sanitizeDiagnostic(error instanceof Error ? error.message : String(error))}`,
    );
  }
};

const runHeartbeatOnlyWindow = async (record, master, slave) => {
  await ensureAdminTopology(record, master);
  await ensureAdminTopology(record, slave);
  const targets = [master, slave];
  const admission = await waitForPairedReachableTopology({
    read: async () =>
      Object.fromEntries(
        await Promise.all(targets.map(async target => [target.role, await readHeartbeatTopology(target)])),
      ),
    timeoutMs: topologyTransportConfig.heartbeatTimeoutMs,
    pollIntervalMs: uiObservationMinIntervalMs,
    sleep,
  });
  if (admission.status !== 'READY') {
    writeJson('tp-a7-admission-observations.json', admission.observations);
    throw new RunnerFailure(
      'TP-A7 window admission',
      `both laptop endpoints must be observed paired and reachable in opposite roles before the heartbeat window; last=${JSON.stringify(admission.topology)}`,
    );
  }
  const startTopology = admission.topology;
  writeJson('tp-a7-admission-observations.json', admission.observations);
  const startLifecycle = Object.fromEntries(targets.map(target => [target.role, readHeartbeatLifecycle(target)]));
  const startLogMarkers = Object.fromEntries(
    targets.map(target => [target.role, markHeartbeatLogBoundary(record, target, 'START')]),
  );
  const minimumWindowMs = topologyTransportConfig.heartbeatTimeoutMs * 3;
  const startedAt = new Date().toISOString();
  const startedMonotonicMs = Number(process.hrtime.bigint()) / 1_000_000;
  progress(record, 'tp-a7-heartbeat-only-window-started', {
    startedAt,
    heartbeatIntervalMs: topologyTransportConfig.heartbeatIntervalMs,
    heartbeatTimeoutMs: topologyTransportConfig.heartbeatTimeoutMs,
    minimumWindowMs,
    startTopology,
    processIdentities: Object.fromEntries(targets.map(target => [target.role, startLifecycle[target.role].process])),
  });

  // No UI, synchronization, recovery, or network-control operation is issued
  // while the production heartbeat runs on its own.
  await sleep(minimumWindowMs);

  const endLogMarkers = Object.fromEntries(
    targets.map(target => [target.role, markHeartbeatLogBoundary(record, target, 'END')]),
  );
  const endedMonotonicMs = Number(process.hrtime.bigint()) / 1_000_000;
  const endedAt = new Date().toISOString();
  const endTopology = Object.fromEntries(
    await Promise.all(targets.map(async target => [target.role, await readHeartbeatTopology(target)])),
  );
  const endLifecycle = Object.fromEntries(targets.map(target => [target.role, readHeartbeatLifecycle(target)]));
  const peerEventsDuringWindow = Object.fromEntries(
    targets.map(target => [
      target.role,
      readHeartbeatPeerEvents(target, endLifecycle[target.role].process, {
        startMarker: startLogMarkers[target.role],
        endMarker: endLogMarkers[target.role],
      }),
    ]),
  );
  const outcome = evaluateHeartbeatOnlyWindow({
    startedMonotonicMs,
    endedMonotonicMs,
    heartbeatIntervalMs: topologyTransportConfig.heartbeatIntervalMs,
    heartbeatTimeoutMs: topologyTransportConfig.heartbeatTimeoutMs,
    startProcesses: Object.fromEntries(targets.map(target => [target.role, startLifecycle[target.role].process])),
    endProcesses: Object.fromEntries(targets.map(target => [target.role, endLifecycle[target.role].process])),
    startTopology,
    endTopology,
    startLifecycle: Object.fromEntries(targets.map(target => [target.role, startLifecycle[target.role].events])),
    endLifecycle: Object.fromEntries(targets.map(target => [target.role, endLifecycle[target.role].events])),
    peerEventsDuringWindow,
  });
  record.heartbeatOnlyWindow = {
    startedAt,
    endedAt,
    ...outcome,
    startTopology,
    endTopology,
    startLifecycle: Object.fromEntries(targets.map(target => [target.role, startLifecycle[target.role].events])),
    endLifecycle: Object.fromEntries(targets.map(target => [target.role, endLifecycle[target.role].events])),
    startLogMarkers,
    endLogMarkers,
    peerEventsDuringWindow,
  };
  writeJson('tp-a7-heartbeat-only-window.json', record.heartbeatOnlyWindow);
  if (outcome.status !== 'PASS') {
    throw new RunnerFailure(
      'TP-A7 heartbeat-only window',
      `heartbeat-only acceptance failed: ${outcome.violations.join(',')}`,
    );
  }
  progress(record, 'tp-a7-heartbeat-only-window-passed', {
    startedAt,
    endedAt,
    elapsedMs: outcome.elapsedMs,
    heartbeatIntervalMs: outcome.heartbeatIntervalMs,
    heartbeatTimeoutMs: outcome.heartbeatTimeoutMs,
    minimumWindowMs: outcome.minimumWindowMs,
    startTopology,
    endTopology,
  });
};

const runSlaveUnpairCoverage = async (record, master, slave) => {
  await ensureAdminTopology(record, master);
  await ensureAdminTopology(record, slave);
  await assertTopologyValue(
    record,
    master,
    'master-repaired-before-slave-unpair',
    'terminal.admin:topology:pair-state',
    '已配对',
  );
  await assertTopologyValue(
    record,
    slave,
    'slave-repaired-before-slave-unpair',
    'terminal.admin:topology:pair-state',
    '已配对',
  );
  // The slave's unpair control is already rendered with its center inside
  // the device viewport. Requiring an additional scroll-to-bottom predicate
  // can reject this valid visible node when Android reports the scroll view's
  // original content bounds; use the observed enabled bounds directly.
  await tapNode(slave, 'terminal.admin:topology:unpair', {settleDelayMs: 0});
  await waitForNode(slave, 'terminal.admin:frame:IA-29', () => true, 5_000);
  await captureAdminFrame(
    record,
    slave,
    'IA-29',
    'slave-unpairing-guard-frame',
    ['terminal.admin:topology:pairing', 'terminal.admin:topology:pair-state', 'terminal.admin:topology:unpair'],
    ['处理中'],
    {required: true},
  );
  // Switching the slave back to MASTER/CHIEF can naturally unload the admin
  // layer and return the runtime to its primary surface. Re-enter through the
  // real launcher/login boundary before asserting the post-unpair IA-18 state.
  await waitForAdminLayerReset(slave);
  await ensureAdminTopology(record, slave);
  await waitForNode(
    slave,
    'terminal.admin:frame:IA-18',
    (_node, xml) => nodeForId(xml, 'terminal.admin:topology:goal-choice') !== null,
    10_000,
  );
  await observe(
    record,
    slave,
    'slave-role-choice-after-unpair',
    [
      'terminal.admin:frame:IA-18',
      'terminal.admin:topology:goal-choice',
      'terminal.admin:topology:goal:host',
      'terminal.admin:topology:goal:slave',
    ],
    [],
  );
  // PrimitiveStatusLine is painted but not exposed as text by Android UI
  // Automator. The IA-18 structural observation above is the executable
  // oracle; screenshots retain the visible copy for human review.
  // A slave unpair clears the master's peer facts but does not stop the
  // owner-managed MASTER host. The approved result is IA-20: running host,
  // waiting for the next slave, not the initial role-choice copy.
  await assertTopologyValue(
    record,
    master,
    'master-unpaired-after-slave-event',
    'terminal.admin:topology:host-service:state',
    '运行中',
  );
  await observe(record, master, 'master-waiting-after-slave-event', [
    'terminal.admin:frame:IA-20',
    'terminal.admin:topology:host-service',
    'terminal.admin:topology:host-service:facts',
    'terminal.admin:topology:host-service:state',
    'terminal.admin:topology:host-ip',
  ]);
  progress(record, 'slave-unpair-order-and-peer-clear', {deviceRole: 'slave'});
};

const rePairAfterSlaveUnpair = async (record, master, slave) => {
  // A real slave unpair normalizes that node back to MASTER/CHIEF. Re-pair it
  // from that owner state before exercising the independent master-unpair
  // journey; attempting pair while it is still SLAVE is correctly denied by
  // the topology owner and cannot produce a real IA-22 transition.
  await ensureAdminTopology(record, master);
  await assertTopologyValue(
    record,
    master,
    'master-host-still-running-after-slave-unpair',
    'terminal.admin:topology:host-service:state',
    '运行中',
  );
  await ensureAdminTopology(record, slave);
  await replaceHost(slave, hostAliasForAndroidEmulator);
  await tapNode(slave, 'terminal.admin:topology:pair', {scrollIntoView: true, settleDelayMs: 0});
  await waitForNode(slave, 'terminal.admin:frame:IA-22', () => true, 15_000);
  await waitForPairRuntimeReset(slave);
  await openAdmin(record, slave);
  await openTopology(record, slave);
  await assertTopologyValue(
    record,
    slave,
    'slave-repaired-after-slave-unpair',
    'terminal.admin:topology:pair-state',
    '已配对',
  );
  // The peer event can unload the master's admin layer while its topology
  // facts are being reconciled.  Re-enter through the real launcher/login
  // boundary before reading the master's paired state; do not treat a login
  // overlay as a topology assertion failure.
  await ensureAdminTopology(record, master);
  await assertTopologyValue(
    record,
    master,
    'master-repaired-after-slave-unpair',
    'terminal.admin:topology:pair-state',
    '已配对',
  );
  progress(record, 'repaired-after-slave-unpair-before-master-unpair', {deviceRole: 'slave'});
};

const runUnpairAndStop = async (record, master, slave) => {
  await ensureAdminTopology(record, master);
  await assertTopologyValue(record, master, 'master-unpair-ready', 'terminal.admin:topology:pair-state', '已配对');
  await tapNode(master, 'terminal.admin:topology:unpair', {scrollIntoView: true, settleDelayMs: 0});
  await waitForNode(master, 'terminal.admin:frame:IA-26', () => true, 5_000);
  await captureAdminFrame(
    record,
    master,
    'IA-26',
    'master-unpairing-guard-frame',
    ['terminal.admin:topology:pairing', 'terminal.admin:topology:pair-state', 'terminal.admin:topology:unpair'],
    ['处理中'],
    {required: true},
  );
  // MASTER unpair normalizes neither app role nor runtime surface. The
  // approved journey returns the same admin topology page to role choice;
  // waiting for the role-choice frame observes the owner state transition
  // instead of inventing an admin-login reset boundary.
  await waitForNode(
    master,
    'terminal.admin:frame:IA-18',
    (_node, xml) => nodeForId(xml, 'terminal.admin:topology:goal-choice') !== null,
    10_000,
  );
  await observe(
    record,
    master,
    'master-role-choice-after-unpair',
    [
      'terminal.admin:frame:IA-18',
      'terminal.admin:topology:goal-choice',
      'terminal.admin:topology:goal:host',
      'terminal.admin:topology:goal:slave',
    ],
    [],
  );
  captureStage1Screenshot(master, 'master-role-choice-after-unpair');
  // The preceding IA-18 role-choice observation proves the unpaired state;
  // pair-result is a painted PrimitiveStatusLine and has no Android text node.
  await ensureAdminTopology(record, slave);
  await waitForNode(
    slave,
    'terminal.admin:frame:IA-18',
    (_node, xml) =>
      nodeForId(xml, 'terminal.admin:topology:goal-choice') !== null &&
      nodeForId(xml, 'terminal.admin:topology:goal:host') !== null &&
      nodeForId(xml, 'terminal.admin:topology:goal:slave') !== null,
    10_000,
  );
  await observe(record, slave, 'slave-unpaired-after-peer-event', [
    'terminal.admin:frame:IA-18',
    'terminal.admin:topology:goal-choice',
    'terminal.admin:topology:goal:host',
    'terminal.admin:topology:goal:slave',
  ]);
  await waitForAbsent(master, 'terminal.admin:topology:host-service', 10_000);
  await waitForAbsent(master, 'terminal.admin:topology:enable', 10_000);
  await waitForNode(master, 'terminal.admin:topology:action:host-enable', node => node.enabled, 10_000);
  progress(record, 'master-unpair-order-and-host-stop', {
    deviceRole: 'master',
    hostService: 'absent',
    recoveryAction: 'terminal.admin:topology:action:host-enable',
  });

  adb(
    master,
    ['forward', '--remove', `tcp:${topologyUpstreamPort}`],
    'remove topology upstream forward after host stop',
    {allowFailure: true},
  );
  record.resources.forwardOwned = false;
};

const captureFailure = async (record, targets) => {
  for (const target of targets) {
    try {
      const xml = await readUi(target, 'first-failure');
      saveUi(target, 'first-failure', xml);
    } catch (error) {
      writeText(
        `${target.tag}-first-failure-ui-error.txt`,
        sanitizeDiagnostic(error instanceof Error ? error.message : String(error)),
      );
    }
    const screenshot = adb(target, ['exec-out', 'screencap', '-p'], 'first-failure screenshot', {
      allowFailure: true,
      binary: true,
    });
    if (screenshot.status === 0 && Buffer.isBuffer(screenshot.stdout) && screenshot.stdout.length > 0) {
      writeBinary(`${target.tag}-first-failure.png`, screenshot.stdout);
    }
    writeText(
      `${target.tag}-first-failure-logcat.txt`,
      sanitizeDiagnostic(
        textOf(adb(target, ['logcat', '-d', '-v', 'epoch'], 'first-failure logcat', {allowFailure: true})),
      ),
    );
    writeText(
      `${target.tag}-first-failure-window.txt`,
      sanitizeDiagnostic(
        textOf(adb(target, ['shell', 'dumpsys', 'window', 'windows'], 'first-failure window', {allowFailure: true})),
      ),
    );
    writeText(
      `${target.tag}-first-failure-activity.txt`,
      sanitizeDiagnostic(
        textOf(
          adb(target, ['shell', 'dumpsys', 'activity', 'activities'], 'first-failure activity', {allowFailure: true}),
        ),
      ),
    );
  }
};

const captureTopologyLogcat = (target, record, evidenceLabel = 'final') => {
  const result = adb(target, ['logcat', '-d', '-v', 'epoch', '-t', '5000'], 'topology anomaly logcat', {
    allowFailure: true,
  });
  const processIds = new Set();
  const addProcessId = value => {
    if (typeof value === 'string' && /^\d+$/.test(value)) processIds.add(value);
  };
  addProcessId(record.devices?.[target.role]?.coldLaunchProcess?.pid);
  for (const entry of record.timeline ?? []) {
    if (entry.deviceRole === target.role) {
      addProcessId(entry.process?.pid);
      addProcessId(entry.slaveProcess?.pid);
    }
  }
  const lines = textOf(result)
    .split('\n')
    .filter(line => {
      if (!/topology|websocket|ter-topology|ReactNativeJS/i.test(line)) return false;
      if (processIds.size === 0) return true;
      return [...processIds].some(pid => new RegExp(`\\s${pid}\\s`).test(line));
    });
  const captured = lines.join('\n');
  const safeEvidenceLabel = evidenceLabel.replace(/[^a-zA-Z0-9_-]/g, '-');
  const artifactName =
    evidenceLabel === 'final'
      ? `${target.tag}-topology-anomaly-logcat.txt`
      : `${target.tag}-topology-anomaly-logcat-${safeEvidenceLabel}.txt`;
  writeText(artifactName, sanitizeDiagnostic(captured));
  return captured;
};

const captureTopologyPeerTimestampBaseline = (record, targets, label) =>
  Object.fromEntries(
    targets.map(target => {
      const events = parseTopologyPeerLogEvents(captureTopologyLogcat(target, record, `${label}-${target.role}`));
      const latestTimestamp = Math.max(0, ...events.map(event => event.timestamp));
      if (latestTimestamp <= 0) {
        throw new RunnerFailure(
          'member transfer boundary',
          `${label}: ${target.role} had no readable topology peer event timestamp`,
        );
      }
      return [target.role, latestTimestamp];
    }),
  );

const cleanupProfile = async (record, targets) => {
  const errors = [];
  if (record.resources.portOccupant?.owned === true) {
    try {
      const owner = targets.find(target => target.role === record.resources.portOccupant.deviceRole) ?? targets[0];
      await stopPortOccupant(owner, record);
    } catch (error) {
      errors.push(
        `owned port occupant cleanup: ${sanitizeDiagnostic(error instanceof Error ? error.message : String(error))}`,
      );
    }
  }
  for (const target of targets) {
    if (target.uiObserver !== null) {
      const stopped = await target.uiObserver.stop();
      if (!stopped) errors.push(`${target.tag} UI observer remains`);
      target.uiObserver = null;
    }
    if (target.remoteUiCreated) {
      const removed = adb(target, ['shell', 'rm', '-f', target.remoteUiPath], 'remove UI dump', {allowFailure: true});
      if (removed.status !== 0) errors.push(`${target.tag} UI dump remove`);
      const absent = adb(target, ['shell', 'test', '!', '-e', target.remoteUiPath], 'verify UI dump removal', {
        allowFailure: true,
      });
      if (absent.status !== 0) errors.push(`${target.tag} UI dump remains`);
    }
    if (target.stage2UiCreated) {
      const removed = adb(target, ['shell', 'rm', '-f', target.remoteWindowsUiPath], 'remove multi-display UI dump', {
        allowFailure: true,
      });
      if (removed.status !== 0) errors.push(`${target.tag} multi-display UI dump remove`);
      const absent = adb(
        target,
        ['shell', 'test', '!', '-e', target.remoteWindowsUiPath],
        'verify multi-display UI dump removal',
        {allowFailure: true},
      );
      if (absent.status !== 0) errors.push(`${target.tag} multi-display UI dump remains`);
    }
    if (target.uiObserverDexPushed) {
      const removed = adb(target, ['shell', 'rm', '-f', target.remoteUiObserverDexPath], 'remove no-idle UI observer', {
        allowFailure: true,
      });
      if (removed.status !== 0) errors.push(`${target.tag} UI observer removal`);
      const absent = adb(
        target,
        ['shell', 'test', '!', '-e', target.remoteUiObserverDexPath],
        'verify no-idle UI observer removal',
        {allowFailure: true},
      );
      if (absent.status !== 0) errors.push(`${target.tag} UI observer remains on device`);
      target.uiObserverDexPushed = false;
    }
    adb(target, ['shell', 'am', 'force-stop', target.profile.packageName], 'cleanup package force-stop', {
      allowFailure: true,
    });
    const process = readCleanupProcessIdentity(target, errors);
    if (process.pid !== null) errors.push(`${target.tag} package PID remains`);
  }
  if (topologyBridge !== null) {
    try {
      await topologyBridge.close();
      topologyBridge = null;
      appendCommandLog({
        phase: 'cleanup',
        deviceRole: null,
        label: 'close owned topology TCP bridge',
        command: 'node:net.Server.close',
        argumentCount: 0,
        status: 0,
        result: 'passed',
        timedOut: false,
        stdoutBytes: 0,
        stderr: '',
        durationMs: 0,
      });
    } catch (error) {
      errors.push(
        `owned topology TCP bridge cleanup: ${sanitizeDiagnostic(error instanceof Error ? error.message : String(error))}`,
      );
    }
  }
  if (record.resources.forwardOwned) {
    const removed = adb(
      targets[0],
      ['forward', '--remove', `tcp:${topologyUpstreamPort}`],
      'cleanup owned topology upstream forward',
      {allowFailure: true},
    );
    if (removed.status !== 0) errors.push('owned topology upstream forward removal');
  }
  if (record.resources.reverseOwned) {
    const removed = adb(
      targets[1],
      ['reverse', '--remove', `tcp:${topologyPort}`],
      'cleanup owned slave topology reverse',
      {allowFailure: true},
    );
    if (removed.status !== 0) errors.push('owned topology reverse removal');
  }
  const forwards = textOf(localRun('adb', ['forward', '--list'], 'cleanup forward inventory', {allowFailure: true}));
  if (new RegExp(`\\btcp:${topologyUpstreamPort}\\b`).test(forwards)) errors.push('topology upstream forward remains');
  const reverses = textOf(adb(targets[1], ['reverse', '--list'], 'cleanup reverse inventory', {allowFailure: true}));
  if (new RegExp(`\\btcp:${topologyPort}\\b`).test(reverses)) errors.push('topology reverse remains');
  record.resources.forwardOwned = false;
  record.resources.reverseOwned = false;
  record.cleanupErrors = errors;
  record.cleanup = errors.length === 0 ? 'PASS' : 'FAIL';
};

const runProfile = async profile => {
  const profileOutput = path.join(outputDirectory, profile.name);
  fs.mkdirSync(profileOutput, {recursive: true});
  const originalOutputDirectory = currentOutputDirectory;
  // All helper artifacts are intentionally profile-scoped.  The binding only
  // controls evidence file placement and never changes repository source.
  currentOutputDirectory = profileOutput;
  const record = {
    runId: `ter-dual-${profile.name}-${Date.now()}`,
    tool: 'tools/terminal-topology/run-dual-device.mjs',
    stage: '1',
    profile: profile.name,
    packageName: profile.packageName,
    activity: profile.activity,
    masterAvdName,
    slaveAvdName,
    masterSerial,
    slaveSerial,
    sourceDigest: topologyRunBindings.sourceDigest,
    sourceFileCount: topologyRunBindings.sourceFileCount,
    hostProcess: topologyRunBindings.hostProcess,
    apkSourceBinding: topologyRunBindings.apkSourceBinding,
    emulatorOwnership: 'PREEXISTING_NOT_RUNNER_OWNED',
    startedAt: new Date().toISOString(),
    business: 'NOT_RUN',
    cleanup: 'NOT_RUN',
    firstFailure: null,
    lastKnownGood: null,
    brokenBoundary: null,
    topologyAcceptance: null,
    timeline: [],
    steps: [],
    devices: {},
    resources: {
      forward: null,
      forwardOwned: false,
      reverse: null,
      reverseOwned: false,
      reverseSuspended: false,
      bridge: null,
      portOccupant: null,
    },
    endpoint: null,
    roleOccupancy: null,
  };
  const master = device('master', masterSerial, profile, masterAvdName);
  const slave = device('slave', slaveSerial, profile, slaveAvdName);
  const targets = [master, slave];
  try {
    if (stage !== '1')
      throw new RunnerFailure(
        'stage gate',
        'stage 2 is held until Dexter starts the corresponding single-device dual-screen and mobile virtual machines',
      );
    record.devices.master = captureDeviceShape(master);
    record.devices.slave = captureDeviceShape(slave);
    if (record.devices.master.displays.length !== 1 || record.devices.slave.displays.length !== 1)
      throw new RunnerFailure('stage-one shape gate', 'stage one requires one display on each device');
    const masterInstall = await installProfile(master);
    const slaveInstall = await installProfile(slave);
    record.apkBinding = {master: masterInstall, slave: slaveInstall};
    writeJson('apk-binding.json', record.apkBinding);
    if (uiObserverDexPath === null)
      throw new RunnerFailure('no-idle UI observer', 'observer dex was not prepared before profile execution');
    await installUiObserver(master, uiObserverDexPath);
    await installUiObserver(slave, uiObserverDexPath);
    record.uiObserver = {
      source: 'tools/terminal-topology/android/NoIdleUiDump.java',
      mode: 'persistent-shell-side-UiAutomation-without-waitForIdle',
      masterRemoteDexPath: master.remoteUiObserverDexPath,
      slaveRemoteDexPath: slave.remoteUiObserverDexPath,
    };
    writeJson('ui-observer.json', record.uiObserver);
    record.devices.master.coldLaunchProcess = await coldLaunch(master);
    record.devices.slave.coldLaunchProcess = await coldLaunch(slave);
    progress(record, 'both-release-apps-cold-launched', {profile: profile.name});
    await pairDevices(record, master, slave);
    await runHeartbeatOnlyWindow(record, master, slave);
    if (includeMemberJourney && profile.name === 'sample-terminal') await runMemberJourney(record, master, slave);
    await runDisconnectRecovery(record, master, slave);
    await runSlaveUnpairCoverage(record, master, slave);
    await rePairAfterSlaveUnpair(record, master, slave);
    await runUnpairAndStop(record, master, slave);
    const memberTransferAcceptance =
      profile.name !== 'sample-terminal'
        ? Object.freeze({status: 'NOT_APPLICABLE', directions: Object.freeze([])})
        : includeMemberJourney
          ? (record.memberJourneyTransferAcceptance ??
            Object.freeze({
              status: 'OPEN',
              missing: Object.freeze(['member journey transfer evidence was not produced']),
            }))
          : Object.freeze({
              status: 'OPEN',
              missing: Object.freeze(['sample-terminal member journey was not included']),
            });
    // UI state alone does not prove close-origin reasons. Only an explicit
    // bounded per-origin evidence row can close this matrix.
    const closeOriginAcceptance = evaluateCloseOriginAcceptance(record.closeOriginEvidence ?? []);
    const applicableAcceptance = [memberTransferAcceptance, closeOriginAcceptance].filter(
      result => result.status !== 'NOT_APPLICABLE',
    );
    record.topologyAcceptance = {
      status: applicableAcceptance.every(result => result.status === 'PASS') ? 'PASS' : 'OPEN',
      memberStateTransfer: memberTransferAcceptance,
      closeOrigins: closeOriginAcceptance,
    };
    record.business = 'PASS';
  } catch (error) {
    record.business = 'FAIL';
    record.firstFailure = sanitizeDiagnostic(error instanceof Error ? error.message : String(error));
    record.brokenBoundary = failureBoundaryOf(error, record.lastKnownGood);
    await captureFailure(record, targets);
  } finally {
    record.systemPromptDismissals = {
      master: master.systemPromptDismissals,
      slave: slave.systemPromptDismissals,
    };
    finalizeFrameEvidence(record, master);
    for (const target of targets) captureTopologyLogcat(target, record);
    await cleanupProfile(record, targets);
    record.finishedAt = new Date().toISOString();
    // `progress.json` is also the run's latest checkpoint. Persist the
    // terminal cleanup state so that a reader never has to reconcile a stale
    // pre-cleanup snapshot (`cleanup=NOT_RUN`) with the terminal result.
    writeJson('progress.json', record);
    writeJson('result.json', record);
    currentOutputDirectory = originalOutputDirectory;
  }
  return record;
};

const captureStage2Failure = async (record, target) => {
  const displayIds = [0, ...(target.secondaryDisplayId === null ? [] : [target.secondaryDisplayId])];
  for (const displayId of displayIds) {
    try {
      const xml = await readStage2Ui(target, displayId, 'stage2 first-failure');
      saveStage2Ui(target, displayId, 'stage2-first-failure', xml);
    } catch (error) {
      writeText(
        `${target.tag}-display-${displayId}-stage2-first-failure-ui-error.txt`,
        sanitizeDiagnostic(error instanceof Error ? error.message : String(error)),
      );
    }
    const surfaceDisplayId = target.surfaceDisplayIds.get(displayId);
    const screenshotArgs =
      surfaceDisplayId === undefined
        ? ['exec-out', 'screencap', '-p']
        : ['exec-out', 'screencap', '-p', '-d', surfaceDisplayId];
    const screenshot = adb(target, screenshotArgs, `stage2 first-failure display ${displayId} screenshot`, {
      allowFailure: true,
      binary: true,
    });
    if (screenshot.status === 0 && Buffer.isBuffer(screenshot.stdout) && screenshot.stdout.length > 0) {
      writeBinary(`${target.tag}-display-${displayId}-stage2-first-failure.png`, screenshot.stdout);
    }
  }
  writeText(
    `${target.tag}-stage2-first-failure-logcat.txt`,
    sanitizeDiagnostic(
      textOf(adb(target, ['logcat', '-d', '-v', 'epoch'], 'stage2 first-failure logcat', {allowFailure: true})),
    ),
  );
  writeText(
    `${target.tag}-stage2-first-failure-window.txt`,
    sanitizeDiagnostic(
      textOf(
        adb(target, ['shell', 'dumpsys', 'window', 'windows'], 'stage2 first-failure window', {allowFailure: true}),
      ),
    ),
  );
  writeText(
    `${target.tag}-stage2-first-failure-activity.txt`,
    sanitizeDiagnostic(
      textOf(
        adb(target, ['shell', 'dumpsys', 'activity', 'activities'], 'stage2 first-failure activity', {
          allowFailure: true,
        }),
      ),
    ),
  );
};

const cleanupStage2Profile = async (record, target) => {
  const errors = [];
  for (const remotePath of [target.remoteUiPath, target.remoteWindowsUiPath]) {
    const removed = adb(target, ['shell', 'rm', '-f', remotePath], 'stage2 cleanup remote UI dump', {
      allowFailure: true,
    });
    if (removed.status !== 0) errors.push(`remote UI dump removal failed: ${remotePath}`);
    const absent = adb(target, ['shell', 'test', '!', '-e', remotePath], 'stage2 verify remote UI dump removal', {
      allowFailure: true,
    });
    if (absent.status !== 0) errors.push(`remote UI dump remains: ${remotePath}`);
  }
  adb(target, ['shell', 'am', 'force-stop', target.profile.packageName], 'stage2 cleanup package force-stop', {
    allowFailure: true,
  });
  const process = readCleanupProcessIdentity(target, errors);
  record.cleanupReadback = {
    appProcess: process,
    runnerProcess: {
      pid: null,
      owned: false,
      note: 'runner is the current orchestrator and did not spawn a child runtime',
    },
    emulatorOwnership: target.emulatorOwnership ?? 'PREEXISTING_NOT_RUNNER_OWNED',
    remoteUiPaths: [target.remoteUiPath, target.remoteWindowsUiPath],
  };
  record.cleanupErrors = errors;
  record.cleanup = errors.length === 0 ? 'PASS' : 'FAIL';
  writeJson('cleanup-result.json', {status: record.cleanup, errors, readback: record.cleanupReadback});
};

const runStage2Profile = async profile => {
  const profileOutput = path.join(outputDirectory, profile.name);
  fs.mkdirSync(profileOutput, {recursive: true});
  const originalOutputDirectory = currentOutputDirectory;
  currentOutputDirectory = profileOutput;
  const record = {
    runId: `ter-dual-stage2-${stage2Shape}-${profile.name}-${Date.now()}`,
    tool: 'tools/terminal-topology/run-dual-device.mjs',
    stage: '2',
    shape: stage2Shape,
    profile: profile.name,
    packageName: profile.packageName,
    activity: profile.activity,
    serial: stage2Serial,
    emulatorOwnership: 'PREEXISTING_NOT_RUNNER_OWNED',
    startedAt: new Date().toISOString(),
    business: 'NOT_RUN',
    cleanup: 'NOT_RUN',
    firstFailure: null,
    lastKnownGood: null,
    brokenBoundary: null,
    timeline: [],
    steps: [],
    devices: {},
    resources: {forward: null, forwardOwned: false, reverse: null, reverseOwned: false},
  };
  const target = device('stage2', stage2Serial, profile);
  target.emulatorOwnership = 'PREEXISTING_NOT_RUNNER_OWNED';
  try {
    record.devices.stage2 = captureStage2Shape(target, stage2Shape);
    const install = await installProfile(target);
    record.apkBinding = {device: install};
    writeJson('apk-binding.json', record.apkBinding);
    record.devices.stage2.coldLaunchProcess = await stage2ColdLaunch(target);
    progress(record, `stage2-${stage2Shape}-release-app-cold-launched`, {
      deviceRole: target.role,
      displayCount: record.devices.stage2.displays.length,
      process: record.devices.stage2.coldLaunchProcess,
    });
    captureStage2Screenshot(target, 0, 'stage2-cold-launch-primary');
    if (stage2Shape === 'dual') {
      if (target.secondaryDisplayId === null)
        throw new RunnerFailure('stage2 dual display', 'secondary display id is missing after shape capture');
      captureStage2Screenshot(target, target.secondaryDisplayId, 'stage2-cold-launch-secondary');
      await stage2RestartAndCheckChief(record, target);
      if (profile.memberJourney) {
        await stage2RunMemberJourney(record, target);
        record.stepwiseComparison = compareStage2MemberJourney(record);
      }
      await stage2RunDualAdminFrames(record, target);
    } else {
      await stage2RunMobileTopology(record, target);
    }
    finalizeFrameEvidence(record, target);
    record.business = 'PASS';
  } catch (error) {
    record.business = 'FAIL';
    record.firstFailure = sanitizeDiagnostic(error instanceof Error ? error.message : String(error));
    record.brokenBoundary = failureBoundaryOf(error, record.lastKnownGood);
    await captureStage2Failure(record, target);
  } finally {
    finalizeFrameEvidence(record, target);
    await cleanupStage2Profile(record, target);
    record.finishedAt = new Date().toISOString();
    // Keep the latest checkpoint terminal as well as the result.  Stage-two
    // readers must not reconcile a stale NOT_RUN progress snapshot with a
    // terminal PASS result after cleanup has completed.
    writeJson('progress.json', record);
    writeJson('result.json', record);
    currentOutputDirectory = originalOutputDirectory;
  }
  return record;
};

const executeStage2 = async () => {
  const manifest = {
    tool: 'tools/terminal-topology/run-dual-device.mjs',
    stage: '2',
    shape: stage2Shape,
    appSelection,
    serial: stage2Serial,
    productionTopologyPort: topologyPort,
    hostBridgePort,
    topologyBasePath,
    emulatorOwnership: 'PREEXISTING_NOT_RUNNER_OWNED',
    selectedProfiles: selectedProfiles.map(profile => ({
      name: profile.name,
      packageName: profile.packageName,
      apk: path.relative(repositoryRoot, profile.apk),
    })),
    startedAt: new Date().toISOString(),
    stageOneReference: path.relative(
      repositoryRoot,
      path.join(repositoryRoot, '.runtime/ter-dual-machine-topology/2026-09-17/cp5'),
    ),
  };
  writeJson('run-manifest.json', manifest);
  const results = [];
  for (const profile of selectedProfiles) {
    const profileResult = await runStage2Profile(profile);
    results.push(profileResult);
    writeJson(`${profile.name}-result.json`, profileResult);
  }
  const overall = {
    stage: '2',
    shape: stage2Shape,
    business: results.every(result => result.business === 'PASS') ? 'PASS' : 'FAIL',
    cleanup: results.every(result => result.cleanup === 'PASS') ? 'PASS' : 'FAIL',
    profiles: results.map(result => ({
      profile: result.profile,
      business: result.business,
      cleanup: result.cleanup,
      firstFailure: result.firstFailure,
      lastKnownGood: result.lastKnownGood,
      brokenBoundary: result.brokenBoundary,
    })),
    stageTwoStatus: results.every(result => result.business === 'PASS' && result.cleanup === 'PASS')
      ? 'CLOSED'
      : 'OPEN',
    finishedAt: new Date().toISOString(),
  };
  writeJson('overall-result.json', overall);
  console.log(
    `TERMINAL_TOPOLOGY_STAGE2=${overall.business} CLEANUP=${overall.cleanup} SHAPE=${stage2Shape} OUTPUT=${outputDirectory}`,
  );
  if (overall.business !== 'PASS' || overall.cleanup !== 'PASS') process.exitCode = 1;
};

// Helpers resolve artifacts through this binding so that profiles can run
// sequentially while retaining separate evidence directories.
let currentOutputDirectory = outputDirectory;
let uiObserverDexPath = null;
let masterSerial = null;
let slaveSerial = null;
let topologyRunBindings = null;

const topologyLockPath = path.join(repositoryRoot, '.runtime/ter-third-party-usage-remediation/topology-run.lock');

const acquireTopologyLock = () => {
  fs.mkdirSync(path.dirname(topologyLockPath), {recursive: true});
  const descriptor = fs.openSync(topologyLockPath, 'wx', 0o600);
  fs.writeFileSync(descriptor, `${JSON.stringify({pid: process.pid, startedAt: new Date().toISOString()})}\n`);
  return descriptor;
};

const execute = async () => {
  let lockDescriptor = null;
  try {
    lockDescriptor = acquireTopologyLock();
    localRun(
      'bash',
      [path.join(repositoryRoot, 'scripts/env/check-runtime-resource-budget'), '--profile', 'ter-validation-with-dev'],
      'topology resource budget preflight',
      {phase: 'preflight'},
    );
    if (stage === '2') {
      await executeStage2();
      return;
    }

    const avdMapping = discoverTopologyAvds();
    masterSerial = avdMapping.master.serial;
    slaveSerial = avdMapping.slave.serial;
    const source = terminalSourceSnapshot();
    const hostProcess = hostProcessIdentity();
    const apkSourceBinding = Object.fromEntries(
      selectedProfiles.map(profile => [profile.name, localApkBinding(profile)]),
    );
    topologyRunBindings = {
      sourceDigest: source.sha256,
      sourceFileCount: source.fileCount,
      hostProcess,
      apkSourceBinding,
    };
    const manifest = {
      kind: 'ter-third-party-topology-run-manifest',
      runId: path.basename(path.dirname(outputDirectory)),
      tool: 'tools/terminal-topology/run-dual-device.mjs',
      stage: '1',
      appSelection,
      includeMemberJourney,
      masterAvdName,
      slaveAvdName,
      avdMapping,
      masterSerial,
      slaveSerial,
      processes: [{pid: hostProcess.pid, startToken: hostProcess.startToken}],
      sourceDigest: source.sha256,
      sourceFileCount: source.fileCount,
      apkSourceBinding,
      productionTopologyPort: topologyPort,
      hostBridgePort,
      topologyUpstreamPort,
      topologyBasePath,
      emulatorOwnership: 'PREEXISTING_NOT_RUNNER_OWNED',
      selectedProfiles: selectedProfiles.map(profile => ({
        name: profile.name,
        packageName: profile.packageName,
        apk: path.relative(repositoryRoot, profile.apk),
      })),
      startedAt: new Date().toISOString(),
      stageTwoStatus: 'OPEN_NOT_IN_THIS_RUN',
      business: 'NOT_RUN',
      cleanup: 'NOT_RUN',
      topologyAcceptance: 'NOT_RUN',
    };
    writeJson('run-manifest.json', manifest);
    try {
      uiObserverDexPath = buildUiObserverDex();
    } catch (error) {
      writeText(
        'no-idle-ui-observer-build-failure.txt',
        sanitizeDiagnostic(error instanceof Error ? (error.stack ?? error.message) : String(error)),
      );
      manifest.business = 'FAIL';
      manifest.cleanup = 'PASS';
      manifest.firstFailure = 'observer dex build failed before device launch';
      writeJson('run-manifest.json', manifest);
      console.error(`TERMINAL_TOPOLOGY_STAGE1=FAIL OBSERVER_BUILD=FAIL OUTPUT=${outputDirectory}`);
      process.exitCode = 1;
      return;
    }
    const results = [];
    for (const profile of selectedProfiles) {
      const profileResult = await runProfile(profile);
      results.push(profileResult);
      writeJson(`${profile.name}-result.json`, profileResult);
    }
    const sourceAfter = terminalSourceSnapshot();
    const sourceStable = source.sha256 === sourceAfter.sha256;
    const overall = {
      stage: '1',
      business: results.every(result => result.business === 'PASS') && sourceStable ? 'PASS' : 'FAIL',
      cleanup: results.every(result => result.cleanup === 'PASS') ? 'PASS' : 'FAIL',
      topologyAcceptance: topologyAcceptanceStatusForProfiles(results),
      sourceDigestBefore: source.sha256,
      sourceDigestAfter: sourceAfter.sha256,
      sourceStable,
      profiles: results.map(result => ({
        profile: result.profile,
        business: result.business,
        cleanup: result.cleanup,
        topologyAcceptance: result.topologyAcceptance,
        firstFailure: result.firstFailure,
        lastKnownGood: result.lastKnownGood,
        brokenBoundary: result.brokenBoundary,
      })),
      stage2: 'OPEN_NOT_IN_THIS_RUN',
      finishedAt: new Date().toISOString(),
    };
    manifest.business = overall.business;
    manifest.cleanup = overall.cleanup;
    manifest.topologyAcceptance = overall.topologyAcceptance;
    manifest.finishedAt = overall.finishedAt;
    manifest.sourceDigestAfter = sourceAfter.sha256;
    manifest.sourceStable = sourceStable;
    writeJson('run-manifest.json', manifest);
    writeJson('overall-result.json', overall);
    console.log(
      `TERMINAL_TOPOLOGY_STAGE1=${overall.business} ACCEPTANCE=${overall.topologyAcceptance} CLEANUP=${overall.cleanup} SOURCE_STABLE=${sourceStable} OUTPUT=${outputDirectory}`,
    );
    if (topologyStageOneOutcome(overall) !== 'PASS') process.exitCode = 1;
  } finally {
    if (lockDescriptor !== null) {
      fs.closeSync(lockDescriptor);
      fs.unlinkSync(topologyLockPath);
    }
  }
};

await execute();
