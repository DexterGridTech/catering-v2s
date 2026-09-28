import {requireNativeModule, type EventSubscription} from 'expo-modules-core';

export type AndroidSurfaceHostSnapshot = Readonly<{
  readonly surfaceKey: 'PRIMARY' | 'SECONDARY';
  readonly generation: number;
  readonly displayId: number | null;
  readonly isHostPrimaryDisplay: boolean;
  readonly windowIdentity: 'primary' | 'secondary';
  readonly orientation: 'portrait' | 'landscape';
  readonly stableHostLogicalSize: Readonly<{readonly width: number; readonly height: number}>;
  readonly currentHostLogicalSize: Readonly<{readonly width: number; readonly height: number}>;
  readonly diagnostics: Readonly<{
    readonly stableWidthPx: number;
    readonly stableHeightPx: number;
    readonly currentWidthPx: number;
    readonly currentHeightPx: number;
    readonly hardwareDensityDpi: number;
    readonly hardwareDensity: number;
    readonly hardwareScaledDensity: number;
    readonly surfaceDensityDpi: number;
    readonly surfaceDensity: number;
    readonly source: 'android-display-context';
    readonly stableMeasurementContext:
      'primary-window-ui' | 'secondary-presentation-window-ui' | 'owner-decorView-layout';
  }>;
}>;

type AndroidSurfaceHostRecoverableRemovalEvent = Readonly<{
  readonly available: false;
  readonly status: 'recovering';
  readonly surfaceKey: 'PRIMARY' | 'SECONDARY';
  readonly generation: number;
  readonly displayId: number | null;
  readonly windowIdentity: 'primary' | 'secondary';
  readonly reason: string;
}>;

type AndroidSurfaceHostUnavailableEvent = Readonly<{
  readonly available: false;
  readonly status: 'unavailable';
  readonly surfaceKey: 'PRIMARY' | 'SECONDARY';
  readonly generation: number;
  readonly displayId: number | null;
  readonly windowIdentity: 'primary' | 'secondary';
  readonly reason: string;
}>;

type AndroidSurfaceHostReadyEvent = AndroidSurfaceHostSnapshot & Readonly<{readonly available: true}>;

type AndroidSurfaceHostEvent =
  AndroidSurfaceHostReadyEvent | AndroidSurfaceHostRecoverableRemovalEvent | AndroidSurfaceHostUnavailableEvent;

type NativeDualScreenModule = Readonly<{
  readonly addListener: (eventName: string, listener: (event: unknown) => void) => EventSubscription;
  readonly getSurfaceHostSnapshot: (surfaceKey: string) => Promise<unknown | null>;
}>;

type SurfaceHostSourceState = Readonly<{
  readonly generation: number;
  readonly displayId: number | null;
  readonly snapshot: AndroidSurfaceHostSnapshot | null;
}>;

type SurfaceHostAcceptance = Readonly<{
  readonly accepted: boolean;
  readonly state: SurfaceHostSourceState;
  readonly eventKind: 'ready' | 'recoverable-removal' | 'unavailable' | 'ignored';
}>;

export type AndroidSurfaceHostMeasurementSnapshot = Readonly<{
  readonly stableHostLogicalSize: Readonly<{readonly width: number; readonly height: number}>;
  readonly isHostPrimaryDisplay: boolean;
}>;

export type AndroidSurfaceHostAvailability = 'pending' | 'ready' | 'unavailable';

const eventName = 'onSurfaceHostChanged';

const expectedWindowIdentity = (surfaceKey: 'PRIMARY' | 'SECONDARY'): 'primary' | 'secondary' =>
  surfaceKey === 'PRIMARY' ? 'primary' : 'secondary';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isPositiveNumber = (value: unknown): value is number => isFiniteNumber(value) && value > 0;

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isSurfaceKey = (value: unknown): value is 'PRIMARY' | 'SECONDARY' => value === 'PRIMARY' || value === 'SECONDARY';

const isWindowIdentity = (value: unknown): value is 'primary' | 'secondary' =>
  value === 'primary' || value === 'secondary';

const isSize = (value: unknown): value is Readonly<{readonly width: number; readonly height: number}> =>
  isRecord(value) && isPositiveNumber(value.width) && isPositiveNumber(value.height);

const isDiagnostics = (value: unknown): value is AndroidSurfaceHostSnapshot['diagnostics'] => {
  if (!isRecord(value)) return false;
  if (value.source !== 'android-display-context') return false;
  if (
    value.stableMeasurementContext !== 'primary-window-ui' &&
    value.stableMeasurementContext !== 'secondary-presentation-window-ui' &&
    value.stableMeasurementContext !== 'owner-decorView-layout'
  )
    return false;
  return [
    value.stableWidthPx,
    value.stableHeightPx,
    value.currentWidthPx,
    value.currentHeightPx,
    value.hardwareDensityDpi,
    value.hardwareDensity,
    value.hardwareScaledDensity,
    value.surfaceDensityDpi,
    value.surfaceDensity,
  ].every(isPositiveNumber);
};

const isReadyEvent = (value: unknown): value is AndroidSurfaceHostReadyEvent => {
  if (!isRecord(value) || value.available !== true) return false;
  if (!isSurfaceKey(value.surfaceKey) || !isWindowIdentity(value.windowIdentity)) return false;
  if (!isNonNegativeInteger(value.generation) || !isNonNegativeInteger(value.displayId)) return false;
  if (typeof value.isHostPrimaryDisplay !== 'boolean') return false;
  if (value.orientation !== 'portrait' && value.orientation !== 'landscape') return false;
  if (!isSize(value.stableHostLogicalSize) || !isSize(value.currentHostLogicalSize)) return false;
  if (!isDiagnostics(value.diagnostics)) return false;
  return true;
};

const isUnavailableEvent = (value: unknown): value is AndroidSurfaceHostUnavailableEvent =>
  isRecord(value) &&
  value.available === false &&
  value.status === 'unavailable' &&
  isSurfaceKey(value.surfaceKey) &&
  isNonNegativeInteger(value.generation) &&
  (value.displayId === null || isNonNegativeInteger(value.displayId)) &&
  isWindowIdentity(value.windowIdentity) &&
  typeof value.reason === 'string' &&
  value.reason.length > 0;

const isRecoverableRemovalEvent = (value: unknown): value is AndroidSurfaceHostRecoverableRemovalEvent =>
  isRecord(value) &&
  value.available === false &&
  value.status === 'recovering' &&
  isSurfaceKey(value.surfaceKey) &&
  isNonNegativeInteger(value.generation) &&
  (value.displayId === null || isNonNegativeInteger(value.displayId)) &&
  isWindowIdentity(value.windowIdentity) &&
  typeof value.reason === 'string' &&
  value.reason.length > 0;

const isKnownSurfaceHostEvent = (value: unknown): value is AndroidSurfaceHostEvent =>
  isReadyEvent(value) || isRecoverableRemovalEvent(value) || isUnavailableEvent(value);

const isForeignSurfaceHostEvent = (surfaceKey: 'PRIMARY' | 'SECONDARY', value: unknown): boolean =>
  isKnownSurfaceHostEvent(value) && value.surfaceKey !== surfaceKey;

const isPhysicalIdentityMismatch = (value: unknown, expectedDisplayIndex: 0 | 1 | undefined): boolean =>
  isReadyEvent(value) &&
  expectedDisplayIndex !== undefined &&
  value.isHostPrimaryDisplay !== (expectedDisplayIndex === 0);

const withoutAvailability = (event: AndroidSurfaceHostReadyEvent): AndroidSurfaceHostSnapshot => {
  const {available: _available, ...snapshot} = event;
  return snapshot;
};

const initialState: SurfaceHostSourceState = Object.freeze({
  generation: -1,
  displayId: null,
  snapshot: null,
});

/**
 * Applies the adapter's identity and generation fence before a host fact can
 * reach render. Keeping this pure makes the stale/wrong-surface cases testable
 * without pretending a mocked native callback is an Android run.
 */
export type AndroidSurfaceHostEventInput = Readonly<{
  readonly surfaceKey: 'PRIMARY' | 'SECONDARY';
  readonly state: SurfaceHostSourceState;
  readonly value: unknown;
  readonly expectedDisplayIndex?: 0 | 1;
}>;

export const acceptAndroidSurfaceHostEvent = ({
  surfaceKey,
  state,
  value,
  expectedDisplayIndex,
}: AndroidSurfaceHostEventInput): SurfaceHostAcceptance => {
  if (!isReadyEvent(value) && !isRecoverableRemovalEvent(value) && !isUnavailableEvent(value)) {
    return {accepted: false, state, eventKind: 'ignored'};
  }
  if (value.surfaceKey !== surfaceKey || value.windowIdentity !== expectedWindowIdentity(surfaceKey)) {
    return {accepted: false, state, eventKind: 'ignored'};
  }
  if (
    expectedDisplayIndex !== undefined &&
    isReadyEvent(value) &&
    value.isHostPrimaryDisplay !== (expectedDisplayIndex === 0)
  )
    return {accepted: false, state, eventKind: 'ignored'};
  if (value.generation < state.generation) return {accepted: false, state, eventKind: 'ignored'};
  if (state.displayId !== null && value.displayId !== null && value.displayId !== state.displayId) {
    return {accepted: false, state, eventKind: 'ignored'};
  }
  if (isRecoverableRemovalEvent(value)) {
    return {accepted: true, state, eventKind: 'recoverable-removal'};
  }
  if (isUnavailableEvent(value)) {
    return {
      accepted: true,
      state: Object.freeze({generation: value.generation, displayId: null, snapshot: null}),
      eventKind: 'unavailable',
    };
  }
  return {
    accepted: true,
    state: Object.freeze({
      generation: value.generation,
      displayId: value.displayId,
      snapshot: withoutAvailability(value),
    }),
    eventKind: 'ready',
  };
};

const getNativeModule = (): NativeDualScreenModule => requireNativeModule<NativeDualScreenModule>('TerminalDualScreen');

export type AndroidSurfaceHostSourceInput = Readonly<{
  readonly surfaceKey: 'PRIMARY' | 'SECONDARY';
  readonly displayIndex: 0 | 1;
}>;

const toMeasurementSnapshot = (
  snapshot: AndroidSurfaceHostSnapshot | null,
): AndroidSurfaceHostMeasurementSnapshot | null =>
  snapshot === null
    ? null
    : Object.freeze({
        stableHostLogicalSize: snapshot.stableHostLogicalSize,
        isHostPrimaryDisplay: snapshot.isHostPrimaryDisplay,
      });

export const createAndroidSurfaceHostSource = (input: AndroidSurfaceHostSourceInput) => {
  const {surfaceKey, displayIndex} = input;
  let state = initialState;
  let current: AndroidSurfaceHostSnapshot | null = null;
  let hasAcceptedEvent = false;
  let availability: AndroidSurfaceHostAvailability = 'pending';
  const availabilityListeners = new Set<(next: AndroidSurfaceHostAvailability) => void>();

  const setAvailability = (next: AndroidSurfaceHostAvailability) => {
    if (availability === next) return;
    availability = next;
    for (const listener of [...availabilityListeners]) listener(next);
  };

  const apply = (value: unknown, listener?: (snapshot: AndroidSurfaceHostMeasurementSnapshot | null) => void) => {
    // The native module broadcasts one event stream to both surface sources.
    // A valid event for the other surface is expected traffic, not an identity
    // violation for this source. The matching source still applies the full
    // generation/display/window fence below.
    if (isForeignSurfaceHostEvent(surfaceKey, value)) return;
    const result = acceptAndroidSurfaceHostEvent({surfaceKey, state, value, expectedDisplayIndex: displayIndex});
    if (!result.accepted) {
      if (isPhysicalIdentityMismatch(value, displayIndex)) {
        // A matching surface event that proves this host is on the wrong
        // physical display is terminal for this bound source. Leaving the
        // source pending would keep the native splash forever and would not
        // allow the render-owned R-S7 failure page to take over.
        setAvailability('unavailable');
        listener?.(null);
      }
      console.error(
        `[TerminalDualScreen] surface host event rejected surfaceKey=${surfaceKey} reason=identity-or-generation-fence`,
      );
      return;
    }
    state = result.state;
    if (result.eventKind === 'recoverable-removal') return;
    current = state.snapshot;
    hasAcceptedEvent = true;
    setAvailability(isUnavailableEvent(value) ? 'unavailable' : 'ready');
    listener?.(toMeasurementSnapshot(current));
  };

  return Object.freeze({
    getSnapshot: () => current,
    subscribe: (listener: (snapshot: AndroidSurfaceHostMeasurementSnapshot | null) => void): (() => void) => {
      let active = true;
      const update = (event: unknown) => {
        if (active) apply(event, listener);
      };
      const subscription = getNativeModule().addListener(eventName, update);
      void getNativeModule()
        .getSurfaceHostSnapshot(surfaceKey)
        .then(snapshot => {
          if (!active || snapshot === null || hasAcceptedEvent) return;
          apply(snapshot, listener);
        })
        .catch((error: unknown) => {
          const errorName = error instanceof Error ? error.name : 'UnknownError';
          setAvailability('unavailable');
          console.error(
            `[TerminalDualScreen] surface host snapshot unavailable surfaceKey=${surfaceKey} error=${errorName}`,
          );
        });
      return () => {
        active = false;
        subscription.remove();
      };
    },
    getAvailability: () => availability,
    subscribeAvailability: (listener: (next: AndroidSurfaceHostAvailability) => void) => {
      availabilityListeners.add(listener);
      return () => availabilityListeners.delete(listener);
    },
  });
};
