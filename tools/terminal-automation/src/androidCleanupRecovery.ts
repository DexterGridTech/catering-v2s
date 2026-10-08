import {lstatSync, readFileSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {androidAutomationBuildIdentity} from './androidBuild.ts';

export type FailedAndroidRunCleanupTarget = Readonly<{
  readonly runId: string;
  readonly packageId: string;
  readonly serial: string;
  readonly sample: 'console' | 'wallpaper';
  readonly shape: 'mobile' | 'dual';
  readonly reverses: readonly Readonly<{readonly remote: string; readonly local: string}>[];
  readonly legacyRecoverableRemotes: readonly string[];
}>;

export type FailedAndroidPackageCleanupPort = Readonly<{
  readonly deviceSerial: string;
  readonly isInstalled: (packageId: string) => Promise<boolean>;
  readonly forceStop: (packageId: string) => Promise<void>;
  readonly uninstall: (packageId: string) => Promise<void>;
}>;

export type FailedAndroidReverseCleanupPort = Readonly<{
  readonly deviceSerial: string;
  readonly list: () => Promise<readonly Readonly<{readonly remote: string; readonly local: string}>[]>;
  readonly isLocalPortListening: (port: number) => Promise<boolean>;
  readonly remove: (remote: string) => Promise<void>;
}>;

export const parseAndroidReverseList = (
  output: string,
): readonly Readonly<{readonly remote: string; readonly local: string}>[] => {
  const result: Array<Readonly<{readonly remote: string; readonly local: string}>> = [];
  for (const line of output.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/u);
    if (
      parts.length !== 3 ||
      !/^[A-Za-z0-9._:-]{1,128}$/u.test(parts[0] ?? '') ||
      !/^tcp:[1-9][0-9]{0,4}$/u.test(parts[1] ?? '') ||
      !/^tcp:[1-9][0-9]{0,4}$/u.test(parts[2] ?? '') ||
      Number((parts[1] ?? '').slice(4)) > 65_535 ||
      Number((parts[2] ?? '').slice(4)) > 65_535
    ) {
      fail('TERMINAL_AUTOMATION_RECOVERY_REVERSE_LIST_INVALID');
    }
    result.push(Object.freeze({remote: parts[1]!, local: parts[2]!}));
  }
  return Object.freeze(result);
};

const fail = (code: string): never => {
  throw new Error(code);
};

export const resolveFailedAndroidRunCleanupTarget = (
  repositoryRoot: string,
  runId: string,
  serial: string,
  activeProcessIdentities: readonly Readonly<{readonly pid: number; readonly startToken: string}>[],
): FailedAndroidRunCleanupTarget => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(runId))
    fail('TERMINAL_AUTOMATION_RECOVERY_RUN_ID_INVALID');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(serial)) fail('TERMINAL_AUTOMATION_ANDROID_SERIAL_INVALID');

  const root = realpathSync(repositoryRoot);
  const runtimeRoot = path.join(root, '.runtime');
  const automationRoot = path.join(runtimeRoot, 'terminal-automation');
  const runDirectory = path.join(automationRoot, runId);
  for (const directory of [runtimeRoot, automationRoot, runDirectory]) {
    const stat = lstatSync(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_PATH_INVALID');
  }
  const resolvedRunDirectory = realpathSync(runDirectory);
  if (path.dirname(resolvedRunDirectory) !== realpathSync(automationRoot))
    fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_PATH_INVALID');
  const manifestPath = path.join(resolvedRunDirectory, 'run-manifest.json');
  const manifestStat = lstatSync(manifestPath);
  if (
    !manifestStat.isFile() ||
    manifestStat.isSymbolicLink() ||
    path.dirname(realpathSync(manifestPath)) !== resolvedRunDirectory
  )
    fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_MANIFEST_INVALID');

  let source: unknown;
  try {
    source = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_MANIFEST_INVALID');
  }
  if (typeof source !== 'object' || source === null || Array.isArray(source))
    fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_MANIFEST_INVALID');
  const manifest = source as Record<string, unknown>;
  const execution = manifest.execution;
  const rawProcesses = manifest.processes;
  if (!Array.isArray(rawProcesses)) fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_PROCESS_IDENTITY_INVALID');
  if (
    manifest.kind !== 'terminal-automation-run-manifest' ||
    manifest.runId !== runId ||
    manifest.cleanup !== 'FAIL' ||
    !execution ||
    typeof execution !== 'object' ||
    Array.isArray(execution)
  )
    fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_NOT_RECOVERABLE');

  const runExecution = execution as Record<string, unknown>;
  const sampleValue = runExecution.sample === undefined ? 'console' : runExecution.sample;
  const shapeValue = runExecution.shape;
  const allowedCases = new Set(['update.full-hot', 'update.offline-assets', 'update.boot-guard']);
  const packageId = manifest.androidPackageId;
  if (
    runExecution.platform !== 'android' ||
    runExecution.phase !== 'update' ||
    typeof runExecution.case !== 'string' ||
    !allowedCases.has(runExecution.case) ||
    runExecution.deviceSerial !== serial ||
    (sampleValue !== 'console' && sampleValue !== 'wallpaper') ||
    (shapeValue !== 'mobile' && shapeValue !== 'dual') ||
    typeof packageId !== 'string' ||
    ((sampleValue === 'console' || sampleValue === 'wallpaper') &&
      packageId !== androidAutomationBuildIdentity(runId, sampleValue).packageId)
  )
    fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_IDENTITY_MISMATCH');

  const sample: 'console' | 'wallpaper' = sampleValue === 'wallpaper' ? 'wallpaper' : 'console';
  const shape: 'mobile' | 'dual' = shapeValue === 'dual' ? 'dual' : 'mobile';
  if (typeof packageId !== 'string') fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_IDENTITY_MISMATCH');
  const exactPackageId = packageId as string;
  const eventsPath = path.join(resolvedRunDirectory, 'events.jsonl');
  const logPath = path.join(resolvedRunDirectory, 'runner.log');
  const reverseEvents = new Map<string, Record<string, unknown>>();
  const readLegacyRecoverableRemotes = (): readonly string[] => {
    const logStat = lstatSync(logPath);
    if (!logStat.isFile() || logStat.isSymbolicLink()) fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_LOG_INVALID');
    const log = readFileSync(logPath, 'utf8');
    const hasDriverAndInstallerEvidence =
      log.includes(`TERMINAL_AUTOMATION_DRIVER_STEP run=${runId} step=ui.system.`) &&
      log.includes(`run=${runId} I/TerminalUpdate(`);
    if (!hasDriverAndInstallerEvidence) return Object.freeze([]);
    const managedDev = manifest.managedDev;
    const hasManagedDevIdentity =
      typeof managedDev === 'object' &&
      managedDev !== null &&
      !Array.isArray(managedDev) &&
      typeof (managedDev as Record<string, unknown>).runId === 'string' &&
      typeof (managedDev as Record<string, unknown>).manifestSha256 === 'string';
    return Object.freeze([
      'tcp:19090',
      ...(runExecution.case === 'update.offline-assets' && hasManagedDevIdentity
        ? ['tcp:28080', 'tcp:28180', 'tcp:28181']
        : []),
    ]);
  };
  try {
    const eventStat = lstatSync(eventsPath);
    if (!eventStat.isFile() || eventStat.isSymbolicLink()) fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_EVENT_INVALID');
    for (const line of readFileSync(eventsPath, 'utf8').split(/\r?\n/u)) {
      if (!line) continue;
      let event: unknown;
      try {
        event = JSON.parse(line);
      } catch {
        fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_EVENT_INVALID');
      }
      if (typeof event !== 'object' || event === null || Array.isArray(event)) {
        fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_EVENT_INVALID');
      }
      const value = event as Record<string, unknown>;
      const allowedRemote = ['tcp:19090', 'tcp:28080', 'tcp:28180', 'tcp:28181'].includes(String(value.remote));
      const allowedEvent = [
        'android.reverse.driver.attached',
        'android.reverse.driver.released',
        'android.reverse.managed.attached',
        'android.reverse.managed.released',
      ].includes(String(value.event));
      if (value.runId === runId && value.deviceSerial === serial && allowedRemote && allowedEvent) {
        if (
          typeof value.local !== 'string' ||
          !/^tcp:[1-9][0-9]{0,4}$/u.test(value.local) ||
          Number(value.local.slice(4)) > 65_535
        ) {
          fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_REVERSE_INVALID');
        }
        reverseEvents.set(String(value.remote), value);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const reverses = Object.freeze(
    [...reverseEvents.entries()]
      .filter(
        ([, event]) =>
          event.event === 'android.reverse.driver.attached' || event.event === 'android.reverse.managed.attached',
      )
      .map(([remote, event]) => Object.freeze({remote, local: event.local as string})),
  );
  const legacyRecoverableRemotes = reverseEvents.size === 0 ? readLegacyRecoverableRemotes() : Object.freeze([]);
  const identities = (rawProcesses as unknown[]).flatMap((value: unknown) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
    const process = value as Record<string, unknown>;
    return Number.isSafeInteger(process.pid) && typeof process.startToken === 'string'
      ? [{pid: Number(process.pid), startToken: process.startToken}]
      : [];
  });
  if (identities.length === 0 || identities.length !== (rawProcesses as unknown[]).length)
    fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_PROCESS_IDENTITY_INVALID');
  if (
    identities.some((identity: Readonly<{pid: number; startToken: string}>) =>
      activeProcessIdentities.some(active => active.pid === identity.pid && active.startToken === identity.startToken),
    )
  )
    fail('TERMINAL_AUTOMATION_RECOVERY_SOURCE_RUN_STILL_ACTIVE');

  return Object.freeze({
    runId,
    packageId: exactPackageId,
    serial,
    sample,
    shape,
    reverses,
    legacyRecoverableRemotes,
  });
};

export const cleanupFailedAndroidRunPackage = async (
  target: FailedAndroidRunCleanupTarget,
  port: FailedAndroidPackageCleanupPort,
): Promise<Readonly<{readonly wasInstalled: boolean; readonly isAbsent: true}>> => {
  if (port.deviceSerial !== target.serial) fail('TERMINAL_AUTOMATION_RECOVERY_DEVICE_IDENTITY_MISMATCH');
  const wasInstalled = await port.isInstalled(target.packageId);
  if (wasInstalled) {
    await port.forceStop(target.packageId);
    await port.uninstall(target.packageId);
  }
  if (await port.isInstalled(target.packageId)) fail('TERMINAL_AUTOMATION_RECOVERY_PACKAGE_READBACK_FAILED');
  return Object.freeze({wasInstalled, isAbsent: true});
};

export const cleanupFailedAndroidRunReverses = async (
  target: FailedAndroidRunCleanupTarget,
  port: FailedAndroidReverseCleanupPort,
): Promise<Readonly<{readonly removed: readonly string[]; readonly readback: 'ABSENT'}>> => {
  if (port.deviceSerial !== target.serial) fail('TERMINAL_AUTOMATION_RECOVERY_DEVICE_IDENTITY_MISMATCH');
  const mappings = await port.list();
  const expected = new Map<string, string | null>(target.reverses.map(mapping => [mapping.remote, mapping.local]));
  for (const remote of target.legacyRecoverableRemotes) expected.set(remote, null);
  const runnerRemotePorts = new Set(['tcp:19090', 'tcp:28080', 'tcp:28180', 'tcp:28181']);
  if (mappings.some(mapping => runnerRemotePorts.has(mapping.remote) && !expected.has(mapping.remote))) {
    fail('TERMINAL_AUTOMATION_RECOVERY_REVERSE_OWNER_UNVERIFIED');
  }
  const removed: string[] = [];
  for (const [remote, expectedLocal] of expected) {
    const matches = mappings.filter(mapping => mapping.remote === remote);
    if (matches.length === 0) continue;
    if (matches.length !== 1 || !/^tcp:[1-9][0-9]{0,4}$/u.test(matches[0]?.local ?? '')) {
      fail('TERMINAL_AUTOMATION_RECOVERY_REVERSE_READBACK_AMBIGUOUS');
    }
    const current = matches[0]!;
    if (expectedLocal !== null && current.local !== expectedLocal) {
      fail('TERMINAL_AUTOMATION_RECOVERY_REVERSE_OWNERSHIP_CHANGED');
    }
    if (expectedLocal === null && !target.legacyRecoverableRemotes.includes(remote)) {
      fail('TERMINAL_AUTOMATION_RECOVERY_REVERSE_OWNER_UNVERIFIED');
    }
    const localPort = Number(current.local.slice('tcp:'.length));
    if (await port.isLocalPortListening(localPort)) fail('TERMINAL_AUTOMATION_RECOVERY_REVERSE_LOCAL_OWNER_ACTIVE');
    await port.remove(remote);
    removed.push(remote);
    if ((await port.list()).some(mapping => mapping.remote === remote)) {
      fail('TERMINAL_AUTOMATION_RECOVERY_REVERSE_CLEANUP_READBACK_FAILED');
    }
  }
  return Object.freeze({removed: Object.freeze(removed), readback: 'ABSENT'});
};
