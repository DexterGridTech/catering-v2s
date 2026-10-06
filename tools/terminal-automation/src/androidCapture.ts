import {execFile as execFileCallback} from 'node:child_process';
import {promisify} from 'node:util';
import type {AndroidDisplayMapping, AndroidDisplayShape} from './displayMapping.js';
import {resolveDisplayMapping} from './displayMapping.js';

const execFile = promisify(execFileCallback);
const COMMAND_TIMEOUT_MS = 10_000;
const COMMAND_MAX_BUFFER = 32 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const pngDimensions = (bytes: Buffer): Readonly<{readonly width: number; readonly height: number}> | null => {
  if (
    bytes.length < 24 ||
    !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ||
    bytes.readUInt32BE(8) !== 13 ||
    bytes.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    return null;
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  return width > 0 && height > 0 ? Object.freeze({width, height}) : null;
};

export type AndroidDisplayCapture = Readonly<{
  readonly discoverDisplays: () => Promise<AndroidDisplayMapping>;
  readonly capture: (surface: 'primary' | 'secondary') => Promise<Buffer>;
}>;

const validateSerial = (serial: string): void => {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(serial)) {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_SERIAL_INVALID');
  }
};

const captureBytes = async (adbPath: string, args: readonly string[]): Promise<Buffer> => {
  try {
    const {stdout} = await execFile(adbPath, [...args], {
      encoding: 'buffer',
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: COMMAND_MAX_BUFFER,
      windowsHide: true,
    });
    if (!Buffer.isBuffer(stdout)) throw new Error('TERMINAL_AUTOMATION_SCREENSHOT_OUTPUT_INVALID');
    return stdout;
  } catch {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_SCREENSHOT_FAILED');
  }
};

export const buildAndroidCaptureArguments = (
  serial: string,
  mapping: AndroidDisplayMapping,
  surface: 'primary' | 'secondary',
): readonly string[] => {
  validateSerial(serial);
  if (surface !== 'primary' && surface !== 'secondary') {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_SURFACE_INVALID');
  }
  const display = surface === 'primary' ? mapping.primary : mapping.secondary;
  if (display === null) throw new Error('TERMINAL_AUTOMATION_ANDROID_SURFACE_NOT_AVAILABLE');
  return Object.freeze(['-s', serial, 'exec-out', 'screencap', '-d', display.surfaceFlingerDisplayId, '-p']);
};

export const createAndroidDisplayCapture = (
  input: Readonly<{
    readonly adbPath: string;
    readonly serial: string;
    readonly shape: AndroidDisplayShape;
    readonly runTextCommand?: (adbPath: string, args: readonly string[]) => Promise<string>;
    readonly runBinaryCommand?: (adbPath: string, args: readonly string[]) => Promise<Buffer>;
  }>,
): AndroidDisplayCapture => {
  if (!input.adbPath) throw new Error('TERMINAL_AUTOMATION_ADB_PATH_REQUIRED');
  validateSerial(input.serial);
  const runTextCommand =
    input.runTextCommand ??
    (async (adbPath, args) => {
      const {stdout} = await execFile(adbPath, [...args], {
        encoding: 'utf8',
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
      return stdout;
    });
  const runBinaryCommand = input.runBinaryCommand ?? captureBytes;
  const discoverDisplays = async (): Promise<AndroidDisplayMapping> => {
    let logicalOutput: string;
    let surfaceFlingerOutput: string;
    try {
      [logicalOutput, surfaceFlingerOutput] = await Promise.all([
        runTextCommand(input.adbPath, ['-s', input.serial, 'shell', 'dumpsys', 'display']),
        runTextCommand(input.adbPath, ['-s', input.serial, 'shell', 'dumpsys', 'SurfaceFlinger', '--displays']),
      ]);
    } catch {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_DISPLAY_DISCOVERY_FAILED');
    }
    return resolveDisplayMapping(input.shape, logicalOutput, surfaceFlingerOutput);
  };
  const capture = async (surface: 'primary' | 'secondary'): Promise<Buffer> => {
    const mapping = await discoverDisplays();
    const target = surface === 'primary' ? mapping.primary : mapping.secondary;
    if (target === null) throw new Error('TERMINAL_AUTOMATION_ANDROID_SURFACE_NOT_AVAILABLE');
    const bytes = await runBinaryCommand(input.adbPath, buildAndroidCaptureArguments(input.serial, mapping, surface));
    const dimensions = pngDimensions(bytes);
    if (dimensions === null) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_SCREENSHOT_NOT_PNG');
    }
    if (dimensions.width !== target.surfaceSize.width || dimensions.height !== target.surfaceSize.height) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_SCREENSHOT_DIMENSION_MISMATCH');
    }
    return bytes;
  };
  return Object.freeze({discoverDisplays, capture});
};
