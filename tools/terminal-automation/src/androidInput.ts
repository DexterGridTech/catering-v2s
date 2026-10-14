import {execFile as execFileCallback} from 'node:child_process';
import {promisify} from 'node:util';
import {resolveDisplayMapping, type AndroidDisplayMapping, type AndroidDisplayShape} from './displayMapping.js';
import {createClickPacer, type ClickPacer} from './clickPacer.js';
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
/** Bypasses pacing only for an explicit test that must overlap two touch actions. */
export type AndroidClickPacing = 'paced' | 'intentional-overlap';

export type AndroidInput = Readonly<{
  readonly discoverDisplays: () => Promise<AndroidDisplayMapping>;
  readonly runPacedClick: ClickPacer['run'];
  readonly tap: (surface: AndroidSurface, x: number, y: number, clickPacing?: AndroidClickPacing) => Promise<void>;
  readonly tapBounds: (
    surface: AndroidSurface,
    bounds: AndroidLogicalBounds,
    position?: AndroidTapPosition,
    clickPacing?: AndroidClickPacing,
    clickStarted?: () => void,
    repeatCount?: number,
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

export const summarizeAndroidDisplayInputs = (logicalOutput: string, surfaceFlingerOutput: string): string => {
  const logicalLines = String(logicalOutput).split(/\r?\n/u);
  const rowDisplays = logicalLines.flatMap(line => {
    const header = line.match(/^\s*Display id (\d+):\s*(.*)$/u);
    return header ? [{id: header[1]!, info: header[2]!}] : [];
  });
  const blockDisplays =
    rowDisplays.length > 0
      ? rowDisplays
      : (() => {
          const start = String(logicalOutput).indexOf('Logical Displays:');
          if (start < 0) return [];
          const section = String(logicalOutput).slice(start);
          const headers = [...section.matchAll(/^\s*Display (\d+):\s*$/gmu)];
          return headers.flatMap((header, index) => {
            const blockStart = header.index! + header[0].length;
            const blockEnd = headers[index + 1]?.index ?? section.length;
            const info = section
              .slice(blockStart, blockEnd)
              .match(/^\s*mBaseDisplayInfo=.*?DisplayInfo\{[^\n]*$/mu)?.[0];
            return info ? [{id: header[1]!, info}] : [];
          });
        })();
  const logicalFacts = blockDisplays.map(({id, info}) => {
    const flags = [...info.matchAll(/\bFLAG_[A-Z_]+\b/gu)].map(match => match[0].slice(5));
    const size = info.match(/\breal (\d+) x (\d+)/u);
    const type = info.match(/\btype\s+(INTERNAL|EXTERNAL|VIRTUAL)\b/iu)?.[1]?.toLowerCase() ?? 'other';
    return `${id}:${flags.join('+') || 'no-flags'}:${type}:${size ? `${size[1]}x${size[2]}` : 'size-unparsed'}`;
  });
  const surfaceBlocks = String(surfaceFlingerOutput)
    .split(/(?=^(?:Display|Virtual Display) \S+)/m)
    .map(block => block.trim())
    .filter(block => /^(?:Display|Virtual Display) \S+/.test(block));
  const surfaceFacts = surfaceBlocks.map(block => {
    const id = block.match(/^(?:Virtual )?Display (\S+)/u)?.[1] ?? 'unknown';
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
    return `${id}:${role}:${mode ? `${mode[1]}x${mode[2]}` : displaySpace ? `displaySpace=${displaySpace}` : 'geometry-unparsed'}`;
  });
  return (
    `logicalCount=${logicalFacts.length} logical=[${logicalFacts.join(',') || 'none'}] ` +
    `surfaceCount=${surfaceFacts.length} surface=[${surfaceFacts.join(',') || 'none'}]`
  );
};

export const createAndroidInput = (
  input: Readonly<{
    readonly adbPath: string;
    readonly serial: string;
    readonly shape: AndroidDisplayShape;
    readonly clickPacer?: ClickPacer;
    readonly onClickCadence?: (waitMs: number) => void;
    readonly runCommand?: (adbPath: string, args: readonly string[]) => Promise<string>;
  }>,
): AndroidInput => {
  if (!input.adbPath) throw new Error('TERMINAL_AUTOMATION_ADB_PATH_REQUIRED');
  validateSerial(input.serial);
  const runCommand = input.runCommand ?? runAdbText;
  const clickPacer = input.clickPacer ?? createClickPacer();
  const runPacedClick: ClickPacer['run'] = async action => {
    const paced = await clickPacer.run(action);
    try {
      input.onClickCadence?.(paced.waitMs);
    } catch {
      // Diagnostics must not change an input action's outcome.
    }
    return paced;
  };

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
        `TERMINAL_AUTOMATION_ANDROID_DISPLAY_MAPPING_FAILURE code=${code} ${summarizeAndroidDisplayInputs(logicalOutput, surfaceFlingerOutput)}\n`,
      );
      throw error;
    }
  };

  const tap = async (
    surface: AndroidSurface,
    x: number,
    y: number,
    clickPacing: AndroidClickPacing = 'paced',
  ): Promise<void> => {
    const action = async (markClickStarted: () => void): Promise<void> => {
      const mapping = await discoverDisplays();
      markClickStarted();
      await runCommand(input.adbPath, buildAndroidTapArguments(input.serial, mapping, surface, x, y));
    };
    if (clickPacing === 'intentional-overlap') return action(() => undefined);
    await runPacedClick(action);
  };

  const tapBounds = async (
    surface: AndroidSurface,
    bounds: AndroidLogicalBounds,
    position?: AndroidTapPosition,
    clickPacing: AndroidClickPacing = 'paced',
    clickStarted?: () => void,
    repeatCount = 1,
  ): Promise<Readonly<{readonly x: number; readonly y: number}>> => {
    if (!Number.isSafeInteger(repeatCount) || repeatCount < 1) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_TAP_REPEAT_COUNT_INVALID');
    }
    if (repeatCount > 1 && clickPacing !== 'intentional-overlap') {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_TAP_REPEAT_REQUIRES_INTENTIONAL_OVERLAP');
    }
    let point: Readonly<{readonly x: number; readonly y: number}> | undefined;
    const action = async (markClickStarted: () => void): Promise<void> => {
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
      const resolvedPoint = androidTapPoint(physicalBounds, window, position);
      point = resolvedPoint;
      markClickStarted();
      const args = buildAndroidTapArguments(input.serial, mapping, surface, resolvedPoint.x, resolvedPoint.y);
      for (let index = 0; index < repeatCount; index += 1) await runCommand(input.adbPath, args);
    };
    if (clickStarted !== undefined) {
      await action(clickStarted);
    } else if (clickPacing === 'intentional-overlap') {
      await action(() => undefined);
    } else {
      await runPacedClick(action);
    }
    if (point === undefined) throw new Error('TERMINAL_AUTOMATION_ANDROID_TAP_POINT_UNAVAILABLE');
    return point;
  };

  return Object.freeze({discoverDisplays, runPacedClick, tap, tapBounds});
};
