import {createHash, randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {
  request as createHttpRequest,
  createServer as createHttpServer,
  type IncomingHttpHeaders,
  type Server as HttpServer,
} from 'node:http';
import {createServer as createNetServer, type Server as NetServer} from 'node:net';
import {copyFileSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, expect, it} from 'vitest';
import type {Client} from '@devicefarmer/adbkit';
import type {TerminalUpdateArtifact} from '@catering-v2s/kernel-base-platform-ports';
import {
  androidAutomationBuildIdentity,
  createAndroidAdbClient,
  createAndroidAutomationConnection,
  createAndroidJourneyUiPort,
  readSelector,
  waitForSelector,
  readApplicationDeviceId,
  ensureMainSampleActivated,
  waitForAutomationSession,
  type AndroidAutomationConnection,
} from '../src/index.ts';
import {createManagedActivationFixtureApi} from '../fixtures/managedActivation.ts';
import {mainSampleTestIds} from '../src/mainSampleTestIds.ts';
import {terminalUpdateSampleConfig} from '../src/updateSample.ts';
import {mainSampleSurfaceForm, parseMainSampleShape} from '../src/mainSampleJourneyConfig.ts';
import {prepareAndroidJourneySurface} from '../src/journeySurface.ts';
import {loginSampleStaff} from './sampleStaffLogin.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const runId = process.env.TERMINAL_AUTOMATION_RUN_ID;
const runDirectory = runId ? path.join(root, '.runtime/terminal-automation', runId) : undefined;
const selectedSample = process.env.TERMINAL_AUTOMATION_SAMPLE ?? 'console';
const sample = terminalUpdateSampleConfig(selectedSample);
const appName = selectedSample === 'console' ? 'sample-terminal' : 'sample-wallpaper-terminal';
const updateCase = process.env.TERMINAL_AUTOMATION_CASE;
const adbPath = process.env.ADB_PATH || 'adb';
const installerPackagePrefixes = ['com.android.packageinstaller', 'com.google.android.packageinstaller'] as const;
const settingsPackagePrefixes = ['com.android.settings'] as const;
const installSourcePackagePrefixes = [...installerPackagePrefixes, ...settingsPackagePrefixes] as const;
const sessionToken = `ter-update-${randomUUID()}`;
type ArtifactManifest = TerminalUpdateArtifact &
  Readonly<{
    readonly apk?: Readonly<{readonly path: string; readonly sha256: string}>;
  }>;
type UpdateTarget = Readonly<{
  readonly ruleRef: string;
  readonly createdAt: number;
  readonly applicationId: string;
  readonly full: Readonly<{
    readonly sourceRef: string;
    readonly expectedSha256: string;
    readonly artifact: ArtifactManifest;
  }> | null;
  readonly hot: Readonly<{
    readonly sourceRef: string;
    readonly expectedSha256: string;
    readonly artifact: ArtifactManifest;
  }>;
  readonly strategy: Readonly<{readonly maxNetworkAttempts: number; readonly bootTimeoutMs: number}>;
  readonly selectionContext: Readonly<{readonly selectedSpace: 'development'; readonly contextIdentity: string}>;
}>;

const sha256 = (value: Buffer): string => createHash('sha256').update(value).digest('hex');
const readArtifact = (file: string): ArtifactManifest => {
  if (!runDirectory) throw new Error('TERMINAL_AUTOMATION_RUN_ID_REQUIRED');
  return JSON.parse(readFileSync(path.join(runDirectory, 'update', appName, file), 'utf8')) as ArtifactManifest;
};
const writeArtifact = (file: string, artifact: ArtifactManifest): void => {
  if (!runDirectory) throw new Error('TERMINAL_AUTOMATION_RUN_ID_REQUIRED');
  writeFileSync(path.join(runDirectory, 'update', appName, file), `${JSON.stringify(artifact, null, 2)}\n`, {
    mode: 0o600,
  });
};

const proxyHeaders = (headers: IncomingHttpHeaders): Record<string, string | string[]> => {
  const blocked = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'host',
  ]);
  return Object.fromEntries(
    Object.entries(headers).filter(
      (entry): entry is [string, string | string[]] =>
        !blocked.has(entry[0].toLowerCase()) && (typeof entry[1] === 'string' || Array.isArray(entry[1])),
    ),
  );
};

const forwardManagedBusinessRequest = (
  request: import('node:http').IncomingMessage,
  response: import('node:http').ServerResponse,
  runId: string,
): void => {
  const base = process.env.V2S_TERMINAL_DEV_HTTP_BASE_URL;
  if (!base || !request.url?.startsWith('/api/')) {
    response.writeHead(502);
    response.end();
    return;
  }
  let target: URL;
  try {
    target = new URL(request.url, base);
  } catch {
    response.writeHead(502);
    response.end();
    process.stdout.write(`TERMINAL_AUTOMATION_BUSINESS_PROXY_FAILED run=${runId} code=UPSTREAM_URL_INVALID\n`);
    return;
  }
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.username || target.password) {
    response.writeHead(502);
    response.end();
    process.stdout.write(`TERMINAL_AUTOMATION_BUSINESS_PROXY_FAILED run=${runId} code=UPSTREAM_ORIGIN_INVALID\n`);
    return;
  }
  const upstream = createHttpRequest(
    target,
    {method: request.method, headers: proxyHeaders(request.headers)},
    result => {
      response.writeHead(result.statusCode ?? 502, proxyHeaders(result.headers));
      result.pipe(response);
      process.stdout.write(
        `TERMINAL_AUTOMATION_BUSINESS_PROXY_RESPONSE run=${runId} method=${request.method ?? 'UNKNOWN'} status=${result.statusCode ?? 502}\n`,
      );
    },
  );
  upstream.setTimeout(15_000, () => upstream.destroy(new Error('UPSTREAM_TIMEOUT')));
  upstream.once('error', error => {
    const code =
      error instanceof Error && error.message === 'UPSTREAM_TIMEOUT' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_REQUEST_FAILED';
    process.stdout.write(`TERMINAL_AUTOMATION_BUSINESS_PROXY_FAILED run=${runId} code=${code}\n`);
    if (!response.headersSent) response.writeHead(502);
    response.end();
  });
  request.pipe(upstream);
};
const listen = async <T extends HttpServer | NetServer>(server: T): Promise<number> =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const address = server.address();
      if (address === null || typeof address === 'string')
        reject(new Error('TERMINAL_AUTOMATION_UPDATE_PORT_UNAVAILABLE'));
      else resolve(address.port);
    });
  });
const closeServer = async (server: HttpServer | NetServer | undefined): Promise<void> => {
  if (!server?.listening) return;
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
};

let adb: Client | undefined;
let connection: AndroidAutomationConnection | undefined;
let packageId: string | undefined;
let packageWasAbsent = false;
let installAttempted = false;
let httpServer: HttpServer | undefined;
let tdsOneSink: NetServer | undefined;
let tdsTwoSink: NetServer | undefined;
let targetDocument: Readonly<{target: UpdateTarget; sourcePaths: Readonly<Record<string, string>>}> | undefined;
let hotSourceRequested: Promise<void> | undefined;
let signalHotSourceRequested: (() => void) | undefined;
let hotSourceResponseGate: Promise<void> | undefined;
let releaseHotSourceResponse: (() => void) | undefined;
let initialSessionId: string | null = null;
let initialDeviceId: string | null = null;
let compatibilityTargetDocument:
  Readonly<{target: UpdateTarget; sourcePaths: Readonly<Record<string, string>>}> | undefined;
const updatePayloadPaths = new Map<
  ArtifactManifest,
  Readonly<{readonly kind: 'full' | 'hot'; readonly path: string}>
>();

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
    throw new Error('TERMINAL_AUTOMATION_UPDATE_RESPONSE_INVALID');
  return response.body.result;
};
const writeUpdateStateDiagnostics = async (
  driver: AndroidAutomationConnection['driver'],
  sessionId: string,
  runId: string,
): Promise<void> => {
  try {
    const [task, status] = await Promise.all([
      readSelector(driver, sessionId, 'kernel.base.terminal-update.selectTerminalUpdateTask', []),
      readSelector(driver, sessionId, 'kernel.base.terminal-update.selectTerminalUpdateRecentStatus', []),
    ]);
    const taskRecord = isRecord(task) ? task : {};
    const statusRecord = isRecord(status) ? status : {};
    const token = (value: unknown): string =>
      typeof value === 'string' && /^[a-z0-9_-]{1,80}$/iu.test(value)
        ? value.toUpperCase()
        : value === null
          ? 'NONE'
          : 'UNKNOWN';
    process.stdout.write(
      [
        `TERMINAL_AUTOMATION_UPDATE_STATE run=${runId}`,
        `phase=${token(taskRecord.phase)}`,
        `failure=${token(taskRecord.failureCode)}`,
        `status=${token(statusRecord.state)}`,
        `reason=${token(statusRecord.reason)}`,
      ].join(' ') + '\n',
    );
  } catch (error) {
    const code =
      error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+$/u.test(error.message)
        ? error.message
        : 'TERMINAL_AUTOMATION_UPDATE_STATE_READ_FAILED';
    process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_STATE_NOT_AVAILABLE run=${runId} code=${code}\n`);
  }
};
const writeNativeUpdateDiagnostics = async (
  input: Readonly<{
    readonly connection: AndroidAutomationConnection;
    readonly packageId: string;
    readonly runId: string;
  }>,
): Promise<Readonly<{readonly installerSucceeded: boolean; readonly changedApkBooted: boolean}>> => {
  try {
    const diagnostics = await input.connection.readTerminalUpdateLogs(input.packageId);
    process.stdout.write(
      diagnostics.length === 0
        ? `TERMINAL_AUTOMATION_UPDATE_NATIVE_LOG_NOT_AVAILABLE run=${input.runId}\n`
        : diagnostics
            .split('\n')
            .map(line => `TERMINAL_AUTOMATION_UPDATE_NATIVE_LOG run=${input.runId} ${line}`)
            .join('\n') + '\n',
    );
    return Object.freeze({
      installerSucceeded: /event=installer-callback status=0(?:\s|$)/u.test(diagnostics),
      changedApkBooted: /event=boot-reserved entryKind=embedded apkChanged=true(?:\s|$)/u.test(diagnostics),
    });
  } catch {
    process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_NATIVE_LOG_NOT_AVAILABLE run=${input.runId}\n`);
    return Object.freeze({installerSucceeded: false, changedApkBooted: false});
  }
};

const writeAndroidFailureDiagnostics = async (
  input: Readonly<{
    readonly connection: AndroidAutomationConnection;
    readonly packageId: string;
    readonly runId: string;
    readonly boundary: 'full-session' | 'hot-session';
  }>,
): Promise<void> => {
  const diagnostics = input.connection.driver.getDiagnostics();
  process.stdout.write(
    [
      `TERMINAL_AUTOMATION_ANDROID_DRIVER_STATE run=${input.runId}`,
      `boundary=${input.boundary}`,
      `socketConnections=${diagnostics.socketConnections}`,
      `authenticatedSessions=${diagnostics.authenticatedSessions}`,
      `authenticationTimeouts=${diagnostics.authenticationTimeouts}`,
      `rejectedMessages=${diagnostics.rejectedMessages}`,
      `activeSockets=${diagnostics.activeSockets}`,
      `activeSessions=${diagnostics.activeSessions}`,
    ].join(' ') + '\n',
  );
  try {
    process.stdout.write(
      `TERMINAL_AUTOMATION_ANDROID_SCREEN run=${input.runId} boundary=${input.boundary} ` +
        `summary=${await input.connection.systemUi.readScreenSummary()}\n`,
    );
  } catch (error) {
    const code =
      error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+(?:_[A-Z0-9]+)*$/u.test(error.message)
        ? error.message
        : 'TERMINAL_AUTOMATION_ANDROID_SCREEN_SUMMARY_UNAVAILABLE';
    process.stdout.write(`TERMINAL_AUTOMATION_ANDROID_SCREEN_NOT_AVAILABLE run=${input.runId} code=${code}\n`);
  }
  try {
    const runtimeDiagnostics = await input.connection.readRuntimeFailureDiagnostics(input.packageId);
    if (runtimeDiagnostics.length === 0) {
      process.stdout.write(
        `TERMINAL_AUTOMATION_ANDROID_RUNTIME_DIAGNOSTICS_EMPTY run=${input.runId} boundary=${input.boundary}\n`,
      );
    } else {
      for (const line of runtimeDiagnostics.split('\n')) {
        process.stdout.write(
          `TERMINAL_AUTOMATION_ANDROID_RUNTIME_DIAGNOSTIC run=${input.runId} boundary=${input.boundary} fact=${line}\n`,
        );
      }
    }
  } catch (error) {
    const code =
      error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+(?:_[A-Z0-9]+)*$/u.test(error.message)
        ? error.message
        : 'TERMINAL_AUTOMATION_ANDROID_RUNTIME_DIAGNOSTICS_UNAVAILABLE';
    process.stdout.write(
      `TERMINAL_AUTOMATION_ANDROID_RUNTIME_DIAGNOSTICS_NOT_AVAILABLE run=${input.runId} code=${code}\n`,
    );
  }
  if (runDirectory) {
    const screenshotPath = path.join(runDirectory, `${input.boundary}-failure.png`);
    try {
      writeFileSync(screenshotPath, await input.connection.capture('primary'), {mode: 0o600});
      process.stdout.write(
        `TERMINAL_AUTOMATION_ANDROID_FAILURE_SCREEN run=${input.runId} boundary=${input.boundary} path=${screenshotPath}\n`,
      );
    } catch {
      process.stdout.write(
        `TERMINAL_AUTOMATION_ANDROID_FAILURE_SCREEN_NOT_AVAILABLE run=${input.runId} boundary=${input.boundary}\n`,
      );
    }
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const waitForCommandResult = (
  driver: AndroidAutomationConnection['driver'],
  sessionId: string,
  requestId: string,
  timeoutMs: number,
): Readonly<{promise: Promise<Record<string, unknown>>; cancel: () => void}> => {
  let unsubscribe = (): void => undefined;
  let timer: NodeJS.Timeout | undefined;
  let settled = false;
  let resolveResult: (value: Record<string, unknown>) => void = () => undefined;
  let rejectResult: (reason: Error) => void = () => undefined;
  const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const finish = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    unsubscribe();
  };
  unsubscribe = driver.onMessage(sessionId, message => {
    if (
      message.type !== 'event' ||
      !isRecord(message.body) ||
      message.body.kind !== 'command.result' ||
      message.body.requestId !== requestId ||
      settled
    )
      return;
    settled = true;
    finish();
    resolveResult(message.body);
  });
  timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    finish();
    rejectResult(new Error('TERMINAL_AUTOMATION_UPDATE_COMMAND_RESULT_TIMEOUT'));
  }, timeoutMs);
  return Object.freeze({
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      finish();
      rejectResult(new Error('TERMINAL_AUTOMATION_UPDATE_COMMAND_RESULT_CANCELLED'));
    },
  });
};

const waitForWallpaperAssets = async (
  driver: AndroidAutomationConnection['driver'],
  sessionId: string,
  stage: 'full' | 'hot',
): Promise<void> => {
  const subscriptionId = `wallpaper-assets-${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  let subscribed = false;
  let unsubscribeMessages = (): void => undefined;
  let timer: NodeJS.Timeout | undefined;
  let resolveLoaded: () => void = () => undefined;
  let rejectLoaded: (error: Error) => void = () => undefined;
  const loaded = new Promise<void>((resolve, reject) => {
    resolveLoaded = resolve;
    rejectLoaded = reject;
  });
  const statusSummary = (nodes: unknown): string => {
    if (!Array.isArray(nodes)) return 'nodes=invalid';
    const matching = nodes.filter(node => isRecord(node) && node.testID === mainSampleTestIds.wallpaperAssetLoadStatus);
    const values = matching.map(node =>
      isRecord(node) && typeof node.value === 'string'
        ? (node.value.match(/^loaded=\d+\/\d+;failed=\d+;failedIds=(?:none|[A-Za-z0-9._,-]*)$/u)?.[0] ??
          'value=invalid')
        : 'value=missing',
    );
    return `nodes=${nodes.length} statusNodes=${matching.length} status=${values.join('|') || 'missing'}`;
  };
  const isLoaded = (nodes: unknown): boolean =>
    Array.isArray(nodes) &&
    nodes.some(
      node =>
        isRecord(node) &&
        node.testID === mainSampleTestIds.wallpaperAssetLoadStatus &&
        typeof node.value === 'string' &&
        /^loaded=(\d+)\/\1;failed=0;failedIds=none$/u.test(node.value) &&
        node.value !== 'loaded=0/0;failed=0;failedIds=none',
    );
  unsubscribeMessages = driver.onMessage(sessionId, message => {
    if (message.type !== 'event' || !isRecord(message.body) || message.body.subscriptionId !== subscriptionId) return;
    if (isLoaded(message.body.nodes)) resolveLoaded();
    else if (Array.isArray(message.body.nodes)) {
      const status = message.body.nodes.find(
        node =>
          isRecord(node) &&
          node.testID === mainSampleTestIds.wallpaperAssetLoadStatus &&
          typeof node.value === 'string' &&
          /failed=[1-9]/u.test(node.value),
      );
      if (isRecord(status) && typeof status.value === 'string') {
        process.stdout.write(
          `TERMINAL_AUTOMATION_WALLPAPER_ASSETS run=${runId} stage=${stage} state=failed ${status.value}\n`,
        );
        rejectLoaded(new Error(`TERMINAL_AUTOMATION_WALLPAPER_ASSET_LOAD_FAILED_${stage.toUpperCase()}`));
      }
    }
  });
  try {
    const result = responseResult(
      await driver.request(sessionId, 'controls.subscribe', {
        subscriptionId,
        // The probe is unique to this test host. Do not bind its observation to
        // a physical surface identity; application surface metadata may differ
        // from the screen currently shown after a FULL install.
        filter: {testID: mainSampleTestIds.wallpaperAssetLoadStatus},
      }),
    );
    subscribed = true;
    process.stdout.write(
      `TERMINAL_AUTOMATION_WALLPAPER_ASSETS run=${runId} stage=${stage} phase=subscribe ${statusSummary(isRecord(result) ? result.nodes : undefined)}\n`,
    );
    if (!isRecord(result) || !Array.isArray(result.nodes) || result.nodes.length === 0) {
      const registry = responseResult(await driver.request(sessionId, 'controls.query', {filter: {}}));
      const nodes = isRecord(registry) && Array.isArray(registry.nodes) ? registry.nodes : [];
      const related = nodes.filter(
        node =>
          isRecord(node) &&
          typeof node.testID === 'string' &&
          (node.testID.includes('wallpaper') || node.testID.includes('asset-load-status')),
      );
      const diagnostic = related.slice(0, 8).map(node => {
        if (!isRecord(node)) return 'invalid';
        const surface = isRecord(node.surface)
          ? `${String(node.surface.surface)}:${String(node.surface.displayIndex)}`
          : 'unknown';
        const value =
          typeof node.value === 'string' &&
          /^loaded=\d+\/\d+;failed=\d+;failedIds=(?:none|[A-Za-z0-9._,-]*)$/u.test(node.value)
            ? node.value
            : 'omitted';
        return `${String(node.testID)}@${surface}=${value}`;
      });
      process.stdout.write(
        `TERMINAL_AUTOMATION_WALLPAPER_ASSETS run=${runId} stage=${stage} phase=registry-diagnostic totalNodes=${nodes.length} ` +
          `target=${mainSampleTestIds.wallpaperAssetLoadStatus} targetCount=${nodes.filter(node => isRecord(node) && node.testID === mainSampleTestIds.wallpaperAssetLoadStatus).length} ` +
          `related=${diagnostic.join('|') || 'none'}\n`,
      );
    }
    if (isRecord(result) && isLoaded(result.nodes)) {
      process.stdout.write(`TERMINAL_AUTOMATION_WALLPAPER_ASSETS run=${runId} stage=${stage} state=loaded\n`);
      return;
    }
    timer = setTimeout(() => {
      process.stdout.write(
        `TERMINAL_AUTOMATION_WALLPAPER_ASSETS run=${runId} stage=${stage} phase=timeout ${statusSummary(isRecord(result) ? result.nodes : undefined)}\n`,
      );
      rejectLoaded(new Error(`TERMINAL_AUTOMATION_WALLPAPER_ASSET_LOAD_TIMEOUT_${stage.toUpperCase()}`));
    }, 20_000);
    await loaded;
    process.stdout.write(`TERMINAL_AUTOMATION_WALLPAPER_ASSETS run=${runId} stage=${stage} state=loaded\n`);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    unsubscribeMessages();
    if (subscribed) {
      const released = responseResult(await driver.request(sessionId, 'controls.unsubscribe', {subscriptionId}));
      if (!isRecord(released) || released.released !== true) {
        throw new Error(`TERMINAL_AUTOMATION_WALLPAPER_ASSET_SUBSCRIPTION_RELEASE_FAILED_${stage.toUpperCase()}`);
      }
    }
  }
};

const buildArtifact = (
  kind: 'install' | 'full' | 'hot',
  options?: Readonly<{nativeBuildNumber?: number; bundleVersion?: string; minimumFullManifest?: string}>,
): void => {
  if (!runId || !packageId || !httpServer) throw new Error('TERMINAL_AUTOMATION_UPDATE_BUILD_CONTEXT_MISSING');
  const shape = parseMainSampleShape(process.env.TERMINAL_AUTOMATION_SHAPE);
  const surfaceForm = mainSampleSurfaceForm(shape);
  const address = httpServer.address();
  if (!address || typeof address === 'string') throw new Error('TERMINAL_AUTOMATION_UPDATE_HTTP_ADDRESS_MISSING');
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    EXPO_PUBLIC_TER_AUTOMATION_BUILD: 'true',
    EXPO_PUBLIC_TER_AUTOMATION_URL: 'ws://127.0.0.1:19090/automation',
    EXPO_PUBLIC_TER_AUTOMATION_TOKEN: sessionToken,
    EXPO_PUBLIC_TER_AUTOMATION_RUN_ID: runId,
    EXPO_PUBLIC_TER_AUTOMATION_SURFACE_FORM: surfaceForm,
    EXPO_PUBLIC_TER_AUTOMATION_ANDROID_PACKAGE_ID: packageId,
    EXPO_PUBLIC_TER_AUTOMATION_UPDATE_TARGET_URL: `http://127.0.0.1:28080/update-target`,
    EXPO_PUBLIC_TER_AUTOMATION_UPDATE_REVISION: kind,
    EXPO_PUBLIC_TER_MANAGED_GROUP_WORKSPACE_BASE_URL: 'http://127.0.0.1:28080/api/terminal/group-workspaces/aurora',
    EXPO_PUBLIC_TER_MANAGED_TDS_ENTRY_ONE_WS_URL: 'ws://127.0.0.1:28180',
    EXPO_PUBLIC_TER_MANAGED_TDS_ENTRY_TWO_WS_URL: 'ws://127.0.0.1:28181',
  };
  delete environment.EXPO_PUBLIC_TER_AUTOMATION_UPDATE_ASSET_PROBE;
  if (selectedSample === 'wallpaper') environment.EXPO_PUBLIC_TER_AUTOMATION_UPDATE_ASSET_PROBE = 'true';
  delete environment.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD;
  delete environment.V2S_SEED_PLATFORM_ROOT_PASSWORD;
  delete environment.TERMINAL_AUTOMATION_FULL_NATIVE_BUILD_NUMBER;
  delete environment.TERMINAL_AUTOMATION_UPDATE_BUNDLE_VERSION;
  delete environment.EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION;
  delete environment.EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION_OWNER;
  if (kind === 'full' || kind === 'hot') environment.TERMINAL_AUTOMATION_FULL_NATIVE_BUILD_NUMBER = '2';
  if (kind === 'hot') {
    environment.TERMINAL_AUTOMATION_UPDATE_BUNDLE_VERSION = '1.0.1';
    if (updateCase === 'update.boot-guard') {
      environment.EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION = 'true';
      environment.EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION_OWNER = 'surface-content';
    }
  }
  if (options?.nativeBuildNumber !== undefined)
    environment.TERMINAL_AUTOMATION_FULL_NATIVE_BUILD_NUMBER = String(options.nativeBuildNumber);
  if (options?.bundleVersion !== undefined)
    environment.TERMINAL_AUTOMATION_UPDATE_BUNDLE_VERSION = options.bundleVersion;
  const args =
    options === undefined
      ? [`package:${kind}`]
      : [
          path.join(root, 'scripts/build/terminal-update-artifact.mjs'),
          '--app',
          appName,
          '--kind',
          kind,
          '--run-id',
          runId,
          ...(options.minimumFullManifest === undefined
            ? []
            : ['--minimum-full-manifest', options.minimumFullManifest]),
        ];
  const result = spawnSync(options === undefined ? 'yarn' : process.execPath, args, {
    cwd: options === undefined ? path.join(root, 'apps/terminal/application/android', appName) : root,
    encoding: 'utf8',
    env: environment,
    maxBuffer: 8 * 1024 * 1024,
    timeout: 45 * 60 * 1000,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.replaceAll(sessionToken, '[REDACTED]');
  process.stdout.write(output.split('\n').slice(-100).join('\n'));
  if (
    result.error ||
    result.status !== 0 ||
    !output.includes(`TERMINAL_UPDATE_ARTIFACT=${kind.toUpperCase()} PASS app=${appName} run=${runId}`)
  ) {
    throw new Error(
      `TERMINAL_AUTOMATION_UPDATE_ARTIFACT_BUILD_FAILED_${kind.toUpperCase()}_${result.error?.name ?? result.status}`,
    );
  }
  // Ensure the HTTP listener used for reverse-proxy delivery is still owned and live.
  if (httpServer.address() === null || address.port < 1)
    throw new Error('TERMINAL_AUTOMATION_UPDATE_HTTP_LISTENER_LOST');
};

const snapshotCompatibilityArtifact = (
  kind: 'full' | 'hot',
  manifestName: string,
  payloadName: string,
): ArtifactManifest => {
  if (!runDirectory) throw new Error('TERMINAL_AUTOMATION_RUN_ID_REQUIRED');
  const outputRoot = path.join(runDirectory, 'update', appName);
  const artifact = readArtifact(`${kind}.json`);
  const sourcePath =
    kind === 'full' ? path.join(outputRoot, artifact.apk?.path ?? '') : path.join(outputRoot, `${appName}-hot.zip`);
  const targetPath = path.join(outputRoot, payloadName);
  copyFileSync(sourcePath, targetPath);
  const snapshot =
    kind === 'full'
      ? Object.freeze({...artifact, apk: Object.freeze({...artifact.apk!, path: payloadName})})
      : artifact;
  writeArtifact(manifestName, snapshot);
  updatePayloadPaths.set(snapshot, Object.freeze({kind, path: targetPath}));
  return snapshot;
};

const updateDocument = (
  full: ArtifactManifest | null,
  hot: ArtifactManifest,
  fullBytes?: Buffer,
  hotBytes?: Buffer,
): Readonly<{target: UpdateTarget; sourcePaths: Readonly<Record<string, string>>}> => {
  if (!runId || !packageId) throw new Error('TERMINAL_AUTOMATION_UPDATE_BUILD_CONTEXT_MISSING');
  const fullRef = `full-${runId}`;
  const hotRef = `hot-${runId}`;
  const fullArtifactPath =
    full === null ? undefined : path.join(runDirectory!, 'update', appName, full.apk?.path ?? '');
  const hotPayload = updatePayloadPaths.get(hot);
  const fullPayload = full === null ? undefined : updatePayloadPaths.get(full);
  if (hotPayload?.kind !== 'hot' || (full !== null && fullPayload?.kind !== 'full'))
    throw new Error('TERMINAL_AUTOMATION_UPDATE_PAYLOAD_NOT_REGISTERED');
  const fullPayloadBytes = fullBytes ?? (fullArtifactPath === undefined ? undefined : readFileSync(fullArtifactPath));
  const hotPayloadBytes = hotBytes ?? readFileSync(hotPayload.path);
  return Object.freeze({
    target: Object.freeze({
      ruleRef: `automation-${runId}`,
      createdAt: Date.now(),
      applicationId: packageId,
      full:
        full === null
          ? null
          : Object.freeze({sourceRef: fullRef, expectedSha256: sha256(fullPayloadBytes!), artifact: full}),
      hot: Object.freeze({sourceRef: hotRef, expectedSha256: sha256(hotPayloadBytes), artifact: hot}),
      strategy: Object.freeze({maxNetworkAttempts: 0, bootTimeoutMs: 60_000}),
      selectionContext: Object.freeze({selectedSpace: 'development', contextIdentity: runId}),
    }),
    sourcePaths: Object.freeze({...(full === null ? {} : {[fullRef]: '/full.apk'}), [hotRef]: '/hot.zip'}),
  });
};

const resetHotSourceGate = (gated: boolean): void => {
  hotSourceRequested = new Promise<void>(resolve => {
    signalHotSourceRequested = resolve;
  });
  hotSourceResponseGate = gated
    ? new Promise<void>(resolve => {
        releaseHotSourceResponse = resolve;
      })
    : Promise.resolve();
  if (!gated) releaseHotSourceResponse = () => undefined;
};

beforeAll(
  async () => {
    if (
      updateCase !== 'update.full-hot' &&
      updateCase !== 'update.offline-assets' &&
      updateCase !== 'update.boot-guard' &&
      updateCase !== 'update.install-result' &&
      updateCase !== 'update.compatibility'
    )
      return;
    if (!runId || !runDirectory) throw new Error('TERMINAL_AUTOMATION_RUN_ID_REQUIRED');
    if (selectedSample !== 'console' && selectedSample !== 'wallpaper')
      throw new Error('TERMINAL_AUTOMATION_SAMPLE_INVALID');
    const serial = process.env.TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIAL;
    if (!serial) throw new Error('TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIAL_REQUIRED');
    const managedDevRunId = process.env.TERMINAL_AUTOMATION_MANAGED_DEV_RUN_ID;
    if (!managedDevRunId) throw new Error('TERMINAL_AUTOMATION_MANAGED_DEV_RUN_ID_REQUIRED');
    const identity = androidAutomationBuildIdentity(runId, selectedSample);
    packageId = identity.packageId;

    resetHotSourceGate(updateCase !== 'update.compatibility');

    httpServer = createHttpServer((request, response) => {
      if (request.url?.startsWith('/api/')) {
        forwardManagedBusinessRequest(request, response, runId);
        return;
      }
      if (request.url?.startsWith('/update-target?revision=') && targetDocument !== undefined) {
        process.stdout.write(
          `TERMINAL_AUTOMATION_UPDATE_SOURCE run=${runId} resource=descriptor revision=${new URL(request.url, 'http://127.0.0.1').searchParams.get('revision')} status=200\n`,
        );
        response.writeHead(200, {'content-type': 'application/json', 'cache-control': 'no-store'});
        response.end(JSON.stringify(targetDocument));
        return;
      }
      if (request.url === '/full.apk' && runDirectory) {
        const artifact = targetDocument?.target.full?.artifact;
        const payload = artifact === undefined ? undefined : updatePayloadPaths.get(artifact);
        if (artifact === undefined || payload?.kind !== 'full') {
          response.writeHead(404, {'cache-control': 'no-store'});
          response.end();
          return;
        }
        const bytes = readFileSync(payload.path);
        process.stdout.write(
          `TERMINAL_AUTOMATION_UPDATE_SOURCE run=${runId} resource=full.apk status=200 bytes=${bytes.byteLength}\n`,
        );
        response.writeHead(200, {
          'content-type': 'application/vnd.android.package-archive',
          'cache-control': 'no-store',
        });
        response.end(bytes);
        return;
      }
      if (request.url === '/hot.zip' && runDirectory) {
        const artifact = targetDocument?.target.hot?.artifact;
        const payload = artifact === undefined ? undefined : updatePayloadPaths.get(artifact);
        if (artifact === undefined || payload?.kind !== 'hot') {
          response.writeHead(404, {'cache-control': 'no-store'});
          response.end();
          return;
        }
        const bytes = readFileSync(payload.path);
        signalHotSourceRequested?.();
        void hotSourceResponseGate?.then(() => {
          if (response.destroyed) return;
          process.stdout.write(
            `TERMINAL_AUTOMATION_UPDATE_SOURCE run=${runId} resource=hot.zip status=200 bytes=${bytes.byteLength}\n`,
          );
          response.writeHead(200, {'content-type': 'application/zip', 'cache-control': 'no-store'});
          response.end(bytes);
        });
        return;
      }
      process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_SOURCE run=${runId} resource=unknown status=404\n`);
      response.writeHead(404, {'cache-control': 'no-store'});
      response.end();
    });
    const businessLocalPort = await listen(httpServer);
    tdsOneSink = createNetServer(socket => socket.destroy());
    tdsTwoSink = createNetServer(socket => socket.destroy());
    const tdsOneLocalPort = await listen(tdsOneSink);
    const tdsTwoLocalPort = await listen(tdsTwoSink);

    adb = createAndroidAdbClient({adbPath, timeoutMs: 10_000});
    connection = await createAndroidAutomationConnection({
      client: adb,
      serial,
      repositoryRoot: root,
      adbPath,
      shape: parseMainSampleShape(process.env.TERMINAL_AUTOMATION_SHAPE),
      token: sessionToken,
      managedServicePorts: [
        {remotePort: 28080, localPort: businessLocalPort},
        {remotePort: 28180, localPort: tdsOneLocalPort},
        {remotePort: 28181, localPort: tdsTwoLocalPort},
      ],
      fixtureFactory: server =>
        createManagedActivationFixtureApi({
          server,
          repositoryRoot: root,
          runId,
          managedDevRunId,
          androidDeviceSerial: serial,
          sessionId: () => initialSessionId,
          deviceId: () => {
            if (initialDeviceId === null) throw new Error('TERMINAL_AUTOMATION_ANDROID_DEVICE_IDENTITY_UNAVAILABLE');
            return initialDeviceId;
          },
        }),
    });
    await prepareAndroidJourneySurface(connection, parseMainSampleShape(process.env.TERMINAL_AUTOMATION_SHAPE));
    const apiLevel = await connection.readApiLevel();
    process.stdout.write(`TERMINAL_AUTOMATION_ANDROID_API_LEVEL run=${runId} serial=${serial} api=${apiLevel}\n`);
    if (apiLevel < 29) throw new Error('TERMINAL_AUTOMATION_ANDROID_API_LEVEL_BELOW_29');
    if (await connection.isInstalled(packageId))
      throw new Error('TERMINAL_AUTOMATION_UPDATE_PACKAGE_ALREADY_INSTALLED');
    packageWasAbsent = true;

    process.stdout.write(
      `TERMINAL_AUTOMATION_UPDATE_ANDROID_PREPARED run=${runId} app=${appName} serial=${serial} package=${packageId}\n`,
    );
    buildArtifact('install');
    let compatibilityHotFive: ArtifactManifest | undefined;
    if (updateCase === 'update.compatibility') {
      buildArtifact('hot', {
        nativeBuildNumber: 1,
        bundleVersion: '1.0.5',
        minimumFullManifest: `update/${appName}/install.json`,
      });
      compatibilityHotFive = snapshotCompatibilityArtifact(
        'hot',
        'compatibility-hot-five.json',
        `${appName}-compat-hot-five.zip`,
      );
      buildArtifact('full', {nativeBuildNumber: 2, bundleVersion: '1.0.4'});
      const compatibilityFull = snapshotCompatibilityArtifact(
        'full',
        'compatibility-full.json',
        `${appName}-compat-full.apk`,
      );
      buildArtifact('full', {nativeBuildNumber: 3, bundleVersion: '1.0.7'});
      const compatibilityExternalFull = snapshotCompatibilityArtifact(
        'full',
        'compatibility-external-full.json',
        `${appName}-compat-external-full.apk`,
      );
      if (compatibilityExternalFull.nativeBuildNumber <= compatibilityFull.nativeBuildNumber)
        throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_EXTERNAL_APK_NOT_HIGHER');
      writeArtifact('full.json', compatibilityFull);
      buildArtifact('hot', {
        nativeBuildNumber: 2,
        bundleVersion: '1.0.6',
        minimumFullManifest: `update/${appName}/compatibility-full.json`,
      });
      const compatibilityHotSix = snapshotCompatibilityArtifact(
        'hot',
        'compatibility-hot-six.json',
        `${appName}-compat-hot-six.zip`,
      );
      updatePayloadPaths.set(
        compatibilityFull,
        Object.freeze({kind: 'full', path: path.join(runDirectory, 'update', appName, compatibilityFull.apk!.path)}),
      );
      updatePayloadPaths.set(
        compatibilityHotSix,
        Object.freeze({kind: 'hot', path: path.join(runDirectory, 'update', appName, `${appName}-compat-hot-six.zip`)}),
      );
      updatePayloadPaths.set(
        compatibilityHotFive,
        Object.freeze({
          kind: 'hot',
          path: path.join(runDirectory, 'update', appName, `${appName}-compat-hot-five.zip`),
        }),
      );
      if (
        compatibilityHotFive.publicationId !== compatibilityHotSix.publicationId ||
        updatePayloadPaths.get(compatibilityHotFive)?.path !==
          path.join(runDirectory, 'update', appName, `${appName}-compat-hot-five.zip`) ||
        updatePayloadPaths.get(compatibilityHotSix)?.path !==
          path.join(runDirectory, 'update', appName, `${appName}-compat-hot-six.zip`)
      ) {
        throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_HOT_PAYLOAD_IDENTITY_INVALID');
      }
      compatibilityTargetDocument = updateDocument(compatibilityFull, compatibilityHotSix);
    } else {
      buildArtifact('full');
      buildArtifact('hot');
    }

    const install = readArtifact('install.json');
    const full = readArtifact('full.json');
    const hot = readArtifact('hot.json');
    if (
      !install.apk ||
      !full.apk ||
      !hot.minimumFull ||
      full.nativeBuildNumber !== 2 ||
      full.bundleVersion !== (updateCase === 'update.compatibility' ? '1.0.4' : '1.0.0') ||
      hot.bundleVersion !== (updateCase === 'update.compatibility' ? '1.0.6' : '1.0.1') ||
      install.applicationId !== packageId ||
      full.applicationId !== packageId ||
      hot.applicationId !== packageId ||
      hot.minimumFull.apkSha256 !== full.apk.sha256 ||
      full.nativeBuildNumber <= install.nativeBuildNumber ||
      hot.nativeBuildNumber !== full.nativeBuildNumber ||
      hot.bundleVersion <= install.bundleVersion
    ) {
      throw new Error('TERMINAL_AUTOMATION_UPDATE_ARTIFACT_CHAIN_INVALID');
    }
    const fullBytes = readFileSync(path.join(runDirectory, 'update', appName, full.apk.path));
    const hotBytes = readFileSync(path.join(runDirectory, 'update', appName, `${appName}-hot.zip`));
    updatePayloadPaths.set(
      full,
      Object.freeze({kind: 'full', path: path.join(runDirectory, 'update', appName, full.apk.path)}),
    );
    updatePayloadPaths.set(
      hot,
      Object.freeze({kind: 'hot', path: path.join(runDirectory, 'update', appName, `${appName}-hot.zip`)}),
    );
    if (updateCase === 'update.compatibility') {
      if (!compatibilityHotFive) throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_HOT_FIVE_MISSING');
      targetDocument = updateDocument(null, compatibilityHotFive);
    } else {
      targetDocument = updateDocument(full, hot, fullBytes, hotBytes);
    }

    installAttempted = true;
    await connection.install(path.join(runDirectory, 'update', appName, install.apk.path));
    if (!(await connection.isInstalled(packageId)))
      throw new Error('TERMINAL_AUTOMATION_UPDATE_INSTALL_READBACK_FAILED');
    await connection.launch(`${packageId}/${sample.applicationId}.MainActivity`);
    const initial = await waitForAutomationSession(
      connection.driver,
      value => value.appName === sample.appName,
      60_000,
    );
    const actual = await readSelector(
      connection.driver,
      initial.sessionId,
      'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
      [],
    );
    expect(actual).toMatchObject({
      applicationId: packageId,
      nativeBuildNumber: install.nativeBuildNumber,
      entryKind: 'embedded',
    });
    initialSessionId = initial.sessionId;
    initialDeviceId = await readApplicationDeviceId(connection.driver, initial.sessionId);
    try {
      await ensureMainSampleActivated(connection.fixtures, {
        shape: parseMainSampleShape(process.env.TERMINAL_AUTOMATION_SHAPE),
        deviceId: initialDeviceId,
        runId,
      });
    } catch (error) {
      await writeAndroidFailureDiagnostics({connection, packageId, runId, boundary: 'full-session'});
      throw error;
    }
  },
  90 * 60 * 1000,
);

afterAll(async () => {
  if (
    updateCase !== 'update.full-hot' &&
    updateCase !== 'update.offline-assets' &&
    updateCase !== 'update.boot-guard' &&
    updateCase !== 'update.install-result' &&
    updateCase !== 'update.compatibility'
  )
    return;
  const errors: string[] = [];
  releaseHotSourceResponse?.();
  if (connection !== undefined && packageId !== undefined) {
    try {
      if (packageWasAbsent && (installAttempted || (await connection.isInstalled(packageId)))) {
        process.stdout.write(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_STAGE run=${runId} stage=force-stop\n`);
        await connection.forceStop(packageId);
        process.stdout.write(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_STAGE run=${runId} stage=uninstall\n`);
        await connection.uninstall(packageId);
      }
      process.stdout.write(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_STAGE run=${runId} stage=package-readback\n`);
      if (await connection.isInstalled(packageId)) errors.push('ANDROID_PACKAGE_REMAINS');
    } catch (error) {
      const code =
        error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+$/u.test(error.message)
          ? error.message
          : 'ANDROID_PACKAGE_CLEANUP_FAILED';
      errors.push(code);
    }
    try {
      process.stdout.write(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_STAGE run=${runId} stage=connection-close\n`);
      await connection.close();
    } catch (error) {
      const code =
        error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+$/u.test(error.message)
          ? error.message
          : 'ANDROID_CONNECTION_CLEANUP_FAILED';
      errors.push(code);
    }
  }
  for (const server of [httpServer, tdsOneSink, tdsTwoSink]) {
    try {
      await closeServer(server);
    } catch {
      errors.push('LOCAL_SOURCE_SERVER_CLEANUP_FAILED');
    }
  }
  if (errors.length > 0) {
    process.stdout.write(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:${errors.join('_')}\n`);
    throw new Error(`TERMINAL_AUTOMATION_UPDATE_CLEANUP_${errors.join('_')}`);
  }
  process.stdout.write('TERMINAL_AUTOMATION_DEVICE_CLEANUP_COMPLETE\n');
}, 90_000);

it.skipIf(
  updateCase !== 'update.full-hot' &&
    updateCase !== 'update.offline-assets' &&
    updateCase !== 'update.boot-guard' &&
    updateCase !== 'update.install-result' &&
    updateCase !== 'update.compatibility',
)(
  'installs FULL then loads HOT on the same Android identity and verifies wallpaper images',
  async () => {
    if (
      !runId ||
      !runDirectory ||
      connection === undefined ||
      packageId === undefined ||
      targetDocument === undefined
    ) {
      throw new Error('TERMINAL_AUTOMATION_UPDATE_ANDROID_NOT_READY');
    }
    const install = readArtifact('install.json');
    const full = readArtifact('full.json');
    const hot = readArtifact('hot.json');
    let initial = connection.driver.getSessions().find(value => value.appName === sample.appName);
    if (initial === undefined) throw new Error('TERMINAL_AUTOMATION_UPDATE_INITIAL_SESSION_MISSING');
    let androidUi = createAndroidJourneyUiPort({
      connection,
      sessionId: initial.sessionId,
      onStep: step => process.stdout.write(`TERMINAL_AUTOMATION_DRIVER_STEP run=${runId} step=${step}\n`),
    });
    let systemUi = androidUi;
    const info = responseResult(await connection.driver.request(initial.sessionId, 'runtime.info', null));
    if (!info || typeof info !== 'object' || !('descriptors' in info) || !Array.isArray(info.descriptors)) {
      throw new Error('TERMINAL_AUTOMATION_UPDATE_RUNTIME_INFO_INVALID');
    }
    const descriptor = info.descriptors.find(
      (value: unknown) =>
        typeof value === 'object' &&
        value !== null &&
        'moduleName' in value &&
        value.moduleName === 'kernel.base.terminal-update',
    );
    if (
      !descriptor ||
      typeof descriptor !== 'object' ||
      !('commandNames' in descriptor) ||
      !Array.isArray(descriptor.commandNames)
    ) {
      throw new Error('TERMINAL_AUTOMATION_UPDATE_OWNER_MISSING');
    }
    const commandName = descriptor.commandNames.find(
      (value: unknown) => typeof value === 'string' && value.endsWith('.accept-target'),
    );
    if (typeof commandName !== 'string') throw new Error('TERMINAL_AUTOMATION_UPDATE_COMMAND_MISSING');
    let assertCompatibilityDataReadback: ((sessionId: string, stage: string) => Promise<void>) | undefined;
    const dispatchUpdateCommand = async (name: string, payload: unknown, sessionId = initial!.sessionId) => {
      const requestId = `req_${Date.now().toString(36)}_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
      const commandCompletion = waitForCommandResult(connection!.driver, sessionId, requestId, 180_000);
      void commandCompletion.promise.catch(() => undefined);
      try {
        const accepted = responseResult(
          await connection!.driver.request(sessionId, 'command.dispatch', {
            commandName: name,
            payload,
            requestId,
          }),
        );
        if (!isRecord(accepted) || accepted.requestId !== requestId || accepted.accepted !== true) {
          commandCompletion.cancel();
          throw new Error('TERMINAL_AUTOMATION_UPDATE_COMMAND_NOT_ACCEPTED');
        }
        const completion = await commandCompletion.promise;
        const result = isRecord(completion.result) ? completion.result : undefined;
        const actorResults = result && Array.isArray(result.actorResults) ? result.actorResults : [];
        const actorSummary = actorResults.map(actor => {
          if (!isRecord(actor)) return 'invalid-record';
          const error = isRecord(actor.error) ? actor.error : undefined;
          return `${typeof actor.actorKey === 'string' ? actor.actorKey : 'unknown'}:${typeof actor.status === 'string' ? actor.status : 'unknown'}:${typeof error?.code === 'string' ? error.code : 'no-error'}:${'result' in actor ? 'has-result' : 'no-result'}`;
        }).join(',');
        process.stdout.write(
          `TERMINAL_AUTOMATION_UPDATE_COMMAND_RESULT run=${runId} request=${requestId} command=${name} status=${typeof result?.status === 'string' ? result.status : 'invalid'} actorCount=${actorResults.length} actors=${actorSummary || 'none'}\n`,
        );
        if (
          !result ||
          result.status !== 'completed' ||
          !Array.isArray(result.actorResults) ||
          !isRecord(result.actorResults[0]) ||
          !('result' in result.actorResults[0])
        )
          throw new Error('TERMINAL_AUTOMATION_UPDATE_COMMAND_RESULT_INVALID');
        return Object.freeze({requestId, result: result.actorResults[0].result});
      } catch (error) {
        commandCompletion.cancel();
        throw error;
      }
    };
    const dispatchUpdateCommandAcrossRuntimeReload = async (name: string, payload: unknown): Promise<string> => {
      const requestId = `req_${Date.now().toString(36)}_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
      const accepted = responseResult(
        await connection!.driver.request(initial!.sessionId, 'command.dispatch', {
          commandName: name,
          payload,
          requestId,
        }),
      );
      if (!isRecord(accepted) || accepted.requestId !== requestId || accepted.accepted !== true) {
        throw new Error('TERMINAL_AUTOMATION_UPDATE_COMMAND_NOT_ACCEPTED');
      }
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_COMMAND_ACCEPTED run=${runId} request=${requestId} observation=successor-runtime\n`,
      );
      return requestId;
    };
    if (updateCase === 'update.compatibility') {
      if (
        compatibilityTargetDocument === undefined ||
        targetDocument.target.full !== null ||
        targetDocument.target.hot.artifact.bundleVersion !== '1.0.5'
      ) {
        throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_INITIAL_TARGET_INVALID');
      }
      const hotFiveRequestId = await dispatchUpdateCommandAcrossRuntimeReload(commandName, {
        selectionContext: targetDocument.target.selectionContext,
      });
      const hotFiveSession = await waitForAutomationSession(
        connection.driver,
        value => value.appName === sample.appName && value.sessionId !== initial!.sessionId,
        180_000,
      );
      const hotFiveActual = await readSelector(
        connection.driver,
        hotFiveSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
        [],
      );
      expect(hotFiveActual).toMatchObject({
        applicationId: packageId,
        nativeBuildNumber: install.nativeBuildNumber,
        bundleVersion: '1.0.5',
        publicationId: targetDocument.target.hot.artifact.publicationId,
        entryKind: 'hot',
      });
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_COMPATIBILITY_STAGE run=${runId} request=${hotFiveRequestId} stage=hot-five nativeBuild=${install.nativeBuildNumber} bundle=1.0.5 observation=successor-runtime-selector\n`,
      );

      const layerId = `update-compat-${runId.slice(0, 24)}`;
      const layerMarker = `compatibility-${runId}`;
      const wallpaper = selectedSample === 'wallpaper';
      if (wallpaper) {
        const qualification = await readSelector(
          connection.driver,
          hotFiveSession.sessionId,
          'kernel.feature.sample-staff-session.selectHostStaffQualification',
          [],
        );
        if (!isRecord(qualification) || qualification.status !== 'authenticated') {
          const hotFiveUi = createAndroidJourneyUiPort({
            connection,
            sessionId: hotFiveSession.sessionId,
            onStep: step => process.stdout.write(`TERMINAL_AUTOMATION_DRIVER_STEP run=${runId} step=${step}\n`),
          });
          await loginSampleStaff(
            {server: connection.driver, sessionId: hotFiveSession.sessionId, ...hotFiveUi},
            {operatorName: 'A001', passcode: '1111', expectedScreen: 'sample.wallpaper.picker'},
          );
        }
        const selected = await dispatchUpdateCommand(
          'kernel.feature.sample-wallpaper.select-wallpaper',
          {wallpaperId: 'w2'},
          hotFiveSession.sessionId,
        );
        expect(selected.result).toBeNull();
        const confirmed = await dispatchUpdateCommand(
          'kernel.feature.sample-wallpaper.confirm-wallpaper',
          {},
          hotFiveSession.sessionId,
        );
        expect(confirmed.result).toBeNull();
      } else {
        const written = await dispatchUpdateCommand(
          'kernel.base.ui-state.open-layer',
          Object.freeze({
            displayMode: 'PRIMARY',
            layerId,
            partKey: 'sample.desk.waiting-confirm',
            persistence: 'durable',
            props: Object.freeze({compatibilityMarker: layerMarker}),
          }),
          hotFiveSession.sessionId,
        );
        expect(written.result).toMatchObject({changed: true, persistenceStatus: 'succeeded'});
      }
      assertCompatibilityDataReadback = async (sessionId: string, stage: string): Promise<void> => {
        if (wallpaper) {
          const wallpaperId = await readSelector(
            connection!.driver,
            sessionId,
            'kernel.feature.sample-wallpaper.selectWallpaperId',
            [],
          );
          expect(wallpaperId).toBe('w2');
          process.stdout.write(
            `TERMINAL_AUTOMATION_COMPATIBILITY_DATA run=${runId} stage=${stage} owner=sample-wallpaper selection=w2\n`,
          );
          return;
        }
        const layers = await readSelector(connection!.driver, sessionId, 'kernel.base.ui-state.selectLayers', [
          'PRIMARY',
        ]);
        const matching = Array.isArray(layers)
          ? layers.find(value => isRecord(value) && value.layerId === layerId)
          : undefined;
        if (!isRecord(matching) || !isRecord(matching.props) || matching.props.compatibilityMarker !== layerMarker)
          throw new Error(`TERMINAL_AUTOMATION_COMPATIBILITY_DATA_NOT_READ_${stage.toUpperCase()}`);
        process.stdout.write(
          `TERMINAL_AUTOMATION_UPDATE_COMPATIBILITY_DATA run=${runId} stage=${stage} owner=ui-state layer=present\n`,
        );
      };
      await assertCompatibilityDataReadback(hotFiveSession.sessionId, 'hot-five-write');

      // A fresh app Runtime creates a new boot token; startup reconciliation must
      // release only the completed prior task while durable UI state remains.
      await connection.forceStop(packageId);
      await connection.launch(`${packageId}/${sample.applicationId}.MainActivity`);
      const restartedSession = await waitForAutomationSession(
        connection.driver,
        value => value.appName === sample.appName && value.sessionId !== hotFiveSession.sessionId,
        90_000,
      );
      initial = restartedSession;
      androidUi = createAndroidJourneyUiPort({
        connection,
        sessionId: restartedSession.sessionId,
        onStep: step => process.stdout.write(`TERMINAL_AUTOMATION_DRIVER_STEP run=${runId} step=${step}\n`),
      });
      systemUi = androidUi;
      await assertCompatibilityDataReadback(restartedSession.sessionId, 'same-js-five-process-restart');
      const restartedActual = await readSelector(
        connection.driver,
        restartedSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
        [],
      );
      expect(restartedActual).toMatchObject({bundleVersion: '1.0.5', entryKind: 'hot'});
      const releasedTask = await waitForSelector(
        connection.driver,
        restartedSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateTask',
        [],
        value => value === null,
        20_000,
      );
      expect(releasedTask).toBeNull();
      resetHotSourceGate(true);
      targetDocument = compatibilityTargetDocument;
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_COMPATIBILITY_TASK run=${runId} stage=after-new-runtime state=released\n`,
      );
    }
    const acceptedTarget = await dispatchUpdateCommand(commandName, {
      selectionContext: targetDocument.target.selectionContext,
    });
    const requestId = acceptedTarget.requestId;
    const updateOutcome = acceptedTarget.result;
    if (isRecord(updateOutcome) && (updateOutcome.status === 'failed' || updateOutcome.status === 'unknown')) {
      try {
        const diagnostics = await connection.readTerminalUpdateLogs(packageId);
        process.stdout.write(
          diagnostics.length === 0
            ? `TERMINAL_AUTOMATION_UPDATE_NATIVE_LOG_NOT_AVAILABLE run=${runId}\n`
            : diagnostics
                .split('\n')
                .map(line => `TERMINAL_AUTOMATION_UPDATE_NATIVE_LOG run=${runId} ${line}`)
                .join('\n') + '\n',
        );
      } catch (error) {
        const code =
          error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+$/u.test(error.message)
            ? error.message
            : 'TERMINAL_AUTOMATION_UPDATE_NATIVE_LOG_READ_FAILED';
        process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_NATIVE_LOG_NOT_AVAILABLE run=${runId} code=${code}\n`);
      }
    }
    expect(updateOutcome).toMatchObject({status: 'unknown', reason: 'INSTALLER_AWAITING_READBACK'});
    process.stdout.write(
      `TERMINAL_AUTOMATION_UPDATE_TARGET_ACCEPTED run=${runId} request=${requestId} state=INSTALLER_AWAITING_READBACK\n`,
    );

    const fullSessionMatches = (value: Readonly<{readonly appName: string; readonly sessionId: string}>): boolean =>
      value.appName === sample.appName && value.sessionId !== initial!.sessionId;
    let fullSession: Awaited<ReturnType<typeof waitForAutomationSession>> | undefined;
    let installerOpenedApp = false;
    let installButton: Awaited<ReturnType<AndroidAutomationConnection['systemUi']['waitForButton']>> | undefined;
    try {
      installButton = await systemUi.waitForSystemButton({
        labels: ['Install', 'Update', 'Settings', 'Allow from this source'],
        timeoutMs: 20_000,
        allowedPackagePrefixes: installSourcePackagePrefixes,
        expectedContext: {label: 'Allow from this source', text: appName},
      });
    } catch (error) {
      if (runDirectory) {
        const screenshotPath = path.join(runDirectory, 'installer-user-action-not-visible.png');
        writeFileSync(screenshotPath, await connection.capture('primary'), {mode: 0o600});
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALLER_FAILURE_SCREEN run=${runId} screenshot=${screenshotPath}\n`,
        );
      }
      await writeNativeUpdateDiagnostics({connection, packageId, runId});
      throw error;
    }
    if (installButton.label === 'Settings') {
      process.stdout.write(
        `TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTINGS run=${runId} package=${installButton.packageName ?? 'UNKNOWN'} action=open\n`,
      );
      await androidUi.clickSystemButton({
        labels: ['Settings'],
        timeoutMs: 20_000,
        allowedPackagePrefixes: settingsPackagePrefixes,
      });
      installButton = await systemUi.waitForSystemButton({
        labels: ['Allow from this source'],
        timeoutMs: 20_000,
        allowedPackagePrefixes: settingsPackagePrefixes,
        expectedContext: {label: 'Allow from this source', text: appName},
      });
    }
    if (installButton.label === 'Allow from this source') {
      if (installButton.checked === undefined) {
        throw new Error('TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTING_STATE_UNKNOWN');
      }
      const permissionNeedsEnable = !installButton.checked;
      if (permissionNeedsEnable) {
        process.stdout.write(
          [
            `TERMINAL_AUTOMATION_INSTALLER_SOURCE_CONTROL run=${runId}`,
            `labelClass=${installButton.labelClass}`,
            `targetClass=${installButton.targetClass}`,
            `ancestorDistance=${installButton.ancestorDistance}`,
            `targetEnabled=${installButton.targetEnabled ? 1 : 0}`,
            `targetClickable=${installButton.targetClickable ? 1 : 0}`,
            `stateSource=${installButton.stateSource}`,
            `bounds=${installButton.bounds.left},${installButton.bounds.top},${installButton.bounds.right},${installButton.bounds.bottom}`,
          ].join(' ') + '\n',
        );
        process.stdout.write(`TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTINGS run=${runId} state=enable\n`);
        const changed = await systemUi.setSystemChecked({
          labels: ['Allow from this source'],
          checked: true,
          timeoutMs: 20_000,
          allowedPackagePrefixes: settingsPackagePrefixes,
          expectedContext: {label: 'Allow from this source', text: appName},
        });
        if (changed.checked !== true) throw new Error('TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTING_READBACK_FAILED');
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTINGS run=${runId} action=setting-toggled readback=enabled\n`,
        );
      } else {
        process.stdout.write(`TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTINGS run=${runId} state=already-enabled\n`);
      }
      // Returning to the app lets its foreground lifecycle resume the exact
      // staged confirmation intent. Some Android builds keep Settings in front
      // after the permission readback, so explicitly foreground the app too.
      await systemUi.pressSystemBack();
      process.stdout.write(
        `TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTINGS run=${runId} action=returned-from-settings\n`,
      );
      await connection.launch(`${packageId}/${sample.applicationId}.MainActivity`);
      process.stdout.write(
        `TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTINGS run=${runId} action=app-foreground-requested\n`,
      );
      const immersiveNoticeAcknowledged = await systemUi.acknowledgeImmersiveModeEducation();
      process.stdout.write(
        `TERMINAL_AUTOMATION_IMMERSIVE_NOTICE run=${runId} acknowledged=${immersiveNoticeAcknowledged ? 1 : 0}\n`,
      );
      try {
        installButton = await systemUi.waitForSystemButton({
          labels: ['Install', 'Update'],
          timeoutMs: 20_000,
          allowedPackagePrefixes: installerPackagePrefixes,
        });
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTINGS run=${runId} state=installer-confirmation-visible\n`,
        );
      } catch {
        const screenshotPath = runDirectory ? path.join(runDirectory, 'installer-return-unresolved.png') : undefined;
        const screen = await systemUi.readSystemScreenSummary().catch(() => 'UNAVAILABLE');
        process.stdout.write(`TERMINAL_AUTOMATION_INSTALLER_RETURN_UNRESOLVED_STATE run=${runId} screen=${screen}\n`);
        if (screenshotPath) {
          writeFileSync(screenshotPath, await connection.capture('primary'), {mode: 0o600});
          process.stdout.write(
            `TERMINAL_AUTOMATION_INSTALLER_RETURN_UNRESOLVED run=${runId} screenshot=${screenshotPath}\n`,
          );
        }
        await writeNativeUpdateDiagnostics({connection, packageId, runId});
        throw new Error('TERMINAL_AUTOMATION_INSTALLER_CONFIRMATION_NOT_RETURNED');
      }

      const continuationAbort = new AbortController();
      const continuationButton = systemUi
        .waitForSystemButton({
          labels: ['Install', 'Update'],
          timeoutMs: 20_000,
          signal: continuationAbort.signal,
          allowedPackagePrefixes: installerPackagePrefixes,
        })
        .then(
          button => ({kind: 'button' as const, button}),
          error => ({kind: 'button-error' as const, error}),
        );
      const continuationSession = waitForAutomationSession(
        connection.driver,
        fullSessionMatches,
        60_000,
        continuationAbort.signal,
      ).then(
        session => ({kind: 'session' as const, session}),
        error => ({kind: 'session-error' as const, error}),
      );
      try {
        const continuation = await Promise.race([continuationButton, continuationSession]);
        if (continuation.kind === 'button') {
          installButton = continuation.button;
          process.stdout.write(`TERMINAL_AUTOMATION_INSTALLER_CONTINUATION run=${runId} source=system-confirmation\n`);
        } else if (continuation.kind === 'session') {
          fullSession = continuation.session;
          const installFacts = await writeNativeUpdateDiagnostics({connection, packageId, runId});
          if (!installFacts.installerSucceeded || !installFacts.changedApkBooted) {
            throw new Error('TERMINAL_AUTOMATION_INSTALLER_SESSION_WITHOUT_SUCCESS_READBACK');
          }
          installerOpenedApp = true;
          process.stdout.write(
            `TERMINAL_AUTOMATION_INSTALLER_CONTINUATION run=${runId} source=installed-session-and-native-readback\n`,
          );
        } else {
          const remaining = continuation.kind === 'button-error' ? await continuationSession : await continuationButton;
          if (remaining.kind === 'session') {
            fullSession = remaining.session;
            const installFacts = await writeNativeUpdateDiagnostics({connection, packageId, runId});
            if (!installFacts.installerSucceeded || !installFacts.changedApkBooted) {
              throw new Error('TERMINAL_AUTOMATION_INSTALLER_SESSION_WITHOUT_SUCCESS_READBACK');
            }
            installerOpenedApp = true;
            process.stdout.write(
              `TERMINAL_AUTOMATION_INSTALLER_CONTINUATION run=${runId} source=installed-session-and-native-readback\n`,
            );
          } else if (remaining.kind === 'button') {
            installButton = remaining.button;
            process.stdout.write(
              `TERMINAL_AUTOMATION_INSTALLER_CONTINUATION run=${runId} source=system-confirmation\n`,
            );
          } else {
            throw continuation.kind === 'button-error' ? continuation.error : remaining.error;
          }
        }
      } finally {
        continuationAbort.abort();
      }
    }
    if (updateCase === 'update.install-result') {
      if (
        installButton === undefined ||
        !installerPackagePrefixes.some(prefix => installButton?.packageName?.startsWith(prefix))
      ) {
        throw new Error('TERMINAL_AUTOMATION_INSTALL_RESULT_INSTALLER_SCREEN_NOT_OWNED');
      }
      const cancelledTask = await readSelector(
        connection.driver,
        initial.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateTask',
        [],
      );
      if (!isRecord(cancelledTask) || typeof cancelledTask.actionId !== 'string')
        throw new Error('TERMINAL_AUTOMATION_INSTALL_RESULT_ACTION_NOT_PERSISTED');
      let cancelButton;
      try {
        cancelButton = await systemUi.waitForSystemButton({
          labels: ['Cancel'],
          timeoutMs: 20_000,
          allowedPackagePrefixes: installerPackagePrefixes,
        });
      } catch (error) {
        const screen = await systemUi.readSystemScreenSummary().catch(() => 'UNAVAILABLE');
        await writeNativeUpdateDiagnostics({connection, packageId, runId});
        process.stdout.write(`TERMINAL_AUTOMATION_INSTALL_RESULT_CANCEL_NOT_AVAILABLE run=${runId} screen=${screen}\n`);
        throw error;
      }
      if (!installerPackagePrefixes.some(prefix => cancelButton.packageName?.startsWith(prefix))) {
        throw new Error('TERMINAL_AUTOMATION_INSTALL_RESULT_CANCEL_NOT_OWNED');
      }
      process.stdout.write(
        `TERMINAL_AUTOMATION_INSTALL_RESULT_CANCEL run=${runId} actionId=${cancelledTask.actionId} method=installer-cancel package=${cancelButton.packageName ?? 'UNKNOWN'}\n`,
      );
      await androidUi.clickSystemButton({
        labels: ['Cancel'],
        timeoutMs: 20_000,
        allowedPackagePrefixes: installerPackagePrefixes,
      });
      const cancelScreen = await systemUi.readSystemScreenSummary().catch(() => 'UNAVAILABLE');
      process.stdout.write(
        `TERMINAL_AUTOMATION_INSTALL_RESULT_CANCEL_READBACK run=${runId} screen=${cancelScreen} observation=native-action-before-reaccept\n`,
      );
      await writeNativeUpdateDiagnostics({connection, packageId, runId});
      const reaccepted = await dispatchUpdateCommand(commandName, {
        selectionContext: targetDocument.target.selectionContext,
      });
      if (
        !isRecord(reaccepted.result) ||
        reaccepted.result.status !== 'unknown' ||
        reaccepted.result.reason !== 'INSTALLER_AWAITING_READBACK'
      ) {
        const observedTask = await readSelector(
          connection.driver,
          initial.sessionId,
          'kernel.base.terminal-update.selectTerminalUpdateTask',
          [],
        );
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALL_RESULT_REACCEPT_READBACK run=${runId} result=${isRecord(reaccepted.result) ? String(reaccepted.result.status) : 'INVALID'} task=${isRecord(observedTask) && typeof observedTask.phase === 'string' ? observedTask.phase : 'UNKNOWN'} actionMatches=${isRecord(observedTask) && observedTask.actionId === cancelledTask.actionId ? 1 : 0}\n`,
        );
        await writeNativeUpdateDiagnostics({connection, packageId, runId});
      }
      expect(reaccepted.result).toMatchObject({status: 'unknown', reason: 'INSTALLER_AWAITING_READBACK'});
      const retriedTask = await readSelector(
        connection.driver,
        initial.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateTask',
        [],
      );
      if (!isRecord(retriedTask) || typeof retriedTask.actionId !== 'string')
        throw new Error('TERMINAL_AUTOMATION_INSTALL_RESULT_REINVITED_ACTION_NOT_PERSISTED');
      expect(retriedTask.taskId).toBe(cancelledTask.taskId);
      expect(retriedTask.target).toEqual(cancelledTask.target);
      expect(retriedTask.actionId).not.toBe(cancelledTask.actionId);
      process.stdout.write(
        `TERMINAL_AUTOMATION_INSTALL_RESULT_REINVITED run=${runId} request=${reaccepted.requestId} newAction=1\n`,
      );
      installButton = await systemUi.waitForSystemButton({
        labels: ['Install', 'Update'],
        timeoutMs: 20_000,
        allowedPackagePrefixes: installerPackagePrefixes,
      });
    }
    if (installButton) {
      process.stdout.write(
        `TERMINAL_AUTOMATION_INSTALLER_BUTTON run=${runId} package=${installButton.packageName ?? 'UNKNOWN'} label=${installButton.label} action=install\n`,
      );
      await androidUi.clickSystemButton({
        labels: [installButton.label],
        timeoutMs: 20_000,
        allowedPackagePrefixes: installerPackagePrefixes,
      });
      const completionAbort = new AbortController();
      const completionButton = systemUi
        .waitForSystemButton({
          labels: ['Done', 'Open'],
          timeoutMs: 20_000,
          signal: completionAbort.signal,
          allowedPackagePrefixes: installerPackagePrefixes,
        })
        .then(
          button => ({kind: 'button' as const, button}),
          error => ({kind: 'button-error' as const, error}),
        );
      const completionSession = waitForAutomationSession(
        connection.driver,
        fullSessionMatches,
        60_000,
        completionAbort.signal,
      ).then(
        session => ({kind: 'session' as const, session}),
        error => ({kind: 'session-error' as const, error}),
      );
      let completion:
        | Awaited<typeof completionButton>
        | Awaited<typeof completionSession>
        | Readonly<{readonly kind: 'native-success'}>;
      try {
        completion = await Promise.race([completionButton, completionSession]);
        if (completion.kind === 'button-error') {
          const installFacts = await writeNativeUpdateDiagnostics({connection, packageId, runId});
          if (installFacts.installerSucceeded && installFacts.changedApkBooted) {
            completion = {kind: 'native-success'};
          } else {
            const sessionResult = await completionSession;
            if (sessionResult.kind === 'session-error') throw completion.error;
            completion = sessionResult;
          }
        } else if (completion.kind === 'session-error') {
          const installFacts = await writeNativeUpdateDiagnostics({connection, packageId, runId});
          if (installFacts.installerSucceeded && installFacts.changedApkBooted) {
            completion = {kind: 'native-success'};
          } else {
            const buttonResult = await completionButton;
            if (buttonResult.kind === 'button-error') throw buttonResult.error;
            completion = buttonResult;
          }
        }
      } catch (error) {
        await writeNativeUpdateDiagnostics({connection, packageId, runId});
        throw error;
      } finally {
        completionAbort.abort();
      }
      if (completion.kind === 'session') {
        fullSession = completion.session;
        installerOpenedApp = true;
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALLER_COMPLETION run=${runId} source=fresh-session session=${fullSession.sessionId}\n`,
        );
      } else if (completion.kind === 'button') {
        const installCompletion = completion.button;
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALLER_BUTTON run=${runId} package=${installCompletion.packageName ?? 'UNKNOWN'} label=${installCompletion.label} action=complete\n`,
        );
        const clickedCompletion = await androidUi.clickSystemButton({
          labels: [installCompletion.label],
          timeoutMs: 20_000,
          allowedPackagePrefixes: installerPackagePrefixes,
        });
        installerOpenedApp = clickedCompletion.label === 'Open';
      } else if (completion.kind === 'native-success') {
        installerOpenedApp = true;
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALLER_COMPLETION run=${runId} source=success-callback-and-changed-apk\n`,
        );
        await connection.launch(`${packageId}/${sample.applicationId}.MainActivity`);
        process.stdout.write(`TERMINAL_AUTOMATION_FULL_APP_LAUNCH run=${runId} action=start-after-installer-success\n`);
      } else {
        throw new Error('TERMINAL_AUTOMATION_INSTALL_COMPLETION_UNRESOLVED');
      }
    }
    if (!installerOpenedApp) {
      process.stdout.write(`TERMINAL_AUTOMATION_FULL_APP_LAUNCH run=${runId} action=start\n`);
      await connection.launch(`${packageId}/${sample.applicationId}.MainActivity`);
      process.stdout.write(`TERMINAL_AUTOMATION_FULL_APP_LAUNCH run=${runId} action=returned\n`);
    }
    if (fullSession === undefined) {
      try {
        fullSession = await waitForAutomationSession(connection.driver, fullSessionMatches, 120_000);
      } catch (error) {
        const sessions = connection.driver.getSessions();
        process.stdout.write(
          [
            `TERMINAL_AUTOMATION_FULL_SESSION_TIMEOUT run=${runId}`,
            `sessionCount=${sessions.length}`,
            `sampleSessionCount=${sessions.filter(value => value.appName === sample.appName).length}`,
            `initialSessionPresent=${sessions.some(value => value.sessionId === initial!.sessionId) ? 1 : 0}`,
          ].join(' ') + '\n',
        );
        await writeAndroidFailureDiagnostics({connection, packageId, runId, boundary: 'full-session'});
        await writeNativeUpdateDiagnostics({connection, packageId, runId});
        throw error;
      }
    }
    if (hotSourceRequested === undefined || releaseHotSourceResponse === undefined) {
      throw new Error('TERMINAL_AUTOMATION_HOT_SOURCE_GATE_NOT_READY');
    }
    let hotRequestTimeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        hotSourceRequested,
        new Promise<never>((_, reject) => {
          hotRequestTimeout = setTimeout(
            () => reject(new Error('TERMINAL_AUTOMATION_HOT_SOURCE_REQUEST_NOT_OBSERVED')),
            120_000,
          );
        }),
      ]);
      const currentFull = await readSelector(
        connection.driver,
        fullSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
        [],
      );
      expect(currentFull).toMatchObject({
        applicationId: packageId,
        nativeBuildNumber: full.nativeBuildNumber,
        entryKind: 'embedded',
        ...(updateCase === 'update.compatibility' ? {bundleVersion: '1.0.4'} : {}),
      });
      if (updateCase === 'update.compatibility') {
        if (assertCompatibilityDataReadback === undefined)
          throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_ORACLE_MISSING');
        await assertCompatibilityDataReadback(fullSession.sessionId, 'embedded-js-four');
      }
      if (selectedSample === 'wallpaper') {
        const fullUi = createAndroidJourneyUiPort({
          connection,
          sessionId: fullSession.sessionId,
          onStep: step => process.stdout.write(`TERMINAL_AUTOMATION_DRIVER_STEP run=${runId} step=${step}\n`),
        });
        const fullQualification = await readSelector(
          connection.driver,
          fullSession.sessionId,
          'kernel.feature.sample-staff-session.selectHostStaffQualification',
          [],
        );
        if (!isRecord(fullQualification) || fullQualification.status !== 'authenticated') {
          await loginSampleStaff(
            {server: connection.driver, sessionId: fullSession.sessionId, ...fullUi},
            {
              operatorName: 'A001',
              passcode: '1111',
              expectedScreen: 'sample.wallpaper.picker',
            },
          );
        }
        await waitForWallpaperAssets(connection.driver, fullSession.sessionId, 'full');
      }
      await writeUpdateStateDiagnostics(connection.driver, fullSession.sessionId, runId);
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_STAGE_READBACK run=${runId} stage=full entryKind=embedded nativeBuild=${full.nativeBuildNumber}\n`,
      );
    } catch (error) {
      process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_STAGE_FAILURE run=${runId} stage=hot-source-observation\n`);
      await writeUpdateStateDiagnostics(connection.driver, fullSession.sessionId, runId);
      await writeAndroidFailureDiagnostics({connection, packageId, runId, boundary: 'full-session'});
      await writeNativeUpdateDiagnostics({connection, packageId, runId});
      throw error;
    } finally {
      if (hotRequestTimeout !== undefined) clearTimeout(hotRequestTimeout);
      releaseHotSourceResponse();
    }

    let hotSession: Awaited<ReturnType<typeof waitForAutomationSession>>;
    try {
      hotSession = await waitForAutomationSession(
        connection.driver,
        value =>
          value.appName === sample.appName &&
          value.sessionId !== initial!.sessionId &&
          value.sessionId !== fullSession.sessionId,
        180_000,
      );
    } catch (error) {
      await writeAndroidFailureDiagnostics({connection, packageId, runId, boundary: 'hot-session'});
      await writeUpdateStateDiagnostics(connection.driver, fullSession.sessionId, runId);
      await writeNativeUpdateDiagnostics({connection, packageId, runId});
      throw error;
    }
    const finalActual = await readSelector(
      connection.driver,
      hotSession.sessionId,
      'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
      [],
    );
    if (selectedSample === 'wallpaper' && updateCase !== 'update.boot-guard') {
      await waitForWallpaperAssets(connection.driver, hotSession.sessionId, 'hot');
    }
    expect(finalActual).toMatchObject({
      applicationId: packageId,
      nativeBuildNumber: hot.nativeBuildNumber,
      bundleVersion: hot.bundleVersion,
      publicationId: hot.publicationId,
      entryKind: 'hot',
    });
      if (updateCase === 'update.compatibility') {
        expect(finalActual).toMatchObject({bundleVersion: '1.0.6'});
        if (assertCompatibilityDataReadback === undefined)
          throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_ORACLE_MISSING');
        await assertCompatibilityDataReadback(hotSession.sessionId, 'hot-six');
        const completedTask = await waitForSelector(
          connection.driver,
          hotSession.sessionId,
          'kernel.base.terminal-update.selectTerminalUpdateTask',
          [],
          value =>
            isRecord(value) &&
            value.target !== null &&
            typeof value.target === 'object' &&
            'ruleRef' in value.target &&
            value.target.ruleRef === `automation-${runId}` &&
            (value.phase === 'succeeded' || value.phase === 'failed' || value.phase === 'unknown'),
          30_000,
        );
        if (completedTask === null) {
          await writeUpdateStateDiagnostics(connection.driver, hotSession.sessionId, runId);
          await writeNativeUpdateDiagnostics({connection, packageId, runId});
          throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_TASK_TERMINAL_STATE_TIMEOUT');
        }
        if (!isRecord(completedTask) || completedTask.phase !== 'succeeded') {
          await writeUpdateStateDiagnostics(connection.driver, hotSession.sessionId, runId);
          await writeNativeUpdateDiagnostics({connection, packageId, runId});
        }
        expect(completedTask).toMatchObject({target: {ruleRef: `automation-${runId}`}, phase: 'succeeded'});
        const completedStatus = await readSelector(
          connection.driver,
          hotSession.sessionId,
          'kernel.base.terminal-update.selectTerminalUpdateRecentStatus',
          [],
        );
        expect(completedStatus).toMatchObject({state: 'succeeded'});
        process.stdout.write(
          `TERMINAL_AUTOMATION_UPDATE_COMPATIBILITY_TASK run=${runId} stage=hot-six state=succeeded\n`,
        );
        const externalFull = readArtifact('compatibility-external-full.json');
      if (externalFull.apk === undefined || externalFull.nativeBuildNumber <= hot.nativeBuildNumber)
        throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_EXTERNAL_APK_INVALID');
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_COMPATIBILITY_STAGE run=${runId} stage=external-apk-replace action=force-stop\n`,
      );
      await connection.forceStop(packageId);
      await connection.install(path.join(runDirectory, 'update', appName, externalFull.apk.path));
      if (!(await connection.isInstalled(packageId)))
        throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_EXTERNAL_APK_INSTALL_READBACK_FAILED');
      await connection.launch(`${packageId}/${sample.applicationId}.MainActivity`);
      const externalSession = await waitForAutomationSession(
        connection.driver,
        value => value.appName === sample.appName && value.sessionId !== hotSession.sessionId,
        90_000,
      );
      initial = externalSession;
      const externalActual = await readSelector(
        connection.driver,
        externalSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
        [],
      );
      expect(externalActual).toMatchObject({
        applicationId: packageId,
        nativeBuildNumber: externalFull.nativeBuildNumber,
        bundleVersion: externalFull.bundleVersion,
        publicationId: externalFull.publicationId,
        entryKind: 'embedded',
      });
      if (assertCompatibilityDataReadback === undefined)
        throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_ORACLE_MISSING');
      await assertCompatibilityDataReadback(externalSession.sessionId, 'external-apk-embedded');
      const externalBootLog = await connection.readTerminalUpdateLogs(packageId);
      expect(externalBootLog).toContain(
        'event=boot-reserved entryKind=embedded apkChanged=true resetReason=APK_CHANGED_SELECTION_RESET previousEligible=false candidateEligible=false',
      );
      expect(
        await waitForSelector(
          connection.driver,
          externalSession.sessionId,
          'kernel.base.terminal-update.selectTerminalUpdateTask',
          [],
          value => value === null,
          20_000,
        ),
      ).toBeNull();
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_COMPATIBILITY_STAGE run=${runId} stage=external-apk-embedded data=preserved reset=APK_CHANGED_SELECTION_RESET\n`,
      );
      process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS case=update.compatibility run=${runId}\n`);
      expect(install.nativeBuildNumber).toBeLessThan(full.nativeBuildNumber);
      return;
    }
    expect(install.nativeBuildNumber).toBeLessThan(full.nativeBuildNumber);

    if (updateCase === 'update.boot-guard') {
      const candidateStatus = await readSelector(
        connection.driver,
        hotSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateRecentStatus',
        [],
      );
      // recentStatus is the last persisted update action and may still describe
      // the preceding FULL install while the HOT candidate has not reached
      // PRIMARY real-ready. Record it for diagnosis, but prove rollback from the
      // native deadline and embedded readback below instead of treating this
      // cross-stage snapshot as the candidate's boot-confirmation oracle.
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_BOOT_GUARD_PRIOR_STATUS run=${runId} state=${isRecord(candidateStatus) ? String(candidateStatus.state ?? 'UNKNOWN') : 'INVALID'} taskIdPresent=${isRecord(candidateStatus) && typeof candidateStatus.taskId === 'string' ? 1 : 0}\n`,
      );
      const injectedFailureDiagnostics = (await connection.readRuntimeFailureDiagnostics(packageId))
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as Readonly<Record<string, unknown>>);
      expect(injectedFailureDiagnostics).toContainEqual(
        expect.objectContaining({
          category: 'runtime.system-failure',
          event: 'runtime.system-failure.debug-injection-resolution',
          ownerId: 'surface-content',
          source: 'build-time',
          outcome: 'matched',
          buildMarker: 'TER_DEBUG_FAILURE_INJECTION_BUNDLE_MARKER_SURFACE_CONTENT',
        }),
      );
      expect(injectedFailureDiagnostics).not.toContainEqual(
        expect.objectContaining({
          category: 'runtime.system-failure',
          event: 'runtime.system-failure.debug-injection-resolution',
          ownerId: 'surface-layers',
          source: 'build-time',
          outcome: 'matched',
        }),
      );
      expect(injectedFailureDiagnostics).toContainEqual(
        expect.objectContaining({
          category: 'runtime.system-failure',
          event: 'runtime.system-failure.render-failed',
          ownerId: 'surface-content',
        }),
      );
      const injectionResolutionIndex = injectedFailureDiagnostics.findIndex(
        diagnostic =>
          diagnostic.event === 'runtime.system-failure.debug-injection-resolution' &&
          diagnostic.ownerId === 'surface-content' &&
          diagnostic.source === 'build-time' &&
          diagnostic.outcome === 'matched',
      );
      const contentFailureIndex = injectedFailureDiagnostics.findIndex(
        diagnostic =>
          diagnostic.event === 'runtime.system-failure.render-failed' && diagnostic.ownerId === 'surface-content',
      );
      expect(injectionResolutionIndex).toBeGreaterThanOrEqual(0);
      expect(contentFailureIndex).toBeGreaterThan(injectionResolutionIndex);
      const recoveredSession = await waitForAutomationSession(
        connection.driver,
        value => value.appName === sample.appName && value.sessionId !== hotSession.sessionId,
        90_000,
      );
      const recoveredActual = await readSelector(
        connection.driver,
        recoveredSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
        [],
      );
      expect(recoveredActual).toMatchObject({
        applicationId: packageId,
        nativeBuildNumber: full.nativeBuildNumber,
        bundleVersion: full.bundleVersion,
        entryKind: 'embedded',
      });
      const recoveredStatus = await waitForSelector(
        connection.driver,
        recoveredSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateRecentStatus',
        [],
        value => isRecord(value) && value.state === 'failed' && value.reason === 'HOT_BOOT_TIMEOUT',
        15_000,
      );
      expect(recoveredStatus).toMatchObject({state: 'failed', reason: 'HOT_BOOT_TIMEOUT'});
      const nativeLog = await connection.readTerminalUpdateLogs(packageId);
      expect(nativeLog).toContain('event=hot-boot-timeout-recovery entryKind=embedded');
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_BOOT_GUARD run=${runId} entryKind=embedded nativeBuild=${full.nativeBuildNumber} reason=HOT_BOOT_TIMEOUT\n`,
      );
      process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS case=update.boot-guard run=${runId}\n`);
      return;
    }
    const task = await readSelector(
      connection.driver,
      hotSession.sessionId,
      'kernel.base.terminal-update.selectTerminalUpdateTask',
      [],
    );
    if (!isRecord(task) || task.phase !== 'succeeded') {
      await writeUpdateStateDiagnostics(connection.driver, hotSession.sessionId, runId);
      await writeNativeUpdateDiagnostics({connection, packageId, runId});
    }
    expect(task).toMatchObject({target: {ruleRef: `automation-${runId}`}, phase: 'succeeded'});
    const status = await readSelector(
      connection.driver,
      hotSession.sessionId,
      'kernel.base.terminal-update.selectTerminalUpdateRecentStatus',
      [],
    );
    expect(status).toMatchObject({state: 'succeeded'});
  },
  90 * 60 * 1000,
);
