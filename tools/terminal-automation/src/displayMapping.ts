export type AndroidDisplayShape = 'dual' | 'mobile';

export type AndroidDisplayTarget = Readonly<{
  readonly logicalDisplayId: number;
  readonly surfaceFlingerDisplayId: string;
  readonly logicalSize: Readonly<{readonly width: number; readonly height: number}>;
  readonly surfaceSize: Readonly<{readonly width: number; readonly height: number}>;
  readonly rotation: 0 | 1 | 2 | 3;
}>;

export type AndroidDisplayMapping = Readonly<{
  readonly primary: AndroidDisplayTarget;
  readonly secondary: AndroidDisplayTarget | null;
}>;

type LogicalDisplay = Readonly<{
  readonly id: number;
  readonly name: string;
  readonly uniqueId: string;
  readonly flags: readonly string[];
  readonly width: number;
  readonly height: number;
  readonly rotation: 0 | 1 | 2 | 3;
}>;

type SurfaceDisplay = Readonly<{
  readonly id: string;
  readonly name: string | null;
  readonly internal: boolean;
  readonly external: boolean;
  readonly virtual: boolean;
  readonly primary: boolean;
  readonly width: number;
  readonly height: number;
}>;

const fail = (code: string): never => {
  throw new Error(code);
};

// Android's public Display.DEFAULT_DISPLAY constant is the logical primary display ID.
const ANDROID_DEFAULT_DISPLAY_ID = 0;

const parseLogicalDisplays = (output: string): readonly LogicalDisplay[] => {
  const rows = String(output ?? '')
    .split('\n')
    .filter(line => /^\s*Display id \d+:/.test(line));
  const parseInfo = (id: number, name: string, info: string): LogicalDisplay => {
    const size = info.match(/\breal (\d+) x (\d+)/);
    const uniqueId = info.match(/\buniqueId "([^\"]+)"/);
    const rotation = info.match(/\brotation(?:=|\s+)(\d+)\b/);
    const flags = [...info.matchAll(/\bFLAG_[A-Z_]+\b/g)].map(flag => flag[0]);
    if (!size || !uniqueId || !rotation) return fail('TERMINAL_AUTOMATION_LOGICAL_DISPLAY_PARSE_FAILED');
    const width = Number(size[1]);
    const height = Number(size[2]);
    const rotationValue = Number(rotation[1]);
    if (
      !Number.isSafeInteger(id) ||
      id < 0 ||
      flags.length === 0 ||
      !Number.isSafeInteger(width) ||
      width <= 0 ||
      !Number.isSafeInteger(height) ||
      height <= 0 ||
      ![0, 1, 2, 3].includes(rotationValue)
    ) {
      return fail('TERMINAL_AUTOMATION_LOGICAL_DISPLAY_PARSE_FAILED');
    }
    return Object.freeze({
      id,
      name,
      uniqueId: uniqueId[1],
      flags: Object.freeze(flags),
      width,
      height,
      rotation: rotationValue as 0 | 1 | 2 | 3,
    });
  };
  let displays: readonly LogicalDisplay[];
  if (rows.length > 0) {
    displays = rows.map(line => {
      const match = line.match(/^\s*Display id (\d+):\s*DisplayInfo\{"([^\"]+)",/);
      if (!match) return fail('TERMINAL_AUTOMATION_LOGICAL_DISPLAY_PARSE_FAILED');
      return parseInfo(Number(match[1]), match[2], line);
    });
  } else {
    const logicalSectionIndex = String(output ?? '').indexOf('Logical Displays:');
    if (logicalSectionIndex < 0) return fail('TERMINAL_AUTOMATION_LOGICAL_DISPLAY_PARSE_FAILED');
    const logicalSection = String(output).slice(logicalSectionIndex);
    const headers = [...logicalSection.matchAll(/^\s*Display (\d+):\s*$/gm)];
    displays = headers.map((header, index) => {
      const blockStart = header.index! + header[0].length;
      const blockEnd = headers[index + 1]?.index ?? logicalSection.length;
      const block = logicalSection.slice(blockStart, blockEnd);
      const info = block.match(/^\s*mBaseDisplayInfo=DisplayInfo\{"([^\"]+)",\s*displayId (\d+),([^\n]*)$/m);
      if (!info || Number(info[2]) !== Number(header[1])) {
        return fail('TERMINAL_AUTOMATION_LOGICAL_DISPLAY_PARSE_FAILED');
      }
      return parseInfo(Number(header[1]), info[1], info[3]);
    });
  }
  const ids = new Set(displays.map(display => display.id));
  const uniqueIds = new Set(displays.map(display => display.uniqueId));
  if (ids.size !== displays.length || uniqueIds.size !== displays.length) {
    return fail('TERMINAL_AUTOMATION_LOGICAL_DISPLAY_AMBIGUOUS');
  }
  return Object.freeze(displays);
};

const parseSurfaceDisplays = (output: string): readonly SurfaceDisplay[] => {
  const blocks = String(output ?? '')
    .split(/(?=^(?:Display|Virtual Display) \S+)/m)
    .map(block => block.trim())
    .filter(Boolean)
    .filter(block => /^(?:Display|Virtual Display) \S+/.test(block));
  const displays = blocks.map(block => {
    const virtual = /^Virtual Display /.test(block);
    const id = block.match(/^(?:Virtual )?Display (\S+)/)?.[1];
    if (!id) return fail('TERMINAL_AUTOMATION_SURFACE_DISPLAY_PARSE_FAILED');
    const headerName = block.match(/^Display \S+ \([^\n]*, "([^"]+)"\)/)?.[1] ?? null;
    const name = block.match(/^\s*name="([^"]+)"$/m)?.[1] ?? headerName;
    const connectionType = block.match(/^\s*connectionType=(Internal|External)$/m)?.[1] ?? null;
    const primary = /^Display \S+ \([^\n]*, primary,/.test(block);
    const mode = block.match(/(?:activeMode=\{[^\n]*resolution=|displayModes=\{[^\n]*resolution=)(\d+)x(\d+)/);
    const displaySpace = block.match(
      /\bdisplaySpace\s*[:=]\s*ProjectionSpace[({][^\n]*?\bbounds\s*=\s*Rect\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/,
    );
    const width = mode ? Number(mode[1]) : displaySpace ? Number(displaySpace[3]) - Number(displaySpace[1]) : 0;
    const height = mode ? Number(mode[2]) : displaySpace ? Number(displaySpace[4]) - Number(displaySpace[2]) : 0;
    const internal = !virtual && (connectionType === 'Internal' || primary);
    const external = !virtual && connectionType === 'External';
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(width) || width < 0 || !Number.isSafeInteger(height) || height < 0) {
      return fail('TERMINAL_AUTOMATION_SURFACE_DISPLAY_PARSE_FAILED');
    }
    return Object.freeze({id, name, internal, external, virtual, primary, width, height});
  });
  const ids = new Set(displays.map(display => display.id));
  if (ids.size !== displays.length) return fail('TERMINAL_AUTOMATION_SURFACE_DISPLAY_AMBIGUOUS');
  return Object.freeze(displays);
};

export const resolveDisplayMapping = (
  shape: AndroidDisplayShape,
  logicalOutput: string,
  surfaceFlingerOutput: string,
): AndroidDisplayMapping => {
  if (shape !== 'dual' && shape !== 'mobile') return fail('TERMINAL_AUTOMATION_DISPLAY_SHAPE_INVALID');
  const targetFor = (logicalDisplay: LogicalDisplay, surfaceDisplay: SurfaceDisplay): AndroidDisplayTarget => {
    const hasSurfaceSize = surfaceDisplay.width > 0 && surfaceDisplay.height > 0;
    // Some SurfaceFlinger builds omit physical mode geometry. The capture path validates this
    // logical-size fallback against the actual PNG dimensions before accepting a screenshot.
    const surfaceSize = hasSurfaceSize
      ? {width: surfaceDisplay.width, height: surfaceDisplay.height}
      : {width: logicalDisplay.width, height: logicalDisplay.height};
    return Object.freeze({
      logicalDisplayId: logicalDisplay.id,
      surfaceFlingerDisplayId: surfaceDisplay.id,
      logicalSize: Object.freeze({width: logicalDisplay.width, height: logicalDisplay.height}),
      surfaceSize: Object.freeze(surfaceSize),
      rotation: logicalDisplay.rotation,
    });
  };
  const logical = parseLogicalDisplays(logicalOutput);
  const surface = parseSurfaceDisplays(surfaceFlingerOutput);
  const primaryLogical = logical.filter(display => display.id === ANDROID_DEFAULT_DISPLAY_ID);
  const secondaryLogical = logical.filter(display => display.flags.includes('FLAG_PRESENTATION'));
  const primarySurface = surface.filter(display => display.primary || display.internal);
  if (primaryLogical.length !== 1) return fail('TERMINAL_AUTOMATION_PRIMARY_DISPLAY_UNPROVEN');
  if (primarySurface.length !== 1) return fail('TERMINAL_AUTOMATION_PRIMARY_SURFACE_UNPROVEN');
  if (!primarySurface[0].id) return fail('TERMINAL_AUTOMATION_PRIMARY_SURFACE_ID_MISSING');

  if (shape === 'mobile') {
    if (logical.length !== 1 || secondaryLogical.length !== 0 || surface.length !== 1) {
      return fail('TERMINAL_AUTOMATION_MOBILE_SHAPE_MISMATCH');
    }
    return Object.freeze({
      primary: targetFor(primaryLogical[0], primarySurface[0]),
      secondary: null,
    });
  }

  const virtualSecondary = surface.filter(display => display.virtual);
  const externalSecondary = surface.filter(display => display.external);
  if (logical.length !== 2 || secondaryLogical.length !== 1) {
    return fail('TERMINAL_AUTOMATION_DUAL_SHAPE_MISMATCH');
  }
  if (
    virtualSecondary.length > 1 ||
    externalSecondary.length > 1 ||
    (virtualSecondary.length > 0 && externalSecondary.length > 0)
  ) {
    return fail('TERMINAL_AUTOMATION_SECONDARY_DISPLAY_AMBIGUOUS');
  }
  const hasSingleVirtualSecondary = virtualSecondary.length === 1 && externalSecondary.length === 0;
  const hasSinglePhysicalSecondary = virtualSecondary.length === 0 && externalSecondary.length === 1;
  if (!hasSingleVirtualSecondary && !hasSinglePhysicalSecondary) {
    return fail('TERMINAL_AUTOMATION_DUAL_SHAPE_MISMATCH');
  }
  if (surface.length !== 2) return fail('TERMINAL_AUTOMATION_DUAL_SHAPE_MISMATCH');
  const secondarySurface = virtualSecondary[0] ?? externalSecondary[0];
  if (!secondarySurface?.id) return fail('TERMINAL_AUTOMATION_SECONDARY_DISPLAY_AMBIGUOUS');
  if (secondarySurface.virtual && secondaryLogical[0].name !== secondarySurface.name) {
    return fail('TERMINAL_AUTOMATION_SECONDARY_IDENTITY_MISMATCH');
  }

  return Object.freeze({
    primary: targetFor(primaryLogical[0], primarySurface[0]),
    secondary: targetFor(secondaryLogical[0], secondarySurface),
  });
};
