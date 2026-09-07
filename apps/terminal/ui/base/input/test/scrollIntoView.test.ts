import {describe, expect, it} from 'vitest'
import {calculateScrollOffset} from '../src/foundations/scrollIntoView'

const rect = (y: number, height: number) => ({x: 0, y, width: 100, height})

describe('scroll into the post-keyboard visible area', () => {
  it('does not subtract the keyboard twice when the viewport is already shrunk', () => {
    expect(calculateScrollOffset({
      inputRect: rect(200, 40),
      viewportRect: rect(0, 100),
      currentOffset: 10,
      keyboardHeight: 60,
      viewportAlreadyShrunk: true,
    })).toBe(150)
  })

  it('subtracts the keyboard only for an unshrunk viewport', () => {
    expect(calculateScrollOffset({
      inputRect: rect(200, 40),
      viewportRect: rect(0, 200),
      currentOffset: 10,
      keyboardHeight: 60,
      viewportAlreadyShrunk: false,
    })).toBe(110)
  })

  it('scrolls upward when the focused input starts above the viewport', () => {
    expect(calculateScrollOffset({
      inputRect: rect(-20, 40),
      viewportRect: rect(0, 100),
      currentOffset: 30,
      keyboardHeight: 0,
      viewportAlreadyShrunk: true,
    })).toBe(10)
  })

  it('leaves an already visible input at the current offset', () => {
    expect(calculateScrollOffset({
      inputRect: rect(20, 40),
      viewportRect: rect(0, 100),
      currentOffset: 12,
      keyboardHeight: 60,
      viewportAlreadyShrunk: true,
    })).toBe(12)
  })
})
