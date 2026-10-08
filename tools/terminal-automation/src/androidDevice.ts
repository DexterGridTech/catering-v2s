import {execFile as execFileCallback} from 'node:child_process';
import {promisify} from 'node:util';
import {realpathSync, statSync} from 'node:fs';
import path from 'node:path';
import type {Client, DeviceClient} from '@devicefarmer/adbkit';
import {collectAndroidRuntimeFailureDiagnostics} from './androidAppDiagnostics.js';
import {requireReadyAndroidDevice} from './androidAdb.js';

const execFile = promisify(execFileCallback);
const DRIVER_DEVICE_PORT = 19090;

type Reverse = Readonly<{readonly remote: string; readonly local: string}>;
export type ManagedServiceReverse = Readonly<{readonly remotePort: number; readonly localPort: number}>;
export type ManagedReverseLifecycle = Readonly<{
  readonly onAttached?: (mapping: Readonly<{readonly remote: string; readonly local: string}>) => void;
  readonly onReleased?: (mapping: Readonly<{readonly remote: string; readonly local: string}>) => void;
}>;
export type ManagedDevServiceUrls = Readonly<{
  readonly businessBaseUrl: string;
  readonly tdsEntryOneUrl: string;
  readonly tdsEntryTwoUrl: string;
}>;

export const managedDevServiceReverses = (urls: ManagedDevServiceUrls): readonly ManagedServiceReverse[] => {
  let business: URL;
  let entryOne: URL;
  let entryTwo: URL;
  try {
    business = new URL(urls.businessBaseUrl);
    entryOne = new URL(urls.tdsEntryOneUrl);
    entryTwo = new URL(urls.tdsEntryTwoUrl);
  } catch {
    return fail('TERMINAL_AUTOMATION_MANAGED_DEV_URL_INVALID');
  }
  if (
    business.protocol !== 'http:' ||
    business.hostname !== '127.0.0.1' ||
    business.pathname !== '/api/terminal/group-workspaces/aurora' ||
    business.port === '' ||
    entryOne.protocol !== 'ws:' ||
    entryTwo.protocol !== 'ws:' ||
    entryOne.hostname !== '127.0.0.1' ||
    entryTwo.hostname !== '127.0.0.1' ||
    entryOne.port === '' ||
    entryTwo.port === '' ||
    entryOne.port === entryTwo.port ||
    new Set([business.port, entryOne.port, entryTwo.port]).size !== 3 ||
    [business, entryOne, entryTwo].some(
      url => url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '',
    ) ||
    (entryOne.pathname !== '' && entryOne.pathname !== '/') ||
    (entryTwo.pathname !== '' && entryTwo.pathname !== '/')
  ) {
    fail('TERMINAL_AUTOMATION_MANAGED_DEV_URL_INVALID');
  }
  return Object.freeze(
    [business, entryOne, entryTwo].map(url => {
      const port = Number(url.port);
      return Object.freeze({remotePort: port, localPort: port});
    }),
  );
};

export type AndroidDeviceSession = Readonly<{
  readonly serial: string;
  readonly device: DeviceClient;
  readonly install: (apkPath: string) => Promise<void>;
  readonly launch: (component: string) => Promise<void>;
  readonly isInstalled: (packageName: string) => Promise<boolean>;
  readonly readApiLevel: () => Promise<number>;
  readonly readTerminalUpdateLogs: (packageName: string) => Promise<string>;
  readonly readRuntimeFailureDiagnostics: (packageName: string) => Promise<string>;
  readonly forceStop: (packageName: string) => Promise<void>;
  readonly uninstall: (packageName: string) => Promise<void>;
  readonly attachDriver: (hostPort: number) => Promise<() => Promise<void>>;
  readonly attachManagedServicePorts: (
    ports: readonly ManagedServiceReverse[],
    lifecycle?: ManagedReverseLifecycle,
  ) => Promise<() => Promise<void>>;
}>;

const fail = (code: string): never => {
  throw new Error(code);
};

const validateSerial = (serial: string): void => {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(serial)) {
    fail('TERMINAL_AUTOMATION_ANDROID_SERIAL_INVALID');
  }
};

const validateComponent = (component: string): void => {
  if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+\/[A-Za-z_$][A-Za-z0-9_$.]*$/.test(component)) {
    fail('TERMINAL_AUTOMATION_ANDROID_COMPONENT_INVALID');
  }
};

const activityLaunchFailureKind = (error: unknown): string => {
  const message = error instanceof Error ? error.message : '';
  if (/unable to resolve intent/iu.test(message)) return 'INTENT_UNRESOLVED';
  if (/activity class .* does not exist/iu.test(message)) return 'ACTIVITY_CLASS_MISSING';
  if (/permission denial/iu.test(message)) return 'PERMISSION_DENIED';
  if (/background activity (?:start|launch).*blocked/iu.test(message)) return 'BACKGROUND_START_BLOCKED';
  if (/timed?\s*out|timeout/iu.test(message)) return 'START_TIMEOUT';
  return 'DEVICE_COMMAND_REJECTED';
};

const validatePackageName = (packageName: string): void => {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageName)) {
    fail('TERMINAL_AUTOMATION_ANDROID_PACKAGE_INVALID');
  }
};

const containedFile = (repositoryRoot: string, candidate: string): string => {
  const root = realpathSync(repositoryRoot);
  const file = realpathSync(path.resolve(root, candidate));
  const relative = path.relative(root, file);
  if (relative === '' || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    fail('TERMINAL_AUTOMATION_ANDROID_APK_OUTSIDE_REPOSITORY');
  }
  if (!statSync(file).isFile()) fail('TERMINAL_AUTOMATION_ANDROID_APK_NOT_FILE');
  return file;
};

const listDeviceReverses = async (device: DeviceClient): Promise<readonly Reverse[]> => {
  let values: Reverse[];
  try {
    values = await device.listReverses();
  } catch (error) {
    const failure = typeof error === 'object' && error !== null ? (error as {readonly code?: unknown}) : undefined;
    const errorType =
      error instanceof Error && /^[A-Za-z][A-Za-z0-9_.]{0,79}$/u.test(error.name) ? error.name : 'UNKNOWN';
    const errorCode =
      typeof failure?.code === 'string' && /^[A-Z0-9_-]{1,64}$/u.test(failure.code) ? failure.code : 'UNKNOWN';
    process.stdout.write(
      `TERMINAL_AUTOMATION_ANDROID_REVERSE_LIST_ERROR errorType=${errorType} errorCode=${errorCode}\n`,
    );
    return fail('TERMINAL_AUTOMATION_ANDROID_REVERSE_LIST_FAILED');
  }
  if (
    !Array.isArray(values) ||
    values.some(value => typeof value.remote !== 'string' || typeof value.local !== 'string')
  ) {
    fail('TERMINAL_AUTOMATION_ANDROID_REVERSE_LIST_INVALID');
  }
  return values;
};

const validateManagedServicePorts = (ports: readonly ManagedServiceReverse[]): void => {
  if (
    ports.length !== 3 ||
    ports.some(
      value =>
        !Number.isSafeInteger(value.remotePort) ||
        value.remotePort < 1 ||
        value.remotePort > 65_535 ||
        !Number.isSafeInteger(value.localPort) ||
        value.localPort < 1 ||
        value.localPort > 65_535 ||
        value.remotePort === DRIVER_DEVICE_PORT,
    ) ||
    new Set(ports.map(value => value.remotePort)).size !== ports.length ||
    new Set(ports.map(value => value.localPort)).size !== ports.length
  ) {
    fail('TERMINAL_AUTOMATION_ANDROID_MANAGED_PORTS_INVALID');
  }
};

const runAdbArgs = async (
  adbPath: string,
  args: readonly string[],
  failureCode = 'TERMINAL_AUTOMATION_ANDROID_REVERSE_REMOVE_FAILED',
): Promise<void> => {
  try {
    await execFile(adbPath, [...args], {
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 64 * 1024,
      windowsHide: true,
    });
  } catch {
    fail(failureCode);
  }
};

const runAdbText = async (adbPath: string, args: readonly string[]): Promise<string> => {
  try {
    const {stdout} = await execFile(adbPath, [...args], {
      encoding: 'utf8',
      timeout: 10_000,
      // Runtime logcat may contain several hundred KiB before the collector
      // projects it to a small allowlisted diagnostic record. Keep this bounded
      // but large enough not to turn normal app output into a false command error.
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout;
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    const failure =
      code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'
        ? 'OUTPUT_LIMIT'
        : code === 'ETIMEDOUT'
          ? 'TIMEOUT'
          : code === 'ENOENT'
            ? 'ADB_UNAVAILABLE'
            : 'EXIT';
    return fail(`TERMINAL_AUTOMATION_ANDROID_COMMAND_FAILED_${failure}`);
  }
};

const isPackageInstalled = async (
  adbPath: string,
  serial: string,
  packageName: string,
  runTextCommand: (adbPath: string, args: readonly string[]) => Promise<string>,
): Promise<boolean> => {
  const output = await runTextCommand(adbPath, [
    '-s',
    serial,
    'shell',
    'pm',
    'list',
    'packages',
    '--user',
    '0',
    packageName,
  ]);
  const matches = output.split(/\r?\n/u).filter(line => line.trim() === `package:${packageName}`);
  if (matches.length > 1) fail('TERMINAL_AUTOMATION_ANDROID_PACKAGE_READBACK_AMBIGUOUS');
  return matches.length === 1;
};

export const createAndroidDeviceSession = async (
  input: Readonly<{
    readonly client: Client;
    readonly serial: string;
    readonly repositoryRoot: string;
    readonly adbPath: string;
    readonly runCommand?: (adbPath: string, args: readonly string[], failureCode?: string) => Promise<void>;
    readonly runTextCommand?: (adbPath: string, args: readonly string[]) => Promise<string>;
  }>,
): Promise<AndroidDeviceSession> => {
  validateSerial(input.serial);
  if (!input.adbPath) fail('TERMINAL_AUTOMATION_ADB_PATH_REQUIRED');
  const device = await requireReadyAndroidDevice(input.client, input.serial);
  const runCommand = input.runCommand ?? runAdbArgs;
  const runTextCommand = input.runTextCommand ?? runAdbText;

  return Object.freeze({
    serial: input.serial,
    device,
    install: async apkPath => {
      let file: string;
      try {
        file = containedFile(input.repositoryRoot, apkPath);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('TERMINAL_AUTOMATION_')) return Promise.reject(error);
        return fail('TERMINAL_AUTOMATION_ANDROID_APK_INVALID');
      }
      try {
        await device.install(file);
      } catch {
        fail('TERMINAL_AUTOMATION_ANDROID_INSTALL_FAILED');
      }
    },
    launch: async component => {
      validateComponent(component);
      try {
        // The caller owns the bounded app-session wait. ADBKit's `wait` option
        // adds ActivityManager's `am start -W` wait; its ADB socket deadline is
        // 10s in this driver and can expire while a cold FULL boot is starting.
        await device.startActivity({component, wait: false});
      } catch (error) {
        const componentClass = component.slice(component.indexOf('/') + 1);
        process.stdout.write(
          [
            'TERMINAL_AUTOMATION_ANDROID_ACTIVITY_START_FAILED',
            `componentClass=${componentClass}`,
            `failure=${activityLaunchFailureKind(error)}`,
            `errorType=${error instanceof Error && /^[A-Za-z][A-Za-z0-9_.]{0,79}$/u.test(error.name) ? error.name : 'UNKNOWN'}`,
          ].join(' ') + '\n',
        );
        fail('TERMINAL_AUTOMATION_ANDROID_LAUNCH_FAILED');
      }
    },
    isInstalled: async packageName => {
      validatePackageName(packageName);
      return isPackageInstalled(input.adbPath, input.serial, packageName, runTextCommand);
    },
    readApiLevel: async () => {
      const output = await runTextCommand(input.adbPath, [
        '-s',
        input.serial,
        'shell',
        'getprop',
        'ro.build.version.sdk',
      ]);
      const apiLevel = Number(output.trim());
      if (!Number.isSafeInteger(apiLevel) || apiLevel < 1)
        fail('TERMINAL_AUTOMATION_ANDROID_API_LEVEL_READBACK_INVALID');
      return apiLevel;
    },
    readTerminalUpdateLogs: async packageName => {
      validatePackageName(packageName);
      const pidOutput = await runTextCommand(input.adbPath, ['-s', input.serial, 'shell', 'pidof', packageName]);
      const pids = pidOutput.trim().split(/\s+/u).filter(Boolean);
      if (pids.length !== 1 || !/^\d+$/u.test(pids[0] ?? '')) {
        fail('TERMINAL_AUTOMATION_ANDROID_UPDATE_LOG_PROCESS_UNAVAILABLE');
      }
      const output = await runTextCommand(input.adbPath, [
        '-s',
        input.serial,
        'shell',
        'logcat',
        '-d',
        '-v',
        'brief',
        '--pid',
        pids[0]!,
        '-s',
        'TerminalUpdate:I',
        '*:S',
      ]);
      const lines = output
        .split(/\r?\n/u)
        .filter(line =>
          /^\w\/TerminalUpdate\s*\(\s*\d+\): event=[a-z0-9-]+(?: [a-zA-Z][a-zA-Z0-9]*=[A-Za-z0-9_.,:-]+)*$/u.test(line),
        );
      try {
        const activityManagerOutput = await runTextCommand(input.adbPath, [
          '-s',
          input.serial,
          'shell',
          'logcat',
          '-d',
          '-v',
          'brief',
          '-s',
          'ActivityTaskManager:W',
          '*:S',
        ]);
        if (
          activityManagerOutput
            .split(/\r?\n/u)
            .some(
              line =>
                /Background activity launch blocked|Background activity start denied/iu.test(line) &&
                line.includes(packageName),
            )
        )
          lines.push('W/ActivityTaskManager: event=background-activity-start-blocked');
      } catch {
        lines.push('I/TerminalUpdate: event=activity-manager-diagnostics-unavailable');
      }
      return lines.slice(-100).join('\n');
    },
    readRuntimeFailureDiagnostics: async packageName => {
      validatePackageName(packageName);
      const pidOutput = await runTextCommand(input.adbPath, ['-s', input.serial, 'shell', 'pidof', packageName]);
      const pids = pidOutput.trim().split(/\s+/u).filter(Boolean);
      if (pids.length !== 1 || !/^\d+$/u.test(pids[0] ?? '')) {
        fail('TERMINAL_AUTOMATION_ANDROID_RUNTIME_LOG_PROCESS_UNAVAILABLE');
      }
      const output = await runTextCommand(input.adbPath, [
        '-s',
        input.serial,
        'shell',
        'logcat',
        '-d',
        '-v',
        'brief',
        '--pid',
        pids[0]!,
        '-s',
        'ReactNativeJS:V',
        '*:S',
      ]);
      return collectAndroidRuntimeFailureDiagnostics(output);
    },
    forceStop: async packageName => {
      validatePackageName(packageName);
      await runAdbArgs(
        input.adbPath,
        ['-s', input.serial, 'shell', 'am', 'force-stop', packageName],
        'TERMINAL_AUTOMATION_ANDROID_FORCE_STOP_FAILED',
      );
    },
    uninstall: async packageName => {
      validatePackageName(packageName);
      if (!(await isPackageInstalled(input.adbPath, input.serial, packageName, runTextCommand))) return;
      await runCommand(
        input.adbPath,
        ['-s', input.serial, 'uninstall', packageName],
        'TERMINAL_AUTOMATION_ANDROID_UNINSTALL_FAILED',
      );
      const remaining = await runTextCommand(input.adbPath, [
        '-s',
        input.serial,
        'shell',
        'pm',
        'list',
        'packages',
        '--user',
        '0',
        packageName,
      ]);
      if (remaining.split(/\r?\n/u).some(line => line.trim() === `package:${packageName}`)) {
        fail('TERMINAL_AUTOMATION_ANDROID_UNINSTALL_READBACK_FAILED');
      }
    },
    attachDriver: async hostPort => {
      if (!Number.isSafeInteger(hostPort) || hostPort < 1 || hostPort > 65_535) {
        fail('TERMINAL_AUTOMATION_ANDROID_HOST_PORT_INVALID');
      }
      const remote = `tcp:${DRIVER_DEVICE_PORT}`;
      const local = `tcp:${hostPort}`;
      const before = await listDeviceReverses(device);
      if (before.some(reverse => reverse.remote === remote)) {
        fail('TERMINAL_AUTOMATION_ANDROID_REVERSE_ALREADY_OWNED');
      }
      try {
        await device.reverse(remote, local);
      } catch {
        fail('TERMINAL_AUTOMATION_ANDROID_REVERSE_CREATE_FAILED');
      }
      const releaseOwned = async (): Promise<void> => {
        const current = await listDeviceReverses(device);
        const entries = current.filter(reverse => reverse.remote === remote);
        if (entries.length === 0) return;
        if (entries.length !== 1 || entries[0]?.local !== local) {
          fail('TERMINAL_AUTOMATION_ANDROID_REVERSE_OWNERSHIP_CHANGED');
        }
        await runCommand(input.adbPath, ['-s', input.serial, 'reverse', '--remove', remote]);
        if ((await listDeviceReverses(device)).some(reverse => reverse.remote === remote)) {
          fail('TERMINAL_AUTOMATION_ANDROID_REVERSE_CLEANUP_READBACK_FAILED');
        }
      };
      try {
        const after = await listDeviceReverses(device);
        const remoteEntries = after.filter(reverse => reverse.remote === remote);
        if (remoteEntries.length !== 1 || remoteEntries[0]?.local !== local) {
          fail('TERMINAL_AUTOMATION_ANDROID_REVERSE_READBACK_MISMATCH');
        }
      } catch (setupError) {
        try {
          await releaseOwned();
        } catch {
          fail('TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:ANDROID_REVERSE_ACQUISITION');
        }
        throw setupError;
      }
      let released = false;
      return async () => {
        if (released) return;
        await releaseOwned();
        released = true;
      };
    },
    attachManagedServicePorts: async (ports, lifecycle) => {
      validateManagedServicePorts(ports);
      const mappings = ports.map(value =>
        Object.freeze({remote: `tcp:${value.remotePort}`, local: `tcp:${value.localPort}`}),
      );
      const before = await listDeviceReverses(device);
      if (mappings.some(mapping => before.some(reverse => reverse.remote === mapping.remote))) {
        fail('TERMINAL_AUTOMATION_ANDROID_MANAGED_REVERSE_ALREADY_OWNED');
      }
      const created: Reverse[] = [];
      const releaseOwned = async (strict: boolean): Promise<void> => {
        const errors: string[] = [];
        for (const mapping of [...created].reverse()) {
          try {
            const current = await listDeviceReverses(device);
            const entries = current.filter(reverse => reverse.remote === mapping.remote);
            if (entries.length === 0) continue;
            if (entries.length !== 1 || entries[0]?.local !== mapping.local) {
              errors.push('OWNERSHIP_CHANGED');
              continue;
            }
            await runCommand(input.adbPath, ['-s', input.serial, 'reverse', '--remove', mapping.remote]);
            if ((await listDeviceReverses(device)).some(reverse => reverse.remote === mapping.remote)) {
              errors.push('READBACK_FAILED');
            } else {
              lifecycle?.onReleased?.(mapping);
            }
          } catch {
            errors.push('REMOVE_FAILED');
          }
        }
        if (strict && errors.length > 0) fail('TERMINAL_AUTOMATION_ANDROID_MANAGED_REVERSE_CLEANUP_FAILED');
      };
      try {
        for (const mapping of mappings) {
          await device.reverse(mapping.remote, mapping.local);
          created.push(mapping);
          lifecycle?.onAttached?.(mapping);
        }
        const after = await listDeviceReverses(device);
        if (
          mappings.some(mapping => {
            const entries = after.filter(reverse => reverse.remote === mapping.remote);
            return entries.length !== 1 || entries[0]?.local !== mapping.local;
          })
        ) {
          fail('TERMINAL_AUTOMATION_ANDROID_MANAGED_REVERSE_READBACK_MISMATCH');
        }
      } catch (error) {
        try {
          await releaseOwned(true);
        } catch {
          fail('TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:ANDROID_MANAGED_REVERSE_ACQUISITION');
        }
        if (error instanceof Error && error.message.startsWith('TERMINAL_AUTOMATION_')) throw error;
        fail('TERMINAL_AUTOMATION_ANDROID_MANAGED_REVERSE_CREATE_FAILED');
      }
      let released = false;
      return async () => {
        if (released) return;
        await releaseOwned(true);
        released = true;
      };
    },
  });
};
