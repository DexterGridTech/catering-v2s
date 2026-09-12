import {describe, expect, it} from 'vitest'
import {readTerminalSurfaces} from '../src/application/terminalSurfaces'

const landscape = {
  PRIMARY: {width: 1280, height: 800},
  SECONDARY: {width: 960, height: 540},
} as const

describe('terminal surface declaration parser', () => {
  it('reads landscape and an optional PRIMARY-only portrait declaration', () => {
    expect(readTerminalSurfaces({
      orientations: {
        landscape,
        portrait: {
          PRIMARY: {width: 360, height: 720},
        },
      },
    })).toEqual({
      orientations: {
        landscape,
        portrait: {
          PRIMARY: {width: 360, height: 720},
        },
      },
    })
  })

  it('rejects a portrait SECONDARY declaration', () => {
    expect(() => readTerminalSurfaces({
      orientations: {
        landscape,
        portrait: {
          PRIMARY: {width: 360, height: 720},
          SECONDARY: {width: 360, height: 720},
        },
      },
    })).toThrow(/portrait.*SECONDARY.*not allowed/)
  })

  it('rejects a missing landscape declaration or a missing surface member', () => {
    expect(() => readTerminalSurfaces({orientations: {}})).toThrow(/landscape surfaces are required/)
    expect(() => readTerminalSurfaces({
      layout: 'column',
      scaleToFit: true,
      surfaces: landscape,
    })).toThrow(/invalid shape/)
    expect(() => readTerminalSurfaces({
      orientations: {landscape: {PRIMARY: landscape.PRIMARY}},
    })).toThrow(/landscape\.SECONDARY surface/)
  })

  it('rejects non-positive and non-finite canvas dimensions', () => {
    expect(() => readTerminalSurfaces({
      orientations: {
        landscape: {
          PRIMARY: {width: 0, height: 800},
          SECONDARY: landscape.SECONDARY,
        },
      },
    })).toThrow(/positive width and height/)
    expect(() => readTerminalSurfaces({
      orientations: {
        landscape: {
          PRIMARY: {width: Number.NaN, height: 800},
          SECONDARY: landscape.SECONDARY,
        },
      },
    })).toThrow(/positive width and height/)
  })

  it('maps declared orientation to the explicit surface form', async () => {
    const module = await import('../src/application/terminalSurfaces')
    expect(module.surfaceFormForOrientation('landscape')).toBe('laptop')
    expect(module.surfaceFormForOrientation('portrait')).toBe('mobile')
    expect(module.getSurfaceDeclarations(readTerminalSurfaces({orientations: {
      landscape,
      portrait: {PRIMARY: {width: 360, height: 800}},
    }}), 'mobile')).toEqual({PRIMARY: {width: 360, height: 800}})
  })
})
