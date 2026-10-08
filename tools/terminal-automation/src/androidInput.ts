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

const displayInputSummary = (logicalOutput: string, surfaceFlingerOutput: string): string => {
  const logicalSizes = [...logicalOutput.matchAll(/real (\d+) x (\d+)/g)].map(match => `${match[1]}x${match[2]}`);
  const surfaceBlocks = String(surfaceFlingerOutput)
    .split(/(?=^(?:Display|Virtual Display) \S+)/m)
    .map(block => block.trim())
    .filter(block => /^(?:Display|Virtual Display) \S+/.test(block));
  const surfaceFacts = surfaceBlocks.map(block => {
    const role = /^Virtual Display /.test(block)
      ? 'virtual'
      : /\bprimary\b/.test(block)
        ? 'primary'
        : /^\s*connectionType=External\s*$/m.test(block)
          ? 'external'
          : /^\s*connectionType=Internal\s*$/m.test(block)
            ? 'internal'
            : 'other';
    const mode = block.match(/(?:activeMode=\{[^\n]*resolution=|displayModes=\{[^\n]*resolution=)(\d+)\s*x\s*(\d+)/);
    const displaySpace = block
      .match(/^\s*displaySpace\s*[:=]\s*(.{1,220})$/m)?.[1]
      ?.replace(/"[^"]*"/g, '"<redacted>"')
      .replace(/\b\d{9,}\b/g, '<id>')
      .replace(/0x[0-9a-f]+/gi, '<pointer>');
    return `${role}:${mode ? `${mode[1]}x${mode[2]}` : displaySpace ? `displaySpace=${displaySpace}` : 'geometry-unparsed'}`;
  });
  return `logical=${logicalSizes.join(',') || 'none'} surface=${surfaceFacts.join(',') || 'none'}`;
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
    try {
      return resolveDisplayMapping(input.shape, logicalOutput, surfaceFlingerOutput);
    } catch (error) {
      const code =
        error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+$/.test(error.message)
          ? error.message
          : 'TERMINAL_AUTOMATION_DISPLAY_MAPPING_FAILED';
      process.stderr.write(
        `TERMINAL_AUTOMATION_ANDROID_DISPLAY_MAPPING_FAILURE code=${code} ${displayInputSummary(logicalOutput, surfaceFlingerOutput)}\n`,
      );
      throw error;
    }
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
