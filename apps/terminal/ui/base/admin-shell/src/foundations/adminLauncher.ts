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

export const ADMIN_GESTURE_SIZE = 96 as const
export const ADMIN_GESTURE_WINDOW_MS = 1_800 as const
export const ADMIN_GESTURE_REPETITIONS = 5 as const

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
