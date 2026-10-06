import type {AndroidDisplayTarget} from './displayMapping.js';

export type AndroidSurfaceWindow = Readonly<{
  readonly displayIndex: 0 | 1;
  readonly displayId: number;
  readonly leftPx: number;
  readonly topPx: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly surfaceDensity: number;
}>;

export type AndroidLogicalBounds = Readonly<{
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}>;
export type AndroidPhysicalBounds = AndroidLogicalBounds;
export type AndroidTapPosition = Readonly<{readonly x: number; readonly y: number}>;

const fail = (code: string): never => {
  throw new Error(code);
};

const parseFact = (line: string, name: string): number | null => {
  const value = line.match(new RegExp(`(?:^|\\s)${name}=(-?\\d+(?:\\.\\d+)?)(?:\\s|$)`))?.[1];
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseEvent = (line: string): string | null => line.match(/(?:^|\s)event=([A-Za-z0-9-]+)(?:\s|$)/)?.[1] ?? null;
const parseSurfaceKey = (line: string): string | null =>
  line.match(/(?:^|\s)surfaceKey=(PRIMARY|SECONDARY)(?:\s|$)/)?.[1] ?? null;

const eventFor = (surface: 'primary' | 'secondary', event: string | null): boolean =>
  surface === 'primary'
    ? event === 'primary-window-post-layout'
    : event === 'secondary-presentation-window-post-create' || event === 'secondary-presentation-window-post-layout';

export const resolveSurfaceWindow = (
  output: string,
  surface: 'primary' | 'secondary',
  target: AndroidDisplayTarget,
): AndroidSurfaceWindow => {
  const expectedIndex = surface === 'primary' ? 0 : 1;
  const lines = String(output ?? '').split('\n');
  const surfaceKey = surface === 'primary' ? 'PRIMARY' : 'SECONDARY';
  const snapshots = lines
    .filter(line => parseEvent(line) === 'surface-host-snapshot-ready' && parseSurfaceKey(line) === surfaceKey)
    .map(line => ({
      displayId: parseFact(line, 'displayId'),
      generation: parseFact(line, 'generation'),
      widthPx: parseFact(line, 'currentWidthPx'),
      heightPx: parseFact(line, 'currentHeightPx'),
      surfaceDensity: parseFact(line, 'surfaceDensity'),
    }))
    .filter(snapshot => snapshot.displayId === target.logicalDisplayId);
  const snapshot = snapshots.at(-1);
  if (snapshot === undefined) return fail('TERMINAL_AUTOMATION_SURFACE_HOST_SNAPSHOT_NOT_READY');
  const candidates = lines
    .filter(line => eventFor(surface, parseEvent(line)))
    .map(line => ({
      displayIndex: parseFact(line, 'displayIndex'),
      displayId: parseFact(line, 'displayId'),
      leftPx: parseFact(line, 'leftPx'),
      topPx: parseFact(line, 'topPx'),
      widthPx: parseFact(line, 'widthPx'),
      heightPx: parseFact(line, 'heightPx'),
    }))
    .filter(candidate => candidate.displayIndex === expectedIndex);
  const candidate = candidates.at(-1);
  if (candidate === undefined) return fail('TERMINAL_AUTOMATION_SURFACE_WINDOW_NOT_OBSERVED');
  const values = [
    candidate.displayId,
    candidate.leftPx,
    candidate.topPx,
    candidate.widthPx,
    candidate.heightPx,
    snapshot.generation,
    snapshot.widthPx,
    snapshot.heightPx,
    snapshot.surfaceDensity,
  ];
  if (
    values.some(value => value === null) ||
    candidate.displayId !== target.logicalDisplayId ||
    candidate.widthPx !== snapshot.widthPx ||
    candidate.heightPx !== snapshot.heightPx ||
    snapshot.generation! <= 0 ||
    candidate.widthPx! <= 0 ||
    candidate.heightPx! <= 0 ||
    snapshot.surfaceDensity! <= 0
  ) {
    return fail('TERMINAL_AUTOMATION_SURFACE_WINDOW_FACTS_INVALID');
  }
  return Object.freeze({
    displayIndex: expectedIndex,
    displayId: candidate.displayId!,
    leftPx: candidate.leftPx!,
    topPx: candidate.topPx!,
    widthPx: candidate.widthPx!,
    heightPx: candidate.heightPx!,
    surfaceDensity: snapshot.surfaceDensity!,
  });
};

export const mapAndroidLogicalBoundsToPhysical = (
  logical: AndroidLogicalBounds,
  window: AndroidSurfaceWindow,
): AndroidPhysicalBounds => {
  if (
    ![logical.x, logical.y, logical.width, logical.height].every(Number.isFinite) ||
    logical.width <= 0 ||
    logical.height <= 0
  ) {
    return fail('TERMINAL_AUTOMATION_NODE_BOUNDS_INVALID');
  }
  const x = window.leftPx + logical.x * window.surfaceDensity;
  const y = window.topPx + logical.y * window.surfaceDensity;
  const width = logical.width * window.surfaceDensity;
  const height = logical.height * window.surfaceDensity;
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return fail('TERMINAL_AUTOMATION_ANDROID_PHYSICAL_BOUNDS_INVALID');
  }
  return Object.freeze({x, y, width, height});
};

export const androidTapPoint = (
  bounds: AndroidPhysicalBounds,
  window: AndroidSurfaceWindow,
  position: AndroidTapPosition = Object.freeze({x: 0.5, y: 0.5}),
): Readonly<{readonly x: number; readonly y: number}> => {
  const insetPx = Math.ceil(2 * window.surfaceDensity) + 1;
  if (!Number.isSafeInteger(insetPx) || insetPx < 1) return fail('TERMINAL_AUTOMATION_ANDROID_TAP_INSET_INVALID');
  if (![position.x, position.y].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) {
    return fail('TERMINAL_AUTOMATION_ANDROID_TAP_POSITION_INVALID');
  }
  const left = Math.max(bounds.x, window.leftPx);
  const top = Math.max(bounds.y, window.topPx);
  const right = Math.min(bounds.x + bounds.width, window.leftPx + window.widthPx);
  const bottom = Math.min(bounds.y + bounds.height, window.topPx + window.heightPx);
  if (right - left < insetPx * 2 + 1 || bottom - top < insetPx * 2 + 1) {
    return fail(
      `TERMINAL_AUTOMATION_ANDROID_TAP_TARGET_TOO_SMALL clipped=${right - left}x${bottom - top} insetPx=${insetPx} ` +
        `window=${window.leftPx},${window.topPx},${window.widthPx},${window.heightPx} density=${window.surfaceDensity}`,
    );
  }
  return Object.freeze({
    x: Math.floor(left + insetPx + (right - left - insetPx * 2) * position.x),
    y: Math.floor(top + insetPx + (bottom - top - insetPx * 2) * position.y),
  });
};
