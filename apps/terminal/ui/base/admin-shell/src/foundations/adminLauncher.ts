export type AdminGesturePoint = Readonly<{
  readonly x: number
  readonly y: number
  readonly atMs: number
}>

export type AdminGestureState = Readonly<{
  readonly startedAtMs: number | null
  readonly repetitions: number
}>

export type AdminGestureResult = Readonly<{
  readonly completed: boolean
  readonly state: AdminGestureState
}>

export type AdminGestureCoordinateSpace = Readonly<{
  readonly originX: number
  readonly originY: number
  readonly scaleX: number
  readonly scaleY: number
}>

export const ADMIN_GESTURE_SIZE = 96 as const
export const ADMIN_GESTURE_WINDOW_MS = 1_800 as const
export const ADMIN_GESTURE_REPETITIONS = 5 as const

export const logicalPointFromWindow = (input: Readonly<{
  readonly pageX: number
  readonly pageY: number
  readonly space: AdminGestureCoordinateSpace
}>): Readonly<{readonly x: number; readonly y: number}> | null => {
  const {pageX, pageY, space} = input
  if (
    !Number.isFinite(pageX)
    || !Number.isFinite(pageY)
    || !Number.isFinite(space.originX)
    || !Number.isFinite(space.originY)
    || !Number.isFinite(space.scaleX)
    || !Number.isFinite(space.scaleY)
    || space.scaleX <= 0
    || space.scaleY <= 0
  ) return null
  return Object.freeze({
    x: (pageX - space.originX) / space.scaleX,
    y: (pageY - space.originY) / space.scaleY,
  })
}

type UnknownRecord = Readonly<Record<string, unknown>>

const asRecord = (value: unknown): UnknownRecord | null =>
  typeof value === 'object' && value !== null ? value as UnknownRecord : null

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const firstTouchOf = (value: unknown): UnknownRecord | null => {
  const list = asRecord(value)
  if (list === null) return null
  return asRecord(list[0])
}

const coordinateOf = (primary: UnknownRecord | null, fallback: UnknownRecord | null, axis: 'X' | 'Y'): number | null => {
  const pageKey = axis === 'X' ? 'pageX' : 'pageY'
  const clientKey = axis === 'X' ? 'clientX' : 'clientY'
  return finiteNumber(primary?.[pageKey])
    ?? finiteNumber(fallback?.[pageKey])
    ?? finiteNumber(primary?.[clientKey])
    ?? finiteNumber(fallback?.[clientKey])
}

/**
 * Reads the coordinate shapes emitted by native RN and by browser events.
 * The result remains a window-coordinate pair so the caller can apply the
 * existing host-to-canvas logical transform.
 */
export const adminLauncherPointFromEvent = (event: unknown): Readonly<{
  readonly pageX: number
  readonly pageY: number
}> | null => {
  const eventRecord = asRecord(event)
  const source = asRecord(eventRecord?.nativeEvent ?? event)
  const touch = firstTouchOf(source?.changedTouches) ?? firstTouchOf(source?.touches)
  const pageX = coordinateOf(touch, source, 'X')
  const pageY = coordinateOf(touch, source, 'Y')
  if (pageX === null || pageY === null) return null
  return Object.freeze({pageX, pageY})
}

const initialState = (): AdminGestureState => Object.freeze({startedAtMs: null, repetitions: 0})

const isInsideGestureArea = (point: AdminGesturePoint): boolean =>
  Number.isFinite(point.x)
  && Number.isFinite(point.y)
  && point.x >= 0
  && point.x <= ADMIN_GESTURE_SIZE
  && point.y >= 0
  && point.y <= ADMIN_GESTURE_SIZE

export const trackAdminGesture = (
  state: AdminGestureState,
  point: AdminGesturePoint,
): AdminGestureResult => {
  if (!isInsideGestureArea(point) || !Number.isFinite(point.atMs)) {
    return Object.freeze({completed: false, state: initialState()})
  }
  const expired = state.startedAtMs === null || point.atMs - state.startedAtMs > ADMIN_GESTURE_WINDOW_MS
  const nextState = expired
    ? Object.freeze({startedAtMs: point.atMs, repetitions: 1})
    : Object.freeze({startedAtMs: state.startedAtMs, repetitions: state.repetitions + 1})
  if (nextState.repetitions < ADMIN_GESTURE_REPETITIONS) {
    return Object.freeze({completed: false, state: nextState})
  }
  return Object.freeze({completed: true, state: initialState()})
}

export const createInitialAdminGestureState = initialState
