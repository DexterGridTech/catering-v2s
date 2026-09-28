import type {DevicePort, DisplayInfo, DisplaySurfaceInfo, DisplaySize} from '@catering-v2s/kernel-base-platform-ports';
import type {PortResult} from '@catering-v2s/kernel-base-platform-ports';

/**
 * A private bound for device calls made while a runtime is starting or while
 * an actor is deciding whether a role transition is safe.  It is deliberately
 * not part of the public port contract.
 */
export const displayDeviceTimeoutMs = 1_000;

export type DisplayInfoRead =
  | Readonly<{status: 'valid'; displayCount: number}>
  | Readonly<{
      status: 'unavailable';
      portStatus: Exclude<PortResult<DisplayInfo>['status'], 'succeeded'>;
      reason?: string;
      capability?: string;
      port?: string;
      timeoutMs?: number;
      errorCode?: string;
    }>
  | Readonly<{
      status: 'malformed';
      portStatus: 'succeeded';
      valueType: string;
    }>;

export type DisplayFactsSurface = Readonly<{
  readonly surfaceKey: 'PRIMARY' | 'SECONDARY';
  readonly displayIndex: number;
  readonly present: boolean;
  readonly role: 'primary' | 'secondary' | 'unknown';
  readonly logicalSize: DisplaySize | null;
  readonly physicalSize: DisplaySize | null;
  readonly readiness: 'ready' | 'loading' | 'unavailable' | 'unknown';
}>;

export type DisplayFactsReadModel = Readonly<{
  readonly status: 'ready' | 'loading' | 'unavailable' | 'malformed';
  readonly physicalDisplayCount: number | null;
  readonly currentSurfaceKey: 'PRIMARY' | 'SECONDARY' | null;
  readonly surfaces: readonly DisplayFactsSurface[];
  readonly reasonCode: string | null;
}>;

type UnavailableDisplayInfo = Extract<DisplayInfoRead, {status: 'unavailable'}>;

export const toDisplayInfoDiagnostic = (
  displayInfo: UnavailableDisplayInfo,
  statusKey: 'status' | 'portStatus' = 'status',
): Readonly<Record<string, string | number | null>> => ({
  [statusKey]: displayInfo.portStatus,
  reason: displayInfo.reason ?? null,
  capability: displayInfo.capability ?? null,
  timeoutMs: displayInfo.timeoutMs ?? null,
  errorCode: displayInfo.errorCode ?? null,
});

export const isValidDisplayCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 1;

export const readDisplayInfo = async (device: DevicePort): Promise<DisplayInfoRead> => {
  const result = await device.getDisplayInfo({timeoutMs: displayDeviceTimeoutMs});
  if (result.status !== 'succeeded') {
    if (result.status === 'failed') {
      return Object.freeze({
        status: 'unavailable' as const,
        portStatus: result.status,
        port: result.port,
        capability: result.capability,
        errorCode: result.error.code,
      });
    }
    if (result.status === 'timed-out') {
      return Object.freeze({
        status: 'unavailable' as const,
        portStatus: result.status,
        port: result.port,
        capability: result.capability,
        timeoutMs: result.timeoutMs,
      });
    }
    return Object.freeze({
      status: 'unavailable' as const,
      portStatus: result.status,
      port: result.port,
      capability: result.capability,
      reason: result.reason,
    });
  }
  const value = result.value;
  const displayCount = typeof value === 'object' && value !== null ? Reflect.get(value, 'displayCount') : undefined;
  if (!isValidDisplayCount(displayCount)) {
    return Object.freeze({
      status: 'malformed' as const,
      portStatus: result.status,
      valueType: typeof displayCount,
    });
  }
  return Object.freeze({status: 'valid', displayCount});
};

const isPositiveFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isDisplaySize = (value: unknown): value is DisplaySize => {
  if (value === null) return true;
  if (typeof value !== 'object' || value === null) return false;
  return isPositiveFinite(Reflect.get(value, 'width')) && isPositiveFinite(Reflect.get(value, 'height'));
};

const isDisplaySurfaceInfo = (value: unknown): value is DisplaySurfaceInfo => {
  if (typeof value !== 'object' || value === null) return false;
  const displayId = Reflect.get(value, 'displayId');
  if (displayId !== null && (!Number.isInteger(displayId) || displayId < 0)) return false;
  const role = Reflect.get(value, 'role');
  if (role !== 'primary' && role !== 'secondary' && role !== 'unknown') return false;
  const readiness = Reflect.get(value, 'readiness');
  if (readiness !== 'ready' && readiness !== 'loading' && readiness !== 'unavailable' && readiness !== 'unknown')
    return false;
  return isDisplaySize(Reflect.get(value, 'logicalSize')) && isDisplaySize(Reflect.get(value, 'physicalSize'));
};

const emptyDisplayFacts = (
  status: DisplayFactsReadModel['status'],
  physicalDisplayCount: number | null,
  reasonCode: string,
): DisplayFactsReadModel =>
  Object.freeze({
    status,
    physicalDisplayCount,
    currentSurfaceKey: null,
    surfaces: Object.freeze([]),
    reasonCode,
  });

const toDisplayFacts = (value: DisplayInfo): DisplayFactsReadModel => {
  if (!isValidDisplayCount(value.displayCount)) {
    return emptyDisplayFacts('malformed', null, 'DISPLAY_COUNT_MALFORMED');
  }
  if (value.surfaces === undefined) {
    return emptyDisplayFacts('unavailable', value.displayCount, 'DISPLAY_FACTS_NOT_PROVIDED');
  }
  if (value.surfaces.length !== value.displayCount || value.displayCount > 2) {
    return emptyDisplayFacts('malformed', value.displayCount, 'DISPLAY_FACTS_SURFACE_COUNT_UNSUPPORTED');
  }
  if (!value.surfaces.every(isDisplaySurfaceInfo)) {
    return emptyDisplayFacts('malformed', value.displayCount, 'DISPLAY_FACTS_SURFACE_MALFORMED');
  }

  const ordered = [...value.surfaces].sort((left, right) => {
    if (left.role === right.role) return 0;
    if (left.role === 'primary') return -1;
    if (right.role === 'primary') return 1;
    return 0;
  });
  const surfaces = Object.freeze(
    ordered.map((surface, displayIndex) =>
      Object.freeze({
        surfaceKey: displayIndex === 0 ? ('PRIMARY' as const) : ('SECONDARY' as const),
        displayIndex,
        present: true,
        role: surface.role,
        logicalSize: surface.logicalSize === null ? null : Object.freeze({...surface.logicalSize}),
        physicalSize: surface.physicalSize === null ? null : Object.freeze({...surface.physicalSize}),
        readiness: surface.readiness,
      }),
    ),
  );
  return Object.freeze({
    status: 'ready' as const,
    physicalDisplayCount: value.displayCount,
    currentSurfaceKey: null,
    surfaces,
    reasonCode: null,
  });
};

/**
 * Reads the complete display-facts contract for the admin runtime page.  The
 * legacy readDisplayInfo path remains count-only for display-role policy;
 * this richer path is the only owner input allowed to render all surfaces.
 */
export const readDisplayFacts = async (device: DevicePort): Promise<DisplayFactsReadModel> => {
  const result = await device.getDisplayInfo({timeoutMs: displayDeviceTimeoutMs});
  if (result.status !== 'succeeded') {
    return emptyDisplayFacts(
      'unavailable',
      null,
      result.status === 'failed'
        ? result.error.code
        : result.status === 'timed-out'
          ? 'DISPLAY_FACTS_READ_TIMED_OUT'
          : result.reason,
    );
  }
  return toDisplayFacts(result.value);
};
