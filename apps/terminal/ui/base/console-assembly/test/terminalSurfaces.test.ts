import {describe, expect, it} from 'vitest'
import {
  getSurfaceDeclarations,
  readTerminalSurfaces,
  surfaceFormForOrientation,
} from '../src'

const landscape = {
  PRIMARY: {width: 1280, height: 800},
  SECONDARY: {width: 1280, height: 800},
} as const

describe('shared terminal surface declarations', () => {
  it('preserves valid laptop and primary-only mobile declarations', () => {
    const surfaces = readTerminalSurfaces({
      orientations: {landscape, portrait: {PRIMARY: {width: 360, height: 640}}},
    }, {errorPrefix: 'test-console'})
    expect(surfaces).toEqual({
      orientations: {landscape, portrait: {PRIMARY: {width: 360, height: 640}}},
    })
    expect(Object.isFrozen(surfaces)).toBe(true)
    expect(Object.isFrozen(surfaces.orientations)).toBe(true)
    expect(getSurfaceDeclarations(surfaces, 'laptop', {errorPrefix: 'test-console'}))
      .toBe(surfaces.orientations.landscape)
    expect(getSurfaceDeclarations(surfaces, 'mobile', {errorPrefix: 'test-console'}))
      .toBe(surfaces.orientations.portrait)
    expect(surfaceFormForOrientation('landscape')).toBe('laptop')
    expect(surfaceFormForOrientation('portrait')).toBe('mobile')
  })

  it('rejects invalid shape, missing dimensions, non-positive dimensions and portrait secondary', () => {
    expect(() => readTerminalSurfaces({orientations: {}}, {errorPrefix: 'sample-console'}))
      .toThrow(/\[sample-console\].*landscape surfaces are required/)
    expect(() => readTerminalSurfaces({layout: 'column'}, {errorPrefix: 'sample-console'}))
      .toThrow(/\[sample-console\].*invalid shape/)
    expect(() => readTerminalSurfaces({orientations: {landscape: {
      PRIMARY: landscape.PRIMARY,
    }}}, {errorPrefix: 'sample-console'})).toThrow(/landscape\.SECONDARY surface/)
    expect(() => readTerminalSurfaces({orientations: {
      landscape,
      portrait: {PRIMARY: {width: 360, height: 640}, SECONDARY: {width: 1, height: 1}},
    }}, {errorPrefix: 'sample-console'})).toThrow(/portrait\.SECONDARY is not allowed/)
    expect(() => readTerminalSurfaces({orientations: {
      landscape: {PRIMARY: {width: 0, height: 800}, SECONDARY: landscape.SECONDARY},
    }}, {errorPrefix: 'sample-console'})).toThrow(/positive width and height/)
  })

  it('fails mobile selection when the package has no portrait declaration', () => {
    const surfaces = readTerminalSurfaces({orientations: {landscape}}, {errorPrefix: 'sample2'})
    expect(() => getSurfaceDeclarations(surfaces, 'mobile', {errorPrefix: 'sample2'}))
      .toThrow(/\[sample2\].*mobile surface declarations are required/)
  })
})
