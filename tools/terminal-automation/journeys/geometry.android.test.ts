import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {mkdirSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import type {Client} from '@devicefarmer/adbkit';
import {adminTestIds} from '@catering-v2s/ui-base-admin-shell/test-ids';
import {
  androidAutomationBuildIdentity,
  androidAutomationGradleArguments,
  createAndroidAdbClient,
  createAndroidAutomationConnection,
  waitForAutomationSession,
  type AndroidAutomationConnection,
} from '../src/index.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const androidProjectRoot = path.join(root, 'apps/terminal/application/android/sample-terminal/android');
const applicationId = 'com.anonymous.sampleterminal';
const launcherTestId = adminTestIds.launcher;
const sessionToken = `ter-auto-${randomUUID()}`;
const runId = process.env.TERMINAL_AUTOMATION_RUN_ID;
const serial = process.env.TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIAL;
const packageIdFromManifest = process.env.TERMINAL_AUTOMATION_ANDROID_PACKAGE_ID;
const shape = process.env.TERMINAL_AUTOMATION_SHAPE === 'mobile' ? 'mobile' : 'dual';
const adbPath = process.env.ADB_PATH || 'adb';

const responseResult = (response: unknown): unknown => {
  if (
    typeof response !== 'object' ||
    response === null ||
    !('type' in response) ||
    response.type !== 'response' ||
    !('body' in response) ||
    typeof response.body !== 'object' ||
    response.body === null ||
    !('result' in response.body)
  )
    throw new Error('TERMINAL_AUTOMATION_ANDROID_RESPONSE_INVALID');
  return response.body.result;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const waitForRegisteredNode = async (
  input: Readonly<{
    readonly connection: AndroidAutomationConnection;
    readonly sessionId: string;
    readonly testID: string;
    readonly surface: 'PRIMARY' | 'SECONDARY';
    readonly displayIndex: number;
  }>,
): Promise<void> => {
  const subscriptionId = `android-node-${randomUUID()}`;
  let subscribed = false;
  let timeoutId: NodeJS.Timeout | undefined;
  let resolveNode!: () => void;
  let rejectNode!: (error: Error) => void;
  const nodeAppeared = new Promise<void>((resolve, reject) => {
    resolveNode = resolve;
    rejectNode = reject;
  });
  const matchesNode = (value: unknown): boolean =>
    isRecord(value) &&
    value.testID === input.testID &&
    isRecord(value.surface) &&
    value.surface.surface === input.surface &&
    value.surface.displayIndex === input.displayIndex;
  const removeListener = input.connection.driver.onMessage(input.sessionId, message => {
    if (message.type !== 'event' || !isRecord(message.body) || message.body.subscriptionId !== subscriptionId) return;
    if (Array.isArray(message.body.nodes)) {
      const matches = message.body.nodes.filter(matchesNode);
      if (matches.length === 1) {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        resolveNode();
      } else if (matches.length > 1) {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        rejectNode(new Error('TERMINAL_AUTOMATION_ANDROID_NODE_AMBIGUOUS'));
      }
    }
  });
  try {
    const response = await input.connection.driver.request(input.sessionId, 'controls.subscribe', {
      subscriptionId,
      filter: {testID: input.testID, surface: input.surface, displayIndex: input.displayIndex},
    });
    const initial = responseResult(response);
    subscribed = true;
    if (!isRecord(initial) || !Array.isArray(initial.nodes)) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_CONTROL_SUBSCRIBE_INVALID');
    }
    const initialMatches = initial.nodes.filter(matchesNode);
    if (initialMatches.length > 1) throw new Error('TERMINAL_AUTOMATION_ANDROID_NODE_AMBIGUOUS');
    if (initialMatches.length === 1) return;
    timeoutId = setTimeout(() => rejectNode(new Error('TERMINAL_AUTOMATION_ANDROID_NODE_NOT_OBSERVED')), 5_000);
    await nodeAppeared;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    removeListener();
    if (subscribed) {
      responseResult(await input.connection.driver.request(input.sessionId, 'controls.unsubscribe', {subscriptionId}));
    }
  }
};

const streamBuild = async (args: readonly string[]): Promise<void> => {
  const child = spawn('./gradlew', [...args], {
    cwd: androidProjectRoot,
    detached: true,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      EXPO_PUBLIC_TER_AUTOMATION_BUILD: 'true',
      EXPO_PUBLIC_TER_AUTOMATION_URL: 'ws://127.0.0.1:19090/automation',
      EXPO_PUBLIC_TER_AUTOMATION_TOKEN: sessionToken,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const forward = (chunk: Buffer): void => {
    const safe = chunk.toString('utf8').replaceAll(sessionToken, '[REDACTED]');
    output += safe;
    process.stdout.write(safe);
  };
  child.stdout?.on('data', value => forward(Buffer.from(value)));
  child.stderr?.on('data', value => forward(Buffer.from(value)));
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, 8 * 60_000);
  let code: number | null;
  try {
    [code] = (await once(child, 'close')) as [number | null];
  } catch {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_SPAWN_FAILED');
  } finally {
    clearTimeout(timeout);
  }
  if (timedOut) throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_TIMEOUT');
  if (code !== 0) {
    const failure = output.includes('TERMINAL_AUTOMATION_')
      ? output.match(/TERMINAL_AUTOMATION_[A-Z0-9_]+/u)?.[0]
      : null;
    throw new Error(failure ?? `TERMINAL_AUTOMATION_ANDROID_BUILD_EXIT_${code ?? 'UNKNOWN'}`);
  }
};

describe('terminal automation Android geometry feasibility', () => {
  let adb: Client | undefined;
  let connection: AndroidAutomationConnection | undefined;
  let packageWasAbsent = false;
  let installAttempted = false;
  let packageId: string | undefined;

  beforeAll(async () => {
    if (!runId || !serial || !packageIdFromManifest)
      throw new Error('TERMINAL_AUTOMATION_ANDROID_RUN_IDENTITY_REQUIRED');
    const buildIdentity = androidAutomationBuildIdentity(runId);
    if (buildIdentity.packageId !== packageIdFromManifest) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_PACKAGE_IDENTITY_MISMATCH');
    }
    packageId = buildIdentity.packageId;
    adb = createAndroidAdbClient({adbPath, timeoutMs: 10_000});
    connection = await createAndroidAutomationConnection({
      client: adb,
      serial,
      repositoryRoot: root,
      adbPath,
      shape,
      token: sessionToken,
    });
    const displays = await connection.discoverDisplays();
    if (shape === 'dual' && displays.secondary === null) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_DUAL_DISPLAY_REQUIRED');
    }
    if (await connection.isInstalled(packageId)) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_RUN_PACKAGE_ALREADY_INSTALLED');
    }
    packageWasAbsent = true;

    const runDirectory = path.join(root, '.runtime/terminal-automation', runId);
    const buildDirectory = path.join(runDirectory, 'android-build');
    mkdirSync(buildDirectory, {recursive: true, mode: 0o700});
    const args = androidAutomationGradleArguments(
      buildIdentity.applicationIdSuffix,
      realpathSync(runDirectory) + '/android-build',
    );
    process.stdout.write(`TERMINAL_AUTOMATION_ANDROID_BUILD_STARTED packageId=${packageId} serial=${serial}\n`);
    await streamBuild(args);
    const apk = path.join(buildDirectory, 'outputs/apk/debug/app-debug.apk');
    if (await connection.isInstalled(packageId)) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_RUN_PACKAGE_APPEARED_BEFORE_INSTALL');
    }
    installAttempted = true;
    await connection.install(apk);
    if (!(await connection.isInstalled(packageId)))
      throw new Error('TERMINAL_AUTOMATION_ANDROID_INSTALL_READBACK_FAILED');
    await connection.launch(`${packageId}/${applicationId}.MainActivity`);
    await waitForAutomationSession(connection.driver, session => session.appName === 'sample-console', 30_000);
  }, 600_000);

  afterAll(async () => {
    const errors: string[] = [];
    if (connection !== undefined && packageId !== undefined) {
      try {
        if (packageWasAbsent && (installAttempted || (await connection.isInstalled(packageId)))) {
          await connection.forceStop(packageId);
          await connection.uninstall(packageId);
        }
        if (await connection.isInstalled(packageId)) errors.push('ANDROID_RUN_PACKAGE_REMAINS');
      } catch {
        errors.push('ANDROID_RUN_PACKAGE_CLEANUP_FAILED');
      }
    }
    try {
      await connection?.close();
    } catch {
      errors.push('ANDROID_CONNECTION_CLEANUP_FAILED');
    }
    if (errors.length > 0) throw new Error(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:${errors.join('_')}`);
    process.stdout.write('TERMINAL_AUTOMATION_DEVICE_CLEANUP_COMPLETE\n');
  });

  it('uses measured native bounds and the selected physical display for real input', async () => {
    if (connection === undefined || serial === undefined)
      throw new Error('TERMINAL_AUTOMATION_ANDROID_FIXTURE_NOT_READY');
    const session = connection.driver.getSessions().find(value => value.appName === 'sample-console');
    if (session === undefined) throw new Error('TERMINAL_AUTOMATION_ANDROID_SESSION_MISSING');
    const displays = await connection.discoverDisplays();
    const surfaces = shape === 'dual' ? (['primary', 'secondary'] as const) : (['primary'] as const);

    for (const surface of surfaces) {
      const displayIndex = surface === 'primary' ? 0 : 1;
      const query = responseResult(
        await connection.driver.request(session.sessionId, 'controls.query', {
          filter: {testID: launcherTestId, surface: surface === 'primary' ? 'PRIMARY' : 'SECONDARY', displayIndex},
        }),
      );
      if (!isRecord(query) || !Array.isArray(query.nodes) || query.nodes.length !== 1 || !isRecord(query.nodes[0])) {
        throw new Error(`TERMINAL_AUTOMATION_ANDROID_LAUNCHER_REGISTRATION_INVALID_${surface.toUpperCase()}`);
      }
      const node = query.nodes[0];
      if (
        !isRecord(node.surface) ||
        node.surface.displayIndex !== displayIndex ||
        typeof node.nodeInstanceId !== 'string' ||
        !Number.isSafeInteger(node.surface.layoutRevision)
      ) {
        throw new Error(`TERMINAL_AUTOMATION_ANDROID_LAUNCHER_IDENTITY_INVALID_${surface.toUpperCase()}`);
      }
      const boundsResult = responseResult(
        await connection.driver.request(session.sessionId, 'controls.bounds', {
          nodeInstanceId: node.nodeInstanceId,
          layoutRevision: node.surface.layoutRevision,
        }),
      );
      if (!isRecord(boundsResult) || !isRecord(boundsResult.bounds)) {
        throw new Error(`TERMINAL_AUTOMATION_ANDROID_LAUNCHER_BOUNDS_INVALID_${surface.toUpperCase()}`);
      }
      const bounds = boundsResult.bounds;
      if (
        ![bounds.x, bounds.y, bounds.width, bounds.height].every(
          value => typeof value === 'number' && Number.isFinite(value),
        )
      ) {
        throw new Error(`TERMINAL_AUTOMATION_ANDROID_LAUNCHER_BOUNDS_INVALID_${surface.toUpperCase()}`);
      }
      const logicalBounds = bounds as {x: number; y: number; width: number; height: number};
      const targetDisplay = surface === 'primary' ? displays.primary : displays.secondary;
      if (targetDisplay === null) throw new Error('TERMINAL_AUTOMATION_ANDROID_SECONDARY_DISPLAY_MISSING');
      const png = await connection.capture(surface);
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const tapPositions = [
        {x: 0, y: 0},
        {x: 1, y: 0},
        {x: 0, y: 1},
        {x: 1, y: 1},
        {x: 0.5, y: 0.5},
      ] as const;
      for (const [index, position] of tapPositions.entries()) {
        const point = await connection.tapBounds(surface, logicalBounds, position);
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThan(targetDisplay.surfaceSize.width);
        expect(point.y).toBeLessThan(targetDisplay.surfaceSize.height);
        process.stdout.write(
          `TERMINAL_AUTOMATION_ANDROID_INPUT surface=${surface.toUpperCase()} displayIndex=${displayIndex} displayId=${targetDisplay.logicalDisplayId} sample=${index + 1} point=${point.x},${point.y}\n`,
        );
      }

      // AdminLauncher is intentionally a plain View rather than a Pressable.
      // Drive its documented five-touch gesture at the same logical point as
      // the Web proof, then observe the real login input instead of treating
      // successful adb commands as proof that coordinate mapping worked.
      const gesturePosition = {x: 48 / 1280, y: 0};
      const loginNode = waitForRegisteredNode({
        connection,
        sessionId: session.sessionId,
        testID: adminTestIds.passwordInput,
        surface: surface === 'primary' ? 'PRIMARY' : 'SECONDARY',
        displayIndex,
      });
      for (let index = 0; index < 5; index += 1) {
        await connection.tapBounds(surface, logicalBounds, gesturePosition);
      }
      await loginNode;
      const loginQuery = responseResult(
        await connection.driver.request(session.sessionId, 'controls.query', {
          filter: {
            testID: adminTestIds.passwordInput,
            surface: surface === 'primary' ? 'PRIMARY' : 'SECONDARY',
            displayIndex,
          },
        }),
      );
      if (!isRecord(loginQuery) || !Array.isArray(loginQuery.nodes) || loginQuery.nodes.length !== 1) {
        throw new Error(`TERMINAL_AUTOMATION_ANDROID_LAUNCHER_GESTURE_NOT_OBSERVED_${surface.toUpperCase()}`);
      }
      process.stdout.write(
        `TERMINAL_AUTOMATION_ANDROID_LAUNCHER_GESTURE_OBSERVED surface=${surface.toUpperCase()} displayIndex=${displayIndex}\n`,
      );
    }
  }, 120_000);

  it('reconnects after an abnormal socket close without changing the native Runtime identity', async () => {
    if (connection === undefined) throw new Error('TERMINAL_AUTOMATION_ANDROID_FIXTURE_NOT_READY');
    const current = connection.driver.getSessions().find(value => value.appName === 'sample-console');
    if (current === undefined) throw new Error('TERMINAL_AUTOMATION_ANDROID_SESSION_MISSING');
    current.socket.terminate();
    const reconnected = await waitForAutomationSession(
      connection.driver,
      session => session.appName === 'sample-console' && session.sessionId !== current.sessionId,
      30_000,
    );
    expect(reconnected.runtimeId).toBe(current.runtimeId);
    expect(connection.driver.getSession(current.sessionId)).toBeNull();
  }, 45_000);
});
