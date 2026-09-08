import {LegacyEventEmitter, requireNativeModule, type EventSubscription} from 'expo-modules-core'

export type AndroidSurfaceHostSnapshot = Readonly<{
  readonly surfaceKey: 'PRIMARY' | 'SECONDARY'
  readonly generation: number
  readonly displayId: number | null
  readonly windowIdentity: 'primary' | 'secondary'
  readonly orientation: 'portrait' | 'landscape'
  readonly stableHostLogicalSize: Readonly<{readonly width: number; readonly height: number}>
  readonly currentHostLogicalSize: Readonly<{readonly width: number; readonly height: number}>
  readonly ime: Readonly<{
    readonly visible: boolean
    readonly bottomLogicalBeforeCanvasScale: number
  }>
  readonly diagnostics: Readonly<{
    readonly stableWidthPx: number
    readonly stableHeightPx: number
    readonly currentWidthPx: number
    readonly currentHeightPx: number
    readonly hardwareDensityDpi: number
    readonly hardwareDensity: number
    readonly hardwareScaledDensity: number
    readonly surfaceDensityDpi: number
    readonly surfaceDensity: number
    readonly source: 'android-display-context'
    readonly stableMeasurementContext: 'primary-window-ui' | 'secondary-presentation-window-ui' | 'owner-decorView-layout'
  }>
}>

type AndroidSurfaceHostUnavailableEvent = Readonly<{
  readonly available: false
  readonly surfaceKey: 'PRIMARY' | 'SECONDARY'
  readonly generation: number
  readonly displayId: number | null
  readonly windowIdentity: 'primary' | 'secondary'
  readonly reason: string
}>

type AndroidSurfaceHostReadyEvent = AndroidSurfaceHostSnapshot & Readonly<{readonly available: true}>

type AndroidSurfaceHostEvent = AndroidSurfaceHostReadyEvent | AndroidSurfaceHostUnavailableEvent

type NativeDualScreenModule = Readonly<{
  readonly addListener: (eventName: string) => unknown
  readonly getSurfaceHostSnapshot: (surfaceKey: string) => Promise<AndroidSurfaceHostSnapshot | null>
}>

type SurfaceHostSourceState = Readonly<{
  readonly generation: number
  readonly displayId: number | null
  readonly snapshot: AndroidSurfaceHostSnapshot | null
}>

type SurfaceHostAcceptance = Readonly<{
  readonly accepted: boolean
  readonly state: SurfaceHostSourceState
}>

type SurfaceHostSourceSnapshot = Readonly<{
  readonly stableHostLogicalSize: Readonly<{readonly width: number; readonly height: number}>
  readonly ime?: Readonly<{
    readonly visible: boolean
    readonly bottomLogicalBeforeCanvasScale: number
  }>
}>

const eventName = 'onSurfaceHostChanged'

const expectedWindowIdentity = (surfaceKey: 'PRIMARY' | 'SECONDARY'): 'primary' | 'secondary' =>
  surfaceKey === 'PRIMARY' ? 'primary' : 'secondary'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isPositiveNumber = (value: unknown): value is number =>
  isFiniteNumber(value) && value > 0

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

const isSurfaceKey = (value: unknown): value is 'PRIMARY' | 'SECONDARY' =>
  value === 'PRIMARY' || value === 'SECONDARY'

const isWindowIdentity = (value: unknown): value is 'primary' | 'secondary' =>
  value === 'primary' || value === 'secondary'

const isSize = (value: unknown): value is Readonly<{readonly width: number; readonly height: number}> =>
  isRecord(value) && isPositiveNumber(value.width) && isPositiveNumber(value.height)

const isDiagnostics = (value: unknown): value is AndroidSurfaceHostSnapshot['diagnostics'] => {
  if (!isRecord(value)) return false
  if (value.source !== 'android-display-context') return false
  if (
    value.stableMeasurementContext !== 'primary-window-ui' &&
    value.stableMeasurementContext !== 'secondary-presentation-window-ui' &&
    value.stableMeasurementContext !== 'owner-decorView-layout'
  ) return false
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
  ].every(isPositiveNumber)
}

const isReadyEvent = (value: unknown): value is AndroidSurfaceHostReadyEvent => {
  if (!isRecord(value) || value.available !== true) return false
  if (!isSurfaceKey(value.surfaceKey) || !isWindowIdentity(value.windowIdentity)) return false
  if (!isNonNegativeInteger(value.generation) || !isNonNegativeInteger(value.displayId)) return false
  if (value.orientation !== 'portrait' && value.orientation !== 'landscape') return false
  if (!isSize(value.stableHostLogicalSize) || !isSize(value.currentHostLogicalSize)) return false
  if (!isRecord(value.ime)) return false
  if (typeof value.ime.visible !== 'boolean' || !isFiniteNumber(value.ime.bottomLogicalBeforeCanvasScale)) return false
  if (value.ime.bottomLogicalBeforeCanvasScale < 0 || !isDiagnostics(value.diagnostics)) return false
  return true
}

const isUnavailableEvent = (value: unknown): value is AndroidSurfaceHostUnavailableEvent =>
  isRecord(value) &&
  value.available === false &&
  isSurfaceKey(value.surfaceKey) &&
  isNonNegativeInteger(value.generation) &&
  (value.displayId === null || isNonNegativeInteger(value.displayId)) &&
  isWindowIdentity(value.windowIdentity) &&
  typeof value.reason === 'string' &&
  value.reason.length > 0

const isKnownSurfaceHostEvent = (value: unknown): value is AndroidSurfaceHostEvent =>
  isReadyEvent(value) || isUnavailableEvent(value)

const isForeignSurfaceHostEvent = (surfaceKey: 'PRIMARY' | 'SECONDARY', value: unknown): boolean =>
  isKnownSurfaceHostEvent(value) && value.surfaceKey !== surfaceKey

const withoutAvailability = (event: AndroidSurfaceHostReadyEvent): AndroidSurfaceHostSnapshot => {
  const {available: _available, ...snapshot} = event
  return snapshot
}

const initialState: SurfaceHostSourceState = Object.freeze({
  generation: -1,
  displayId: null,
  snapshot: null,
})

/**
 * Applies the adapter's identity and generation fence before a host fact can
 * reach render. Keeping this pure makes the stale/wrong-surface cases testable
 * without pretending a mocked native callback is an Android run.
 */
export const acceptAndroidSurfaceHostEvent = (
  surfaceKey: 'PRIMARY' | 'SECONDARY',
  state: SurfaceHostSourceState,
  value: unknown,
): SurfaceHostAcceptance => {
  if (!isReadyEvent(value) && !isUnavailableEvent(value)) return {accepted: false, state}
  if (value.surfaceKey !== surfaceKey || value.windowIdentity !== expectedWindowIdentity(surfaceKey)) {
    return {accepted: false, state}
  }
  if (value.generation < state.generation) return {accepted: false, state}
  if (state.displayId !== null && value.displayId !== null && value.displayId !== state.displayId) {
    return {accepted: false, state}
  }
  if (isUnavailableEvent(value)) {
    return {
      accepted: true,
      state: Object.freeze({generation: value.generation, displayId: null, snapshot: null}),
    }
  }
  return {
    accepted: true,
    state: Object.freeze({
      generation: value.generation,
      displayId: value.displayId,
      snapshot: withoutAvailability(value),
    }),
  }
}

const getNativeModule = (): NativeDualScreenModule =>
  requireNativeModule<NativeDualScreenModule>('TerminalDualScreen')

export const createAndroidSurfaceHostSource = (surfaceKey: 'PRIMARY' | 'SECONDARY') => {
  let state = initialState
  let current: AndroidSurfaceHostSnapshot | null = null
  let hasAcceptedEvent = false
  let emitter: LegacyEventEmitter | null = null

  const getEmitter = () => {
    if (emitter === null) emitter = new LegacyEventEmitter(getNativeModule())
    return emitter
  }

  const apply = (value: unknown, listener?: (snapshot: SurfaceHostSourceSnapshot | null) => void) => {
    // The native module broadcasts one event stream to both surface sources.
    // A valid event for the other surface is expected traffic, not an identity
    // violation for this source. The matching source still applies the full
    // generation/display/window fence below.
    if (isForeignSurfaceHostEvent(surfaceKey, value)) return
    const result = acceptAndroidSurfaceHostEvent(surfaceKey, state, value)
    if (!result.accepted) {
      console.error(
        `[TerminalDualScreen] surface host event rejected surfaceKey=${surfaceKey} reason=identity-or-generation-fence`,
      )
      return
    }
    state = result.state
    current = state.snapshot
    hasAcceptedEvent = true
    listener?.(current)
  }

  return Object.freeze({
    getSnapshot: () => current,
    subscribe: (listener: (snapshot: SurfaceHostSourceSnapshot | null) => void): (() => void) => {
      let active = true
      const update = (event: unknown) => {
        if (active) apply(event, listener)
      }
      const subscription = getEmitter().addListener(eventName, update) as EventSubscription
      void getNativeModule().getSurfaceHostSnapshot(surfaceKey).then((snapshot) => {
        if (!active || snapshot === null || hasAcceptedEvent) return
        apply({...snapshot, available: true}, listener)
      }).catch((error: unknown) => {
        const errorName = error instanceof Error ? error.name : 'UnknownError'
        console.error(
          `[TerminalDualScreen] surface host snapshot unavailable surfaceKey=${surfaceKey} error=${errorName}`,
        )
      })
      return () => {
        active = false
        subscription.remove()
      }
    },
  })
}
