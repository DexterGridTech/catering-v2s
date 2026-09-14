import {describe, expect, it} from 'vitest'
import {
  ADMIN_GESTURE_REPETITIONS,
  ADMIN_GESTURE_SIZE,
  ADMIN_GESTURE_WINDOW_MS,
  adminLauncherPointFromEvent,
  createInitialAdminGestureState,
  trackAdminGesture,
} from '../src/foundations/adminLauncher'

import {logicalPointFromWindow} from '../src/foundations/adminLauncher'

describe('admin launcher gesture', () => {
  it('extracts native, Web touch, and Web mouse coordinate shapes', () => {
    expect(adminLauncherPointFromEvent({nativeEvent: {pageX: 10, pageY: 20}})).toEqual({pageX: 10, pageY: 20})
    expect(adminLauncherPointFromEvent({nativeEvent: {
      changedTouches: [{pageX: 30, pageY: 40}],
    }})).toEqual({pageX: 30, pageY: 40})
    expect(adminLauncherPointFromEvent({nativeEvent: {
      touches: [{clientX: 50, clientY: 60}],
    }})).toEqual({pageX: 50, pageY: 60})
    expect(adminLauncherPointFromEvent({clientX: 70, clientY: 80})).toEqual({pageX: 70, pageY: 80})
    expect(adminLauncherPointFromEvent({nativeEvent: {changedTouches: []}})).toBeNull()
  })

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

  it('converts window coordinates to logical coordinates before applying the 96-unit gate', () => {
    const enlarged = logicalPointFromWindow({
      pageX: 100 + 2 * 95,
      pageY: 200 + 1.5 * 95,
      space: {originX: 100, originY: 200, scaleX: 2, scaleY: 1.5},
    })
    expect(enlarged).toEqual({x: 95, y: 95})
    expect(trackAdminGesture(createInitialAdminGestureState(), {
      x: enlarged!.x,
      y: enlarged!.y,
      atMs: 0,
    }).state.repetitions).toBe(1)

    const reduced = logicalPointFromWindow({
      pageX: 100 + 0.5 * 100,
      pageY: 200 + 0.5 * 100,
      space: {originX: 100, originY: 200, scaleX: 0.5, scaleY: 0.5},
    })
    expect(reduced).toEqual({x: 100, y: 100})
    expect(trackAdminGesture(createInitialAdminGestureState(), {
      x: reduced!.x,
      y: reduced!.y,
      atMs: 0,
    }).state).toEqual(createInitialAdminGestureState())
  })
})
