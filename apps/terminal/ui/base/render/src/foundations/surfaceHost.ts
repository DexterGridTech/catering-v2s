import type {DisplayMode} from '@catering-v2s/kernel-base-ui-state';
import type {SurfaceForm} from '@catering-v2s/kernel-base-ui-state';

export type SurfaceHostSize = Readonly<{
  readonly width: number;
  readonly height: number;
}>;

export type SurfaceHostAvailability = 'pending' | 'ready' | 'unavailable';

export type SurfaceCanvasDeclaration = SurfaceHostSize;

export type SurfaceHostMeasurementSnapshot = Readonly<{
  readonly stableHostLogicalSize: SurfaceHostSize;
  readonly isHostPrimaryDisplay: boolean;
}>;

export type SurfaceHostIdentityRejection = Readonly<{
  readonly reason: 'physical-host-flag-mismatch';
  readonly displayIndex: 0 | 1;
  readonly expectedIsHostPrimaryDisplay: boolean;
  readonly actualIsHostPrimaryDisplay: boolean;
}>;

export type SurfaceHostIdentityRejectionHandler = (rejection: SurfaceHostIdentityRejection) => void;

export type SurfaceHostMeasurementSource = Readonly<{
  readonly getSnapshot: () => SurfaceHostMeasurementSnapshot | null;
  readonly subscribe: (listener: (snapshot: SurfaceHostMeasurementSnapshot | null) => void) => () => void;
  /** Optional terminal-status channel supplied by native host adapters. */
  readonly getAvailability?: () => SurfaceHostAvailability;
  readonly subscribeAvailability?: (listener: (availability: SurfaceHostAvailability) => void) => () => void;
}>;

export type SurfaceIdentity = Readonly<{
  readonly surfaceKey: 'PRIMARY' | 'SECONDARY';
  readonly displayIndex: 0 | 1;
  readonly surfaceForm: SurfaceForm;
  readonly displayMode: DisplayMode;
}>;

export type SurfaceHostSnapshot = SurfaceHostMeasurementSnapshot &
  Readonly<{
    readonly surfaceIdentity: SurfaceIdentity;
  }>;

export type SurfaceHostSource = Readonly<{
  readonly getSnapshot: () => SurfaceHostSnapshot | null;
  readonly subscribe: (listener: (snapshot: SurfaceHostSnapshot | null) => void) => () => void;
  /** Optional terminal-status channel supplied by native host adapters. */
  readonly getAvailability?: () => SurfaceHostAvailability;
  readonly subscribeAvailability?: (listener: (availability: SurfaceHostAvailability) => void) => () => void;
  /** Identity remains known when an explicit unavailable event clears geometry. */
  readonly getSurfaceIdentity?: () => SurfaceIdentity;
}>;

/**
 * Binds the physical surface identity at the integration boundary. A host
 * adapter supplies measurements and the physical-host bit; render receives a
 * frozen identity together with those facts and never reconstructs them from
 * display mode or instance mode.
 */
export const bindSurfaceHostIdentity = (
  source: SurfaceHostMeasurementSource,
  identity: SurfaceIdentity,
  onIdentityRejected?: SurfaceHostIdentityRejectionHandler,
): SurfaceHostSource => {
  const frozenIdentity = Object.freeze({...identity});
  let lastMeasurement: SurfaceHostMeasurementSnapshot | null | undefined;
  let lastSnapshot: SurfaceHostSnapshot | null = null;
  const enrich = (snapshot: SurfaceHostMeasurementSnapshot | null): SurfaceHostSnapshot | null => {
    if (snapshot === lastMeasurement) return lastSnapshot;
    lastMeasurement = snapshot;
    if (snapshot === null) {
      lastSnapshot = null;
      return lastSnapshot;
    }
    if (snapshot.isHostPrimaryDisplay !== (frozenIdentity.displayIndex === 0)) {
      onIdentityRejected?.(
        Object.freeze({
          reason: 'physical-host-flag-mismatch',
          displayIndex: frozenIdentity.displayIndex,
          expectedIsHostPrimaryDisplay: frozenIdentity.displayIndex === 0,
          actualIsHostPrimaryDisplay: snapshot.isHostPrimaryDisplay,
        }),
      );
      lastSnapshot = null;
      return lastSnapshot;
    }
    lastSnapshot = Object.freeze({
      stableHostLogicalSize: snapshot.stableHostLogicalSize,
      isHostPrimaryDisplay: snapshot.isHostPrimaryDisplay,
      surfaceIdentity: frozenIdentity,
    });
    return lastSnapshot;
  };
  return Object.freeze({
    getSnapshot: () => enrich(source.getSnapshot()),
    subscribe: listener => source.subscribe(snapshot => listener(enrich(snapshot))),
    ...(source.getAvailability === undefined ? {} : {getAvailability: source.getAvailability}),
    ...(source.subscribeAvailability === undefined ? {} : {subscribeAvailability: source.subscribeAvailability}),
    getSurfaceIdentity: () => frozenIdentity,
  });
};

export type SurfaceHostGeometry = Readonly<{
  readonly canvas: SurfaceCanvasDeclaration;
  readonly host: SurfaceHostSize;
  readonly scaleX: number;
  readonly scaleY: number;
}>;

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0;

export const calculateSurfaceHostGeometry = (
  input: Readonly<{
    readonly canvas: SurfaceCanvasDeclaration;
    readonly snapshot: SurfaceHostSnapshot | null;
  }>,
): SurfaceHostGeometry | null => {
  const canvas = input.canvas;
  const host = input.snapshot?.stableHostLogicalSize;
  if (
    host === undefined ||
    !isPositiveFinite(canvas.width) ||
    !isPositiveFinite(canvas.height) ||
    !isPositiveFinite(host.width) ||
    !isPositiveFinite(host.height)
  )
    return null;

  return Object.freeze({
    canvas,
    host,
    scaleX: host.width / canvas.width,
    scaleY: host.height / canvas.height,
  });
};
