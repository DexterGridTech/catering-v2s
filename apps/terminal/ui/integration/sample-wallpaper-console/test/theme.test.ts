import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'

const expectedTokens = Object.freeze({
  canvas: [241, 245, 249],
  surface: [255, 255, 255],
  foreground: [15, 23, 42],
  'muted-foreground': [71, 85, 105],
  border: [203, 213, 225],
  action: [159, 18, 57],
  'action-foreground': [255, 255, 255],
  'ok-foreground': [21, 128, 61],
  'ok-background': [240, 253, 244],
  'ok-border': [134, 239, 172],
  'warn-foreground': [161, 98, 7],
  'warn-background': [254, 252, 232],
  'warn-border': [253, 224, 71],
  'error-foreground': [185, 28, 28],
  'error-background': [254, 242, 242],
  'error-border': [252, 165, 165],
  'info-foreground': [3, 105, 161],
  'info-background': [240, 249, 255],
  'info-border': [125, 211, 252],
} as const)

const rgb = (name: string): readonly [number, number, number] => {
  const source = readFileSync(new URL('../theme/global.css', import.meta.url), 'utf8')
  const match = source.match(new RegExp(`--color-${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`))
  if (match === null) throw new Error(`missing token ${name}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

const luminance = (value: readonly [number, number, number]): number => {
  const channels = value.map(channel => {
    const normalized = channel / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

const hue = (value: readonly [number, number, number]): number => {
  const channels = value.map(channel => channel / 255)
  const max = Math.max(...channels)
  const min = Math.min(...channels)
  const delta = max - min
  if (delta === 0) return 0
  const raw = max === channels[0]
    ? ((channels[1] - channels[2]) / delta) % 6
    : max === channels[1]
      ? (channels[2] - channels[0]) / delta + 2
      : (channels[0] - channels[1]) / delta + 4
  return (raw * 60 + 360) % 360
}

const circularHueDistance = (first: number, second: number): number => {
  const direct = Math.abs(first - second)
  return Math.min(direct, 360 - direct)
}

const hslOf = (value: readonly [number, number, number]): Readonly<{
  readonly hue: number
  readonly saturation: number
  readonly lightness: number
}> => {
  const channels = value.map(channel => channel / 255)
  const max = Math.max(...channels)
  const min = Math.min(...channels)
  const delta = max - min
  const lightness = (max + min) / 2
  if (delta === 0) return {hue: 0, saturation: 0, lightness}
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  return {hue: hue(value), saturation, lightness}
}

describe('sample2 red application theme', () => {
  it('declares the exact 19 semantic tokens and tailwind mappings', () => {
    const css = readFileSync(new URL('../theme/global.css', import.meta.url), 'utf8')
    const tailwind = readFileSync(new URL('../tailwind.config.cjs', import.meta.url), 'utf8')
    for (const [name, value] of Object.entries(expectedTokens)) {
      expect(rgb(name)).toEqual(value)
      expect(tailwind.includes(`${name}:`) || tailwind.includes(`'${name}':`)).toBe(true)
      expect(css).toContain(`--color-${name}:`)
    }
  })

  it('keeps red action distinct from error while preserving readable action text', () => {
    const action = rgb('action')
    const actionForeground = rgb('action-foreground')
    const error = rgb('error-foreground')
    const contrast = (first: readonly [number, number, number], second: readonly [number, number, number]) => {
      const firstL = luminance(first)
      const secondL = luminance(second)
      return (Math.max(firstL, secondL) + 0.05) / (Math.min(firstL, secondL) + 0.05)
    }
    const actionHsl = hslOf(action)
    const hueDistance = circularHueDistance(actionHsl.hue, hue(error))
    const luminanceDistance = Math.abs(luminance(action) - luminance(error))
    expect(contrast(action, actionForeground)).toBeGreaterThanOrEqual(4.5)
    expect(actionHsl.hue >= 340 || actionHsl.hue <= 20).toBe(true)
    expect(actionHsl.saturation).toBeGreaterThanOrEqual(0.4)
    expect(actionHsl.lightness).toBeGreaterThanOrEqual(0.25)
    expect(actionHsl.lightness).toBeLessThanOrEqual(0.65)
    expect(hueDistance >= 15 || luminanceDistance >= 0.15).toBe(true)
    expect(expectedTokens['error-foreground']).toEqual([185, 28, 28])
  })

  it('uses circular hue distance at the red hue wrap boundary', () => {
    const nearWrapAction = [220, 20, 30] as const
    const error = rgb('error-foreground')
    expect(circularHueDistance(hue(nearWrapAction), hue(error))).toBeLessThan(15)
  })
})
