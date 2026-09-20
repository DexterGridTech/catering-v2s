import {describe, expect, it} from 'vitest'
import {
  getSurfaceDeclarations,
  readTerminalSurfaces,
  surfaceFormForOrientation,
  terminalSurfaces,
} from '../src'

describe('sample2 terminal surface declarations', () => {
  it('freezes laptop dual-screen and mobile primary-only logical sizes', () => {
    expect(terminalSurfaces).toEqual({
      orientations: {
        landscape: {
          PRIMARY: {width: 1280, height: 800},
          SECONDARY: {width: 1280, height: 800},
        },
        portrait: {PRIMARY: {width: 360, height: 640}},
      },
    })
    expect(getSurfaceDeclarations(terminalSurfaces, 'laptop')).toBe(terminalSurfaces.orientations.landscape)
    expect(getSurfaceDeclarations(terminalSurfaces, 'mobile')).toBe(terminalSurfaces.orientations.portrait)
    expect(surfaceFormForOrientation('landscape')).toBe('laptop')
    expect(surfaceFormForOrientation('portrait')).toBe('mobile')
  })

  it('rejects a portrait secondary declaration instead of silently creating a second mobile surface', () => {
    expect(() => readTerminalSurfaces({
      orientations: {
        landscape: {
          PRIMARY: {width: 1280, height: 800},
          SECONDARY: {width: 1280, height: 800},
        },
        portrait: {
          PRIMARY: {width: 360, height: 640},
          SECONDARY: {width: 1, height: 1},
        },
      },
    })).toThrow(/SECONDARY is not allowed in portrait/)
  })
})
