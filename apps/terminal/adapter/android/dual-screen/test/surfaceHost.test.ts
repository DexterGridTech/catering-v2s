import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {acceptAndroidSurfaceHostEvent, type AndroidSurfaceHostSnapshot} from '../src/implementations/surfaceHost'

const {nativeModuleMock, eventListeners} = vi.hoisted(() => ({
  nativeModuleMock: vi.fn(),
  eventListeners: [] as Array<(value: unknown) => void>,
}))

vi.mock('expo-modules-core', () => ({
  LegacyEventEmitter: class LegacyEventEmitter {
    addListener(_eventName: string, listener: (value: unknown) => void) {
      eventListeners.push(listener)
      return {
        remove: () => {
          const index = eventListeners.indexOf(listener)
          if (index >= 0) eventListeners.splice(index, 1)
        },
      }
    }
  },
  requireNativeModule: nativeModuleMock,
}))

const createSnapshot = (overrides: Partial<AndroidSurfaceHostSnapshot> = {}): AndroidSurfaceHostSnapshot => ({
  surfaceKey: 'PRIMARY',
  generation: 1,
  displayId: 0,
  windowIdentity: 'primary',
  orientation: 'landscape',
  stableHostLogicalSize: {width: 1280, height: 800},
  currentHostLogicalSize: {width: 1280, height: 800},
  ime: {visible: false, bottomLogicalBeforeCanvasScale: 0},
  diagnostics: {
    stableWidthPx: 2560,
    stableHeightPx: 1600,
    currentWidthPx: 2560,
    currentHeightPx: 1600,
    hardwareDensityDpi: 320,
    hardwareDensity: 2,
    hardwareScaledDensity: 2,
    surfaceDensityDpi: 320,
    surfaceDensity: 2,
    source: 'android-display-context',
    stableMeasurementContext: 'owner-decorView-layout',
  },
  ...overrides,
})

const readyEvent = (overrides: Partial<AndroidSurfaceHostSnapshot> = {}) => ({
  ...createSnapshot(overrides),
  available: true as const,
})

describe('acceptAndroidSurfaceHostEvent', () => {
  beforeEach(() => {
    eventListeners.length = 0
    nativeModuleMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('accepts a matching surface and pins its display identity', () => {
    const result = acceptAndroidSurfaceHostEvent('PRIMARY', {
      generation: -1,
      displayId: null,
      snapshot: null,
    }, readyEvent())

    expect(result.accepted).toBe(true)
    expect(result.state.generation).toBe(1)
    expect(result.state.displayId).toBe(0)
    expect(result.state.snapshot?.stableHostLogicalSize).toEqual({width: 1280, height: 800})
  })

  it('rejects stale generations, wrong displays, and wrong window identities', () => {
    const first = acceptAndroidSurfaceHostEvent('PRIMARY', {
      generation: -1,
      displayId: null,
      snapshot: null,
    }, readyEvent())

    expect(acceptAndroidSurfaceHostEvent('PRIMARY', first.state, readyEvent({generation: 0})).accepted).toBe(false)
    expect(acceptAndroidSurfaceHostEvent('PRIMARY', first.state, readyEvent({generation: 2, displayId: 2})).accepted).toBe(false)
    expect(acceptAndroidSurfaceHostEvent('PRIMARY', first.state, readyEvent({generation: 2, windowIdentity: 'secondary'})).accepted).toBe(false)
  })

  it('rejects missing logical bounds and non-positive density diagnostics', () => {
    const initialState = {generation: -1, displayId: null, snapshot: null}

    expect(acceptAndroidSurfaceHostEvent('PRIMARY', initialState, readyEvent({
      stableHostLogicalSize: {width: 0, height: 800},
    })).accepted).toBe(false)
    expect(acceptAndroidSurfaceHostEvent('PRIMARY', initialState, readyEvent({
      diagnostics: {...createSnapshot().diagnostics, surfaceDensity: 0},
    })).accepted).toBe(false)
    expect(acceptAndroidSurfaceHostEvent('PRIMARY', initialState, {
      ...readyEvent(),
      diagnostics: {...createSnapshot().diagnostics, surfaceDensity: null},
    }).accepted).toBe(false)
  })

  it('clears a removed surface and accepts a later generation on a new display', () => {
    const first = acceptAndroidSurfaceHostEvent('SECONDARY', {
      generation: -1,
      displayId: null,
      snapshot: null,
    }, readyEvent({
      surfaceKey: 'SECONDARY',
      displayId: 2,
      windowIdentity: 'secondary',
    }))
    const removed = acceptAndroidSurfaceHostEvent('SECONDARY', first.state, {
      available: false,
      surfaceKey: 'SECONDARY',
      generation: 2,
      displayId: 2,
      windowIdentity: 'secondary',
      reason: 'secondary-cleanup',
    })

    expect(removed.accepted).toBe(true)
    expect(removed.state.snapshot).toBeNull()
    expect(acceptAndroidSurfaceHostEvent('SECONDARY', removed.state, readyEvent({
      surfaceKey: 'SECONDARY',
      generation: 3,
      displayId: 3,
      windowIdentity: 'secondary',
    })).accepted).toBe(true)
  })

  it('does not let a stale or wrong-display event overwrite the async initial snapshot', async () => {
    nativeModuleMock.mockReturnValue({
      getSurfaceHostSnapshot: vi.fn(async () => createSnapshot()),
    })
    const source = (await import('../src/implementations/surfaceHost')).createAndroidSurfaceHostSource('PRIMARY')
    const observed: Array<AndroidSurfaceHostSnapshot | null> = []
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const unsubscribe = source.subscribe(snapshot => observed.push(snapshot))
    await Promise.resolve()
    await Promise.resolve()

    expect(source.getSnapshot()?.generation).toBe(1)
    expect(observed).toHaveLength(1)
    eventListeners[0]?.(readyEvent({generation: 0}))
    eventListeners[0]?.(readyEvent({generation: 2, displayId: 2}))
    expect(source.getSnapshot()?.generation).toBe(1)
    expect(observed).toHaveLength(1)
    expect(errorSpy).toHaveBeenCalledTimes(2)

    eventListeners[0]?.({
      available: false,
      surfaceKey: 'PRIMARY',
      generation: 2,
      displayId: 0,
      windowIdentity: 'primary',
      reason: 'primary-destroyed',
    })
    expect(source.getSnapshot()).toBeNull()
    expect(observed.at(-1)).toBeNull()
    unsubscribe()
  })

  it('does not let an accepted event be overwritten by a later same-generation initial snapshot', async () => {
    let resolveInitial: ((snapshot: AndroidSurfaceHostSnapshot) => void) | undefined
    const initialSnapshot = new Promise<AndroidSurfaceHostSnapshot>(resolve => {
      resolveInitial = resolve
    })
    nativeModuleMock.mockReturnValue({
      getSurfaceHostSnapshot: vi.fn(() => initialSnapshot),
    })
    const source = (await import('../src/implementations/surfaceHost')).createAndroidSurfaceHostSource('PRIMARY')
    const observed: Array<AndroidSurfaceHostSnapshot | null> = []
    const unsubscribe = source.subscribe(snapshot => observed.push(snapshot))

    eventListeners[0]?.(readyEvent({
      ime: {visible: true, bottomLogicalBeforeCanvasScale: 240},
    }))
    resolveInitial?.(createSnapshot({
      ime: {visible: false, bottomLogicalBeforeCanvasScale: 0},
    }))
    await Promise.resolve()
    await Promise.resolve()

    expect(source.getSnapshot()?.ime).toEqual({visible: true, bottomLogicalBeforeCanvasScale: 240})
    expect(observed).toHaveLength(1)
    unsubscribe()
  })

  it('ignores a valid broadcast event belonging to the other surface source', async () => {
    nativeModuleMock.mockReturnValue({
      getSurfaceHostSnapshot: vi.fn(async (surfaceKey: string) =>
        surfaceKey === 'PRIMARY'
          ? createSnapshot()
          : createSnapshot({
              surfaceKey: 'SECONDARY',
              displayId: 2,
              windowIdentity: 'secondary',
            })),
    })
    const module = await import('../src/implementations/surfaceHost')
    const primary = module.createAndroidSurfaceHostSource('PRIMARY')
    const secondary = module.createAndroidSurfaceHostSource('SECONDARY')
    const primaryObserved: Array<AndroidSurfaceHostSnapshot | null> = []
    const secondaryObserved: Array<AndroidSurfaceHostSnapshot | null> = []
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const unsubscribePrimary = primary.subscribe(snapshot => primaryObserved.push(snapshot))
    const unsubscribeSecondary = secondary.subscribe(snapshot => secondaryObserved.push(snapshot))
    await Promise.resolve()
    await Promise.resolve()
    errorSpy.mockClear()

    eventListeners.forEach(listener => listener({...readyEvent(), available: true}))

    expect(primary.getSnapshot()?.surfaceKey).toBe('PRIMARY')
    expect(secondary.getSnapshot()?.surfaceKey).toBe('SECONDARY')
    expect(primaryObserved).toHaveLength(2)
    expect(secondaryObserved).toHaveLength(1)
    expect(errorSpy).not.toHaveBeenCalled()

    unsubscribePrimary()
    unsubscribeSecondary()
  })
})
