import {describe, expect, it} from 'vitest'
import {
  applyKeyboardKey,
  normalizeSelection,
  type EditState,
} from '../src/foundations/editText'

const state = (value: string, start: number, end = start, overrides: Partial<EditState> = {}): EditState => ({
  value,
  selection: {start, end},
  shift: false,
  capsLock: false,
  ...overrides,
})

describe('input edit model', () => {
  it('normalizes selection to the current value bounds', () => {
    expect(normalizeSelection('abc', {start: 9, end: -2})).toEqual({start: 0, end: 3})
    expect(normalizeSelection('abc', {start: 2})).toEqual({start: 2, end: 2})
  })

  it('inserts at the cursor and replaces a selected range', () => {
    expect(applyKeyboardKey(state('ac', 1), {kind: 'text', text: 'b'}, 10)).toEqual({
      state: state('abc', 2),
      effect: 'edit',
    })
    expect(applyKeyboardKey(state('abcd', 1, 3), {kind: 'text', text: 'X'}, 10)).toEqual({
      state: state('aXd', 2),
      effect: 'edit',
    })
  })

  it('deletes the selected range or the character before the cursor', () => {
    expect(applyKeyboardKey(state('abcd', 1, 3), {kind: 'backspace'}, 10)).toEqual({
      state: state('ad', 1),
      effect: 'edit',
    })
    expect(applyKeyboardKey(state('abcd', 3), {kind: 'backspace'}, 10)).toEqual({
      state: state('abd', 2),
      effect: 'edit',
    })
  })

  it('applies shift and caps without changing the text until a key is inserted', () => {
    const shifted = applyKeyboardKey(state('', 0), {kind: 'shift'}, 10)
    expect(shifted).toEqual({state: state('', 0, 0, {shift: true}), effect: 'mode'})
    const inserted = applyKeyboardKey(shifted.state, {kind: 'text', text: 'a'}, 10)
    expect(inserted).toEqual({state: state('A', 1), effect: 'edit'})

    const capped = applyKeyboardKey(state('', 0, 0, {capsLock: true}), {kind: 'text', text: 'ab'}, 10)
    expect(capped.state.value).toBe('AB')
    expect(capped.state.selection).toEqual({start: 2, end: 2})
  })

  it('enforces maxLength in the edit model', () => {
    expect(applyKeyboardKey(state('12', 2), {kind: 'text', text: '345'}, 3)).toEqual({
      state: state('123', 3),
      effect: 'edit',
    })
    expect(applyKeyboardKey(state('123', 1, 3), {kind: 'text', text: '456'}, 3)).toEqual({
      state: state('145', 3),
      effect: 'edit',
    })
  })

  it('uses focus-next for a non-final complete key and close-only for the final field', () => {
    expect(applyKeyboardKey(state('value', 5), {kind: 'complete', hasNextField: true}, 10)).toEqual({
      state: state('value', 5),
      effect: 'focus-next',
    })
    expect(applyKeyboardKey(state('value', 5), {kind: 'complete', hasNextField: false}, 10)).toEqual({
      state: state('value', 5),
      effect: 'close-only',
    })
  })
})
