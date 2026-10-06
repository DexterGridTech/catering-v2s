import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {lstatSync, mkdirSync, realpathSync, renameSync, unlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';

export type TerminalAutomationProcessIdentity = Readonly<{
  readonly pid: number;
  readonly pgid: number;
  readonly startToken: string;
}>;

export type TerminalAutomationManifest = Readonly<{
  readonly schemaVersion: 1;
  readonly kind: 'terminal-automation-run-manifest';
  readonly runId: string;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly stage: string;
  readonly execution: Readonly<{
    readonly phase: string;
    readonly platform: string;
    readonly shape: string;
    readonly case?: string;
    readonly age?: string;
    readonly sample?: 'console' | 'wallpaper';
    readonly deviceSerial?: string;
    readonly peerDeviceSerial?: string;
  }>;
  readonly owner: TerminalAutomationProcessIdentity;
  readonly processes: readonly TerminalAutomationProcessIdentity[];
  readonly resource?: Readonly<{readonly at: string; readonly ownedTreeRssKiB: number; readonly budgetKiB: number}>;
  readonly logs: readonly string[];
  readonly firstFailure: string | null;
  readonly business: 'NOT_RUN' | 'PASS' | 'FAIL';
  readonly cleanup: 'NOT_RUN' | 'PASS' | 'FAIL';
  readonly androidPackageId?: string;
  readonly managedDev?: Readonly<{readonly runId: string; readonly manifestSha256: string}>;
  readonly fixture?: Readonly<{
    readonly seedKey: 'term-front' | 'term-handheld';
    readonly terminalRef: string;
    readonly storeRef: string;
    readonly deviceId: string;
    readonly activationIntent: boolean;
    readonly bindingGeneration?: number;
  }>;
}>;

export type TerminalAutomationExecution = Readonly<{
  readonly phase: string;
  readonly platform: string;
  readonly shape: string;
  readonly case?: string;
  readonly age?: string;
  readonly sample?: 'console' | 'wallpaper';
  readonly deviceSerial?: string;
  readonly peerDeviceSerial?: string;
}>;

const currentProcessIdentity = (): TerminalAutomationProcessIdentity => {
  const result = spawnSync('ps', ['-o', 'pid=', '-o', 'pgid=', '-o', 'lstart=', '-p', String(process.pid)], {
    encoding: 'utf8',
  });
  const match = result.status === 0 && result.stdout.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/u);
  if (!match) throw new Error('TERMINAL_AUTOMATION_OWNER_PROCESS_IDENTITY_UNAVAILABLE');
  const [, pid, pgid, rawStartToken] = match;
  const startToken = rawStartToken?.trim().replace(/\s+/g, ' ') ?? '';
  if (!startToken || Number(pid) !== process.pid || !Number(pgid)) {
    throw new Error('TERMINAL_AUTOMATION_OWNER_PROCESS_IDENTITY_UNAVAILABLE');
  }
  return Object.freeze({pid: Number(pid), pgid: Number(pgid), startToken});
};

const safeId = (value: string): boolean => /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(value);

export const createManagedRun = (
  repositoryRoot: string,
  execution: TerminalAutomationExecution,
  runId: string = randomUUID(),
): TerminalAutomationManifest => {
  if (!safeId(runId)) throw new Error('TERMINAL_AUTOMATION_RUN_ID_INVALID');
  const root = realpathSync(repositoryRoot);
  const runtimePath = path.join(root, '.runtime');
  mkdirSync(runtimePath, {recursive: true, mode: 0o700});
  const runtimeRoot = realpathSync(runtimePath);
  if (!runtimeRoot.startsWith(`${root}${path.sep}`)) throw new Error('TERMINAL_AUTOMATION_RUNTIME_ROOT_INVALID');
  const automationRoot = path.join(runtimeRoot, 'terminal-automation');
  try {
    const automationRootStat = lstatSync(automationRoot);
    if (automationRootStat.isSymbolicLink() || !automationRootStat.isDirectory()) {
      throw new Error('TERMINAL_AUTOMATION_RUN_ROOT_INVALID');
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'TERMINAL_AUTOMATION_RUN_ROOT_INVALID') throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    mkdirSync(automationRoot, {mode: 0o700});
  }
  const resolvedAutomationRoot = realpathSync(automationRoot);
  const automationRelative = path.relative(runtimeRoot, resolvedAutomationRoot);
  if (
    automationRelative === '..' ||
    automationRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(automationRelative)
  ) {
    throw new Error('TERMINAL_AUTOMATION_RUN_ROOT_INVALID');
  }
  const runDirectory = path.join(resolvedAutomationRoot, runId);
  try {
    lstatSync(runDirectory);
    throw new Error('TERMINAL_AUTOMATION_RUN_IDENTITY_ALREADY_EXISTS');
  } catch (error) {
    if (error instanceof Error && error.message === 'TERMINAL_AUTOMATION_RUN_IDENTITY_ALREADY_EXISTS') throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    mkdirSync(runDirectory, {mode: 0o700});
  }
  const resolvedDirectory = realpathSync(runDirectory);
  const relative = path.relative(resolvedAutomationRoot, resolvedDirectory);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('TERMINAL_AUTOMATION_RUN_ROOT_ESCAPE');
  }
  const owner = currentProcessIdentity();
  const startedAt = new Date().toISOString();
  const manifest: TerminalAutomationManifest = Object.freeze({
    schemaVersion: 1,
    kind: 'terminal-automation-run-manifest',
    runId,
    startedAt,
    updatedAt: startedAt,
    stage: 'CREATED',
    execution: Object.freeze({...execution}),
    owner,
    processes: Object.freeze([owner]),
    logs: Object.freeze([]),
    firstFailure: null,
    business: 'NOT_RUN',
    cleanup: 'NOT_RUN',
  });
  writeFileSync(path.join(resolvedDirectory, 'run-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
    flag: 'wx',
  });
  return manifest;
};

export const persistManagedRun = (repositoryRoot: string, manifest: TerminalAutomationManifest): void => {
  if (!safeId(manifest.runId)) throw new Error('TERMINAL_AUTOMATION_RUN_ID_INVALID');
  const root = realpathSync(repositoryRoot);
  const runtimeRoot = realpathSync(path.join(root, '.runtime'));
  if (!runtimeRoot.startsWith(`${root}${path.sep}`)) throw new Error('TERMINAL_AUTOMATION_RUNTIME_ROOT_INVALID');
  const runDirectory = path.join(runtimeRoot, 'terminal-automation', manifest.runId);
  const resolvedDirectory = realpathSync(runDirectory);
  const relative = path.relative(runtimeRoot, resolvedDirectory);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('TERMINAL_AUTOMATION_RUN_ROOT_ESCAPE');
  }
  const manifestPath = path.join(resolvedDirectory, 'run-manifest.json');
  const manifestStat = lstatSync(manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) {
    throw new Error('TERMINAL_AUTOMATION_MANIFEST_PATH_INVALID');
  }
  const temporaryPath = path.join(resolvedDirectory, `.run-manifest.${process.pid}.tmp`);
  try {
    writeFileSync(temporaryPath, `${JSON.stringify({...manifest, updatedAt: new Date().toISOString()}, null, 2)}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
    renameSync(temporaryPath, manifestPath);
  } finally {
    try {
      unlinkSync(temporaryPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
};
