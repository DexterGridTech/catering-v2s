import {spawn} from 'node:child_process';
import {execFile as execFileCallback} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {promisify} from 'node:util';
import {mkdirSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import type {Client} from '@devicefarmer/adbkit';
import {
  androidAutomationBuildIdentity,
  androidAutomationGradleArguments,
  createAndroidAdbClient,
  createAndroidAutomationConnection,
  waitForAutomationSession,
  type AndroidAutomationConnection,
} from '../src/index.ts';
import type {AutomationEnvelope} from '@catering-v2s/ui-base-automation-agent/protocol';
import type {TerminalAutomationProcessIdentity} from '../src/managedRun.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const androidProjectRoot = path.join(root, 'apps/terminal/application/android/sample-terminal/android');
const applicationId = 'com.anonymous.sampleterminal';
const runtimeSelector = 'kernel.base.runtime.selectRuntimeInstanceMode';
const resetCommand = 'kernel.base.runtime.reset-runtime-after-system-failure';
const token = `ter-auto-${randomUUID()}`;
const runId = process.env.TERMINAL_AUTOMATION_RUN_ID;
const serial = process.env.TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIAL;
const peerSerial = process.env.TERMINAL_AUTOMATION_ANDROID_PEER_DEVICE_SERIAL;
const packageIdFromManifest = process.env.TERMINAL_AUTOMATION_ANDROID_PACKAGE_ID;
const adbPath = process.env.ADB_PATH || 'adb';
const execFile = promisify(execFileCallback);
const require = createRequire(import.meta.url);
const managedProcessTree = require('../../../scripts/dev/managed-process-tree.mjs') as {
  readProcessTable: () => readonly {pid: number; ppid: number; pgid: number; startToken: string}[];
  snapshotProcessTree: (identity: TerminalAutomationProcessIdentity) => readonly {pid: number; pgid: number; startToken: string}[];
  terminateOwnedProcessTree: (identity: TerminalAutomationProcessIdentity) => Promise<{
    status: 'PASS' | 'FAIL';
    treeReadback: readonly {pid: number; startToken: string}[];
  }>;
};

const responseResult = (message: AutomationEnvelope): unknown => {
  if (message.type !== 'response' || typeof message.body !== 'object' || message.body === null || !('result' in message.body))
    throw new Error('TERMINAL_AUTOMATION_ANDROID_RESPONSE_INVALID');
  return message.body.result;
};

const eventBody = (message: AutomationEnvelope): Record<string, unknown> | undefined =>
  message.type === 'event' && typeof message.body === 'object' && message.body !== null
    ? message.body as Record<string, unknown>
    : undefined;

const waitForMessage = (
  connection: AndroidAutomationConnection,
  sessionId: string,
  matches: (message: AutomationEnvelope) => boolean,
  timeoutMs = 10_000,
): Promise<AutomationEnvelope> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('TERMINAL_AUTOMATION_ANDROID_MESSAGE_TIMEOUT'));
    }, timeoutMs);
    const unsubscribe = connection.driver.onMessage(sessionId, message => {
      if (!matches(message)) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(message);
    });
  });

const readProcessIdentity = (pid: number): TerminalAutomationProcessIdentity => {
  const process = managedProcessTree.readProcessTable().find(row => row.pid === pid);
  if (process === undefined || process.pgid !== pid || !process.startToken)
    throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_PROCESS_IDENTITY_UNAVAILABLE');
  return Object.freeze({pid, pgid: process.pgid, startToken: process.startToken});
};

const buildApk = async (runDirectory: string, suffix: string): Promise<string> => {
  const buildDirectory = path.join(runDirectory, 'android-build');
  mkdirSync(buildDirectory, {recursive: true, mode: 0o700});
  const child = spawn('./gradlew', androidAutomationGradleArguments(suffix, realpathSync(runDirectory) + '/android-build'), {
    cwd: androidProjectRoot,
    detached: true,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      EXPO_PUBLIC_TER_AUTOMATION_BUILD: 'true',
      EXPO_PUBLIC_TER_AUTOMATION_URL: 'ws://127.0.0.1:19090/automation',
      EXPO_PUBLIC_TER_AUTOMATION_TOKEN: token,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!child.pid) throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_PID_UNAVAILABLE');
  const identity = readProcessIdentity(child.pid);
  const output = (chunk: Buffer): void => {
    process.stdout.write(chunk.toString('utf8').replaceAll(token, '[REDACTED]'));
  };
  child.stdout?.on('data', value => output(Buffer.from(value)));
  child.stderr?.on('data', value => output(Buffer.from(value)));
  const timeout = setTimeout(() => {
    void managedProcessTree.terminateOwnedProcessTree(identity);
  }, 8 * 60_000);
  let code: number | null;
  try {
    [code] = await once(child, 'close') as [number | null];
  } finally {
    clearTimeout(timeout);
  }
  if (code !== 0) throw new Error(`TERMINAL_AUTOMATION_ANDROID_BUILD_EXIT_${code ?? 'UNKNOWN'}`);
  const apk = path.join(buildDirectory, 'outputs/apk/debug/app-debug.apk');
  return apk;
};

describe('TER automation Android capabilities, recovery, and connection isolation', () => {
  let adb: Client | undefined;
  let primary: AndroidAutomationConnection | undefined;
  let peer: AndroidAutomationConnection | undefined;
  let packageId: string | undefined;
  let apk: string | undefined;
  let primaryInstallAttempted = false;
  let peerInstallAttempted = false;

  beforeAll(async () => {
    if (!runId || !serial || !peerSerial || !packageIdFromManifest)
      throw new Error('TERMINAL_AUTOMATION_ANDROID_DUAL_IDENTITY_REQUIRED');
    if (serial === peerSerial) throw new Error('TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIALS_MUST_DIFFER');
    const buildIdentity = androidAutomationBuildIdentity(runId);
    if (buildIdentity.packageId !== packageIdFromManifest)
      throw new Error('TERMINAL_AUTOMATION_ANDROID_PACKAGE_IDENTITY_MISMATCH');
    packageId = buildIdentity.packageId;
    adb = createAndroidAdbClient({adbPath, timeoutMs: 10_000});
    primary = await createAndroidAutomationConnection({client: adb, serial, repositoryRoot: root, adbPath, shape: 'mobile', token});
    peer = await createAndroidAutomationConnection({client: adb, serial: peerSerial, repositoryRoot: root, adbPath, shape: 'mobile', token});
    if (await primary.isInstalled(packageId) || await peer.isInstalled(packageId))
      throw new Error('TERMINAL_AUTOMATION_ANDROID_RUN_PACKAGE_ALREADY_INSTALLED');
    const runDirectory = path.join(root, '.runtime/terminal-automation', runId);
    apk = await buildApk(runDirectory, buildIdentity.applicationIdSuffix);
    primaryInstallAttempted = true;
    await primary.install(apk);
    if (!(await primary.isInstalled(packageId))) throw new Error('TERMINAL_AUTOMATION_ANDROID_INSTALL_READBACK_FAILED');
    peerInstallAttempted = true;
    await peer.install(apk);
    if (!(await peer.isInstalled(packageId))) throw new Error('TERMINAL_AUTOMATION_ANDROID_PEER_INSTALL_READBACK_FAILED');
    await primary.launch(`${packageId}/${applicationId}.MainActivity`);
    await peer.launch(`${packageId}/${applicationId}.MainActivity`);
    await waitForAutomationSession(primary.driver, session => session.appName === 'sample-console', 30_000);
    await waitForAutomationSession(peer.driver, session => session.appName === 'sample-console', 30_000);
  }, 600_000);

  afterAll(async () => {
    const errors: string[] = [];
    for (const [connection, attempted] of [[primary, primaryInstallAttempted], [peer, peerInstallAttempted]] as const) {
      if (connection !== undefined && packageId !== undefined) {
        try {
          if (attempted || await connection.isInstalled(packageId)) {
            await connection.forceStop(packageId);
            await connection.uninstall(packageId);
          }
          if (await connection.isInstalled(packageId)) errors.push('ANDROID_RUN_PACKAGE_REMAINS');
        } catch {
          errors.push('ANDROID_RUN_PACKAGE_CLEANUP_FAILED');
        }
      }
    }
    for (const connection of [primary, peer]) {
      try { await connection?.close(); } catch { errors.push('ANDROID_CONNECTION_CLEANUP_FAILED'); }
    }
    if (errors.length > 0) throw new Error(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:${errors.join('_')}`);
    process.stdout.write('TERMINAL_AUTOMATION_DEVICE_CLEANUP_COMPLETE\n');
  });

  it('keeps two Runtime sessions independent through selector reads, reload, app restart, and reverse recovery', async () => {
    if (primary === undefined || peer === undefined || packageId === undefined || serial === undefined)
      throw new Error('TERMINAL_AUTOMATION_ANDROID_FIXTURE_NOT_READY');
    let first = primary.driver.getSession();
    let peerSession = peer.driver.getSession();
    if (first === null || peerSession === null) throw new Error('TERMINAL_AUTOMATION_ANDROID_SESSION_MISSING');
    expect(first.sessionId).not.toBe(peerSession.sessionId);
    expect(first.runtimeId).not.toBe(peerSession.runtimeId);

    for (const [connection, session] of [[primary, first], [peer, peerSession]] as const) {
      const info = responseResult(await connection.driver.request(session.sessionId, 'runtime.info', null));
      if (typeof info !== 'object' || info === null || !('descriptors' in info) || !Array.isArray(info.descriptors))
        throw new Error('TERMINAL_AUTOMATION_ANDROID_RUNTIME_INFO_INVALID');
      const runtime = info.descriptors.find(value => typeof value === 'object' && value !== null && 'moduleName' in value && value.moduleName === 'kernel.base.runtime');
      expect(runtime).toMatchObject({selectorNames: expect.arrayContaining([runtimeSelector])});
      const selector = responseResult(await connection.driver.request(session.sessionId, 'selector.read', {selectorName: runtimeSelector, argsTuple: []}));
      expect(selector).toMatchObject({valueState: 'JSON'});
    }

    const peerIdBefore = peerSession.sessionId;
    const peerRuntimeBefore = peerSession.runtimeId;
    first.socket.terminate();
    const recoveredNetwork = await waitForAutomationSession(primary.driver, session => session.runtimeId === first?.runtimeId && session.sessionId !== first?.sessionId, 30_000);
    expect(peer.driver.getSession(peerIdBefore)?.runtimeId).toBe(peerRuntimeBefore);

    const subscriptionId = `android-reload-${randomUUID()}`;
    const initialEvent = waitForMessage(primary, recoveredNetwork.sessionId, message => eventBody(message)?.subscriptionId === subscriptionId);
    responseResult(await primary.driver.request(recoveredNetwork.sessionId, 'selector.subscribe', {subscriptionId, selectorName: runtimeSelector, argsTuple: []}));
    await initialEvent;
    const result = waitForMessage(primary, recoveredNetwork.sessionId, message => eventBody(message)?.kind === 'command.result');
    responseResult(await primary.driver.request(recoveredNetwork.sessionId, 'command.dispatch', {commandName: resetCommand, payload: null}));
    await result;
    const afterJsReload = await waitForAutomationSession(primary.driver, session => session.runtimeId !== recoveredNetwork.runtimeId, 30_000);
    expect(afterJsReload.sessionId).not.toBe(recoveredNetwork.sessionId);
    await expect(primary.driver.request(recoveredNetwork.sessionId, 'selector.unsubscribe', {subscriptionId})).rejects.toThrow(
      'TERMINAL_AUTOMATION_SESSION_NOT_CONNECTED',
    );

    const beforeAppRestart = afterJsReload;
    await primary.forceStop(packageId);
    await primary.launch(`${packageId}/${applicationId}.MainActivity`);
    const afterAppRestart = await waitForAutomationSession(primary.driver, session => session.runtimeId !== beforeAppRestart.runtimeId, 30_000);
    expect(peer.driver.getSession(peerIdBefore)?.runtimeId).toBe(peerRuntimeBefore);

    const reverseList = async (): Promise<string> => {
      const {stdout} = await execFile(adbPath, ['-s', serial, 'reverse', '--list'], {encoding: 'utf8', timeout: 10_000});
      return stdout;
    };
    if (!(await reverseList()).includes('tcp:19090')) throw new Error('TERMINAL_AUTOMATION_ANDROID_REVERSE_NOT_OWNED');
    await execFile(adbPath, ['-s', serial, 'reverse', '--remove', 'tcp:19090'], {encoding: 'utf8', timeout: 10_000});
    const afterRemove = await reverseList();
    if (afterRemove.includes('tcp:19090')) throw new Error('TERMINAL_AUTOMATION_ANDROID_REVERSE_REMOVE_READBACK_FAILED');
    afterAppRestart.socket.terminate();
    await new Promise(resolve => setTimeout(resolve, 1_000));
    expect(primary.driver.getSession()).toBeNull();
    const disconnectedRuntimeId = afterAppRestart.runtimeId;
    await execFile(adbPath, ['-s', serial, 'reverse', 'tcp:19090', `tcp:${primary.hostPort}`], {encoding: 'utf8', timeout: 10_000});
    const afterReverseRestore = await waitForAutomationSession(primary.driver, session => session.runtimeId === disconnectedRuntimeId, 30_000);
    expect(afterReverseRestore.runtimeId).toBe(disconnectedRuntimeId);
    const peerRead = responseResult(await peer.driver.request(peerIdBefore, 'selector.read', {selectorName: runtimeSelector, argsTuple: []}));
    expect(peerRead).toMatchObject({valueState: 'JSON'});
  }, 240_000);
});
