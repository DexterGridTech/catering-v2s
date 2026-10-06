import {execFileSync, spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync} from 'node:fs';
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
import type {AutomationEnvelope} from '@catering-v2s/ui-base-automation-agent/protocol';
import type {TerminalAutomationProcessIdentity} from '../src/managedRun.ts';
import {measureAutomationBundleAttribution} from '../src/bundleAttribution.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const androidProjectRoot = path.join(root, 'apps/terminal/application/android/sample-terminal/android');
const applicationId = 'com.anonymous.sampleterminal';
const runId = process.env.TERMINAL_AUTOMATION_RUN_ID;
const serial = process.env.TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIAL;
const shape = process.env.TERMINAL_AUTOMATION_SHAPE;
const packageIdFromManifest = process.env.TERMINAL_AUTOMATION_ANDROID_PACKAGE_ID;
const adbPath = process.env.ADB_PATH || 'adb';
const token = `ter-auto-f4-${randomUUID()}`;
const require = createRequire(import.meta.url);
const managedProcessTree = require('../../../scripts/dev/managed-process-tree.mjs') as {
  readProcessTable: () => readonly {pid: number; ppid: number; pgid: number; startToken: string}[];
  terminateOwnedProcessTree: (identity: TerminalAutomationProcessIdentity) => Promise<{
    status: 'PASS' | 'FAIL';
    treeReadback: readonly {pid: number; startToken: string}[];
  }>;
};

type Measurement = Readonly<{
  readonly phase: string;
  readonly elapsedMs: number;
  readonly payloadBytes: number;
  readonly activeSubscriptions: number;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const responseResult = (message: AutomationEnvelope): unknown => {
  if (message.type !== 'response' || !isRecord(message.body) || !('result' in message.body)) {
    throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_RESPONSE_INVALID');
  }
  return message.body.result;
};
const eventBody = (message: AutomationEnvelope): Record<string, unknown> | undefined =>
  message.type === 'event' && isRecord(message.body) ? message.body : undefined;

const readProcessIdentity = (pid: number): TerminalAutomationProcessIdentity => {
  const row = managedProcessTree.readProcessTable().find(value => value.pid === pid);
  if (row === undefined || row.pgid !== pid || row.startToken.length === 0) {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_PROCESS_IDENTITY_UNAVAILABLE');
  }
  return Object.freeze({pid: row.pid, pgid: row.pgid, startToken: row.startToken});
};

const collectApks = (directory: string): string[] => {
  const results: string[] = [];
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...collectApks(candidate));
    else if (entry.isFile() && entry.name.endsWith('.apk')) results.push(candidate);
  }
  return results;
};

const buildReleaseApk = async (runDirectory: string, suffix: string): Promise<string> => {
  const buildDirectory = path.join(runDirectory, 'android-build');
  mkdirSync(buildDirectory, {recursive: true, mode: 0o700});
  const canonicalRunDirectory = realpathSync(runDirectory);
  const child = spawn(
    './gradlew',
    androidAutomationGradleArguments(suffix, `${canonicalRunDirectory}/android-build`, 'release'),
    {
      cwd: androidProjectRoot,
      detached: true,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        EXPO_PUBLIC_TER_AUTOMATION_BUILD: 'true',
        EXPO_PUBLIC_TER_AUTOMATION_URL: 'ws://127.0.0.1:19090/automation',
        EXPO_PUBLIC_TER_AUTOMATION_TOKEN: token,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  if (!child.pid) throw new Error('TERMINAL_AUTOMATION_ANDROID_RELEASE_BUILD_PID_UNAVAILABLE');
  const identity = readProcessIdentity(child.pid);
  const writeRedacted = (chunk: Buffer): void => {
    process.stdout.write(chunk.toString('utf8').replaceAll(token, '[REDACTED]'));
  };
  child.stdout?.on('data', value => writeRedacted(Buffer.from(value)));
  child.stderr?.on('data', value => writeRedacted(Buffer.from(value)));
  const timeout = setTimeout(() => void managedProcessTree.terminateOwnedProcessTree(identity), 10 * 60_000);
  let exitCode: number | null;
  try {
    [exitCode] = (await once(child, 'close')) as [number | null];
  } finally {
    clearTimeout(timeout);
  }
  if (exitCode !== 0) throw new Error(`TERMINAL_AUTOMATION_ANDROID_RELEASE_BUILD_EXIT_${exitCode ?? 'UNKNOWN'}`);
  const outputDirectory = path.join(buildDirectory, 'outputs/apk/release');
  const apks = collectApks(outputDirectory);
  if (apks.length !== 1) throw new Error('TERMINAL_AUTOMATION_ANDROID_RELEASE_APK_COUNT_INVALID');
  return apks[0] as string;
};

type PackagerBundleCapture = Readonly<{
  readonly bundlePath: string;
  readonly sourceMapPath: string;
  readonly inputSha256: string;
  readonly sourceMapSha256: string;
  readonly gradlePackagerMapSha256: string;
  readonly versions: Readonly<Record<string, string>>;
}>;

const captureReleasePackagerBundle = async (runDirectory: string): Promise<PackagerBundleCapture> => {
  const projectRoot = path.join(root, 'apps/terminal/application/android/sample-terminal');
  const androidRoot = path.join(projectRoot, 'android');
  const captureDirectory = path.join(runDirectory, 'android-build/packager-attribution');
  const assetsDirectory = path.join(captureDirectory, 'assets');
  mkdirSync(assetsDirectory, {recursive: true, mode: 0o700});
  const bundlePath = path.join(captureDirectory, 'index.android.bundle.js');
  const sourceMapPath = path.join(captureDirectory, 'index.android.bundle.packager.map');
  const cliPath = require.resolve('@expo/cli', {paths: [projectRoot]});
  const entryFile = execFileSync(
    process.execPath,
    ['-e', "require('expo/scripts/resolveAppEntry')", projectRoot, 'android', 'absolute'],
    {cwd: androidRoot, encoding: 'utf8'},
  ).trim();
  if (entryFile.length === 0) throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_ENTRY_FILE_UNAVAILABLE');
  const args = [
    cliPath,
    'export:embed',
    '--platform', 'android',
    '--dev', 'false',
    '--reset-cache',
    '--entry-file', entryFile,
    '--bundle-output', bundlePath,
    '--assets-dest', assetsDirectory,
    '--sourcemap-output', sourceMapPath,
    '--minify', 'false',
    '--verbose',
  ];
  process.stdout.write('TERMINAL_AUTOMATION_F4_ANDROID_PACKAGER_CAPTURE_START mode=release-hermes-input\n');
  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    detached: true,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      EXPO_PUBLIC_TER_AUTOMATION_BUILD: 'true',
      EXPO_PUBLIC_TER_AUTOMATION_URL: 'ws://127.0.0.1:19090/automation',
      EXPO_PUBLIC_TER_AUTOMATION_TOKEN: token,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!child.pid) throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_PACKAGER_PID_UNAVAILABLE');
  const identity = readProcessIdentity(child.pid);
  const writeRedacted = (chunk: Buffer): void => {
    process.stdout.write(chunk.toString('utf8').replaceAll(token, '[REDACTED]'));
  };
  child.stdout?.on('data', value => writeRedacted(Buffer.from(value)));
  child.stderr?.on('data', value => writeRedacted(Buffer.from(value)));
  const timeout = setTimeout(() => void managedProcessTree.terminateOwnedProcessTree(identity), 10 * 60_000);
  let exitCode: number | null;
  try {
    [exitCode] = (await once(child, 'close')) as [number | null];
  } finally {
    clearTimeout(timeout);
  }
  if (exitCode !== 0)
    throw new Error(`TERMINAL_AUTOMATION_F4_ANDROID_PACKAGER_EXIT_${exitCode ?? 'UNKNOWN'}`);
  const bundleBytes = readFileSync(bundlePath);
  const sourceMapBytes = readFileSync(sourceMapPath);
  const gradlePackagerMapPath = path.join(
    runDirectory,
    'android-build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map',
  );
  const packagerMap: unknown = JSON.parse(sourceMapBytes.toString('utf8'));
  const gradlePackagerMap: unknown = JSON.parse(readFileSync(gradlePackagerMapPath, 'utf8'));
  if (
    !isRecord(packagerMap) ||
    !isRecord(gradlePackagerMap) ||
    packagerMap.mappings !== gradlePackagerMap.mappings ||
    JSON.stringify(packagerMap.sources) !== JSON.stringify(gradlePackagerMap.sources) ||
    JSON.stringify(packagerMap.names) !== JSON.stringify(gradlePackagerMap.names)
  ) {
    throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_PACKAGER_MAP_BUILD_INPUT_MISMATCH');
  }
  const packageVersion = (name: string): string => {
    const packagePath = require.resolve(`${name}/package.json`, {paths: [projectRoot]});
    const parsed: unknown = JSON.parse(readFileSync(packagePath, 'utf8'));
    if (!isRecord(parsed) || typeof parsed.version !== 'string')
      throw new Error(`TERMINAL_AUTOMATION_F4_ANDROID_PACKAGE_VERSION_INVALID_${name.replace(/[^a-zA-Z0-9]/gu, '_')}`);
    return parsed.version;
  };
  const agentPackage = JSON.parse(readFileSync(path.join(root, 'apps/terminal/ui/base/automation-agent/package.json'), 'utf8')) as {
    readonly name?: unknown;
    readonly version?: unknown;
  };
  if (agentPackage.name !== '@catering-v2s/ui-base-automation-agent')
    throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_AUTOMATION_AGENT_PACKAGE_IDENTITY_INVALID');
  return Object.freeze({
    bundlePath,
    sourceMapPath,
    inputSha256: createHash('sha256').update(bundleBytes).digest('hex'),
    sourceMapSha256: createHash('sha256').update(sourceMapBytes).digest('hex'),
    gradlePackagerMapSha256: createHash('sha256')
      .update(JSON.stringify([packagerMap.sources, packagerMap.names, packagerMap.mappings]))
      .digest('hex'),
    versions: Object.freeze({
      node: process.version,
      expoCli: packageVersion('@expo/cli'),
      expo: packageVersion('expo'),
      reactNative: packageVersion('react-native'),
      metro: packageVersion('metro'),
      metroSourceMap: packageVersion('metro-source-map'),
      automationAgent: typeof agentPackage.version === 'string' ? agentPackage.version : 'UNVERSIONED_WORKSPACE_PACKAGE',
      rxjs: packageVersion('rxjs'),
      zod: packageVersion('zod'),
      dequal: packageVersion('dequal'),
    }),
  });
};

const percentile95 = (values: readonly number[]): number => {
  if (values.length === 0) throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_MEASUREMENTS_MISSING');
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * 0.95) - 1] as number;
};

const waitForMessage = (
  connection: AndroidAutomationConnection,
  sessionId: string,
  predicate: (message: AutomationEnvelope) => boolean,
  timeoutMs = 10_000,
): Promise<AutomationEnvelope> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('TERMINAL_AUTOMATION_F4_ANDROID_MESSAGE_TIMEOUT'));
    }, timeoutMs);
    const unsubscribe = connection.driver.onMessage(sessionId, message => {
      if (!predicate(message)) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(message);
    });
  });

const waitForRegisteredNode = async (
  connection: AndroidAutomationConnection,
  sessionId: string,
  testID: string,
): Promise<Record<string, unknown>> => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const result = responseResult(
      await connection.driver.request(sessionId, 'controls.query', {
        filter: {testID, surface: 'PRIMARY'},
      }),
    );
    if (isRecord(result) && Array.isArray(result.nodes)) {
      if (result.nodes.length === 1 && isRecord(result.nodes[0])) return result.nodes[0];
      if (result.nodes.length > 1) {
        throw new Error(`TERMINAL_AUTOMATION_F4_ANDROID_NODE_AMBIGUOUS_${testID}_PRIMARY`);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  let observedSurfaces = 'unavailable';
  try {
    const result = responseResult(
      await connection.driver.request(sessionId, 'controls.query', {filter: {testID}}),
    );
    if (isRecord(result) && Array.isArray(result.nodes)) {
      observedSurfaces =
        result.nodes
          .filter(isRecord)
          .map(node => {
            if (!isRecord(node.surface)) return 'invalid';
            const surface = typeof node.surface.surface === 'string' ? node.surface.surface : 'invalid';
            const displayIndex =
              typeof node.surface.displayIndex === 'number' && Number.isSafeInteger(node.surface.displayIndex)
                ? node.surface.displayIndex
                : 'invalid';
            return `${surface}:${displayIndex}`;
          })
          .join(',') || 'none';
    }
  } catch {
    // Preserve the missing-node failure if best-effort diagnostics are unavailable.
  }
  throw new Error(
    `TERMINAL_AUTOMATION_F4_ANDROID_NODE_NOT_REGISTERED_${testID}_PRIMARY observed=${observedSurfaces}`,
  );
};

const waitForNumericVirtualKeyboard = async (
  connection: AndroidAutomationConnection,
  sessionId: string,
): Promise<void> => {
  const deadline = Date.now() + 10_000;
  let previousBounds: string | null = null;
  let stableBoundsReads = 0;
  while (Date.now() < deadline) {
    const result = responseResult(await connection.driver.request(sessionId, 'controls.query', {filter: {}}));
    if (isRecord(result) && Array.isArray(result.nodes)) {
      const numericKeys = result.nodes.filter(
        node =>
          isRecord(node) &&
          typeof node.testID === 'string' &&
          /^ui\.base\.input:virtual-keyboard:text-[0-9]$/u.test(node.testID),
      );
      if (numericKeys.length === 10) {
        const node = numericKeys[0];
        if (
          isRecord(node) &&
          typeof node.nodeInstanceId === 'string' &&
          isRecord(node.surface) &&
          Number.isSafeInteger(node.surface.layoutRevision)
        ) {
          const boundsResponse = await connection.driver.request(sessionId, 'controls.bounds', {
            nodeInstanceId: node.nodeInstanceId,
            layoutRevision: node.surface.layoutRevision,
          });
          if (
            boundsResponse.type === 'error' &&
            isRecord(boundsResponse.body) &&
            (boundsResponse.body.code === 'STALE_BOUNDS' || boundsResponse.body.code === 'NODE_GONE')
          ) {
            await new Promise(resolve => setTimeout(resolve, 50));
            continue;
          }
          const measured = responseResult(boundsResponse);
          if (isRecord(measured) && isRecord(measured.bounds)) {
            const values = [measured.bounds.x, measured.bounds.y, measured.bounds.width, measured.bounds.height];
            if (values.every(value => typeof value === 'number' && Number.isFinite(value))) {
              const [x, y, width, height] = values as number[];
              if (width > 0 && height > 0) {
                const currentBounds = `${x},${y},${width},${height}`;
                stableBoundsReads = currentBounds === previousBounds ? stableBoundsReads + 1 : 1;
                previousBounds = currentBounds;
                if (stableBoundsReads >= 3) return;
              }
            }
          }
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_NUMERIC_KEYBOARD_BOUNDS_NOT_STABLE');
};

const tapTestID = async (
  connection: AndroidAutomationConnection,
  sessionId: string,
  testID: string,
  step: string,
  position?: Readonly<{readonly x: number; readonly y: number}>,
): Promise<void> => {
  const node = await waitForRegisteredNode(connection, sessionId, testID);
  if (
    !isRecord(node.surface) ||
    node.surface.surface !== 'PRIMARY' ||
    (node.surface.displayIndex !== 0 && node.surface.displayIndex !== 1)
  ) {
    throw new Error(`TERMINAL_AUTOMATION_F4_ANDROID_NODE_SURFACE_INVALID_${testID}`);
  }
  process.stdout.write(`TERMINAL_AUTOMATION_F4_ANDROID_TAP_START step=${step}\n`);
  try {
    await connection.tapRegisteredNode({
      sessionId,
      testID,
      surface: 'primary',
      displayIndex: node.surface.displayIndex,
      ...(position === undefined ? {} : {position}),
    });
  } catch (error) {
    const cause =
      error instanceof Error && error.message.startsWith('TERMINAL_AUTOMATION_')
        ? error.message.replace(/\s+/gu, '_')
        : error instanceof Error
          ? error.name
          : 'UnknownError';
    throw new Error(`TERMINAL_AUTOMATION_F4_ANDROID_TAP_FAILED step=${step} cause=${cause}`);
  }
  process.stdout.write(`TERMINAL_AUTOMATION_F4_ANDROID_TAP_COMPLETE step=${step}\n`);
};

const enterAdminRuntimePage = async (
  connection: AndroidAutomationConnection,
  sessionId: string,
  shape: string,
): Promise<readonly unknown[]> => {
  const launcherGesturePosition = {x: 48 / 1280, y: 0};
  for (let index = 0; index < 5; index += 1) {
    await tapTestID(
      connection,
      sessionId,
      adminTestIds.launcher,
      `launcher-gesture-${index + 1}`,
      launcherGesturePosition,
    );
  }
  await waitForRegisteredNode(connection, sessionId, adminTestIds.passwordInput);
  await waitForNumericVirtualKeyboard(connection, sessionId);
  const passwordNode = await waitForRegisteredNode(connection, sessionId, adminTestIds.debugPassword);
  const passwordText = typeof passwordNode.value === 'string' ? passwordNode.value : passwordNode.label;
  if (typeof passwordText !== 'string') throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_ADMIN_PASSWORD_UNAVAILABLE');
  const password = passwordText.match(/\d{6}/u)?.[0];
  if (!password) throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_ADMIN_PASSWORD_UNAVAILABLE');
  for (const [index, digit] of [...password].entries()) {
    await tapTestID(
      connection,
      sessionId,
      `ui.base.input:virtual-keyboard:text-${digit}`,
      `admin-password-key-${index + 1}`,
    );
  }
  try {
    await tapTestID(connection, sessionId, adminTestIds.verify, 'admin-password-submit');
  } catch (error) {
    const submitPressed =
      error instanceof Error &&
      error.message.includes('TERMINAL_AUTOMATION_ANDROID_INTERACTION_TIMEOUT_observed=press-in_');
    if (!submitPressed) throw error;
    process.stdout.write(
      'TERMINAL_AUTOMATION_F4_ANDROID_SUBMIT_PRESS_IN observed; awaiting authenticated shell transition\n',
    );
    await waitForRegisteredNode(connection, sessionId, adminTestIds.shell);
  }
  await waitForRegisteredNode(connection, sessionId, adminTestIds.shell);
  if (shape === 'dual') {
    // Dual-screen uses the laptop admin shell, whose Runtime section is a
    // directly visible navigation button rather than the mobile dropdown.
    await tapTestID(
      connection,
      sessionId,
      adminTestIds.sections.runtime,
      'admin-runtime-navigation-select',
    );
  } else if (shape === 'mobile') {
    await tapTestID(connection, sessionId, adminTestIds.node('terminal.admin:navigation:trigger'), 'admin-runtime-navigation-open');
    await waitForRegisteredNode(connection, sessionId, adminTestIds.node('terminal.admin:navigation:menu'));
    try {
      await tapTestID(
        connection,
        sessionId,
        adminTestIds.node('terminal.admin:navigation:option:admin.console.runtime'),
        'admin-runtime-navigation-select',
      );
    } catch (error) {
      const optionPressed =
        error instanceof Error &&
        error.message.includes('TERMINAL_AUTOMATION_ANDROID_INTERACTION_TIMEOUT_observed=press-in_');
      if (!optionPressed) throw error;
      process.stdout.write(
        'TERMINAL_AUTOMATION_F4_ANDROID_RUNTIME_OPTION_PRESS_IN observed; awaiting selected Runtime page\n',
      );
      await waitForRegisteredNode(connection, sessionId, adminTestIds.runtime.automation.enabled);
    }
  } else {
    throw new Error(`TERMINAL_AUTOMATION_F4_ANDROID_SHAPE_UNSUPPORTED_${shape}`);
  }
  await waitForRegisteredNode(connection, sessionId, adminTestIds.runtime.automation.enabled);
  const allNodes = responseResult(await connection.driver.request(sessionId, 'controls.query', {filter: {}}));
  if (!isRecord(allNodes) || !Array.isArray(allNodes.nodes))
    throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_CONTROLS_QUERY_INVALID');
  return allNodes.nodes;
};

describe('F-4b Android release Runtime and control-query performance', () => {
  let adb: Client | undefined;
  let connection: AndroidAutomationConnection | undefined;
  let packageId: string | undefined;
  let installAttempted = false;
  let apkPath: string | undefined;
  let bundleAttribution: Awaited<ReturnType<typeof measureAutomationBundleAttribution>> | undefined;
  let packagerBundleCapture: PackagerBundleCapture | undefined;
  let observedMeasurements: Measurement[] = [];
  let unsubscribeMessages: (() => void) | undefined;
  const runDirectory = runId ? path.join(root, '.runtime/terminal-automation', runId) : undefined;

  beforeAll(async () => {
    if (!runId || !serial || !packageIdFromManifest || !runDirectory || (shape !== 'mobile' && shape !== 'dual')) {
      throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_RUN_IDENTITY_REQUIRED');
    }
    const identity = androidAutomationBuildIdentity(runId);
    if (identity.packageId !== packageIdFromManifest)
      throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_PACKAGE_IDENTITY_MISMATCH');
    packageId = identity.packageId;
    adb = createAndroidAdbClient({adbPath, timeoutMs: 10_000});
    connection = await createAndroidAutomationConnection({
      client: adb,
      serial,
      repositoryRoot: root,
      adbPath,
      shape,
      token,
    });
    if (await connection.isInstalled(packageId))
      throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_PACKAGE_ALREADY_INSTALLED');
    apkPath = await buildReleaseApk(runDirectory, identity.applicationIdSuffix);
    packagerBundleCapture = await captureReleasePackagerBundle(runDirectory);
    bundleAttribution = await measureAutomationBundleAttribution(
      readFileSync(packagerBundleCapture.bundlePath, 'utf8'),
      JSON.parse(readFileSync(packagerBundleCapture.sourceMapPath, 'utf8')),
    );
    process.stdout.write(
      `TERMINAL_AUTOMATION_F4_ANDROID_BUNDLE ${JSON.stringify({
        attribution: bundleAttribution,
        inputSha256: packagerBundleCapture.inputSha256,
        sourceMapSha256: packagerBundleCapture.sourceMapSha256,
        gradlePackagerMapSha256: packagerBundleCapture.gradlePackagerMapSha256,
        versions: packagerBundleCapture.versions,
      })}\n`,
    );
    installAttempted = true;
    await connection.install(apkPath);
    if (!(await connection.isInstalled(packageId)))
      throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_INSTALL_READBACK_FAILED');
    await connection.launch(`${packageId}/${applicationId}.MainActivity`);
    await waitForAutomationSession(connection.driver, session => session.appName === 'sample-console', 45_000);
  }, 900_000);

  afterAll(async () => {
    const errors: string[] = [];
    if (connection !== undefined && packageId !== undefined) {
      try {
        if (installAttempted || (await connection.isInstalled(packageId))) {
          await connection.forceStop(packageId);
          await connection.uninstall(packageId);
        }
        if (await connection.isInstalled(packageId)) errors.push('ANDROID_RELEASE_PACKAGE_REMAINS');
      } catch {
        errors.push('ANDROID_RELEASE_PACKAGE_CLEANUP_FAILED');
      }
    }
    try {
      unsubscribeMessages?.();
    } catch {
      errors.push('ANDROID_EVENT_SUBSCRIPTION_CLEANUP_FAILED');
    }
    try {
      await connection?.close();
    } catch {
      errors.push('ANDROID_CONNECTION_CLEANUP_FAILED');
    }
    if (errors.length > 0) throw new Error(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:${errors.join('_')}`);
    process.stdout.write('TERMINAL_AUTOMATION_DEVICE_CLEANUP_COMPLETE\n');
  });

  it(
    'measures 100 control queries and 1000 state bursts with all 128 selectors active',
    async () => {
      if (connection === undefined || runId === undefined || shape === undefined || runDirectory === undefined) {
        throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_FIXTURE_NOT_READY');
      }
      const session = connection.driver.getSession();
      if (session === null) throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_SESSION_MISSING');
      const runtimeNodes = await enterAdminRuntimePage(connection, session.sessionId, shape);
      const displayScopes = new Set(
        runtimeNodes
          .filter(isRecord)
          .map(node =>
            isRecord(node.surface) ? `${node.surface.surface}:${node.surface.displayIndex ?? 'host'}` : 'invalid',
          ),
      );
      if (shape === 'dual' && ![...displayScopes].some(scope => scope.startsWith('SECONDARY:'))) {
        throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_SECONDARY_SURFACE_MISSING');
      }
      process.stdout.write(
        `TERMINAL_AUTOMATION_F4_ANDROID_PRODUCTION_PAGE nodes=${runtimeNodes.length} scopes=${[...displayScopes].join(',')} shape=${shape}\n`,
      );

      const measurements: Measurement[] = [];
      unsubscribeMessages = connection.driver.onMessage(session.sessionId, message => {
        const body = eventBody(message);
        if (
          body?.kind === 'performance.measurement' &&
          typeof body.phase === 'string' &&
          typeof body.elapsedMs === 'number' &&
          typeof body.payloadBytes === 'number' &&
          typeof body.activeSubscriptions === 'number'
        ) {
          measurements.push(
            Object.freeze({
              phase: body.phase,
              elapsedMs: body.elapsedMs,
              payloadBytes: body.payloadBytes,
              activeSubscriptions: body.activeSubscriptions,
            }),
          );
        }
      });

      for (let index = 0; index < 100; index += 1) {
        const reply = await connection.driver.request(session.sessionId, 'controls.query', {filter: {}});
        const result = responseResult(reply);
        if (!isRecord(result) || !Array.isArray(result.nodes) || result.nodes.length !== runtimeNodes.length) {
          throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_CONTROL_QUERY_READBACK_MISMATCH');
        }
      }
      await new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + 5_000;
        const check = (): void => {
          const count = measurements.filter(item => item.phase === 'controls.query').length;
          if (count === 100) resolve();
          else if (Date.now() >= deadline)
            reject(new Error('TERMINAL_AUTOMATION_F4_ANDROID_CONTROL_QUERY_MEASUREMENT_COUNT_INVALID'));
          else setTimeout(check, 10);
        };
        check();
      });
      const queryMeasurements = measurements.filter(item => item.phase === 'controls.query');
      const queryTimes = queryMeasurements.map(item => item.elapsedMs);
      const queryP95 = percentile95(queryTimes);
      const queryMax = Math.max(...queryTimes);
      const queryMaxSample = queryMeasurements.reduce<Measurement | undefined>(
        (max, item) => max === undefined || item.elapsedMs > max.elapsedMs ? item : max,
        undefined,
      );

      const finalViewSubscriptionId = `f4-final-view-${randomUUID()}`;
      const runtimeModeIds = Array.from({length: 127}, () => `f4-mode-${randomUUID()}`);
      const expectedSubscriptions = new Set([finalViewSubscriptionId, ...runtimeModeIds]);
      const initialSubscriptions = new Set<string>();
      let completedBurstCount = 0;
      const selectorInitialDiagnostics = {
        eventMessages: 0,
        eventBodies: 0,
        subscriptionIds: 0,
        expectedIds: 0,
        jsonValues: 0,
        nonJsonValues: 0,
        arrayValues: 0,
        scalarValues: 0,
      };
      const lastRequestId = randomUUID();
      let finalSelectorPushAt: number | undefined;
      let finalView: Record<string, unknown> | undefined;
      const ledgerSnapshots: {burstCount: number; count: number; envelopeBytes: number; elapsedMs: number; payloadBytes: number}[] = [];
      let ledgerReadLimitCode: string | undefined;
      let ledgerReadLimitAtBurst: number | undefined;
      const onSelectorMessage = connection.driver.onMessage(session.sessionId, message => {
        if (message.type !== 'event') return;
        selectorInitialDiagnostics.eventMessages += 1;
        const body = eventBody(message);
        if (body === undefined) return;
        selectorInitialDiagnostics.eventBodies += 1;
        if (typeof body.subscriptionId !== 'string') return;
        selectorInitialDiagnostics.subscriptionIds += 1;
        if (!expectedSubscriptions.has(body.subscriptionId)) return;
        selectorInitialDiagnostics.expectedIds += 1;
        initialSubscriptions.add(body.subscriptionId);
        if (body.subscriptionId === finalViewSubscriptionId && body.valueState === 'JSON' &&
            isRecord(body.value) && body.value.requestId === lastRequestId && body.value.status === 'completed') {
          finalView = body.value;
          finalSelectorPushAt = performance.now();
        }
        if (body.valueState !== 'JSON') {
          selectorInitialDiagnostics.nonJsonValues += 1;
          return;
        }
        selectorInitialDiagnostics.jsonValues += 1;
        if (Array.isArray(body.value)) selectorInitialDiagnostics.arrayValues += 1;
        else selectorInitialDiagnostics.scalarValues += 1;
      });
      for (const subscriptionId of [finalViewSubscriptionId, ...runtimeModeIds]) {
        const selectorName = subscriptionId === finalViewSubscriptionId
          ? 'kernel.base.runtime.selectRequestExecutionView'
          : 'kernel.base.runtime.selectRuntimeInstanceMode';
        const argsTuple = subscriptionId === finalViewSubscriptionId ? [lastRequestId] : [];
        const subscriptionResult = responseResult(
          await connection.driver.request(session.sessionId, 'selector.subscribe', {
            subscriptionId,
            selectorName,
            argsTuple,
          }),
        );
        if (
          !isRecord(subscriptionResult) ||
          subscriptionResult.subscriptionId !== subscriptionId ||
          subscriptionResult.accepted !== true
        ) {
          throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_SELECTOR_SUBSCRIPTION_ACCEPTANCE_INVALID');
        }
      }
      await new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + 10_000;
        const check = (): void => {
          if (initialSubscriptions.size === 128) resolve();
          else if (Date.now() >= deadline)
            reject(
              new Error(
                `TERMINAL_AUTOMATION_F4_ANDROID_SELECTOR_INITIAL_COUNT_INVALID received=${initialSubscriptions.size} ` +
                  `events=${selectorInitialDiagnostics.eventMessages} bodies=${selectorInitialDiagnostics.eventBodies} ` +
                  `subscriptionIds=${selectorInitialDiagnostics.subscriptionIds} expectedIds=${selectorInitialDiagnostics.expectedIds} ` +
                  `json=${selectorInitialDiagnostics.jsonValues} nonJson=${selectorInitialDiagnostics.nonJsonValues} ` +
                  `arrays=${selectorInitialDiagnostics.arrayValues} scalars=${selectorInitialDiagnostics.scalarValues}`,
              ),
            );
          else setTimeout(check, 10);
        };
        check();
      });
      const readLedgerSnapshot = async (): Promise<void> => {
        if (ledgerReadLimitCode !== undefined) return;
        const previousMeasurements = measurements.filter(item => item.phase === 'selector.read').length;
        const reply = await connection!.driver.request(session.sessionId, 'selector.read', {
          selectorName: 'kernel.base.runtime.selectRequestExecutionViews',
          argsTuple: ['MAIN'],
        });
        if (reply.type !== 'response' || !isRecord(reply.body) || !('result' in reply.body)) {
          const code = isRecord(reply.body) && typeof reply.body.code === 'string' ? reply.body.code : 'MISSING';
          if (code !== 'SELECTOR_EVALUATION_BUDGET_EXCEEDED' &&
              code !== 'SELECTOR_SERIALIZATION_BUDGET_EXCEEDED' && code !== 'RESOURCE_LIMIT') {
            throw new Error(`TERMINAL_AUTOMATION_F4_ANDROID_LEDGER_READ_REJECTED type=${reply.type} code=${code}`);
          }
          ledgerReadLimitCode = code;
          ledgerReadLimitAtBurst = completedBurstCount;
          return;
        }
        const result = reply.body.result;
        if (!isRecord(result) || result.valueState !== 'JSON' || !Array.isArray(result.value)) {
          throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_LEDGER_READ_INVALID');
        }
        await new Promise<void>((resolve, reject) => {
          const deadline = Date.now() + 5_000;
          const check = (): void => {
            if (measurements.filter(item => item.phase === 'selector.read').length > previousMeasurements) resolve();
            else if (Date.now() >= deadline)
              reject(new Error('TERMINAL_AUTOMATION_F4_ANDROID_LEDGER_READ_MEASUREMENT_MISSING'));
            else setTimeout(check, 10);
          };
          check();
        });
        const measurement = measurements.filter(item => item.phase === 'selector.read').at(-1);
        if (measurement === undefined) throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_LEDGER_READ_MEASUREMENT_MISSING');
        ledgerSnapshots.push({
          burstCount: completedBurstCount,
          count: result.value.length,
          envelopeBytes: Buffer.byteLength(JSON.stringify(result)),
          elapsedMs: measurement.elapsedMs,
          payloadBytes: measurement.payloadBytes,
        });
      };
      await readLedgerSnapshot();

      for (let batchStart = 0; batchStart < 1000; batchStart += 20) {
        const waitsAndRequests = Array.from({length: Math.min(20, 1000 - batchStart)}, async (_unused, offset) => {
          const requestId = batchStart + offset === 999 ? lastRequestId : randomUUID();
          const resultWait = waitForMessage(
            connection as AndroidAutomationConnection,
            session.sessionId,
            message => eventBody(message)?.kind === 'command.result' && eventBody(message)?.requestId === requestId,
            20_000,
          );
          const accepted = responseResult(
            await (connection as AndroidAutomationConnection).driver.request(
              session.sessionId,
              'command.dispatch',
              {requestId, commandName: 'kernel.base.runtime.hello-world', payload: null},
              10_000,
            ),
          );
          if (!isRecord(accepted) || accepted.requestId !== requestId) {
            throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_COMMAND_ACCEPTANCE_MISMATCH');
          }
          const completion = eventBody(await resultWait);
          if (!isRecord(completion?.result) || completion.result.status !== 'completed') {
            throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_COMMAND_COMPLETION_INVALID');
          }
          completedBurstCount += 1;
        });
        await Promise.all(waitsAndRequests);
        if (completedBurstCount % 100 === 0) await readLedgerSnapshot();
      }
      const firstLedgerSnapshot = ledgerSnapshots[0];
      if (firstLedgerSnapshot === undefined || firstLedgerSnapshot.burstCount !== 0) {
        throw new Error(
          `TERMINAL_AUTOMATION_F4_ANDROID_LEDGER_SNAPSHOT_BASELINE_INVALID ` +
            `snapshots=${ledgerSnapshots.length} firstBurst=${firstLedgerSnapshot?.burstCount ?? 'missing'} ` +
            `firstCount=${firstLedgerSnapshot?.count ?? 'missing'} limitCode=${ledgerReadLimitCode ?? 'none'}`,
        );
      }
      const finalDispatchCompleted = performance.now();
      const finalPushDeadline = finalDispatchCompleted + 500;
      while (finalSelectorPushAt === undefined && performance.now() <= finalPushDeadline) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      const finalPushAt = finalSelectorPushAt;
      if (finalView === undefined || finalPushAt === undefined) {
        const finalReadResult = responseResult(
          await connection.driver.request(session.sessionId, 'selector.read', {
            selectorName: 'kernel.base.runtime.selectRequestExecutionView',
            argsTuple: [lastRequestId],
          }),
        );
        const finalReadValue = isRecord(finalReadResult) ? finalReadResult.value : undefined;
        const finalReadView = isRecord(finalReadValue) ? finalReadValue : undefined;
        const finalReadReason = isRecord(finalReadResult) && typeof finalReadResult.reason === 'string'
          ? finalReadResult.reason
          : 'none';
        throw new Error(
          `TERMINAL_AUTOMATION_F4_ANDROID_FINAL_SELECTOR_VALUE_NOT_PUSHED ` +
            `completedCommands=${completedBurstCount} ` +
            `finalReadState=${typeof finalReadResult === 'object' && finalReadResult !== null && 'valueState' in finalReadResult ? String(finalReadResult.valueState) : 'invalid'} ` +
            `finalReadReason=${finalReadReason} ` +
            `finalReadStatus=${typeof finalReadView?.status === 'string' ? finalReadView.status : 'missing'} ` +
            `finalReadCommands=${Array.isArray(finalReadView?.commands) ? finalReadView.commands.length : 'missing'}`,
        );
      }
      const finalValueLatencyMs = Math.max(0, finalPushAt - finalDispatchCompleted);
      if (finalValueLatencyMs > 500) throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_FINAL_SELECTOR_VALUE_LATE');

      const stateMeasurements = measurements.filter(item => item.phase === 'selector.flush');
      const flushTimes = stateMeasurements.map(item => item.elapsedMs);
      if (stateMeasurements.length === 0 || stateMeasurements.some(item =>
        item.activeSubscriptions < 127 || item.activeSubscriptions > 128)) {
        throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_STATE_FLUSH_MEASUREMENT_INVALID');
      }
      const flushP95 = percentile95(flushTimes);
      const flushMax = Math.max(...flushTimes);
      const flushMaxSample = stateMeasurements.reduce<Measurement | undefined>(
        (max, item) => max === undefined || item.elapsedMs > max.elapsedMs ? item : max,
        undefined,
      );
      if (queryP95 > 16 || queryMax > 50 || flushP95 > 16 || flushMax > 50) {
        throw new Error(
          `TERMINAL_AUTOMATION_F4_ANDROID_SYNCHRONOUS_BUDGET_EXCEEDED ` +
            `querySamples=${queryTimes.length} queryP95Ms=${queryP95} queryMaxMs=${queryMax} ` +
            `queryMaxPayloadBytes=${queryMaxSample?.payloadBytes ?? 'missing'} ` +
            `flushSamples=${flushTimes.length} flushP95Ms=${flushP95} flushMaxMs=${flushMax} ` +
            `flushMaxPayloadBytes=${flushMaxSample?.payloadBytes ?? 'missing'} ` +
            `flushMaxActiveSubscriptions=${flushMaxSample?.activeSubscriptions ?? 'missing'} ` +
            `flushMinActiveSubscriptions=${Math.min(...stateMeasurements.map(item => item.activeSubscriptions))}`,
        );
      }
      const subscriptionCleanup = await Promise.all(
        [...expectedSubscriptions].map(subscriptionId =>
          connection!.driver.request(session.sessionId, 'selector.unsubscribe', {subscriptionId}),
        ),
      );
      for (const reply of subscriptionCleanup) {
        const result = responseResult(reply);
        if (!isRecord(result) || result.released !== true)
          throw new Error('TERMINAL_AUTOMATION_F4_ANDROID_SUBSCRIPTION_CLEANUP_INVALID');
      }
      onSelectorMessage();

      const report = Object.freeze({
        shape,
        page: 'admin.runtime',
        controlNodes: runtimeNodes.length,
        query: Object.freeze({
          samples: queryTimes.length,
          p95Ms: queryP95,
          maxMs: queryMax,
          maxPayloadBytes: Math.max(...queryMeasurements.map(item => item.payloadBytes)),
        }),
        stateFlush: Object.freeze({
          samples: flushTimes.length,
          p95Ms: flushP95,
          maxMs: flushMax,
          maxSubscriptions: Math.max(...stateMeasurements.map(item => item.activeSubscriptions)),
          minSubscriptions: Math.min(...stateMeasurements.map(item => item.activeSubscriptions)),
          maxPayloadBytes: Math.max(...stateMeasurements.map(item => item.payloadBytes)),
        }),
        stateBurstCount: 1000,
        lastValueLatencyMs: finalValueLatencyMs,
        finalRequestId: lastRequestId,
        ledger: Object.freeze({
          snapshots: ledgerSnapshots,
          serializationLimitCode: ledgerReadLimitCode ?? null,
          serializationLimitAtBurst: ledgerReadLimitAtBurst ?? null,
        }),
        subscriptionsAfterCleanup: 0,
        releaseApkBytes: statSync(apkPath as string).size,
        bundleAttribution,
        packagerBundle: packagerBundleCapture === undefined ? null : {
          inputSha256: packagerBundleCapture.inputSha256,
          sourceMapSha256: packagerBundleCapture.sourceMapSha256,
          gradlePackagerMapSha256: packagerBundleCapture.gradlePackagerMapSha256,
          versions: packagerBundleCapture.versions,
        },
      });
      const outputDirectory = path.join(root, '.runtime/terminal-automation', runId);
      mkdirSync(outputDirectory, {recursive: true, mode: 0o700});
      writeFileSync(
        path.join(outputDirectory, `f4b-${shape}-performance.json`),
        `${JSON.stringify(report, null, 2)}\n`,
        {mode: 0o600},
      );
      process.stdout.write(`TERMINAL_AUTOMATION_F4B_PASS ${JSON.stringify(report)}\n`);
    },
    5 * 60_000,
  );
});
