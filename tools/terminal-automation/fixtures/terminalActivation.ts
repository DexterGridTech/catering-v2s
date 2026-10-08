import {randomUUID} from 'node:crypto';
import {lstatSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import type {AutomationDriverServer} from '../src/server.js';
import {subscribeSelector} from '../src/selectorObservation.js';
import type {TerminalAutomationShape, TerminalSeedFixture} from './terminal.js';
import {readTerminalSeedFixture} from './terminal.js';
import {createOperationsFixtureClient} from '../../../apps/terminal/kernel/base/terminal-data-client/acceptance/operationsFixture.ts';

const activationSelector = 'ui.base.terminal-activation.selectActivationStatusView';
const activationCommand = 'kernel.base.terminal-data-client.activate-terminal';

type ManagedBinding = Readonly<{
  readonly name: string;
  readonly terminalRef: string;
  readonly storeRef: string;
  readonly bindingStatus: 'UNBOUND' | 'ACTIVE' | 'ENDED';
  readonly generation: number | null;
  readonly boundDeviceId: string | null;
}>;

export type TerminalActivationIdentity = Readonly<{
  readonly seedKey: TerminalSeedFixture['seedKey'];
  readonly terminalRef: string;
  readonly storeRef: string;
  readonly deviceId: string;
  readonly bindingGeneration: number;
}>;

type TerminalActivationIntent = Readonly<{
  readonly managedDevRunId: string;
  readonly seedKey: TerminalSeedFixture['seedKey'];
  readonly terminalRef: string;
  readonly storeRef: string;
  readonly deviceId: string;
}>;

const managedRunDirectory = (repositoryRoot: string, runId: string): string => {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(runId)) throw new Error('TERMINAL_AUTOMATION_RUN_ID_INVALID');
  const root = realpathSync(repositoryRoot);
  const runsRoot = realpathSync(path.join(root, '.runtime/terminal-automation'));
  const runDirectory = realpathSync(path.join(runsRoot, runId));
  const relative = path.relative(runsRoot, runDirectory);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('TERMINAL_AUTOMATION_FIXTURE_INTENT_PATH_INVALID');
  }
  return runDirectory;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJsonRecord = (filePath: string, parentDirectory: string): Record<string, unknown> | undefined => {
  try {
    const stat = lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) return undefined;
    const resolvedParent = realpathSync(parentDirectory);
    const resolvedFile = realpathSync(filePath);
    if (path.dirname(resolvedFile) !== resolvedParent) return undefined;
    const parsed: unknown = JSON.parse(readFileSync(resolvedFile, 'utf8'));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const remoteBootId = (manifest: Record<string, unknown>): string | undefined => {
  const resources = manifest.remoteResources;
  if (isRecord(resources) && typeof resources.bootId === 'string') return resources.bootId;
  const readiness = manifest.readiness;
  if (!isRecord(readiness) || !isRecord(readiness.remoteJava)) return undefined;
  const identity = readiness.remoteJava.remoteIdentity;
  return isRecord(identity) && typeof identity.bootId === 'string' ? identity.bootId : undefined;
};

export const isSameManagedDevDataPlane = (previous: unknown, current: unknown): boolean => {
  if (!isRecord(previous) || !isRecord(current)) return false;
  const previousTrust = previous.remoteHostTrust;
  const currentTrust = current.remoteHostTrust;
  const previousTopology = previous.topology;
  const currentTopology = current.topology;
  return (
    previous.kind === 'r5-dev-run-manifest' &&
    current.kind === 'r5-dev-run-manifest' &&
    typeof previous.runId === 'string' &&
    typeof current.runId === 'string' &&
    typeof previous.database === 'string' &&
    previous.database === current.database &&
    isRecord(previousTrust) &&
    isRecord(currentTrust) &&
    previousTrust.host === currentTrust.host &&
    previousTrust.fingerprint === currentTrust.fingerprint &&
    previousTrust.allowlistVersion === currentTrust.allowlistVersion &&
    isRecord(previousTopology) &&
    isRecord(currentTopology) &&
    previousTopology.java === currentTopology.java &&
    previousTopology.tds === currentTopology.tds &&
    previousTopology.haproxy === currentTopology.haproxy &&
    previousTopology.database === currentTopology.database &&
    previousTopology.tunnel === currentTopology.tunnel &&
    remoteBootId(previous) !== undefined &&
    remoteBootId(previous) === remoteBootId(current)
  );
};

const responseResult = (message: {type: string; body: unknown}): unknown => {
  if (message.type !== 'response' || !isRecord(message.body) || !('result' in message.body)) {
    throw new Error('TERMINAL_AUTOMATION_RUNTIME_RESPONSE_INVALID');
  }
  return message.body.result;
};

const waitForMessage = (
  driver: AutomationDriverServer,
  sessionId: string,
  matches: (message: {type: string; body: unknown}) => boolean,
  timeoutMs: number,
): Promise<{type: string; body: unknown}> =>
  new Promise((resolve, reject) => {
    let unsubscribe = (): void => undefined;
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('TERMINAL_AUTOMATION_RUNTIME_OBSERVATION_TIMEOUT'));
    }, timeoutMs);
    unsubscribe = driver.onMessage(sessionId, message => {
      if (!matches(message)) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(message);
    });
  });

const activeViewMatches = (
  value: unknown,
  fixture: TerminalSeedFixture,
  deviceId: string,
): value is Record<string, unknown> => {
  if (!isRecord(value) || value.currentPeerValue !== true || !isRecord(value.activation)) return false;
  return (
    value.activation.status === 'active' &&
    typeof value.activation.terminalRef === 'string' &&
    typeof value.activation.storeRef === 'string' &&
    value.activation.terminalRef.length > 0 &&
    value.activation.storeRef.length > 0 &&
    fixture.activationCode.length === 8 &&
    deviceId.length > 0
  );
};

export const isTerminalActivationCommandSucceeded = (result: unknown): boolean => {
  if (!isRecord(result) || result.status !== 'completed' || !Array.isArray(result.actorResults)) return false;
  const first = result.actorResults[0];
  return isRecord(first) && isRecord(first.result) && first.result.status === 'activated';
};

export const writeTerminalActivationIntent = (
  repositoryRoot: string,
  runId: string,
  intent: TerminalActivationIntent,
): void => {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(runId) || !/^[A-Za-z0-9._-]{1,96}$/u.test(intent.managedDevRunId)) {
    throw new Error('TERMINAL_AUTOMATION_FIXTURE_INTENT_ID_INVALID');
  }
  const runDirectory = managedRunDirectory(repositoryRoot, runId);
  const destination = path.join(runDirectory, 'fixture-intent.json');
  try {
    lstatSync(destination);
    throw new Error('TERMINAL_AUTOMATION_FIXTURE_INTENT_ALREADY_EXISTS');
  } catch (error) {
    if (error instanceof Error && error.message === 'TERMINAL_AUTOMATION_FIXTURE_INTENT_ALREADY_EXISTS') throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  writeFileSync(destination, `${JSON.stringify(intent)}\n`, {mode: 0o600, flag: 'wx'});
};

export const writeTerminalActivationCompletion = (
  repositoryRoot: string,
  runId: string,
  identity: TerminalActivationIdentity,
): void => {
  const runDirectory = managedRunDirectory(repositoryRoot, runId);
  const intentPath = path.join(runDirectory, 'fixture-intent.json');
  const intentStat = lstatSync(intentPath);
  if (!intentStat.isFile() || intentStat.isSymbolicLink())
    throw new Error('TERMINAL_AUTOMATION_FIXTURE_INTENT_INVALID');
  const intent: unknown = JSON.parse(readFileSync(intentPath, 'utf8'));
  if (
    !isRecord(intent) ||
    intent.seedKey !== identity.seedKey ||
    intent.terminalRef !== identity.terminalRef ||
    intent.storeRef !== identity.storeRef ||
    intent.deviceId !== identity.deviceId ||
    typeof intent.managedDevRunId !== 'string'
  ) {
    throw new Error('TERMINAL_AUTOMATION_FIXTURE_INTENT_MISMATCH');
  }
  const temporaryPath = path.join(runDirectory, 'fixture-intent.completed.tmp');
  try {
    writeFileSync(temporaryPath, `${JSON.stringify({...intent, bindingGeneration: identity.bindingGeneration})}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
    renameSync(temporaryPath, intentPath);
  } finally {
    try {
      unlinkSync(temporaryPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
};

const readPriorFixtureManifests = (repositoryRoot: string): readonly Record<string, unknown>[] => {
  const root = realpathSync(repositoryRoot);
  const runsRootPath = path.join(root, '.runtime/terminal-automation');
  const runsRootStat = lstatSync(runsRootPath);
  if (!runsRootStat.isDirectory() || runsRootStat.isSymbolicLink()) {
    throw new Error('TERMINAL_AUTOMATION_RUN_ROOT_INVALID');
  }
  const runsRoot = realpathSync(runsRootPath);
  const relativeRoot = path.relative(root, runsRoot);
  if (relativeRoot === '..' || relativeRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeRoot)) {
    throw new Error('TERMINAL_AUTOMATION_RUN_ROOT_INVALID');
  }
  const manifests: Record<string, unknown>[] = [];
  for (const entry of readdirSync(runsRoot, {withFileTypes: true})) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(entry.name))
      continue;
    const directory = path.join(runsRoot, entry.name);
    const manifestPath = path.join(directory, 'run-manifest.json');
    try {
      const directoryStat = lstatSync(directory);
      const manifestStat = lstatSync(manifestPath);
      if (
        !directoryStat.isDirectory() ||
        directoryStat.isSymbolicLink() ||
        !manifestStat.isFile() ||
        manifestStat.isSymbolicLink()
      )
        continue;
      const resolvedDirectory = realpathSync(directory);
      const resolvedManifest = realpathSync(manifestPath);
      if (path.dirname(resolvedManifest) !== resolvedDirectory) continue;
      const parsed: unknown = JSON.parse(readFileSync(resolvedManifest, 'utf8'));
      if (isRecord(parsed) && parsed.kind === 'terminal-automation-run-manifest' && parsed.runId === entry.name) {
        manifests.push(parsed);
      }
    } catch {
      continue;
    }
  }
  return manifests;
};

export const priorManifestOwnsActiveBinding = (
  repositoryRoot: string,
  input: Readonly<{
    readonly managedDevRunId: string;
    readonly fixture: TerminalSeedFixture;
    readonly terminalRef: string;
    readonly storeRef: string;
    readonly binding: ManagedBinding;
    readonly appDeviceId: string;
    readonly androidDeviceSerial?: string;
  }>,
): Readonly<{owned: boolean; evidence: string}> => {
  const root = realpathSync(repositoryRoot);
  const runtimeRoot = path.join(root, '.runtime', 'r5');
  try {
    const runtimeRootStat = lstatSync(runtimeRoot);
    if (!runtimeRootStat.isDirectory() || runtimeRootStat.isSymbolicLink()) {
      return {owned: false, evidence: 'runtimeRoot=invalid'};
    }
  } catch {
    return {owned: false, evidence: 'runtimeRoot=missing'};
  }
  const currentDevPath = path.join(runtimeRoot, 'run-manifest.json');
  const currentDevManifest = readJsonRecord(currentDevPath, runtimeRoot);
  if (
    currentDevManifest === undefined ||
    currentDevManifest.kind !== 'r5-dev-run-manifest' ||
    currentDevManifest.runId !== input.managedDevRunId
  ) {
    return {owned: false, evidence: 'currentDevManifest=unmatched'};
  }
  const candidates = readPriorFixtureManifests(repositoryRoot).flatMap(manifest => {
    const managedDev = manifest.managedDev;
    const fixture = manifest.fixture;
    const execution = manifest.execution;
    if (!isRecord(managedDev) || !isRecord(fixture)) return [];
    if (typeof managedDev.runId !== 'string') return [];
    const priorDevManifest =
      managedDev.runId === input.managedDevRunId
        ? currentDevManifest
        : readJsonRecord(path.join(runtimeRoot, `terminal-${managedDev.runId}.json`), runtimeRoot);
    const fixtureIdentityMatchesCurrent =
      fixture.activationIntent === true &&
      fixture.seedKey === input.fixture.seedKey &&
      fixture.terminalRef === input.terminalRef &&
      fixture.storeRef === input.storeRef;
    if (!fixtureIdentityMatchesCurrent) return [];
    const sameDataPlane =
      priorDevManifest !== undefined &&
      priorDevManifest.runId === managedDev.runId &&
      priorDevManifest.kind === 'r5-dev-run-manifest' &&
      isSameManagedDevDataPlane(priorDevManifest, currentDevManifest);
    if (!sameDataPlane) return [];
    const exactOwner =
      fixture.deviceId === input.binding.boundDeviceId && fixture.bindingGeneration === input.binding.generation;
    const legacyOwner =
      manifest.business === 'FAIL' &&
      fixture.bindingGeneration === undefined &&
      input.androidDeviceSerial !== undefined &&
      isRecord(execution) &&
      execution.platform === 'android' &&
      execution.deviceSerial === input.androidDeviceSerial &&
      input.appDeviceId === input.binding.boundDeviceId;
    return [{exactOwner, legacyOwner}];
  });
  const exactMatches = candidates.filter(candidate => candidate.exactOwner);
  const legacyMatches = candidates.filter(candidate => candidate.legacyOwner);
  const matches = exactMatches.length > 0 ? exactMatches : legacyMatches;
  return {
    owned: matches.length === 1,
    evidence: `prior=${candidates.length} exactGeneration=${exactMatches.length} legacyAndroid=${legacyMatches.length} currentGeneration=${input.binding.generation}`,
  };
};

export const ensureTerminalActivated = async (
  input: Readonly<{
    readonly repositoryRoot: string;
    readonly shape: TerminalAutomationShape;
    readonly deviceId: string;
    readonly androidDeviceSerial?: string;
    readonly httpBaseUrl: string;
    readonly operationsPassword: string;
    readonly managedDevRunId: string;
    readonly sessionId: string;
    readonly driver: AutomationDriverServer;
    readonly readManagedBindings: (terminalName: string) => Promise<readonly ManagedBinding[]>;
    readonly onActivationIntent: (identity: Omit<TerminalActivationIdentity, 'bindingGeneration'>) => Promise<void>;
    readonly onActivationComplete: (identity: TerminalActivationIdentity) => Promise<void>;
  }>,
): Promise<TerminalActivationIdentity> => {
  if (!/^[A-Za-z0-9:._-]{1,128}$/u.test(input.deviceId)) {
    throw new Error('TERMINAL_AUTOMATION_DEVICE_ID_INVALID');
  }
  const fixture = readTerminalSeedFixture(input.repositoryRoot, input.shape);
  const operations = createOperationsFixtureClient({
    httpBaseUrl: input.httpBaseUrl,
    workspaceKey: 'aurora',
    storeCode: 'S-OP',
    loginName: 'r5-account-multi-role',
    password: input.operationsPassword,
    fixtures: [fixture],
  });
  const session = await operations.operationsSession();
  let terminal = await operations.operationsTerminal(session, 0);
  let before = await input.readManagedBindings(fixture.name);
  if (
    before.length !== 1 ||
    before[0]?.name !== fixture.name ||
    before[0].terminalRef !== terminal.terminalRef ||
    before[0].storeRef !== session.storeRef
  ) {
    throw new Error('TERMINAL_AUTOMATION_FIXTURE_IDENTITY_MISMATCH');
  }

  if (terminal.binding?.status === 'ACTIVE') {
    const binding = before[0];
    const ownership = priorManifestOwnsActiveBinding(input.repositoryRoot, {
      managedDevRunId: input.managedDevRunId,
      fixture,
      terminalRef: terminal.terminalRef,
      storeRef: session.storeRef,
      binding,
      appDeviceId: input.deviceId,
      ...(input.androidDeviceSerial === undefined ? {} : {androidDeviceSerial: input.androidDeviceSerial}),
    });
    if (binding.bindingStatus !== 'ACTIVE' || terminal.binding.generation !== binding.generation || !ownership.owned) {
      throw new Error(`TERMINAL_AUTOMATION_ACTIVE_FIXTURE_OWNER_UNPROVEN ${ownership.evidence}`);
    }
    terminal = await operations.cancelByOperations(session, terminal);
    before = await input.readManagedBindings(fixture.name);
    if (
      terminal.binding?.status !== 'INACTIVE' ||
      before.length !== 1 ||
      before[0]?.bindingStatus === 'ACTIVE' ||
      before[0]?.boundDeviceId !== null
    ) {
      throw new Error('TERMINAL_AUTOMATION_OWNED_FIXTURE_CANCEL_READBACK_FAILED');
    }
  } else if (terminal.binding?.status !== 'INACTIVE' || before[0]?.bindingStatus === 'ACTIVE') {
    throw new Error('TERMINAL_AUTOMATION_FIXTURE_NOT_INACTIVE');
  }

  const identity = Object.freeze({
    seedKey: fixture.seedKey,
    terminalRef: terminal.terminalRef,
    storeRef: session.storeRef,
    deviceId: input.deviceId,
  });
  await input.onActivationIntent(identity);

  let activationObservation: Awaited<ReturnType<typeof subscribeSelector>> | undefined;
  let releaseFailed = false;
  try {
    activationObservation = await subscribeSelector(input.driver, input.sessionId, activationSelector, []);
    const requestId = `req_${Date.now().toString(36)}_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const commandResult = waitForMessage(
      input.driver,
      input.sessionId,
      message =>
        isRecord(message.body) && message.body.kind === 'command.result' && message.body.requestId === requestId,
      30_000,
    );
    const accepted = responseResult(
      await input.driver.request(input.sessionId, 'command.dispatch', {
        commandName: activationCommand,
        payload: {activationCode: fixture.activationCode},
        requestId,
      }),
    );
    if (!isRecord(accepted) || accepted.requestId !== requestId || accepted.accepted !== true) {
      throw new Error('TERMINAL_AUTOMATION_ACTIVATION_COMMAND_NOT_ACCEPTED');
    }
    const completion = await commandResult;
    if (
      !isRecord(completion.body) ||
      !isRecord(completion.body.result) ||
      completion.body.result.status !== 'completed'
    ) {
      throw new Error('TERMINAL_AUTOMATION_ACTIVATION_COMMAND_FAILED');
    }
    const actorResults = completion.body.result.actorResults;
    const activationActorResult =
      Array.isArray(actorResults) && isRecord(actorResults[0]) && isRecord(actorResults[0].result)
        ? actorResults[0].result
        : undefined;
    if (!isTerminalActivationCommandSucceeded(completion.body.result)) {
      const dispatchResult = completion.body.result;
      const actorList = Array.isArray(actorResults) ? actorResults : undefined;
      const actorStatus =
        actorList
          ?.map(actor =>
            isRecord(actor)
              ? `${typeof actor.status === 'string' ? actor.status : 'NO_STATUS'}:${
                  isRecord(actor.result) && typeof actor.result.status === 'string'
                    ? actor.result.status
                    : 'NO_RESULT_STATUS'
                }`
              : 'INVALID_ACTOR',
          )
          .join(',') ?? 'MISSING';
      const reason =
        activationActorResult !== undefined && typeof activationActorResult.reason === 'string'
          ? /^[A-Z0-9_]{1,64}$/u.test(activationActorResult.reason)
            ? activationActorResult.reason
            : 'UNRECOGNIZED_REASON'
          : activationActorResult !== undefined && typeof activationActorResult.errorCode === 'string'
            ? /^[A-Z0-9_]{1,96}$/u.test(activationActorResult.errorCode)
              ? activationActorResult.errorCode
              : 'UNRECOGNIZED_ERROR_CODE'
            : activationActorResult !== undefined && typeof activationActorResult.code === 'string'
              ? /^[A-Z0-9_]{1,96}$/u.test(activationActorResult.code)
                ? activationActorResult.code
                : 'UNRECOGNIZED_CODE'
              : activationActorResult !== undefined && typeof activationActorResult.kind === 'string'
                ? /^[a-z-]{1,48}$/u.test(activationActorResult.kind)
                  ? activationActorResult.kind
                  : 'UNRECOGNIZED_KIND'
                : activationActorResult !== undefined && typeof activationActorResult.status === 'string'
                  ? activationActorResult.status
                  : 'MISSING_ACTOR_RESULT';
      process.stdout.write(
        `TERMINAL_AUTOMATION_ACTIVATION_COMMAND_REJECTED run=${input.managedDevRunId} ` +
          `reason=${reason} dispatchStatus=${String(dispatchResult.status)} ` +
          `resultKeys=${Object.keys(dispatchResult).sort().join(',') || 'NONE'} ` +
          `actorCount=${Array.isArray(actorResults) ? actorResults.length : 'MISSING'} ` +
          `actorStatuses=${actorStatus || 'NONE'}\n`,
      );
      throw new Error('TERMINAL_AUTOMATION_ACTIVATION_COMMAND_REJECTED');
    }
    const selected = await activationObservation
      .waitFor(value => activeViewMatches(value, fixture, input.deviceId), 30_000)
      .catch(async error => {
        const current = activationObservation?.current;
        const status = isRecord(current) && isRecord(current.activation) ? current.activation.status : 'unknown';
        const peerCurrent = isRecord(current) ? current.currentPeerValue === true : false;
        process.stdout.write(
          `TERMINAL_AUTOMATION_ACTIVATION_SELECTOR_TIMEOUT run=${input.managedDevRunId} ` +
            `initialStatus=${String(status)} initialPeerCurrent=${peerCurrent ? 1 : 0}\n`,
        );
        throw error;
      });
    if (!isRecord(selected) || !isRecord(selected.activation)) {
      throw new Error('TERMINAL_AUTOMATION_ACTIVATION_SELECTOR_VALUE_INVALID');
    }
    const activation = selected.activation;
    if (
      activation.terminalRef !== terminal.terminalRef ||
      activation.storeRef !== session.storeRef ||
      typeof activation.bindingGeneration !== 'number' ||
      !Number.isSafeInteger(activation.bindingGeneration)
    ) {
      throw new Error('TERMINAL_AUTOMATION_ACTIVATION_SELECTOR_BINDING_MISMATCH');
    }
    const after = await input.readManagedBindings(fixture.name);
    const binding = after[0];
    if (
      after.length !== 1 ||
      binding?.bindingStatus !== 'ACTIVE' ||
      binding.terminalRef !== terminal.terminalRef ||
      binding.storeRef !== session.storeRef ||
      binding.boundDeviceId !== input.deviceId ||
      binding.generation !== activation.bindingGeneration
    ) {
      throw new Error('TERMINAL_AUTOMATION_ACTIVATION_READBACK_MISMATCH');
    }
    if (typeof binding.generation !== 'number') throw new Error('TERMINAL_AUTOMATION_ACTIVATION_GENERATION_MISSING');
    const completed = Object.freeze({...identity, bindingGeneration: binding.generation});
    await input.onActivationComplete(completed);
    return completed;
  } finally {
    if (activationObservation !== undefined) {
      try {
        await activationObservation.close();
      } catch {
        releaseFailed = true;
      }
    }
    if (releaseFailed) throw new Error('TERMINAL_AUTOMATION_ACTIVATION_SELECTOR_CLEANUP_FAILED');
  }
};
