import {describe, expect, it} from 'vitest'
import {
  ADMIN_GESTURE_REPETITIONS,
  ADMIN_GESTURE_SIZE,
  ADMIN_GESTURE_WINDOW_MS,
  createInitialAdminGestureState,
  trackAdminGesture,
} from '../src/foundations/adminLauncher'

describe('admin launcher gesture', () => {
  it('opens only after five in-bounds presses inside one time window', () => {
    expect(ADMIN_GESTURE_REPETITIONS).toBe(5)
    expect(ADMIN_GESTURE_SIZE).toBe(96)
    expect(ADMIN_GESTURE_WINDOW_MS).toBe(1_800)
    let state = createInitialAdminGestureState()
    for (let index = 0; index < ADMIN_GESTURE_REPETITIONS - 1; index += 1) {
      const result = trackAdminGesture(state, {x: 1, y: ADMIN_GESTURE_SIZE, atMs: index * 100})
      expect(result.completed).toBe(false)
      state = result.state
    }
    const completed = trackAdminGesture(state, {x: ADMIN_GESTURE_SIZE, y: 1, atMs: 400})
    expect(completed.completed).toBe(true)
    expect(completed.state).toEqual(createInitialAdminGestureState())
  })

  it('resets for an out-of-bounds or expired press', () => {
    const first = trackAdminGesture(createInitialAdminGestureState(), {x: 1, y: 1, atMs: 0})
    expect(trackAdminGesture(first.state, {x: -1, y: 1, atMs: 10}).state).toEqual(createInitialAdminGestureState())
    const expired = trackAdminGesture(first.state, {x: 1, y: 1, atMs: ADMIN_GESTURE_WINDOW_MS + 1})
    expect(expired.state).toEqual({startedAtMs: ADMIN_GESTURE_WINDOW_MS + 1, repetitions: 1})
  })
})
