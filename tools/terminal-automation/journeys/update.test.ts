import {createHash, randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {existsSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, expect, it} from 'vitest';
import {chromium, type Browser, type Page} from 'playwright';
import {createTerminalAutomationDriver, readSelector} from '../src/index.ts';
import {terminalUpdateSampleConfig} from '../src/updateSample.ts';
import type {AutomationEnvelope} from '@catering-v2s/ui-base-automation-agent/protocol';
import type {TerminalAutomationProcessIdentity} from '../src/managedRun.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const runId = process.env.TERMINAL_AUTOMATION_RUN_ID;
const runDirectory = runId ? path.join(root, '.runtime/terminal-automation', runId) : undefined;
const buildCommand = path.join(root, 'scripts/build/terminal-update-artifact.mjs');
const generatorCommand = path.join(root, 'scripts/generate/terminal-update-artifact.mjs');
const updateCase = process.env.TERMINAL_AUTOMATION_CASE;
const sample = process.env.TERMINAL_AUTOMATION_SAMPLE ?? 'console';
const sampleConfig = terminalUpdateSampleConfig(sample);

const require = createRequire(import.meta.url);
const managedProcessTree = require('../../../scripts/dev/managed-process-tree.mjs') as {
  readProcessTable: () => readonly {pid: number; ppid: number; pgid: number; startToken: string}[];
  snapshotProcessTree: (identity: TerminalAutomationProcessIdentity) => readonly {pid: number; pgid: number; startToken: string}[];
  terminateOwnedProcessTree: (identity: TerminalAutomationProcessIdentity) => Promise<{
    status: 'PASS' | 'FAIL';
    treeReadback: readonly {pid: number; startToken: string}[];
  }>;
};

const availablePort = async (): Promise<number> => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('TERMINAL_AUTOMATION_UPDATE_WEB_PORT_UNAVAILABLE');
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  return address.port;
};

const readProcessIdentity = (pid: number): TerminalAutomationProcessIdentity => {
  const row = managedProcessTree.readProcessTable().find(process => process.pid === pid);
  if (row === undefined || row.pgid !== pid || row.startToken.length === 0)
    throw new Error('TERMINAL_AUTOMATION_UPDATE_EXPO_IDENTITY_UNAVAILABLE');
  return Object.freeze({pid: row.pid, pgid: row.pgid, startToken: row.startToken});
};

const waitForExpo = async (url: string, child: ReturnType<typeof spawn>): Promise<void> => {
  const deadline = Date.now() + 60_000;
  let lastError = 'NOT_REQUESTED';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`TERMINAL_AUTOMATION_UPDATE_EXPO_EXITED_${child.exitCode}`);
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(1_000)});
      if (response.ok) return;
      lastError = `HTTP_${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.name : 'FETCH_FAILED';
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`TERMINAL_AUTOMATION_UPDATE_EXPO_READINESS_TIMEOUT_${lastError}`);
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const eventBody = (message: AutomationEnvelope): Record<string, unknown> | undefined =>
  message.type === 'event' && isRecord(message.body) ? message.body : undefined;
const responseResult = (message: AutomationEnvelope): unknown => {
  if (message.type !== 'response' || !isRecord(message.body) || !('result' in message.body))
    throw new Error('TERMINAL_AUTOMATION_UPDATE_RESPONSE_INVALID');
  return message.body.result;
};
const waitForMessage = (
  server: ReturnType<typeof createTerminalAutomationDriver>['transport'],
  sessionId: string,
  matches: (message: AutomationEnvelope) => boolean,
): Promise<AutomationEnvelope> => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    unsubscribe();
    reject(new Error('TERMINAL_AUTOMATION_UPDATE_MESSAGE_TIMEOUT'));
  }, 10_000);
  const unsubscribe = server.onMessage(sessionId, message => {
    if (!matches(message)) return;
    clearTimeout(timer);
    unsubscribe();
    resolve(message);
  });
});

const testToken = `ter-update-${randomUUID()}`;
const integrationRoot = path.join(root, 'apps/terminal/ui/integration', sampleConfig.integrationPath);
let ownerDriver: ReturnType<typeof createTerminalAutomationDriver> | undefined;
let ownerBrowser: Browser | undefined;
let ownerPage: Page | undefined;
let ownerExpo: ReturnType<typeof spawn> | undefined;
let ownerExpoIdentity: TerminalAutomationProcessIdentity | undefined;
let ownerSession: Awaited<ReturnType<NonNullable<typeof ownerDriver>['waitForSession']>> | undefined;

const digest = (filePath: string): string => createHash('sha256').update(readFileSync(filePath)).digest('hex');

const nextPatchVersion = (version: string): string => {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.exec(version);
  if (match === null) throw new Error('TERMINAL_UPDATE_RELEASE_BUNDLE_VERSION_INVALID');
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
};

const runArtifactCommand = (app: string, kind: 'install' | 'full' | 'hot'): void => {
  if (!runId) throw new Error('TERMINAL_AUTOMATION_RUN_ID_REQUIRED');
  const applicationIdSuffix = `.terauto${runId.replaceAll('-', '').slice(-8).toLowerCase()}`;
  const result = spawnSync('yarn', [`package:${kind}`], {
    cwd: path.join(root, 'apps/terminal/application/android', app),
    encoding: 'utf8',
    env: {
      ...process.env,
      TERMINAL_AUTOMATION_ANDROID_APPLICATION_ID_SUFFIX: applicationIdSuffix,
    },
    maxBuffer: 8 * 1024 * 1024,
    timeout: 45 * 60 * 1000,
  });
  if (result.error || result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().split('\n').slice(-80).join('\n');
    throw new Error(
      `TERMINAL_UPDATE_ARTIFACT_COMMAND_FAILED app=${app} kind=${kind} code=${result.error?.name ?? result.status}\n${output}`,
    );
  }
  expect(result.stdout).toContain(`TERMINAL_UPDATE_ARTIFACT=${kind.toUpperCase()} PASS app=${app} run=${runId}`);
};

it.skipIf(updateCase !== 'update.artifacts')(
  'builds and checks INSTALL, FULL and HOT artifacts for both applications',
  () => {
    if (!runId || !runDirectory) throw new Error('TERMINAL_AUTOMATION_RUN_ID_REQUIRED');
    const selfTest = spawnSync(process.execPath, [buildCommand, '--self-test'], {
      cwd: root,
      encoding: 'utf8',
      env: process.env,
    });
    if (selfTest.error || selfTest.status !== 0) {
      throw new Error(`TERMINAL_UPDATE_ARTIFACT_SELF_TEST_FAILED\n${selfTest.stdout ?? ''}\n${selfTest.stderr ?? ''}`);
    }
    for (const marker of [
      'RED_ZIP_ENTRY_SET=PASS',
      'RED_NATIVE_VERSION_IDENTITY=PASS',
      'RED_INVALID_PUBLICATION_ID=PASS',
      'RED_CHANGED_EMBEDDED_BUNDLE=PASS',
      'RED_MISSING_APK_RESOURCE=PASS',
      'RED_WRONG_RESOURCE_QUALIFIER=PASS',
      'RED_INVALID_RELEASE_VALUES=PASS',
      'RED_INSTALL_IDENTITY_MISMATCH=PASS',
      'RED_EXTERNAL_SYMLINK_INPUT=PASS',
      'HOT_BUNDLE_1_0_9_TO_1_0_10_NEW_CONTENT=PASS',
      'RED_SAME_BUNDLE_VERSION_CHANGED_CONTENT=PASS',
      'RED_HOT_BUNDLE_VERSION_DOWNGRADE=PASS',
    ]) {
      expect(selfTest.stdout).toContain(marker);
    }
    process.stdout.write('TERMINAL_UPDATE_BUILDER_SELF_TEST=PASS\n');
    const generatorSelfTest = spawnSync(process.execPath, [generatorCommand, '--self-test'], {
      cwd: root,
      encoding: 'utf8',
      env: process.env,
    });
    if (generatorSelfTest.error || generatorSelfTest.status !== 0) {
      throw new Error(
        `TERMINAL_UPDATE_ARTIFACT_GENERATOR_SELF_TEST_FAILED\n${generatorSelfTest.stdout ?? ''}\n${generatorSelfTest.stderr ?? ''}`,
      );
    }
    expect(generatorSelfTest.stdout).toContain('TERMINAL_UPDATE_ARTIFACT_SELF_TEST=PASS');
    const generatorCheck = spawnSync(process.execPath, [generatorCommand, '--check'], {
      cwd: root,
      encoding: 'utf8',
      env: process.env,
    });
    if (generatorCheck.error || generatorCheck.status !== 0) {
      throw new Error(
        `TERMINAL_UPDATE_ARTIFACT_GENERATOR_CHECK_FAILED\n${generatorCheck.stdout ?? ''}\n${generatorCheck.stderr ?? ''}`,
      );
    }
    expect(generatorCheck.stdout).toContain('TERMINAL_UPDATE_ARTIFACT_GENERATOR_CHECK=PASS');
    process.stdout.write('TERMINAL_UPDATE_GENERATOR_SELF_TEST=PASS\nTERMINAL_UPDATE_GENERATOR_CHECK=PASS\n');
    for (const app of ['sample-terminal', 'sample-wallpaper-terminal']) {
      const packageJson = JSON.parse(
        readFileSync(path.join(root, 'apps/terminal/application/android', app, 'package.json'), 'utf8'),
      ) as {
        version: string;
        terminalRelease: {nativeBuildNumber: number; bundleVersion: string; runtimeVersion: string};
      };
      runArtifactCommand(app, 'install');
      runArtifactCommand(app, 'full');
      const hotBundleVersion = nextPatchVersion(packageJson.terminalRelease.bundleVersion);
      const previousHotBundleVersion = process.env.TERMINAL_AUTOMATION_UPDATE_BUNDLE_VERSION;
      process.env.TERMINAL_AUTOMATION_UPDATE_BUNDLE_VERSION = hotBundleVersion;
      try {
        runArtifactCommand(app, 'hot');
      } finally {
        if (previousHotBundleVersion === undefined) delete process.env.TERMINAL_AUTOMATION_UPDATE_BUNDLE_VERSION;
        else process.env.TERMINAL_AUTOMATION_UPDATE_BUNDLE_VERSION = previousHotBundleVersion;
      }

      const outputDirectory = path.join(runDirectory, 'update', app);
      const install = JSON.parse(readFileSync(path.join(outputDirectory, 'install.json'), 'utf8')) as {
        applicationId: string;
        nativeVersion: string;
        nativeBuildNumber: number;
        bundleVersion: string;
        runtimeVersion: string;
        files: readonly {path: string; sizeBytes: number; sha256: string}[];
        apk: {path: string; sha256: string};
        publicationId: string;
      };
      const full = JSON.parse(readFileSync(path.join(outputDirectory, 'full.json'), 'utf8')) as {
        applicationId: string;
        nativeVersion: string;
        nativeBuildNumber: number;
        bundleVersion: string;
        runtimeVersion: string;
        apk: {path: string; sha256: string};
        publicationId: string;
      };
      const hot = JSON.parse(readFileSync(path.join(outputDirectory, 'hot.json'), 'utf8')) as {
        applicationId: string;
        nativeVersion: string;
        nativeBuildNumber: number;
        bundleVersion: string;
        runtimeVersion: string;
        files: readonly {path: string; sizeBytes: number; sha256: string}[];
        minimumFull: {
          applicationId: string;
          nativeBuildNumber: number;
          runtimeVersion: string;
          apkSha256: string;
        };
        publicationId: string;
      };
      const installApk = path.join(outputDirectory, install.apk.path);
      const fullApk = path.join(outputDirectory, full.apk.path);
      expect(statSync(installApk).size).toBeGreaterThan(0);
      expect(digest(installApk)).toBe(install.apk.sha256);
      expect(digest(fullApk)).toBe(full.apk.sha256);
      expect(digest(installApk)).toBe(digest(fullApk));
      const identity = {
        applicationId: install.applicationId,
        nativeVersion: packageJson.version,
        nativeBuildNumber: packageJson.terminalRelease.nativeBuildNumber,
        bundleVersion: packageJson.terminalRelease.bundleVersion,
        runtimeVersion: packageJson.terminalRelease.runtimeVersion,
      };
      expect(identity.nativeVersion).toMatch(/^\d+\.\d+\.\d+$/u);
      expect(install).toMatchObject(identity);
      expect(full).toMatchObject(identity);
      expect(hot).toMatchObject({...identity, bundleVersion: hotBundleVersion});
      expect(full.nativeVersion).toBe(install.nativeVersion);
      expect(full.publicationId).toBe(install.publicationId);
      expect(hot.publicationId).toMatch(/^[a-f0-9]{64}$/u);
      const installBundle = install.files.find(item => item.path === 'assets/index.android.bundle');
      const hotBundle = hot.files.find(item => item.path === 'assets/index.android.bundle');
      expect(installBundle?.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(hotBundle?.sha256).toMatch(/^[a-f0-9]{64}$/u);
      const hotBundleBytesChanged = hotBundle?.sha256 !== installBundle?.sha256;
      process.stdout.write(
        `TERMINAL_UPDATE_HOT_VERSION_ADVANCED app=${app} from=${install.bundleVersion} to=${hot.bundleVersion} sha256Changed=${hotBundleBytesChanged}\n`,
      );
      expect(hot.minimumFull.applicationId).toBe(full.applicationId);
      expect(hot.minimumFull.nativeBuildNumber).toBe(full.nativeBuildNumber);
      expect(hot.minimumFull.runtimeVersion).toBe(full.runtimeVersion);
      expect(hot.minimumFull.apkSha256).toBe(full.apk.sha256);
      expect(statSync(path.join(outputDirectory, `${app}-hot.zip`)).size).toBeGreaterThan(0);
      const androidBuild = path.join(root, 'apps/terminal/application/android', app, 'android/build');
      expect(existsSync(path.join(androidBuild, 'generated/autolinking'))).toBe(false);
      expect(existsSync(path.join(androidBuild, 'reports/problems/problems-report.html'))).toBe(false);
      expect(existsSync(path.join(root, 'apps/terminal/node_modules/expo/android/build'))).toBe(false);
      const runAndroidBuild = path.join(runDirectory, 'android-build', app);
      expect(existsSync(path.join(runDirectory, 'android-build', 'native', app, 'app'))).toBe(true);
    }
  },
  90 * 60 * 1000,
);

beforeAll(async () => {
  if (updateCase !== 'update.fixed' && updateCase !== 'update.install-result' && updateCase !== 'update.compatibility') return;
  const runId = process.env.TERMINAL_AUTOMATION_RUN_ID;
  if (!runId) throw new Error('TERMINAL_AUTOMATION_RUN_ID_REQUIRED');
  ownerDriver = createTerminalAutomationDriver({token: testToken, host: '127.0.0.1', port: 0});
  await once(ownerDriver.transport.server, 'listening');
  const address = ownerDriver.transport.server.address();
  if (address === null || typeof address === 'string') throw new Error('TERMINAL_AUTOMATION_UPDATE_DRIVER_ADDRESS_UNAVAILABLE');
  const webPort = await availablePort();
  const url = `http://127.0.0.1:${webPort}/`;
  ownerExpo = spawn('yarn', ['web', '--port', String(webPort)], {
    cwd: integrationRoot,
    detached: true,
    env: {
      ...process.env,
      CI: '1',
      NODE_ENV: 'development',
      EXPO_PUBLIC_TER_AUTOMATION_BUILD: 'true',
      EXPO_PUBLIC_TER_AUTOMATION_RUN_ID: runId,
      EXPO_PUBLIC_TER_AUTOMATION_URL: `ws://127.0.0.1:${address.port}/automation`,
      EXPO_PUBLIC_TER_AUTOMATION_TOKEN: testToken,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await once(ownerExpo, 'spawn');
  if (ownerExpo.pid === undefined) throw new Error('TERMINAL_AUTOMATION_UPDATE_EXPO_PID_UNAVAILABLE');
  ownerExpoIdentity = readProcessIdentity(ownerExpo.pid);
  ownerExpo.stdout?.on('data', (chunk: Buffer) => process.stdout.write(chunk.toString('utf8').replaceAll(testToken, '[REDACTED]')));
  ownerExpo.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk.toString('utf8').replaceAll(testToken, '[REDACTED]')));
  await waitForExpo(url, ownerExpo);
  ownerBrowser = await chromium.launch({headless: true});
  ownerPage = await ownerBrowser.newPage({viewport: {width: 1280, height: 720}});
  const sessionReady = ownerDriver.waitForSession(value => value.appName === sampleConfig.appName, 15_000);
  const response = await ownerPage.goto(url, {waitUntil: 'domcontentloaded', timeout: 15_000});
  if (response === null || !response.ok()) throw new Error('TERMINAL_AUTOMATION_UPDATE_EXPO_PAGE_LOAD_FAILED');
  ownerSession = await sessionReady;
  if (ownerSession.appName !== sampleConfig.appName) throw new Error('TERMINAL_AUTOMATION_UPDATE_SAMPLE_MISMATCH');
}, 90_000);

afterAll(async () => {
  if (updateCase !== 'update.fixed' && updateCase !== 'update.install-result' && updateCase !== 'update.compatibility') return;
  const cleanupErrors: string[] = [];
  try { await ownerBrowser?.close(); } catch { cleanupErrors.push('BROWSER_CLOSE_FAILED'); }
  try { await ownerDriver?.close(); } catch { cleanupErrors.push('DRIVER_CLOSE_FAILED'); }
  if (ownerExpoIdentity !== undefined) {
    try {
      if (managedProcessTree.snapshotProcessTree(ownerExpoIdentity).length > 0) {
        const result = await managedProcessTree.terminateOwnedProcessTree(ownerExpoIdentity);
        if (result.status !== 'PASS' || result.treeReadback.length > 0) cleanupErrors.push('EXPO_TREE_REMAINS');
      }
    } catch { cleanupErrors.push('EXPO_PROCESS_TREE_CLEANUP_FAILED'); }
  }
  if (cleanupErrors.length > 0) throw new Error(`TERMINAL_AUTOMATION_UPDATE_CLEANUP_${cleanupErrors.join('_')}`);
});

it.skipIf(updateCase !== 'update.fixed')('fixes an authorized update target through Runtime and exposes actual facts', async () => {
  if (ownerDriver === undefined || ownerSession === undefined) throw new Error('TERMINAL_AUTOMATION_UPDATE_WEB_NOT_READY');
  const runtimeInfo = responseResult(await ownerDriver.transport.request(ownerSession.sessionId, 'runtime.info', null));
  if (!isRecord(runtimeInfo) || !Array.isArray(runtimeInfo.descriptors)) throw new Error('RUNTIME_INFO_INVALID');
  const descriptor = runtimeInfo.descriptors.find(value => isRecord(value) && value.moduleName === 'kernel.base.terminal-update');
  if (!isRecord(descriptor) || !Array.isArray(descriptor.commandNames) || !Array.isArray(descriptor.selectorNames))
    throw new Error('TERMINAL_UPDATE_RUNTIME_DESCRIPTOR_MISSING');
  const selectorNames = descriptor.selectorNames;
  expect(selectorNames).toEqual(expect.arrayContaining([
    'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
    'kernel.base.terminal-update.selectTerminalUpdateTask',
    'kernel.base.terminal-update.selectTerminalUpdateRecentStatus',
  ]));
  const commandName = descriptor.commandNames.find(value => typeof value === 'string' && value.endsWith('.accept-target'));
  if (typeof commandName !== 'string') throw new Error('TERMINAL_UPDATE_ACCEPT_COMMAND_MISSING');
  const selectionContext = {selectedSpace: 'development', contextIdentity: process.env.TERMINAL_AUTOMATION_RUN_ID};

  const dispatch = async (context: typeof selectionContext) => {
    const completion = waitForMessage(ownerDriver!.transport, ownerSession!.sessionId, message =>
      eventBody(message)?.kind === 'command.result',
    );
    const accepted = responseResult(await ownerDriver!.transport.request(ownerSession!.sessionId, 'command.dispatch', {
      commandName,
      payload: {selectionContext: context},
    }));
    if (!isRecord(accepted) || typeof accepted.requestId !== 'string') throw new Error('TERMINAL_UPDATE_COMMAND_NOT_ACCEPTED');
    const message = await completion;
    const body = eventBody(message);
    if (body?.requestId !== accepted.requestId || !isRecord(body.result)) throw new Error('TERMINAL_UPDATE_COMMAND_RESULT_MISMATCH');
    return body.result;
  };

  const firstResult = await dispatch(selectionContext);
  expect(firstResult).toMatchObject({status: 'completed'});
  if (!isRecord(firstResult) || !Array.isArray(firstResult.actorResults) || !isRecord(firstResult.actorResults[0]))
    throw new Error('TERMINAL_UPDATE_FIRST_ACTOR_RESULT_MISSING');
  expect(firstResult.actorResults[0].result).toMatchObject({status: 'succeeded'});
  const task = await readSelector(ownerDriver.transport, ownerSession.sessionId,
    'kernel.base.terminal-update.selectTerminalUpdateTask', []);
  if (!isRecord(task) || typeof task.taskId !== 'string') throw new Error('TERMINAL_UPDATE_TASK_SELECTOR_INVALID');
  expect(task).toMatchObject({target: {ruleRef: `automation-${process.env.TERMINAL_AUTOMATION_RUN_ID}`}, phase: 'succeeded'});
  const actual = await readSelector(ownerDriver.transport, ownerSession.sessionId,
    'kernel.base.terminal-update.selectTerminalUpdateActualVersions', []);
  expect(actual).toMatchObject({applicationId: sampleConfig.applicationId, entryKind: 'embedded'});
  const recent = await readSelector(ownerDriver.transport, ownerSession.sessionId,
    'kernel.base.terminal-update.selectTerminalUpdateRecentStatus', []);
  expect(recent).toMatchObject({state: 'succeeded', taskId: task.taskId});

  const duplicateResult = await dispatch(selectionContext);
  expect(duplicateResult).toMatchObject({status: 'completed'});
  if (!isRecord(duplicateResult) || !Array.isArray(duplicateResult.actorResults) || !isRecord(duplicateResult.actorResults[0]))
    throw new Error('TERMINAL_UPDATE_DUPLICATE_ACTOR_RESULT_MISSING');
  expect(duplicateResult.actorResults[0].result).toMatchObject({status: 'already-fixed'});
  const conflictResult = await dispatch({selectedSpace: 'other', contextIdentity: process.env.TERMINAL_AUTOMATION_RUN_ID});
  expect(conflictResult).toMatchObject({status: 'completed'});
  if (!isRecord(conflictResult) || !Array.isArray(conflictResult.actorResults) || !isRecord(conflictResult.actorResults[0]))
    throw new Error('TERMINAL_UPDATE_CONFLICT_ACTOR_RESULT_MISSING');
  expect(conflictResult.actorResults[0].result).toMatchObject({status: 'rejected', reason: 'IDENTITY_CONFLICT'});
  const finalTask = await readSelector(ownerDriver.transport, ownerSession.sessionId,
    'kernel.base.terminal-update.selectTerminalUpdateTask', []);
  expect(finalTask).toEqual(task);
}, 30_000);

it.skipIf(updateCase !== 'update.install-result')(
  're-invites a fixed FULL after a confirmed installer cancellation without duplicating a pending action',
  async () => {
    if (ownerDriver === undefined || ownerSession === undefined)
      throw new Error('TERMINAL_AUTOMATION_UPDATE_WEB_NOT_READY');
    const runtimeInfo = responseResult(await ownerDriver.transport.request(ownerSession.sessionId, 'runtime.info', null));
    if (!isRecord(runtimeInfo) || !Array.isArray(runtimeInfo.descriptors)) throw new Error('RUNTIME_INFO_INVALID');
    const descriptor = runtimeInfo.descriptors.find(
      value => isRecord(value) && value.moduleName === 'kernel.base.terminal-update',
    );
    if (!isRecord(descriptor) || !Array.isArray(descriptor.commandNames))
      throw new Error('TERMINAL_UPDATE_RUNTIME_DESCRIPTOR_MISSING');
    const commandName = descriptor.commandNames.find(
      value => typeof value === 'string' && value.endsWith('.accept-target'),
    );
    if (typeof commandName !== 'string') throw new Error('TERMINAL_UPDATE_ACCEPT_COMMAND_MISSING');
    const selectionContext = {selectedSpace: 'development', contextIdentity: process.env.TERMINAL_AUTOMATION_RUN_ID};
    const dispatch = async () => {
      const completion = waitForMessage(ownerDriver!.transport, ownerSession!.sessionId, message =>
        eventBody(message)?.kind === 'command.result',
      );
      const accepted = responseResult(await ownerDriver!.transport.request(ownerSession!.sessionId, 'command.dispatch', {
        commandName,
        payload: {selectionContext},
      }));
      if (!isRecord(accepted) || typeof accepted.requestId !== 'string')
        throw new Error('TERMINAL_UPDATE_COMMAND_NOT_ACCEPTED');
      const message = await completion;
      const body = eventBody(message);
      if (body?.requestId !== accepted.requestId || !isRecord(body.result))
        throw new Error('TERMINAL_UPDATE_COMMAND_RESULT_MISMATCH');
      if (!Array.isArray(body.result.actorResults) || !isRecord(body.result.actorResults[0]))
        throw new Error('TERMINAL_UPDATE_ACTOR_RESULT_MISSING');
      return body.result.actorResults[0].result;
    };

    const first = await dispatch();
    expect(first).toMatchObject({status: 'waiting-user', actionId: expect.any(String)});
    const firstTask = await readSelector(
      ownerDriver.transport,
      ownerSession.sessionId,
      'kernel.base.terminal-update.selectTerminalUpdateTask',
      [],
    );
    if (!isRecord(firstTask) || typeof firstTask.actionId !== 'string')
      throw new Error('TERMINAL_UPDATE_FIRST_ACTION_NOT_PERSISTED');
    expect(firstTask).toMatchObject({
      phase: 'waiting-user',
      target: {ruleRef: `automation-${process.env.TERMINAL_AUTOMATION_RUN_ID}`},
    });

    const retried = await dispatch();
    expect(retried).toMatchObject({status: 'waiting-user', actionId: expect.any(String)});
    const retriedTask = await readSelector(
      ownerDriver.transport,
      ownerSession.sessionId,
      'kernel.base.terminal-update.selectTerminalUpdateTask',
      [],
    );
    if (!isRecord(retriedTask) || typeof retriedTask.actionId !== 'string')
      throw new Error('TERMINAL_UPDATE_REINVITED_ACTION_NOT_PERSISTED');
    expect(retriedTask).toMatchObject({
      phase: 'waiting-user',
      taskId: firstTask.taskId,
      target: firstTask.target,
    });
    expect(retriedTask.actionId).not.toBe(firstTask.actionId);

    expect(await dispatch()).toMatchObject({status: 'already-fixed'});
    expect(await readSelector(
      ownerDriver.transport,
      ownerSession.sessionId,
      'kernel.base.terminal-update.selectTerminalUpdateTask',
      [],
    )).toEqual(retriedTask);
  },
  30_000,
);

it.skipIf(updateCase !== 'update.compatibility')(
  'selects FULL before HOT when the current runtime is below the target FULL identity',
  async () => {
    if (ownerDriver === undefined || ownerSession === undefined)
      throw new Error('TERMINAL_AUTOMATION_UPDATE_WEB_NOT_READY');
    const before = await readSelector(
      ownerDriver.transport,
      ownerSession.sessionId,
      'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
      [],
    );
    expect(before).toMatchObject({nativeBuildNumber: 1, bundleVersion: '1.0.5', entryKind: 'hot'});

    const runtimeInfo = responseResult(await ownerDriver.transport.request(ownerSession.sessionId, 'runtime.info', null));
    if (!isRecord(runtimeInfo) || !Array.isArray(runtimeInfo.descriptors)) throw new Error('RUNTIME_INFO_INVALID');
    const descriptor = runtimeInfo.descriptors.find(
      value => isRecord(value) && value.moduleName === 'kernel.base.terminal-update',
    );
    if (!isRecord(descriptor) || !Array.isArray(descriptor.commandNames))
      throw new Error('TERMINAL_UPDATE_RUNTIME_DESCRIPTOR_MISSING');
    const commandName = descriptor.commandNames.find(
      value => typeof value === 'string' && value.endsWith('.accept-target'),
    );
    if (typeof commandName !== 'string') throw new Error('TERMINAL_UPDATE_ACCEPT_COMMAND_MISSING');

    const completion = waitForMessage(ownerDriver.transport, ownerSession.sessionId, message =>
      eventBody(message)?.kind === 'command.result',
    );
    const accepted = responseResult(await ownerDriver.transport.request(ownerSession.sessionId, 'command.dispatch', {
      commandName,
      payload: {selectionContext: {selectedSpace: 'development', contextIdentity: runId}},
    }));
    if (!isRecord(accepted) || typeof accepted.requestId !== 'string')
      throw new Error('TERMINAL_UPDATE_COMMAND_NOT_ACCEPTED');
    const message = await completion;
    const body = eventBody(message);
    if (body?.requestId !== accepted.requestId || !isRecord(body.result) || !Array.isArray(body.result.actorResults) ||
      !isRecord(body.result.actorResults[0]) || !isRecord(body.result.actorResults[0].result))
      throw new Error('TERMINAL_UPDATE_COMMAND_RESULT_MISMATCH');
    expect(body.result.actorResults[0].result).toMatchObject({status: 'applying'});

    const task = await readSelector(
      ownerDriver.transport,
      ownerSession.sessionId,
      'kernel.base.terminal-update.selectTerminalUpdateTask',
      [],
    );
    expect(task).toMatchObject({
      phase: 'applying-full',
      target: {
        full: {artifact: {nativeBuildNumber: 2, bundleVersion: '1.0.4'}},
        hot: {artifact: {nativeBuildNumber: 2, bundleVersion: '1.0.6'}},
      },
    });
    const after = await readSelector(
      ownerDriver.transport,
      ownerSession.sessionId,
      'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
      [],
    );
    expect(after).toMatchObject({nativeBuildNumber: 1, bundleVersion: '1.0.5', entryKind: 'hot'});
    process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS case=update.compatibility run=${runId}\n`);
  },
  30_000,
);
