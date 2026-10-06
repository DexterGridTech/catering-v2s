import {execFile as execFileCallback} from 'node:child_process';
import {promisify} from 'node:util';
import {resolveDisplayMapping, type AndroidDisplayMapping, type AndroidDisplayShape} from './displayMapping.js';
import {
  androidTapPoint,
  mapAndroidLogicalBoundsToPhysical,
  resolveSurfaceWindow,
  type AndroidLogicalBounds,
  type AndroidTapPosition,
} from './androidWindow.js';

const execFile = promisify(execFileCallback);
const COMMAND_TIMEOUT_MS = 10_000;
const COMMAND_MAX_BUFFER = 1024 * 1024;

export type AndroidSurface = 'primary' | 'secondary';

export type AndroidInput = Readonly<{
  readonly discoverDisplays: () => Promise<AndroidDisplayMapping>;
  readonly tap: (surface: AndroidSurface, x: number, y: number) => Promise<void>;
  readonly tapBounds: (
    surface: AndroidSurface,
    bounds: AndroidLogicalBounds,
    position?: AndroidTapPosition,
  ) => Promise<Readonly<{readonly x: number; readonly y: number}>>;
}>;

export const buildAndroidTapArguments = (
  serial: string,
  mapping: AndroidDisplayMapping,
  surface: AndroidSurface,
  x: number,
  y: number,
): readonly string[] => {
  validateSerial(serial);
  if (surface !== 'primary' && surface !== 'secondary') {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_SURFACE_INVALID');
  }
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0) {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_COORDINATE_INVALID');
  }
  const target = surface === 'primary' ? mapping.primary : mapping.secondary;
  if (target === null) throw new Error('TERMINAL_AUTOMATION_ANDROID_SURFACE_NOT_AVAILABLE');
  return Object.freeze([
    '-s',
    serial,
    'shell',
    'input',
    '-d',
    String(target.logicalDisplayId),
    'tap',
    String(x),
    String(y),
  ]);
};

const validateSerial = (serial: string): void => {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(serial)) {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_SERIAL_INVALID');
  }
};

const runAdbText = async (adbPath: string, args: readonly string[]): Promise<string> => {
  try {
    const {stdout} = await execFile(adbPath, [...args], {
      encoding: 'utf8',
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: COMMAND_MAX_BUFFER,
      windowsHide: true,
    });
    return stdout;
  } catch {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_COMMAND_FAILED');
  }
};

export const createAndroidInput = (
  input: Readonly<{
    readonly adbPath: string;
    readonly serial: string;
    readonly shape: AndroidDisplayShape;
    readonly runCommand?: (adbPath: string, args: readonly string[]) => Promise<string>;
  }>,
): AndroidInput => {
  if (!input.adbPath) throw new Error('TERMINAL_AUTOMATION_ADB_PATH_REQUIRED');
  validateSerial(input.serial);
  const runCommand = input.runCommand ?? runAdbText;

  const discoverDisplays = async (): Promise<AndroidDisplayMapping> => {
    const [logicalOutput, surfaceFlingerOutput] = await Promise.all([
      runCommand(input.adbPath, ['-s', input.serial, 'shell', 'dumpsys', 'display']),
      runCommand(input.adbPath, ['-s', input.serial, 'shell', 'dumpsys', 'SurfaceFlinger', '--displays']),
    ]);
    return resolveDisplayMapping(input.shape, logicalOutput, surfaceFlingerOutput);
  };

  const tap = async (surface: AndroidSurface, x: number, y: number): Promise<void> => {
    const mapping = await discoverDisplays();
    await runCommand(input.adbPath, buildAndroidTapArguments(input.serial, mapping, surface, x, y));
  };

  const tapBounds = async (
    surface: AndroidSurface,
    bounds: AndroidLogicalBounds,
    position?: AndroidTapPosition,
  ): Promise<Readonly<{readonly x: number; readonly y: number}>> => {
    const mapping = await discoverDisplays();
    const target = surface === 'primary' ? mapping.primary : mapping.secondary;
    if (target === null) throw new Error('TERMINAL_AUTOMATION_ANDROID_SURFACE_NOT_AVAILABLE');
    const displayIndex = surface === 'primary' ? 0 : 1;
    let logcat: string;
    try {
      logcat = await runCommand(input.adbPath, [
        '-s',
        input.serial,
        'shell',
        'logcat',
        '-d',
        '-s',
        'TerminalDualScreen:I',
        '*:S',
      ]);
    } catch {
      throw new Error('TERMINAL_AUTOMATION_SURFACE_WINDOW_DIAGNOSTIC_READ_FAILED');
    }
    const window = resolveSurfaceWindow(logcat, surface, target);
    if (window.displayIndex !== displayIndex) throw new Error('TERMINAL_AUTOMATION_SURFACE_WINDOW_IDENTITY_MISMATCH');
    const physicalBounds = mapAndroidLogicalBoundsToPhysical(bounds, window);
    const point = androidTapPoint(physicalBounds, window, position);
    await runCommand(input.adbPath, buildAndroidTapArguments(input.serial, mapping, surface, point.x, point.y));
    return point;
  };

  return Object.freeze({discoverDisplays, tap, tapBounds});
};
